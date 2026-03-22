export interface FontFamilyConfig {
    family: string;
    styles: string[];
}
export interface FontConfig {
    heading: FontFamilyConfig;
    body: FontFamilyConfig;
    mono: FontFamilyConfig;
    ui: FontFamilyConfig;
}
export type FontRole = keyof FontConfig;
export declare const DEFAULT_FONT_CONFIG: FontConfig;
/**
 * Merge a partial font config with the defaults.
 */
export declare function resolveFontConfig(partial?: Partial<FontConfig>): FontConfig;
/**
 * Generate all `figma.loadFontAsync()` calls needed for the given config.
 * Includes try/catch fallback to Inter if a custom font is unavailable.
 */
export declare function generateFontLoadScript(config: FontConfig): string;
/**
 * Return a Figma fontName object literal string for use in generated scripts.
 * E.g. `{ family: "Inter", style: "Bold" }`
 */
export declare function fontNameLiteral(role: FontRole, style: string, config: FontConfig): string;
/**
 * Map a weight name to a Figma font style string.
 */
export declare function weightToStyle(weight: string): string;
//# sourceMappingURL=font-config.d.ts.map