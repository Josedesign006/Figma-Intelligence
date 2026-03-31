"use strict";
/**
 * figma_component_spec — Unified component specification generator
 *
 * Replaces both figma_generate_spec and figma_component_doc with a single,
 * modular tool that follows the uSpec pattern: deterministic data extraction
 * from real Figma components + AI-structured output. Content is never fabricated.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDocumentReport = exports.createDocumentationPages = exports.captureSnapshot = exports.resolveTargetNodeId = void 0;
exports.componentSpecHandler = componentSpecHandler;
const decision_log_js_1 = require("../../../shared/decision-log.js");
// ─── Extractors ─────────────────────────────────────────────────────────────
const snapshot_js_1 = require("./extractors/snapshot.js");
const anatomy_js_1 = require("./extractors/anatomy.js");
const properties_js_1 = require("./extractors/properties.js");
const states_js_1 = require("./extractors/states.js");
const spacing_js_1 = require("./extractors/spacing.js");
const color_tokens_js_1 = require("./extractors/color-tokens.js");
const typography_js_1 = require("./extractors/typography.js");
// ─── Component Detection ────────────────────────────────────────────────────
const component_detection_js_1 = require("./component-detection.js");
// ─── Knowledge Base ────────────────────────────────────────────────────────
const index_js_1 = require("./knowledge/index.js");
// ─── Section Builders ───────────────────────────────────────────────────────
const overview_js_1 = require("./sections/overview.js");
const anatomy_js_2 = require("./sections/anatomy.js");
const variants_js_1 = require("./sections/variants.js");
const states_js_2 = require("./sections/states.js");
const state_specs_js_1 = require("./sections/state-specs.js");
const properties_api_js_1 = require("./sections/properties-api.js");
const size_specs_js_1 = require("./sections/size-specs.js");
const spacing_structure_js_1 = require("./sections/spacing-structure.js");
const color_tokens_js_2 = require("./sections/color-tokens.js");
const design_tokens_js_1 = require("./sections/design-tokens.js");
const typography_js_2 = require("./sections/typography.js");
const type_hierarchy_js_1 = require("./sections/type-hierarchy.js");
const interaction_rules_js_1 = require("./sections/interaction-rules.js");
const content_guidance_js_1 = require("./sections/content-guidance.js");
const responsive_js_1 = require("./sections/responsive.js");
const accessibility_js_1 = require("./sections/accessibility.js");
const qa_criteria_js_1 = require("./sections/qa-criteria.js");
const usage_guidelines_js_1 = require("./sections/usage-guidelines.js");
const related_components_js_1 = require("./sections/related-components.js");
// ─── Renderers ──────────────────────────────────────────────────────────────
const markdown_js_1 = require("./renderers/markdown.js");
const visual_doc_js_1 = require("./renderers/visual-doc.js");
const json_js_1 = require("./renderers/json.js");
const types_js_1 = require("./types.js");
// ─── Re-exports for apg-doc compatibility ───────────────────────────────────
var snapshot_js_2 = require("./extractors/snapshot.js");
Object.defineProperty(exports, "resolveTargetNodeId", { enumerable: true, get: function () { return snapshot_js_2.resolveTargetNodeId; } });
Object.defineProperty(exports, "captureSnapshot", { enumerable: true, get: function () { return snapshot_js_2.captureSnapshot; } });
var legacy_compat_js_1 = require("./legacy-compat.js");
Object.defineProperty(exports, "createDocumentationPages", { enumerable: true, get: function () { return legacy_compat_js_1.createDocumentationPages; } });
Object.defineProperty(exports, "formatDocumentReport", { enumerable: true, get: function () { return legacy_compat_js_1.formatDocumentReport; } });
const SECTION_BUILDERS = {
    overview: overview_js_1.buildOverviewSection,
    anatomy: anatomy_js_2.buildAnatomySection,
    variants: variants_js_1.buildVariantsSection,
    states: states_js_2.buildStatesSection,
    "state-specs": state_specs_js_1.buildStateSpecsSection,
    properties: properties_api_js_1.buildPropertiesSection,
    "size-specs": size_specs_js_1.buildSizeSpecsSection,
    spacing: spacing_structure_js_1.buildSpacingSection,
    "color-tokens": color_tokens_js_2.buildColorTokensSection,
    "design-tokens": design_tokens_js_1.buildDesignTokensSection,
    typography: typography_js_2.buildTypographySection,
    "type-hierarchy": type_hierarchy_js_1.buildTypeHierarchySection,
    "interaction-rules": interaction_rules_js_1.buildInteractionRulesSection,
    "content-guidance": content_guidance_js_1.buildContentGuidanceSection,
    responsive: responsive_js_1.buildResponsiveSection,
    accessibility: accessibility_js_1.buildAccessibilitySection,
    "qa-criteria": qa_criteria_js_1.buildQaCriteriaSection,
    usage: usage_guidelines_js_1.buildUsageSection,
    related: related_components_js_1.buildRelatedSection,
};
// ─── Main Handler ───────────────────────────────────────────────────────────
async function componentSpecHandler(args) {
    // 1. Resolve target node
    const nodeId = await (0, snapshot_js_1.resolveTargetNodeId)(args);
    // 2. Capture base snapshot
    let snapshot;
    try {
        snapshot = await (0, snapshot_js_1.captureSnapshot)(nodeId);
    }
    catch (err) {
        throw new Error(`figma_component_spec: Could not read component data. Ensure Figma is open with the bridge plugin running. ` +
            `Original error: ${err instanceof Error ? err.message : String(err)}`);
    }
    // 3. Detect component type and load knowledge
    const { type: componentType, guidance: typeGuidance } = (0, component_detection_js_1.detectComponentType)(snapshot);
    const knowledge = (0, index_js_1.getComponentKnowledge)(componentType);
    // 4. Run all extractions — use allSettled so one failure doesn't crash the rest
    const settled = await Promise.allSettled([
        (0, anatomy_js_1.extractAnatomy)(nodeId),
        (0, spacing_js_1.extractSpacing)(nodeId),
        (0, color_tokens_js_1.extractColorTokens)(nodeId),
        (0, typography_js_1.extractTypography)(nodeId),
    ]);
    const anatomyResult = settled[0].status === "fulfilled" ? settled[0].value : { elements: [] };
    const spacingResult = settled[1].status === "fulfilled" ? settled[1].value : [];
    const colorTokensResult = settled[2].status === "fulfilled" ? settled[2].value : [];
    const typographyResult = settled[3].status === "fulfilled" ? settled[3].value : [];
    const propertiesResult = (0, properties_js_1.extractProperties)(snapshot);
    const statesResult = (0, states_js_1.extractStates)(snapshot);
    // 5. Assemble extraction result
    const extraction = {
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
    const requestedSections = args.sections || types_js_1.ALL_SECTIONS;
    const sections = [];
    for (const sectionId of requestedSections) {
        const builder = SECTION_BUILDERS[sectionId];
        if (!builder)
            continue;
        const result = builder(extraction);
        if (result)
            sections.push(result);
    }
    // 7. Assemble spec
    const spec = {
        componentName: snapshot.name,
        description: knowledge.description,
        nodeId: snapshot.id,
        nodeType: snapshot.type,
        componentType,
        sections,
        extraction,
    };
    // 8. Render outputs
    let markdown;
    let figmaPageId;
    const warnings = [];
    if (args.outputFormat === "markdown" || args.outputFormat === "all") {
        markdown = (0, markdown_js_1.renderMarkdown)(spec);
    }
    if (args.outputFormat === "figma-page" || args.outputFormat === "all") {
        try {
            figmaPageId = await (0, visual_doc_js_1.renderVisualDoc)(spec, args.pageName);
        }
        catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            warnings.push(`Figma page rendering failed: ${errMsg}`);
            // Still return markdown so the user gets something useful
            if (!markdown) {
                markdown = (0, markdown_js_1.renderMarkdown)(spec);
            }
        }
    }
    // 9. Log decision
    const logEntry = await decision_log_js_1.decisionLog.log({
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
    const jsonSpec = (0, json_js_1.renderJson)(spec);
    return {
        spec: jsonSpec,
        markdown,
        figmaPageId,
        logEntryId: logEntry.id,
        warnings: warnings.length > 0 ? warnings : undefined,
    };
}
//# sourceMappingURL=index.js.map