export interface DesignFromRefArgs {
    references: string[];
    prompt: string;
    extractOnly?: string[];
    designSystemContext?: string;
}
export interface DesignFromRefResult {
    frameId: string;
    extractedPatterns: DesignLanguage;
    appliedTokens: AppliedToken[];
    generatedFrame: {
        nodeId: string;
    };
    prompt: string;
}
interface ColorEntry {
    role: string;
    hex: string;
    frequency: string;
}
interface DesignLanguage {
    layout: {
        gridStructure: string;
        zoneProportions: string;
        hierarchy: string;
    };
    spacing: {
        density: "compact" | "comfortable" | "spacious";
        paddingPattern: string;
        dominantGap: number;
    };
    colorPalette: ColorEntry[];
    typography: {
        scalePattern: string;
        dominantWeights: number[];
        hierarchyLevels: number;
    };
}
interface AppliedToken {
    pattern: string;
    rawValue: string | number;
    mappedToken: string;
    tokenValue: string | number;
}
export declare function designFromRefHandler(args: DesignFromRefArgs): Promise<DesignFromRefResult>;
export {};
//# sourceMappingURL=index.d.ts.map