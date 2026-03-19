/**
 * Generate a dark-mode equivalent of a light-mode hex color.
 *
 * From the plan:
 *   Surface tokens:  Flip lightness (L: 98% → L: 8%), preserve hue
 *   Text tokens:     Invert hierarchy (primary L: 10% → L: 95%)
 *   Brand tokens:    +10 saturation to pop on dark backgrounds
 *   Semantic tokens: Maintain hue identity
 */
export declare function toDarkMode(hex: string, role?: "surface" | "text" | "brand" | "semantic"): string;
/**
 * Adjust a foreground color until it meets the given WCAG level
 * against the provided background.
 */
export declare function toHighContrast(fgHex: string, bgHex: string, target?: "AA" | "AAA"): string;
/**
 * Shift hue and saturation of a color to create a brand variant
 * (e.g. "warmer and more approachable").
 */
export declare function brandShift(hex: string, hueShift: number, satShift: number): string;
/**
 * Generate a full shade palette (50, 100–900, 950) from a base color.
 * Follows the Material/Tailwind convention: 500 = base, lighter above, darker below.
 */
export declare function generateShades(hex: string): Record<string, string>;
export interface SemanticHueRange {
    name: string;
    minHue: number;
    maxHue: number;
}
/**
 * From the plan — semantic tokens must keep their hue family:
 *   --color-danger   → red   (0–20°)
 *   --color-success  → green (100–160°)
 *   --color-warning  → amber (30–50°)
 *   --color-info     → blue  (200–240°)
 */
export declare const SEMANTIC_HUE_RANGES: SemanticHueRange[];
/** Clamp a color's hue to its semantic range. */
export declare function enforceSemanticHue(hex: string, semanticName: string): string;
//# sourceMappingURL=color-theory.d.ts.map