// ─────────────────────────────────────────────────────────────────────────────
// Color Utilities
// Shared color conversion, manipulation, and analysis helpers used across
// the token utilities, theme generator, a11y audit, and vision pipeline.
// ─────────────────────────────────────────────────────────────────────────────

export interface HSL {
  h: number; // 0–360
  s: number; // 0–1
  l: number; // 0–1
}

export interface RGB {
  r: number; // 0–255
  g: number;
  b: number;
}

// ─── Hex ↔ RGB ────────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): RGB | null {
  const clean = hex.replace(/^#/, "");
  if (clean.length !== 6 && clean.length !== 3) return null;
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const num = parseInt(full, 16);
  if (isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Convert Figma's 0-1 RGBA components to a hex string. */
export function figmaRgbaToHex(r: number, g: number, b: number): string {
  return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}

// ─── RGB ↔ HSL ────────────────────────────────────────────────────────────────

export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return { h: h * 360, s, l };
}

function hue2rgb(p: number, q: number, t: number): number {
  let tn = t;
  if (tn < 0) tn += 1;
  if (tn > 1) tn -= 1;
  if (tn < 1 / 6) return p + (q - p) * 6 * tn;
  if (tn < 1 / 2) return q;
  if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
  return p;
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hn = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

// ─── Luminance & Contrast ─────────────────────────────────────────────────────

/** WCAG relative luminance (0–1). */
export function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(hex1: string, hex2: string): number {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  if (!c1 || !c2) return 1;
  const l1 = relativeLuminance(c1.r, c1.g, c1.b);
  const l2 = relativeLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Color Distance ───────────────────────────────────────────────────────────

/** Euclidean distance in RGB space (0–441.67). */
export function colorDistance(hex1: string, hex2: string): number {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  if (!c1 || !c2) return Infinity;
  return Math.sqrt(
    (c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2
  );
}

/** Hue + lightness distance for semantic color matching. */
export function semanticColorDistance(hex1: string, hex2: string): number {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  if (!c1 || !c2) return Infinity;
  const hsl1 = rgbToHsl(c1.r, c1.g, c1.b);
  const hsl2 = rgbToHsl(c2.r, c2.g, c2.b);
  const hueDist = Math.min(Math.abs(hsl1.h - hsl2.h), 360 - Math.abs(hsl1.h - hsl2.h)) / 180;
  const lightDist = Math.abs(hsl1.l - hsl2.l);
  return hueDist * 0.6 + lightDist * 0.4;
}
