import { FigmaNode, Token, ComponentSet } from "./types.js";
export interface ResolvedStyle {
    fills: Array<{
        type: string;
        hex?: string;
        semanticName?: string;
        opacity?: number;
        variableId?: string;
    }>;
    strokes: Array<{
        type: string;
        hex?: string;
        weight?: number;
    }>;
    typography?: {
        family: string;
        weight: number;
        size: number;
        lineHeight: number;
        letterSpacing: number;
        category: "heading" | "subheading" | "body" | "caption" | "overline" | "display";
    };
    spacing?: {
        padding: {
            top: number;
            right: number;
            bottom: number;
            left: number;
        };
        gap: number;
        snappedToGrid: boolean;
        gridBase: number;
    };
    radius?: {
        values: number[];
        category: "none" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "full";
        uniform: boolean;
    };
    effects: Array<{
        type: string;
        category: "elevation-sm" | "elevation-md" | "elevation-lg" | "blur" | "inner-shadow" | "none";
    }>;
}
/**
 * Convert 0-1 float RGBA to a hex string.
 * Returns "#RRGGBB" when fully opaque, "#RRGGBBAA" otherwise.
 */
export declare function rgbaToHex(r: number, g: number, b: number, a?: number): string;
export declare function resolveStyles(node: FigmaNode, tokens?: Token[]): ResolvedStyle;
export interface ComponentRelationship {
    componentId: string;
    componentName: string;
    parentSetId?: string;
    parentSetName?: string;
    variantSiblings: Array<{
        id: string;
        name: string;
        variantProps: Record<string, string>;
    }>;
    instanceCount: number;
    dependsOn: string[];
    usedBy: string[];
}
export interface NodeRelationship {
    id: string;
    name: string;
    type: string;
    depth: number;
    parentId?: string;
    parentName?: string;
    siblingIndex: number;
    siblingCount: number;
    childCount: number;
    isAutoLayout: boolean;
    isComponent: boolean;
    isInstance: boolean;
}
export declare function mapRelationships(nodes: FigmaNode[]): NodeRelationship[];
export declare function mapComponentRelationships(componentSets: ComponentSet[], allInstances?: Array<{
    id: string;
    mainComponentId: string;
}>): ComponentRelationship[];
export interface EnrichedDesignSystem {
    summary: {
        totalTokens: number;
        totalComponents: number;
        totalStyles: number;
        colorTokenCount: number;
        spacingTokenCount: number;
        typographyCount: number;
        componentSetCount: number;
    };
    tokens: {
        colors: Array<{
            name: string;
            hex: string;
            opacity?: number;
            semanticGroup?: string;
            collectionName?: string;
        }>;
        spacing: Array<{
            name: string;
            value: number;
            snappedTo4px: boolean;
        }>;
        radii: Array<{
            name: string;
            value: number;
            category: string;
        }>;
        typography: Array<{
            name: string;
            value: string;
        }>;
        other: Array<{
            name: string;
            type: string;
            value: unknown;
        }>;
    };
    components: Array<{
        id: string;
        name: string;
        description?: string;
        variantProperties: string[];
        variantCount: number;
        category: string;
    }>;
    relationships: ComponentRelationship[];
}
/**
 * Infer a semantic group from a slash-separated token name.
 */
export declare function inferSemanticGroup(tokenName: string): string;
export declare function enrichDesignSystem(tokens: Token[], componentSets: ComponentSet[], instances?: Array<{
    id: string;
    mainComponentId: string;
}>): EnrichedDesignSystem;
//# sourceMappingURL=enrichment-pipeline.d.ts.map