/**
 * VPAT Figma Page Renderer
 * Renders a VPAT-style accessibility conformance report as a structured
 * Figma page with auto-layout tables, badges, and summary cards.
 *
 * IMPORTANT Figma Plugin API pattern:
 *   layoutSizingHorizontal = "FILL" only works AFTER the node is appended
 *   to an auto-layout parent. Always: appendChild() first, then set sizing.
 */
import type { VPATReport } from "./vpat-report.js";
type Bridge = {
    execute(code: string): Promise<{
        success: boolean;
        result?: unknown;
        error?: string;
    }>;
};
export declare function renderVPATPage(bridge: Bridge, report: VPATReport): Promise<{
    pageId: string;
}>;
export {};
//# sourceMappingURL=vpat-figma-page.d.ts.map