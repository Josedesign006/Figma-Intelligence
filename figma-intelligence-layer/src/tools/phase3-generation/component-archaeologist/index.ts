// ─────────────────────────────────────────────────────────────────────────────
// Component Archaeologist
// Reverse-engineers an arbitrary Figma node into a named component pattern.
// Fingerprints the layer tree, snaps hardcoded values to design tokens, and
// optionally promotes the node to a library component with variable bindings.
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import {
  snapToColorToken,
  snapToSpacingToken,
  figmaRgbaToHex,
} from "../../../shared/token-utils.js";
import { resolveTokenId } from "../../../shared/token-binder.js";
import { FigmaNode, Token, TokenRef } from "../../../shared/types.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ComponentArchaeologistArgs {
  nodeId: string;
  outputAs: "analysis" | "component" | "both";
  bindToExisting?: boolean;
  createLibraryComponent?: boolean;
  generateDocStub?: boolean;
}

export interface PatternMatch {
  pattern: string;
  candidates: string[];
  confidence: number;
  rationale: string;
}

export interface TokenMapping {
  property: string;
  hardcodedValue: string;
  suggestedToken: string;
  tokenValue: string | number;
  delta: number | undefined;
}

export interface ComponentArchaeologistResult {
  nodeId: string;
  nodeName: string;
  patternMatches: PatternMatch[];
  bestMatch: string;
  tokenMappings: TokenMapping[];
  promotedComponentId: string | null;
  docStub: string | null;
  layerSummary: LayerSummary;
  logEntryId: string;
}

interface LayerSummary {
  totalLayers: number;
  depth: number;
  hasImage: boolean;
  hasIcon: boolean;
  hasText: boolean;
  hasInput: boolean;
  hasAvatar: boolean;
  textCount: number;
  rectangleCount: number;
  frameCount: number;
  vectorCount: number;
  layoutMode: "HORIZONTAL" | "VERTICAL" | "NONE" | undefined;
  childCount: number;
}

// ─── Layer fingerprinting ─────────────────────────────────────────────────────

type LayerSignal =
  | "icon"
  | "text"
  | "image"
  | "input"
  | "avatar"
  | "chevron"
  | "cta"
  | "title"
  | "body"
  | "label"
  | "subtitle";

function inferSignal(node: FigmaNode): LayerSignal[] {
  const signals: LayerSignal[] = [];
  const nameLower = node.name.toLowerCase();

  if (node.type === "TEXT") {
    signals.push("text");
    if (/heading|title|h[1-6]/.test(nameLower)) signals.push("title");
    if (/body|paragraph|description|content/.test(nameLower)) signals.push("body");
    if (/label|caption|eyebrow|overline/.test(nameLower)) signals.push("label");
    if (/subtitle|secondary|sub/.test(nameLower)) signals.push("subtitle");
    if (/button|cta|action|submit|primary/.test(nameLower)) signals.push("cta");
  }

  if (node.type === "VECTOR" || /icon|ico|glyph|symbol/.test(nameLower)) {
    signals.push("icon");
    if (/chevron|arrow|caret/.test(nameLower)) signals.push("chevron");
  }

  if (node.fills?.some((f) => f.type === "IMAGE")) {
    signals.push("image");
    if (/avatar|profile|photo|user|face/.test(nameLower)) signals.push("avatar");
  }

  if (/input|field|textfield|text-field|textarea/.test(nameLower)) {
    signals.push("input");
  }

  return signals;
}

function collectSignals(node: FigmaNode, depth = 0): LayerSignal[] {
  const signals = inferSignal(node);
  if (depth < 6 && node.children) {
    for (const child of node.children) {
      signals.push(...collectSignals(child, depth + 1));
    }
  }
  return signals;
}

