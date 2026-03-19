export interface ComponentArchaeologistArgs {
    nodeId: string;
    outputAs: "analysis" | "component" | "both";
    bindToExisting?: boolean;
    createLibraryComponent?: boolean;
    generateDocStub?: boolean;
}
export interface PatternMatch {
    pattern: string;
    candidates: string[];
    confidence: number;
    rationale: string;
}
export interface TokenMapping {
    property: string;
    hardcodedValue: string;
    suggestedToken: string;
    tokenValue: string | number;
    delta: number | undefined;
}
export interface ComponentArchaeologistResult {
    nodeId: string;
    nodeName: string;
    patternMatches: PatternMatch[];
    bestMatch: string;
    tokenMappings: TokenMapping[];
    promotedComponentId: string | null;
    docStub: string | null;
    layerSummary: LayerSummary;
    logEntryId: string;
}
interface LayerSummary {
    totalLayers: number;
    depth: number;
    hasImage: boolean;
    hasIcon: boolean;
    hasText: boolean;
    hasInput: boolean;
    hasAvatar: boolean;
    textCount: number;
    rectangleCount: number;
    frameCount: number;
    vectorCount: number;
    layoutMode: "HORIZONTAL" | "VERTICAL" | "NONE" | undefined;
    childCount: number;
}
export declare function componentArchaeologistHandler(args: ComponentArchaeologistArgs): Promise<ComponentArchaeologistResult>;
export {};
//# sourceMappingURL=index.d.ts.map