/**
 * State Specifications section — rich state descriptions merged from knowledge
 */
import type { ExtractionResult, SpecSectionOutput, SpecSectionContent } from "../types.js";

export function buildStateSpecsSection(data: ExtractionResult): SpecSectionOutput | null {
  const { states, knowledge } = data;
  if (!knowledge || knowledge.stateSpecifications.length === 0) return null;

  const blocks: SpecSectionContent[] = [];

  // Build a lookup from knowledge state entries
  const knowledgeLookup = new Map(
    knowledge.stateSpecifications.map((s) => [s.state.toLowerCase(), s])
  );

  // If we have detected Figma states, merge with knowledge
  if (states.states.length > 0) {
    const detectedNames = states.states.map((s) => s.name);
    const rows: Record<string, string>[] = [];

    for (const name of detectedNames) {
      const kEntry = knowledgeLookup.get(name.toLowerCase());
      rows.push({
        state: name,
        visualChange: kEntry?.visualChange ?? "See component definition",
        opacity: kEntry?.opacity ?? "100% (1.0)",
        cursorWeb: kEntry?.cursorWeb ?? "default",
        usage: kEntry?.usage ?? "",
      });
    }

    // Add knowledge-only states that were expected but not detected
    for (const kState of knowledge.stateSpecifications) {
      const alreadyIncluded = detectedNames.some(
        (n) => n.toLowerCase() === kState.state.toLowerCase()
      );
      if (!alreadyIncluded) {
        rows.push({
          state: `${kState.state} (expected)`,
          visualChange: kState.visualChange,
          opacity: kState.opacity,
          cursorWeb: kState.cursorWeb,
          usage: kState.usage,
        });
      }
    }

    blocks.push({
      kind: "structured-data",
      columns: ["state", "visualChange", "opacity", "cursorWeb", "usage"],
      rows,
    });
  } else {
    // No Figma states detected — output full knowledge as recommended spec
    blocks.push({
      kind: "structured-data",
      columns: ["state", "visualChange", "opacity", "cursorWeb", "usage"],
      rows: knowledge.stateSpecifications.map((s) => ({
        state: `${s.state} (recommended)`,
        visualChange: s.visualChange,
        opacity: s.opacity,
        cursorWeb: s.cursorWeb,
        usage: s.usage,
      })),
    });

    blocks.push({
      kind: "paragraph",
      text: "No explicit state variants detected in the Figma component. The states listed above are recommended for this component type.",
    });
  }

  return {
    id: "state-specs",
    title: "State Specifications",
    content: blocks.length === 1 ? blocks[0] : { kind: "mixed", blocks },
  };
}