function countLayerTypes(node: FigmaNode): LayerSummary {
  let totalLayers = 0;
  let maxDepth = 0;
  let hasImage = false;
  let hasIcon = false;
  let hasText = false;
  let hasInput = false;
  let hasAvatar = false;
  let textCount = 0;
  let rectangleCount = 0;
  let frameCount = 0;
  let vectorCount = 0;

  function walk(n: FigmaNode, depth: number) {
    totalLayers++;
    if (depth > maxDepth) maxDepth = depth;
    const nameLower = n.name.toLowerCase();

    if (n.type === "TEXT") {
      hasText = true;
      textCount++;
    }
    if (n.type === "RECTANGLE") rectangleCount++;
    if (n.type === "FRAME" || n.type === "GROUP") frameCount++;
    if (n.type === "VECTOR" || /icon/.test(nameLower)) {
      hasIcon = true;
      vectorCount++;
    }
    if (n.fills?.some((f) => f.type === "IMAGE")) {
      hasImage = true;
      if (/avatar|profile/.test(nameLower)) hasAvatar = true;
    }
    if (/input|field/.test(nameLower)) hasInput = true;

    if (n.children) {
      for (const child of n.children) walk(child, depth + 1);
    }
  }

  walk(node, 0);

  return {
    totalLayers,
    depth: maxDepth,
    hasImage,
    hasIcon,
    hasText,
    hasInput,
    hasAvatar,
    textCount,
    rectangleCount,
    frameCount,
    vectorCount,
    layoutMode: node.layoutMode,
    childCount: node.children?.length ?? 0,
  };
}

// ─── Pattern matching ─────────────────────────────────────────────────────────

interface PatternRule {
  pattern: string;
  candidates: string[];
  test: (signals: LayerSignal[], summary: LayerSummary) => boolean;
  confidence: (signals: LayerSignal[], summary: LayerSummary) => number;
  rationale: (signals: LayerSignal[], summary: LayerSummary) => string;
}

const PATTERN_RULES: PatternRule[] = [
  {
    pattern: "Icon + Text (horizontal)",
    candidates: ["Button", "MenuItem", "Breadcrumb", "Tab"],
    test: (s, summary) =>
      s.includes("icon") &&
      s.includes("text") &&
      summary.layoutMode === "HORIZONTAL" &&
      !s.includes("chevron"),
    confidence: (s) => (s.includes("cta") ? 0.92 : 0.78),
    rationale: (s) =>
      `Horizontal auto-layout with icon + text signal. ${s.includes("cta") ? "CTA text found — likely Button." : "No CTA signal — could be MenuItem or Tab."}`,
  },
  {
    pattern: "Image + Title + Body + CTA",
    candidates: ["Card", "FeatureTile"],
    test: (s) =>
      s.includes("image") &&
      s.includes("title") &&
      s.includes("body") &&
      s.includes("cta"),
    confidence: () => 0.89,
    rationale: () =>
      "Classic card anatomy: image hero, title heading, body copy, and a call-to-action.",
  },
  {
    pattern: "Label above + Input below",
    candidates: ["FormField", "TextInput"],
    test: (s) => s.includes("label") && s.includes("input"),
    confidence: () => 0.91,
    rationale: () =>
      "Label node above an input container — canonical form field pattern.",
  },
  {
    pattern: "Avatar + Name + Subtitle",
    candidates: ["UserProfile", "CommentHeader"],
    test: (s) => s.includes("avatar") && s.includes("text") && s.includes("subtitle"),
    confidence: (s) => (s.includes("subtitle") ? 0.88 : 0.72),
    rationale: (s) =>
      `Avatar image with ${s.includes("subtitle") ? "name and subtitle text layers" : "name text layer"} — user identity pattern.`,
  },
  {
    pattern: "Icon + Title + Chevron",
    candidates: ["ListItem", "NavigationRow"],
    test: (s) => s.includes("icon") && s.includes("title") && s.includes("chevron"),
    confidence: () => 0.9,
    rationale: () =>
      "Leading icon, title text, and trailing chevron — list item or navigation row.",
  },
  {
    pattern: "N equal-width columns",
    candidates: ["DataTable", "ComparisonCard"],
    test: (_, summary) =>
      summary.layoutMode === "HORIZONTAL" &&
      summary.childCount >= 3 &&
      summary.textCount >= 3,
    confidence: (_, summary) => (summary.childCount >= 4 ? 0.82 : 0.68),
    rationale: (_, summary) =>
      `${summary.childCount} equal-width children in horizontal layout — data table or comparison grid.`,
  },
  {
    pattern: "Image + Title",
    candidates: ["Card", "MediaCard", "ThumbnailItem"],
    test: (s) => s.includes("image") && s.includes("title") && !s.includes("body"),
    confidence: () => 0.74,
    rationale: () =>
      "Image with title but no body copy — compact media card or thumbnail.",
  },
  {
    pattern: "Text only",
    candidates: ["Heading", "Paragraph", "Badge", "Label"],
    test: (s, summary) =>
      s.includes("text") &&
      !s.includes("icon") &&
      !s.includes("image") &&
      summary.textCount <= 2,
    confidence: () => 0.6,
    rationale: () =>
      "Text-only node — standalone heading, label, badge, or paragraph.",
  },
];

