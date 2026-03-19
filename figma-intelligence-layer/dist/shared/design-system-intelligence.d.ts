import { NamingRule } from "./design-system-normalizers";
export interface DSComponentSetLike {
    id: string;
    name: string;
    normalizedName: string;
    childComponentIds: string[];
    intents: string[];
}
export interface DSComponentLike {
    id: string;
    name: string;
    normalizedName: string;
    setId?: string;
    intents: string[];
}
export interface DSTokenLike {
    id: string;
    name: string;
    semanticGroup?: string;
}
export interface DSStyleLike {
    id: string;
    name: string;
}
export interface DSInstanceLike {
    id: string;
    mainComponentId: string;
}
export interface DSVariantSchemaLike {
    properties: Record<string, string[]>;
    required?: string[];
}
export interface DesignSystemIntelligence {
    aliases: Record<string, string[]>;
    variantSchemas: Record<string, DSVariantSchemaLike>;
    semanticTokenGroups: Record<string, string[]>;
    preferredComponentsByIntent: Record<string, string[]>;
    namingRules: NamingRule[];
}
export declare function buildDesignSystemIntelligence(args: {
    componentSets: DSComponentSetLike[];
    components: DSComponentLike[];
    tokens: DSTokenLike[];
    styles: DSStyleLike[];
    instances: DSInstanceLike[];
    variantSchemas: Record<string, DSVariantSchemaLike>;
}): DesignSystemIntelligence;
//# sourceMappingURL=design-system-intelligence.d.ts.map