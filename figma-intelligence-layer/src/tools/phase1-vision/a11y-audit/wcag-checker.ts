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
