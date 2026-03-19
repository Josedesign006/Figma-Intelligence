import { Token, TokenRef } from "./types.js";
export declare function snapToSpacingToken(px: number): TokenRef;
export declare function snapToRadiusToken(px: number): TokenRef;
export declare function snapToTypeToken(px: number): TokenRef;
export declare function hexToRgb(hex: string): {
    r: number;
    g: number;
    b: number;
} | null;
export declare function rgbToHex(r: number, g: number, b: number): string;
export declare function figmaRgbaToHex(r: number, g: number, b: number): string;
export declare function snapToColorToken(hex: string, tokens: Token[]): TokenRef;
export declare function computeContrastRatio(fgHex: string, bgHex: string): number;
export declare function meetsWCAG(ratio: number, level: "AA" | "AAA", isLargeText: boolean): boolean;
type CBProfile = "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia";
export declare function simulateColorBlindness(hex: string, profile: CBProfile): string;
export declare function generateDarkModeColor(lightHex: string): string;
export declare function generateHighContrastColor(hex: string, bgHex: string, target: "AA" | "AAA"): string;
export {};
//# sourceMappingURL=token-utils.d.ts.map