function fingerprintPatterns(
  signals: LayerSignal[],
  summary: LayerSummary
): PatternMatch[] {
  const matches: PatternMatch[] = [];

  for (const rule of PATTERN_RULES) {
    if (rule.test(signals, summary)) {
      matches.push({
        pattern: rule.pattern,
        candidates: rule.candidates,
        confidence: rule.confidence(signals, summary),
        rationale: rule.rationale(signals, summary),
      });
    }
  }

  // Sort descending by confidence
  matches.sort((a, b) => b.confidence - a.confidence);
  return matches;
}

// ─── Token mapping ────────────────────────────────────────────────────────────

function extractTokenMappings(node: FigmaNode, tokens: Token[]): TokenMapping[] {
  const mappings: TokenMapping[] = [];

  function walkFills(n: FigmaNode, propertyPath: string) {
    if (n.fills) {
      for (let i = 0; i < n.fills.length; i++) {
        const fill = n.fills[i];
        if (fill.type === "SOLID" && fill.color && !fill.variableId) {
          const hex = figmaRgbaToHex(fill.color.r, fill.color.g, fill.color.b);
          const ref: TokenRef = snapToColorToken(hex, tokens);
          mappings.push({
            property: `${propertyPath}.fills[${i}]`,
            hardcodedValue: hex,
            suggestedToken: ref.tokenName,
            tokenValue: ref.tokenValue,
            delta: typeof ref.delta === "number" ? ref.delta : undefined,
          });
        }
      }
    }

    if (n.strokes) {
      for (let i = 0; i < n.strokes.length; i++) {
        const stroke = n.strokes[i];
        if (stroke.type === "SOLID" && stroke.color && !stroke.variableId) {
          const hex = figmaRgbaToHex(stroke.color.r, stroke.color.g, stroke.color.b);
          const ref: TokenRef = snapToColorToken(hex, tokens);
          mappings.push({
            property: `${propertyPath}.strokes[${i}]`,
            hardcodedValue: hex,
            suggestedToken: ref.tokenName,
            tokenValue: ref.tokenValue,
            delta: typeof ref.delta === "number" ? ref.delta : undefined,
          });
        }
      }
    }

    // Spacing
    const spacingProps: Array<keyof FigmaNode> = [
      "paddingLeft",
      "paddingRight",
      "paddingTop",
      "paddingBottom",
      "itemSpacing",
    ];
    for (const prop of spacingProps) {
      const val = n[prop];
      if (typeof val === "number" && val > 0) {
        const ref = snapToSpacingToken(val);
        if (ref.delta !== 0) {
          mappings.push({
            property: `${propertyPath}.${prop}`,
            hardcodedValue: `${val}px`,
            suggestedToken: ref.tokenName,
            tokenValue: ref.tokenValue,
            delta: ref.delta,
          });
        }
      }
    }

    if (n.children) {
      for (const child of n.children) {
        walkFills(child, `${propertyPath}/${child.name}`);
      }
    }
  }

  walkFills(node, node.name);
  return mappings;
}

// ─── Figma script: promote to component + bind variables ─────────────────────

