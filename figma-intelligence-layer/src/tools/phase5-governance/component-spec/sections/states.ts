/**
 * States section — detected interaction states
 */
import type { ExtractionResult, SpecSectionOutput, SpecSectionContent } from "../types.js";

export function buildStatesSection(data: ExtractionResult): SpecSectionOutput {
  const { states, snapshot } = data;
  const blocks: SpecSectionContent[] = [];

  if (states.states.length > 0) {
    blocks.push({
      kind: "table",
      headers: ["State", "Source", "Axis / Property"],
      rows: states.states.map((s) => [s.name, s.source, s.axisName || "—"]),
    });
  }

  // Generate expected states based on component type
  const isInteractive = /button|btn|input|field|toggle|switch|checkbox|radio|tab|link|select|slider/i.test(snapshot.name);
  if (isInteractive) {
    const expectedStates = ["Default", "Hover", "Pressed", "Focused", "Disabled"];
    const detectedNames = states.states.map((s) => s.name.toLowerCase());
    const missing = expectedStates.filter((s) => !detectedNames.some((d) => d.includes(s.toLowerCase())));

    if (missing.length > 0 && states.states.length > 0) {
      blocks.push({
        kind: "paragraph",
        text: `Potentially missing states for an interactive component: ${missing.join(", ")}. Review whether these states are needed for this component.`,
      });
    }

    if (states.states.length === 0) {
      blocks.push({
        kind: "paragraph",
        text: `This appears to be an interactive component but no explicit state variants were detected. Expected states for interactive components include: ${expectedStates.join(", ")}. Consider adding a "State" variant axis to support these interaction states.`,
      });
    }
  } else if (states.states.length === 0) {
    blocks.push({
      kind: "paragraph",
      text: "No explicit interaction states detected. This component appears to be a static/presentational element. If it needs interaction states, add a variant axis named \"State\" with values like Default, Hover, Pressed, Focused, Disabled.",
    });
  }

  return {
    id: "states",
    title: "States",
    content: blocks.length === 1 ? blocks[0] : { kind: "mixed", blocks },
  };
}
