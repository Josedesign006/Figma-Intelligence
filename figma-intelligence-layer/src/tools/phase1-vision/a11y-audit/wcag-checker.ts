// ─────────────────────────────────────────────────────────────────────────────
// WCAG Checker
// Pure-function WCAG 2.2 compliance checks that operate on Figma node data.
// Used by the a11y-audit tool.
// ─────────────────────────────────────────────────────────────────────────────

import { FigmaNode, WCAGIssue, RGBA } from "../../../shared/types.js";
import {
  computeContrastRatio,
  figmaRgbaToHex,
  meetsWCAG,
} from "../../../shared/token-utils.js";

/** Minimum interactive touch target (WCAG 2.5.5). */
export const MIN_TOUCH_TARGET = 44;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function extractSolidColor(node: FigmaNode): RGBA | null {
  if (!node.fills || node.fills.length === 0) return null;
  const solid = node.fills.find((f) => f.type === "SOLID" && f.color);
  return solid?.color ?? null;
}

export function findParentBgColor(
  nodeId: string,
  allNodes: FigmaNode[]
): RGBA | null {
  function findParent(id: string, nodes: FigmaNode[]): FigmaNode | null {
    for (const n of nodes) {
      if (n.children?.some((c) => c.id === id)) return n;
      if (n.children) {
        const found = findParent(id, n.children);
        if (found) return found;
      }
    }
    return null;
  }

  let current = nodeId;
  for (let depth = 0; depth < 12; depth++) {
    const parent = findParent(current, allNodes);
    if (!parent) break;
    const color = extractSolidColor(parent);
    if (color) return color;
    current = parent.id;
  }
  return { r: 1, g: 1, b: 1, a: 1 };
}

// ─── Individual checks ───────────────────────────────────────────────────────

export function checkTextContrast(
  textNode: FigmaNode,
  allNodes: FigmaNode[],
  wcagLevel: "A" | "AA" | "AAA"
): WCAGIssue | null {
  const fgColor = extractSolidColor(textNode);
  if (!fgColor) return null;

  const bgColor = findParentBgColor(textNode.id, allNodes);
  if (!bgColor) return null;

  const fgHex = figmaRgbaToHex(fgColor.r, fgColor.g, fgColor.b);
  const bgHex = figmaRgbaToHex(bgColor.r, bgColor.g, bgColor.b);

  const fontSize = textNode.style?.fontSize ?? 16;
  const fontWeight = textNode.style?.fontWeight ?? 400;
  const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);

  const ratio = computeContrastRatio(fgHex, bgHex);
  const effectiveLevel: "AA" | "AAA" = wcagLevel === "AAA" ? "AAA" : "AA";
  const passes = meetsWCAG(ratio, effectiveLevel, isLargeText);

  if (passes) return null;

  const minRatio = isLargeText
    ? (effectiveLevel === "AAA" ? 4.5 : 3.0)
    : (effectiveLevel === "AAA" ? 7.0 : 4.5);

  return {
    severity: ratio < 3.0 ? "error" : "warning",
    criterion: wcagLevel === "AAA" ? "1.4.6" : "1.4.3",
    nodeId: textNode.id,
    nodeName: textNode.name,
    issue: `Contrast ratio ${ratio.toFixed(2)}:1 below ${effectiveLevel} threshold (${minRatio}:1) for ${isLargeText ? "large" : "normal"} text`,
    currentValue: `${ratio.toFixed(2)}:1`,
    suggestedFix: `Increase contrast to at least ${minRatio}:1`,
    autoFixAvailable: true,
  };
}

export function checkTouchTarget(node: FigmaNode): WCAGIssue | null {
  if (!node.absoluteBoundingBox) return null;
  const w = node.width ?? 0;
  const h = node.height ?? 0;

  if (w < MIN_TOUCH_TARGET || h < MIN_TOUCH_TARGET) {
    return {
      severity: "error",
      criterion: "2.5.5",
      nodeId: node.id,
      nodeName: node.name,
      issue: `Interactive element is ${w}×${h}px, below the minimum ${MIN_TOUCH_TARGET}×${MIN_TOUCH_TARGET}px touch target`,
      currentValue: `${w}×${h}px`,
      suggestedFix: `Resize to at least ${MIN_TOUCH_TARGET}×${MIN_TOUCH_TARGET}px`,
      autoFixAvailable: true,
    };
  }
  return null;
}

