export interface DsPrimitivesArgs {
    brandName: string;
    primaryColor?: string;
    secondaryColor?: string;
    neutralColor?: string;
    accentColor?: string;
    createSemantics?: boolean;
    createDarkMode?: boolean;
}
export interface DsPrimitivesResult {
    ok: boolean;
    diagnostics: {
        variablesApi: boolean;
        localVariablesApi: boolean;
        styleApi: boolean;
        editorType?: string;
        fileName?: string;
        reason?: string;
    };
    collectionsCreated: Array<{
        id: string;
        name: string;
        variableCount: number;
    }>;
    tokenCounts: Record<string, number>;
}
export declare function dsPrimitivesHandler(args: DsPrimitivesArgs): Promise<DsPrimitivesResult>;
//# sourceMappingURL=index.d.ts.map