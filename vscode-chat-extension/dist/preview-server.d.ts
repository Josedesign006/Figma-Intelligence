export declare class PreviewServer {
    private server;
    private port;
    private running;
    private servingDir;
    toggle(): Promise<void>;
    /**
     * Open the generated preview.html in VS Code's Simple Browser.
     * Starts a tiny local HTTP server so the preview works with all features.
     */
    openPreview(files: string[]): Promise<void>;
    private startServer;
    stop(): void;
}
