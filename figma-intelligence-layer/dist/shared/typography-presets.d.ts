import { FontConfig, FontRole } from "./font-config.js";
export interface TypographyPreset {
    name: string;
    fontRole: FontRole;
    size: number;
    weight: string;
    lineHeight: number;
    letterSpacing: number;
}
export declare const TYPOGRAPHY_PRESETS: TypographyPreset[];
/**
 * Look up a preset by name.
 */
export declare function getPreset(name: string): TypographyPreset | undefined;
/**
 * Generate Figma Plugin API script lines that apply a typography preset to a
 * text node variable.
 *
 * Example output:
 *   node.fontName = { family: "Inter", style: "Bold" };
 *   node.fontSize = 36;
 *   node.lineHeight = { value: 40, unit: "PIXELS" };
 *   node.letterSpacing = { value: -2, unit: "PERCENT" };
 */
export declare function applyTextPresetScript(nodeVar: string, presetName: string, fontConfig: FontConfig): string;
/**
 * Return the Figma fontName literal for a preset (for use in generated scripts).
 */
export declare function presetFontLiteral(presetName: string, fontConfig: FontConfig): string;
//# sourceMappingURL=typography-presets.d.ts.map