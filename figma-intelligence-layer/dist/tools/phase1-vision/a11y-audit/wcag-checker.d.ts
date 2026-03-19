import { FigmaNode, WCAGIssue, RGBA } from "../../../shared/types.js";
/** Minimum interactive touch target (WCAG 2.5.5). */
export declare const MIN_TOUCH_TARGET = 44;
export declare function extractSolidColor(node: FigmaNode): RGBA | null;
export declare function findParentBgColor(nodeId: string, allNodes: FigmaNode[]): RGBA | null;
export declare function checkTextContrast(textNode: FigmaNode, allNodes: FigmaNode[], wcagLevel: "A" | "AA" | "AAA"): WCAGIssue | null;
export declare function checkTouchTarget(node: FigmaNode): WCAGIssue | null;
export declare function checkFocusState(node: FigmaNode): WCAGIssue | null;
export declare function checkFixedHeightTextContainer(node: FigmaNode): WCAGIssue | null;
//# sourceMappingURL=wcag-checker.d.ts.map