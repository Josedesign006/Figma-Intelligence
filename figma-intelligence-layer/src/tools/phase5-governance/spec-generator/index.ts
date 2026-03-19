import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";

export interface GenerateSpecArgs {
  nodeId?: string;
  outputFormat: "json" | "report" | "figma-page" | "all";
  documentType?: "spec" | "anatomy-usage" | "accessibility" | "accessibility-annotation" | "full-documentation";
  includeTokens?: boolean;
  includeAnnotations?: boolean;
  pageName?: string;
  writeToDescription?: boolean;
}

export interface NodeSnapshot {
  id: string;
  name: string;
  type: string;
  description: string;
  width: number;
  height: number;
  layoutMode: string;
  itemSpacing: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  childCount: number;
  childNames: string[];
  textLayers: Array<{
    name: string;
    characters: string;
    fontFamily: string;
    fontStyle: string;
    fontSize: number;
    lineHeightPx: number | null;
  }>;
  fills: Array<{ type: string; label: string }>;
  strokes: Array<{ type: string; label: string }>;
  effects: Array<{ type: string; radius?: number; visible?: boolean }>;
  tokenAliases: string[];
  componentProperties: Array<{ name: string; type: string; value: string; options: string[] }>;
  variantProperties: Record<string, string>;
  variantGroupProperties: Record<string, string[]>;
  variants: Array<{
    id: string;
    name: string;
    description: string;
    properties: Record<string, string>;
  }>;
  scanNodes?: SnapshotNode[];
}

export interface SnapshotNode {
  id: string;
  parentId: string | null;
  parentName: string | null;
  name: string;
  type: string;
  depth: number;
  visible: boolean;
  childCount: number;
  layoutMode: string;
  text: string;
  componentPropertyNames: string[];
  variantPropertyKeys: string[];
  variantPropertyValues: string[];
}

export interface DesignSpec {
  target: {
    nodeId: string;
    name: string;
    type: string;
    description: string;
  };
  overview: {
    summary: string;
    size: string;
    layout: string;
    childCount: number;
  };
  anatomy: string[];
  variants: Array<{
    property: string;
    values: string[];
    defaultValue?: string;
  }>;
  states: string[];
  contentGuidance: string[];
  styling: {
    fills: string[];
    strokes: string[];
    effects: string[];
    tokenReferences: string[];
  };
  accessibility: {
    touchTarget?: string;
    typography: string[];
    considerations: string[];
  };
  implementationNotes: string[];
  documentationGaps: string[];
}

export interface GenerateSpecResult {
  spec: DesignSpec;
  report?: string;
  figmaPageId?: string;
  documents?: GeneratedDocument[];
  logEntryId: string;
}

type DocumentationSectionStyle = "bullets" | "paragraph" | "checklist";

export interface GeneratedDocumentSection {
  title: string;
  style: DocumentationSectionStyle;
  items: string[];
}

export interface GeneratedDocument {
  type: "anatomy-usage" | "accessibility" | "accessibility-annotation";
  title: string;
  summary: string;
  sections: GeneratedDocumentSection[];
}

