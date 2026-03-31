"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDesignTokensSection = buildDesignTokensSection;
function buildDesignTokensSection(data) {
    const { colorTokens, knowledge } = data;
    if (!knowledge)
        return null;
    if (knowledge.designTokenBindings.length === 0 && colorTokens.length === 0)
        return null;
    const blocks = [];
    // Start with extracted color tokens mapped to structured format
    const extractedRows = colorTokens
        .filter((ct) => ct.tokenName || ct.colorHex)
        .map((ct) => ({
        property: `${ct.element} (${ct.property})`,
        tokenName: ct.tokenName || "hardcoded",
        role: ct.property === "fill" ? "Fill color" : "Stroke color",
        fallback: ct.colorHex,
    }));
    // Merge knowledge token bindings that aren't already covered by extracted data
    const coveredProperties = new Set(extractedRows.map((r) => r.property.toLowerCase()));
    const knowledgeRows = knowledge.designTokenBindings.filter((kb) => !coveredProperties.has(kb.property.toLowerCase()));
    const allRows = [...extractedRows, ...knowledgeRows];
    if (allRows.length > 0) {
        blocks.push({
            kind: "structured-data",
            columns: ["property", "tokenName", "role", "fallback"],
            rows: allRows,
        });
        const boundCount = extractedRows.filter((r) => r.tokenName !== "hardcoded").length;
        const hardcodedCount = extractedRows.filter((r) => r.tokenName === "hardcoded").length;
        if (extractedRows.length > 0) {
            blocks.push({
                kind: "paragraph",
                text: `Token coverage: ${boundCount}/${extractedRows.length} extracted colors are bound to design tokens.${hardcodedCount > 0 ? ` ${hardcodedCount} hardcoded color(s) should be bound to tokens for theme support.` : " Fully theme-ready."}`,
            });
        }
    }
    return {
        id: "design-tokens",
        title: "Design Token Bindings",
        content: blocks.length === 1 ? blocks[0] : { kind: "mixed", blocks },
    };
}
//# sourceMappingURL=design-tokens.js.map