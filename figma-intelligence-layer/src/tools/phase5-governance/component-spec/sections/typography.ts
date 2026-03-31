/**
 * Typography section — text style specifications with guidance
 */
import type { ExtractionResult, SpecSectionOutput, SpecSectionContent } from "../types.js";

export function buildTypographySection(data: ExtractionResult): SpecSectionOutput {
  const { typography, snapshot } = data;
  const blocks: SpecSectionContent[] = [];

  if (typography.length > 0) {
    blocks.push({
      kind: "table",
      headers: ["Element", "Content", "Font", "Size", "Line Height", "Token"],
      rows: typography.map((entry) => [
        entry.element,
        entry.characters.length > 40 ? entry.characters.slice(0, 37) + "…" : entry.characters || "—",
        `${entry.fontFamily} ${entry.fontStyle}`,
        `${entry.fontSize}px`,
        entry.lineHeightPx ? `${Math.round(entry.lineHeightPx)}px` : "Auto",
        entry.tokenName || "—",
      ]),
    });

    // Font summary
    const fonts = [...new Set(typography.map((t) => `${t.fontFamily} ${t.fontStyle}`))];
    const sizes = [...new Set(typography.map((t) => t.fontSize))].sort((a, b) => a - b);
    blocks.push({
      kind: "paragraph",
      text: `Font families used: ${fonts.join(", ")}. Size range: ${sizes[0]}px–${sizes[sizes.length - 1]}px across ${typography.length} text layer(s).`,
    });
  } else if (snapshot.textLayers.length > 0) {
    // Use snapshot text layers as fallback
    blocks.push({
      kind: "table",
      headers: ["Layer", "Content", "Font", "Size"],
      rows: snapshot.textLayers.map((t) => [
        t.name,
        t.characters.length > 40 ? t.characters.slice(0, 37) + "…" : t.characters || "—",
        `${t.fontFamily} ${t.fontStyle}`,
        `${t.fontSize}px`,
      ]),
    });
  } else {
    blocks.push({
      kind: "paragraph",
      text: `No text layers detected in "${snapshot.name}". This component is either icon-only, purely structural, or all text is inside nested sub-components.`,
    });
  }

  return {
    id: "typography",
    title: "Typography",
    content: blocks.length === 1 ? blocks[0] : { kind: "mixed", blocks },
  };
}