export function checkFocusState(node: FigmaNode): WCAGIssue | null {
  if (node.type !== "COMPONENT_SET") return null;
  const hasFocus =
    Object.values(node.variantProperties ?? {}).some(
      (v) => typeof v === "string" && v.toLowerCase().includes("focus")
    ) ||
    node.children?.some(
      (c) =>
        c.name.toLowerCase().includes("focus") ||
        Object.values(c.variantProperties ?? {}).some(
          (v) => typeof v === "string" && v.toLowerCase().includes("focus")
        )
    );

  if (!hasFocus) {
    return {
      severity: "warning",
      criterion: "2.4.7",
      nodeId: node.id,
      nodeName: node.name,
      issue: "Component set has no focus state variant",
      currentValue: "No focus variant",
      suggestedFix: 'Add a "State=Focus" variant with a visible 2px focus ring',
      autoFixAvailable: false,
    };
  }
  return null;
}

export function checkFixedHeightTextContainer(node: FigmaNode): WCAGIssue | null {
  if (!node.children) return null;
  const hasTextChild = node.children.some((c) => c.type === "TEXT");
  if (!hasTextChild) return null;

  const isFixedHeight =
    node.primaryAxisSizingMode === "FIXED" ||
    (node.height !== undefined && node.primaryAxisSizingMode !== "AUTO");

  if (isFixedHeight && node.layoutMode && node.layoutMode !== "NONE") {
    return {
      severity: "warning",
      criterion: "1.4.4",
      nodeId: node.id,
      nodeName: node.name,
      issue: "Text container has fixed height which may clip text on resize",
      currentValue: `height: ${node.height}px (fixed)`,
      suggestedFix: 'Set vertical sizing to "Hug contents" (AUTO)',
      autoFixAvailable: true,
    };
  }
  return null;
}

// ─── New checks for comprehensive VPAT coverage ─────────────────────────────

/** WCAG 2.5.8 Target Size (Minimum) – 24×24px at Level AA. */
export const MIN_TARGET_SIZE_AA = 24;

export function checkTargetSizeMinimum(node: FigmaNode): WCAGIssue | null {
  if (!node.absoluteBoundingBox) return null;
  const w = node.width ?? 0;
  const h = node.height ?? 0;

  if (w < MIN_TARGET_SIZE_AA || h < MIN_TARGET_SIZE_AA) {
    return {
      severity: "error",
      criterion: "2.5.8",
      nodeId: node.id,
      nodeName: node.name,
      issue: `Interactive element is ${w}×${h}px, below the minimum ${MIN_TARGET_SIZE_AA}×${MIN_TARGET_SIZE_AA}px target size`,
      currentValue: `${w}×${h}px`,
      suggestedFix: `Resize to at least ${MIN_TARGET_SIZE_AA}×${MIN_TARGET_SIZE_AA}px`,
      autoFixAvailable: true,
    };
  }
  return null;
}

/** WCAG 1.1.1 Non-text Content – heuristic check for images without descriptions. */
export function checkNonTextContent(
  node: FigmaNode,
  allNodes: FigmaNode[]
): WCAGIssue | null {
  // Check IMAGE fill nodes and VECTOR nodes
  const isImage =
    node.fills?.some((f) => f.type === "IMAGE") ||
    node.type === "VECTOR" ||
    node.type === "BOOLEAN_OPERATION";
  if (!isImage) return null;

  // Skip decorative-sounding nodes
  const name = node.name.toLowerCase();
  if (name.includes("decorative") || name.includes("divider") || name.includes("separator")) {
    return null;
  }

  // Check if node has a description
  if (node.description && node.description.trim().length > 0) return null;

  // Check if a sibling TEXT node acts as a label
  const parent = findParentNode(node.id, allNodes);
  if (parent?.children) {
    const hasSiblingLabel = parent.children.some(
      (c) => c.type === "TEXT" && c.id !== node.id
    );
    if (hasSiblingLabel) return null;
  }

  return {
    severity: "warning",
    criterion: "1.1.1",
    nodeId: node.id,
    nodeName: node.name,
    issue: "Non-text content has no description or adjacent text label",
    currentValue: "No alt text / description",
    suggestedFix: "Add a description property or provide an adjacent text label. Mark decorative images by including 'decorative' in the name.",
    autoFixAvailable: false,
  };
}

