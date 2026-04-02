export interface CiCheckArgs {
    /** What checks to run */
    checks: Array<"lint" | "health" | "tokens" | "all">;
    /** Output format */
    outputFormat: "github-actions" | "sarif" | "pr-comment" | "json" | "all";
    /** Minimum overall health score to pass (0-100, default 70) */
    healthThreshold?: number;
    /** Maximum allowed lint errors (default 0 — any error fails) */
    maxLintErrors?: number;
    /** Maximum allowed lint warnings (default -1 = unlimited) */
    maxLintWarnings?: number;
    /** Figma node ID scope (default: current page) */
    nodeId?: string;
    /** Generate a GitHub Action YAML workflow file */
    generateWorkflow?: boolean;
}
export declare function ciCheckHandler(args: CiCheckArgs): Promise<unknown>;
//# sourceMappingURL=index.d.ts.map