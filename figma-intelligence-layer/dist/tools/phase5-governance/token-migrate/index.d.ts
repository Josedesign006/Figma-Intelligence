export type TokenMigrationAction = "scan" | "preview" | "apply";
export type TokenMigrationScope = "variables" | "styles" | "all";
export type TokenMigrationSchema = "compact" | "expanded";
export interface TokenMigrateArgs {
    action: TokenMigrationAction;
    scope?: TokenMigrationScope;
    collectionName?: string;
    canonicalSchema?: TokenMigrationSchema;
    renameInPlace?: boolean;
    createAliases?: boolean;
    dryRun?: boolean;
}
export interface TokenMigrationItem {
    kind: "variable" | "style";
    subtype?: "paint" | "text" | "effect";
    id: string;
    collectionId?: string;
    collectionName?: string;
    originalName: string;
    normalizedName: string;
    suggestedName: string | null;
    confidence: number;
    safeToApply: boolean;
    reasons: string[];
    willRename: boolean;
}
export interface TokenMigrateResult {
    ok: boolean;
    action: TokenMigrationAction;
    scope: TokenMigrationScope;
    canonicalSchema: TokenMigrationSchema;
    scanned: {
        variables: number;
        styles: number;
    };
    summary: {
        proposed: number;
        safe: number;
        ambiguous: number;
        applied: number;
        aliased: number;
        skipped: number;
    };
    items: TokenMigrationItem[];
    appliedChanges: Array<{
        kind: "variable" | "style" | "variable-alias";
        id: string;
        from?: string;
        to: string;
    }>;
    notes: string[];
}
export declare function translateCanonicalName(name: string, schema: TokenMigrationSchema): {
    normalizedName: string;
    suggestedName: string | null;
    reasons: string[];
    confidence: number;
};
export declare function tokenMigrateHandler(args: TokenMigrateArgs): Promise<TokenMigrateResult>;
//# sourceMappingURL=index.d.ts.map