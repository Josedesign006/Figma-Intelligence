/**
 * Color operations for design token manipulation.
 * Supports: lighten, darken, mix, alpha, hue shift, saturate, desaturate
 * All operations work on hex color strings (#RRGGBB or #RRGGBBAA)
 *
 * Provides operations that Tokens Studio Pro offers but the plugin currently lacks.
 * Pure TypeScript — no external dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RGB {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a: number; // 0-1
}

export interface HSL {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
  a: number; // 0-1
}

export interface Oklch {
  L: number; // 0-1  (perceptual lightness)
  C: number; // 0+   (chroma)
  h: number; // 0-360 (hue angle, degrees)
  a: number; // 0-1  (alpha)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

function hexByte(v: number): string {
  const h = Math.round(clamp(v, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return h;
}

function parseHexByte(s: string): number {
  return parseInt(s, 16) / 255;
}

// ---------------------------------------------------------------------------
// Hex <-> RGB
// ---------------------------------------------------------------------------

export function hexToRgb(hex: string): RGB {
  let h = hex.replace(/^#/, "");

  // Expand shorthand (#RGB or #RGBA)
  if (h.length === 3 || h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }

  if (h.length !== 6 && h.length !== 8) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return {
    r: parseHexByte(h.slice(0, 2)),
    g: parseHexByte(h.slice(2, 4)),
    b: parseHexByte(h.slice(4, 6)),
    a: h.length === 8 ? parseHexByte(h.slice(6, 8)) : 1,
  };
}

export function rgbToHex(rgb: RGB): string {
  const r = hexByte(rgb.r);
  const g = hexByte(rgb.g);
  const b = hexByte(rgb.b);
  if (rgb.a < 1) {
    return `#${r}${g}${b}${hexByte(rgb.a)}`;
  }
  return `#${r}${g}${b}`;
}

// ---------------------------------------------------------------------------
// RGB <-> HSL
// ---------------------------------------------------------------------------

export function rgbToHsl(rgb: RGB): HSL {
  const { r, g, b, a } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s, l, a };
}

export function hslToRgb(hsl: HSL): RGB {
  const { h, s, l, a } = hsl;
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hNorm = h / 360;
    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }

  return { r, g, b, a };
}

// ---------------------------------------------------------------------------
// RGB <-> Oklch  (sRGB -> linear sRGB -> XYZ D65 -> Oklab -> Oklch)
// ---------------------------------------------------------------------------

/** sRGB gamma to linear */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** linear to sRGB gamma */
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

function rgbToLinear(rgb: RGB): [number, number, number] {
  return [srgbToLinear(rgb.r), srgbToLinear(rgb.g), srgbToLinear(rgb.b)];
}

function linearToXyz(lr: number, lg: number, lb: number): [number, number, number] {
  // sRGB D65 matrix
  const x = 0.4123907992659595 * lr + 0.357584339383878 * lg + 0.1804807884018343 * lb;
  const y = 0.21263900587151027 * lr + 0.715168678767756 * lg + 0.07219231536073371 * lb;
  const z = 0.01933081871559182 * lr + 0.11919477979462598 * lg + 0.9505321522496607 * lb;
  return [x, y, z];
}

function xyzToLinear(x: number, y: number, z: number): [number, number, number] {
  // Inverse sRGB D65 matrix
  const lr = 3.2409699419045226 * x + -1.5373831775700939 * y + -0.4986107602930034 * z;
  const lg = -0.9692436362808796 * x + 1.8759675015077202 * y + 0.04155505740717559 * z;
  const lb = 0.05563007969699366 * x + -0.20397696064091520 * y + 1.0569715142428786 * z;
  return [lr, lg, lb];
}

function xyzToOklab(x: number, y: number, z: number): [number, number, number] {
  // XYZ to LMS (using Oklab M1)
  const l = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z;
  const m = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z;
  const s = 0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z;

  // Cube root
  const lp = Math.cbrt(l);
  const mp = Math.cbrt(m);
  const sp = Math.cbrt(s);

  // LMS' to Lab (using Oklab M2)
  const L = 0.2104542553 * lp + 0.7936177850 * mp - 0.0040720468 * sp;
  const A = 1.9779984951 * lp - 2.4285922050 * mp + 0.4505937099 * sp;
  const B = 0.0259040371 * lp + 0.7827717662 * mp - 0.8086757660 * sp;

  return [L, A, B];
}

function oklabToXyz(L: number, A: number, B: number): [number, number, number] {
  // Inverse M2
  const lp = L + 0.3963377774 * A + 0.2158037573 * B;
  const mp = L - 0.1055613458 * A - 0.0638541728 * B;
  const sp = L - 0.0894841775 * A - 1.2914855480 * B;

  // Cube
  const l = lp * lp * lp;
  const m = mp * mp * mp;
  const s = sp * sp * sp;

  // Inverse M1
  const x = 1.2270138511035211 * l - 0.5577999806518222 * m + 0.2812561489664678 * s;
  const y = -0.0405801784232806 * l + 1.1122568696168302 * m - 0.0716766786656012 * s;
  const z = -0.0763812845057069 * l - 0.4214819784180127 * m + 1.5861632204407947 * s;

  return [x, y, z];
}

