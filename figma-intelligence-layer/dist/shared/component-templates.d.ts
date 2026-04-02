export type NodeKind = "frame" | "text" | "rect" | "ellipse" | "vector";
export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";
export interface IconSlot {
    /** Default icon name from the catalog (e.g. "icon/action/search") */
    defaultIcon?: string;
    /** Whether the slot is required or optional */
    required: boolean;
    /** Default size preset */
    size?: IconSize;
    /** Color semantic token override */
    colorToken?: string;
    /** Whether icon is decorative (aria-hidden) */
    decorative?: boolean;
}
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
    iconSlot?: IconSlot;
    children?: BlueprintNode[];
}
export interface VariantProperty {
    name: string;
    values: string[];
    defaultValue: string;
}
export interface ComponentBlueprint {
    name: string;
    category: "core" | "forms" | "navigation" | "data" | "feedback" | "overlay" | "layout";
    description: string;
    root: BlueprintNode;
    variantProperties: VariantProperty[];
    tokenBindings: Array<{
        nodePath: string;
        property: "fills" | "strokes" | "cornerRadius" | "paddingLeft";
        semanticToken: string;
    }>;
    /** Icon slots exposed as swappable properties */
    iconSlots?: Array<{
        nodePath: string;
        propName: string;
        defaultIcon?: string;
        required: boolean;
    }>;
}
export declare const COMPONENT_BLUEPRINTS: ComponentBlueprint[];
/**
 * Get blueprints filtered by category.
 */
export declare function getBlueprintsByCategory(categories: Array<"core" | "forms" | "navigation" | "data" | "feedback" | "overlay" | "layout">): ComponentBlueprint[];
/**
 * Get a single blueprint by name.
 */
export declare function getBlueprint(name: string): ComponentBlueprint | undefined;
//# sourceMappingURL=component-templates.d.ts.map