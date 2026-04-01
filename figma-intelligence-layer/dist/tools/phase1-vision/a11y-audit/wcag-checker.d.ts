import { FigmaNode, WCAGIssue, RGBA } from "../../../shared/types.js";
/** Minimum interactive touch target (WCAG 2.5.5). */
export declare const MIN_TOUCH_TARGET = 44;
export declare function extractSolidColor(node: FigmaNode): RGBA | null;
export declare function findParentBgColor(nodeId: string, allNodes: FigmaNode[]): RGBA | null;
export declare function checkTextContrast(textNode: FigmaNode, allNodes: FigmaNode[], wcagLevel: "A" | "AA" | "AAA"): WCAGIssue | null;
export declare function checkTouchTarget(node: FigmaNode): WCAGIssue | null;
export declare function checkFocusState(node: FigmaNode): WCAGIssue | null;
export declare function checkFixedHeightTextContainer(node: FigmaNode): WCAGIssue | null;
/** WCAG 2.5.8 Target Size (Minimum) – 24×24px at Level AA. */
export declare const MIN_TARGET_SIZE_AA = 24;
export declare function checkTargetSizeMinimum(node: FigmaNode): WCAGIssue | null;
/** WCAG 1.1.1 Non-text Content – heuristic check for images without descriptions. */
export declare function checkNonTextContent(node: FigmaNode, allNodes: FigmaNode[]): WCAGIssue | null;
/** WCAG 1.3.1 Info and Relationships – heuristic heading hierarchy check. */
export declare function checkInfoAndRelationships(textNodes: FigmaNode[]): WCAGIssue[];
/** WCAG 1.3.2 Meaningful Sequence – heuristic reading order check. */
export declare function checkMeaningfulSequence(allNodes: FigmaNode[]): WCAGIssue[];
/** WCAG 1.4.1 Use of Color – heuristic check for colour-only state differentiation. */
export declare function checkUseOfColor(componentSetNodes: FigmaNode[]): WCAGIssue[];
/** WCAG 1.4.11 Non-text Contrast – check stroke/border contrast against background. */
export declare function checkNonTextContrast(node: FigmaNode, allNodes: FigmaNode[]): WCAGIssue | null;
/** WCAG 1.4.12 Text Spacing – check line-height, letter-spacing on text nodes. */
export declare function checkTextSpacing(textNode: FigmaNode): WCAGIssue | null;
/** WCAG 1.4.10 Reflow – heuristic check for responsive layout usage. */
export declare function checkReflow(frameNodes: FigmaNode[]): WCAGIssue[];
/** WCAG 1.4.5 / 1.4.9 Images of Text – detect rasterised text. */
export declare function checkImagesOfText(allNodes: FigmaNode[]): WCAGIssue[];
/** WCAG 1.4.13 Content on Hover or Focus – heuristic tooltip/hover pattern check. */
export declare function checkContentOnHover(componentSetNodes: FigmaNode[]): WCAGIssue[];
/** WCAG 2.4.3 Focus Order – heuristic check for tab order mismatches. */
export declare function checkFocusOrder(interactiveNodes: FigmaNode[]): WCAGIssue[];
export declare function checkLinkPurpose(interactiveNodes: FigmaNode[]): WCAGIssue[];
/** WCAG 2.4.6 Headings and Labels – check sections for heading presence. */
export declare function checkHeadingsAndLabels(frameNodes: FigmaNode[]): WCAGIssue[];
/** WCAG 2.4.11 Focus Not Obscured – check focus variants for overlapping elements. */
export declare function checkFocusNotObscured(componentSetNodes: FigmaNode[]): WCAGIssue[];
/** WCAG 3.3.1 Error Identification – check error state variants for descriptive text. */
export declare function checkErrorIdentification(componentSetNodes: FigmaNode[]): WCAGIssue[];
/** WCAG 3.3.2 Labels or Instructions – check form inputs for visible labels. */
export declare function checkLabelsOrInstructions(interactiveNodes: FigmaNode[], allNodes: FigmaNode[]): WCAGIssue[];
/** WCAG 4.1.2 Name, Role, Value – check interactive components for name/description. */
export declare function checkNameRoleValue(interactiveNodes: FigmaNode[]): WCAGIssue[];
/** WCAG 1.3.4 Orientation – check for portrait/landscape variant presence. */
export declare function checkOrientation(componentSetNodes: FigmaNode[]): WCAGIssue[];
/** WCAG 1.3.5 Identify Input Purpose – check input names for autocomplete hints. */
export declare function checkIdentifyInputPurpose(interactiveNodes: FigmaNode[]): WCAGIssue[];
//# sourceMappingURL=wcag-checker.d.ts.map