/**
 * Accessibility Annotation Handler
 * Analyzes a Figma frame and creates a new page with:
 *   1. A clone of the design with numbered circle markers on interactive elements
 *   2. A Tab Order Sequence table
 *   3. Implementation Notes
 *
 * Supports 7 annotation types: focus-order, reading-order, input,
 * landmark, heading, link, button.
 */
import { AnnotationTypeKey } from "./a11y-annotation-kit.js";
export interface A11yAnnotateArgs {
    nodeId: string;
    annotationType: AnnotationTypeKey | "all";
    showDetails?: boolean;
    showLasso?: boolean;
    placement?: "left" | "right" | "auto";
}
export interface A11yAnnotateResult {
    pageId: string;
    annotationCount: number;
    types: string[];
    summary: string;
}
export declare function a11yAnnotateHandler(args: A11yAnnotateArgs): Promise<A11yAnnotateResult>;
//# sourceMappingURL=a11y-annotate-handler.d.ts.map