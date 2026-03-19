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
//# sourceMappingURL=token-naming.d.ts.map