/** WCAG 1.3.1 Info and Relationships – heuristic heading hierarchy check. */
export function checkInfoAndRelationships(
  textNodes: FigmaNode[]
): WCAGIssue[] {
  const issues: WCAGIssue[] = [];

  // Identify heading-like text (large or bold)
  const headings = textNodes.filter((n) => {
    const fontSize = n.style?.fontSize ?? 16;
    const fontWeight = n.style?.fontWeight ?? 400;
    return fontSize >= 20 || fontWeight >= 700;
  });

  // Sort headings by visual position (top to bottom)
  headings.sort((a, b) => {
    const ay = a.absoluteBoundingBox?.y ?? 0;
    const by = b.absoluteBoundingBox?.y ?? 0;
    return ay - by;
  });

  // Check for logical hierarchy (font sizes should decrease or stay same going down)
  let prevFontSize = Infinity;
  for (const heading of headings) {
    const fontSize = heading.style?.fontSize ?? 16;
    if (fontSize > prevFontSize) {
      issues.push({
        severity: "warning",
        criterion: "1.3.1",
        nodeId: heading.id,
        nodeName: heading.name,
        issue: `Heading text (${fontSize}px) appears after smaller heading (${prevFontSize}px), suggesting inconsistent heading hierarchy`,
        currentValue: `${fontSize}px after ${prevFontSize}px`,
        suggestedFix: "Ensure headings follow a logical hierarchy (h1 > h2 > h3). Larger text should not appear after smaller headings.",
        autoFixAvailable: false,
      });
    }
    prevFontSize = fontSize;
  }

  return issues;
}

/** WCAG 1.3.2 Meaningful Sequence – heuristic reading order check. */
export function checkMeaningfulSequence(
  allNodes: FigmaNode[]
): WCAGIssue[] {
  const issues: WCAGIssue[] = [];

  // Check top-level children: node tree order vs visual position
  for (const node of allNodes) {
    if (!node.children || node.children.length < 2) continue;

    const childrenWithPos = node.children
      .filter((c) => c.absoluteBoundingBox)
      .map((c, idx) => ({
        node: c,
        treeIndex: idx,
        visualY: c.absoluteBoundingBox!.y,
        visualX: c.absoluteBoundingBox!.x,
      }));

    // Sort by visual reading order (top-to-bottom, left-to-right)
    const visualOrder = [...childrenWithPos].sort(
      (a, b) => a.visualY - b.visualY || a.visualX - b.visualX
    );

    // Count significant order mismatches
    let mismatches = 0;
    for (let i = 0; i < visualOrder.length; i++) {
      if (visualOrder[i].treeIndex !== childrenWithPos[i]?.treeIndex) {
        mismatches++;
      }
    }

    // Only flag if more than 30% of children are out of order (to avoid noise)
    if (mismatches > childrenWithPos.length * 0.3 && mismatches >= 3) {
      issues.push({
        severity: "warning",
        criterion: "1.3.2",
        nodeId: node.id,
        nodeName: node.name,
        issue: `Layer order differs significantly from visual reading order (${mismatches} of ${childrenWithPos.length} elements mismatched)`,
        currentValue: `${mismatches} order mismatches`,
        suggestedFix: "Reorder layers to match the visual reading flow (top-to-bottom, left-to-right) so screen readers follow the intended sequence.",
        autoFixAvailable: false,
      });
    }
  }

  return issues;
}

/** WCAG 1.4.1 Use of Color – heuristic check for colour-only state differentiation. */
export function checkUseOfColor(
  componentSetNodes: FigmaNode[]
): WCAGIssue[] {
  const issues: WCAGIssue[] = [];

  for (const set of componentSetNodes) {
    if (!set.children || set.children.length < 2) continue;

    // Compare variants pairwise for colour-only differences
    for (let i = 0; i < set.children.length - 1; i++) {
      for (let j = i + 1; j < set.children.length; j++) {
        const a = set.children[i];
        const b = set.children[j];

        const aColor = extractSolidColor(a);
        const bColor = extractSolidColor(b);

        // Both have fills and they differ
        if (aColor && bColor && !colorsEqual(aColor, bColor)) {
          // Check if structural content also differs (children count, types)
          const structurallyDifferent = hasStructuralDifference(a, b);

          if (!structurallyDifferent) {
            issues.push({
              severity: "warning",
              criterion: "1.4.1",
              nodeId: set.id,
              nodeName: set.name,
              issue: `Variants "${a.name}" and "${b.name}" differ only by colour — add an icon, text label, or pattern to distinguish states`,
              currentValue: "Colour-only differentiation",
              suggestedFix: "Add a non-colour indicator (icon, underline, text badge) to differentiate states for users who cannot perceive colour.",
              autoFixAvailable: false,
            });
            break; // One issue per component set is enough
          }
        }
      }
      if (issues.some((i) => i.nodeId === set.id)) break;
    }
  }

  return issues;
}

