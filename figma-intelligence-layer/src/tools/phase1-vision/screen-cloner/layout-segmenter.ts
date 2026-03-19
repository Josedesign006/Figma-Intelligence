// ─────────────────────────────────────────────────────────────────────────────
// Layout Segmenter  (Vision Pass 1)
// Segments a screenshot into distinct UI layout zones using Claude Vision.
// ─────────────────────────────────────────────────────────────────────────────

import { VisionClient } from "../../../shared/vision-client.js";
import { LayoutZone } from "../../../shared/types.js";

/**
 * Segment a screenshot into layout zones using the Vision AI.
 * Returns an array of identified zones with bounding boxes.
 */
export async function segmentLayout(
  image: string,
  vision: VisionClient
): Promise<LayoutZone[]> {
  return vision.segment(image);
}
