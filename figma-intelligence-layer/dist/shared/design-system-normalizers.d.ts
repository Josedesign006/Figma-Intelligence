import { ComponentSet, FigmaNode, Token } from "./types.js";
export interface DSVariantSchema {
    properties: Record<string, string[]>;
    required?: string[];
}
export interface NamingRuleInput {
    kind: "component" | "token" | "style";
    name: string;
}
export interface NamingRule {
    kind: "component" | "token" | "style";
    pattern: string;
    examples: string[];
}
export declare function normalizeName(name: string): string;
export declare function parseVariantPropsFromName(name: string): Record<string, string>;
export declare function inferVariantSchema(componentSet: ComponentSet): DSVariantSchema | undefined;
export declare function inferComponentIntents(name: string, description?: string): string[];
export declare function inferTokenSemanticGroup(token: Token): string | undefined;
export declare function inferStyleSemanticGroup(name: string, styleType: string): string | undefined;
export declare function inferNamingRules(inputs: NamingRuleInput[]): NamingRule[];
export declare function componentNameVariants(name: string): string[];
export declare function firstComponentChildId(node: FigmaNode[] | undefined): string | undefined;
//# sourceMappingURL=design-system-normalizers.d.ts.map