/** WCAG 1.4.11 Non-text Contrast – check stroke/border contrast against background. */
export function checkNonTextContrast(
  node: FigmaNode,
  allNodes: FigmaNode[]
): WCAGIssue | null {
  // Check strokes on interactive/UI elements
  if (!node.strokes || node.strokes.length === 0) return null;

  const strokeColor = node.strokes.find(
    (s) => s.type === "SOLID" && s.color
  )?.color;
  if (!strokeColor) return null;

  const bgColor = findParentBgColor(node.id, allNodes);
  if (!bgColor) return null;

  const strokeHex = figmaRgbaToHex(strokeColor.r, strokeColor.g, strokeColor.b);
  const bgHex = figmaRgbaToHex(bgColor.r, bgColor.g, bgColor.b);

  const ratio = computeContrastRatio(strokeHex, bgHex);
  const MIN_NON_TEXT_CONTRAST = 3.0;

  if (ratio < MIN_NON_TEXT_CONTRAST) {
    return {
      severity: "error",
      criterion: "1.4.11",
      nodeId: node.id,
      nodeName: node.name,
      issue: `UI component border contrast ${ratio.toFixed(2)}:1 is below the ${MIN_NON_TEXT_CONTRAST}:1 minimum for non-text elements`,
      currentValue: `${ratio.toFixed(2)}:1`,
      suggestedFix: `Increase border/stroke contrast to at least ${MIN_NON_TEXT_CONTRAST}:1`,
      autoFixAvailable: true,
    };
  }
  return null;
}

/** WCAG 1.4.12 Text Spacing – check line-height, letter-spacing on text nodes. */
export function checkTextSpacing(textNode: FigmaNode): WCAGIssue | null {
  if (textNode.type !== "TEXT") return null;
  const style = textNode.style;
  if (!style) return null;

  const fontSize = style.fontSize;
  const lineHeight = style.lineHeightPx;
  const letterSpacing = style.letterSpacing;

  // Line height should be >= 1.5x font size
  if (lineHeight > 0 && lineHeight < fontSize * 1.5) {
    return {
      severity: "warning",
      criterion: "1.4.12",
      nodeId: textNode.id,
      nodeName: textNode.name,
      issue: `Line height (${lineHeight.toFixed(1)}px) is less than 1.5x the font size (${fontSize}px = ${(fontSize * 1.5).toFixed(1)}px minimum)`,
      currentValue: `lineHeight: ${lineHeight.toFixed(1)}px (${(lineHeight / fontSize).toFixed(2)}x)`,
      suggestedFix: `Set line height to at least ${(fontSize * 1.5).toFixed(0)}px (1.5x font size)`,
      autoFixAvailable: true,
    };
  }

  // Letter spacing should not be negative (which would prevent user override)
  if (letterSpacing < 0) {
    return {
      severity: "warning",
      criterion: "1.4.12",
      nodeId: textNode.id,
      nodeName: textNode.name,
      issue: `Negative letter spacing (${letterSpacing}px) may prevent text spacing overrides`,
      currentValue: `letterSpacing: ${letterSpacing}px`,
      suggestedFix: "Use non-negative letter spacing to allow user text spacing adjustments",
      autoFixAvailable: true,
    };
  }

  return null;
}

