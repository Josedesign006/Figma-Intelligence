export interface DsScaffolderArgs {
    brandColors: {
        primary: string;
        secondary?: string;
        neutral?: string;
        accent?: string;
    };
    productType: "web-app" | "mobile-app" | "both" | "marketing";
    brandName: string;
    includeComponents: Array<"core" | "forms" | "navigation" | "data" | "feedback" | "overlay">;
    generateDarkMode: boolean;
    dtcgExport: boolean;
}
export interface ColorShade {
    step: number;
    hex: string;
    lightHex?: string;
    darkHex?: string;
}
export interface ColorPalette {
    name: string;
    base: string;
    shades: ColorShade[];
}
export interface TokenDefinition {
    name: string;
    value: string | number;
    type: "COLOR" | "FLOAT" | "STRING";
    description?: string;
    darkValue?: string | number;
}
export interface DsScaffolderResult {
    pageIds: {
        foundations?: string;
        components?: string;
        templates?: string;
    };
    tokenCounts: {
        colors: number;
        typography: number;
        spacing: number;
        semantic: number;
        total: number;
    };
    palettes: ColorPalette[];
    dtcgTokens?: Record<string, unknown>;
}
export declare function dsScaffolderHandler(args: DsScaffolderArgs): Promise<DsScaffolderResult>;
//# sourceMappingURL=index.d.ts.map