export interface SemanticTokenEntry {
    name: string;
    category: string;
    type: "COLOR" | "FLOAT";
    description: string;
    /** Primitive token name for light mode */
    lightRef: string;
    /** Primitive token name for dark mode */
    darkRef: string;
}
export declare const SEMANTIC_TOKEN_CATALOG: SemanticTokenEntry[];
/**
 * Filter catalog entries by category.
 */
export declare function getTokensByCategory(category: string): SemanticTokenEntry[];
/**
 * Get all unique categories in the catalog.
 */
export declare function getCategories(): string[];
/**
 * Get only COLOR-type semantic tokens.
 */
export declare function getColorSemanticTokens(): SemanticTokenEntry[];
/**
 * Get only FLOAT-type semantic tokens (spacing, radius).
 */
export declare function getFloatSemanticTokens(): SemanticTokenEntry[];
//# sourceMappingURL=semantic-token-catalog.d.ts.map