/** WCAG 1.4.10 Reflow – heuristic check for responsive layout usage. */
export function checkReflow(frameNodes: FigmaNode[]): WCAGIssue[] {
  const issues: WCAGIssue[] = [];

  for (const frame of frameNodes) {
    // Only check top-level or large frames (likely page/section containers)
    const width = frame.width ?? 0;
    if (width < 320) continue; // Skip small components

    const hasAutoLayout = frame.layoutMode && frame.layoutMode !== "NONE";
    const isFixedWidth =
      frame.counterAxisSizingMode === "FIXED" ||
      frame.primaryAxisSizingMode === "FIXED";

    if (!hasAutoLayout && isFixedWidth && frame.children && frame.children.length > 2) {
      issues.push({
        severity: "warning",
        criterion: "1.4.10",
        nodeId: frame.id,
        nodeName: frame.name,
        issue: "Large container uses fixed sizing without auto-layout, may not reflow at narrow viewports",
        currentValue: `${width}px wide, no auto-layout`,
        suggestedFix: "Use auto-layout with fill/hug sizing so content reflows at 320px viewport width without horizontal scrolling.",
        autoFixAvailable: false,
      });
    }
  }

  return issues;
}

/** WCAG 1.4.5 / 1.4.9 Images of Text – detect rasterised text. */
export function checkImagesOfText(allNodes: FigmaNode[]): WCAGIssue[] {
  const issues: WCAGIssue[] = [];
  const textHints = ["text", "label", "title", "heading", "caption", "body", "paragraph", "description"];

  for (const node of allNodes) {
    const hasImageFill = node.fills?.some((f) => f.type === "IMAGE");
    if (!hasImageFill) continue;

    const nameLower = node.name.toLowerCase();
    const looksLikeText = textHints.some((hint) => nameLower.includes(hint));

    if (looksLikeText) {
      issues.push({
        severity: "warning",
        criterion: "1.4.5",
        nodeId: node.id,
        nodeName: node.name,
        issue: `Node "${node.name}" has an image fill but its name suggests it may contain text — use real text instead of images of text`,
        currentValue: "IMAGE fill with text-like name",
        suggestedFix: "Replace image of text with a real TEXT node. If the image is essential (e.g., logo), document that in the description.",
        autoFixAvailable: false,
      });
    }
  }

  return issues;
}

/** WCAG 1.4.13 Content on Hover or Focus – heuristic tooltip/hover pattern check. */
export function checkContentOnHover(
  componentSetNodes: FigmaNode[]
): WCAGIssue[] {
  const issues: WCAGIssue[] = [];

  for (const set of componentSetNodes) {
    if (!set.children) continue;

    const hoverVariant = set.children.find((c) => {
      const name = c.name.toLowerCase();
      return name.includes("hover") || name.includes("tooltip");
    });

    if (!hoverVariant) continue;

    // Check if the hover variant has significantly more children (added content)
    const defaultVariant = set.children.find((c) => {
      const name = c.name.toLowerCase();
      return name.includes("default") || name.includes("rest") || name.includes("idle");
    }) || set.children[0];

    const defaultChildCount = countDescendants(defaultVariant);
    const hoverChildCount = countDescendants(hoverVariant);

    if (hoverChildCount > defaultChildCount + 1) {
      // Additional content appears on hover — check for dismiss mechanism
      const hasDismiss = hoverVariant.children?.some((c) => {
        const name = c.name.toLowerCase();
        return name.includes("close") || name.includes("dismiss") || name.includes("x");
      });

      if (!hasDismiss) {
        issues.push({
          severity: "warning",
          criterion: "1.4.13",
          nodeId: set.id,
          nodeName: set.name,
          issue: "Additional content appears on hover without a visible dismiss mechanism",
          currentValue: "Hover-triggered content, no close control",
          suggestedFix: "Ensure hover/focus-triggered content is: (1) dismissable via Escape, (2) hoverable without disappearing, (3) persistent until dismissed.",
          autoFixAvailable: false,
        });
      }
    }
  }

  return issues;
}

