export interface SemanticTokenEntry {
    name: string;
    category: string;
    type: "COLOR" | "FLOAT" | "STRING";
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
 * Get only FLOAT-type semantic tokens (spacing, radius, z-index, etc.).
 */
export declare function getFloatSemanticTokens(): SemanticTokenEntry[];
/**
 * Get only STRING-type semantic tokens (shadows, easing curves).
 */
export declare function getStringSemanticTokens(): SemanticTokenEntry[];
/**
 * Get elevation/shadow tokens.
 */
export declare function getElevationTokens(): SemanticTokenEntry[];
/**
 * Get motion tokens (durations and easing curves).
 */
export declare function getMotionTokens(): SemanticTokenEntry[];
/**
 * Get typography detail tokens (weights, line-heights, letter-spacing).
 */
export declare function getTypographyTokens(): SemanticTokenEntry[];
//# sourceMappingURL=semantic-token-catalog.d.ts.map