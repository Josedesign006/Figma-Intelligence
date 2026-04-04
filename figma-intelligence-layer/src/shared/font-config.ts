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
 * When dsId is provided, the design system's font family is used as the
 * default for heading, body, and ui roles (user overrides still win).
 */
export function resolveFontConfig(partial?: Partial<FontConfig>, dsId?: string | null): FontConfig {
  let base = { ...DEFAULT_FONT_CONFIG };

  // When a DS is selected, use its font family as default for all text roles
  if (dsId) {
    const dsFont = _getDSFont(dsId);
    if (dsFont) {
      base = {
        heading: { family: dsFont, styles: DEFAULT_FONT_CONFIG.heading.styles },
        body:    { family: dsFont, styles: DEFAULT_FONT_CONFIG.body.styles },
        mono:    DEFAULT_FONT_CONFIG.mono, // Mono stays as-is
        ui:      { family: dsFont, styles: DEFAULT_FONT_CONFIG.ui.styles },
      };
    }
  }

  if (!partial) return base;
  return {
    heading: partial.heading ?? base.heading,
    body:    partial.body    ?? base.body,
    mono:    partial.mono    ?? base.mono,
    ui:      partial.ui      ?? base.ui,
  };
}

// Lazy-loaded reference to avoid circular import at module load time
let _getDesignSystemFontFamily: ((dsId: string) => string | null) | null = null;
function _getDSFont(dsId: string): string | null {
  if (!_getDesignSystemFontFamily) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      _getDesignSystemFontFamily = require("./design-system-tokens.js").getDesignSystemFontFamily;
    } catch {
      return null;
    }
  }
  return _getDesignSystemFontFamily!(dsId);
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
