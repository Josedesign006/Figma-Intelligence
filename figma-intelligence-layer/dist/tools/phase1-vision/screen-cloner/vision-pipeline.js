"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Vision Pipeline
// Orchestrates the multi-pass vision analysis for the screen cloner:
//   Pass 1 → Layout segmentation (layout-segmenter)
//   Pass 2 → Component identification per zone (component-recognizer)
//   Token inference → snap raw px values to design tokens (token-inferencer)
//   DS matching → fuzzy-match zones to real DS components (ds-matcher)
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.runVisionPipeline = runVisionPipeline;
const layout_segmenter_js_1 = require("./layout-segmenter.js");
const component_recognizer_js_1 = require("./component-recognizer.js");
const token_inferencer_js_1 = require("./token-inferencer.js");
const ds_matcher_js_1 = require("./ds-matcher.js");
/**
 * Runs the full multi-pass vision pipeline on a single image.
 *
 * @param image     base64 image string
 * @param vision    shared VisionClient instance
 * @param dsSets    available design system component sets for matching
 * @param cloneMode controls confidence threshold strictness
 */
async function runVisionPipeline(image, vision, dsSets, cloneMode) {
    // Pass 1 — Layout decomposition
    const zones = await (0, layout_segmenter_js_1.segmentLayout)(image, vision);
    // Pass 2 — Component recognition per zone
    const manifests = await Promise.all(zones.map((zone) => (0, component_recognizer_js_1.recognizeComponent)(zone.zoneImage ?? image, vision)));
    // Token inference (spacing, color, radius, font-size snap)
    const tokenInferences = manifests.map((m) => (0, token_inferencer_js_1.inferTokens)(m));
    // DS matching
    const confidenceThreshold = cloneMode === "pixel" ? 0.5 : cloneMode === "system" ? 0.85 : 0.75;
    const dsMatches = manifests.map((m) => (0, ds_matcher_js_1.matchToDesignSystem)(m, dsSets, confidenceThreshold));
    return { zones, manifests, tokenInferences, dsMatches };
}
//# sourceMappingURL=vision-pipeline.js.map