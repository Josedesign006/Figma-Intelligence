/**
 * Keyboard & Screen Reader Order — Handler
 * Orchestrates the analyzer and Figma page renderer to produce a complete
 * accessibility annotation page from a target Figma frame.
 */
export interface KeyboardSrOrderArgs {
    nodeId: string;
    pageName?: string;
}
export interface KeyboardSrOrderResult {
    pageId: string;
    tabOrderCount: number;
    readingOrderCount: number;
    warningCount: number;
    auditSummary: string;
}
export declare function keyboardSrOrderHandler(args: KeyboardSrOrderArgs): Promise<KeyboardSrOrderResult>;
//# sourceMappingURL=keyboard-sr-order-handler.d.ts.map