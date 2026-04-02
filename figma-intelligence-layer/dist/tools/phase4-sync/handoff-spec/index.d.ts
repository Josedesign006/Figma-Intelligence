export interface HandoffSpecArgs {
    /** Figma node ID of the component/frame to spec */
    nodeId: string;
    /** Output format */
    outputFormat: "json" | "markdown" | "figma-page" | "all";
    /** Include copy-paste CSS snippets for each element */
    includeCss?: boolean;
    /** Include asset export list */
    includeAssets?: boolean;
    /** CSS unit preference */
    cssUnit?: "px" | "rem";
    /** rem base size (default 16) */
    remBase?: number;
    /** Max depth for recursive element scanning */
    maxDepth?: number;
}
export declare function handoffSpecHandler(args: HandoffSpecArgs): Promise<unknown>;
//# sourceMappingURL=index.d.ts.map