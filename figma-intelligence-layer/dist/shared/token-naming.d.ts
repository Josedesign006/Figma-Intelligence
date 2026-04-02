export type TokenNamingDomain = "primitive" | "semantic" | "component" | "unknown";
export interface TokenNamingRuleSet {
    primitiveCategories: string[];
    semanticCategories: string[];
    componentPrefix: string;
    semanticPrefix: string;
    separator: "/";
}
export interface TokenNamingIssue {
    severity: "error" | "warning";
    code: "empty-name" | "invalid-characters" | "duplicate-separator" | "uppercase" | "unknown-domain" | "unknown-primitive-category" | "typo" | "component-prefix" | "semantic-prefix" | "short-name";
    message: string;
}
export interface TokenNamingAnalysis {
    originalName: string;
    normalizedName: string;
    domain: TokenNamingDomain;
    isValid: boolean;
    issues: TokenNamingIssue[];
    suggestedName: string | null;
}
export declare function getDefaultTokenNamingRules(): TokenNamingRuleSet;
export declare function analyzeTokenName(name: string, rules?: TokenNamingRuleSet): TokenNamingAnalysis;
export declare function analyzeTokenNames(names: string[], rules?: TokenNamingRuleSet): TokenNamingAnalysis[];
export interface TokenGraphNode {
    id: string;
    name: string;
    aliasTarget?: string;
}
export interface CircularRefResult {
    hasCircular: boolean;
    cycles: string[][];
}
/**
 * Detect circular references in token alias chains.
 * Takes a map of variable ID → { name, aliasTarget (variable ID) }.
 * Returns all cycles found via DFS.
 */
export declare function detectCircularAliases(tokens: Map<string, TokenGraphNode>): CircularRefResult;
export interface CrossModeIssue {
    tokenName: string;
    collection: string;
    presentModes: string[];
    missingModes: string[];
}
/**
 * Check cross-mode consistency: find tokens that exist in some modes but not others.
 * Takes raw Figma variable collections.
 */
export declare function detectCrossModeGaps(collections: Array<{
    name: string;
    modes: Array<{
        modeId: string;
        name: string;
    }>;
    variables: Array<{
        name: string;
        valuesByMode: Record<string, unknown>;
    }>;
}>): CrossModeIssue[];
export interface OrphanTokenResult {
    tokenName: string;
    collection: string;
    type: string;
    isReferenced: boolean;
}
/**
 * Find orphan tokens — tokens that are neither bound to any node
 * nor referenced as aliases by other tokens.
 * Takes collections and a set of used variable IDs from the file.
 */
export declare function findOrphanTokens(collections: Array<{
    name: string;
    variables: Array<{
        id: string;
        name: string;
        resolvedType: string;
        valuesByMode: Record<string, unknown>;
    }>;
}>, usedVariableIds: Set<string>): OrphanTokenResult[];
//# sourceMappingURL=token-naming.d.ts.map