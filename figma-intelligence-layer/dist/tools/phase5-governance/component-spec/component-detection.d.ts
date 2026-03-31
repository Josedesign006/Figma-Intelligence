/**
 * Component type detection — identifies component type and returns guidance hints
 * Guidance hints tell extractors what to look for, NOT content to output verbatim.
 */
import type { NodeSnapshot, ComponentTypeGuidance } from "./types.js";
export declare function detectComponentType(snapshot: NodeSnapshot): {
    type?: string;
    guidance?: ComponentTypeGuidance;
};
//# sourceMappingURL=component-detection.d.ts.map