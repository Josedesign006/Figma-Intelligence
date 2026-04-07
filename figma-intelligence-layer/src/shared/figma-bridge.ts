import WebSocket, { WebSocketServer } from "ws";
import {
  FigmaNode,
  ExecuteResult,
  ComponentSet,
  Token,
  FigmaBridgeEvent,
  FigmaBridgeEventType,
  FigmaContextSnapshot,
  FigmaDocumentChangeSummary,
  FigmaPageSummary,
  FigmaSelectionItem,
} from "./types.js";
import { BridgeCache } from "./cache.js";
import { compressResponse, CompressedResponse, CompressionTier } from "./response-compression.js";
import { enrichDesignSystem, EnrichedDesignSystem, resolveStyles, ResolvedStyle } from "./enrichment-pipeline.js";

const WS_PORT = parseInt(process.env.FIGMA_BRIDGE_PORT || "9001", 10);
const CLOUD_MODE = process.env.CLOUD_MODE === "true";
const REQUEST_TIMEOUT = parseInt(process.env.FIGMA_REQUEST_TIMEOUT || "30000", 10);

let relayServer: WebSocketServer | null = null;
let relayPluginSocket: WebSocket | null = null;
const relayMcpSockets = new Set<WebSocket>();
const relayPendingRequests = new Map<string, WebSocket>();
let relayStartupPromise: Promise<void> | null = null;
let relayPluginGraceTimer: ReturnType<typeof setTimeout> | null = null;
let relayPluginGraceQueue: Array<{ id: string; method: string; params: Record<string, unknown>; sender: WebSocket }> = [];

type RelayMessage = {
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  type?: string;
  fileName?: string;
  eventType?: FigmaBridgeEventType;
  payload?: unknown;
  timestamp?: number;
};

function sendRelayStatus(ws: WebSocket | null, mcpConnected: boolean) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({
    type: "bridge-status",
    mcpConnected,
  }));
}

function hasConnectedMcpSocket() {
  for (const socket of relayMcpSockets) {
    if (socket.readyState === WebSocket.OPEN) return true;
  }
  return false;
}

function broadcastToMcpSockets(raw: string) {
  for (const socket of relayMcpSockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(raw);
    }
  }
}

function setupRelayRouting(wss: WebSocketServer) {
  wss.on("connection", (ws, req) => {
    const path = req.url || "/";
    const isPlugin = path.includes("/plugin");

    if (isPlugin) {
      // Cancel grace timer if plugin reconnects within grace period
      if (relayPluginGraceTimer) {
        clearTimeout(relayPluginGraceTimer);
        relayPluginGraceTimer = null;
      }
      relayPluginSocket = ws;
      process.stderr.write("Figma bridge plugin connected\n");
      // Flush any requests queued during the grace period
      if (relayPluginGraceQueue.length > 0) {
        for (const queued of relayPluginGraceQueue) {
          if (queued.sender.readyState === WebSocket.OPEN) {
            relayPendingRequests.set(queued.id, queued.sender);
            ws.send(JSON.stringify({ type: "bridge-request", id: queued.id, method: queued.method, params: queued.params }));
          }
        }
        relayPluginGraceQueue = [];
      }
      sendRelayStatus(ws, hasConnectedMcpSocket());
    } else {
      relayMcpSockets.add(ws);
      process.stderr.write("Figma bridge MCP socket connected\n");
      sendRelayStatus(relayPluginSocket, true);
    }

    ws.on("message", (data) => {
      const raw = data.toString();
      let msg: RelayMessage;

      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (isPlugin) {
        if (msg.type === "plugin-hello") {
          process.stderr.write(`Figma bridge plugin ready (${msg.fileName || "unknown file"})\n`);
          return;
        }

        if (msg.type === "bridge-event") {
          broadcastToMcpSockets(raw);
          return;
        }

        if (msg.id && !msg.method) {
          const targetSocket = relayPendingRequests.get(msg.id);
          if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
            targetSocket.send(raw);
          } else {
            broadcastToMcpSockets(raw);
          }
          relayPendingRequests.delete(msg.id);
        }
        return;
      }

      if (msg.id && msg.method) {
        if (relayPluginSocket && relayPluginSocket.readyState === WebSocket.OPEN) {
          relayPendingRequests.set(msg.id, ws);
          relayPluginSocket.send(JSON.stringify({
            type: "bridge-request",
            id: msg.id,
            method: msg.method,
            params: msg.params || {},
          }));
        } else if (relayPluginGraceTimer) {
          // Plugin in grace period — queue request for when it reconnects
          relayPluginGraceQueue.push({ id: msg.id, method: msg.method, params: msg.params || {}, sender: ws });
        } else {
          ws.send(JSON.stringify({
            id: msg.id,
            error: "Figma plugin is not connected. Open Figma and run the Intelligence Bridge plugin.",
          }));
        }
      }
    });

    ws.on("close", () => {
      if (isPlugin && relayPluginSocket === ws) {
        process.stderr.write("Figma bridge plugin disconnected — 5s grace period\n");
        relayPluginGraceTimer = setTimeout(() => {
          relayPluginSocket = null;
          relayPluginGraceTimer = null;
          // Reject any queued requests
          for (const queued of relayPluginGraceQueue) {
            if (queued.sender.readyState === WebSocket.OPEN) {
              queued.sender.send(JSON.stringify({
                id: queued.id,
                error: "Figma plugin is not connected. Open Figma and run the Intelligence Bridge plugin.",
              }));
            }
          }
          relayPluginGraceQueue = [];
          process.stderr.write("Figma bridge plugin grace period expired\n");
        }, 5000);
      }

      if (!isPlugin) {
        relayMcpSockets.delete(ws);
        for (const [requestId, requestSocket] of relayPendingRequests.entries()) {
          if (requestSocket === ws) {
            relayPendingRequests.delete(requestId);
          }
        }
        process.stderr.write("Figma bridge MCP socket disconnected\n");
        sendRelayStatus(relayPluginSocket, hasConnectedMcpSocket());
      }
    });
  });
}

// P3: Port fallback range
const PORT_FALLBACK_RANGE = 10;

