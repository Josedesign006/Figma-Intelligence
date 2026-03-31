/**
 * Color Tokens section — element-to-token mapping with theming guidance
 */
import type { ExtractionResult, SpecSectionOutput, SpecSectionContent } from "../types.js";

export function buildColorTokensSection(data: ExtractionResult): SpecSectionOutput {
  const { colorTokens, snapshot } = data;
  const blocks: SpecSectionContent[] = [];

  if (colorTokens.length > 0) {
    // Deduplicate
    const seen = new Set<string>();
    const unique = colorTokens.filter((entry) => {
      const key = `${entry.element}|${entry.property}|${entry.tokenName || entry.colorHex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    blocks.push({
      kind: "table",
      headers: ["Element", "Property", "Hex Value", "Token Name"],
      rows: unique.map((entry) => [
        entry.element,
        entry.property,
        entry.colorHex,
        entry.tokenName || "(hardcoded)",
      ]),
    });

    // Token coverage summary
    const withToken = unique.filter((e) => e.tokenName).length;
    const withoutToken = unique.length - withToken;
    blocks.push({
      kind: "paragraph",
      text: `Token coverage: ${withToken}/${unique.length} colors are bound to design tokens.${withoutToken > 0 ? ` ${withoutToken} color(s) are hardcoded and should be bound to tokens for theme support.` : " All colors use design tokens — fully theme-ready."}`,
    });
  } else {
    // No colors extracted — still provide guidance
    blocks.push({
      kind: "paragraph",
      text: `No color fills or strokes detected on "${snapshot.name}". This may mean: (1) colors are inherited from a parent component, (2) the component uses only structural/transparent fills, or (3) color bindings need to be set up. Ensure all visible colors are bound to design tokens for dark mode and theme support.`,
    });
  }

  // Token alias summary from snapshot
  if (snapshot.tokenAliases.length > 0) {
    blocks.push({
      kind: "paragraph",
      text: `Variable aliases detected: ${snapshot.tokenAliases.length}. These indicate the component references shared design variables for consistent theming.`,
    });
  }

  return {
    id: "color-tokens",
    title: "Color Tokens",
    content: blocks.length === 1 ? blocks[0] : { kind: "mixed", blocks },
  };
}