/** WCAG 2.4.3 Focus Order – heuristic check for tab order mismatches. */
export function checkFocusOrder(
  interactiveNodes: FigmaNode[]
): WCAGIssue[] {
  const issues: WCAGIssue[] = [];

  const withPos = interactiveNodes
    .filter((n) => n.absoluteBoundingBox)
    .map((n, idx) => ({
      node: n,
      treeIndex: idx,
      y: n.absoluteBoundingBox!.y,
      x: n.absoluteBoundingBox!.x,
    }));

  if (withPos.length < 2) return issues;

  // Expected visual order: top-to-bottom, left-to-right
  const visualOrder = [...withPos].sort(
    (a, b) => a.y - b.y || a.x - b.x
  );

  let mismatches = 0;
  for (let i = 0; i < visualOrder.length; i++) {
    if (visualOrder[i].treeIndex !== withPos[i]?.treeIndex) {
      mismatches++;
    }
  }

  if (mismatches > withPos.length * 0.25 && mismatches >= 2) {
    issues.push({
      severity: "warning",
      criterion: "2.4.3",
      nodeId: withPos[0].node.id,
      nodeName: "Interactive elements",
      issue: `Focus order (layer order) differs from visual reading order for ${mismatches} of ${withPos.length} interactive elements`,
      currentValue: `${mismatches} order mismatches`,
      suggestedFix: "Reorder interactive element layers to match the visual top-to-bottom, left-to-right flow for logical tab order.",
      autoFixAvailable: false,
    });
  }

  return issues;
}

/** WCAG 2.4.4 / 2.4.9 Link Purpose – detect vague link text. */
const VAGUE_LINK_TEXTS = [
  "click here",
  "read more",
  "learn more",
  "more",
  "here",
  "link",
  "go",
  "see more",
  "details",
  "info",
];

export function checkLinkPurpose(
  interactiveNodes: FigmaNode[]
): WCAGIssue[] {
  const issues: WCAGIssue[] = [];

  for (const node of interactiveNodes) {
    const name = node.name.toLowerCase();
    const isLink =
      name.includes("link") ||
      name.includes("anchor") ||
      name.includes("cta") ||
      node.type === "INSTANCE";

    if (!isLink) continue;

    // Check visible text content
    const textContent = findTextContent(node);
    if (!textContent) continue;

    const normalised = textContent.toLowerCase().trim();
    if (VAGUE_LINK_TEXTS.includes(normalised)) {
      issues.push({
        severity: "warning",
        criterion: "2.4.4",
        nodeId: node.id,
        nodeName: node.name,
        issue: `Link text "${textContent}" is vague and does not describe its purpose`,
        currentValue: `"${textContent}"`,
        suggestedFix: `Replace with descriptive text that explains where the link goes (e.g., "View order details" instead of "${textContent}").`,
        autoFixAvailable: false,
      });
    }
  }

  return issues;
}

/** WCAG 2.4.6 Headings and Labels – check sections for heading presence. */
export function checkHeadingsAndLabels(
  frameNodes: FigmaNode[]
): WCAGIssue[] {
  const issues: WCAGIssue[] = [];

  for (const frame of frameNodes) {
    // Only check substantial frames (likely content sections)
    if (!frame.children || frame.children.length < 3) continue;
    const width = frame.width ?? 0;
    const height = frame.height ?? 0;
    if (width < 200 || height < 100) continue;

    // Check if frame has any heading-like text child
    const hasHeading = hasHeadingChild(frame);

    if (!hasHeading) {
      issues.push({
        severity: "suggestion",
        criterion: "2.4.6",
        nodeId: frame.id,
        nodeName: frame.name,
        issue: "Content section has no visible heading text",
        currentValue: "No heading found",
        suggestedFix: "Add a descriptive heading to help users understand the section's topic or purpose.",
        autoFixAvailable: false,
      });
    }
  }

  return issues;
}

/** WCAG 2.4.11 Focus Not Obscured – check focus variants for overlapping elements. */
export function checkFocusNotObscured(
  componentSetNodes: FigmaNode[]
): WCAGIssue[] {
  const issues: WCAGIssue[] = [];

  for (const set of componentSetNodes) {
    if (!set.children) continue;

    const focusVariant = set.children.find((c) => {
      const name = c.name.toLowerCase();
      return name.includes("focus");
    });

    if (!focusVariant || !focusVariant.children) continue;

    // Check if any child in the focus variant is positioned to overlap the main content
    // Heuristic: look for overlay/backdrop children that are full-size
    const overlays = focusVariant.children.filter((c) => {
      const name = c.name.toLowerCase();
      return name.includes("overlay") || name.includes("backdrop") || name.includes("scrim");
    });

    for (const overlay of overlays) {
      const overlayW = overlay.width ?? 0;
      const overlayH = overlay.height ?? 0;
      const parentW = focusVariant.width ?? 0;
      const parentH = focusVariant.height ?? 0;

      if (overlayW >= parentW * 0.8 && overlayH >= parentH * 0.8) {
        issues.push({
          severity: "warning",
          criterion: "2.4.11",
          nodeId: set.id,
          nodeName: set.name,
          issue: `Focus variant contains an overlay ("${overlay.name}") that may obscure the focused element`,
          currentValue: `Overlay ${overlayW}×${overlayH}px over ${parentW}×${parentH}px parent`,
          suggestedFix: "Ensure the focused element is not obscured by overlays. The focus indicator should remain fully visible.",
          autoFixAvailable: false,
        });
      }
    }
  }

  return issues;
}

