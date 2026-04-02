/**
 * figma_token_docs — Living token documentation generator
 *
 * Fetches all design tokens from the Figma bridge, organizes them by category,
 * and generates documentation in multiple output formats (Figma, Markdown, JSON, HTML).
 * Token data is never fabricated — all values come from actual Figma variables.
 */
export interface TokenDocsArgs {
    outputFormat: "figma" | "markdown" | "json" | "html";
    categories?: string[];
    collectionFilter?: string;
    includeVisualSwatches?: boolean;
    includeUsageExamples?: boolean;
    includeAliasChains?: boolean;
    pageName?: string;
}
export interface TokenDocsResult {
    ok: boolean;
    format: TokenDocsArgs["outputFormat"];
    tokenCount: number;
    collectionCount: number;
    categoryCount: number;
    output: string | TokenDocsJsonOutput;
    notes: string[];
}
interface TokenDocsJsonOutput {
    generatedAt: string;
    totalTokens: number;
    collections: string[];
    categories: Record<string, {
        count: number;
        tokens: Array<{
            name: string;
            resolvedType: string;
            description: string;
            values: Record<string, unknown>;
            aliasOf?: string;
            aliasChain?: string[];
        }>;
    }>;
}
export declare function tokenDocsHandler(args: TokenDocsArgs): Promise<unknown>;
export {};
//# sourceMappingURL=index.d.ts.map