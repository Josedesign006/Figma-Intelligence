"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Font Configuration System
// Provides configurable font families for heading, body, mono, and UI roles.
// All Figma script generators use this instead of hardcoded "Inter" references.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FONT_CONFIG = void 0;
exports.resolveFontConfig = resolveFontConfig;
exports.generateFontLoadScript = generateFontLoadScript;
exports.fontNameLiteral = fontNameLiteral;
exports.weightToStyle = weightToStyle;
exports.DEFAULT_FONT_CONFIG = {
    heading: { family: "Inter", styles: ["Bold", "SemiBold", "Medium"] },
    body: { family: "Inter", styles: ["Regular", "Medium", "Bold"] },
    mono: { family: "JetBrains Mono", styles: ["Regular", "Medium"] },
    ui: { family: "Inter", styles: ["Regular", "Medium", "SemiBold"] },
};
/**
 * Merge a partial font config with the defaults.
 */
function resolveFontConfig(partial) {
    if (!partial)
        return { ...exports.DEFAULT_FONT_CONFIG };
    return {
        heading: partial.heading ?? exports.DEFAULT_FONT_CONFIG.heading,
        body: partial.body ?? exports.DEFAULT_FONT_CONFIG.body,
        mono: partial.mono ?? exports.DEFAULT_FONT_CONFIG.mono,
        ui: partial.ui ?? exports.DEFAULT_FONT_CONFIG.ui,
    };
}
/**
 * Generate all `figma.loadFontAsync()` calls needed for the given config.
 * Includes try/catch fallback to Inter if a custom font is unavailable.
 */
function generateFontLoadScript(config) {
    const loads = [];
    const seen = new Set();
    for (const role of ["heading", "body", "mono", "ui"]) {
        const { family, styles } = config[role];
        for (const style of styles) {
            const key = `${family}::${style}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            if (family === "Inter") {
                // Inter is always available in Figma
                loads.push(`  await figma.loadFontAsync({ family: "Inter", style: ${JSON.stringify(style)} });`);
            }
            else {
                loads.push(`  try {`, `    await figma.loadFontAsync({ family: ${JSON.stringify(family)}, style: ${JSON.stringify(style)} });`, `  } catch (_) {`, `    await figma.loadFontAsync({ family: "Inter", style: ${JSON.stringify(style)} });`, `  }`);
            }
        }
    }
    return loads.join("\n");
}
/**
 * Return a Figma fontName object literal string for use in generated scripts.
 * E.g. `{ family: "Inter", style: "Bold" }`
 */
function fontNameLiteral(role, style, config) {
    const family = config[role].family;
    return `{ family: ${JSON.stringify(family)}, style: ${JSON.stringify(style)} }`;
}
/**
 * Map a weight name to a Figma font style string.
 */
function weightToStyle(weight) {
    const map = {
        regular: "Regular",
        medium: "Medium",
        semibold: "SemiBold",
        bold: "Bold",
        light: "Light",
    };
    return map[weight.toLowerCase()] ?? "Regular";
}
//# sourceMappingURL=font-config.js.map