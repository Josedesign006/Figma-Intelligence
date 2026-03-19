"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenNamingHandler = tokenNamingHandler;
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const token_naming_js_1 = require("../../../shared/token-naming.js");
function summarize(analyses) {
    return {
        valid: analyses.filter((item) => item.isValid).length,
        invalid: analyses.filter((item) => !item.isValid).length,
        warnings: analyses.reduce((count, item) => count + item.issues.filter((issue) => issue.severity === "warning").length, 0),
    };
}
function buildRecommendations(analyses, rules) {
    const recommendations = [];
    if (analyses.some((item) => item.issues.some((issue) => issue.code === "typo"))) {
        recommendations.push("Fix token typos before creating aliases so naming drift does not spread.");
    }
    if (analyses.some((item) => item.issues.some((issue) => issue.code === "component-prefix"))) {
        recommendations.push(`Standardize component tokens on '${rules.componentPrefix}/...' instead of plural prefixes.`);
    }
    if (analyses.some((item) => item.issues.some((issue) => issue.code === "semantic-prefix"))) {
        recommendations.push(`Namespace semantic tokens under '${rules.semanticPrefix}/...' for cleaner separation from primitives.`);
    }
    if (analyses.some((item) => item.issues.some((issue) => issue.code === "uppercase"))) {
        recommendations.push("Normalize names to lowercase slash-separated paths.");
    }
    if (recommendations.length === 0) {
        recommendations.push("The token names already follow the current naming convention.");
    }
    return recommendations;
}
async function getCurrentFileTokenNames(collectionName) {
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    const collections = await bridge.getVariables(undefined, "full");
    return collections
        .filter((collection) => !collectionName || collection.name === collectionName)
        .flatMap((collection) => collection.variables.map((variable) => variable.name));
}
async function tokenNamingHandler(args) {
    const ruleSet = (0, token_naming_js_1.getDefaultTokenNamingRules)();
    if (args.action === "define") {
        return {
            ok: true,
            action: args.action,
            ruleSet,
            analyzedCount: 0,
            summary: { valid: 0, invalid: 0, warnings: 0 },
            analyses: [],
            recommendations: [
                "Primitive tokens: color/brand/500, space/16, typography/font-size/md",
                "Semantic tokens: semantic/text/primary, semantic/surface/default",
                "Component tokens: component/button/primary/background/default",
            ],
        };
    }
    const names = args.action === "audit-current-file"
        ? await getCurrentFileTokenNames(args.collectionName)
        : args.names ?? [];
    const analyses = (0, token_naming_js_1.analyzeTokenNames)(names, ruleSet);
    const filteredAnalyses = args.action === "suggest-renames"
        ? analyses.filter((item) => item.suggestedName && item.suggestedName !== item.normalizedName)
        : analyses;
    return {
        ok: true,
        action: args.action,
        ruleSet,
        analyzedCount: filteredAnalyses.length,
        summary: summarize(filteredAnalyses),
        analyses: filteredAnalyses,
        recommendations: buildRecommendations(filteredAnalyses, ruleSet),
    };
}
//# sourceMappingURL=index.js.map