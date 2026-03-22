export type NodeKind = "frame" | "text" | "rect" | "ellipse" | "vector";
export interface BlueprintNode {
    name: string;
    kind: NodeKind;
    width?: number;
    height?: number;
    layoutMode?: "HORIZONTAL" | "VERTICAL" | "NONE";
    paddingX?: number;
    paddingY?: number;
    itemSpacing?: number;
    primaryAxisAlign?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
    counterAxisAlign?: "MIN" | "CENTER" | "MAX";
    primaryAxisSizing?: "AUTO" | "FIXED";
    counterAxisSizing?: "AUTO" | "FIXED";
    cornerRadius?: number;
    fillSemantic?: string;
    strokeSemantic?: string;
    strokeWeight?: number;
    opacity?: number;
    effects?: Array<{
        type: "DROP_SHADOW";
        color: {
            r: number;
            g: number;
            b: number;
            a: number;
        };
        offset: {
            x: number;
            y: number;
        };
        radius: number;
        spread: number;
    }>;
    textContent?: string;
    textPreset?: string;
    textFillSemantic?: string;
    children?: BlueprintNode[];
}
export interface VariantProperty {
    name: string;
    values: string[];
    defaultValue: string;
}
export interface ComponentBlueprint {
    name: string;
    category: "core" | "forms" | "navigation" | "data" | "feedback" | "overlay";
    description: string;
    root: BlueprintNode;
    variantProperties: VariantProperty[];
    tokenBindings: Array<{
        nodePath: string;
        property: "fills" | "strokes" | "cornerRadius" | "paddingLeft";
        semanticToken: string;
    }>;
}
export declare const COMPONENT_BLUEPRINTS: ComponentBlueprint[];
/**
 * Get blueprints filtered by category.
 */
export declare function getBlueprintsByCategory(categories: Array<"core" | "forms" | "navigation" | "data" | "feedback" | "overlay">): ComponentBlueprint[];
/**
 * Get a single blueprint by name.
 */
export declare function getBlueprint(name: string): ComponentBlueprint | undefined;
//# sourceMappingURL=component-templates.d.ts.map