function compactText(text: string, max = 140): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function sentenceCase(value: string): string {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

function normalizeTerm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function inferStates(snapshot: NodeSnapshot): string[] {
  const discovered = new Set<string>();

  for (const [property, values] of Object.entries(snapshot.variantGroupProperties)) {
    if (/state|status/i.test(property)) {
      values.forEach((value) => discovered.add(value));
    }
  }

  for (const prop of snapshot.componentProperties) {
    if (/state|status/i.test(prop.name)) {
      prop.options.forEach((value) => discovered.add(value));
      if (prop.value) discovered.add(prop.value);
    }
  }

  return Array.from(discovered);
}

function inferContentGuidance(snapshot: NodeSnapshot): string[] {
  const guidance: string[] = [];

  const textLayers = snapshot.textLayers.filter((layer) => layer.characters.trim().length > 0);
  if (textLayers.length === 0) {
    guidance.push("No text layers detected. Document expected labels, helper text, and empty-state copy manually.");
    return guidance;
  }

  const primary = textLayers[0];
  guidance.push(`Primary text layer: "${compactText(primary.characters, 60)}".`);

  if (textLayers.length > 1) {
    guidance.push(`Contains ${textLayers.length} text layers, so copy hierarchy should stay consistent across title, body, and meta text.`);
  }

  const longText = textLayers.find((layer) => layer.characters.length > 80);
  if (longText) {
    guidance.push(`One text layer is long-form ("${compactText(longText.characters, 80)}"), so define truncation and wrapping behavior in code.`);
  }

  return guidance;
}

function inferAccessibility(snapshot: NodeSnapshot): DesignSpec["accessibility"] {
  const typography = snapshot.textLayers.slice(0, 6).map((layer) => {
    const lineHeight = layer.lineHeightPx ? ` / ${Math.round(layer.lineHeightPx)}px` : "";
    return `${layer.name}: ${layer.fontFamily} ${layer.fontStyle} ${Math.round(layer.fontSize)}px${lineHeight}`;
  });

  const considerations: string[] = [];
  let touchTarget: string | undefined;

  if (/button|chip|tab|input|field|toggle/i.test(snapshot.name)) {
    if (snapshot.width < 44 || snapshot.height < 44) {
      touchTarget = `Current frame is ${Math.round(snapshot.width)}×${Math.round(snapshot.height)}px. Consider a minimum interactive target of 44×44px.`;
    } else {
      touchTarget = `Current frame is ${Math.round(snapshot.width)}×${Math.round(snapshot.height)}px, which clears a 44×44px touch-target heuristic.`;
    }
  }

  if (snapshot.tokenAliases.length === 0) {
    considerations.push("No variable aliases were detected on the target subtree. Token bindings should be verified before this becomes canonical documentation.");
  }

  if (snapshot.textLayers.some((layer) => layer.fontSize < 12)) {
    considerations.push("Contains text below 12px. Review readability and scaling behavior.");
  }

  if (snapshot.effects.some((effect) => effect.type === "DROP_SHADOW")) {
    considerations.push("Shadow-based emphasis is present. Confirm contrast still works in all themes and elevation levels.");
  }

  if (considerations.length === 0) {
    considerations.push("Run contrast and focus-state checks before publishing this component spec.");
  }

  return { touchTarget, typography, considerations };
}

function buildImplementationNotes(snapshot: NodeSnapshot): string[] {
  const notes: string[] = [];

  if (snapshot.layoutMode && snapshot.layoutMode !== "NONE") {
    notes.push(`Uses ${snapshot.layoutMode.toLowerCase()} auto layout with ${snapshot.itemSpacing}px item spacing.`);
  } else {
    notes.push("No auto layout detected. Code implementation will need explicit sizing and positioning rules.");
  }

  const paddingValues = [snapshot.paddingTop, snapshot.paddingRight, snapshot.paddingBottom, snapshot.paddingLeft];
  if (paddingValues.some((value) => value > 0)) {
    notes.push(`Container padding: ${snapshot.paddingTop}/${snapshot.paddingRight}/${snapshot.paddingBottom}/${snapshot.paddingLeft}px.`);
  }

  if (snapshot.variants.length > 0) {
    notes.push(`Variant set contains ${snapshot.variants.length} variants. Keep prop names aligned with these Figma properties.`);
  } else if (snapshot.componentProperties.length > 0) {
    notes.push(`Component exposes ${snapshot.componentProperties.length} component properties. Map them to public code props instead of hardcoding states.`);
  }

  if (snapshot.childNames.length > 0) {
    notes.push(`Top-level anatomy currently includes ${snapshot.childNames.slice(0, 6).join(", ")}.`);
  }

  return notes;
}

function buildDocumentationGaps(snapshot: NodeSnapshot, spec: Omit<DesignSpec, "documentationGaps">): string[] {
  const gaps: string[] = [];

  if (!snapshot.description || snapshot.description.trim().length < 16) {
    gaps.push("Target node has little or no description in Figma. Add usage guidance so generated specs stay accurate.");
  }

  if (spec.variants.length === 0) {
    gaps.push("No explicit variant matrix was detected. If this component has states in code, document them manually or convert the Figma asset into a component set.");
  }

  if (snapshot.tokenAliases.length === 0) {
    gaps.push("No token aliases were found in the scanned subtree, so token documentation is likely incomplete.");
  }

  if (snapshot.textLayers.length === 0) {
    gaps.push("No text layers were detected. Content guidance will need manual authoring.");
  }

  return gaps;
}

function buildSpec(snapshot: NodeSnapshot, includeTokens: boolean): DesignSpec {
  const summaryParts = [
    `${snapshot.name} is a ${snapshot.type.toLowerCase()} spec target`,
    snapshot.variants.length > 0
      ? `with ${snapshot.variants.length} documented variants`
      : snapshot.componentProperties.length > 0
        ? `with ${snapshot.componentProperties.length} exposed component properties`
        : "with no explicit variant matrix detected",
  ];

  const variants = Object.entries(snapshot.variantGroupProperties).map(([property, values]) => ({
    property,
    values,
    defaultValue: values[0],
  }));

  for (const prop of snapshot.componentProperties) {
    if (!variants.some((entry) => entry.property === prop.name) && prop.options.length > 0) {
      variants.push({
        property: prop.name,
        values: prop.options,
        defaultValue: prop.value || prop.options[0],
      });
    }
  }

  const baseSpec = {
    target: {
      nodeId: snapshot.id,
      name: snapshot.name,
      type: snapshot.type,
      description: snapshot.description || "",
    },
    overview: {
      summary: `${sentenceCase(summaryParts.join(" "))}.`,
      size: `${Math.round(snapshot.width)} × ${Math.round(snapshot.height)} px`,
      layout: snapshot.layoutMode === "NONE"
        ? "No auto layout detected"
        : `${sentenceCase(snapshot.layoutMode.toLowerCase())} auto layout`,
      childCount: snapshot.childCount,
    },
    anatomy: snapshot.childNames.length > 0 ? snapshot.childNames : ["No direct child layers detected"],
    variants,
    states: inferStates(snapshot),
    contentGuidance: inferContentGuidance(snapshot),
    styling: {
      fills: snapshot.fills.map((fill) => fill.label),
      strokes: snapshot.strokes.map((stroke) => stroke.label),
      effects: snapshot.effects.map((effect) => `${effect.type}${effect.radius ? ` (${effect.radius}px)` : ""}`),
      tokenReferences: includeTokens ? snapshot.tokenAliases : [],
    },
    accessibility: inferAccessibility(snapshot),
    implementationNotes: buildImplementationNotes(snapshot),
  };

  return {
    ...baseSpec,
    documentationGaps: buildDocumentationGaps(snapshot, baseSpec),
  };
}

function formatSpecReport(spec: DesignSpec): string {
  const lines = [
    `Design Spec: ${spec.target.name}`,
    `Node: ${spec.target.nodeId}`,
    `Type: ${spec.target.type}`,
    "",
    "Overview",
    `- ${spec.overview.summary}`,
    `- Size: ${spec.overview.size}`,
    `- Layout: ${spec.overview.layout}`,
    `- Child layers: ${spec.overview.childCount}`,
    "",
    "Anatomy",
    ...spec.anatomy.map((item) => `- ${item}`),
    "",
    "Variants",
    ...(spec.variants.length > 0
      ? spec.variants.map((variant) => `- ${variant.property}: ${variant.values.join(", ")}${variant.defaultValue ? ` (default: ${variant.defaultValue})` : ""}`)
      : ["- No explicit variants detected"]),
    "",
    "States",
    ...(spec.states.length > 0 ? spec.states.map((state) => `- ${state}`) : ["- No explicit states detected"]),
    "",
    "Content Guidance",
    ...spec.contentGuidance.map((item) => `- ${item}`),
    "",
    "Styling",
    ...(spec.styling.fills.length > 0 ? spec.styling.fills.map((item) => `- Fill: ${item}`) : ["- Fill tokens/colors not detected"]),
    ...(spec.styling.strokes.length > 0 ? spec.styling.strokes.map((item) => `- Stroke: ${item}`) : []),
    ...(spec.styling.effects.length > 0 ? spec.styling.effects.map((item) => `- Effect: ${item}`) : []),
    ...(spec.styling.tokenReferences.length > 0 ? spec.styling.tokenReferences.map((item) => `- Token: ${item}`) : []),
    "",
    "Accessibility",
    ...(spec.accessibility.touchTarget ? [`- ${spec.accessibility.touchTarget}`] : []),
    ...spec.accessibility.typography.map((item) => `- Typography: ${item}`),
    ...spec.accessibility.considerations.map((item) => `- ${item}`),
    "",
    "Implementation Notes",
    ...spec.implementationNotes.map((item) => `- ${item}`),
    "",
    "Documentation Gaps",
    ...spec.documentationGaps.map((item) => `- ${item}`),
  ];

  return lines.join("\n");
}

export function formatSpecDescription(spec: DesignSpec): string {
  const lines = [
    "# Dev Handoff",
    "",
    "## Overview",
    `- Frame: \`${spec.target.name}\``,
    `- Node: \`${spec.target.nodeId}\``,
    `- Type: \`${spec.target.type}\``,
    `- Size: \`${spec.overview.size.replace(" × ", " x ")}\``,
    `- Layout: ${spec.overview.layout}`,
    "",
    "## Anatomy",
    ...spec.anatomy.slice(0, 8).map((item) => `- ${item}`),
    "",
    "## Styling",
    ...(spec.styling.fills.length > 0 ? spec.styling.fills.slice(0, 4).map((item) => `- Fill: ${item}`) : ["- Fill details were not detected."]),
    ...(spec.styling.strokes.length > 0 ? spec.styling.strokes.slice(0, 4).map((item) => `- Stroke: ${item}`) : []),
    ...(spec.styling.effects.length > 0 ? spec.styling.effects.slice(0, 4).map((item) => `- Effect: ${item}`) : ["- No effects detected."]),
    ...(spec.styling.tokenReferences.length > 0 ? spec.styling.tokenReferences.slice(0, 6).map((item) => `- Token: ${item}`) : ["- No token aliases detected on this subtree."]),
    "",
    "## Content Guidance",
    ...spec.contentGuidance.slice(0, 6).map((item) => `- ${item}`),
    "",
    "## Typography",
    ...(spec.accessibility.typography.length > 0
      ? spec.accessibility.typography.slice(0, 8).map((item) => `- ${item}`)
      : ["- Typography details were not detected."]),
    "",
    "## Engineering Notes",
    ...spec.implementationNotes.slice(0, 8).map((item) => `- ${item}`),
    "",
    "## Gaps",
    ...(spec.documentationGaps.length > 0
      ? spec.documentationGaps.slice(0, 8).map((item) => `- ${item}`)
      : ["- No major documentation gaps detected."]),
  ];

  return lines.join("\n");
}

function normalizeDocumentType(value?: GenerateSpecArgs["documentType"]): NonNullable<GenerateSpecArgs["documentType"]> {
  return value ?? "spec";
}

function buildAnatomyUsageFallback(spec: DesignSpec): GeneratedDocument {
  const variantSummary =
    spec.variants.length > 0
      ? spec.variants.map((variant) => `${variant.property}: ${variant.values.join(", ")}`).slice(0, 6)
      : ["No explicit variant matrix detected. Capture supported sizes, hierarchies, and icon options manually."];

  return {
    type: "anatomy-usage",
    title: `${spec.target.name} Anatomy and Usage`,
    summary: `Usage-facing documentation for ${spec.target.name}, covering structure, variants, states, and implementation guardrails.`,
    sections: [
      {
        title: "Overview",
        style: "paragraph",
        items: [
          spec.overview.summary,
          `${spec.target.name} should preserve its documented size, layout behavior, and visual hierarchy across design and code.`,
        ],
      },
      {
        title: "Anatomy",
        style: "bullets",
        items: spec.anatomy.length > 0 ? spec.anatomy : ["No direct child layers detected."],
      },
      {
        title: "Variants and states",
        style: "bullets",
        items: variantSummary.concat(
          spec.states.length > 0
            ? [`States: ${spec.states.join(", ")}`]
            : ["States: default state should be documented manually."]
        ),
      },
      {
        title: "Content guidance",
        style: "bullets",
        items: spec.contentGuidance,
      },
      {
        title: "Usage guidelines",
        style: "checklist",
        items: [
          "Use the component only for the action prominence implied by its hierarchy and styling.",
          "Keep labels concise and action-oriented so the primary intent is obvious at a glance.",
          "Preserve token bindings, spacing, and typography when creating new states or product-specific variations.",
          "Avoid creating ad hoc variants in code that are not represented in the design-system contract.",
        ],
      },
      {
        title: "Implementation notes",
        style: "bullets",
        items: spec.implementationNotes.concat(
          spec.documentationGaps.length > 0
            ? spec.documentationGaps.map((gap) => `Gap: ${gap}`)
            : []
        ),
      },
    ],
  };
}

function buildAccessibilityFallback(spec: DesignSpec): GeneratedDocument {
  const typography = spec.accessibility.typography.length > 0
    ? spec.accessibility.typography
    : ["Typography details were not detected. Confirm readable sizing and line height manually."];

  return {
    type: "accessibility",
    title: `${spec.target.name} Accessibility`,
    summary: `Accessibility documentation for ${spec.target.name}, including interaction, semantics, readability, and QA expectations.`,
    sections: [
      {
        title: "Core requirements",
        style: "bullets",
        items: [
          spec.accessibility.touchTarget || "Confirm that the rendered interactive target meets a 44×44px minimum heuristic.",
          "Document visible focus treatment and make sure it remains distinguishable in every supported theme.",
          "Verify contrast for label, icon, stroke, and focus indicator colors across all states.",
        ],
      },
      {
        title: "Keyboard interaction",
        style: "checklist",
        items: [
          "Define how focus reaches the component and where it moves next in the tab order.",
          "Document the activation keys expected for the control type, including Enter and Space when relevant.",
          "Document disabled-state behavior so the keyboard contract stays aligned with the semantic state.",
        ],
      },
      {
        title: "Screen reader and semantics",
        style: "bullets",
        items: [
          "Use the native semantic role whenever possible and avoid replacing it with a generic container.",
          "Provide accessible naming that describes the action or destination, especially for icon-only variants.",
          "Hide decorative icons from assistive technologies when they duplicate visible label meaning.",
        ],
      },
      {
        title: "Typography and readability",
        style: "bullets",
        items: typography,
      },
      {
        title: "Validation checklist",
        style: "checklist",
        items: spec.accessibility.considerations,
      },
    ],
  };
}

interface AccessibilityAnnotationContext {
  scope: string;
  assumptions: string[];
  keyboardTabOrder: string[];
  readingOrder: string[];
  announcements: string[];
  focusManagement: string[];
  implementationNotes: string[];
}

interface InferredFocusableNode {
  node: SnapshotNode;
  label: string;
  role: string;
  state: string[];
}

function buildSnapshotIndex(snapshot: NodeSnapshot): {
  nodes: SnapshotNode[];
  byId: Map<string, SnapshotNode>;
  childrenByParent: Map<string, SnapshotNode[]>;
} {
  const nodes = snapshot.scanNodes || [];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, SnapshotNode[]>();

  for (const node of nodes) {
    if (!node.parentId) continue;
    const siblings = childrenByParent.get(node.parentId) || [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  return { nodes, byId, childrenByParent };
}

function collectDescendants(nodeId: string, childrenByParent: Map<string, SnapshotNode[]>): SnapshotNode[] {
  const results: SnapshotNode[] = [];
  const queue = [...(childrenByParent.get(nodeId) || [])];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    results.push(current);
    queue.push(...(childrenByParent.get(current.id) || []));
  }
  return results;
}

function inferRole(node: SnapshotNode): string | undefined {
  const haystack = normalizeTerm([
    node.name,
    node.text,
    ...node.componentPropertyNames,
    ...node.variantPropertyKeys,
    ...node.variantPropertyValues,
  ].join(" "));

  if (/(dialog|modal|sheet|drawer|popup)/.test(haystack)) return "Dialog";
  if (/(combobox|typeahead|autocomplete)/.test(haystack)) return "Combobox";
  if (/(dropdown|select|picker)\b/.test(haystack)) return "Select";
  if (/(search|input|field|email|password|phone|amount|date|otp|textbox|text field)/.test(haystack)) return "Text field";
  if (/(accordion|disclosure|expand|collapse)/.test(haystack)) return "Accordion header";
  if (/\btab\b/.test(haystack)) return "Tab";
  if (/(checkbox|check box)/.test(haystack)) return "Checkbox";
  if (/(radio|option card|option set)/.test(haystack)) return "Radio option";
  if (/(switch|toggle)/.test(haystack)) return "Switch";
  if (/(slider|range)/.test(haystack)) return "Slider";
  if (/(link|anchor|breadcrumb)/.test(haystack)) return "Link";
  if (/\b(button|cta|submit|continue|next|back|cancel|save|apply|done|close)\b|place order\b|pay now\b/.test(haystack)) return "Button";
  if (node.type === "INSTANCE" || node.type === "COMPONENT") {
    return "Interactive control";
  }
  return undefined;
}

function inferState(node: SnapshotNode): string[] {
  const haystack = normalizeTerm([
    node.name,
    node.text,
    ...node.variantPropertyValues,
    ...node.variantPropertyKeys,
  ].join(" "));
  const states: string[] = [];
  if (/(disabled)/.test(haystack)) states.push("disabled");
  if (/(selected|active|checked|current)/.test(haystack)) states.push("selected");
  if (/(expanded|open)/.test(haystack)) states.push("expanded");
  if (/(collapsed|closed)/.test(haystack)) states.push("collapsed");
  if (/(error|invalid)/.test(haystack)) states.push("invalid");
  if (/(required)/.test(haystack)) states.push("required");
  return states;
}

function summarizeNodeLabel(node: SnapshotNode): string {
  const label = node.text || node.name || "Unnamed control";
  return label.replace(/\s+/g, " ").trim().slice(0, 80);
}

function inferFocusableNode(node: SnapshotNode): InferredFocusableNode | undefined {
  if (!node.visible || node.type === "TEXT") return undefined;
  const role = inferRole(node);
  if (!role) return undefined;
  return {
    node,
    label: summarizeNodeLabel(node),
    role,
    state: inferState(node),
  };
}

function isMeaningfulTextNode(node: SnapshotNode): boolean {
  if (!node.visible || node.type !== "TEXT") return false;
  const value = node.text.replace(/\s+/g, " ").trim();
  return value.length > 0;
}

function inferPrimaryInteractionArea(snapshot: NodeSnapshot): { scope: string; areaNodeId: string } {
  const { childrenByParent, byId } = buildSnapshotIndex(snapshot);
  const rootId = snapshot.id;
  const topLevelChildren = childrenByParent.get(rootId) || [];
  if (topLevelChildren.length === 0) {
    return { scope: `${snapshot.name} primary flow`, areaNodeId: rootId };
  }

  let winner: SnapshotNode | undefined;
  let bestScore = -1;
  for (const child of topLevelChildren) {
    const descendants = collectDescendants(child.id, childrenByParent);
    const focusableCount = descendants.map(inferFocusableNode).filter(Boolean).length + (inferFocusableNode(child) ? 1 : 0);
    const textCount = descendants.filter(isMeaningfulTextNode).length;
    const score = focusableCount * 4 + textCount;
    if (score > bestScore) {
      winner = child;
      bestScore = score;
    }
  }

  if (!winner || bestScore <= 0) {
    return { scope: `${snapshot.name} primary flow`, areaNodeId: rootId };
  }

  const parent = winner.parentId ? byId.get(winner.parentId) : undefined;
  const scope = parent && parent.id === rootId
    ? `${winner.name} section within ${snapshot.name}`
    : `${winner.name} interaction area`;
  return { scope, areaNodeId: winner.id };
}

function buildAccessibilityAnnotationContext(snapshot: NodeSnapshot): AccessibilityAnnotationContext {
  const { nodes, byId, childrenByParent } = buildSnapshotIndex(snapshot);
  const area = inferPrimaryInteractionArea(snapshot);
  const relevantIds = new Set<string>([area.areaNodeId, ...collectDescendants(area.areaNodeId, childrenByParent).map((node) => node.id)]);
  const relevantNodes = nodes.filter((node) => relevantIds.has(node.id));
  const focusable = relevantNodes
    .map(inferFocusableNode)
    .filter((node): node is InferredFocusableNode => Boolean(node));
  const visibleText = relevantNodes.filter(isMeaningfulTextNode);

  const keyboardTabOrder = focusable.length > 0
    ? focusable.map((entry, index) => {
        const stateSuffix = entry.state.length > 0 ? ` (${entry.state.join(", ")})` : "";
        return `${index + 1}. ${entry.label} - ${entry.role}${stateSuffix}`;
      })
    : ["1. No focusable controls were confidently detected. Review the selected frame and component naming before using this annotation as canonical."];

  const readingOrderItems: string[] = [];
  const seenReading = new Set<string>();
  for (const node of relevantNodes) {
    const focusableNode = inferFocusableNode(node);
    if (focusableNode) {
      const line = `${focusableNode.label} - ${focusableNode.role}`;
      if (!seenReading.has(line)) {
        seenReading.add(line);
        readingOrderItems.push(line);
      }
      continue;
    }

    if (isMeaningfulTextNode(node)) {
      const value = node.text.replace(/\s+/g, " ").trim();
      const normalized = normalizeTerm(value);
      if (seenReading.has(normalized)) continue;
      seenReading.add(normalized);
      const kind = /(title|heading|header)/.test(normalizeTerm(node.name)) || node.depth <= 2 ? "Heading" : "Text";
      readingOrderItems.push(`${kind}: ${value.slice(0, 120)}`);
    }
  }

  const hasAccordion = focusable.some((entry) => entry.role === "Accordion header");
  const hasCombobox = focusable.some((entry) => entry.role === "Combobox" || entry.role === "Select");
  const hasDialog = focusable.some((entry) => entry.role === "Dialog");
  const submitControl = focusable.find((entry) => /(submit|continue|next|save|pay|place order|done)/.test(normalizeTerm(entry.label)));
  const fieldControls = focusable.filter((entry) => /(Text field|Combobox|Select|Checkbox|Radio option|Switch|Slider)/.test(entry.role));

  const announcements = focusable.slice(0, 12).map((entry) => {
    if (entry.role === "Text field") {
      return `"${entry.label}" announces as edit field${entry.state.includes("required") ? ", required" : ""}${entry.state.includes("invalid") ? ", invalid" : ""}.`;
    }
    if (entry.role === "Combobox" || entry.role === "Select") {
      return `"${entry.label}" announces as ${entry.role.toLowerCase()}${entry.state.includes("expanded") ? ", expanded" : ", collapsed"} and must announce the active option while navigating.`;
    }
    if (entry.role === "Accordion header") {
      return `"${entry.label}" announces as button${entry.state.includes("expanded") ? ", expanded" : ", collapsed"} and toggles its associated panel without moving hidden content into the tab order.`;
    }
    if (entry.role === "Checkbox" || entry.role === "Switch" || entry.role === "Radio option") {
      return `"${entry.label}" announces as ${entry.role.toLowerCase()}${entry.state.includes("selected") ? ", selected" : ""} with state changes spoken immediately after activation.`;
    }
    return `"${entry.label}" announces as ${entry.role.toLowerCase()}${entry.state.length > 0 ? ` (${entry.state.join(", ")})` : ""}.`;
  });

  if (hasAccordion) {
    announcements.push("Accordion expand/collapse must update aria-expanded on the trigger and only expose panel content to keyboard and screen reader users when expanded.");
  }
  if (hasCombobox) {
    announcements.push("Combobox open, active-option changes, selection commit, and collapse events must all produce consistent spoken feedback.");
  }
  if (submitControl) {
    announcements.push(`"${submitControl.label}" should announce progress or completion feedback after activation instead of leaving users on a silent state change.`);
  }
  if (fieldControls.length > 0) {
    announcements.push("Validation errors must be programmatically tied to their fields and announced when focus lands on the first invalid control.");
  }

  const assumptions = [
    `Scope is limited to ${area.scope}. Global navigation, chrome, and decorative content are intentionally excluded.`,
    "Tab and reading order follow the visible Figma hierarchy and auto-layout order from the inspected frame.",
    hasAccordion
      ? "Accordion panel content is included only when the inspected state is expanded; collapsed content should be removed from the tab sequence."
      : "Conditional content is assumed to be excluded from the tab sequence until visually revealed.",
  ];

  const focusManagement = [
    `Initial focus should enter at the first interactive control in scope: ${focusable[0]?.label || "the first enabled control"}.`,
    hasAccordion
      ? "Expanding or collapsing an accordion should keep focus on the trigger unless the product intentionally moves focus into newly revealed content."
      : "Screen updates inside the flow should preserve logical focus position and avoid unexpected jumps.",
    fieldControls.length > 0
      ? "On validation failure, move focus to the first invalid field, preserve the user's entered value, and announce the associated error message."
      : "If the flow surfaces validation or inline errors, move focus to the first actionable recovery point.",
    submitControl
      ? `On success after "${submitControl.label}", move focus to the success heading, toast, confirmation summary, or next-step landmark.`
      : "On successful completion, move focus to the updated heading, confirmation message, or next-step container.",
    hasDialog
      ? "Any modal or dialog in this flow must trap focus while open and return focus to the invoking control on close."
      : "If a dialog opens from this flow, trap focus while it is open and restore focus to the invoking control on close.",
  ];

  const implementationNotes = [
    "Use native HTML controls first. Add ARIA only where native semantics cannot express the intended behavior.",
    "Keep DOM order aligned with the visual order documented here; do not rearrange with CSS in ways that break keyboard or virtual cursor expectations.",
    "Expose one logical tab stop per interactive control. Hidden panels, helper text, and decorative icons must not become accidental tab stops.",
    hasCombobox
      ? "For comboboxes, choose one focus model and implement it consistently: input focus with aria-activedescendant, or managed focus inside the popup."
      : "Associate helper, error, and status text with the relevant control instead of relying on proximity alone.",
    hasAccordion
      ? "Accordion headers should be real buttons with aria-controls and aria-expanded; the panel itself should not be focusable unless it contains interactive descendants."
      : "Use headings, fieldsets, legends, and grouped labels where the flow structure needs to be announced to screen reader users.",
    submitControl
      ? `Do not disable or replace "${submitControl.label}" without an equivalent programmatic state announcement.`
      : "Do not swap control semantics across states without preserving a stable accessible name and keyboard contract.",
  ];

  return {
    scope: area.scope,
    assumptions,
    keyboardTabOrder,
    readingOrder: readingOrderItems.length > 0 ? readingOrderItems : ["Reading order could not be derived confidently from the inspected frame."],
    announcements,
    focusManagement,
    implementationNotes,
  };
}

export function buildAccessibilityAnnotationDocument(snapshot: NodeSnapshot, spec: DesignSpec): GeneratedDocument {
  const annotation = buildAccessibilityAnnotationContext(snapshot);
  return {
    type: "accessibility-annotation",
    title: `${spec.target.name} Accessibility Annotation`,
    summary: `Screen-level accessibility annotation for ${spec.target.name}, focused on keyboard tab order, screen reader reading order, announcements, and focus management inside Figma.`,
    sections: [
      {
        title: "Scope",
        style: "paragraph",
        items: [annotation.scope],
      },
      {
        title: "Assumptions",
        style: "bullets",
        items: annotation.assumptions,
      },
      {
        title: "Keyboard Tab Order",
        style: "bullets",
        items: annotation.keyboardTabOrder,
      },
      {
        title: "Screen Reader Reading Order",
        style: "bullets",
        items: annotation.readingOrder,
      },
      {
        title: "Screen Reader Interaction Announcements",
        style: "bullets",
        items: annotation.announcements,
      },
      {
        title: "Focus Management & State Changes",
        style: "bullets",
        items: annotation.focusManagement,
      },
      {
        title: "Implementation Notes for Developers",
        style: "bullets",
        items: annotation.implementationNotes,
      },
    ],
  };
}

export function formatDocumentReport(document: GeneratedDocument): string {
  const lines = [
    document.title,
    "",
    document.summary,
    "",
  ];

  for (const section of document.sections) {
    lines.push(section.title);
    for (const item of section.items) {
      lines.push(section.style === "paragraph" ? item : `- ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

async function generateDocumentWithAI(
  spec: DesignSpec,
  document: GeneratedDocument
): Promise<GeneratedDocument> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return document;
  }

  const model = process.env.DOCS_MODEL || process.env.OPENAI_MODEL || process.env.VISION_MODEL || "gpt-4.1-mini";
  const apiUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/responses";
  const sectionLimit = document.type === "anatomy-usage" ? 6 : document.type === "accessibility-annotation" ? 7 : 5;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You write design-system documentation. Return strict JSON only. Keep guidance concrete, implementation-aware, and grounded in the provided Figma-derived metadata.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                task: `Generate a ${document.type} documentation page for a Figma component.`,
                constraints: {
                  maxSections: sectionLimit,
                  maxItemsPerSection: 5,
                  keepClaimsGroundedInInput: true,
                  avoidMarketingLanguage: true,
                },
                seedDocument: document,
                spec,
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "generated_component_document",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              sections: {
                type: "array",
                maxItems: sectionLimit,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    style: { type: "string", enum: ["bullets", "paragraph", "checklist"] },
                    items: {
                      type: "array",
                      maxItems: 5,
                      items: { type: "string" },
                    },
                  },
                  required: ["title", "style", "items"],
                },
              },
            },
            required: ["title", "summary", "sections"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`figma_generate_spec: AI document generation failed (${response.status}) ${body}`);
  }

  const payload = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  const text = (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("")
    .trim();

  if (!text) {
    return document;
  }

  const parsed = JSON.parse(text) as Omit<GeneratedDocument, "type">;
  return {
    type: document.type,
    title: parsed.title || document.title,
    summary: parsed.summary || document.summary,
    sections: Array.isArray(parsed.sections) && parsed.sections.length > 0 ? parsed.sections : document.sections,
  };
}

async function buildGeneratedDocuments(
  snapshot: NodeSnapshot,
  spec: DesignSpec,
  documentType: NonNullable<GenerateSpecArgs["documentType"]>
): Promise<GeneratedDocument[]> {
  const seeds: GeneratedDocument[] = [];

  if (documentType === "anatomy-usage" || documentType === "full-documentation") {
    seeds.push(buildAnatomyUsageFallback(spec));
  }

  if (documentType === "accessibility" || documentType === "full-documentation") {
    seeds.push(buildAccessibilityFallback(spec));
  }

  if (documentType === "accessibility-annotation") {
    seeds.push(buildAccessibilityAnnotationDocument(snapshot, spec));
  }

  if (seeds.length === 0) {
    return [];
  }

  const documents: GeneratedDocument[] = [];
  for (const seed of seeds) {
    try {
      documents.push(await generateDocumentWithAI(spec, seed));
    } catch {
      documents.push(seed);
    }
  }

  return documents;
}

export async function resolveTargetNodeId(args: GenerateSpecArgs): Promise<string> {
  if (args.nodeId) return args.nodeId;

  const bridge = await getBridge();
  const selection = await bridge.getSelection();
  if (selection.length === 0) {
    throw new Error("figma_generate_spec: Provide a nodeId or select a node in Figma before running this tool.");
  }

  return selection[0].id;
}

export async function captureSnapshot(nodeId: string): Promise<NodeSnapshot> {
  const bridge = await getBridge();
  const runPart = async <T>(label: string, code: string): Promise<T> => {
    const result = await bridge.execute(`
      (async () => {
        await figma.loadAllPagesAsync();
        const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
        if (!node) throw new Error("Node not found: " + ${JSON.stringify(nodeId)});
        ${code}
      })();
    `);

    if (!result.success) {
      throw new Error(`figma_generate_spec: failed to inspect node ${nodeId} (${label}): ${result.error}`);
    }

    return result.result as T;
  };

  const base = await runPart<Omit<NodeSnapshot, "textLayers" | "tokenAliases" | "componentProperties" | "variantGroupProperties" | "variants">>(
    "base metadata",
    `
      function describePaint(paint) {
        if (!paint) return null;
        if (paint.type === "SOLID" && paint.color) {
          var r = Math.round((paint.color.r || 0) * 255);
          var g = Math.round((paint.color.g || 0) * 255);
          var b = Math.round((paint.color.b || 0) * 255);
          return { type: "SOLID", label: "rgb(" + r + ", " + g + ", " + b + ")" };
        }
        if (paint.type === "VARIABLE_ALIAS") {
          return { type: "VARIABLE_ALIAS", label: paint.boundVariableId || paint.variableId || "Variable alias" };
        }
        return { type: paint.type || "UNKNOWN", label: paint.type || "UNKNOWN" };
      }

      return {
        id: node.id,
        name: node.name,
        type: node.type,
        description: node.description || "",
        width: "width" in node ? node.width || 0 : 0,
        height: "height" in node ? node.height || 0 : 0,
        layoutMode: "layoutMode" in node ? String(node.layoutMode || "NONE") : "NONE",
        itemSpacing: "itemSpacing" in node ? Number(node.itemSpacing || 0) : 0,
        paddingTop: "paddingTop" in node ? Number(node.paddingTop || 0) : 0,
        paddingRight: "paddingRight" in node ? Number(node.paddingRight || 0) : 0,
        paddingBottom: "paddingBottom" in node ? Number(node.paddingBottom || 0) : 0,
        paddingLeft: "paddingLeft" in node ? Number(node.paddingLeft || 0) : 0,
        childCount: "children" in node ? node.children.length : 0,
        childNames: "children" in node ? node.children.slice(0, 12).map(function(child) { return child.name; }) : [],
        fills: Array.isArray(node.fills) ? node.fills.map(describePaint).filter(Boolean) : [],
        strokes: Array.isArray(node.strokes) ? node.strokes.map(describePaint).filter(Boolean) : [],
        effects: Array.isArray(node.effects) ? node.effects.map(function(effect) {
          return { type: effect.type, radius: effect.radius, visible: effect.visible };
        }) : [],
        variantProperties: "variantProperties" in node && node.variantProperties ? node.variantProperties : {},
      };
    `
  );

  const textLayers = await runPart<NodeSnapshot["textLayers"]>(
    "text layers",
    `
      var scannedNodes = [];
      if ("children" in node) {
        var queue = [node];
        while (queue.length > 0 && scannedNodes.length < 60) {
          var current = queue.shift();
          if (!current) break;
          scannedNodes.push(current);
          if ("children" in current && current.children.length > 0) {
            for (const child of current.children.slice(0, 8)) {
              queue.push(child);
            }
          }
        }
      } else {
        scannedNodes = [node];
      }

      var textLayers = [];
      for (const scannedNode of scannedNodes) {
        if (scannedNode.type !== "TEXT") continue;
        const textNode = scannedNode;
        textLayers.push({
          name: textNode.name,
          characters: textNode.characters || "",
          fontFamily: textNode.fontName === figma.mixed ? "Mixed" : textNode.fontName.family,
          fontStyle: textNode.fontName === figma.mixed ? "Mixed" : textNode.fontName.style,
          fontSize: typeof textNode.fontSize === "number" ? textNode.fontSize : 0,
          lineHeightPx: textNode.lineHeight && typeof textNode.lineHeight.value === "number"
            ? textNode.lineHeight.unit === "PIXELS" ? textNode.lineHeight.value : null
            : null,
        });
        if (textLayers.length >= 12) break;
      }

      if (node.type === "TEXT" && textLayers.length === 0) {
        textLayers.push({
          name: node.name,
          characters: node.characters || "",
          fontFamily: node.fontName === figma.mixed ? "Mixed" : node.fontName.family,
          fontStyle: node.fontName === figma.mixed ? "Mixed" : node.fontName.style,
          fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
          lineHeightPx: node.lineHeight && typeof node.lineHeight.value === "number"
            ? node.lineHeight.unit === "PIXELS" ? node.lineHeight.value : null
            : null,
        });
      }

      return textLayers;
    `
  );

  const tokenAliases = await runPart<string[]>(
    "token aliases",
    `
      function collectAliasesFromPaints(paints, sink) {
        if (!Array.isArray(paints)) return;
        for (const paint of paints) {
          if (paint && paint.type === "VARIABLE_ALIAS") {
            sink.push(String(paint.boundVariableId || paint.variableId || "variable-alias"));
          }
        }
      }

      var scannedNodes = [];
      if ("children" in node) {
        var queue = [node];
        while (queue.length > 0 && scannedNodes.length < 60) {
          var current = queue.shift();
          if (!current) break;
          scannedNodes.push(current);
          if ("children" in current && current.children.length > 0) {
            for (const child of current.children.slice(0, 8)) {
              queue.push(child);
            }
          }
        }
      } else {
        scannedNodes = [node];
      }

      var tokenAliases = [];
      for (const scanned of scannedNodes) {
        collectAliasesFromPaints(scanned.fills, tokenAliases);
        collectAliasesFromPaints(scanned.strokes, tokenAliases);
      }

      return Array.from(new Set(tokenAliases));
    `
  );

  const componentShape = await runPart<Pick<NodeSnapshot, "componentProperties" | "variantGroupProperties" | "variants">>(
    "component metadata",
    `
      var componentProperties = [];
      if ("componentProperties" in node && node.componentProperties) {
        for (const [name, prop] of Object.entries(node.componentProperties)) {
          componentProperties.push({
            name: name,
            type: String(prop.type || ""),
            value: prop.value === undefined ? "" : String(prop.value),
            options: Array.isArray(prop.variantOptions) ? prop.variantOptions.map(String) : [],
          });
        }
      }

      var variantGroupProperties = {};
      var variants = [];
      if (node.type === "COMPONENT_SET") {
        for (const [name, prop] of Object.entries(node.variantGroupProperties || {})) {
          variantGroupProperties[name] = Array.isArray(prop.values) ? prop.values.map(String) : [];
        }
        for (const child of node.children.slice(0, 40)) {
          variants.push({
            id: child.id,
            name: child.name,
            description: child.description || "",
            properties: child.variantProperties || {},
          });
        }
      }

      return {
        componentProperties: componentProperties,
        variantGroupProperties: variantGroupProperties,
        variants: variants,
      };
    `
  );

  const scanNodes = await runPart<SnapshotNode[]>(
    "interaction tree",
    `
      function collectTextContent(target) {
        if (target.type === "TEXT") {
          return (target.characters || "").trim();
        }
        if (!("children" in target)) return "";
        const parts = [];
        const queue = [...target.children.slice(0, 8)];
        while (queue.length > 0 && parts.length < 3) {
          const current = queue.shift();
          if (!current) break;
          if (current.type === "TEXT" && current.characters && current.characters.trim()) {
            parts.push(current.characters.trim());
          }
          if ("children" in current && current.children.length > 0) {
            queue.push(...current.children.slice(0, 6));
          }
        }
        return parts.join(" ").slice(0, 140);
      }

      const result = [];
      const queue = [{ current: node, depth: 0, parentId: null, parentName: null }];
      while (queue.length > 0 && result.length < 160) {
        const item = queue.shift();
        if (!item) break;
        const current = item.current;
        result.push({
          id: current.id,
          parentId: item.parentId,
          parentName: item.parentName,
          name: current.name || "",
          type: current.type,
          depth: item.depth,
          visible: current.visible !== false,
          childCount: "children" in current ? current.children.length : 0,
          layoutMode: "layoutMode" in current ? String(current.layoutMode || "NONE") : "NONE",
          text: collectTextContent(current),
          componentPropertyNames: "componentProperties" in current && current.componentProperties
            ? Object.keys(current.componentProperties)
            : [],
          variantPropertyKeys: "variantProperties" in current && current.variantProperties
            ? Object.keys(current.variantProperties)
            : [],
          variantPropertyValues: "variantProperties" in current && current.variantProperties
            ? Object.values(current.variantProperties).map(String)
            : [],
        });

        if ("children" in current && current.children.length > 0 && item.depth < 7) {
          for (const child of current.children.slice(0, 20)) {
            queue.push({
              current: child,
              depth: item.depth + 1,
              parentId: current.id,
              parentName: current.name || "",
            });
          }
        }
      }

      return result;
    `
  );

  return {
    ...base,
    textLayers,
    tokenAliases,
    componentProperties: componentShape.componentProperties,
    variantGroupProperties: componentShape.variantGroupProperties,
    variants: componentShape.variants,
    scanNodes,
  };
}

async function createSpecPage(spec: DesignSpec, _report: string, pageName?: string): Promise<string> {
  const bridge = await getBridge();
  const result = await bridge.execute(`
    (async () => {
      const spec = ${JSON.stringify(spec)};
      await figma.loadAllPagesAsync();
      const existing = figma.root.children.find((p) => p.name === ${JSON.stringify(pageName || `Spec - ${spec.target.name}`)});
      const page = existing || figma.createPage();
      page.name = ${JSON.stringify(pageName || `Spec - ${spec.target.name}`)};
      await figma.setCurrentPageAsync(page);

      for (const child of [...page.children]) {
        child.remove();
      }

      const fonts = [
        { family: "Geist", style: "Regular" },
        { family: "Geist", style: "Medium" },
        { family: "Libre Franklin", style: "SemiBold" },
        { family: "Cormorant Garamond", style: "Italic" },
      ];

      for (const font of fonts) {
        await figma.loadFontAsync(font);
      }

      const colors = {
        page: { r: 0.984, g: 0.984, b: 0.996 },
        textStrong: { r: 0.121, g: 0.129, b: 0.259 },
        textDefault: { r: 0.188, g: 0.192, b: 0.224 },
        textMuted: { r: 0.376, g: 0.376, b: 0.412 },
        card: { r: 1, g: 1, b: 1 },
        cardTint: { r: 0.976, g: 0.976, b: 1 },
        stroke: { r: 0.737, g: 0.737, b: 0.776 },
        accent: { r: 0.223, g: 0.259, b: 0.447 },
      };

      function createTextNode(characters, fontName, fontSize, lineHeightPx, fill, width, autoResize) {
        const text = figma.createText();
        text.fontName = fontName;
        text.fontSize = fontSize;
        text.lineHeight = { unit: "PIXELS", value: lineHeightPx };
        text.characters = characters;
        text.fills = [{ type: "SOLID", color: fill }];
        if (width) {
          text.resize(width, text.height);
        }
        text.textAutoResize = autoResize || (width ? "HEIGHT" : "WIDTH_AND_HEIGHT");
        return text;
      }

      function createBulletList(items, width) {
        const list = figma.createFrame();
        list.layoutMode = "VERTICAL";
        list.primaryAxisSizingMode = "AUTO";
        list.counterAxisSizingMode = "AUTO";
        list.itemSpacing = 10;
        list.fills = [];

        for (const item of items) {
          list.appendChild(createTextNode("• " + item, { family: "Geist", style: "Regular" }, 14, 24, colors.textDefault, width, "HEIGHT"));
        }

        return list;
      }

      function createSection(titleText, subtitleText) {
        const section = figma.createFrame();
        section.layoutMode = "VERTICAL";
        section.primaryAxisSizingMode = "AUTO";
        section.counterAxisSizingMode = "AUTO";
        section.itemSpacing = 8;
        section.fills = [];
        section.appendChild(createTextNode(titleText, { family: "Libre Franklin", style: "SemiBold" }, 18, 24, colors.textStrong));
        section.appendChild(createTextNode(subtitleText, { family: "Geist", style: "Regular" }, 12, 18, colors.textMuted, 760, "HEIGHT"));
        return section;
      }

      function createCard(titleText, valueText, bodyText, width) {
        const card = figma.createFrame();
        card.layoutMode = "VERTICAL";
        card.primaryAxisSizingMode = "AUTO";
        card.counterAxisSizingMode = "AUTO";
        card.itemSpacing = 14;
        card.paddingTop = 22;
        card.paddingRight = 22;
        card.paddingBottom = 22;
        card.paddingLeft = 22;
        card.cornerRadius = 14;
        card.strokes = [{ type: "SOLID", color: colors.stroke }];
        card.fills = [{ type: "SOLID", color: colors.card }];
        card.resize(width, card.height);
        card.appendChild(createTextNode(titleText, { family: "Geist", style: "Medium" }, 12, 16, colors.textMuted));
        card.appendChild(createTextNode(valueText, { family: "Libre Franklin", style: "SemiBold" }, 18, 24, colors.textStrong, width - 44, "HEIGHT"));
        card.appendChild(createTextNode(bodyText, { family: "Geist", style: "Regular" }, 12, 18, colors.textDefault, width - 44, "HEIGHT"));
        return card;
      }

      function createCell(textValue, width, fillColor, fontStyle) {
        const cell = figma.createFrame();
        cell.layoutMode = "VERTICAL";
        cell.primaryAxisSizingMode = "AUTO";
        cell.counterAxisSizingMode = "AUTO";
        cell.counterAxisAlignItems = "MIN";
        cell.primaryAxisAlignItems = "CENTER";
        cell.paddingTop = 14;
        cell.paddingRight = 14;
        cell.paddingBottom = 14;
        cell.paddingLeft = 14;
        cell.strokes = [{ type: "SOLID", color: colors.stroke }];
        cell.fills = [{ type: "SOLID", color: fillColor }];
        cell.resize(width, cell.height);
        cell.appendChild(createTextNode(textValue, { family: "Geist", style: fontStyle || "Regular" }, 12, 18, colors.textDefault, width - 28, "HEIGHT"));
        return cell;
      }

      function createTable(columnWidths, header, rows) {
        const table = figma.createFrame();
        table.layoutMode = "VERTICAL";
        table.primaryAxisSizingMode = "AUTO";
        table.counterAxisSizingMode = "AUTO";
        table.itemSpacing = 8;
        table.fills = [];

        function buildRow(cells, headerRow) {
          const row = figma.createFrame();
          row.layoutMode = "HORIZONTAL";
          row.primaryAxisSizingMode = "FIXED";
          row.counterAxisSizingMode = "AUTO";
          row.itemSpacing = 0;
          row.fills = [];
          row.resize(918, row.height);

          for (let i = 0; i < columnWidths.length; i += 1) {
            row.appendChild(createCell(cells[i] || "—", columnWidths[i], headerRow ? colors.cardTint : colors.card, headerRow ? "Medium" : "Regular"));
          }

          return row;
        }

        table.appendChild(buildRow(header, true));
        for (const row of rows) {
          table.appendChild(buildRow(row, false));
        }

        return table;
      }

      function createTwoColumnList(leftItems, rightItems) {
        const wrap = figma.createFrame();
        wrap.layoutMode = "HORIZONTAL";
        wrap.primaryAxisSizingMode = "FIXED";
        wrap.counterAxisSizingMode = "AUTO";
        wrap.itemSpacing = 20;
        wrap.fills = [];
        wrap.resize(918, wrap.height);

        const left = createCard("Anatomy", leftItems[0] || "No anatomy items detected", leftItems.slice(1).join(" • ") || "Document the direct child layers and visible slots.", 449);
        const right = createCard("Redlines", rightItems[0] || "No spacing notes detected", rightItems.slice(1).join(" • ") || "Capture spacing, alignment, and token references that should remain stable.", 449);
        wrap.appendChild(left);
        wrap.appendChild(right);
        return wrap;
      }

      const frame = figma.createFrame();
      frame.name = "Generated Spec";
      frame.layoutMode = "VERTICAL";
      frame.counterAxisSizingMode = "AUTO";
      frame.primaryAxisSizingMode = "AUTO";
      frame.itemSpacing = 28;
      frame.paddingTop = 28;
      frame.paddingRight = 44;
      frame.paddingBottom = 64;
      frame.paddingLeft = 44;
      frame.fills = [{ type: "SOLID", color: colors.page }];
      frame.x = 40;
      frame.y = 40;
      frame.resize(1006, 100);

      const metaBar = figma.createFrame();
      metaBar.layoutMode = "HORIZONTAL";
      metaBar.primaryAxisSizingMode = "FIXED";
      metaBar.counterAxisSizingMode = "FIXED";
      metaBar.itemSpacing = 8;
      metaBar.fills = [];
      metaBar.resize(918, 18);
      metaBar.appendChild(createTextNode("Documentation System", { family: "Geist", style: "Medium" }, 13, 18, colors.textMuted));
      const spacer = figma.createFrame();
      spacer.resize(1, 1);
      spacer.layoutGrow = 1;
      spacer.fills = [];
      metaBar.appendChild(spacer);
      metaBar.appendChild(createTextNode(spec.target.name + " / Spec", { family: "Geist", style: "Medium" }, 13, 18, colors.textMuted));
      metaBar.appendChild(createTextNode("v1", { family: "Geist", style: "Medium" }, 13, 18, colors.textMuted));
      frame.appendChild(metaBar);

      const hero = figma.createFrame();
      hero.layoutMode = "VERTICAL";
      hero.primaryAxisSizingMode = "AUTO";
      hero.counterAxisSizingMode = "AUTO";
      hero.itemSpacing = 14;
      hero.paddingTop = 4;
      hero.paddingBottom = 20;
      hero.fills = [];

      const heroTitle = createTextNode(spec.target.name + " spec", { family: "Cormorant Garamond", style: "Italic" }, 64, 60, colors.textStrong, 560, "HEIGHT");
      heroTitle.letterSpacing = { unit: "PIXELS", value: -0.5 };
      hero.appendChild(heroTitle);
      hero.appendChild(createTextNode(spec.overview.summary, { family: "Geist", style: "Regular" }, 12, 18, colors.textMuted, 620, "HEIGHT"));
      frame.appendChild(hero);

      const metricRow = figma.createFrame();
      metricRow.layoutMode = "HORIZONTAL";
      metricRow.primaryAxisSizingMode = "FIXED";
      metricRow.counterAxisSizingMode = "AUTO";
      metricRow.itemSpacing = 16;
      metricRow.fills = [];
      metricRow.resize(918, metricRow.height);
      metricRow.appendChild(createCard("Spec target", spec.target.type, spec.overview.size, 295));
      metricRow.appendChild(createCard("Layout", spec.overview.layout, "Child layers: " + spec.overview.childCount, 295));
      metricRow.appendChild(createCard("States detected", String(spec.states.length || 0), spec.states.length ? spec.states.join(", ") : "No explicit states detected", 296));
      frame.appendChild(metricRow);

      frame.appendChild(createSection("Overview", "Summarize what this component does, what user problem it solves, and any notable constraints."));
      frame.appendChild(createBulletList([
        spec.overview.summary,
        "Size: " + spec.overview.size,
        "Layout: " + spec.overview.layout,
      ], 918));

      frame.appendChild(createSection("Property matrix", "List the official component API or design variants here."));
      const propertyRows = (spec.variants.length > 0 ? spec.variants : [{ property: "variant", values: ["none"], defaultValue: "none" }]).map(function(variant) {
        return [
          variant.property,
          variant.values.join(", "),
          variant.defaultValue || "—",
          "Controls " + variant.property.toLowerCase(),
          "Documented from the inspected Figma component.",
        ];
      });
      frame.appendChild(createTable([180, 180, 140, 190, 228], ["Property", "Values", "Default", "Purpose", "Notes"], propertyRows));

      frame.appendChild(createSection("Anatomy and redlines", "Identify component parts and the exact spacing measurements reviewers should check."));
      const stylingNotes = []
        .concat(spec.styling.fills.slice(0, 2).map(function(item) { return "Fill: " + item; }))
        .concat(spec.styling.strokes.slice(0, 1).map(function(item) { return "Stroke: " + item; }))
        .concat(spec.styling.tokenReferences.slice(0, 2).map(function(item) { return "Token: " + item; }));
      frame.appendChild(createTwoColumnList(spec.anatomy.slice(0, 4), stylingNotes.slice(0, 4)));

      frame.appendChild(createSection("Live examples", "Examples below should be instantiated from the real component set."));
      frame.appendChild(createCard("Current target", spec.target.name, "Bind live component instances or canonical examples here when the implementation is available.", 918));

      frame.appendChild(createSection("States and interaction", "Document how behavior changes across hover, focus, selected, error, disabled, and loading states."));
      const stateRows = (spec.states.length > 0 ? spec.states : ["default"]).map(function(state) {
        return [
          state,
          "State transition",
          "Document the expected behavior for " + state + ".",
          "Add caveats, focus rules, or QA notes.",
        ];
      });
      frame.appendChild(createTable([160, 180, 340, 238], ["State", "Trigger", "Expected behavior", "Notes"], stateRows));

      frame.appendChild(createSection("Accessibility summary", "Summarize only the most essential accessibility rules here and link the detailed accessibility doc."));
      const a11yRow = figma.createFrame();
      a11yRow.layoutMode = "HORIZONTAL";
      a11yRow.primaryAxisSizingMode = "FIXED";
      a11yRow.counterAxisSizingMode = "AUTO";
      a11yRow.itemSpacing = 16;
      a11yRow.fills = [];
      a11yRow.resize(918, a11yRow.height);
      a11yRow.appendChild(createCard("Touch target", "Target size", spec.accessibility.touchTarget || "Confirm touch-target expectations for this component.", 295));
      a11yRow.appendChild(createCard("Typography", "Readable text", spec.accessibility.typography.slice(0, 2).join(" • ") || "No typography details detected.", 295));
      a11yRow.appendChild(createCard("Considerations", "Critical checks", spec.accessibility.considerations.slice(0, 2).join(" • ") || "Run contrast and focus-state checks before publish.", 296));
      frame.appendChild(a11yRow);

      frame.appendChild(createSection("Engineering contract", "Capture the build-time commitments that must remain aligned with the design intent."));
      frame.appendChild(createBulletList(
        spec.implementationNotes.concat(spec.documentationGaps.length > 0 ? spec.documentationGaps.map(function(item) { return "Gap: " + item; }) : []),
        918
      ));

      page.appendChild(frame);
      figma.viewport.scrollAndZoomIntoView([frame]);
      return page.id;
    })();
  `);

  if (!result.success) {
    throw new Error(`figma_generate_spec: failed to create Figma page: ${result.error}`);
  }

  return result.result as string;
}

export async function createDocumentationPages(documents: GeneratedDocument[], pageName?: string): Promise<string> {
  const bridge = await getBridge();
  const result = await bridge.execute(`
    (async () => {
      const documents = ${JSON.stringify(documents)};
      await figma.loadAllPagesAsync();
      const resolvedPageName = ${JSON.stringify(pageName || "Generated Component Docs")};
      const existing = figma.root.children.find((candidate) => candidate.name === resolvedPageName);
      const page = existing || figma.createPage();
      page.name = resolvedPageName;
      await figma.setCurrentPageAsync(page);

      for (const child of [...page.children]) {
        child.remove();
      }

      await figma.loadFontAsync({ family: "Libre Franklin", style: "SemiBold" });
      await figma.loadFontAsync({ family: "Libre Franklin", style: "Medium" });
      await figma.loadFontAsync({ family: "Libre Franklin", style: "Regular" });

      const colors = {
        page: { r: 0.984, g: 0.984, b: 0.996 },
        card: { r: 1, g: 1, b: 1 },
        stroke: { r: 0.874, g: 0.874, b: 0.914 },
        heading: { r: 0.121, g: 0.129, b: 0.259 },
        body: { r: 0.188, g: 0.192, b: 0.224 },
        muted: { r: 0.376, g: 0.376, b: 0.412 },
      };

function makeText(value, size, style, color, width) {
        const text = figma.createText();
        text.fontName = { family: "Libre Franklin", style };
        text.fontSize = size;
        text.lineHeight = { unit: "PIXELS", value: size <= 14 ? 20 : size + 8 };
        text.characters = value;
        text.fills = [{ type: "SOLID", color }];
        text.textAutoResize = width ? "HEIGHT" : "WIDTH_AND_HEIGHT";
        if (width) {
          text.resize(width, text.height);
        }
        return text;
      }

      function makeSection(section, width) {
        const frame = figma.createFrame();
        frame.layoutMode = "VERTICAL";
        frame.primaryAxisSizingMode = "AUTO";
        frame.counterAxisSizingMode = "AUTO";
        frame.itemSpacing = 10;
        frame.fills = [];
        frame.appendChild(makeText(section.title, 18, "SemiBold", colors.heading, width));
        for (const item of section.items) {
          const prefix = section.style === "paragraph" ? "" : "• ";
          frame.appendChild(makeText(prefix + item, 14, "Regular", colors.body, width));
        }
        return frame;
      }

      let y = 40;
      for (const document of documents) {
        const card = figma.createFrame();
        card.name = document.title;
        card.layoutMode = "VERTICAL";
        card.primaryAxisSizingMode = "AUTO";
        card.counterAxisSizingMode = "AUTO";
        card.itemSpacing = 20;
        card.paddingTop = 28;
        card.paddingRight = 28;
        card.paddingBottom = 28;
        card.paddingLeft = 28;
        card.cornerRadius = 16;
        card.strokes = [{ type: "SOLID", color: colors.stroke }];
        card.fills = [{ type: "SOLID", color: colors.card }];
        card.x = 40;
        card.y = y;
        card.resize(1006, 100);
        card.appendChild(makeText(document.title, 28, "SemiBold", colors.heading, 920));
        card.appendChild(makeText(document.summary, 14, "Regular", colors.muted, 920));
        for (const section of document.sections) {
          card.appendChild(makeSection(section, 920));
        }
        page.appendChild(card);
        y += Math.max(card.height, 240) + 32;
      }

      figma.viewport.scrollAndZoomIntoView(page.children);
      return page.id;
    })();
  `);

  if (!result.success) {
    throw new Error(`figma_generate_spec: failed to create documentation page: ${result.error}`);
  }

  return result.result as string;
}

export async function generateSpecHandler(args: GenerateSpecArgs): Promise<GenerateSpecResult> {
  const nodeId = await resolveTargetNodeId(args);
  const snapshot = await captureSnapshot(nodeId);
  const spec = buildSpec(snapshot, args.includeTokens ?? true);
  const documentType = normalizeDocumentType(args.documentType);
  const documents = await buildGeneratedDocuments(snapshot, spec, documentType);
  const report = documentType === "spec"
    ? formatSpecReport(spec)
    : documents.map((document) => formatDocumentReport(document)).join("\n\n---\n\n");

  let figmaPageId: string | undefined;
  if (args.outputFormat === "figma-page" || args.outputFormat === "all") {
    figmaPageId = documentType === "spec"
      ? await createSpecPage(spec, report, args.pageName)
      : await createDocumentationPages(documents, args.pageName);
  }

  const shouldWriteToDescription =
    args.writeToDescription ?? (args.outputFormat === "figma-page" || args.outputFormat === "all");
  if (shouldWriteToDescription) {
    const bridge = await getBridge();
    await bridge.setDescription(snapshot.id, formatSpecDescription(spec));
  }

  const logEntry = await decisionLog.log({
    tool: "figma_generate_spec",
    nodeIds: figmaPageId ? [snapshot.id, figmaPageId] : [snapshot.id],
    rationale: `Generated ${documentType} documentation for ${snapshot.name} (${snapshot.type}). Variants: ${spec.variants.length}. States: ${spec.states.length}. Tokens: ${spec.styling.tokenReferences.length}.`,
    tokens: spec.styling.tokenReferences,
    reversible: true,
    metadata: {
      outputFormat: args.outputFormat,
      documentType,
      type: snapshot.type,
      variantCount: spec.variants.length,
      stateCount: spec.states.length,
    },
  });

  return {
    spec,
    report: args.outputFormat === "json" || args.outputFormat === "figma-page" ? undefined : report,
    figmaPageId,
    documents: documents.length > 0 ? documents : undefined,
    logEntryId: logEntry.id,
  };
}