export async function ensureRelayServer(): Promise<void> {
  if (relayServer) return;
  if (relayStartupPromise) return relayStartupPromise;

  // When started by bridge-relay (FIGMA_BRIDGE_CLIENT_ONLY=1), skip creating
  // our own server — just connect as a client to the existing relay.
  if (process.env.FIGMA_BRIDGE_CLIENT_ONLY === "1") {
    process.stderr.write(`Figma bridge connecting as client to ws://localhost:${WS_PORT}\n`);
    return;
  }

  relayStartupPromise = new Promise<void>((resolve, reject) => {
    // Try to create our own relay server on the configured port
    const wss = new WebSocketServer({ port: WS_PORT, host: "0.0.0.0" });
    let settled = false;

    const finish = (callback: () => unknown) => {
      if (settled) return;
      settled = true;
      callback();
    };

    setupRelayRouting(wss);

    wss.on("listening", () => {
      relayServer = wss;
      process.stderr.write(`Figma bridge relay listening on ws://localhost:${WS_PORT}\n`);
      finish(() => resolve());
    });

    wss.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        // Port in use — bridge-relay is already running externally.
        // Don't try other ports; just connect as a client to the existing relay.
        process.stderr.write(`Figma bridge relay already running on ws://localhost:${WS_PORT} — connecting as client\n`);
        finish(() => resolve());
        return;
      }
      finish(() => reject(error));
    });
  }).finally(() => {
    relayStartupPromise = null;
  });

  return relayStartupPromise ?? Promise.resolve();
}

// ─────────────────────────────────────────────────────────────────────────────
// FigmaBridge
// Wraps the Desktop Bridge WebSocket connection with typed helpers
// ─────────────────────────────────────────────────────────────────────────────

export class FigmaBridge {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  private eventListeners = new Map<FigmaBridgeEventType | "*", Set<(event: FigmaBridgeEvent) => void>>();
  private context: FigmaContextSnapshot = {
    status: "disconnected",
    selection: [],
  };
  private hasHydratedStatus = false;
  private hasHydratedSelection = false;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private intentionalClose = false;
  private static readonly MAX_RECONNECT_DELAY = 30000;
  private static readonly INITIAL_RECONNECT_DELAY = 2000;
  private connectPromise: Promise<void> | null = null;
  private capabilitiesCache: Record<string, unknown> | null = null;
  private _activeDesignSystemId: string | null = null;

  // ─── Taxonomy auto-sync ─────────────────────────────────────────────────
  private _taxonomyAutoSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private _taxonomyAutoSyncCallback: (() => Promise<void>) | null = null;

  /**
   * Register a callback to run when variables change (for taxonomy docs auto-sync).
   * The callback is debounced with a 2-second delay.
   */
  setTaxonomyAutoSyncHandler(handler: (() => Promise<void>) | null): void {
    this._taxonomyAutoSyncCallback = handler;
  }

  private scheduleTaxonomyAutoSync(): void {
    if (!this._taxonomyAutoSyncCallback) return;
    if (this._taxonomyAutoSyncTimer) clearTimeout(this._taxonomyAutoSyncTimer);
    this._taxonomyAutoSyncTimer = setTimeout(async () => {
      this._taxonomyAutoSyncTimer = null;
      try {
        await this._taxonomyAutoSyncCallback?.();
      } catch (e) {
        process.stderr.write(`Taxonomy auto-sync error: ${e}\n`);
      }
    }, 2000);
  }

  // ─── P1: Caching Layer ──────────────────────────────────────────────────
  private _cache: BridgeCache | null = null;
  get cache(): BridgeCache {
    if (!this._cache) this._cache = new BridgeCache(this);
    return this._cache;
  }

  /**
   * Cloud mode: attach a tunnel WebSocket instead of connecting to localhost.
   * The tunnel WebSocket is the outbound connection from the user's local relay.
   * Messages flow: cloud FigmaBridge → tunnel → user's relay → Figma plugin.
   */
  attachTunnel(tunnelSocket: WebSocket): void {
    // Clean up any existing connection
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }

    this.ws = tunnelSocket;
    this.connected = true;
    this.context = {
      ...this.context,
      status: "connected",
      lastUpdatedAt: Date.now(),
    };

    tunnelSocket.on("message", (data) => this.handleMessage(String(data)));
    tunnelSocket.on("close", () => {
      this.invalidateConnection(new Error("FigmaBridge: tunnel closed"));
    });
    tunnelSocket.on("error", (err) => {
      this.invalidateConnection(err instanceof Error ? err : new Error(String(err)));
    });

    // Hydrate status in background
    this.hydrateAfterConnect();
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get the currently selected design system ID (e.g. "antd", "carbon", "mui").
   * Returns null if no design system is selected in the UI.
   */
  getActiveDesignSystemId(): string | null {
    return this._activeDesignSystemId;
  }

  /**
   * Request the current design system ID from the relay and cache it locally.
   */
  private async hydrateDesignSystemId(): Promise<void> {
    try {
      const result = await this.send<string | null>("getActiveDesignSystemId");
      this._activeDesignSystemId = result ?? null;
    } catch {
      // Non-critical — may not be supported by older relays
    }
  }

  private rejectAllPending(reason: Error) {
    const pending = Array.from(this.pendingRequests.values());
    this.pendingRequests.clear();
    for (const request of pending) {
      request.reject(reason);
    }
  }

