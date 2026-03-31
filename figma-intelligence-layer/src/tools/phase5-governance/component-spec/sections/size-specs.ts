/**
 * Size Specifications section — size matrix from knowledge + extracted spacing
 */
import type { ExtractionResult, SpecSectionOutput, SpecSectionContent } from "../types.js";

export function buildSizeSpecsSection(data: ExtractionResult): SpecSectionOutput | null {
  const { knowledge, properties, spacing } = data;
  if (!knowledge || knowledge.sizeSpecifications.length === 0) return null;

  const blocks: SpecSectionContent[] = [];

  // Check if there's a size variant axis in the component
  const sizeAxis = properties.variantAxes.find(
    (a) => /^size$/i.test(a.name)
  );

  if (sizeAxis) {
    // Match knowledge size specs against detected size values
    const knowledgeLookup = new Map(
      knowledge.sizeSpecifications.map((s) => [s.size.toLowerCase(), s])
    );

    const rows: Record<string, string>[] = [];
    for (const sizeValue of sizeAxis.values) {
      const kEntry = knowledgeLookup.get(sizeValue.toLowerCase());
      // Try to find matching spacing entry
      const spacingMatch = spacing.find(
        (sp) => sp.element.toLowerCase().includes(sizeValue.toLowerCase())
      );

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
  } else {
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
