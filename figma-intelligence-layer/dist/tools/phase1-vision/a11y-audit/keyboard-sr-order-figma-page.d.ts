/**
 * Keyboard & Screen Reader Order — Figma Page Renderer
 * Renders the full accessibility annotation as an enterprise-quality Figma page
 * with auto-layout tables, callout boxes, and structured sections.
 *
 * IMPORTANT Figma Plugin API pattern:
 *   layoutSizingHorizontal = "FILL" only works AFTER the node is appended
 *   to an auto-layout parent. Always: appendChild() first, then set sizing.
 */
import type { A11yOrderAnalysis } from "./keyboard-sr-order-analyzer.js";
type Bridge = {
    execute(code: string): Promise<{
        success: boolean;
        result?: unknown;
        error?: string;
    }>;
};
export declare function renderKeyboardSrOrderPage(bridge: Bridge, analysis: A11yOrderAnalysis, customPageName?: string): Promise<{
    pageId: string;
}>;
export {};
//# sourceMappingURL=keyboard-sr-order-figma-page.d.ts.map