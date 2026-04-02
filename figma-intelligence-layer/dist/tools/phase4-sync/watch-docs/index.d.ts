export interface WatchDocsArgs {
    /** Action to perform */
    action: "check" | "regenerate" | "changelog" | "freshness" | "register-webhook";
    /** Component node IDs to watch (omit for all components on current page) */
    nodeIds?: string[];
    /** Path to store spec snapshots for comparison */
    snapshotDir?: string;
    /** Auto-regenerate specs that are stale */
    autoRegenerate?: boolean;
    /** Output format for regenerated specs */
    specFormat?: "json" | "markdown" | "figma-page" | "all";
    /** Webhook file key (for register-webhook action) */
    fileKey?: string;
}
export declare function watchDocsHandler(args: WatchDocsArgs): Promise<unknown>;
//# sourceMappingURL=index.d.ts.map