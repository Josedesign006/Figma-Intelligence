"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Layout Segmenter  (Vision Pass 1)
// Segments a screenshot into distinct UI layout zones using Claude Vision.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.segmentLayout = segmentLayout;
/**
 * Segment a screenshot into layout zones using the Vision AI.
 * Returns an array of identified zones with bounding boxes.
 */
async function segmentLayout(image, vision) {
    return vision.segment(image);
}
//# sourceMappingURL=layout-segmenter.js.map