function buildPromoteScript(
  nodeId: string,
  componentName: string,
  mappings: TokenMapping[],
  tokens: Token[]
): string {
  // Resolve actual variable IDs for fill/stroke bindings
  const resolvedBindings = mappings
    .filter((m) => m.property.includes("fills") || m.property.includes("strokes"))
    .slice(0, 20)
    .map((m) => {
      const variableId = resolveTokenId(m.suggestedToken, tokens);
      return { ...m, variableId };
    })
    .filter((m) => m.variableId !== null);

  // Generate actual setBoundVariable calls for resolved tokens
  const bindingLines = resolvedBindings.length > 0
    ? `
  // Bind resolved design-system variables
  const bindNode = async (n) => {
    if (n.fills) {
      for (let i = 0; i < n.fills.length; i++) {
        if (n.fills[i].type === 'SOLID' && !n.fills[i].boundVariables?.color) {
          const hex = (() => {
            const c = n.fills[i].color;
            const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
            return '#' + toHex(c.r) + toHex(c.g) + toHex(c.b);
          })();
          const mapping = ${JSON.stringify(resolvedBindings.map((m) => ({
            hex: m.hardcodedValue.toLowerCase(),
            variableId: m.variableId,
          })))};
          const match = mapping.find(m => m.hex === hex.toLowerCase());
          if (match) {
            const v = await figma.variables.getVariableByIdAsync(match.variableId);
            if (v) {
              const paints = [...n.fills];
              paints[i] = figma.variables.setBoundVariableForPaint(paints[i], 'color', v);
              n.fills = paints;
            }
          }
        }
      }
    }
    if (n.children) {
      for (const child of n.children) await bindNode(child);
    }
  };
  await bindNode(component);`
    : mappings
        .filter((m) => m.property.includes("fills"))
        .slice(0, 20)
        .map((m) => `  /* bind ${m.property} → ${m.suggestedToken} (${m.hardcodedValue}) — no matching variable found */`)
        .join("\n");

  return `
(async () => {
  const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
  if (!node) throw new Error('Node not found: ${nodeId}');

  // Clone to preserve original, then promote clone
  const clone = node.clone();
  clone.name = ${JSON.stringify(componentName)};
  node.parent.appendChild(clone);

  // Promote to main component if not already
  let component;
  if (clone.type === 'COMPONENT') {
    component = clone;
  } else if (typeof clone.createComponent === 'function') {
    component = clone.createComponent();
  } else {
    // Wrap in a frame-component approach
    component = figma.createComponent();
    component.name = ${JSON.stringify(componentName)};
    component.resize(clone.width || 100, clone.height || 40);
    node.parent.appendChild(component);
    const inst = clone;
    inst.x = 0;
    inst.y = 0;
    component.appendChild(inst);
  }

  // Rename layers to semantic names based on type
  const renameByType = (n) => {
    if (n.type === 'TEXT') {
      const lc = n.name.toLowerCase();
      if (!lc.includes('title') && !lc.includes('label') && !lc.includes('body')) {
        if (n.fontSize >= 20) n.name = 'title';
        else if (n.fontSize >= 14) n.name = 'body';
        else n.name = 'label';
      }
    }
    if (n.type === 'VECTOR' && !n.name.toLowerCase().includes('icon')) {
      n.name = 'icon';
    }
    if (n.children) n.children.forEach(renameByType);
  };
  renameByType(component);

${bindingLines}

  figma.viewport.scrollAndZoomIntoView([component]);
  return { componentId: component.id, name: component.name };
})();
`.trim();
}

// ─── Doc stub generator ───────────────────────────────────────────────────────

