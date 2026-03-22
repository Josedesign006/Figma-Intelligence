import { FontConfig } from "../../../shared/font-config.js";
export type ThemeStrategy = "dark" | "high-contrast" | "brand-shift" | "custom";
export type WCAGLevel = "AA" | "AAA";
export interface ThemeGeneratorArgs {
    sourceMode: string;
    newModeName: string;
    strategy: ThemeStrategy;
    brandDirection?: string;
    wcagTarget: WCAGLevel;
    previewBeforeApply: boolean;
    fonts?: Partial<FontConfig>;
}
export interface ColorDelta {
    tokenName: string;
    tokenId: string;
    sourceModeValue: string;
    generatedValue: string;
    wcagPass: boolean;
    contrastRatio?: number;
}
export interface WCAGPair {
    foregroundToken: string;
    backgroundToken: string;
    contrastRatio: number;
    passes: boolean;
    level: WCAGLevel;
}
export interface ThemeGeneratorResult {
    newModeId: string | null;
    newModeName: string;
    strategy: ThemeStrategy;
    colorDeltas: ColorDelta[];
    wcagReport: WCAGPair[];
    previewFrameId: string | null;
    applied: boolean;
    logEntryId: string;
}
export declare function themeGeneratorHandler(args: ThemeGeneratorArgs): Promise<ThemeGeneratorResult>;
//# sourceMappingURL=index.d.ts.map