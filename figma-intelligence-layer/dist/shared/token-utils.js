"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snapToSpacingToken = snapToSpacingToken;
exports.snapToRadiusToken = snapToRadiusToken;
exports.snapToTypeToken = snapToTypeToken;
exports.hexToRgb = hexToRgb;
exports.rgbToHex = rgbToHex;
exports.figmaRgbaToHex = figmaRgbaToHex;
exports.snapToColorToken = snapToColorToken;
exports.computeContrastRatio = computeContrastRatio;
exports.meetsWCAG = meetsWCAG;
exports.simulateColorBlindness = simulateColorBlindness;
exports.generateDarkModeColor = generateDarkModeColor;
exports.generateHighContrastColor = generateHighContrastColor;
// ─────────────────────────────────────────────────────────────────────────────
// Spacing token snapping
// ─────────────────────────────────────────────────────────────────────────────
const SPACING_SCALE = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 64, 80, 96, 128];
function snapToSpacingToken(px) {
    const rounded = Math.round(px / 4) * 4;
    const nearest = SPACING_SCALE.reduce((prev, curr) => Math.abs(curr - rounded) < Math.abs(prev - rounded) ? curr : prev);
    return {
        tokenName: `--spacing-${nearest}`,
        tokenValue: nearest,
        delta: px - nearest,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Border radius snapping
// ─────────────────────────────────────────────────────────────────────────────
const RADIUS_SCALE = [0, 2, 4, 8, 12, 16, 24, 32, 9999];
function snapToRadiusToken(px) {
    if (px >= 500) {
        return { tokenName: "--radius-full", tokenValue: 9999, delta: px - 9999 };
    }
    const nearest = RADIUS_SCALE.slice(0, -1).reduce((prev, curr) => Math.abs(curr - px) < Math.abs(prev - px) ? curr : prev);
    const nameMap = {
        0: "--radius-none",
        2: "--radius-xs",
        4: "--radius-sm",
        8: "--radius-md",
        12: "--radius-lg",
        16: "--radius-xl",
        24: "--radius-2xl",
        32: "--radius-3xl",
    };
    return {
        tokenName: nameMap[nearest] ?? `--radius-${nearest}`,
        tokenValue: nearest,
        delta: px - nearest,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Font size snapping
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_SCALE = [
    { name: "--text-xs", value: 12 },
    { name: "--text-sm", value: 14 },
    { name: "--text-base", value: 16 },
    { name: "--text-lg", value: 18 },
    { name: "--text-xl", value: 20 },
    { name: "--text-2xl", value: 24 },
    { name: "--text-3xl", value: 30 },
    { name: "--text-4xl", value: 36 },
    { name: "--text-5xl", value: 48 },
    { name: "--text-6xl", value: 60 },
];
function snapToTypeToken(px) {
    const nearest = TYPE_SCALE.reduce((prev, curr) => Math.abs(curr.value - px) < Math.abs(prev.value - px) ? curr : prev);
    return {
        tokenName: nearest.name,
        tokenValue: nearest.value,
        delta: px - nearest.value,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Color utilities
// ─────────────────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    if (clean.length !== 3 && clean.length !== 6)
        return null;
    const full = clean.length === 3
        ? clean.split("").map((c) => c + c).join("")
        : clean;
    const num = parseInt(full, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255,
    };
}
function rgbToHex(r, g, b) {
    return ("#" +
        [r, g, b]
            .map((v) => Math.round(v).toString(16).padStart(2, "0"))
            .join(""));
}
function figmaRgbaToHex(r, g, b) {
    return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min)
        return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
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
    return { h: h * 360, s, l };
}
function snapToColorToken(hex, tokens) {
    const rgb = hexToRgb(hex);
    if (!rgb)
        return { tokenName: "--color-unknown", tokenValue: hex };
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const colorTokens = tokens.filter((t) => t.type === "COLOR");
    if (colorTokens.length === 0) {
        return { tokenName: "--color-unknown", tokenValue: hex };
    }
    let bestMatch = colorTokens[0];
    let bestDist = Infinity;
    for (const token of colorTokens) {
        const tokenHex = String(token.value);
        const tokenRgb = hexToRgb(tokenHex);
        if (!tokenRgb)
            continue;
        const tokenHsl = rgbToHsl(tokenRgb.r, tokenRgb.g, tokenRgb.b);
        // Weighted HSL distance: hue matters most, then lightness, then saturation
        const hueDist = Math.min(Math.abs(hsl.h - tokenHsl.h), 360 - Math.abs(hsl.h - tokenHsl.h));
        const dist = (hueDist / 180) * 0.5 +
            Math.abs(hsl.l - tokenHsl.l) * 0.35 +
            Math.abs(hsl.s - tokenHsl.s) * 0.15;
        if (dist < bestDist) {
            bestDist = dist;
            bestMatch = token;
        }
    }
    return {
        tokenName: bestMatch.name,
        tokenValue: String(bestMatch.value),
        delta: bestDist,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// WCAG contrast
// ─────────────────────────────────────────────────────────────────────────────
function relativeLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map((c) => {
        const srgb = c / 255;
        return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
function computeContrastRatio(fgHex, bgHex) {
    const fg = hexToRgb(fgHex);
    const bg = hexToRgb(bgHex);
    if (!fg || !bg)
        return 1;
    const l1 = relativeLuminance(fg.r, fg.g, fg.b);
    const l2 = relativeLuminance(bg.r, bg.g, bg.b);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}
function meetsWCAG(ratio, level, isLargeText) {
    if (level === "AA")
        return ratio >= (isLargeText ? 3.0 : 4.5);
    return ratio >= (isLargeText ? 4.5 : 7.0);
}
const CB_MATRICES = {
    protanopia: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
    deuteranopia: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
    tritanopia: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
    achromatopsia: [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114],
};
function simulateColorBlindness(hex, profile) {
    const rgb = hexToRgb(hex);
    if (!rgb)
        return hex;
    const m = CB_MATRICES[profile];
    const r = Math.round(m[0] * rgb.r + m[1] * rgb.g + m[2] * rgb.b);
    const g = Math.round(m[3] * rgb.r + m[4] * rgb.g + m[5] * rgb.b);
    const b = Math.round(m[6] * rgb.r + m[7] * rgb.g + m[8] * rgb.b);
    return rgbToHex(Math.min(255, r), Math.min(255, g), Math.min(255, b));
}
// ─────────────────────────────────────────────────────────────────────────────
// Dark mode color transformation
// ─────────────────────────────────────────────────────────────────────────────
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    }
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0)
                t += 1;
            if (t > 1)
                t -= 1;
            if (t < 1 / 6)
                return p + (q - p) * 6 * t;
            if (t < 1 / 2)
                return q;
            if (t < 2 / 3)
                return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h / 360 + 1 / 3);
        g = hue2rgb(p, q, h / 360);
        b = hue2rgb(p, q, h / 360 - 1 / 3);
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}
/**
 * Role-aware dark mode color transformation.
 *
 * Instead of naively inverting lightness (which produces bright surfaces and
 * dark text), this function clamps lightness into ranges appropriate for each
 * semantic role:
 *
 *   surface  → L 0.06–0.15  (truly dark backgrounds)
 *   text     → L 0.85–0.98  (high-contrast readable text)
 *   brand    → L 0.45–0.55, saturation ×1.1 (vibrant accent)
 *   border   → L 0.25–0.35  (subtle dividers on dark bg)
 *   feedback → L 0.45–0.55, saturation ×1.1 (status colors)
 *
 * When `role` is omitted the legacy inversion behavior is used as fallback.
 */
function generateDarkModeColor(lightHex, role) {
    const rgb = hexToRgb(lightHex);
    if (!rgb)
        return lightHex;
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    let newL;
    let newS = hsl.s;
    switch (role) {
        case "surface":
            // Clamp to dark surface range
            newL = Math.max(0.06, Math.min(0.15, 0.10 + (1 - hsl.l) * 0.05));
            newS = Math.min(1, hsl.s * 0.6); // desaturate surfaces
            break;
        case "text":
            // Clamp to near-white readable range
            newL = Math.max(0.85, Math.min(0.98, 0.90 + hsl.l * 0.08));
            newS = Math.min(1, hsl.s * 0.5); // text should be mostly neutral
            break;
        case "brand":
        case "feedback":
            // Keep brand/feedback colors vibrant, moderate lightness
            newL = Math.max(0.45, Math.min(0.55, 0.50));
            newS = Math.min(1, hsl.s * 1.1);
            break;
        case "border":
            // Subtle but visible on dark backgrounds
            newL = Math.max(0.25, Math.min(0.35, 0.30));
            newS = Math.min(1, hsl.s * 0.5);
            break;
        default:
            // Legacy fallback: simple inversion
            newL = 1 - hsl.l;
            newS = Math.min(1, hsl.s * 1.1);
            break;
    }
    const newRgb = hslToRgb(hsl.h, newS, newL);
    return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}
function generateHighContrastColor(hex, bgHex, target) {
    const rgb = hexToRgb(hex);
    if (!rgb)
        return hex;
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const bgRgb = hexToRgb(bgHex);
    if (!bgRgb)
        return hex;
    const bgLum = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
    const targetRatio = target === "AAA" ? 7.0 : 4.5;
    // Try darkening/lightening until we meet contrast
    let l = hsl.l;
    for (let i = 0; i < 20; i++) {
        const newRgb = hslToRgb(hsl.h, hsl.s, l);
        const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        const ratio = computeContrastRatio(newHex, bgHex);
        if (ratio >= targetRatio)
            return newHex;
        // If bg is dark, lighten; if bg is light, darken
        l = bgLum > 0.5 ? l - 0.05 : l + 0.05;
        l = Math.max(0, Math.min(1, l));
    }
    return bgLum > 0.5 ? "#000000" : "#FFFFFF";
}
//# sourceMappingURL=token-utils.js.map