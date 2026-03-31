/**
 * Content Guidance section — writing and content rules from knowledge
 */
import type { ExtractionResult, SpecSectionOutput } from "../types.js";

export function buildContentGuidanceSection(data: ExtractionResult): SpecSectionOutput | null {
  const { knowledge } = data;
  if (!knowledge || knowledge.contentGuidance.length === 0) return null;

  return {
    id: "content-guidance",
    title: "Content Guidance",
    content: {
      kind: "rules",
      items: knowledge.contentGuidance,
    },
  };
}
