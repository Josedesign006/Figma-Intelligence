import { VisionClient } from "../../../shared/vision-client.js";
import { ComponentManifest } from "../../../shared/types.js";
/**
 * Run Vision Pass 2 on a single zone image to produce a ComponentManifest.
 */
export declare function recognizeComponent(zoneImage: string, vision: VisionClient): Promise<ComponentManifest>;
//# sourceMappingURL=component-recognizer.d.ts.map