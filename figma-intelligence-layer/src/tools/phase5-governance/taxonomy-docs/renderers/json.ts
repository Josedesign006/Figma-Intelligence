/**
 * JSON renderer for taxonomy documentation.
 * Returns structured data for tooling integration.
 */

import { GRAMMAR } from "../../../../shared/concept-taxonomy.js";
import type { ConceptCoverage, TaxonomyDocsJsonOutput, TokenValueSnapshot } from "../index.js";

export function renderJson(
  coverage: ConceptCoverage[],
  snapshots: Record<string, TokenValueSnapshot>,
  totalExpected: number,
  totalFound: number,
): TaxonomyDocsJsonOutput {
  return {
    generatedAt: new Date().toISOString(),
    grammar: GRAMMAR,
    concepts: coverage,
    totalExpected,
    totalFound,
    totalMissing: totalExpected - totalFound,
    tokenValues: snapshots,
  };
}
