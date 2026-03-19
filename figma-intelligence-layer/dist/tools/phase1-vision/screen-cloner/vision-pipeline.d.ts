import { VisionClient } from "../../../shared/vision-client.js";
import { LayoutZone, ComponentManifest, ComponentSet } from "../../../shared/types.js";
import { InferredTokens } from "./token-inferencer.js";
import { DSMatchResult } from "./ds-matcher.js";
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
export declare function runVisionPipeline(image: string, vision: VisionClient, dsSets: ComponentSet[], cloneMode: "pixel" | "system" | "adaptive"): Promise<VisionPipelineResult>;
//# sourceMappingURL=vision-pipeline.d.ts.map