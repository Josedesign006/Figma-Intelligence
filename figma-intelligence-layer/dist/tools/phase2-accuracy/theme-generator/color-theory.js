"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Color Theory
// Colour generation algorithms for the theme-generator tool:
//   • Dark mode generation (flip lightness, preserve hue)
//   • High-contrast mode (boost to meet WCAG AAA)
//   • Brand-shift (semantic hue rotation)
//   • Palette shade generation (50–950)
//   • Perceptual invariant enforcement
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEMANTIC_HUE_RANGES = void 0;
exports.toDarkMode = toDarkMode;
exports.toHighContrast = toHighContrast;
exports.brandShift = brandShift;
exports.generateShades = generateShades;
exports.enforceSemanticHue = enforceSemanticHue;
const color_utils_js_1 = require("../../../shared/color-utils.js");
// ─── Dark Mode ────────────────────────────────────────────────────────────────
/**
 * Generate a dark-mode equivalent of a light-mode hex color.
 *
 * From the plan:
 *   Surface tokens:  Flip lightness (L: 98% → L: 8%), preserve hue
 *   Text tokens:     Invert hierarchy (primary L: 10% → L: 95%)
 *   Brand tokens:    +10 saturation to pop on dark backgrounds
 *   Semantic tokens: Maintain hue identity
 */
function toDarkMode(hex, role = "semantic") {
    const rgb = (0, color_utils_js_1.hexToRgb)(hex);
    if (!rgb)
        return hex;
    const hsl = (0, color_utils_js_1.rgbToHsl)(rgb.r, rgb.g, rgb.b);
    switch (role) {
        case "surface":
            hsl.l = Math.max(0.04, Math.min(0.15, 1 - hsl.l));
            break;
        case "text":
            hsl.l = Math.max(0.85, Math.min(0.98, 1 - hsl.l));
            break;
        case "brand":
            hsl.s = Math.min(1, hsl.s + 0.1);
            hsl.l = Math.max(0.4, Math.min(0.7, hsl.l));
            break;
        case "semantic":
        default:
            hsl.l = 1 - hsl.l;
            break;
    }
    const { r, g, b } = (0, color_utils_js_1.hslToRgb)(hsl.h, hsl.s, hsl.l);
    return (0, color_utils_js_1.rgbToHex)(r, g, b);
}
// ─── High Contrast ────────────────────────────────────────────────────────────
/**
 * Adjust a foreground color until it meets the given WCAG level
 * against the provided background.
 */
function toHighContrast(fgHex, bgHex, target = "AAA") {
    const minRatio = target === "AAA" ? 7.0 : 4.5;
    const ratio = (0, color_utils_js_1.contrastRatio)(fgHex, bgHex);
    if (ratio >= minRatio)
        return fgHex;
    const rgb = (0, color_utils_js_1.hexToRgb)(fgHex);
    if (!rgb)
        return fgHex;
    const hsl = (0, color_utils_js_1.rgbToHsl)(rgb.r, rgb.g, rgb.b);
    // Darken or lighten the foreground depending on whether bg is light or dark
    const bgRgb = (0, color_utils_js_1.hexToRgb)(bgHex);
    const bgLightness = bgRgb ? (0, color_utils_js_1.rgbToHsl)(bgRgb.r, bgRgb.g, bgRgb.b).l : 0.5;
    const direction = bgLightness > 0.5 ? -0.02 : 0.02;
    for (let i = 0; i < 50; i++) {
        hsl.l = Math.max(0, Math.min(1, hsl.l + direction));
        const { r, g, b } = (0, color_utils_js_1.hslToRgb)(hsl.h, hsl.s, hsl.l);
        const candidate = (0, color_utils_js_1.rgbToHex)(r, g, b);
        if ((0, color_utils_js_1.contrastRatio)(candidate, bgHex) >= minRatio)
            return candidate;
    }
    // Failsafe: return pure black or white
    return bgLightness > 0.5 ? "#000000" : "#ffffff";
}
// ─── Brand Shift ──────────────────────────────────────────────────────────────
/**
 * Shift hue and saturation of a color to create a brand variant
 * (e.g. "warmer and more approachable").
 */
function brandShift(hex, hueShift, satShift) {
    const rgb = (0, color_utils_js_1.hexToRgb)(hex);
    if (!rgb)
        return hex;
    const hsl = (0, color_utils_js_1.rgbToHsl)(rgb.r, rgb.g, rgb.b);
    hsl.h = (hsl.h + hueShift + 360) % 360;
    hsl.s = Math.max(0, Math.min(1, hsl.s + satShift));
    const { r, g, b } = (0, color_utils_js_1.hslToRgb)(hsl.h, hsl.s, hsl.l);
    return (0, color_utils_js_1.rgbToHex)(r, g, b);
}
// ─── Palette Shade Generator ──────────────────────────────────────────────────
/**
 * Generate a full shade palette (50, 100–900, 950) from a base color.
 * Follows the Material/Tailwind convention: 500 = base, lighter above, darker below.
 */
function generateShades(hex) {
    const rgb = (0, color_utils_js_1.hexToRgb)(hex);
    if (!rgb)
        return {};
    const hsl = (0, color_utils_js_1.rgbToHsl)(rgb.r, rgb.g, rgb.b);
    const steps = {
        "50": 0.97,
        "100": 0.93,
        "200": 0.86,
        "300": 0.74,
        "400": 0.60,
        "500": hsl.l, // base
        "600": 0.40,
        "700": 0.32,
        "800": 0.24,
        "900": 0.16,
        "950": 0.10,
    };
    const shades = {};
    for (const [step, lightness] of Object.entries(steps)) {
        const { r, g, b } = (0, color_utils_js_1.hslToRgb)(hsl.h, hsl.s, lightness);
        shades[step] = (0, color_utils_js_1.rgbToHex)(r, g, b);
    }
    return shades;
}
/**
 * From the plan — semantic tokens must keep their hue family:
 *   --color-danger   → red   (0–20°)
 *   --color-success  → green (100–160°)
 *   --color-warning  → amber (30–50°)
 *   --color-info     → blue  (200–240°)
 */
exports.SEMANTIC_HUE_RANGES = [
    { name: "danger", minHue: 0, maxHue: 20 },
    { name: "success", minHue: 100, maxHue: 160 },
    { name: "warning", minHue: 30, maxHue: 50 },
    { name: "info", minHue: 200, maxHue: 240 },
];
/** Clamp a color's hue to its semantic range. */
function enforceSemanticHue(hex, semanticName) {
    const range = exports.SEMANTIC_HUE_RANGES.find((r) => r.name === semanticName);
    if (!range)
        return hex;
    const rgb = (0, color_utils_js_1.hexToRgb)(hex);
    if (!rgb)
        return hex;
    const hsl = (0, color_utils_js_1.rgbToHsl)(rgb.r, rgb.g, rgb.b);
    if (hsl.h < range.minHue || hsl.h > range.maxHue) {
        hsl.h = (range.minHue + range.maxHue) / 2;
        const { r, g, b } = (0, color_utils_js_1.hslToRgb)(hsl.h, hsl.s, hsl.l);
        return (0, color_utils_js_1.rgbToHex)(r, g, b);
    }
    return hex;
}
//# sourceMappingURL=color-theory.js.map