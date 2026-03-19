export interface HSL {
    h: number;
    s: number;
    l: number;
}
export interface RGB {
    r: number;
    g: number;
    b: number;
}
export declare function hexToRgb(hex: string): RGB | null;
export declare function rgbToHex(r: number, g: number, b: number): string;
/** Convert Figma's 0-1 RGBA components to a hex string. */
export declare function figmaRgbaToHex(r: number, g: number, b: number): string;
export declare function rgbToHsl(r: number, g: number, b: number): HSL;
export declare function hslToRgb(h: number, s: number, l: number): RGB;
/** WCAG relative luminance (0–1). */
export declare function relativeLuminance(r: number, g: number, b: number): number;
/** WCAG contrast ratio between two hex colors. */
export declare function contrastRatio(hex1: string, hex2: string): number;
/** Euclidean distance in RGB space (0–441.67). */
export declare function colorDistance(hex1: string, hex2: string): number;
/** Hue + lightness distance for semantic color matching. */
export declare function semanticColorDistance(hex1: string, hex2: string): number;
//# sourceMappingURL=color-utils.d.ts.map