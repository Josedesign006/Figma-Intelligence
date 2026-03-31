/**
 * figma_component_spec — Unified component specification generator
 *
 * Replaces both figma_generate_spec and figma_component_doc with a single,
 * modular tool that follows the uSpec pattern: deterministic data extraction
 * from real Figma components + AI-structured output. Content is never fabricated.
 */

import { decisionLog } from "../../../shared/decision-log.js";

// ─── Extractors ─────────────────────────────────────────────────────────────
import { resolveTargetNodeId, captureSnapshot } from "./extractors/snapshot.js";
import { extractAnatomy } from "./extractors/anatomy.js";
import { extractProperties } from "./extractors/properties.js";
import { extractStates } from "./extractors/states.js";
import { extractSpacing } from "./extractors/spacing.js";
import { extractColorTokens } from "./extractors/color-tokens.js";
import { extractTypography } from "./extractors/typography.js";

// ─── Component Detection ────────────────────────────────────────────────────
import { detectComponentType } from "./component-detection.js";

// ─── Knowledge Base ────────────────────────────────────────────────────────
import { getComponentKnowledge } from "./knowledge/index.js";

// ─── Section Builders ───────────────────────────────────────────────────────
import { buildOverviewSection } from "./sections/overview.js";
import { buildAnatomySection } from "./sections/anatomy.js";
import { buildVariantsSection } from "./sections/variants.js";
import { buildStatesSection } from "./sections/states.js";
import { buildStateSpecsSection } from "./sections/state-specs.js";
import { buildPropertiesSection } from "./sections/properties-api.js";
import { buildSizeSpecsSection } from "./sections/size-specs.js";
import { buildSpacingSection } from "./sections/spacing-structure.js";
import { buildColorTokensSection } from "./sections/color-tokens.js";
import { buildDesignTokensSection } from "./sections/design-tokens.js";
import { buildTypographySection } from "./sections/typography.js";
import { buildTypeHierarchySection } from "./sections/type-hierarchy.js";
import { buildInteractionRulesSection } from "./sections/interaction-rules.js";
import { buildContentGuidanceSection } from "./sections/content-guidance.js";
import { buildResponsiveSection } from "./sections/responsive.js";
import { buildAccessibilitySection } from "./sections/accessibility.js";
import { buildQaCriteriaSection } from "./sections/qa-criteria.js";
import { buildUsageSection } from "./sections/usage-guidelines.js";
import { buildRelatedSection } from "./sections/related-components.js";

// ─── Renderers ──────────────────────────────────────────────────────────────
import { renderMarkdown } from "./renderers/markdown.js";
import { renderVisualDoc } from "./renderers/visual-doc.js";
import { renderJson } from "./renderers/json.js";

// ─── Types ──────────────────────────────────────────────────────────────────
import type {
  ComponentSpecArgs,
  ComponentSpecResult,
  ComponentSpec,
  ExtractionResult,
  SpecSectionOutput,
  SpecSection,
  ALL_SECTIONS as AllSectionsType,
} from "./types.js";
import { ALL_SECTIONS } from "./types.js";

// ─── Re-exports for apg-doc compatibility ───────────────────────────────────
export { resolveTargetNodeId, captureSnapshot } from "./extractors/snapshot.js";
export { createDocumentationPages, formatDocumentReport } from "./legacy-compat.js";
export type {
  NodeSnapshot,
  SnapshotNode,
  GeneratedDocumentSection,
  GeneratedDocument,
} from "./types.js";

// ─── Section builder map ────────────────────────────────────────────────────

type SectionBuilder = (data: ExtractionResult) => SpecSectionOutput | null;

