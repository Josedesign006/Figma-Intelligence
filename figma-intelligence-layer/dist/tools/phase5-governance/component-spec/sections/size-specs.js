"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSizeSpecsSection = buildSizeSpecsSection;
function buildSizeSpecsSection(data) {
    const { knowledge, properties, spacing } = data;
    if (!knowledge || knowledge.sizeSpecifications.length === 0)
        return null;
    const blocks = [];
    // Check if there's a size variant axis in the component
    const sizeAxis = properties.variantAxes.find((a) => /^size$/i.test(a.name));
    if (sizeAxis) {
        // Match knowledge size specs against detected size values
        const knowledgeLookup = new Map(knowledge.sizeSpecifications.map((s) => [s.size.toLowerCase(), s]));
        const rows = [];
        for (const sizeValue of sizeAxis.values) {
            const kEntry = knowledgeLookup.get(sizeValue.toLowerCase());
            // Try to find matching spacing entry
            const spacingMatch = spacing.find((sp) => sp.element.toLowerCase().includes(sizeValue.toLowerCase()));
            rows.push({
                size: sizeValue,
                height: spacingMatch ? `${spacingMatch.height}px` : (kEntry?.height ?? "—"),
                paddingLR: spacingMatch
                    ? `${spacingMatch.paddingLeft}/${spacingMatch.paddingRight}px`
                    : (kEntry?.paddingLR ?? "—"),
                fontSize: kEntry?.fontSize ?? "—",
                iconSize: kEntry?.iconSize ?? "—",
                borderRadius: kEntry?.borderRadius ?? "—",
            });
        }
        blocks.push({
            kind: "structured-data",
            columns: ["size", "height", "paddingLR", "fontSize", "iconSize", "borderRadius"],
            rows,
        });
    }
    else {
        // No size axis — output knowledge as reference specification
        blocks.push({
            kind: "structured-data",
            columns: ["size", "height", "paddingLR", "fontSize", "iconSize", "borderRadius"],
            rows: knowledge.sizeSpecifications,
        });
        blocks.push({
            kind: "paragraph",
            text: "No size variant axis detected. The values above are the recommended size specifications for this component type.",
        });
    }
    return {
        id: "size-specs",
        title: "Size Specifications",
        content: blocks.length === 1 ? blocks[0] : { kind: "mixed", blocks },
    };
}
//# sourceMappingURL=size-specs.js.map