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
const REQUEST_TIMEOUT = parseInt(process.env.FIGMA_REQUEST_TIMEOUT || "30000", 10);

let relayServer: WebSocketServer | null = null;
let relayPluginSocket: WebSocket | null = null;
const relayMcpSockets = new Set<WebSocket>();
const relayPendingRequests = new Map<string, WebSocket>();
let relayStartupPromise: Promise<void> | null = null;

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
      relayPluginSocket = ws;
      process.stderr.write("Figma bridge plugin connected\n");
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
        relayPluginSocket = null;
        process.stderr.write("Figma bridge plugin disconnected\n");
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

  relayStartupPromise = new Promise<void>((resolve, reject) => {
    // Try to create our own relay server on the configured port
    const wss = new WebSocketServer({ port: WS_PORT });
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
  private connectPromise: Promise<void> | null = null;
  private capabilitiesCache: Record<string, unknown> | null = null;

  // ─── P1: Caching Layer ──────────────────────────────────────────────────
  private _cache: BridgeCache | null = null;
  get cache(): BridgeCache {
    if (!this._cache) this._cache = new BridgeCache(this);
    return this._cache;
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
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
      });
    }).finally((): void => {
      this.connectPromise = null;
    });

    return this.connectPromise ?? Promise.resolve();
  }

  /** Fire-and-forget hydration after (re)connect — populates context cache quickly */
  private hydrateAfterConnect(): void {
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

    this.context = nextContext;
  }

  private handleMessage(raw: string) {
    let msg: RelayMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
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

  private sendWithTimeout<T>(method: string, params: Record<string, unknown> = {}, timeoutMs: number = REQUEST_TIMEOUT): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected() || !this.ws) {
        reject(new Error("FigmaBridge: not connected"));
        return;
      }
      const id = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        const error = new Error(`FigmaBridge: timeout on method ${method}`);
        this.invalidateConnection(error);
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

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
      this.context = {
        ...this.context,
        status: "disconnected",
        lastUpdatedAt: Date.now(),
      };
    }
  }

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
    description?: string
  ): Promise<Record<string, unknown>> {
    await this.ensureVariablesApi();
    return this.send("createVariable", { name, collectionId, resolvedType, valuesByMode, description });
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
}

// Singleton bridge instance
let bridgeInstance: FigmaBridge | null = null;

export async function getBridge(): Promise<FigmaBridge> {
  if (!bridgeInstance) {
    bridgeInstance = new FigmaBridge();
  }
  await bridgeInstance.connect();
  return bridgeInstance;
}
