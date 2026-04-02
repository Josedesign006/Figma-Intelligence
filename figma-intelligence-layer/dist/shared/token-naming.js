"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultTokenNamingRules = getDefaultTokenNamingRules;
exports.analyzeTokenName = analyzeTokenName;
exports.analyzeTokenNames = analyzeTokenNames;
const DEFAULT_RULES = {
    primitiveCategories: ["color", "space", "typography", "radius", "elevation", "border", "opacity", "motion", "z-index", "border-width", "icon-size", "breakpoint", "grid", "density"],
    semanticCategories: ["text", "surface", "icon", "action", "feedback", "field", "chart", "overlay", "stroke"],
    componentPrefix: "component",
    semanticPrefix: "semantic",
    separator: "/",
};
const COMMON_TYPOS = {
    typogrpahy: "typography",
    typographyy: "typography",
    eleveation: "elevation",
    elevetion: "elevation",
    bordre: "border",
    opactiy: "opacity",
    primitve: "primitive",
    componet: "component",
};
function normalizeSegment(raw) {
    return raw
        .trim()
        .toLowerCase()
        .replace(/[.\s_]+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}
function normalizeName(name, separator) {
    return name
        .trim()
        .replace(/\s*\/\s*/g, separator)
        .split(separator)
        .map(normalizeSegment)
        .filter(Boolean)
        .join(separator);
}
function inferDomain(segments, rules) {
    if (segments.length === 0)
        return "unknown";
    if (rules.primitiveCategories.includes(segments[0]))
        return "primitive";
    if (segments[0] === rules.semanticPrefix)
        return "semantic";
    if (segments[0] === rules.componentPrefix || segments[0] === `${rules.componentPrefix}s`)
        return "component";
    if (rules.semanticCategories.includes(segments[0]))
        return "semantic";
    return "unknown";
}
function suggestSemanticPrefix(segments, rules) {
    if (segments[0] === rules.semanticPrefix)
        return segments.join(rules.separator);
    return [rules.semanticPrefix, ...segments].join(rules.separator);
}
function suggestComponentPrefix(segments, rules) {
    const withoutPlural = segments[0] === `${rules.componentPrefix}s` ? segments.slice(1) : segments;
    if (withoutPlural[0] === rules.componentPrefix)
        return withoutPlural.join(rules.separator);
    return [rules.componentPrefix, ...withoutPlural].join(rules.separator);
}
function getDefaultTokenNamingRules() {
    return { ...DEFAULT_RULES };
}
function analyzeTokenName(name, rules = DEFAULT_RULES) {
    const issues = [];
    const trimmed = name.trim();
    if (!trimmed) {
        return {
            originalName: name,
            normalizedName: "",
            domain: "unknown",
            isValid: false,
            issues: [{ severity: "error", code: "empty-name", message: "Token name cannot be empty." }],
            suggestedName: null,
        };
    }
    if (/[A-Z]/.test(trimmed)) {
        issues.push({ severity: "warning", code: "uppercase", message: "Use lowercase token names." });
    }
    if (/[^a-zA-Z0-9/_\-. ]/.test(trimmed)) {
        issues.push({
            severity: "error",
            code: "invalid-characters",
            message: "Use only letters, numbers, spaces, hyphens, underscores, dots, and slashes.",
        });
    }
    if (/\/{2,}/.test(trimmed)) {
        issues.push({
            severity: "error",
            code: "duplicate-separator",
            message: "Avoid duplicate path separators in token names.",
        });
    }
    const normalizedName = normalizeName(trimmed, rules.separator);
    const segments = normalizedName.split(rules.separator).filter(Boolean);
    for (const [typo, correction] of Object.entries(COMMON_TYPOS)) {
        if (segments.includes(typo)) {
            issues.push({
                severity: "warning",
                code: "typo",
                message: `Possible typo '${typo}'. Use '${correction}'.`,
            });
        }
    }
    if (segments.length < 2) {
        issues.push({
            severity: "warning",
            code: "short-name",
            message: "Token names should usually include at least category and item.",
        });
    }
    let domain = inferDomain(segments, rules);
    if (domain === "unknown") {
        issues.push({
            severity: "warning",
            code: "unknown-domain",
            message: "Token name does not match the primitive, semantic, or component naming grammar.",
        });
    }
    if (domain === "primitive" && !rules.primitiveCategories.includes(segments[0])) {
        issues.push({
            severity: "error",
            code: "unknown-primitive-category",
            message: `Unknown primitive category '${segments[0]}'.`,
        });
    }
    if (domain === "semantic" && segments[0] !== rules.semanticPrefix) {
        issues.push({
            severity: "warning",
            code: "semantic-prefix",
            message: `Semantic tokens should start with '${rules.semanticPrefix}/'.`,
        });
    }
    if (segments[0] === `${rules.componentPrefix}s`) {
        domain = "component";
        issues.push({
            severity: "warning",
            code: "component-prefix",
            message: `Prefer '${rules.componentPrefix}/' over '${rules.componentPrefix}s/'.`,
        });
    }
    let suggestedSegments = [...segments];
    suggestedSegments = suggestedSegments.map((segment) => COMMON_TYPOS[segment] ?? segment);
    if (rules.semanticCategories.includes(suggestedSegments[0])) {
        suggestedSegments = suggestSemanticPrefix(suggestedSegments, rules).split(rules.separator);
    }
    else if (suggestedSegments[0] === `${rules.componentPrefix}s`) {
        suggestedSegments = suggestComponentPrefix(suggestedSegments, rules).split(rules.separator);
    }
    const suggestedName = suggestedSegments.join(rules.separator);
    return {
        originalName: name,
        normalizedName,
        domain,
        isValid: issues.every((issue) => issue.severity !== "error"),
        issues,
        suggestedName: suggestedName !== normalizedName ? suggestedName : null,
    };
}
function analyzeTokenNames(names, rules = DEFAULT_RULES) {
    return names.map((name) => analyzeTokenName(name, rules));
}
//# sourceMappingURL=token-naming.js.map