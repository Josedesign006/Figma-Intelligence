import { TokenNamingAnalysis, TokenNamingRuleSet } from "../../../shared/token-naming.js";
export interface TokenNamingArgs {
    action: "define" | "validate" | "suggest-renames" | "audit-current-file";
    names?: string[];
    collectionName?: string;
}
export interface TokenNamingResult {
    ok: boolean;
    action: TokenNamingArgs["action"];
    ruleSet: TokenNamingRuleSet;
    analyzedCount: number;
    summary: {
        valid: number;
        invalid: number;
        warnings: number;
    };
    analyses: TokenNamingAnalysis[];
    recommendations: string[];
}
export declare function tokenNamingHandler(args: TokenNamingArgs): Promise<TokenNamingResult>;
//# sourceMappingURL=index.d.ts.map