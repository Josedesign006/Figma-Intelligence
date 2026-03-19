// ─────────────────────────────────────────────────────────────────────────────
// Layout Intelligence
// Analyses a Figma node's container type and recommends (or applies) optimal
// Auto-Layout settings drawn from a built-in container → settings lookup table.
// All spacing values are snapped to the nearest spacing token.
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import { snapToSpacingToken } from "../../../shared/token-utils.js";
import { FigmaNode } from "../../../shared/types.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface LayoutIntelligenceArgs {
  nodeId: string;
  applyChanges: boolean;
  spacingTokenSet?: string;
  responsiveHints?: boolean;
  reportDiff?: boolean;
}

export type ContainerKind =
  | "navigation bar"
  | "card"
  | "form"
  | "button"
  | "grid"
  | "list item"
  | "modal"
  | "section";

export interface AutoLayoutSpec {
  direction: "HORIZONTAL" | "VERTICAL" | "WRAP";
  primaryAxisSizingMode: "FIXED" | "AUTO";  // width
  counterAxisSizingMode: "FIXED" | "AUTO";  // height
  paddingToken: string;
  gapToken: string;
  paddingValue: number;   // resolved px
  gapValue: number;       // resolved px
}

export interface PropertyDiff {
  property: string;
  before: string | number | undefined;
  after: string | number;
  tokenName?: string;
}

export interface LayoutIntelligenceResult {
  nodeId: string;
  nodeName: string;
  detectedKind: ContainerKind | "unknown";
  spec: AutoLayoutSpec;
  diff: PropertyDiff[];
  applied: boolean;
  responsiveHints?: string[];
  logEntryId: string;
}

// ─── Spacing token name → px value ───────────────────────────────────────────

const SPACE: Record<string, number> = {
  "--space-xs":  4,
  "--space-sm":  8,
  "--space-md":  16,
  "--space-lg":  24,
  "--space-xl":  32,
  "--space-2xl": 48,
};

// ─── Container → Auto-Layout mapping table ────────────────────────────────────
// direction          / primaryAxis (W) / counterAxis (H) / padding token    / gap token

const CONTAINER_SPECS: Record<ContainerKind, AutoLayoutSpec> = {
  "navigation bar": {
    direction: "HORIZONTAL",
    primaryAxisSizingMode: "AUTO",   // Fill W
    counterAxisSizingMode: "AUTO",   // Hug H
    paddingToken: "--space-md",
    gapToken: "--space-md",
    paddingValue: SPACE["--space-md"],
    gapValue: SPACE["--space-md"],
  },
  card: {
    direction: "VERTICAL",
    primaryAxisSizingMode: "AUTO",   // Fill W
    counterAxisSizingMode: "AUTO",   // Hug H
    paddingToken: "--space-lg",
    gapToken: "--space-lg",
    paddingValue: SPACE["--space-lg"],
    gapValue: SPACE["--space-lg"],
  },
  form: {
    direction: "VERTICAL",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    paddingToken: "--space-md",
    gapToken: "--space-md",
    paddingValue: SPACE["--space-md"],
    gapValue: SPACE["--space-md"],
  },
  button: {
    direction: "HORIZONTAL",
    primaryAxisSizingMode: "AUTO",   // Hug W
    counterAxisSizingMode: "AUTO",   // Hug H
    paddingToken: "--space-sm",
    gapToken: "--space-sm",
    paddingValue: SPACE["--space-sm"],
    gapValue: SPACE["--space-sm"],
  },
  grid: {
    direction: "WRAP",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    paddingToken: "--space-md",
    gapToken: "--space-md",
    paddingValue: SPACE["--space-md"],
    gapValue: SPACE["--space-md"],
  },
  "list item": {
    direction: "HORIZONTAL",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    paddingToken: "--space-sm",
    gapToken: "--space-sm",
    paddingValue: SPACE["--space-sm"],
    gapValue: SPACE["--space-sm"],
  },
  modal: {
    direction: "VERTICAL",
    primaryAxisSizingMode: "FIXED",  // Fixed W
    counterAxisSizingMode: "AUTO",   // Hug H
    paddingToken: "--space-xl",
    gapToken: "--space-xl",
    paddingValue: SPACE["--space-xl"],
    gapValue: SPACE["--space-xl"],
  },
  section: {
    direction: "VERTICAL",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    paddingToken: "--space-2xl",
    gapToken: "--space-2xl",
    paddingValue: SPACE["--space-2xl"],
    gapValue: SPACE["--space-2xl"],
  },
};

// ─── Container-kind detection heuristics ─────────────────────────────────────