  private invalidateConnection(reason: Error) {
    const socket = this.ws;
    this.connected = false;
    this.ws = null;
    // Clear ALL cached state so reconnect always fetches fresh data
    this.context = {
      status: "disconnected",
      fileName: undefined,
      currentPage: undefined,
      pageCount: 0,
      selection: [],
      lastUpdatedAt: Date.now(),
      lastDocumentChange: undefined,
    };
    this.hasHydratedStatus = false;
    this.hasHydratedSelection = false;
    this.capabilitiesCache = null;
    this.rejectAllPending(reason);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = this.reconnectDelay;
    process.stderr.write(`FigmaBridge: reconnecting in ${delay / 1000}s\n`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 1.5,
        FigmaBridge.MAX_RECONNECT_DELAY,
      );
      try {
        await this.connect();
        process.stderr.write("FigmaBridge: reconnected successfully\n");
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  async disconnect(): Promise<void> {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.invalidateConnection(new Error("FigmaBridge: intentional close"));
  }

  async connect(): Promise<void> {
    if (this.isConnected()) return;
    if (this.connectPromise) return this.connectPromise;
    await ensureRelayServer();
    this.connectPromise = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`ws://localhost:${WS_PORT}`);
      const handleFailure = (err: Error) => {
        this.connected = false;
        this.ws = null;
        reject(err);
      };

      socket.on("open", () => {
        this.ws = socket;
        this.connected = true;
        this.intentionalClose = false;
        this.reconnectDelay = FigmaBridge.INITIAL_RECONNECT_DELAY;
        this.context = {
          ...this.context,
          status: "connected",
          lastUpdatedAt: Date.now(),
        };
        // Proactively hydrate status + selection in background so next getStatus() is instant
        this.hydrateAfterConnect();
        resolve();
      });
      socket.on("error", (err) => {
        handleFailure(err instanceof Error ? err : new Error(String(err)));
      });
      socket.on("message", (data) => this.handleMessage(String(data)));
      socket.on("close", () => {
        this.invalidateConnection(new Error("FigmaBridge: socket closed"));
        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      });
    }).finally((): void => {
      this.connectPromise = null;
    });

