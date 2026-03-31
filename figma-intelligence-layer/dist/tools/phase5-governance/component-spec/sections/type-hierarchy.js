"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTypeHierarchySection = buildTypeHierarchySection;
function buildTypeHierarchySection(data) {
    const { knowledge, typography } = data;
    if (!knowledge || knowledge.typeHierarchyRules.length === 0)
        return null;
    const blocks = [];
    blocks.push({
        kind: "rules",
        items: knowledge.typeHierarchyRules,
    });
    // Add observed typography summary if available
    if (typography.length > 0) {
        const fontFamilies = [...new Set(typography.map((t) => `${t.fontFamily} ${t.fontStyle}`))];
        const fontSizes = [...new Set(typography.map((t) => t.fontSize))].sort((a, b) => a - b);
        blocks.push({
            kind: "paragraph",
            text: `Observed in component: ${fontFamilies.join(", ")}. Size range: ${fontSizes[0]}px–${fontSizes[fontSizes.length - 1]}px.`,
        });
    }
    return {
        id: "type-hierarchy",
        title: "Type Hierarchy & Emphasis",
        content: blocks.length === 1 ? blocks[0] : { kind: "mixed", blocks },
    };
}
//# sourceMappingURL=type-hierarchy.js.map