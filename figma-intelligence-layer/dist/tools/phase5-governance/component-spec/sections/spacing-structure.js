"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSpacingSection = buildSpacingSection;
function buildSpacingSection(data) {
    const { spacing, snapshot } = data;
    const blocks = [];
    // Root component structure
    blocks.push({
        kind: "key-value",
        entries: [
            { label: "Root layout", value: snapshot.layoutMode === "NONE" ? "Absolute (no auto layout)" : `${snapshot.layoutMode} auto layout` },
            { label: "Dimensions", value: `${Math.round(snapshot.width)} × ${Math.round(snapshot.height)} px` },
            { label: "Padding", value: `${snapshot.paddingTop} / ${snapshot.paddingRight} / ${snapshot.paddingBottom} / ${snapshot.paddingLeft} (T/R/B/L)` },
            { label: "Item spacing", value: `${snapshot.itemSpacing}px` },
        ],
    });
    // Child spacing table
    if (spacing.length > 0) {
        blocks.push({
            kind: "table",
            headers: ["Element", "Layout", "W × H", "Padding (T/R/B/L)", "Gap", "Sizing (H/V)"],
            rows: spacing.slice(0, 20).map((entry) => [
                entry.element,
                entry.layoutMode,
                `${entry.width} × ${entry.height}`,
                `${entry.paddingTop}/${entry.paddingRight}/${entry.paddingBottom}/${entry.paddingLeft}`,
                `${entry.itemSpacing}px`,
                `${entry.layoutSizingH} / ${entry.layoutSizingV}`,
            ]),
        });
    }
    // Layout guidance
    if (snapshot.layoutMode === "NONE") {
        blocks.push({
            kind: "paragraph",
            text: "This component uses absolute positioning instead of auto layout. Consider converting to auto layout for responsive behavior, consistent spacing, and easier maintenance.",
        });
    }
    // Knowledge-based structure rules
    if (data.knowledge?.structureRules && data.knowledge.structureRules.length > 0) {
        blocks.push({
            kind: "rules",
            items: data.knowledge.structureRules,
        });
    }
    return {
        id: "spacing",
        title: "Structure & Layout",
        content: blocks.length === 1 ? blocks[0] : { kind: "mixed", blocks },
    };
}
//# sourceMappingURL=spacing-structure.js.map