function buildDocStub(
  nodeName: string,
  bestMatch: string,
  candidates: string[],
  mappings: TokenMapping[]
): string {
  const tokenLines = mappings
    .slice(0, 10)
    .map((m) => `| \`${m.suggestedToken}\` | \`${m.hardcodedValue}\` | ${m.property} |`)
    .join("\n");

  return `# ${nodeName}

**Detected pattern:** ${bestMatch}
**Probable component types:** ${candidates.join(", ")}

## Overview
Auto-generated documentation stub from Component Archaeologist analysis.
Review and update the description below to accurately reflect this component's purpose.

> [TODO: Describe what this component does, when to use it, and any important usage notes.]

## Token Bindings

| Token | Hardcoded Value | Property |
|-------|----------------|----------|
${tokenLines || "| — | — | No hardcoded values found |"}

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| — | — | — | [TODO: Document props] |

## Usage

\`\`\`tsx
// [TODO: Add usage example]
import { ${bestMatch.replace(/\s+/g, "")} } from "@ds/components";
\`\`\`

## Variants

[TODO: Document available variants]

## Accessibility

[TODO: Document keyboard navigation, ARIA roles, and screen reader behaviour]

---
*Generated by Component Archaeologist on ${new Date().toISOString().split("T")[0]}*
`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function componentArchaeologistHandler(
  args: ComponentArchaeologistArgs
): Promise<ComponentArchaeologistResult> {
  const {
    nodeId,
    outputAs,
    createLibraryComponent = false,
    generateDocStub = false,
  } = args;

  if (!nodeId) throw new Error("componentArchaeologist: `nodeId` is required.");

  const bridge = await getBridge();

  // 1. Fetch node tree from Figma
  const node = await bridge.getNode(nodeId);
  if (!node) throw new Error(`componentArchaeologist: Node "${nodeId}" not found.`);

  // 2. Fetch tokens for snapping
  const tokens: Token[] = await bridge.getTokens();

  // 3. Summarize layers
  const layerSummary = countLayerTypes(node);

  // 4. Collect signals and fingerprint
  const signals = collectSignals(node);
  const patternMatches = fingerprintPatterns(signals, layerSummary);

  const topMatch = patternMatches[0] ?? {
    pattern: "Unknown",
    candidates: ["Component"],
    confidence: 0,
    rationale: "No pattern matched. Layer structure does not fit known templates.",
  };

  const bestMatch = topMatch.candidates[0] ?? "Component";

  // 5. Map hardcoded values to tokens
  const tokenMappings = extractTokenMappings(node, tokens);

  // 6. Optionally promote to component
  let promotedComponentId: string | null = null;
  if (
    (outputAs === "component" || outputAs === "both") &&
    createLibraryComponent
  ) {
    const componentName = `[DS] ${bestMatch} / ${node.name}`;
    const script = buildPromoteScript(nodeId, componentName, tokenMappings, tokens);
    const execResult = await bridge.execute(script);
    if (execResult.success && execResult.result) {
      const res = execResult.result as { componentId: string };
      promotedComponentId = res.componentId;
    } else {
      console.error(
        "componentArchaeologist: Promotion failed —",
        execResult.error
      );
    }
  }

  // 7. Generate doc stub
  const docStub = generateDocStub
    ? buildDocStub(
        node.name,
        topMatch.pattern,
        topMatch.candidates,
        tokenMappings
      )
    : null;

  // 8. Log the decision
  const logEntry = await decisionLog.log({
    tool: "component-archaeologist",
    nodeIds: [nodeId, ...(promotedComponentId ? [promotedComponentId] : [])],
    rationale: `Analysed "${node.name}" (${layerSummary.totalLayers} layers, depth ${layerSummary.depth}). Top pattern: "${topMatch.pattern}" → ${topMatch.candidates.join(", ")} (confidence ${(topMatch.confidence * 100).toFixed(0)}%). Mapped ${tokenMappings.length} hardcoded values to tokens. Promoted: ${!!promotedComponentId}.`,
    tokens: tokenMappings.map((m) => m.suggestedToken),
    reversible: true,
    metadata: {
      outputAs,
      createLibraryComponent,
      generateDocStub,
      patternCount: patternMatches.length,
      bestMatch,
      tokenMappingCount: tokenMappings.length,
      promotedComponentId,
    },
  });

  return {
    nodeId,
    nodeName: node.name,
    patternMatches,
    bestMatch,
    tokenMappings,
    promotedComponentId,
    docStub,
    layerSummary,
    logEntryId: logEntry.id,
  };
}
