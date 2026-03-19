import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import {
  computeContrastRatio,
  simulateColorBlindness,
  figmaRgbaToHex,
  meetsWCAG,
} from "../../../shared/token-utils.js";
import { FigmaNode, WCAGIssue, RGBA } from "../../../shared/types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface A11yAuditArgs {
  nodeId: string;
  wcagLevel: "A" | "AA" | "AAA";
  includeColorBlindSim?: boolean;
  outputFormat: "inline" | "report" | "both";
  autoSuggestFixes?: boolean;
}

interface ColorBlindSimResult {
  profile: string;
  contrastRatio: number;
  passes: boolean;
}

interface ExtendedWCAGIssue extends WCAGIssue {
  colorBlindSims?: ColorBlindSimResult[];
}

export interface A11yAuditResult {
  nodeId: string;
  wcagLevel: "A" | "AA" | "AAA";
  totalChecks: number;
  passed: number;
  failed: number;
  passRate: string;
  issues: ExtendedWCAGIssue[];
  annotationsAdded: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MIN_TOUCH_TARGET = 44;
const CB_PROFILES = [
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "achromatopsia",
] as const;

type CBProfile = typeof CB_PROFILES[number];

// ─────────────────────────────────────────────────────────────────────────────
// Node tree helpers
// ─────────────────────────────────────────────────────────────────────────────

function collectNodes(
  node: FigmaNode,
  predicate: (n: FigmaNode) => boolean,
  acc: FigmaNode[] = []
): FigmaNode[] {
  if (predicate(node)) acc.push(node);
  if (node.children) {
    for (const child of node.children) {
      collectNodes(child, predicate, acc);
    }
  }
  return acc;
}

function extractSolidColor(node: FigmaNode): RGBA | null {
  if (!node.fills || node.fills.length === 0) return null;
  const solid = node.fills.find((f) => f.type === "SOLID" && f.color);
  return solid?.color ?? null;
}

/** Walk up the node tree to find the nearest background color. */
function findParentBgColor(
  nodeId: string,
  allNodes: FigmaNode[]
): RGBA | null {
  // Build a parent lookup from the flat list
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
  // Default to white if no bg found
  return { r: 1, g: 1, b: 1, a: 1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit checks
// ─────────────────────────────────────────────────────────────────────────────

function checkTextContrast(
  textNode: FigmaNode,
  allNodes: FigmaNode[],
  wcagLevel: "A" | "AA" | "AAA",
  includeColorBlindSim: boolean
): ExtendedWCAGIssue | null {
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

  // WCAG A uses AA thresholds for contrast; AAA uses higher thresholds
  const effectiveLevel: "AA" | "AAA" =
    wcagLevel === "AAA" ? "AAA" : "AA";
  const passes = meetsWCAG(ratio, effectiveLevel, isLargeText);

  if (passes) return null;

  const issue: ExtendedWCAGIssue = {
    severity: ratio < 3.0 ? "error" : "warning",
    criterion: wcagLevel === "AAA" ? "1.4.6 Contrast (Enhanced)" : "1.4.3 Contrast (Minimum)",
    nodeId: textNode.id,
    nodeName: textNode.name,
    issue: `Text contrast ratio ${ratio.toFixed(2)}:1 is below the ${effectiveLevel} threshold (${isLargeText ? (effectiveLevel === "AAA" ? "4.5" : "3.0") : (effectiveLevel === "AAA" ? "7.0" : "4.5")}:1) for ${isLargeText ? "large" : "normal"} text`,
    currentValue: `${ratio.toFixed(2)}:1`,
    suggestedFix: `Increase contrast to at least ${isLargeText ? (effectiveLevel === "AAA" ? "4.5" : "3.0") : (effectiveLevel === "AAA" ? "7.0" : "4.5")}:1 by darkening text or lightening background`,
    autoFixAvailable: true,
  };

  if (includeColorBlindSim) {
    issue.colorBlindSims = CB_PROFILES.map((profile: CBProfile) => {
      const simFg = simulateColorBlindness(fgHex, profile);
      const simBg = simulateColorBlindness(bgHex, profile);
      const simRatio = computeContrastRatio(simFg, simBg);
      const simPasses = meetsWCAG(simRatio, effectiveLevel, isLargeText);
      return { profile, contrastRatio: simRatio, passes: simPasses };
    });
  }

  return issue;
}

function checkTouchTarget(node: FigmaNode): WCAGIssue | null {
  if (!node.absoluteBoundingBox) return null;
  if (!node.width || !node.height) return null;

  const w = node.width;
  const h = node.height;

  if (w < MIN_TOUCH_TARGET || h < MIN_TOUCH_TARGET) {
    return {
      severity: "error",
      criterion: "2.5.5 Target Size",
      nodeId: node.id,
      nodeName: node.name,
      issue: `Interactive element is ${w}×${h}px, below the minimum 44×44px touch target`,
      currentValue: `${w}×${h}px`,
      suggestedFix: `Resize to at least ${MIN_TOUCH_TARGET}×${MIN_TOUCH_TARGET}px or add invisible padding`,
      autoFixAvailable: true,
    };
  }
  return null;
}

function checkFocusState(node: FigmaNode): WCAGIssue | null {
  if (node.type !== "COMPONENT_SET") return null;

  const variantProps = node.variantProperties ?? {};
  const hasFocusVariant = Object.values(variantProps).some(
    (v) => typeof v === "string" && v.toLowerCase().includes("focus")
  );
  const childFocus = node.children?.some(
    (c) =>
      c.name.toLowerCase().includes("focus") ||
      Object.values(c.variantProperties ?? {}).some(
        (v) => typeof v === "string" && v.toLowerCase().includes("focus")
      )
  );

  if (!hasFocusVariant && !childFocus) {
    return {
      severity: "warning",
      criterion: "2.4.7 Focus Visible",
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

function checkFixedHeightTextContainer(node: FigmaNode): WCAGIssue | null {
  if (!node.children) return null;

  const hasTextChild = node.children.some((c) => c.type === "TEXT");
  if (!hasTextChild) return null;

  const isFixedHeight =
    node.primaryAxisSizingMode === "FIXED" ||
    (node.height !== undefined && node.primaryAxisSizingMode !== "AUTO");

  if (isFixedHeight && node.layoutMode && node.layoutMode !== "NONE") {
    return {
      severity: "warning",
      criterion: "1.4.4 Resize Text",
      nodeId: node.id,
      nodeName: node.name,
      issue: "Text container has fixed height which may clip text when font size is increased",
      currentValue: `height: ${node.height}px (fixed)`,
      suggestedFix: 'Set vertical sizing to "Hug contents" (AUTO) so text can reflow',
      autoFixAvailable: true,
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline annotation script
// ─────────────────────────────────────────────────────────────────────────────

function buildAnnotationScript(issues: WCAGIssue[]): string {
  return `
(async () => {
  const issues = ${JSON.stringify(issues)};
  const created = [];
  const severityColors = {
    error:      { r: 0.96, g: 0.26, b: 0.21 },
    warning:    { r: 1,    g: 0.76, b: 0    },
    suggestion: { r: 0.13, g: 0.59, b: 0.95 },
  };

  for (const issue of issues) {
    const target = await figma.getNodeByIdAsync(issue.nodeId);
    if (!target) continue;

    const sticky = figma.createSticky();
    sticky.text.characters =
      "[" + issue.criterion + "] " + issue.severity.toUpperCase() + "\\n" +
      issue.issue + "\\nFix: " + issue.suggestedFix;
    const color = severityColors[issue.severity] || severityColors.suggestion;
    sticky.fills = [{ type: "SOLID", color }];

    const bbox = target.absoluteBoundingBox;
    if (bbox) {
      sticky.x = bbox.x + bbox.width + 16;
      sticky.y = bbox.y;
    }
    figma.currentPage.appendChild(sticky);
    created.push(sticky.id);
  }

  return { count: created.length, ids: created };
})();
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function a11yAuditHandler(
  args: A11yAuditArgs
): Promise<A11yAuditResult> {
  const {
    nodeId,
    wcagLevel,
    includeColorBlindSim = false,
    outputFormat,
    autoSuggestFixes = false,
  } = args;

  const bridge = await getBridge();

  // 1. Retrieve full node tree for the target node
  const treeScript = `
    function serialize(n, depth) {
      if (depth > 8) return null;
      var fills = [];
      try {
        var rawFills = n.fills || [];
        for (var i = 0; i < rawFills.length; i++) {
          var f = rawFills[i];
          fills.push({
            type: f.type,
            color: f.color ? { r: f.color.r, g: f.color.g, b: f.color.b, a: f.color.a } : null,
            opacity: f.opacity || 1,
          });
        }
      } catch(e) { /* mixed fills */ }
      var kids = [];
      var rawChildren = n.children || [];
      for (var j = 0; j < rawChildren.length; j++) {
        var child = serialize(rawChildren[j], depth + 1);
        if (child) kids.push(child);
      }
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        width: n.width || null,
        height: n.height || null,
        layoutMode: n.layoutMode || null,
        primaryAxisSizingMode: n.primaryAxisSizingMode || null,
        variantProperties: n.variantProperties || null,
        absoluteBoundingBox: n.absoluteBoundingBox || null,
        characters: n.characters || null,
        style: n.style || null,
        fills: fills,
        children: kids,
      };
    }
    var root = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
    if (!root) throw new Error("Node not found: " + ${JSON.stringify(nodeId)});
    return serialize(root, 0);
  `;

  const treeResult = await bridge.execute(treeScript);
  if (!treeResult.success) {
    throw new Error(`a11yAuditHandler: could not retrieve node tree — ${treeResult.error}`);
  }

  const rootNode = treeResult.result as FigmaNode;

  // 2. Collect all relevant node types
  const allNodes: FigmaNode[] = [];
  collectNodes(rootNode, () => true, allNodes);

  const textNodes = allNodes.filter((n) => n.type === "TEXT");
  const interactiveNodes = allNodes.filter(
    (n) =>
      n.type === "INSTANCE" ||
      n.type === "COMPONENT" ||
      (n.name.toLowerCase().includes("button") ||
        n.name.toLowerCase().includes("link") ||
        n.name.toLowerCase().includes("input") ||
        n.name.toLowerCase().includes("checkbox") ||
        n.name.toLowerCase().includes("radio") ||
        n.name.toLowerCase().includes("toggle") ||
        n.name.toLowerCase().includes("select"))
  );
  const componentSetNodes = allNodes.filter((n) => n.type === "COMPONENT_SET");
  const frameNodes = allNodes.filter(
    (n) => n.type === "FRAME" || n.type === "GROUP"
  );

  const issues: ExtendedWCAGIssue[] = [];

  // 3. Text contrast checks
  for (const node of textNodes) {
    const issue = checkTextContrast(node, allNodes, wcagLevel, includeColorBlindSim);
    if (issue) issues.push(issue);
  }

  // 4. Touch target size checks (only for WCAG AA and AAA, as 2.5.5 is Level AAA in WCAG 2.1 but commonly applied)
  for (const node of interactiveNodes) {
    const issue = checkTouchTarget(node);
    if (issue) {
      // Level A: skip touch target (not required). AA+: include.
      if (wcagLevel !== "A") issues.push(issue);
    }
  }

  // 5. Focus state variant checks
  for (const node of componentSetNodes) {
    const issue = checkFocusState(node);
    if (issue) issues.push(issue);
  }

  // 6. Fixed-height text container checks
  for (const node of frameNodes) {
    const issue = checkFixedHeightTextContainer(node);
    if (issue) issues.push(issue);
  }

  // 7. Color blind simulation re-run on previously passed text nodes (if requested)
  if (includeColorBlindSim) {
    for (const node of textNodes) {
      const fgColor = extractSolidColor(node);
      if (!fgColor) continue;
      const bgColor = findParentBgColor(node.id, allNodes);
      if (!bgColor) continue;

      const fgHex = figmaRgbaToHex(fgColor.r, fgColor.g, fgColor.b);
      const bgHex = figmaRgbaToHex(bgColor.r, bgColor.g, bgColor.b);
      const fontSize = node.style?.fontSize ?? 16;
      const fontWeight = node.style?.fontWeight ?? 400;
      const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
      const effectiveLevel: "AA" | "AAA" = wcagLevel === "AAA" ? "AAA" : "AA";

      // Check if any CB profile causes a failure not already caught
      for (const profile of CB_PROFILES) {
        const simFg = simulateColorBlindness(fgHex, profile);
        const simBg = simulateColorBlindness(bgHex, profile);
        const simRatio = computeContrastRatio(simFg, simBg);
        const simPasses = meetsWCAG(simRatio, effectiveLevel, isLargeText);

        if (!simPasses) {
          // Only add if not already reported for this node
          const alreadyReported = issues.some(
            (i) => i.nodeId === node.id && i.criterion.includes("1.4.3")
          );
          if (!alreadyReported) {
            issues.push({
              severity: "warning",
              criterion: "1.4.3 Contrast (Minimum) — Color Vision",
              nodeId: node.id,
              nodeName: node.name,
              issue: `Contrast ratio ${simRatio.toFixed(2)}:1 fails under ${profile} simulation`,
              currentValue: `${simRatio.toFixed(2)}:1 (${profile})`,
              suggestedFix:
                "Avoid relying solely on color to convey information; ensure contrast works for all vision types",
              autoFixAvailable: false,
              colorBlindSims: [{ profile, contrastRatio: simRatio, passes: simPasses }],
            });
          }
        }
      }
    }
  }

  // 8. Statistics
  const totalChecks =
    textNodes.length +
    (wcagLevel !== "A" ? interactiveNodes.length : 0) +
    componentSetNodes.length +
    frameNodes.length;
  const failed = issues.length;
  const passed = Math.max(0, totalChecks - failed);
  const passRate =
    totalChecks > 0 ? `${Math.round((passed / totalChecks) * 100)}%` : "100%";

  // 9. Add auto-fix suggestions where applicable
  if (autoSuggestFixes) {
    for (const issue of issues) {
      if (!issue.autoFixAvailable) {
        issue.suggestedFix += " (manual intervention required)";
      }
    }
  }

  // 10. Inline annotations in Figma
  let annotationsAdded = 0;
  if ((outputFormat === "inline" || outputFormat === "both") && issues.length > 0) {
    const annotScript = buildAnnotationScript(issues);
    const annotResult = await bridge.execute(annotScript);
    if (annotResult.success) {
      const data = annotResult.result as { count: number };
      annotationsAdded = data.count;
    }
  }

  // 11. Log action
  await decisionLog.log({
    tool: "figma_a11y_audit",
    nodeIds: [nodeId],
    rationale: `Accessibility audit at WCAG ${wcagLevel} level. Checked ${totalChecks} elements. Pass rate: ${passRate}. Found ${failed} issues across ${textNodes.length} text nodes, ${interactiveNodes.length} interactive elements, ${componentSetNodes.length} component sets.${includeColorBlindSim ? " Color blind simulation included." : ""}`,
    reversible: false,
    metadata: {
      wcagLevel,
      totalChecks,
      passed,
      failed,
      passRate,
      includeColorBlindSim,
      annotationsAdded,
    },
  });

  return {
    nodeId,
    wcagLevel,
    totalChecks,
    passed,
    failed,
    passRate,
    issues,
    annotationsAdded,
  };
}
