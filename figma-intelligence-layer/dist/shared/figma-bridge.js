"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FigmaBridge = void 0;
exports.ensureRelayServer = ensureRelayServer;
exports.getBridge = getBridge;
const ws_1 = __importStar(require("ws"));
const cache_js_1 = require("./cache.js");
const response_compression_js_1 = require("./response-compression.js");
const enrichment_pipeline_js_1 = require("./enrichment-pipeline.js");
const WS_PORT = parseInt(process.env.FIGMA_BRIDGE_PORT || "9001", 10);
const CLOUD_MODE = process.env.CLOUD_MODE === "true";
const REQUEST_TIMEOUT = parseInt(process.env.FIGMA_REQUEST_TIMEOUT || "30000", 10);
let relayServer = null;
let relayPluginSocket = null;
const relayMcpSockets = new Set();
const relayPendingRequests = new Map();
let relayStartupPromise = null;
function sendRelayStatus(ws, mcpConnected) {
    if (!ws || ws.readyState !== ws_1.default.OPEN)
        return;
    ws.send(JSON.stringify({
        type: "bridge-status",
        mcpConnected,
    }));
}
function hasConnectedMcpSocket() {
    for (const socket of relayMcpSockets) {
        if (socket.readyState === ws_1.default.OPEN)
            return true;
    }
    return false;
}
function broadcastToMcpSockets(raw) {
    for (const socket of relayMcpSockets) {
        if (socket.readyState === ws_1.default.OPEN) {
            socket.send(raw);
        }
    }
}
function setupRelayRouting(wss) {
    wss.on("connection", (ws, req) => {
        const path = req.url || "/";
        const isPlugin = path.includes("/plugin");
        if (isPlugin) {
            relayPluginSocket = ws;
            process.stderr.write("Figma bridge plugin connected\n");
            sendRelayStatus(ws, hasConnectedMcpSocket());
        }
        else {
            relayMcpSockets.add(ws);
            process.stderr.write("Figma bridge MCP socket connected\n");
            sendRelayStatus(relayPluginSocket, true);
        }
        ws.on("message", (data) => {
            const raw = data.toString();
            let msg;
            try {
                msg = JSON.parse(raw);
            }
            catch {
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
                    if (targetSocket && targetSocket.readyState === ws_1.default.OPEN) {
                        targetSocket.send(raw);
                    }
                    else {
                        broadcastToMcpSockets(raw);
                    }
                    relayPendingRequests.delete(msg.id);
                }
                return;
            }
            if (msg.id && msg.method) {
                if (relayPluginSocket && relayPluginSocket.readyState === ws_1.default.OPEN) {
                    relayPendingRequests.set(msg.id, ws);
                    relayPluginSocket.send(JSON.stringify({
                        type: "bridge-request",
                        id: msg.id,
                        method: msg.method,
                        params: msg.params || {},
                    }));
                }
                else {
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
async function ensureRelayServer() {
    if (relayServer)
        return;
    if (relayStartupPromise)
        return relayStartupPromise;
    relayStartupPromise = new Promise((resolve, reject) => {
        // Try to create our own relay server on the configured port
        const wss = new ws_1.WebSocketServer({ port: WS_PORT, host: "0.0.0.0" });
        let settled = false;
        const finish = (callback) => {
            if (settled)
                return;
            settled = true;
            callback();
        };
        setupRelayRouting(wss);
        wss.on("listening", () => {
            relayServer = wss;
            process.stderr.write(`Figma bridge relay listening on ws://localhost:${WS_PORT}\n`);
            finish(() => resolve());
        });
        wss.on("error", (error) => {
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
class FigmaBridge {
    ws = null;
    pendingRequests = new Map();
    eventListeners = new Map();
    context = {
        status: "disconnected",
        selection: [],
    };
    hasHydratedStatus = false;
    hasHydratedSelection = false;
    connected = false;
    connectPromise = null;
    capabilitiesCache = null;
    _activeDesignSystemId = null;
    // ─── Taxonomy auto-sync ─────────────────────────────────────────────────
    _taxonomyAutoSyncTimer = null;
    _taxonomyAutoSyncCallback = null;
    /**
     * Register a callback to run when variables change (for taxonomy docs auto-sync).
     * The callback is debounced with a 2-second delay.
     */
    setTaxonomyAutoSyncHandler(handler) {
        this._taxonomyAutoSyncCallback = handler;
    }
    scheduleTaxonomyAutoSync() {
        if (!this._taxonomyAutoSyncCallback)
            return;
        if (this._taxonomyAutoSyncTimer)
            clearTimeout(this._taxonomyAutoSyncTimer);
        this._taxonomyAutoSyncTimer = setTimeout(async () => {
            this._taxonomyAutoSyncTimer = null;
            try {
                await this._taxonomyAutoSyncCallback?.();
            }
            catch (e) {
                process.stderr.write(`Taxonomy auto-sync error: ${e}\n`);
            }
        }, 2000);
    }
    // ─── P1: Caching Layer ──────────────────────────────────────────────────
    _cache = null;
    get cache() {
        if (!this._cache)
            this._cache = new cache_js_1.BridgeCache(this);
        return this._cache;
    }
    /**
     * Cloud mode: attach a tunnel WebSocket instead of connecting to localhost.
     * The tunnel WebSocket is the outbound connection from the user's local relay.
     * Messages flow: cloud FigmaBridge → tunnel → user's relay → Figma plugin.
     */
    attachTunnel(tunnelSocket) {
        // Clean up any existing connection
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
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
    isConnected() {
        return this.connected && this.ws?.readyState === ws_1.default.OPEN;
    }
    /**
     * Get the currently selected design system ID (e.g. "antd", "carbon", "mui").
     * Returns null if no design system is selected in the UI.
     */
    getActiveDesignSystemId() {
        return this._activeDesignSystemId;
    }
    /**
     * Request the current design system ID from the relay and cache it locally.
     */
    async hydrateDesignSystemId() {
        try {
            const result = await this.send("getActiveDesignSystemId");
            this._activeDesignSystemId = result ?? null;
        }
        catch {
            // Non-critical — may not be supported by older relays
        }
    }
    rejectAllPending(reason) {
        const pending = Array.from(this.pendingRequests.values());
        this.pendingRequests.clear();
        for (const request of pending) {
            request.reject(reason);
        }
    }
    invalidateConnection(reason) {
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
        if (socket && socket.readyState === ws_1.default.OPEN) {
            socket.close();
        }
    }
    async connect() {
        if (this.isConnected())
            return;
        if (this.connectPromise)
            return this.connectPromise;
        await ensureRelayServer();
        this.connectPromise = new Promise((resolve, reject) => {
            const socket = new ws_1.default(`ws://localhost:${WS_PORT}`);
            const handleFailure = (err) => {
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
        }).finally(() => {
            this.connectPromise = null;
        });
        return this.connectPromise ?? Promise.resolve();
    }
    /** Fire-and-forget hydration after (re)connect — populates context cache quickly */
    hydrateAfterConnect() {
        // Hydrate active design system ID from relay
        this.hydrateDesignSystemId();
        if (this.hasHydratedStatus)
            return;
        // Use a short timeout for the hydration RPC (5s instead of default 30s)
        const FAST_TIMEOUT = 5000;
        const id = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN)
            return;
        const timeout = setTimeout(() => {
            this.pendingRequests.delete(id);
            // Don't invalidate connection on hydration timeout — it's best-effort
        }, FAST_TIMEOUT);
        this.pendingRequests.set(id, {
            resolve: (v) => {
                clearTimeout(timeout);
                const status = v;
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
    emitEvent(event) {
        const specificListeners = this.eventListeners.get(event.eventType);
        const catchAllListeners = this.eventListeners.get("*");
        for (const listener of specificListeners || []) {
            listener(event);
        }
        for (const listener of catchAllListeners || []) {
            listener(event);
        }
    }
    updateContextFromEvent(event) {
        const nextContext = {
            ...this.context,
            status: "connected",
            lastUpdatedAt: event.timestamp,
        };
        if (event.eventType === "bridge.ready") {
            const payload = event.payload;
            nextContext.fileName = payload.fileName || nextContext.fileName;
            nextContext.currentPage = payload.currentPage || nextContext.currentPage;
            nextContext.pageCount = payload.pageCount || nextContext.pageCount;
            nextContext.selection = payload.selection || nextContext.selection;
            this.hasHydratedStatus = true;
            this.hasHydratedSelection = true;
        }
        if (event.eventType === "selectionchange") {
            nextContext.selection = event.payload.selection || [];
            this.hasHydratedSelection = true;
        }
        if (event.eventType === "currentpagechange") {
            const payload = event.payload;
            nextContext.currentPage = payload.currentPage || nextContext.currentPage;
            if (payload.selection) {
                nextContext.selection = payload.selection;
                this.hasHydratedSelection = true;
            }
            this.hasHydratedStatus = true;
        }
        if (event.eventType === "documentchange") {
            const payload = event.payload;
            nextContext.lastDocumentChange = payload;
            // P1: Invalidate cache on document changes
            if (this._cache)
                this._cache.onDocumentChange();
        }
        // Auto-sync: trigger taxonomy docs re-render on variable changes
        if (event.eventType === "variable-change") {
            this.scheduleTaxonomyAutoSync();
        }
        this.context = nextContext;
    }
    handleMessage(raw) {
        let msg;
        try {
            msg = JSON.parse(raw);
        }
        catch {
            return;
        }
        // Handle design system change broadcasts from relay
        if (msg.type === "design-system-changed") {
            this._activeDesignSystemId = msg.designSystemId ?? null;
            return;
        }
        if (msg.type === "bridge-event" && msg.eventType) {
            const event = {
                type: "bridge-event",
                eventType: msg.eventType,
                payload: msg.payload,
                timestamp: msg.timestamp || Date.now(),
            };
            this.updateContextFromEvent(event);
            this.emitEvent(event);
            return;
        }
        if (!msg.id)
            return;
        const pending = this.pendingRequests.get(msg.id);
        if (!pending)
            return;
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
            pending.reject(new Error(msg.error));
        }
        else {
            pending.resolve(msg.result);
        }
    }
    send(method, params = {}) {
        return this.sendWithTimeout(method, params, REQUEST_TIMEOUT);
    }
    sendWithTimeout(method, params = {}, timeoutMs = REQUEST_TIMEOUT) {
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
                resolve: (v) => { clearTimeout(timeout); resolve(v); },
                reject: (e) => { clearTimeout(timeout); reject(e); },
            });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }
    async execute(script, timeoutMs) {
        try {
            const result = await this.sendWithTimeout("execute", { code: script }, timeoutMs || REQUEST_TIMEOUT);
            return { success: true, result };
        }
        catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
    async getNode(nodeId) {
        const result = await this.execute(`
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found: " + ${JSON.stringify(nodeId)});
      return JSON.parse(JSON.stringify(node));
    `);
        if (!result.success)
            throw new Error(result.error);
        return result.result;
    }
    async takeScreenshot(nodeId) {
        // Use the plugin's dedicated "screenshot" handler — it exports PNG bytes
        // in the plugin sandbox, then the UI layer (browser) converts to base64.
        // This avoids calling btoa() inside the Figma plugin sandbox where it doesn't exist.
        const dataUri = await this.sendWithTimeout("screenshot", { nodeId, scale: 2 }, 60000);
        return dataUri;
    }
    async importImage(imageDataUri) {
        const result = await this.send("importImage", {
            imageDataUri,
        });
        return result;
    }
    async getComponentSets() {
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
        if (!result.success)
            throw new Error(result.error);
        return result.result;
    }
    async getTokens(collectionId) {
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
        if (!result.success)
            throw new Error(result.error);
        return result.result;
    }
    async getAllPages() {
        const result = await this.execute(`
      return figma.root.children.map(p => ({ id: p.id, name: p.name }));
    `);
        if (!result.success)
            throw new Error(result.error);
        return result.result;
    }
    async createPage(name) {
        const result = await this.execute(`
      const page = figma.createPage();
      page.name = ${JSON.stringify(name)};
      return page.id;
    `);
        if (!result.success)
            throw new Error(result.error);
        return result.result;
    }
    async navigateToNode(nodeId) {
        const result = await this.execute(`
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (node) figma.viewport.scrollAndZoomIntoView([node]);
    `);
        if (!result.success)
            throw new Error(result.error);
    }
    async getAllInstances() {
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
        if (!result.success)
            throw new Error(result.error);
        return result.result;
    }
    async getPrototypeConnections() {
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
        if (!result.success)
            throw new Error(result.error);
        return result.result;
    }
    async disconnect() {
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
    async hydrateContext() {
        if (!this.context.fileName || !this.context.currentPage) {
            const status = await this.send("getStatus");
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
            const selection = await this.send("getSelection");
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
    getContextSnapshot() {
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
    onEvent(eventType, listener) {
        const listeners = this.eventListeners.get(eventType) || new Set();
        listeners.add(listener);
        this.eventListeners.set(eventType, listeners);
        return () => {
            const existing = this.eventListeners.get(eventType);
            if (!existing)
                return;
            existing.delete(listener);
            if (existing.size === 0) {
                this.eventListeners.delete(eventType);
            }
        };
    }
    handleIncomingMessage(raw) {
        this.handleMessage(raw);
    }
    // ─── Navigation & Status ─────────────────────────────────────────────────
    async getStatus() {
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
        const status = await this.sendWithTimeout("getStatus", {}, STATUS_TIMEOUT);
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
    async navigate(nodeId) {
        return this.send("navigate", { nodeId });
    }
    async getSelection() {
        if (this.hasHydratedSelection) {
            return this.context.selection.map((item) => ({ ...item }));
        }
        // Use shorter timeout (5s) for selection queries
        const selection = await this.sendWithTimeout("getSelection", {}, 5000);
        this.context = {
            ...this.context,
            status: "connected",
            selection,
            lastUpdatedAt: Date.now(),
        };
        this.hasHydratedSelection = true;
        return selection;
    }
    async getCapabilities(force = false) {
        if (!force && this.capabilitiesCache) {
            return { ...this.capabilitiesCache };
        }
        const capabilities = await this.send("getCapabilities");
        this.capabilitiesCache = capabilities;
        return { ...capabilities };
    }
    async ensureVariablesApi() {
        const capabilities = await this.getCapabilities();
        if (!capabilities.variablesApi || !capabilities.localVariablesApi) {
            throw new Error("Figma Variables API is unavailable in the current plugin runtime. Reopen the bridge plugin in a Variables-capable Figma editor context.");
        }
    }
    // ─── Variable CRUD ───────────────────────────────────────────────────────
    async createVariableCollection(name, initialModeName) {
        await this.ensureVariablesApi();
        return this.send("createVariableCollection", { name, initialModeName });
    }
    async createVariable(name, collectionId, resolvedType, valuesByMode, description, scopes, codeSyntax) {
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
    async setVariableScopes(variableId, scopes) {
        await this.ensureVariablesApi();
        return this.send("setVariableScopes", { variableId, scopes });
    }
    /**
     * Set code syntax for a variable (platform-specific code identifiers).
     * e.g. { WEB: "--color-brand-500", ANDROID: "colorBrand500", iOS: "Color.brand500" }
     */
    async setVariableCodeSyntax(variableId, codeSyntax) {
        await this.ensureVariablesApi();
        return this.send("setVariableCodeSyntax", { variableId, codeSyntax });
    }
    /**
     * Set variable description.
     */
    async setVariableDescription(variableId, description) {
        await this.ensureVariablesApi();
        return this.send("setVariableDescription", { variableId, description });
    }
    async updateVariable(variableId, modeId, value) {
        await this.ensureVariablesApi();
        return this.send("updateVariable", { variableId, modeId, value });
    }
    async deleteVariable(variableId) {
        await this.ensureVariablesApi();
        return this.send("deleteVariable", { variableId });
    }
    async renameVariable(variableId, newName) {
        await this.ensureVariablesApi();
        return this.send("renameVariable", { variableId, newName });
    }
    async deleteVariableCollection(collectionId) {
        await this.ensureVariablesApi();
        return this.send("deleteVariableCollection", { collectionId });
    }
    async addMode(collectionId, modeName) {
        await this.ensureVariablesApi();
        return this.send("addMode", { collectionId, modeName });
    }
    async renameMode(collectionId, modeId, newName) {
        await this.ensureVariablesApi();
        return this.send("renameMode", { collectionId, modeId, newName });
    }
    async batchCreateVariables(variables) {
        await this.ensureVariablesApi();
        return this.send("batchCreateVariables", { variables });
    }
    async batchUpdateVariables(updates) {
        await this.ensureVariablesApi();
        return this.send("batchUpdateVariables", { updates });
    }
    // ─── Node Operations ─────────────────────────────────────────────────────
    async cloneNode(nodeId, x, y) {
        return this.send("cloneNode", { nodeId, x, y });
    }
    async deleteNode(nodeId) {
        return this.send("deleteNode", { nodeId });
    }
    async moveNode(nodeId, x, y, parentId) {
        return this.send("moveNode", { nodeId, x, y, parentId });
    }
    async resizeNode(nodeId, width, height) {
        return this.send("resizeNode", { nodeId, width, height });
    }
    async renameNode(nodeId, newName) {
        return this.send("renameNode", { nodeId, newName });
    }
    async setFills(nodeId, fills) {
        return this.send("setFills", { nodeId, fills });
    }
    async setStrokes(nodeId, strokes, strokeWeight) {
        return this.send("setStrokes", { nodeId, strokes, strokeWeight });
    }
    async setText(nodeId, characters, fontSize) {
        return this.send("setText", { nodeId, characters, fontSize });
    }
    // ─── Component Operations ────────────────────────────────────────────────
    async searchComponents(query, limit) {
        return this.send("searchComponents", { query, limit });
    }
    async instantiateComponent(nodeId, variant, x, y, parentId) {
        return this.send("instantiateComponent", { nodeId, variant, x, y, parentId });
    }
    async setDescription(nodeId, description) {
        return this.send("setDescription", { nodeId, description });
    }
    // ─── Variable Binding ───────────────────────────────────────────────────
    async bindVariables(bindings) {
        if (bindings.length === 0)
            return { bound: 0, total: 0 };
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
        return result.result;
    }
    // ─── Design System Extraction ────────────────────────────────────────────
    async getVariables(collectionId, verbosity) {
        await this.ensureVariablesApi();
        return this.send("getVariables", { collectionId, verbosity });
    }
    async getStyles() {
        return this.send("getStyles");
    }
    // ─── Deep Node Serialization & Batch Read ──────────────────────────────
    /**
     * Get a node with full recursive child data up to maxDepth.
     * Unlike getNode() which returns 1-level children as {id, name, type},
     * this returns the full property set for every descendant.
     */
    async getNodeDeep(nodeId, maxDepth = 10) {
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
        if (!result.success)
            throw new Error(result.error);
        return result.result;
    }
    /**
     * Batch read multiple nodes in a single round-trip.
     * Returns a map of nodeId → serialized node data (1-level deep children).
     */
    async batchGetNodes(nodeIds, includeChildren = true) {
        if (nodeIds.length === 0)
            return {};
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
        if (!result.success)
            throw new Error(result.error);
        return result.result;
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
    async bindVariablesMultiMode(bindings, targetFrameId, collectionId, activeModeId) {
        if (bindings.length === 0 && !targetFrameId) {
            return { bound: 0, total: 0, modeSet: false };
        }
        await this.ensureVariablesApi();
        // Import from token-binder for script generation
        const { buildMultiModeBindingScript } = await Promise.resolve().then(() => __importStar(require("./token-binder.js")));
        const script = buildMultiModeBindingScript(bindings.map((b) => ({
            nodeId: b.nodeId,
            field: b.field,
            fillIndex: b.fillIndex,
            semanticVariableId: b.variableId,
        })), targetFrameId, collectionId, activeModeId);
        const result = await this.execute(script);
        if (!result.success) {
            return { bound: 0, total: bindings.length, modeSet: false, errors: [result.error ?? "Unknown error"] };
        }
        return result.result;
    }
    /**
     * Switch a frame's variable mode (theme switching).
     * All children with bound variables will resolve to the new mode's values.
     */
    async switchMode(frameId, collectionId, modeId) {
        await this.ensureVariablesApi();
        const { buildModeSwitchScript } = await Promise.resolve().then(() => __importStar(require("./token-binder.js")));
        const script = buildModeSwitchScript(frameId, collectionId, modeId);
        const result = await this.execute(script);
        if (!result.success) {
            return { success: false, error: result.error };
        }
        return result.result;
    }
    /**
     * List all modes for a variable collection.
     * Returns mode IDs and names so callers can pick one for switchMode().
     */
    async listModes(collectionId) {
        await this.ensureVariablesApi();
        const { buildListModesScript } = await Promise.resolve().then(() => __importStar(require("./token-binder.js")));
        const script = buildListModesScript(collectionId);
        const result = await this.execute(script);
        if (!result.success)
            throw new Error(result.error);
        return result.result;
    }
    // ─── P0: Enrichment & Compression ─────────────────────────────────────
    /**
     * Get enriched design system data — tokens organized semantically,
     * components categorized, relationships mapped. Cached for 5 minutes.
     */
    async getEnrichedDesignSystem() {
        return this.cache.getEnrichedDesignSystem();
    }
    /**
     * Get a node with resolved styles — fills as hex, typography categorized,
     * spacing grid-snapped, radius categorized.
     */
    async getNodeEnriched(nodeId) {
        const [node, tokens] = await Promise.all([
            this.cache.getNode(nodeId),
            this.cache.getTokens(),
        ]);
        const styles = (0, enrichment_pipeline_js_1.resolveStyles)(node, tokens);
        return { node, styles };
    }
    /**
     * Compress any response payload to fit within AI context window limits.
     * Automatically selects compression tier based on byte size.
     */
    compressForAI(data, forceTier) {
        return (0, response_compression_js_1.compressResponse)(data, { forceTier });
    }
    // ─── Create Child Node ───────────────────────────────────────────────────
    async createChild(childType, parentId, name, width, height, x, y, characters) {
        return this.send("createChild", { childType, parentId, name, width, height, x, y, characters });
    }
    // ─── Swarm Agent Cursor Methods ──────────────────────────────────────────
    async spawnAgentCursor(agentId, x, y) {
        await this.send("spawnAgentCursor", { agentId, x, y });
    }
    async moveAgentCursor(agentId, x, y, animate = true, durationMs = 250) {
        await this.send("moveAgentCursor", { agentId, x, y, animate, durationMs });
    }
    async updateAgentLabel(agentId, label) {
        await this.send("updateAgentLabel", { agentId, label });
    }
    async removeAgentCursor(agentId) {
        await this.send("removeAgentCursor", { agentId });
    }
    async postAgentChat(agentId, message, x, y) {
        const result = await this.send("agentChat", { agentId, message, x, y });
        return result.noteId;
    }
    async cleanupSwarm() {
        await this.send("cleanupAgentCursors", {});
    }
}
exports.FigmaBridge = FigmaBridge;
// Singleton bridge instance (local mode only)
let bridgeInstance = null;
async function getBridge() {
    // Cloud mode: get bridge from session manager
    if (CLOUD_MODE) {
        const { getCurrentSessionToken, getSessionBridge } = await Promise.resolve().then(() => __importStar(require("../cloud/session-manager.js")));
        const token = getCurrentSessionToken();
        if (!token) {
            throw new Error("FigmaBridge: no session context — cloud mode requires a session token");
        }
        const bridge = getSessionBridge(token);
        if (!bridge) {
            throw new Error("FigmaBridge: no tunnel connected for this session. " +
                "Make sure the local relay is running and connected to the cloud.");
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
//# sourceMappingURL=figma-bridge.js.map