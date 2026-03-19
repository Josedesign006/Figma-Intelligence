export interface SyncFromCodeArgs {
    storybookUrl: string;
    figmaLibraryFileKey: string;
    components?: string[];
    syncDirection: "report" | "update-figma" | "update-code-stub";
}
export type MismatchKind = "missing-in-figma" | "missing-in-code" | "value-mismatch" | "match";
export interface PropMismatch {
    propName: string;
    kind: MismatchKind;
    storybookValues?: string[];
    figmaValues?: string[];
    message: string;
}
export interface ComponentComparison {
    componentName: string;
    storybookProps: number;
    figmaProps: number;
    matchCount: number;
    mismatches: PropMismatch[];
    codeStub?: string;
}
export interface SyncFromCodeResult {
    storybookUrl: string;
    figmaLibraryFileKey: string;
    totalComponents: number;
    fullyAligned: number;
    hasMismatches: number;
    comparisons: ComponentComparison[];
    figmaUpdates: string[];
    codeStubs: string[];
}
export declare function syncFromCodeHandler(args: SyncFromCodeArgs): Promise<SyncFromCodeResult>;
//# sourceMappingURL=index.d.ts.map