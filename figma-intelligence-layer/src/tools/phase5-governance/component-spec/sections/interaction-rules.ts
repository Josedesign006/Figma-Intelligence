/**
 * Interaction Rules section — event/trigger/action from knowledge
 */
import type { ExtractionResult, SpecSectionOutput } from "../types.js";

export function buildInteractionRulesSection(data: ExtractionResult): SpecSectionOutput | null {
  const { knowledge } = data;
  if (!knowledge || knowledge.interactionRules.length === 0) return null;

  return {
    id: "interaction-rules",
    title: "Interaction Rules",
    content: {
      kind: "structured-data",
      columns: ["event", "trigger", "action"],
      rows: knowledge.interactionRules,
    },
  };
}