    return this.connectPromise ?? Promise.resolve();
  }

  /** Fire-and-forget hydration after (re)connect — populates context cache quickly */
  private hydrateAfterConnect(): void {
    // Hydrate active design system ID from relay
    this.hydrateDesignSystemId();
    if (this.hasHydratedStatus) return;
    // Use a short timeout for the hydration RPC (5s instead of default 30s)
    const FAST_TIMEOUT = 5000;
    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const timeout = setTimeout(() => {
      this.pendingRequests.delete(id);
      // Don't invalidate connection on hydration timeout — it's best-effort
    }, FAST_TIMEOUT);

    this.pendingRequests.set(id, {
      resolve: (v) => {
        clearTimeout(timeout);
        const status = v as { fileName?: string; currentPage?: FigmaPageSummary; pageCount?: number; timestamp?: number };
        if (status?.fileName) {
          this.context = {
            ...this.context,
            status: "connected",
            fileName: status.fileName,
            currentPage: status.currentPage,
            pageCount: status.pageCount || 0,
            lastUpdatedAt: status.timestamp || Date.now(),
          };
          this.hasHydratedStatus = true;
        }
      },
      reject: (e) => {
        clearTimeout(timeout);
        // Swallow — hydration is best-effort
      },
    });

    this.ws.send(JSON.stringify({ id, method: "getStatus", params: {} }));
  }

  private emitEvent(event: FigmaBridgeEvent) {
    const specificListeners = this.eventListeners.get(event.eventType);
    const catchAllListeners = this.eventListeners.get("*");

    for (const listener of specificListeners || []) {
      listener(event);
    }

    for (const listener of catchAllListeners || []) {
      listener(event);
    }
  }

  private updateContextFromEvent(event: FigmaBridgeEvent) {
    const nextContext: FigmaContextSnapshot = {
      ...this.context,
      status: "connected",
      lastUpdatedAt: event.timestamp,
    };

    if (event.eventType === "bridge.ready") {
      const payload = event.payload as Partial<FigmaContextSnapshot>;
      nextContext.fileName = payload.fileName || nextContext.fileName;
      nextContext.currentPage = payload.currentPage || nextContext.currentPage;
      nextContext.pageCount = payload.pageCount || nextContext.pageCount;
      nextContext.selection = payload.selection || nextContext.selection;
      this.hasHydratedStatus = true;
      this.hasHydratedSelection = true;
    }

    if (event.eventType === "selectionchange") {
      nextContext.selection = (event.payload as { selection?: FigmaSelectionItem[] }).selection || [];
      this.hasHydratedSelection = true;
    }

    if (event.eventType === "currentpagechange") {
      const payload = event.payload as { currentPage?: FigmaPageSummary; selection?: FigmaSelectionItem[] };
      nextContext.currentPage = payload.currentPage || nextContext.currentPage;
      if (payload.selection) {
        nextContext.selection = payload.selection;
        this.hasHydratedSelection = true;
      }
      this.hasHydratedStatus = true;
    }

    if (event.eventType === "documentchange") {
      const payload = event.payload as FigmaDocumentChangeSummary;
      nextContext.lastDocumentChange = payload;
      // P1: Invalidate cache on document changes
      if (this._cache) this._cache.onDocumentChange();
    }

    // Auto-sync: trigger taxonomy docs re-render on variable changes
    if ((event.eventType as string) === "variable-change") {
      this.scheduleTaxonomyAutoSync();
    }

    this.context = nextContext;
  }

  private handleMessage(raw: string) {
    let msg: RelayMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    // Handle design system change broadcasts from relay
    if (msg.type === "design-system-changed") {
      this._activeDesignSystemId = (msg as Record<string, unknown>).designSystemId as string | null ?? null;
      return;
    }

    if (msg.type === "bridge-event" && msg.eventType) {
      const event: FigmaBridgeEvent = {
        type: "bridge-event",
        eventType: msg.eventType,
        payload: msg.payload,
        timestamp: msg.timestamp || Date.now(),
      };
      this.updateContextFromEvent(event);
      this.emitEvent(event);
      return;
    }
    if (!msg.id) return;
    const pending = this.pendingRequests.get(msg.id);
    if (!pending) return;
    this.pendingRequests.delete(msg.id);
    if (msg.error) {
      pending.reject(new Error(msg.error));
    } else {
      pending.resolve(msg.result);
    }
  }

  private send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return this.sendWithTimeout<T>(method, params, REQUEST_TIMEOUT);
  }

  private async sendWithTimeout<T>(method: string, params: Record<string, unknown> = {}, timeoutMs: number = REQUEST_TIMEOUT): Promise<T> {
    // Defense in depth: if disconnected, try to reconnect before failing
    if (!this.isConnected()) {
      try {
        await this.connect();
      } catch {
        throw new Error("FigmaBridge: not connected and reconnect failed");
      }
    }

    return new Promise((resolve, reject) => {
      if (!this.isConnected() || !this.ws) {
        reject(new Error("FigmaBridge: not connected"));
        return;
      }
      const id = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        const error = new Error(`FigmaBridge: timeout on method ${method}`);
        // Don't invalidateConnection — the WebSocket to the relay is likely fine;
        // only this individual request timed out (plugin slow / not connected).
        // Actual connection loss is detected by the socket "close" event.
        reject(error);
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (v) => { clearTimeout(timeout); resolve(v as T); },
        reject: (e) => { clearTimeout(timeout); reject(e); },
      });

      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async execute(script: string, timeoutMs?: number): Promise<ExecuteResult> {
    try {
      const result = await this.sendWithTimeout<unknown>("execute", { code: script }, timeoutMs || REQUEST_TIMEOUT);
      return { success: true, result };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getNode(nodeId: string): Promise<FigmaNode> {
    const result = await this.execute(`
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found: " + ${JSON.stringify(nodeId)});
      return JSON.parse(JSON.stringify(node));
    `);
    if (!result.success) throw new Error(result.error);
    return result.result as FigmaNode;
  }

  async takeScreenshot(nodeId: string): Promise<string> {
    // Use the plugin's dedicated "screenshot" handler — it exports PNG bytes
    // in the plugin sandbox, then the UI layer (browser) converts to base64.
    // This avoids calling btoa() inside the Figma plugin sandbox where it doesn't exist.
    const dataUri = await this.sendWithTimeout<string>("screenshot", { nodeId, scale: 2 }, 60000);
    return dataUri;
  }

  async importImage(imageDataUri: string): Promise<{ imageHash: string; byteLength: number }> {
    const result = await this.send<{ imageHash: string; byteLength: number }>("importImage", {
      imageDataUri,
    });
    return result;
  }

  async getComponentSets(): Promise<ComponentSet[]> {
    const result = await this.execute(`
      var page = figma.currentPage;
      var sets = page.findAll(function(n) { return n.type === 'COMPONENT_SET'; });
      var allSets = [];
      for (var j = 0; j < sets.length; j++) {
        var s = sets[j];
        try {
          allSets.push({
            id: s.id,
            name: s.name,
            description: s.description || '',
            variantGroupProperties: s.variantGroupProperties || {},
            children: s.children.map(function(c) { return { id: c.id, name: c.name, type: c.type, description: c.description || '' }; })
          });
        } catch (err) {
          // Skip component sets with corrupted variant metadata so clone generation can continue.
        }
        if (allSets.length > 200) break;
      }
      return allSets;
    `);
    if (!result.success) throw new Error(result.error);
    return result.result as ComponentSet[];
  }

  async getTokens(collectionId?: string): Promise<Token[]> {
    const filter = collectionId
      ? `collections.filter(c => c.id === ${JSON.stringify(collectionId)})`
      : "collections";
    const result = await this.execute(`
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const filtered = ${filter};
      const tokens = [];
      for (const col of filtered) {
        const vars = [];
        for (const id of col.variableIds) {
          const v = await figma.variables.getVariableByIdAsync(id);
          if (v) vars.push(v);
        }
        for (const v of vars) {
          const modeValues = {};
          for (const [modeId, val] of Object.entries(v.valuesByMode)) {
            const mode = col.modes.find(m => m.modeId === modeId);
            modeValues[mode ? mode.name : modeId] = val;
          }
          var firstVal = Object.values(modeValues)[0];
          tokens.push({
            id: v.id,
            name: v.name,
            type: v.resolvedType,
            value: firstVal !== undefined ? firstVal : null,
            collectionId: col.id,
            modeValues,
            description: v.description || '',
          });
        }
      }
      return tokens;
    `);
    if (!result.success) throw new Error(result.error);
    return result.result as Token[];
  }

  async getAllPages(): Promise<Array<{ id: string; name: string }>> {
    const result = await this.execute(`
      return figma.root.children.map(p => ({ id: p.id, name: p.name }));
    `);
    if (!result.success) throw new Error(result.error);
    return result.result as Array<{ id: string; name: string }>;
  }

  async createPage(name: string): Promise<string> {
    const result = await this.execute(`
      const page = figma.createPage();
      page.name = ${JSON.stringify(name)};
      return page.id;
    `);
    if (!result.success) throw new Error(result.error);
    return result.result as string;
  }

  async navigateToNode(nodeId: string): Promise<void> {
    const result = await this.execute(`
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (node) figma.viewport.scrollAndZoomIntoView([node]);
    `);
    if (!result.success) throw new Error(result.error);
  }

  async getAllInstances(): Promise<Array<{ id: string; mainComponentId: string; name: string; pageId: string }>> {
    const result = await this.execute(`
      const instances = [];
      const page = figma.currentPage;
      const found = page.findAll(n => n.type === 'INSTANCE');
      for (const inst of found) {
        instances.push({
          id: inst.id,
          mainComponentId: inst.mainComponent ? inst.mainComponent.id : '',
          name: inst.name,
          pageId: page.id,
        });
      }
      return instances;
    `);
    if (!result.success) throw new Error(result.error);
    return result.result as Array<{ id: string; mainComponentId: string; name: string; pageId: string }>;
  }

  async getPrototypeConnections(): Promise<Array<{
    fromId: string;
    fromName: string;
    toId: string;
    toName: string;
    trigger: Record<string, unknown>;
    action: Record<string, unknown>;
  }>> {
    const result = await this.execute(`
      const connections = [];
      const page = figma.currentPage;
      const frames = page.findAll(n => n.type === 'FRAME' || n.type === 'COMPONENT');
      for (const frame of frames) {
        const reactions = frame.reactions || [];
        for (const r of reactions) {
          if (r.action && r.action.type === 'NODE') {
            const destNode = await figma.getNodeByIdAsync(r.action.destinationId);
            connections.push({
              fromId: frame.id,
              fromName: frame.name,
              toId: r.action.destinationId,
              toName: destNode ? destNode.name : 'Unknown',
              trigger: r.trigger || {},
              action: r.action || {},
            });
          }
        }
      }
      return connections;
    `);
    if (!result.success) throw new Error(result.error);
    return result.result as Array<{
      fromId: string;
      fromName: string;
      toId: string;
      toName: string;
      trigger: Record<string, unknown>;
      action: Record<string, unknown>;
    }>;
  }

  // disconnect() is defined above with reconnect-cleanup logic

  async hydrateContext(): Promise<FigmaContextSnapshot> {
    if (!this.context.fileName || !this.context.currentPage) {
      const status = await this.send<{
        status: "connected";
        fileName: string;
        currentPage: FigmaPageSummary;
        pageCount: number;
        timestamp: number;
      }>("getStatus");
      this.context = {
        ...this.context,
        status: "connected",
        fileName: status.fileName,
        currentPage: status.currentPage,
        pageCount: status.pageCount,
        lastUpdatedAt: status.timestamp,
      };
      this.hasHydratedStatus = true;
    }

    if (!this.hasHydratedSelection) {
      const selection = await this.send<FigmaSelectionItem[]>("getSelection");
      this.context = {
        ...this.context,
        status: "connected",
        selection,
        lastUpdatedAt: Date.now(),
      };
      this.hasHydratedSelection = true;
    }

    return this.getContextSnapshot();
  }

  getContextSnapshot(): FigmaContextSnapshot {
    return {
      ...this.context,
      selection: [...this.context.selection],
      currentPage: this.context.currentPage ? { ...this.context.currentPage } : undefined,
      lastDocumentChange: this.context.lastDocumentChange
        ? {
            documentChanges: this.context.lastDocumentChange.documentChanges.map((change) => ({ ...change })),
          }
        : undefined,
    };
  }

  onEvent(
    eventType: FigmaBridgeEventType | "*",
    listener: (event: FigmaBridgeEvent) => void
  ): () => void {
    const listeners = this.eventListeners.get(eventType) || new Set<(event: FigmaBridgeEvent) => void>();
    listeners.add(listener);
    this.eventListeners.set(eventType, listeners);

    return () => {
      const existing = this.eventListeners.get(eventType);
      if (!existing) return;
      existing.delete(listener);
      if (existing.size === 0) {
        this.eventListeners.delete(eventType);
      }
    };
  }

  handleIncomingMessage(raw: string) {
    this.handleMessage(raw);
  }

  // ─── Navigation & Status ─────────────────────────────────────────────────

  async getStatus(): Promise<Record<string, unknown>> {
    // Return cached status only if context has been hydrated and looks fresh
    if (this.hasHydratedStatus && this.context.fileName && this.context.currentPage) {
      return {
        status: this.context.status,
        fileName: this.context.fileName,
        currentPage: this.context.currentPage,
        pageCount: this.context.pageCount,
        timestamp: this.context.lastUpdatedAt || Date.now(),
      };
    }

    // Use shorter timeout (5s) for status — don't wait 30s for a simple ping
    const STATUS_TIMEOUT = 5000;
    const status = await this.sendWithTimeout<{
      status: "connected";
      fileName: string;
      currentPage: FigmaPageSummary;
      pageCount: number;
      timestamp: number;
    }>("getStatus", {}, STATUS_TIMEOUT);

    this.context = {
      ...this.context,
      status: "connected",
      fileName: status.fileName,
      currentPage: status.currentPage,
      pageCount: status.pageCount,
      lastUpdatedAt: status.timestamp,
    };
    this.hasHydratedStatus = true;

    return status;
  }

  async navigate(nodeId: string): Promise<Record<string, unknown>> {
    return this.send("navigate", { nodeId });
  }

  async getSelection(): Promise<Array<{ id: string; name: string; type: string }>> {
    if (this.hasHydratedSelection) {
      return this.context.selection.map((item) => ({ ...item }));
    }

    // Use shorter timeout (5s) for selection queries
    const selection = await this.sendWithTimeout<FigmaSelectionItem[]>("getSelection", {}, 5000);
    this.context = {
      ...this.context,
      status: "connected",
      selection,
      lastUpdatedAt: Date.now(),
    };
    this.hasHydratedSelection = true;

    return selection;
  }

  async getCapabilities(force = false): Promise<Record<string, unknown>> {
    if (!force && this.capabilitiesCache) {
      return { ...this.capabilitiesCache };
    }

    const capabilities = await this.send<Record<string, unknown>>("getCapabilities");
    this.capabilitiesCache = capabilities;
    return { ...capabilities };
  }

  private async ensureVariablesApi(): Promise<void> {
    const capabilities = await this.getCapabilities();
    if (!capabilities.variablesApi || !capabilities.localVariablesApi) {
      throw new Error(
        "Figma Variables API is unavailable in the current plugin runtime. Reopen the bridge plugin in a Variables-capable Figma editor context."
      );
    }
  }

  // ─── Variable CRUD ───────────────────────────────────────────────────────

  async createVariableCollection(name: string, initialModeName?: string): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("createVariableCollection", { name, initialModeName });
  }

  async createVariable(
    name: string,
    collectionId: string,
    resolvedType: string,
    valuesByMode?: Record<string, unknown>,
    description?: string,
    scopes?: string[],
    codeSyntax?: Record<string, string>
  ): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("createVariable", { name, collectionId, resolvedType, valuesByMode, description, scopes, codeSyntax });
  }

  /**
   * Set variable scoping (which properties this variable can be applied to).
   * Scopes: ALL_SCOPES, ALL_FILLS, FRAME_FILL, SHAPE_FILL, TEXT_FILL, STROKE_COLOR,
   * EFFECT_COLOR, WIDTH_HEIGHT, GAP, CORNER_RADIUS, OPACITY, STROKE_FLOAT,
   * EFFECT_FLOAT, FONT_SIZE, LINE_HEIGHT, LETTER_SPACING, PARAGRAPH_SPACING,
   * PARAGRAPH_INDENT, FONT_WEIGHT, FONT_FAMILY, FONT_STYLE, TEXT_CONTENT
   */
  async setVariableScopes(variableId: string, scopes: string[]): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("setVariableScopes", { variableId, scopes });
  }

  /**
   * Set code syntax for a variable (platform-specific code identifiers).
   * e.g. { WEB: "--color-brand-500", ANDROID: "colorBrand500", iOS: "Color.brand500" }
   */
  async setVariableCodeSyntax(variableId: string, codeSyntax: Record<string, string>): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("setVariableCodeSyntax", { variableId, codeSyntax });
  }

  /**
   * Set variable description.
   */
  async setVariableDescription(variableId: string, description: string): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("setVariableDescription", { variableId, description });
  }

  async updateVariable(variableId: string, modeId: string, value: unknown): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("updateVariable", { variableId, modeId, value });
  }

  async deleteVariable(variableId: string): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("deleteVariable", { variableId });
  }

  async renameVariable(variableId: string, newName: string): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("renameVariable", { variableId, newName });
  }

  async deleteVariableCollection(collectionId: string): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("deleteVariableCollection", { collectionId });
  }

  async addMode(collectionId: string, modeName: string): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("addMode", { collectionId, modeName });
  }

  async renameMode(collectionId: string, modeId: string, newName: string): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("renameMode", { collectionId, modeId, newName });
  }

  async batchCreateVariables(
    variables: Array<{
      name: string;
      collectionId: string;
      resolvedType: string;
      valuesByMode?: Record<string, unknown>;
      description?: string;
      scopes?: string[];
      codeSyntax?: Record<string, string>;
    }>
  ): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("batchCreateVariables", { variables });
  }

  async batchUpdateVariables(
    updates: Array<{ variableId: string; modeId: string; value: unknown }>
  ): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("batchUpdateVariables", { updates });
  }

  // ─── Node Operations ─────────────────────────────────────────────────────

  async cloneNode(nodeId: string, x?: number, y?: number): Promise<Record<string, unknown>> {
    return this.send("cloneNode", { nodeId, x, y });
  }

  async deleteNode(nodeId: string): Promise<Record<string, unknown>> {
    return this.send("deleteNode", { nodeId });
  }

  async moveNode(nodeId: string, x?: number, y?: number, parentId?: string): Promise<Record<string, unknown>> {
    return this.send("moveNode", { nodeId, x, y, parentId });
  }

  async resizeNode(nodeId: string, width: number, height: number): Promise<Record<string, unknown>> {
    return this.send("resizeNode", { nodeId, width, height });
  }

  async renameNode(nodeId: string, newName: string): Promise<Record<string, unknown>> {
    return this.send("renameNode", { nodeId, newName });
  }

  async setFills(nodeId: string, fills: unknown[]): Promise<Record<string, unknown>> {
    return this.send("setFills", { nodeId, fills });
  }

  async setStrokes(nodeId: string, strokes: unknown[], strokeWeight?: number): Promise<Record<string, unknown>> {
    return this.send("setStrokes", { nodeId, strokes, strokeWeight });
  }

  async setText(nodeId: string, characters: string, fontSize?: number): Promise<Record<string, unknown>> {
    return this.send("setText", { nodeId, characters, fontSize });
  }

  // ─── Component Operations ────────────────────────────────────────────────

  async searchComponents(query: string, limit?: number): Promise<Array<Record<string, unknown>>> {
    return this.send("searchComponents", { query, limit });
  }

  async instantiateComponent(
    nodeId: string,
    variant?: Record<string, string>,
    x?: number,
    y?: number,
    parentId?: string
  ): Promise<Record<string, unknown>> {
    return this.send("instantiateComponent", { nodeId, variant, x, y, parentId });
  }

  async setDescription(nodeId: string, description: string): Promise<Record<string, unknown>> {
    return this.send("setDescription", { nodeId, description });
  }

  // ─── Variable Binding ───────────────────────────────────────────────────

  async bindVariables(
    bindings: Array<{ nodeId: string; field: string; variableId: string; fillIndex?: number }>
  ): Promise<{ bound: number; total: number }> {
    if (bindings.length === 0) return { bound: 0, total: 0 };

    await this.ensureVariablesApi();

    const script = `
(async () => {
  const bindings = ${JSON.stringify(bindings)};
  let bound = 0;

  for (const b of bindings) {
    const node = await figma.getNodeByIdAsync(b.nodeId);
    if (!node) continue;

    const variable = await figma.variables.getVariableByIdAsync(b.variableId);
    if (!variable) continue;

    if (b.field === 'fills' || b.field === 'strokes') {
      const idx = b.fillIndex ?? 0;
      if (node[b.field] && node[b.field].length > idx) {
        const paints = [...node[b.field]];
        paints[idx] = figma.variables.setBoundVariableForPaint(paints[idx], 'color', variable);
        node[b.field] = paints;
        bound++;
      }
    } else {
      try {
        node.setBoundVariable(b.field, variable.id);
        bound++;
      } catch (e) { /* skip unsupported fields */ }
    }
  }

  return { bound, total: bindings.length };
})();
    `.trim();

    const result = await this.execute(script);
    if (!result.success) {
      return { bound: 0, total: bindings.length };
    }
    return result.result as { bound: number; total: number };
  }

  // ─── Design System Extraction ────────────────────────────────────────────

  async getVariables(collectionId?: string, verbosity?: string): Promise<unknown[]> {
    await this.ensureVariablesApi();
    return this.send("getVariables", { collectionId, verbosity });
  }

  async getStyles(): Promise<Record<string, unknown>> {
    return this.send("getStyles");
  }

  // ─── Deep Node Serialization & Batch Read ──────────────────────────────

  /**
   * Get a node with full recursive child data up to maxDepth.
   * Unlike getNode() which returns 1-level children as {id, name, type},
   * this returns the full property set for every descendant.
   */
  async getNodeDeep(nodeId: string, maxDepth: number = 10): Promise<unknown> {
    const result = await this.execute(`
(async () => {
  const maxDepth = ${Math.min(maxDepth, 20)};

  function serializeNode(node, depth) {
    const data = {
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible !== false,
    };

    // Geometry
    if ('x' in node) { data.x = node.x; data.y = node.y; }
    if ('width' in node) { data.width = node.width; data.height = node.height; }
    if ('absoluteBoundingBox' in node) data.absoluteBoundingBox = node.absoluteBoundingBox;
    if ('absoluteRenderBounds' in node) data.absoluteRenderBounds = node.absoluteRenderBounds;

    // Visual (fills/strokes/effects can be figma.mixed Symbol — guard with try-catch)
    try { if ('fills' in node && node.fills && typeof node.fills !== 'symbol') data.fills = JSON.parse(JSON.stringify(node.fills)); } catch (e) {}
    try { if ('strokes' in node && node.strokes && typeof node.strokes !== 'symbol') data.strokes = JSON.parse(JSON.stringify(node.strokes)); } catch (e) {}
    try { if ('effects' in node && node.effects && typeof node.effects !== 'symbol') data.effects = JSON.parse(JSON.stringify(node.effects)); } catch (e) {}
    if ('opacity' in node) data.opacity = node.opacity;
    try { if ('cornerRadius' in node && typeof node.cornerRadius !== 'symbol') data.cornerRadius = node.cornerRadius; } catch (e) {}
    try { if ('strokeWeight' in node && typeof node.strokeWeight !== 'symbol') data.strokeWeight = node.strokeWeight; } catch (e) {}

    // Layout
    if ('layoutMode' in node) {
      data.layoutMode = node.layoutMode;
      data.primaryAxisSizingMode = node.primaryAxisSizingMode;
      data.counterAxisSizingMode = node.counterAxisSizingMode;
      data.paddingTop = node.paddingTop;
      data.paddingRight = node.paddingRight;
      data.paddingBottom = node.paddingBottom;
      data.paddingLeft = node.paddingLeft;
      data.itemSpacing = node.itemSpacing;
      if (node.primaryAxisAlignItems) data.primaryAxisAlignItems = node.primaryAxisAlignItems;
      if (node.counterAxisAlignItems) data.counterAxisAlignItems = node.counterAxisAlignItems;
    }

    // Text (all text properties can be figma.mixed Symbol for mixed-style text)
    if (node.type === 'TEXT') {
      data.characters = node.characters;
      try {
        if (typeof node.fontSize !== 'symbol') data.fontSize = node.fontSize;
        if (typeof node.fontName !== 'symbol') data.fontName = JSON.parse(JSON.stringify(node.fontName));
        if (typeof node.lineHeight !== 'symbol') data.lineHeight = node.lineHeight;
        if (typeof node.letterSpacing !== 'symbol') data.letterSpacing = node.letterSpacing;
        if (typeof node.textAlignHorizontal !== 'symbol') data.textAlignHorizontal = node.textAlignHorizontal;
        if (typeof node.textAlignVertical !== 'symbol') data.textAlignVertical = node.textAlignVertical;
      } catch (e) { /* mixed styles */ }
    }

    // Component metadata
    if ('componentPropertyReferences' in node) data.componentPropertyReferences = node.componentPropertyReferences;
    if ('variantProperties' in node && node.variantProperties) data.variantProperties = node.variantProperties;
    if (node.type === 'INSTANCE' && node.mainComponent) {
      data.mainComponentId = node.mainComponent.id;
      data.mainComponentName = node.mainComponent.name;
    }
    if (node.description) data.description = node.description;

    // Variable bindings
    if ('boundVariables' in node && node.boundVariables) {
      try {
        const bv = {};
        for (const [prop, binding] of Object.entries(node.boundVariables)) {
          if (binding && typeof binding === 'object' && 'id' in binding) {
            bv[prop] = { id: binding.id, type: binding.type };
          } else if (Array.isArray(binding)) {
            bv[prop] = binding.map(b => b && typeof b === 'object' && 'id' in b ? { id: b.id } : null).filter(Boolean);
          }
        }
        if (Object.keys(bv).length > 0) data.boundVariables = bv;
      } catch (e) { /* skip */ }
    }

    // Recursive children
    if ('children' in node && node.children && depth < maxDepth) {
      data.children = [];
      for (const child of node.children) {
        data.children.push(serializeNode(child, depth + 1));
      }
      data.childCount = node.children.length;
    } else if ('children' in node && node.children) {
      data.childCount = node.children.length;
      data.children = node.children.map(c => ({ id: c.id, name: c.name, type: c.type }));
      data.truncatedAtDepth = depth;
    }

    return data;
  }

  const root = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
  if (!root) throw new Error('Node not found: ' + ${JSON.stringify(nodeId)});
  return serializeNode(root, 0);
})();
    `, 60000); // 60s timeout for deep trees

    if (!result.success) throw new Error(result.error);
    return result.result;
  }

  /**
   * Batch read multiple nodes in a single round-trip.
   * Returns a map of nodeId → serialized node data (1-level deep children).
   */
  async batchGetNodes(nodeIds: string[], includeChildren: boolean = true): Promise<Record<string, unknown>> {
    if (nodeIds.length === 0) return {};

    const result = await this.execute(`
(async () => {
  const ids = ${JSON.stringify(nodeIds.slice(0, 200))};
  const includeChildren = ${includeChildren};
  const results = {};

  for (const id of ids) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node) { results[id] = null; continue; }

    const data = {
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible !== false,
    };

    if ('x' in node) { data.x = node.x; data.y = node.y; }
    if ('width' in node) { data.width = node.width; data.height = node.height; }
    if ('fills' in node && node.fills) data.fills = JSON.parse(JSON.stringify(node.fills));
    if ('strokes' in node && node.strokes) data.strokes = JSON.parse(JSON.stringify(node.strokes));
    if ('effects' in node && node.effects) data.effects = JSON.parse(JSON.stringify(node.effects));
    if ('opacity' in node) data.opacity = node.opacity;
    if ('cornerRadius' in node) data.cornerRadius = node.cornerRadius;

    if ('layoutMode' in node) {
      data.layoutMode = node.layoutMode;
      data.paddingTop = node.paddingTop;
      data.paddingRight = node.paddingRight;
      data.paddingBottom = node.paddingBottom;
      data.paddingLeft = node.paddingLeft;
      data.itemSpacing = node.itemSpacing;
    }

    if (node.type === 'TEXT') {
      data.characters = node.characters;
      try {
        data.fontSize = node.fontSize;
        data.fontName = JSON.parse(JSON.stringify(node.fontName));
      } catch (e) {}
    }

    if (includeChildren && 'children' in node && node.children) {
      data.childCount = node.children.length;
      data.children = node.children.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        visible: c.visible !== false,
        x: 'x' in c ? c.x : undefined,
        y: 'y' in c ? c.y : undefined,
        width: 'width' in c ? c.width : undefined,
        height: 'height' in c ? c.height : undefined,
      }));
    }

    results[id] = data;
  }

  return results;
})();
    `, 60000);

    if (!result.success) throw new Error(result.error);
    return result.result as Record<string, unknown>;
  }

  // ─── Multi-Mode Variable Binding ──────────────────────────────────────────

  /**
   * Bind semantic variables to nodes AND set the explicit variable mode on a
   * container frame. This is the key method for theme-switching support.
   *
   * Unlike bindVariables() which just binds variables without mode awareness,
   * this method:
   *   1. Binds semantic variables (which have Light/Dark mode values)
   *   2. Sets the explicit mode on the target frame so children resolve correctly
   */
  async bindVariablesMultiMode(
    bindings: Array<{ nodeId: string; field: string; variableId: string; fillIndex?: number }>,
    targetFrameId: string,
    collectionId: string,
    activeModeId: string
  ): Promise<{ bound: number; total: number; modeSet: boolean; errors?: string[] }> {
    if (bindings.length === 0 && !targetFrameId) {
      return { bound: 0, total: 0, modeSet: false };
    }

    await this.ensureVariablesApi();

    // Import from token-binder for script generation
    const { buildMultiModeBindingScript } = await import("./token-binder.js");
    const script = buildMultiModeBindingScript(
      bindings.map((b) => ({
        nodeId: b.nodeId,
        field: b.field,
        fillIndex: b.fillIndex,
        semanticVariableId: b.variableId,
      })),
      targetFrameId,
      collectionId,
      activeModeId
    );

    const result = await this.execute(script);
    if (!result.success) {
      return { bound: 0, total: bindings.length, modeSet: false, errors: [result.error ?? "Unknown error"] };
    }
    return result.result as { bound: number; total: number; modeSet: boolean; errors?: string[] };
  }

  /**
   * Switch a frame's variable mode (theme switching).
   * All children with bound variables will resolve to the new mode's values.
   */
  async switchMode(
    frameId: string,
    collectionId: string,
    modeId: string
  ): Promise<{ success: boolean; error?: string }> {
    await this.ensureVariablesApi();
    const { buildModeSwitchScript } = await import("./token-binder.js");
    const script = buildModeSwitchScript(frameId, collectionId, modeId);
    const result = await this.execute(script);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return result.result as { success: boolean; error?: string };
  }

  /**
   * List all modes for a variable collection.
   * Returns mode IDs and names so callers can pick one for switchMode().
   */
  async listModes(collectionId: string): Promise<unknown> {
    await this.ensureVariablesApi();
    const { buildListModesScript } = await import("./token-binder.js");
    const script = buildListModesScript(collectionId);
    const result = await this.execute(script);
    if (!result.success) throw new Error(result.error);
    return result.result;
  }

  // ─── P0: Enrichment & Compression ─────────────────────────────────────

  /**
   * Get enriched design system data — tokens organized semantically,
   * components categorized, relationships mapped. Cached for 5 minutes.
   */
  async getEnrichedDesignSystem(): Promise<EnrichedDesignSystem> {
    return this.cache.getEnrichedDesignSystem();
  }

  /**
   * Get a node with resolved styles — fills as hex, typography categorized,
   * spacing grid-snapped, radius categorized.
   */
  async getNodeEnriched(nodeId: string): Promise<{ node: FigmaNode; styles: ResolvedStyle }> {
    const [node, tokens] = await Promise.all([
      this.cache.getNode(nodeId),
      this.cache.getTokens(),
    ]);
    const styles = resolveStyles(node, tokens);
    return { node, styles };
  }

  /**
   * Compress any response payload to fit within AI context window limits.
   * Automatically selects compression tier based on byte size.
   */
  compressForAI(data: unknown, forceTier?: CompressionTier): CompressedResponse {
    return compressResponse(data, { forceTier });
  }

  // ─── Create Child Node ───────────────────────────────────────────────────

  async createChild(
    childType: string,
    parentId?: string,
    name?: string,
    width?: number,
    height?: number,
    x?: number,
    y?: number,
    characters?: string
  ): Promise<Record<string, unknown>> {
    return this.send("createChild", { childType, parentId, name, width, height, x, y, characters });
  }

  // ─── Swarm Agent Cursor Methods ──────────────────────────────────────────

  async spawnAgentCursor(agentId: string, x: number, y: number): Promise<void> {
    await this.send("spawnAgentCursor", { agentId, x, y });
  }

  async moveAgentCursor(agentId: string, x: number, y: number, animate = true, durationMs = 250): Promise<void> {
    await this.send("moveAgentCursor", { agentId, x, y, animate, durationMs });
  }

  async updateAgentLabel(agentId: string, label: string): Promise<void> {
    await this.send("updateAgentLabel", { agentId, label });
  }

  async removeAgentCursor(agentId: string): Promise<void> {
    await this.send("removeAgentCursor", { agentId });
  }

  async postAgentChat(agentId: string, message: string, x: number, y: number): Promise<string> {
    const result = await this.send<{ noteId: string }>("agentChat", { agentId, message, x, y });
    return result.noteId;
  }

  async cleanupSwarm(): Promise<void> {
    await this.send("cleanupAgentCursors", {});
  }
}

// Singleton bridge instance (local mode only)
let bridgeInstance: FigmaBridge | null = null;

export async function getBridge(): Promise<FigmaBridge> {
  // Cloud mode: get bridge from session manager
  if (CLOUD_MODE) {
    const { getCurrentSessionToken, getSessionBridge } = await import("../cloud/session-manager.js");
    const token = getCurrentSessionToken();
    if (!token) {
      throw new Error("FigmaBridge: no session context — cloud mode requires a session token");
    }
    const bridge = getSessionBridge(token);
    if (!bridge) {
      throw new Error(
        "FigmaBridge: no tunnel connected for this session. " +
        "Make sure the local relay is running and connected to the cloud."
      );
    }
    return bridge;
  }

  // Local mode: use singleton
  if (!bridgeInstance) {
    bridgeInstance = new FigmaBridge();
  }
  await bridgeInstance.connect();
  return bridgeInstance;
}