function detectContainerKind(node: FigmaNode): ContainerKind | "unknown" {
  const name = node.name.toLowerCase();
  const childCount = node.children?.length ?? 0;
  const w = node.absoluteBoundingBox?.width ?? 0;
  const h = node.absoluteBoundingBox?.height ?? 0;
  const aspectRatio = h > 0 ? w / h : 1;

  // Name-based detection (highest priority)
  if (/nav(igation)?\s*(bar)?|navbar|top\s*bar|header\s*bar/.test(name)) return "navigation bar";
  if (/\bmodal\b|\bdialog\b|\bdrawer\b|\bpopup\b/.test(name)) return "modal";
  if (/\bcard\b|\btile\b|\bpanel\b/.test(name)) return "card";
  if (/\bform\b|\binput\s*group\b/.test(name)) return "form";
  if (/\bbtn\b|\bbutton\b|\bcta\b/.test(name)) return "button";
  if (/\bgrid\b|\bmasonry\b|\bgallery\b/.test(name)) return "grid";
  if (/\blist\s*item\b|\brow\b|\bcell\b/.test(name)) return "list item";
  if (/\bsection\b|\bhero\b|\bfooter\b|\bpage\b/.test(name)) return "section";

  // Geometry-based fallback
  if (w > 0 && h <= 80 && aspectRatio > 5) return "navigation bar";       // very wide & short
  if (w <= 120 && h <= 60 && childCount <= 3) return "button";             // small & few children
  if (childCount > 6 && node.layoutMode === "NONE") return "grid";         // many children, no layout
  if (h > 300 && w < 600 && childCount > 2) return "modal";               // tall-ish popup sized box
  if (childCount > 0 && node.layoutMode === "VERTICAL") return "card";
  if (aspectRatio > 4 && childCount <= 5) return "list item";

  return "unknown";
}

// ─── Diff builder ─────────────────────────────────────────────────────────────

function buildDiff(node: FigmaNode, spec: AutoLayoutSpec): PropertyDiff[] {
  const diffs: PropertyDiff[] = [];

  const currentLayoutMode = node.layoutMode ?? "NONE";
  const targetLayoutMode = spec.direction === "WRAP" ? "HORIZONTAL" : spec.direction;

  if (currentLayoutMode !== targetLayoutMode) {
    diffs.push({ property: "layoutMode", before: currentLayoutMode, after: targetLayoutMode });
  }

  // WRAP is represented via layoutWrap which we handle separately
  if (spec.direction === "WRAP") {
    diffs.push({ property: "layoutWrap", before: "NO_WRAP", after: "WRAP" });
  }

  const spacingFields: Array<keyof FigmaNode> = [
    "paddingLeft",
    "paddingRight",
    "paddingTop",
    "paddingBottom",
  ];

  for (const field of spacingFields) {
    const current = node[field] as number | undefined;
    const snapped = snapToSpacingToken(spec.paddingValue);
    if (current !== snapped.tokenValue) {
      diffs.push({
        property: field,
        before: current,
        after: snapped.tokenValue,
        tokenName: snapped.tokenName,
      });
    }
  }

  const currentGap = node.itemSpacing ?? 0;
  const snappedGap = snapToSpacingToken(spec.gapValue);
  if (currentGap !== snappedGap.tokenValue) {
    diffs.push({
      property: "itemSpacing",
      before: currentGap,
      after: snappedGap.tokenValue,
      tokenName: snappedGap.tokenName,
    });
  }

  if (node.primaryAxisSizingMode !== spec.primaryAxisSizingMode) {
    diffs.push({
      property: "primaryAxisSizingMode",
      before: node.primaryAxisSizingMode,
      after: spec.primaryAxisSizingMode,
    });
  }

  if (node.counterAxisSizingMode !== spec.counterAxisSizingMode) {
    diffs.push({
      property: "counterAxisSizingMode",
      before: node.counterAxisSizingMode,
      after: spec.counterAxisSizingMode,
    });
  }

  return diffs;
}

// ─── Figma script builder ─────────────────────────────────────────────────────

function buildApplyScript(nodeId: string, spec: AutoLayoutSpec, paddingPx: number, gapPx: number): string {
  const layoutMode = spec.direction === "WRAP" ? "HORIZONTAL" : spec.direction;
  const wrapLine = spec.direction === "WRAP"
    ? `node.layoutWrap = 'WRAP';`
    : `node.layoutWrap = 'NO_WRAP';`;

  return `
    const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
    if (!node) throw new Error('Node not found: ${nodeId}');
    if (!('layoutMode' in node)) throw new Error('Node does not support Auto Layout');
    node.layoutMode = ${JSON.stringify(layoutMode)};
    ${wrapLine}
    node.primaryAxisSizingMode = ${JSON.stringify(spec.primaryAxisSizingMode)};
    node.counterAxisSizingMode = ${JSON.stringify(spec.counterAxisSizingMode)};
    node.paddingLeft   = ${paddingPx};
    node.paddingRight  = ${paddingPx};
    node.paddingTop    = ${paddingPx};
    node.paddingBottom = ${paddingPx};
    node.itemSpacing   = ${gapPx};
    return { success: true };
  `.trim();
}

