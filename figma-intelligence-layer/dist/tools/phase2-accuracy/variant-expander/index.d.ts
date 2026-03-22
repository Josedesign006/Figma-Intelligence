import { FontConfig } from "../../../shared/font-config.js";
export interface VariantDimensions {
    state?: string[];
    size?: string[];
    theme?: string[];
    type?: string[];
}
export interface VariantExpanderArgs {
    nodeId: string;
    dimensions: VariantDimensions;
    namingConvention: "figma" | "storybook";
    autoApplyTokens: boolean;
    arrangeInGrid?: boolean;
    fonts?: Partial<FontConfig>;
}
export interface VariantCombination {
    key: string;
    props: Record<string, string>;
    clonedNodeId?: string;
    tokenOverrides: TokenOverride[];
}
export interface TokenOverride {
    property: string;
    value: string | number;
    description: string;
}
export interface CoverageReport {
    totalCombinations: number;
    created: number;
    failed: number;
    componentSetId: string | null;
    combinations: VariantCombination[];
    logEntryId: string;
}
export declare function variantExpanderHandler(args: VariantExpanderArgs): Promise<CoverageReport>;
//# sourceMappingURL=index.d.ts.map