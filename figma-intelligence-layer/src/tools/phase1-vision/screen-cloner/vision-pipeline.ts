// ─────────────────────────────────────────────────────────────────────────────
// Vision Pipeline
// Orchestrates the multi-pass vision analysis for the screen cloner:
//   Pass 1 → Layout segmentation (layout-segmenter)
//   Pass 2 → Component identification per zone (component-recognizer)
//   Token inference → snap raw px values to design tokens (token-inferencer)
//   DS matching → fuzzy-match zones to real DS components (ds-matcher)
// ─────────────────────────────────────────────────────────────────────────────

import { VisionClient } from "../../../shared/vision-client.js";
import { LayoutZone, ComponentManifest, ComponentSet } from "../../../shared/types.js";
import { segmentLayout } from "./layout-segmenter.js";
import { recognizeComponent } from "./component-recognizer.js";
import { inferTokens, InferredTokens } from "./token-inferencer.js";
import { matchToDesignSystem, DSMatchResult } from "./ds-matcher.js";

export interface VisionPipelineResult {
  zones: LayoutZone[];
  manifests: ComponentManifest[];
  tokenInferences: InferredTokens[];
  dsMatches: DSMatchResult[];
}

/**
 * Runs the full multi-pass vision pipeline on a single image.
 *
 * @param image     base64 image string
 * @param vision    shared VisionClient instance
 * @param dsSets    available design system component sets for matching
 * @param cloneMode controls confidence threshold strictness
 */
export async function runVisionPipeline(
  image: string,
  vision: VisionClient,
  dsSets: ComponentSet[],
  cloneMode: "pixel" | "system" | "adaptive"
): Promise<VisionPipelineResult> {
  // Pass 1 — Layout decomposition
  const zones = await segmentLayout(image, vision);

  // Pass 2 — Component recognition per zone
  const manifests = await Promise.all(
    zones.map((zone) => recognizeComponent(zone.zoneImage ?? image, vision))
  );

  // Token inference (spacing, color, radius, font-size snap)
  const tokenInferences = manifests.map((m) => inferTokens(m));

  // DS matching
  const confidenceThreshold =
    cloneMode === "pixel" ? 0.5 : cloneMode === "system" ? 0.85 : 0.75;

  const dsMatches = manifests.map((m) =>
    matchToDesignSystem(m, dsSets, confidenceThreshold)
  );

  return { zones, manifests, tokenInferences, dsMatches };
}
