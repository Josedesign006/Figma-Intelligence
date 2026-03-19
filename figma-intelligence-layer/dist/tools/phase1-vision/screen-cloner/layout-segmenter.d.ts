import { VisionClient } from "../../../shared/vision-client.js";
import { LayoutZone } from "../../../shared/types.js";
/**
 * Segment a screenshot into layout zones using the Vision AI.
 * Returns an array of identified zones with bounding boxes.
 */
export declare function segmentLayout(image: string, vision: VisionClient): Promise<LayoutZone[]>;
//# sourceMappingURL=layout-segmenter.d.ts.map