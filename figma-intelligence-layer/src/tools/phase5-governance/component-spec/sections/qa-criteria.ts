/**
 * QA Acceptance Criteria section — test criteria from knowledge
 */
import type { ExtractionResult, SpecSectionOutput } from "../types.js";

export function buildQaCriteriaSection(data: ExtractionResult): SpecSectionOutput | null {
  const { knowledge } = data;
  if (!knowledge || knowledge.qaAcceptanceCriteria.length === 0) return null;

  return {
    id: "qa-criteria",
    title: "QA Acceptance Criteria",
    content: {
      kind: "structured-data",
      columns: ["check", "platform", "expectedResult"],
      rows: knowledge.qaAcceptanceCriteria,
    },
  };
}
