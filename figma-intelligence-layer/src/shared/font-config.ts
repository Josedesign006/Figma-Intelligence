// ─────────────────────────────────────────────────────────────────────────────
// Font Configuration System
// Provides configurable font families for heading, body, mono, and UI roles.
// All Figma script generators use this instead of hardcoded "Inter" references.
// ─────────────────────────────────────────────────────────────────────────────

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

export const DEFAULT_FONT_CONFIG: FontConfig = {
  heading: { family: "Inter", styles: ["Bold", "SemiBold", "Medium"] },
  body:    { family: "Inter", styles: ["Regular", "Medium", "Bold"] },
  mono:    { family: "JetBrains Mono", styles: ["Regular", "Medium"] },
  ui:      { family: "Inter", styles: ["Regular", "Medium", "SemiBold"] },
};

/**
 * Merge a partial font config with the defaults.
 */
export function resolveFontConfig(partial?: Partial<FontConfig>): FontConfig {
  if (!partial) return { ...DEFAULT_FONT_CONFIG };
  return {
    heading: partial.heading ?? DEFAULT_FONT_CONFIG.heading,
    body:    partial.body    ?? DEFAULT_FONT_CONFIG.body,
    mono:    partial.mono    ?? DEFAULT_FONT_CONFIG.mono,
    ui:      partial.ui      ?? DEFAULT_FONT_CONFIG.ui,
  };
}

/**
 * Generate all `figma.loadFontAsync()` calls needed for the given config.
 * Includes try/catch fallback to Inter if a custom font is unavailable.
 */
export function generateFontLoadScript(config: FontConfig): string {
  const loads: string[] = [];
  const seen = new Set<string>();

  for (const role of ["heading", "body", "mono", "ui"] as FontRole[]) {
    const { family, styles } = config[role];
    for (const style of styles) {
      const key = `${family}::${style}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (family === "Inter") {
        // Inter is always available in Figma
        loads.push(`  await figma.loadFontAsync({ family: "Inter", style: ${JSON.stringify(style)} });`);
      } else {
        loads.push(
          `  try {`,
          `    await figma.loadFontAsync({ family: ${JSON.stringify(family)}, style: ${JSON.stringify(style)} });`,
          `  } catch (_) {`,
          `    await figma.loadFontAsync({ family: "Inter", style: ${JSON.stringify(style)} });`,
          `  }`
        );
      }
    }
  }

  return loads.join("\n");
}

/**
 * Return a Figma fontName object literal string for use in generated scripts.
 * E.g. `{ family: "Inter", style: "Bold" }`
 */
export function fontNameLiteral(role: FontRole, style: string, config: FontConfig): string {
  const family = config[role].family;
  return `{ family: ${JSON.stringify(family)}, style: ${JSON.stringify(style)} }`;
}

/**
 * Map a weight name to a Figma font style string.
 */
export function weightToStyle(weight: string): string {
  const map: Record<string, string> = {
    regular: "Regular",
    medium: "Medium",
    semibold: "SemiBold",
    bold: "Bold",
    light: "Light",
  };
  return map[weight.toLowerCase()] ?? "Regular";
}
