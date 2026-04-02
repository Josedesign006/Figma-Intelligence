/**
 * Color operations for design token manipulation.
 * Supports: lighten, darken, mix, alpha, hue shift, saturate, desaturate
 * All operations work on hex color strings (#RRGGBB or #RRGGBBAA)
 *
 * Provides operations that Tokens Studio Pro offers but the plugin currently lacks.
 * Pure TypeScript — no external dependencies.
 */
export interface RGB {
    r: number;
    g: number;
    b: number;
    a: number;
}
export interface HSL {
    h: number;
    s: number;
    l: number;
    a: number;
}
export interface Oklch {
    L: number;
    C: number;
    h: number;
    a: number;
}
export declare function hexToRgb(hex: string): RGB;
export declare function rgbToHex(rgb: RGB): string;
export declare function rgbToHsl(rgb: RGB): HSL;
export declare function hslToRgb(hsl: HSL): RGB;
export declare function rgbToOklch(rgb: RGB): Oklch;
export declare function oklchToRgb(oklch: Oklch): RGB;
export declare function formatCssColor(hex: string, space?: "srgb" | "display-p3" | "oklch"): string;
export declare function lighten(hex: string, amount: number): string;
export declare function darken(hex: string, amount: number): string;
export declare function mix(hex1: string, hex2: string, weight?: number): string;
export declare function setAlpha(hex: string, alpha: number): string;
export declare function adjustHue(hex: string, degrees: number): string;
export declare function saturate(hex: string, amount: number): string;
export declare function desaturate(hex: string, amount: number): string;
export declare function complement(hex: string): string;
export declare function invert(hex: string): string;
export declare function luminance(hex: string): number;
export declare function contrastRatio(hex1: string, hex2: string): number;
export declare function meetsWcagAA(hex1: string, hex2: string, isLargeText?: boolean): boolean;
export declare function meetsWcagAAA(hex1: string, hex2: string, isLargeText?: boolean): boolean;
/**
 * Attempt to adjust the foreground color to meet the target contrast ratio
 * against the given background. Lightens or darkens the fg in HSL space.
 * Returns the adjusted hex color, or the best achievable if the target is
 * impossible.
 */
export declare function suggestAccessibleColor(bg: string, fg: string, targetRatio?: number): string;
export declare function generateTints(hex: string, steps?: number): string[];
export declare function generateShades(hex: string, steps?: number): string[];
/**
 * Generate a Tailwind-style tint/shade scale where 500 is the base color.
 * Returns keys: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
 */
export declare function generateTintShadeScale(hex: string, steps?: number): Record<string, string>;
//# sourceMappingURL=color-operations.d.ts.map