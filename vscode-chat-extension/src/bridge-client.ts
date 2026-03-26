import WebSocket from "ws";

type MessageHandler = (msg: any) => void;
type StatusHandler = (connected: boolean) => void;

export class BridgeClient {
  private ws: WebSocket | null = null;
  private port: number;
  private messageHandlers: MessageHandler[] = [];
  private statusHandlers: StatusHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private maxReconnectDelay = 30000;
  private intentionalClose = false;
  private _connected = false;

  constructor(port: number) {
    this.port = port;
  }

  get connected(): boolean {
    return this._connected;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.intentionalClose = false;

    try {
      this.ws = new WebSocket(`ws://localhost:${this.port}/vscode`);
    } catch {
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

    this.ws.on("message", (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        for (const handler of this.messageHandlers) {
          handler(msg);
        }
      } catch {
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

  send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.push(handler);
  }

  removeMessageHandler(handler: MessageHandler) {
    this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
  }

  onStatusChange(handler: StatusHandler) {
    this.statusHandlers.push(handler);
  }

  private notifyStatus(connected: boolean) {
    for (const handler of this.statusHandlers) {
      handler(connected);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 1.5,
      this.maxReconnectDelay
    );
  }
}
