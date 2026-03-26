"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeClient = void 0;
const ws_1 = __importDefault(require("ws"));
class BridgeClient {
    constructor(port) {
        this.ws = null;
        this.messageHandlers = [];
        this.statusHandlers = [];
        this.reconnectTimer = null;
        this.reconnectDelay = 2000;
        this.maxReconnectDelay = 30000;
        this.intentionalClose = false;
        this._connected = false;
        this.port = port;
    }
    get connected() {
        return this._connected;
    }
    connect() {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            return;
        }
        this.intentionalClose = false;
        try {
            this.ws = new ws_1.default(`ws://localhost:${this.port}/vscode`);
        }
        catch {
            this.scheduleReconnect();
            return;
        }
        this.ws.on("open", () => {
            this._connected = true;
            this.reconnectDelay = 2000;
            this.notifyStatus(true);
            // Send hello with client type
            this.send({
                type: "vscode-hello",
                clientType: "vscode-chat-extension",
                version: "0.1.0",
            });
        });
        this.ws.on("message", (data) => {
            try {
                const msg = JSON.parse(data.toString());
                for (const handler of this.messageHandlers) {
                    handler(msg);
                }
            }
            catch {
                // ignore parse errors
            }
        });
        this.ws.on("close", () => {
            this._connected = false;
            this.notifyStatus(false);
            if (!this.intentionalClose) {
                this.scheduleReconnect();
            }
        });
        this.ws.on("error", () => {
            // error event is followed by close event, reconnect happens there
        });
    }
    disconnect() {
        this.intentionalClose = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this._connected = false;
        this.notifyStatus(false);
    }
    reconnect() {
        this.disconnect();
        this.intentionalClose = false;
        this.reconnectDelay = 2000;
        this.connect();
    }
    send(msg) {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    removeMessageHandler(handler) {
        this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    }
    onStatusChange(handler) {
        this.statusHandlers.push(handler);
    }
    notifyStatus(connected) {
        for (const handler of this.statusHandlers) {
            handler(connected);
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
    }
}
exports.BridgeClient = BridgeClient;
//# sourceMappingURL=bridge-client.js.map