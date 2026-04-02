/**
 * Accessibility Annotation Renderer — Page-based
 * Creates a new Figma page matching the reference layout:
 *   1. Header: "Keyboard Focus Order" + subtitle + divider
 *   2. Left: Screenshot of the target frame with numbered circle markers
 *   3. Right: "Tab Order Sequence" table (# | Element | Role | ARIA/Notes)
 *            + "Implementation Notes" bullets
 *
 * Rendering is split into small bridge.execute steps for reliability.
 *
 * CRITICAL Figma Plugin API rules:
 *   1. fontName MUST be set BEFORE characters
 *   2. layoutSizingHorizontal = "FILL" only works AFTER appendChild()
 *   3. exportAsync returns Uint8Array; figma.createImage(bytes) makes ImageHash
 */
export interface MarkerDef {
    number: number;
    elementX: number;
    elementY: number;
    elementW: number;
    elementH: number;
}
export interface TabOrderRow {
    number: number;
    element: string;
    role: string;
    ariaNote: string;
}
export interface AnnotationPageOpts {
    sourceNodeId: string;
    frameName: string;
    markers: MarkerDef[];
    tableRows: TabOrderRow[];
    implNotes: string[];
    annotationType: string;
}
type Bridge = {
    execute(code: string): Promise<{
        success: boolean;
        result?: unknown;
        error?: string;
    }>;
};
export declare function renderAnnotationPage(bridge: Bridge, opts: AnnotationPageOpts): Promise<{
    pageId: string;
}>;
export {};
//# sourceMappingURL=a11y-annotate-renderer.d.ts.map