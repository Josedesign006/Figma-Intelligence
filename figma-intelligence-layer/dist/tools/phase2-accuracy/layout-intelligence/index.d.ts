export interface LayoutIntelligenceArgs {
    nodeId: string;
    applyChanges: boolean;
    spacingTokenSet?: string;
    responsiveHints?: boolean;
    reportDiff?: boolean;
}
export type ContainerKind = "navigation bar" | "card" | "form" | "button" | "grid" | "list item" | "modal" | "section";
export interface AutoLayoutSpec {
    direction: "HORIZONTAL" | "VERTICAL" | "WRAP";
    primaryAxisSizingMode: "FIXED" | "AUTO";
    counterAxisSizingMode: "FIXED" | "AUTO";
    paddingToken: string;
    gapToken: string;
    paddingValue: number;
    gapValue: number;
}
export interface PropertyDiff {
    property: string;
    before: string | number | undefined;
    after: string | number;
    tokenName?: string;
}
export interface LayoutIntelligenceResult {
    nodeId: string;
    nodeName: string;
    detectedKind: ContainerKind | "unknown";
    spec: AutoLayoutSpec;
    diff: PropertyDiff[];
    applied: boolean;
    responsiveHints?: string[];
    logEntryId: string;
}
export declare function layoutIntelligenceHandler(args: LayoutIntelligenceArgs): Promise<LayoutIntelligenceResult>;
//# sourceMappingURL=index.d.ts.map