const SECTION_BUILDERS: Record<SpecSection, SectionBuilder> = {
  overview: buildOverviewSection,
  anatomy: buildAnatomySection,
  variants: buildVariantsSection,
  states: buildStatesSection,
  "state-specs": buildStateSpecsSection,
  properties: buildPropertiesSection,
  "size-specs": buildSizeSpecsSection,
  spacing: buildSpacingSection,
  "color-tokens": buildColorTokensSection,
  "design-tokens": buildDesignTokensSection,
  typography: buildTypographySection,
  "type-hierarchy": buildTypeHierarchySection,
  "interaction-rules": buildInteractionRulesSection,
  "content-guidance": buildContentGuidanceSection,
  responsive: buildResponsiveSection,
  accessibility: buildAccessibilitySection,
  "qa-criteria": buildQaCriteriaSection,
  usage: buildUsageSection,
  related: buildRelatedSection,
};

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function componentSpecHandler(args: ComponentSpecArgs): Promise<ComponentSpecResult> {
  // 1. Resolve target node
  const nodeId = await resolveTargetNodeId(args);

  // 2. Capture base snapshot
  let snapshot;
  try {
    snapshot = await captureSnapshot(nodeId);
  } catch (err) {
    throw new Error(
      `figma_component_spec: Could not read component data. Ensure Figma is open with the bridge plugin running. ` +
      `Original error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 3. Detect component type and load knowledge
  const { type: componentType, guidance: typeGuidance } = detectComponentType(snapshot);
  const knowledge = getComponentKnowledge(componentType);

  // 4. Run all extractions — use allSettled so one failure doesn't crash the rest
  const settled = await Promise.allSettled([
    extractAnatomy(nodeId),
    extractSpacing(nodeId),
    extractColorTokens(nodeId),
    extractTypography(nodeId),
  ]);

  const anatomyResult = settled[0].status === "fulfilled" ? settled[0].value : { elements: [] };
  const spacingResult = settled[1].status === "fulfilled" ? settled[1].value : [];
  const colorTokensResult = settled[2].status === "fulfilled" ? settled[2].value : [];
  const typographyResult = settled[3].status === "fulfilled" ? settled[3].value : [];

  const propertiesResult = extractProperties(snapshot);
  const statesResult = extractStates(snapshot);

  // 5. Assemble extraction result
  const extraction: ExtractionResult = {
    snapshot,
    anatomy: anatomyResult,
    properties: propertiesResult,
    states: statesResult,
    spacing: spacingResult,
    colorTokens: colorTokensResult,
    typography: typographyResult,
    componentType,
    typeGuidance,
    knowledge,
  };

  // 6. Build requested sections
  const requestedSections = args.sections || ALL_SECTIONS;
  const sections: SpecSectionOutput[] = [];

  for (const sectionId of requestedSections) {
    const builder = SECTION_BUILDERS[sectionId];
    if (!builder) continue;
    const result = builder(extraction);
    if (result) sections.push(result);
  }

  // 7. Assemble spec
  const spec: ComponentSpec = {
    componentName: snapshot.name,
    description: knowledge.description,
    nodeId: snapshot.id,
    nodeType: snapshot.type,
    componentType,
    sections,
    extraction,
  };

  // 8. Render outputs
  let markdown: string | undefined;
  let figmaPageId: string | undefined;
  const warnings: string[] = [];

  if (args.outputFormat === "markdown" || args.outputFormat === "all") {
    markdown = renderMarkdown(spec);
  }

  if (args.outputFormat === "figma-page" || args.outputFormat === "all") {
    try {
      figmaPageId = await renderVisualDoc(spec, args.pageName);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      warnings.push(`Figma page rendering failed: ${errMsg}`);
      // Still return markdown so the user gets something useful
      if (!markdown) {
        markdown = renderMarkdown(spec);
      }
    }
  }

  // 9. Log decision
  const logEntry = await decisionLog.log({
    tool: "figma_component_spec",
    nodeIds: figmaPageId ? [snapshot.id, figmaPageId] : [snapshot.id],
    rationale: `Generated component spec for ${snapshot.name} (${snapshot.type}). Type: ${componentType || "unknown"}. Sections: ${sections.length}. Variants: ${propertiesResult.variantAxes.length}. States: ${statesResult.states.length}.${warnings.length > 0 ? ` Warnings: ${warnings.join("; ")}` : ""}`,
    tokens: snapshot.tokenAliases,
    reversible: true,
    metadata: {
      outputFormat: args.outputFormat,
      componentType,
      sectionCount: sections.length,
      variantAxisCount: propertiesResult.variantAxes.length,
      stateCount: statesResult.states.length,
    },
  });

  // Transform spec to structured JSON format for output
  const jsonSpec = renderJson(spec) as ComponentSpec & { component: string; description: string; sections: Record<string, unknown> };

  return {
    spec: jsonSpec,
    markdown,
    figmaPageId,
    logEntryId: logEntry.id,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
