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
const WS_PORT = parseInt(process.env.FIGMA_BRIDGE_PORT || "9001", 10);
const REQUEST_TIMEOUT = parseInt(process.env.FIGMA_REQUEST_TIMEOUT || "90000", 10);
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
async function ensureRelayServer() {
    if (relayServer)
        return;
    if (relayStartupPromise)
        return relayStartupPromise;
    relayStartupPromise = new Promise((resolve, reject) => {
        const wss = new ws_1.WebSocketServer({ port: WS_PORT });
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
                process.stderr.write(`Figma bridge relay already running on ws://localhost:${WS_PORT}\n`);
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
    isConnected() {
        return this.connected && this.ws?.readyState === ws_1.default.OPEN;
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
        this.context = {
            ...this.context,
            status: "disconnected",
            lastUpdatedAt: Date.now(),
        };
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
            }, REQUEST_TIMEOUT);
            this.pendingRequests.set(id, {
                resolve: (v) => { clearTimeout(timeout); resolve(v); },
                reject: (e) => { clearTimeout(timeout); reject(e); },
            });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }
    async execute(script) {
        try {
            const result = await this.send("execute", { code: script });
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
        const result = await this.execute(`
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found");
      const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
      const base64 = btoa(String.fromCharCode(...bytes));
      return 'data:image/png;base64,' + base64;
    `);
        if (!result.success)
            throw new Error(result.error);
        return result.result;
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
        if (this.context.fileName && this.context.currentPage) {
            return {
                status: this.context.status,
                fileName: this.context.fileName,
                currentPage: this.context.currentPage,
                pageCount: this.context.pageCount,
                timestamp: this.context.lastUpdatedAt || Date.now(),
            };
        }
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
        return status;
    }
    async navigate(nodeId) {
        return this.send("navigate", { nodeId });
    }
    async getSelection() {
        if (this.hasHydratedSelection) {
            return this.context.selection.map((item) => ({ ...item }));
        }
        const selection = await this.send("getSelection");
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
    async createVariable(name, collectionId, resolvedType, valuesByMode, description) {
        await this.ensureVariablesApi();
        return this.send("createVariable", { name, collectionId, resolvedType, valuesByMode, description });
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
    // ─── Design System Extraction ────────────────────────────────────────────
    async getVariables(collectionId, verbosity) {
        await this.ensureVariablesApi();
        return this.send("getVariables", { collectionId, verbosity });
    }
    async getStyles() {
        return this.send("getStyles");
    }
    // ─── Create Child Node ───────────────────────────────────────────────────
    async createChild(childType, parentId, name, width, height, x, y, characters) {
        return this.send("createChild", { childType, parentId, name, width, height, x, y, characters });
    }
}
exports.FigmaBridge = FigmaBridge;
// Singleton bridge instance
let bridgeInstance = null;
async function getBridge() {
    if (!bridgeInstance) {
        bridgeInstance = new FigmaBridge();
    }
    await bridgeInstance.connect();
    return bridgeInstance;
}
//# sourceMappingURL=figma-bridge.js.map