export function rgbToOklch(rgb: RGB): Oklch {
  const [lr, lg, lb] = rgbToLinear(rgb);
  const [x, y, z] = linearToXyz(lr, lg, lb);
  const [L, A, B] = xyzToOklab(x, y, z);

  const C = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;

  return { L, C, h, a: rgb.a };
}

export function oklchToRgb(oklch: Oklch): RGB {
  const { L, C, h, a } = oklch;
  const hRad = (h * Math.PI) / 180;
  const A = C * Math.cos(hRad);
  const B = C * Math.sin(hRad);

  const [x, y, z] = oklabToXyz(L, A, B);
  const [lr, lg, lb] = xyzToLinear(x, y, z);

  return {
    r: clamp(linearToSrgb(lr), 0, 1),
    g: clamp(linearToSrgb(lg), 0, 1),
    b: clamp(linearToSrgb(lb), 0, 1),
    a,
  };
}

// ---------------------------------------------------------------------------
// CSS Color 4 formatters
// ---------------------------------------------------------------------------

export function formatCssColor(
  hex: string,
  space: "srgb" | "display-p3" | "oklch" = "srgb",
): string {
  const rgb = hexToRgb(hex);

  switch (space) {
    case "srgb": {
      if (rgb.a < 1) {
        return `rgb(${Math.round(rgb.r * 255)} ${Math.round(rgb.g * 255)} ${Math.round(rgb.b * 255)} / ${round(rgb.a, 3)})`;
      }
      return `rgb(${Math.round(rgb.r * 255)} ${Math.round(rgb.g * 255)} ${Math.round(rgb.b * 255)})`;
    }
    case "display-p3": {
      // Display P3 uses the same RGB values as sRGB for in-gamut colors
      // but expressed via the color() function
      if (rgb.a < 1) {
        return `color(display-p3 ${round(rgb.r, 4)} ${round(rgb.g, 4)} ${round(rgb.b, 4)} / ${round(rgb.a, 3)})`;
      }
      return `color(display-p3 ${round(rgb.r, 4)} ${round(rgb.g, 4)} ${round(rgb.b, 4)})`;
    }
    case "oklch": {
      const o = rgbToOklch(rgb);
      if (o.a < 1) {
        return `oklch(${round(o.L, 4)} ${round(o.C, 4)} ${round(o.h, 2)} / ${round(o.a, 3)})`;
      }
      return `oklch(${round(o.L, 4)} ${round(o.C, 4)} ${round(o.h, 2)})`;
    }
  }
}

// ---------------------------------------------------------------------------
// Color operations (all return hex strings)
// ---------------------------------------------------------------------------

export function lighten(hex: string, amount: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.l = clamp(hsl.l + (1 - hsl.l) * clamp(amount, 0, 1), 0, 1);
  return rgbToHex(hslToRgb(hsl));
}

export function darken(hex: string, amount: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.l = clamp(hsl.l * (1 - clamp(amount, 0, 1)), 0, 1);
  return rgbToHex(hslToRgb(hsl));
}

export function mix(hex1: string, hex2: string, weight: number = 0.5): string {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  const w = clamp(weight, 0, 1);
  return rgbToHex({
    r: c1.r * (1 - w) + c2.r * w,
    g: c1.g * (1 - w) + c2.g * w,
    b: c1.b * (1 - w) + c2.b * w,
    a: c1.a * (1 - w) + c2.a * w,
  });
}

export function setAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  rgb.a = clamp(alpha, 0, 1);
  return rgbToHex(rgb);
}

export function adjustHue(hex: string, degrees: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.h = ((hsl.h + degrees) % 360 + 360) % 360;
  return rgbToHex(hslToRgb(hsl));
}

export function saturate(hex: string, amount: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.s = clamp(hsl.s + (1 - hsl.s) * clamp(amount, 0, 1), 0, 1);
  return rgbToHex(hslToRgb(hsl));
}

export function desaturate(hex: string, amount: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.s = clamp(hsl.s * (1 - clamp(amount, 0, 1)), 0, 1);
  return rgbToHex(hslToRgb(hsl));
}

export function complement(hex: string): string {
  return adjustHue(hex, 180);
}

export function invert(hex: string): string {
  const rgb = hexToRgb(hex);
  return rgbToHex({
    r: 1 - rgb.r,
    g: 1 - rgb.g,
    b: 1 - rgb.b,
    a: rgb.a,
  });
}

// ---------------------------------------------------------------------------
// Contrast utilities  (WCAG 2.x relative luminance)
// ---------------------------------------------------------------------------

