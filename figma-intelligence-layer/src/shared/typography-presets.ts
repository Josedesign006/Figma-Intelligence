// ─────────────────────────────────────────────────────────────────────────────
// Typography Presets
// Composite presets bundling size + weight + lineHeight + letterSpacing + font
// role.  Used by component-script-builder and page-architect instead of
// scattered inline font assignments.
// ─────────────────────────────────────────────────────────────────────────────

import { FontConfig, FontRole, fontNameLiteral, weightToStyle } from "./font-config.js";

export interface TypographyPreset {
  name: string;
  fontRole: FontRole;
  size: number;
  weight: string;       // "regular" | "medium" | "semibold" | "bold"
  lineHeight: number;
  letterSpacing: number; // em-based (e.g. -0.02)
}

export const TYPOGRAPHY_PRESETS: TypographyPreset[] = [
  // Headings
  { name: "heading/h1", fontRole: "heading", size: 36, weight: "bold",     lineHeight: 40, letterSpacing: -0.02 },
  { name: "heading/h2", fontRole: "heading", size: 30, weight: "bold",     lineHeight: 36, letterSpacing: -0.02 },
  { name: "heading/h3", fontRole: "heading", size: 24, weight: "semibold", lineHeight: 32, letterSpacing: -0.01 },
  { name: "heading/h4", fontRole: "heading", size: 20, weight: "semibold", lineHeight: 28, letterSpacing: -0.01 },
  { name: "heading/h5", fontRole: "heading", size: 18, weight: "medium",   lineHeight: 28, letterSpacing: 0 },

  // Body
  { name: "body/lg", fontRole: "body", size: 18, weight: "regular", lineHeight: 28, letterSpacing: 0 },
  { name: "body/md", fontRole: "body", size: 16, weight: "regular", lineHeight: 24, letterSpacing: 0 },
  { name: "body/sm", fontRole: "body", size: 14, weight: "regular", lineHeight: 20, letterSpacing: 0 },
  { name: "body/xs", fontRole: "body", size: 12, weight: "regular", lineHeight: 16, letterSpacing: 0 },

  // Labels (UI)
  { name: "label/lg", fontRole: "ui", size: 16, weight: "medium", lineHeight: 24, letterSpacing: 0 },
  { name: "label/md", fontRole: "ui", size: 14, weight: "medium", lineHeight: 20, letterSpacing: 0 },
  { name: "label/sm", fontRole: "ui", size: 12, weight: "medium", lineHeight: 16, letterSpacing: 0.01 },

  // Code
  { name: "code/md", fontRole: "mono", size: 14, weight: "regular", lineHeight: 20, letterSpacing: 0 },
];

/**
 * Look up a preset by name.
 */
export function getPreset(name: string): TypographyPreset | undefined {
  return TYPOGRAPHY_PRESETS.find((p) => p.name === name);
}

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
export function applyTextPresetScript(
  nodeVar: string,
  presetName: string,
  fontConfig: FontConfig
): string {
  const preset = getPreset(presetName);
  if (!preset) {
    // Fallback: body/md
    return `${nodeVar}.fontSize = 16;`;
  }

  const style = weightToStyle(preset.weight);
  const fontLiteral = fontNameLiteral(preset.fontRole, style, fontConfig);
  const letterSpacingPercent = Math.round(preset.letterSpacing * 100);

  const lines = [
    `${nodeVar}.fontName = ${fontLiteral};`,
    `${nodeVar}.fontSize = ${preset.size};`,
    `${nodeVar}.lineHeight = { value: ${preset.lineHeight}, unit: "PIXELS" };`,
  ];

  if (letterSpacingPercent !== 0) {
    lines.push(`${nodeVar}.letterSpacing = { value: ${letterSpacingPercent}, unit: "PERCENT" };`);
  }

  return lines.join("\n    ");
}

/**
 * Return the Figma fontName literal for a preset (for use in generated scripts).
 */
export function presetFontLiteral(presetName: string, fontConfig: FontConfig): string {
  const preset = getPreset(presetName);
  if (!preset) return fontNameLiteral("body", "Regular", fontConfig);
  return fontNameLiteral(preset.fontRole, weightToStyle(preset.weight), fontConfig);
}