// ─── Responsive hints ─────────────────────────────────────────────────────────

function generateResponsiveHints(kind: ContainerKind | "unknown", spec: AutoLayoutSpec): string[] {
  const hints: string[] = [];

  if (kind === "navigation bar") {
    hints.push("On mobile (<768px): switch to VERTICAL and collapse secondary items into a hamburger menu.");
    hints.push("Ensure flex-shrink is applied to label text so icons stay visible at small widths.");
  } else if (kind === "card") {
    hints.push("In a responsive grid, let cards stretch to Fill-W; avoid Fixed widths.");
    hints.push("Increase padding to --space-xl on desktop for breathing room.");
  } else if (kind === "modal") {
    hints.push("On mobile: set width to Fill-W and reduce padding to --space-md.");
    hints.push("Use max-height: 90vh with scrollable content area to prevent overflow.");
  } else if (kind === "grid") {
    hints.push("Use Constraints → Scale on children so grid items resize proportionally.");
    hints.push("Reduce gap to --space-sm on mobile breakpoints.");
  } else if (kind === "form") {
    hints.push("Stack label + input vertically on mobile; use horizontal layout on desktop.");
  } else if (kind === "section") {
    hints.push("Reduce padding from --space-2xl to --space-xl on tablet and --space-lg on mobile.");
  }

  if (spec.direction === "HORIZONTAL") {
    hints.push("If children need to wrap at narrow viewports, enable layoutWrap = WRAP.");
  }

  return hints;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function layoutIntelligenceHandler(
  args: LayoutIntelligenceArgs
): Promise<LayoutIntelligenceResult> {
  const {
    nodeId,
    applyChanges,
    spacingTokenSet,  // reserved for future token-set override
    responsiveHints = false,
    reportDiff = true,
  } = args;

  if (!nodeId) throw new Error("layoutIntelligence: `nodeId` is required.");

  const bridge = await getBridge();

  // 1. Fetch the node tree
  const node = await bridge.getNode(nodeId);

  // 2. Detect container type
  const detectedKind = detectContainerKind(node);

  // 3. Resolve spec (fall back to "card" for unknown containers)
  const resolvedKind: ContainerKind = detectedKind === "unknown" ? "card" : detectedKind;
  const spec = CONTAINER_SPECS[resolvedKind];

  // Override spacing if spacingTokenSet is provided and matches a known token
  if (spacingTokenSet && SPACE[spacingTokenSet] !== undefined) {
    spec.paddingValue = SPACE[spacingTokenSet];
    spec.paddingToken = spacingTokenSet;
  }

  // 4. Snap spacing values
  const snappedPadding = snapToSpacingToken(spec.paddingValue);
  const snappedGap = snapToSpacingToken(spec.gapValue);

  // 5. Build diff
  const diff = reportDiff ? buildDiff(node, spec) : [];

  // 6. Apply if requested
  let applied = false;
  if (applyChanges) {
    const script = buildApplyScript(nodeId, spec, snappedPadding.tokenValue as number, snappedGap.tokenValue as number);
    const execResult = await bridge.execute(script);
    if (!execResult.success) {
      throw new Error(`layoutIntelligence: Failed to apply changes — ${execResult.error}`);
    }
    applied = true;
  }

  // 7. Log the decision
  const logEntry = await decisionLog.log({
    tool: "layout-intelligence",
    nodeIds: [nodeId],
    rationale: `Detected container kind "${detectedKind}" on node "${node.name}". Recommended spec: ${spec.direction}, padding=${snappedPadding.tokenName}, gap=${snappedGap.tokenName}. Applied: ${applied}. Diff properties changed: ${diff.length}.`,
    tokens: [snappedPadding.tokenName, snappedGap.tokenName],
    reversible: applied,
    metadata: { detectedKind, resolvedKind, spec, diffCount: diff.length },
  });

  const result: LayoutIntelligenceResult = {
    nodeId,
    nodeName: node.name,
    detectedKind,
    spec,
    diff,
    applied,
    logEntryId: logEntry.id,
  };

  if (responsiveHints) {
    result.responsiveHints = generateResponsiveHints(detectedKind, spec);
  }

  return result;
}
