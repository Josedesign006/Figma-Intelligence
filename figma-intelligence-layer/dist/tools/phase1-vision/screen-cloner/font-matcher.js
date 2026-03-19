"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFontStyleMatch = resolveFontStyleMatch;
function normalize(value) {
    return (value ?? "").trim().toLowerCase();
}
function scoreStringMatch(a, b) {
    const left = normalize(a);
    const right = normalize(b);
    if (!left || !right)
        return 0;
    if (left === right)
        return 1;
    if (left.includes(right) || right.includes(left))
        return 0.8;
    const leftTokens = new Set(left.split(/[\s/_-]+/).filter(Boolean));
    const rightTokens = right.split(/[\s/_-]+/).filter(Boolean);
    if (!leftTokens.size || !rightTokens.length)
        return 0;
    const overlap = rightTokens.filter((token) => leftTokens.has(token)).length;
    return overlap / Math.max(leftTokens.size, rightTokens.length);
}
function scoreNumericProximity(actual, expected, maxDelta) {
    if (actual == null || expected == null)
        return 0;
    const delta = Math.abs(actual - expected);
    return Math.max(0, 1 - delta / maxDelta);
}
function normalizeTextStyles(styles) {
    if (!styles || !Array.isArray(styles.text))
        return [];
    return styles.text.filter((style) => {
        return typeof style === "object" && style !== null && "id" in style && "name" in style;
    });
}
function resolveFontStyleMatch(manifest, styles) {
    const candidates = normalizeTextStyles(styles);
    if (candidates.length === 0)
        return null;
    const scored = candidates
        .map((style) => {
        const familyScore = scoreStringMatch(style.fontName?.family, manifest.fontFamilyGuess);
        const styleScore = scoreStringMatch(style.fontName?.style ?? style.name, manifest.fontStyleGuess);
        const sizeScore = scoreNumericProximity(style.fontSize, manifest.estimatedFontSize, 16);
        const weightScore = scoreNumericProximity(inferWeight(style.fontName?.style), manifest.fontWeightGuess, 500);
        const confidence = familyScore * 0.45 + styleScore * 0.2 + sizeScore * 0.2 + weightScore * 0.15;
        return {
            style,
            confidence,
        };
    })
        .sort((a, b) => b.confidence - a.confidence);
    const best = scored[0];
    if (!best || best.confidence < 0.35 || !best.style.fontName || best.style.fontSize == null) {
        return null;
    }
    return {
        styleId: best.style.id,
        styleName: best.style.name,
        fontFamily: best.style.fontName.family,
        fontStyle: best.style.fontName.style,
        fontSize: best.style.fontSize,
        lineHeightPx: best.style.lineHeight?.unit === "PIXELS" ? best.style.lineHeight.value : undefined,
        confidence: best.confidence,
    };
}
function inferWeight(fontStyle) {
    const value = normalize(fontStyle);
    if (!value)
        return undefined;
    if (value.includes("thin"))
        return 100;
    if (value.includes("extralight") || value.includes("ultralight"))
        return 200;
    if (value.includes("light"))
        return 300;
    if (value.includes("regular") || value.includes("book"))
        return 400;
    if (value.includes("medium"))
        return 500;
    if (value.includes("semibold") || value.includes("demibold"))
        return 600;
    if (value.includes("bold"))
        return 700;
    if (value.includes("extrabold") || value.includes("ultrabold"))
        return 800;
    if (value.includes("black") || value.includes("heavy"))
        return 900;
    return undefined;
}
//# sourceMappingURL=font-matcher.js.map