/** WCAG 3.3.1 Error Identification – check error state variants for descriptive text. */
export function checkErrorIdentification(
  componentSetNodes: FigmaNode[]
): WCAGIssue[] {
  const issues: WCAGIssue[] = [];

  for (const set of componentSetNodes) {
    if (!set.children) continue;

    const errorVariant = set.children.find((c) => {
      const name = c.name.toLowerCase();
      return name.includes("error") || name.includes("invalid") || name.includes("destructive");
    });

    if (!errorVariant) continue;

    // Check if the error variant has text describing the error
    const errorText = findTextContent(errorVariant);
    const hasErrorDescription =
      errorText &&
      errorText.length > 3 &&
      !errorText.toLowerCase().includes("placeholder");

    if (!hasErrorDescription) {
      // Check if only colour indicates the error (red fill without text)
      issues.push({
        severity: "warning",
        criterion: "3.3.1",
        nodeId: set.id,
        nodeName: set.name,
        issue: `Error variant "${errorVariant.name}" lacks descriptive error text — errors should be identified in text, not just by colour`,
        currentValue: "No error description text found",
        suggestedFix: "Add a text element describing the error (e.g., 'Email address is required') to the error state variant.",
        autoFixAvailable: false,
      });
    }
  }

  return issues;
}

/** WCAG 3.3.2 Labels or Instructions – check form inputs for visible labels. */
export function checkLabelsOrInstructions(
  interactiveNodes: FigmaNode[],
  allNodes: FigmaNode[]
): WCAGIssue[] {
  const issues: WCAGIssue[] = [];
  const inputHints = ["input", "text field", "textfield", "textarea", "select", "dropdown", "combobox", "search", "form"];

  for (const node of interactiveNodes) {
    const name = node.name.toLowerCase();
    const isInput = inputHints.some((hint) => name.includes(hint));
    if (!isInput) continue;

    // Check for a visible label — either a child TEXT or a sibling TEXT
    const hasInternalLabel = node.children?.some(
      (c) =>
        c.type === "TEXT" &&
        c.characters &&
        c.characters.trim().length > 0 &&
        !c.name.toLowerCase().includes("placeholder")
    );

    if (hasInternalLabel) continue;

    // Check sibling labels
    const parent = findParentNode(node.id, allNodes);
    const hasSiblingLabel = parent?.children?.some(
      (c) =>
        c.type === "TEXT" &&
        c.id !== node.id &&
        c.characters &&
        c.characters.trim().length > 0 &&
        !c.name.toLowerCase().includes("placeholder")
    );

    if (hasSiblingLabel) continue;

    issues.push({
      severity: "warning",
      criterion: "3.3.2",
      nodeId: node.id,
      nodeName: node.name,
      issue: `Form input "${node.name}" has no visible label text`,
      currentValue: "No label found",
      suggestedFix: "Add a visible text label above or beside the input field. Do not rely solely on placeholder text as a label.",
      autoFixAvailable: false,
    });
  }

  return issues;
}

/** WCAG 4.1.2 Name, Role, Value – check interactive components for name/description. */
export function checkNameRoleValue(
  interactiveNodes: FigmaNode[]
): WCAGIssue[] {
  const issues: WCAGIssue[] = [];

  for (const node of interactiveNodes) {
    // Icon-only interactive elements need accessible names
    const hasVisibleText = findTextContent(node);
    const hasDescription = node.description && node.description.trim().length > 0;

    if (!hasVisibleText && !hasDescription) {
      const name = node.name.toLowerCase();
      // Only flag icon-like elements (small, no text)
      const w = node.width ?? 0;
      const h = node.height ?? 0;
      if (w <= 48 && h <= 48) {
        issues.push({
          severity: "warning",
          criterion: "4.1.2",
          nodeId: node.id,
          nodeName: node.name,
          issue: `Interactive element "${node.name}" has no visible text or description — screen readers need an accessible name`,
          currentValue: "No accessible name",
          suggestedFix: "Add an aria-label (via description property in Figma) or include visible text for icon-only interactive elements.",
          autoFixAvailable: false,
        });
      }
    }
  }

  return issues;
}

