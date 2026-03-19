import { GeneratedDocument, NodeSnapshot } from "../spec-generator/index.js";
export interface FigmaApgDocArgs {
    nodeId?: string;
    patternHint?: string;
    framework?: "html" | "react" | "vue" | "angular";
    outputFormat: "json" | "report" | "figma-page" | "all";
    includeCodeExamples?: boolean;
    writeToDescription?: boolean;
    descriptionMode?: "replace" | "append";
    pageName?: string;
}
type ApgPatternId = "button" | "menu-button" | "dialog-modal" | "tabs" | "accordion" | "combobox" | "listbox" | "checkbox" | "radio-group" | "switch" | "slider" | "toolbar" | "grid" | "treeview";
interface ApgPatternDefinition {
    id: ApgPatternId;
    title: string;
    aliases: string[];
    url: string;
    summary: string;
    nativeFirst: string[];
    accessibleName: string[];
    roles: string[];
    requiredStates: string[];
    optionalStates: string[];
    forbiddenPatterns: string[];
    keyboard: string[];
    focus: string[];
    implementationNotes: string[];
    testing: string[];
    exampleSnippets: Partial<Record<NonNullable<FigmaApgDocArgs["framework"]>, string>>;
}
export interface FigmaApgDocResult {
    pattern: {
        id: ApgPatternId;
        title: string;
        url: string;
        confidence: number;
        matchedBy: string[];
    };
    target: {
        nodeId: string;
        name: string;
        type: string;
    };
    report?: string;
    figmaPageId?: string;
    descriptionUpdated?: boolean;
    warnings?: string[];
    document: GeneratedDocument;
    implementationSnippet?: string;
    logEntryId: string;
}
export declare function guessPattern(snapshot: NodeSnapshot, hint?: string): {
    definition: ApgPatternDefinition;
    confidence: number;
    matchedBy: string[];
};
export declare function shouldFallbackToGeneratedPage(error: unknown): boolean;
export declare function figmaApgDocHandler(args: FigmaApgDocArgs): Promise<FigmaApgDocResult>;
export {};
//# sourceMappingURL=index.d.ts.map