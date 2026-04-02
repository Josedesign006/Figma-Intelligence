export interface DtcgValidationIssue {
    path: string;
    severity: "error" | "warning";
    code: string;
    message: string;
}
export interface DtcgValidationResult {
    valid: boolean;
    issues: DtcgValidationIssue[];
    stats: {
        totalTokens: number;
        totalGroups: number;
        tokensByType: Record<string, number>;
        hasTypeInheritance: boolean;
        hasDeprecatedTokens: boolean;
        aliasCount: number;
        circularReferences: string[];
    };
}
export declare const DTCG_TOKEN_TYPES: readonly ["color", "dimension", "fontFamily", "fontWeight", "duration", "cubicBezier", "number", "string", "boolean", "shadow", "strokeStyle", "border", "transition", "gradient", "typography"];
export type DtcgTokenType = typeof DTCG_TOKEN_TYPES[number];
export declare function resolveInheritedType(tokens: Record<string, unknown>, path: string[]): DtcgTokenType | null;
export declare function validateTokenValue(value: unknown, type: DtcgTokenType): DtcgValidationIssue[];
export declare function detectCircularReferences(tokens: Record<string, unknown>): string[];
export declare function validateDtcg(tokens: Record<string, unknown>): DtcgValidationResult;
//# sourceMappingURL=dtcg-validator.d.ts.map