export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const [lr, lg, lb] = rgbToLinear(rgb);
  // Rec. 709 coefficients
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWcagAA(
  hex1: string,
  hex2: string,
  isLargeText: boolean = false,
): boolean {
  const ratio = contrastRatio(hex1, hex2);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

export function meetsWcagAAA(
  hex1: string,
  hex2: string,
  isLargeText: boolean = false,
): boolean {
  const ratio = contrastRatio(hex1, hex2);
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Attempt to adjust the foreground color to meet the target contrast ratio
 * against the given background. Lightens or darkens the fg in HSL space.
 * Returns the adjusted hex color, or the best achievable if the target is
 * impossible.
 */
export function suggestAccessibleColor(
  bg: string,
  fg: string,
  targetRatio: number = 4.5,
): string {
  // If already passing, return as-is
  if (contrastRatio(bg, fg) >= targetRatio) {
    return fg;
  }

  const bgLum = luminance(bg);
  const hsl = rgbToHsl(hexToRgb(fg));

  // Try both directions: lighter and darker
  const tryDirection = (dir: "lighten" | "darken"): { hex: string; ratio: number } => {
    let lo = 0;
    let hi = 1;
    let bestHex = fg;
    let bestRatio = contrastRatio(bg, fg);

    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      const testHsl = { ...hsl };
      if (dir === "lighten") {
        testHsl.l = clamp(hsl.l + (1 - hsl.l) * mid, 0, 1);
      } else {
        testHsl.l = clamp(hsl.l * (1 - mid), 0, 1);
      }
      const candidate = rgbToHex(hslToRgb(testHsl));
      const ratio = contrastRatio(bg, candidate);

      if (ratio >= targetRatio) {
        bestHex = candidate;
        bestRatio = ratio;
        hi = mid; // try less adjustment
      } else {
        lo = mid; // need more adjustment
      }
    }
    return { hex: bestHex, ratio: bestRatio };
  };

  // Decide primary direction: if bg is dark, lighten fg; if bg is light, darken fg
  const primaryDir = bgLum > 0.5 ? "darken" : "lighten";
  const secondaryDir = primaryDir === "darken" ? "lighten" : "darken";

  const primary = tryDirection(primaryDir);
  if (primary.ratio >= targetRatio) {
    return primary.hex;
  }

  const secondary = tryDirection(secondaryDir);
  if (secondary.ratio >= targetRatio) {
    return secondary.hex;
  }

  // Return whichever got closest
  return primary.ratio >= secondary.ratio ? primary.hex : secondary.hex;
}

// ---------------------------------------------------------------------------
// Palette generation
// ---------------------------------------------------------------------------

export function generateTints(hex: string, steps: number = 10): string[] {
  const result: string[] = [];
  for (let i = 1; i <= steps; i++) {
    result.push(mix(hex, "#ffffff", i / (steps + 1)));
  }
  return result;
}

export function generateShades(hex: string, steps: number = 10): string[] {
  const result: string[] = [];
  for (let i = 1; i <= steps; i++) {
    result.push(mix(hex, "#000000", i / (steps + 1)));
  }
  return result;
}

/**
 * Generate a Tailwind-style tint/shade scale where 500 is the base color.
 * Returns keys: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
 */
export function generateTintShadeScale(
  hex: string,
  steps: number = 11,
): Record<string, string> {
  // Fixed scale labels matching Tailwind convention
  const labels = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

  // Lightness targets (approximate Tailwind lightness distribution)
  // 50 is lightest, 950 is darkest. 500 = base color.
  const lightnessTargets = [0.95, 0.90, 0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.22, 0.14, 0.09];

  const hsl = rgbToHsl(hexToRgb(hex));
  const baseLightness = hsl.l;

  const scale: Record<string, string> = {};

  for (let i = 0; i < labels.length; i++) {
    const target = lightnessTargets[i];

    if (labels[i] === "500") {
      // 500 is always the base color
      scale[labels[i]] = hex;
    } else {
      // Map target lightness relative to the base color's natural position
      // For tints (above 500): interpolate between base and white
      // For shades (below 500): interpolate between base and black
      const adjusted = { ...hsl };

      if (target > 0.5) {
        // Tint territory: blend toward white
        const t = (target - 0.5) / 0.5; // 0..1 as target goes from 0.5 to 1.0
        adjusted.l = baseLightness + (1 - baseLightness) * t;
        // Desaturate tints slightly for more natural palette
        adjusted.s = hsl.s * (1 - t * 0.3);
      } else {
        // Shade territory: blend toward black
        const t = (0.5 - target) / 0.5; // 0..1 as target goes from 0.5 to 0.0
        adjusted.l = baseLightness * (1 - t);
        // Slightly increase saturation in mid-shades, reduce in deep shades
        adjusted.s = hsl.s * (1 - t * 0.15);
      }

      adjusted.l = clamp(adjusted.l, 0, 1);
      adjusted.s = clamp(adjusted.s, 0, 1);

      scale[labels[i]] = rgbToHex(hslToRgb(adjusted));
    }
  }

  return scale;
}
