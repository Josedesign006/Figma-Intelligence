type MessageHandler = (msg: any) => void;
type StatusHandler = (connected: boolean) => void;
export declare class BridgeClient {
    private ws;
    private port;
    private messageHandlers;
    private statusHandlers;
    private reconnectTimer;
    private reconnectDelay;
    private maxReconnectDelay;
    private intentionalClose;
    private _connected;
    constructor(port: number);
    get connected(): boolean;
    connect(): void;
    disconnect(): void;
    reconnect(): void;
    send(msg: any): void;
    onMessage(handler: MessageHandler): void;
    removeMessageHandler(handler: MessageHandler): void;
    onStatusChange(handler: StatusHandler): void;
    private notifyStatus;
    private scheduleReconnect;
}
export {};