/** WCAG 1.3.4 Orientation – check for portrait/landscape variant presence. */
export function checkOrientation(
  componentSetNodes: FigmaNode[]
): WCAGIssue[] {
  // This is a page-level concern; at the component level, we just flag awareness
  // Only meaningful for screen/page-level component sets
  return [];
}

/** WCAG 1.3.5 Identify Input Purpose – check input names for autocomplete hints. */
export function checkIdentifyInputPurpose(
  interactiveNodes: FigmaNode[]
): WCAGIssue[] {
  const issues: WCAGIssue[] = [];
  const purposeHints = [
    "name", "email", "tel", "phone", "address", "city", "state", "zip",
    "postal", "country", "password", "username", "birthday", "cc-number",
    "cc-name", "cc-exp", "credit",
  ];

  for (const node of interactiveNodes) {
    const name = node.name.toLowerCase();
    const isInput =
      name.includes("input") ||
      name.includes("text field") ||
      name.includes("textfield");
    if (!isInput) continue;

    // Check if the input name or description hints at a known purpose
    const matchesPurpose = purposeHints.some(
      (hint) => name.includes(hint) || (node.description ?? "").toLowerCase().includes(hint)
    );

    if (matchesPurpose && !node.description?.toLowerCase().includes("autocomplete")) {
      issues.push({
        severity: "suggestion",
        criterion: "1.3.5",
        nodeId: node.id,
        nodeName: node.name,
        issue: `Input "${node.name}" appears to collect personal data — annotate with autocomplete purpose (e.g., autocomplete="email")`,
        currentValue: "No autocomplete annotation",
        suggestedFix: "Add autocomplete purpose annotation in the description property to support browser autofill.",
        autoFixAvailable: false,
      });
    }
  }

  return issues;
}

// ─── Internal helpers for new checks ────────────────────────────────────────

function findParentNode(
  nodeId: string,
  allNodes: FigmaNode[]
): FigmaNode | null {
  for (const n of allNodes) {
    if (n.children?.some((c) => c.id === nodeId)) return n;
    if (n.children) {
      const found = findParentNode(nodeId, n.children);
      if (found) return found;
    }
  }
  return null;
}

function colorsEqual(a: RGBA, b: RGBA): boolean {
  return (
    Math.abs(a.r - b.r) < 0.01 &&
    Math.abs(a.g - b.g) < 0.01 &&
    Math.abs(a.b - b.b) < 0.01
  );
}

function hasStructuralDifference(a: FigmaNode, b: FigmaNode): boolean {
  const aChildren = a.children || [];
  const bChildren = b.children || [];

  // Different child count
  if (aChildren.length !== bChildren.length) return true;

  // Different child types
  for (let i = 0; i < aChildren.length; i++) {
    if (aChildren[i].type !== bChildren[i]?.type) return true;
  }

  // Check for text content differences
  const aTexts = aChildren
    .filter((c) => c.type === "TEXT")
    .map((c) => c.characters ?? "");
  const bTexts = bChildren
    .filter((c) => c.type === "TEXT")
    .map((c) => c.characters ?? "");
  if (aTexts.join("|") !== bTexts.join("|")) return true;

  return false;
}

function countDescendants(node: FigmaNode): number {
  if (!node.children) return 0;
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendants(child);
  }
  return count;
}

function findTextContent(node: FigmaNode): string | null {
  if (node.type === "TEXT" && node.characters) return node.characters;
  if (node.children) {
    for (const child of node.children) {
      const text = findTextContent(child);
      if (text) return text;
    }
  }
  return null;
}

function hasHeadingChild(node: FigmaNode): boolean {
  if (node.type === "TEXT") {
    const fontSize = node.style?.fontSize ?? 16;
    const fontWeight = node.style?.fontWeight ?? 400;
    return fontSize >= 20 || fontWeight >= 700;
  }
  if (node.children) {
    return node.children.some((c) => hasHeadingChild(c));
  }
  return false;
}
