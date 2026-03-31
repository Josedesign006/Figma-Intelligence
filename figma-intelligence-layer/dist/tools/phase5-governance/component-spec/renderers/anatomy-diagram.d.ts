/**
 * Anatomy Diagram renderer — creates visual markers (A, B, C…)
 * around a cloned component instance with connector lines and a legend.
 *
 * Includes ALL visible elements (content, optional, sub-component, structural)
 * except truly decorative spacers. Deep-scanned elements are positioned using
 * absolute coordinates relative to the component bounds.
 */
import type { AnatomyExtraction, ClassifiedElement } from "../types.js";
interface MarkerData {
    letter: string;
    markerX: number;
    markerY: number;
    targetX: number;
    targetY: number;
    name: string;
    role: string;
}
/**
 * Compute marker positions around the component.
 * Uses the element's center to determine which edge to place the marker on.
 * Distributes markers evenly along each edge to avoid overlapping.
 */
export declare function computeMarkerPositions(compW: number, compH: number, cloneOffsetX: number, cloneOffsetY: number, elements: ClassifiedElement[]): MarkerData[];
interface FigmaBridge {
    execute(code: string): Promise<{
        success: boolean;
        result?: unknown;
        error?: string;
    }>;
}
export declare function renderAnatomyDiagram(bridge: FigmaBridge, pageId: string, nodeId: string, anatomy: AnatomyExtraction, yPosition: number): Promise<void>;
export {};
//# sourceMappingURL=anatomy-diagram.d.ts.map