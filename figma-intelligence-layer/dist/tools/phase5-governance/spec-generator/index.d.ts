export interface GenerateSpecArgs {
    nodeId?: string;
    outputFormat: "json" | "report" | "figma-page" | "all";
    documentType?: "spec" | "anatomy-usage" | "accessibility" | "accessibility-annotation" | "full-documentation";
    includeTokens?: boolean;
    includeAnnotations?: boolean;
    pageName?: string;
    writeToDescription?: boolean;
}
export interface NodeSnapshot {
    id: string;
    name: string;
    type: string;
    description: string;
    width: number;
    height: number;
    layoutMode: string;
    itemSpacing: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    childCount: number;
    childNames: string[];
    textLayers: Array<{
        name: string;
        characters: string;
        fontFamily: string;
        fontStyle: string;
        fontSize: number;
        lineHeightPx: number | null;
    }>;
    fills: Array<{
        type: string;
        label: string;
    }>;
    strokes: Array<{
        type: string;
        label: string;
    }>;
    effects: Array<{
        type: string;
        radius?: number;
        visible?: boolean;
    }>;
    tokenAliases: string[];
    componentProperties: Array<{
        name: string;
        type: string;
        value: string;
        options: string[];
    }>;
    variantProperties: Record<string, string>;
    variantGroupProperties: Record<string, string[]>;
    variants: Array<{
        id: string;
        name: string;
        description: string;
        properties: Record<string, string>;
    }>;
    scanNodes?: SnapshotNode[];
}
export interface SnapshotNode {
    id: string;
    parentId: string | null;
    parentName: string | null;
    name: string;
    type: string;
    depth: number;
    visible: boolean;
    childCount: number;
    layoutMode: string;
    text: string;
    componentPropertyNames: string[];
    variantPropertyKeys: string[];
    variantPropertyValues: string[];
}
export interface DesignSpec {
    target: {
        nodeId: string;
        name: string;
        type: string;
        description: string;
    };
    overview: {
        summary: string;
        size: string;
        layout: string;
        childCount: number;
    };
    anatomy: string[];
    variants: Array<{
        property: string;
        values: string[];
        defaultValue?: string;
    }>;
    states: string[];
    contentGuidance: string[];
    styling: {
        fills: string[];
        strokes: string[];
        effects: string[];
        tokenReferences: string[];
    };
    accessibility: {
        touchTarget?: string;
        typography: string[];
        considerations: string[];
    };
    implementationNotes: string[];
    documentationGaps: string[];
}
export interface GenerateSpecResult {
    spec: DesignSpec;
    report?: string;
    figmaPageId?: string;
    documents?: GeneratedDocument[];
    logEntryId: string;
}
type DocumentationSectionStyle = "bullets" | "paragraph" | "checklist";
export interface GeneratedDocumentSection {
    title: string;
    style: DocumentationSectionStyle;
    items: string[];
}
export interface GeneratedDocument {
    type: "anatomy-usage" | "accessibility" | "accessibility-annotation";
    title: string;
    summary: string;
    sections: GeneratedDocumentSection[];
}
export declare function formatSpecDescription(spec: DesignSpec): string;
export declare function buildAccessibilityAnnotationDocument(snapshot: NodeSnapshot, spec: DesignSpec): GeneratedDocument;
export declare function formatDocumentReport(document: GeneratedDocument): string;
export declare function resolveTargetNodeId(args: GenerateSpecArgs): Promise<string>;
export declare function captureSnapshot(nodeId: string): Promise<NodeSnapshot>;
export declare function createDocumentationPages(documents: GeneratedDocument[], pageName?: string): Promise<string>;
export declare function generateSpecHandler(args: GenerateSpecArgs): Promise<GenerateSpecResult>;
export {};
//# sourceMappingURL=index.d.ts.map