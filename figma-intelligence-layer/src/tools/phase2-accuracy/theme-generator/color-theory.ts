// ─────────────────────────────────────────────────────────────────────────────
// Color Theory
// Colour generation algorithms for the theme-generator tool:
//   • Dark mode generation (flip lightness, preserve hue)
//   • High-contrast mode (boost to meet WCAG AAA)
//   • Brand-shift (semantic hue rotation)
//   • Palette shade generation (50–950)
//   • Perceptual invariant enforcement
// ─────────────────────────────────────────────────────────────────────────────

import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  contrastRatio,
  type HSL,
} from "../../../shared/color-utils.js";

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
export function toDarkMode(hex: string, role: "surface" | "text" | "brand" | "semantic" = "semantic"): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

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

  const { r, g, b } = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(r, g, b);
}

// ─── High Contrast ────────────────────────────────────────────────────────────

/**
 * Adjust a foreground color until it meets the given WCAG level
 * against the provided background.
 */
export function toHighContrast(
  fgHex: string,
  bgHex: string,
  target: "AA" | "AAA" = "AAA"
): string {
  const minRatio = target === "AAA" ? 7.0 : 4.5;
  const ratio = contrastRatio(fgHex, bgHex);
  if (ratio >= minRatio) return fgHex;

  const rgb = hexToRgb(fgHex);
  if (!rgb) return fgHex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Darken or lighten the foreground depending on whether bg is light or dark
  const bgRgb = hexToRgb(bgHex);
  const bgLightness = bgRgb ? rgbToHsl(bgRgb.r, bgRgb.g, bgRgb.b).l : 0.5;
  const direction = bgLightness > 0.5 ? -0.02 : 0.02;

  for (let i = 0; i < 50; i++) {
    hsl.l = Math.max(0, Math.min(1, hsl.l + direction));
    const { r, g, b } = hslToRgb(hsl.h, hsl.s, hsl.l);
    const candidate = rgbToHex(r, g, b);
    if (contrastRatio(candidate, bgHex) >= minRatio) return candidate;
  }

  // Failsafe: return pure black or white
  return bgLightness > 0.5 ? "#000000" : "#ffffff";
}

// ─── Brand Shift ──────────────────────────────────────────────────────────────

/**
 * Shift hue and saturation of a color to create a brand variant
 * (e.g. "warmer and more approachable").
 */
export function brandShift(hex: string, hueShift: number, satShift: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.h = (hsl.h + hueShift + 360) % 360;
  hsl.s = Math.max(0, Math.min(1, hsl.s + satShift));
  const { r, g, b } = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHex(r, g, b);
}

// ─── Palette Shade Generator ──────────────────────────────────────────────────

/**
 * Generate a full shade palette (50, 100–900, 950) from a base color.
 * Follows the Material/Tailwind convention: 500 = base, lighter above, darker below.
 */
export function generateShades(hex: string): Record<string, string> {
  const rgb = hexToRgb(hex);
  if (!rgb) return {};
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const steps: Record<string, number> = {
    "50": 0.97,
    "100": 0.93,
    "200": 0.86,
    "300": 0.74,
    "400": 0.60,
    "500": hsl.l,   // base
    "600": 0.40,
    "700": 0.32,
    "800": 0.24,
    "900": 0.16,
    "950": 0.10,
  };

  const shades: Record<string, string> = {};
  for (const [step, lightness] of Object.entries(steps)) {
    const { r, g, b } = hslToRgb(hsl.h, hsl.s, lightness);
    shades[step] = rgbToHex(r, g, b);
  }
  return shades;
}

// ─── Perceptual Invariants ────────────────────────────────────────────────────

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
export const SEMANTIC_HUE_RANGES: SemanticHueRange[] = [
  { name: "danger",  minHue: 0,   maxHue: 20  },
  { name: "success", minHue: 100, maxHue: 160 },
  { name: "warning", minHue: 30,  maxHue: 50  },
  { name: "info",    minHue: 200, maxHue: 240 },
];

/** Clamp a color's hue to its semantic range. */
export function enforceSemanticHue(hex: string, semanticName: string): string {
  const range = SEMANTIC_HUE_RANGES.find((r) => r.name === semanticName);
  if (!range) return hex;

  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  if (hsl.h < range.minHue || hsl.h > range.maxHue) {
    hsl.h = (range.minHue + range.maxHue) / 2;
    const { r, g, b } = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(r, g, b);
  }
  return hex;
}
