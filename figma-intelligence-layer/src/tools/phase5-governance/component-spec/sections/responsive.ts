/**
 * Responsive Behaviour section — breakpoint behaviors from knowledge
 */
import type { ExtractionResult, SpecSectionOutput } from "../types.js";

export function buildResponsiveSection(data: ExtractionResult): SpecSectionOutput | null {
  const { knowledge } = data;
  if (!knowledge || knowledge.responsiveBehaviour.length === 0) return null;

  return {
    id: "responsive",
    title: "Responsive Behaviour",
    content: {
      kind: "structured-data",
      columns: ["breakpoint", "behavior"],
      rows: knowledge.responsiveBehaviour,
    },
  };
}
