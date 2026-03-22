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
export type DarkModeRole = "surface" | "text" | "brand" | "border" | "feedback";
/**
 * Role-aware dark mode color transformation.
 *
 * Instead of naively inverting lightness (which produces bright surfaces and
 * dark text), this function clamps lightness into ranges appropriate for each
 * semantic role:
 *
 *   surface  → L 0.06–0.15  (truly dark backgrounds)
 *   text     → L 0.85–0.98  (high-contrast readable text)
 *   brand    → L 0.45–0.55, saturation ×1.1 (vibrant accent)
 *   border   → L 0.25–0.35  (subtle dividers on dark bg)
 *   feedback → L 0.45–0.55, saturation ×1.1 (status colors)
 *
 * When `role` is omitted the legacy inversion behavior is used as fallback.
 */
export declare function generateDarkModeColor(lightHex: string, role?: DarkModeRole): string;
export declare function generateHighContrastColor(hex: string, bgHex: string, target: "AA" | "AAA"): string;
export {};
//# sourceMappingURL=token-utils.d.ts.map