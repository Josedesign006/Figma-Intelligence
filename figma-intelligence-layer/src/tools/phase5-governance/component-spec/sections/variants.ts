/**
 * Variants section — variant axes, boolean toggles, instance swaps, variant matrix
 */
import type { ExtractionResult, SpecSectionOutput, SpecSectionContent } from "../types.js";

export function buildVariantsSection(data: ExtractionResult): SpecSectionOutput | null {
  const { properties, snapshot } = data;
  const blocks: SpecSectionContent[] = [];

  // Variant axes table
  if (properties.variantAxes.length > 0) {
    blocks.push({
      kind: "table",
      headers: ["Axis", "Values", "Default", "Count"],
      rows: properties.variantAxes.map((axis) => [
        axis.name,
        axis.values.join(", "),
        axis.defaultValue || axis.values[0] || "—",
        String(axis.values.length),
      ]),
    });
  }

  // Boolean toggles
  if (properties.booleanToggles.length > 0) {
    blocks.push({
      kind: "table",
      headers: ["Toggle", "Default", "Controls Element"],
      rows: properties.booleanToggles.map((t) => [
        t.name,
        t.defaultValue ? "true" : "false",
        t.controlsElement || "—",
      ]),
    });
  }

  // Instance swaps
  if (properties.instanceSwaps.length > 0) {
    blocks.push({
      kind: "table",
      headers: ["Swap Slot", "Current Component"],
      rows: properties.instanceSwaps.map((s) => [s.name, s.currentComponentName || "—"]),
    });
  }

  // Variant combination summary
  if (properties.variantAxes.length > 0) {
    const totalCombinations = properties.variantAxes.reduce((acc, a) => acc * a.values.length, 1);
    const boolMultiplier = properties.booleanToggles.length > 0 ? Math.pow(2, properties.booleanToggles.length) : 1;
    blocks.push({
      kind: "paragraph",
      text: `Total possible configurations: ${totalCombinations * boolMultiplier} (${properties.variantAxes.length} variant axes × ${properties.booleanToggles.length} boolean toggles). Defined variants in file: ${snapshot.variants.length}.`,
    });
  }

  // Variant list (first few names)
  if (snapshot.variants.length > 0 && snapshot.variants.length <= 20) {
    blocks.push({
      kind: "list",
      items: snapshot.variants.map((v) => v.name),
    });
  } else if (snapshot.variants.length > 20) {
    const items = snapshot.variants.slice(0, 15).map((v) => v.name);
    items.push(`... and ${snapshot.variants.length - 15} more variants`);
    blocks.push({ kind: "list", items });
  }

  if (blocks.length === 0) {
    // Always produce content
    blocks.push({
      kind: "paragraph",
      text: "This component has no variant axes, boolean toggles, or instance swap slots defined. It is a single-configuration component. Consider adding variant properties (e.g., Size, State, Style) if this component needs multiple configurations for different use cases.",
    });
  }

  return {
    id: "variants",
    title: "Variants",
    content: blocks.length === 1 ? blocks[0] : { kind: "mixed", blocks },
  };
}
