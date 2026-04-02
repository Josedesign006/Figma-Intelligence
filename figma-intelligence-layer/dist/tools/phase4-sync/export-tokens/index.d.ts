export interface ExportTokensArgs {
    format: "css" | "scss" | "tailwind" | "style-dictionary" | "dtcg" | "swift" | "kotlin" | "json" | "all";
    /** Filter by collection name (substring match, case-insensitive) */
    collectionFilter?: string;
    /** Filter by token type */
    tokenTypes?: Array<"COLOR" | "FLOAT" | "STRING" | "BOOLEAN">;
    /** Which mode to export (e.g. "Light", "Dark"). Exports all modes if omitted. */
    mode?: string;
    /** Include alias chain comments showing semantic → primitive → raw */
    includeAliasChains?: boolean;
    /** CSS selector to wrap custom properties in (default ":root") */
    cssSelector?: string;
    /** Tailwind: prefix for custom token keys (default "ds") */
    tailwindPrefix?: string;
}
export declare function exportTokensHandler(args: ExportTokensArgs): Promise<unknown>;
//# sourceMappingURL=index.d.ts.map