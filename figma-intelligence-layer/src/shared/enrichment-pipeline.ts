// ─────────────────────────────────────────────────────────────────────────────
// P0: Semantic Enrichment Pipeline
// Transforms raw Figma data into semantically rich, AI-friendly structured data.
// ─────────────────────────────────────────────────────────────────────────────

import { FigmaNode, Token, ComponentSet, RGBA, Paint, TextStyle } from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Style Resolver
// ═══════════════════════════════════════════════════════════════════════════════

export interface ResolvedStyle {
  fills: Array<{
    type: string;
    hex?: string;
    semanticName?: string;
    opacity?: number;
    variableId?: string;
  }>;
  strokes: Array<{
    type: string;
    hex?: string;
    weight?: number;
  }>;
  typography?: {
    family: string;
    weight: number;
    size: number;
    lineHeight: number;
    letterSpacing: number;
    category: "heading" | "subheading" | "body" | "caption" | "overline" | "display";
  };
  spacing?: {
    padding: { top: number; right: number; bottom: number; left: number };
    gap: number;
    snappedToGrid: boolean;
    gridBase: number;
  };
  radius?: {
    values: number[];
    category: "none" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "full";
    uniform: boolean;
  };
  effects: Array<{
    type: string;
    category:
      | "elevation-sm"
      | "elevation-md"
      | "elevation-lg"
      | "blur"
      | "inner-shadow"
      | "none";
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert 0-1 float RGBA to a hex string.
 * Returns "#RRGGBB" when fully opaque, "#RRGGBBAA" otherwise.
 */
export function rgbaToHex(r: number, g: number, b: number, a?: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const rr = clamp(r).toString(16).padStart(2, "0");
  const gg = clamp(g).toString(16).padStart(2, "0");
  const bb = clamp(b).toString(16).padStart(2, "0");
  if (a !== undefined && a < 1) {
    const aa = clamp(a).toString(16).padStart(2, "0");
    return `#${rr}${gg}${bb}${aa}`.toUpperCase();
  }
  return `#${rr}${gg}${bb}`.toUpperCase();
}

function euclideanColorDistance(a: RGBA, b: RGBA): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function parseColorTokenValue(value: string | number | boolean): RGBA | null {
  if (typeof value !== "string") return null;
  const hex = value.replace(/^#/, "");
  if (hex.length === 6 || hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  return null;
}

function findNearestToken(
  color: RGBA,
  tokens: Token[]
): { name: string; distance: number } | null {
  let best: { name: string; distance: number } | null = null;
  for (const token of tokens) {
    if (token.type !== "COLOR") continue;
    const tokenColor = parseColorTokenValue(token.value);
    if (!tokenColor) continue;
    const dist = euclideanColorDistance(color, tokenColor);
    if (!best || dist < best.distance) {
      best = { name: token.name, distance: dist };
    }
  }
  return best;
}

function categorizeTypography(
  fontSize: number
): "heading" | "subheading" | "body" | "caption" | "overline" | "display" {
  if (fontSize >= 48) return "display";
  if (fontSize >= 28) return "heading";
  if (fontSize >= 20) return "subheading";
  if (fontSize >= 14) return "body";
  if (fontSize >= 10) return "caption";
  return "overline";
}

function allMultiplesOf(values: number[], base: number): boolean {
  return values.every((v) => v % base === 0);
}

function categorizeRadius(
  values: number[]
): "none" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "full" {
  const max = Math.max(...values);
  if (max === 0) return "none";
  if (max <= 2) return "xs";
  if (max <= 4) return "sm";
  if (max <= 8) return "md";
  if (max <= 16) return "lg";
  if (max <= 24) return "xl";
  if (max <= 48) return "xxl";
  return "full";
}

function categorizeRadiusSingle(
  value: number
): "none" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "full" {
  return categorizeRadius([value]);
}

function categorizeEffect(
  type: string,
  radius?: number
):
  | "elevation-sm"
  | "elevation-md"
  | "elevation-lg"
  | "blur"
  | "inner-shadow"
  | "none" {
  if (type === "INNER_SHADOW") return "inner-shadow";
  if (type === "LAYER_BLUR" || type === "BACKGROUND_BLUR") return "blur";
  if (type === "DROP_SHADOW") {
    if (radius === undefined) return "elevation-md";
    if (radius <= 4) return "elevation-sm";
    if (radius <= 16) return "elevation-md";
    return "elevation-lg";
  }
  return "none";
}

// ── Main Resolver ────────────────────────────────────────────────────────────

export function resolveStyles(node: FigmaNode, tokens?: Token[]): ResolvedStyle {
  const colorTokens = tokens ?? [];

  // Fills
  const fills: ResolvedStyle["fills"] = (node.fills ?? []).map((paint: Paint) => {
    const entry: ResolvedStyle["fills"][number] = { type: paint.type };
    if (paint.color) {
      entry.hex = rgbaToHex(paint.color.r, paint.color.g, paint.color.b, paint.color.a);
      entry.opacity = paint.opacity ?? paint.color.a;

      if (colorTokens.length > 0) {
        const match = findNearestToken(paint.color, colorTokens);
        if (match && match.distance < 0.05) {
          entry.semanticName = match.name;
        }
      }
    }
    if (paint.variableId) {
      entry.variableId = paint.variableId;
    }
    return entry;
  });

  // Strokes
  const strokes: ResolvedStyle["strokes"] = (node.strokes ?? []).map((paint: Paint) => {
    const entry: ResolvedStyle["strokes"][number] = { type: paint.type };
    if (paint.color) {
      entry.hex = rgbaToHex(paint.color.r, paint.color.g, paint.color.b, paint.color.a);
    }
    return entry;
  });

  // Typography
  let typography: ResolvedStyle["typography"] | undefined;
  if (node.style) {
    const ts: TextStyle = node.style;
    typography = {
      family: ts.fontFamily,
      weight: ts.fontWeight,
      size: ts.fontSize,
      lineHeight: ts.lineHeightPx,
      letterSpacing: ts.letterSpacing,
      category: categorizeTypography(ts.fontSize),
    };
  }

  // Spacing
  let spacing: ResolvedStyle["spacing"] | undefined;
  const hasSpacing =
    node.paddingTop !== undefined ||
    node.paddingRight !== undefined ||
    node.paddingBottom !== undefined ||
    node.paddingLeft !== undefined ||
    node.itemSpacing !== undefined;
  if (hasSpacing) {
    const top = node.paddingTop ?? 0;
    const right = node.paddingRight ?? 0;
    const bottom = node.paddingBottom ?? 0;
    const left = node.paddingLeft ?? 0;
    const gap = node.itemSpacing ?? 0;
    const allValues = [top, right, bottom, left, gap];
    const snapTo8 = allMultiplesOf(allValues, 8);
    const snapTo4 = allMultiplesOf(allValues, 4);
    const gridBase = snapTo8 ? 8 : 4;
    spacing = {
      padding: { top, right, bottom, left },
      gap,
      snappedToGrid: snapTo8 || snapTo4,
      gridBase,
    };
  }

  // Radius — extract from node if available (corner radii or single)
  let radius: ResolvedStyle["radius"] | undefined;
  const nodeAny = node as unknown as Record<string, unknown>;
  if (nodeAny.cornerRadii && Array.isArray(nodeAny.cornerRadii)) {
    const values = nodeAny.cornerRadii as number[];
    radius = {
      values,
      category: categorizeRadius(values),
      uniform: values.every((v) => v === values[0]),
    };
  } else if (typeof nodeAny.cornerRadius === "number") {
    const v = nodeAny.cornerRadius as number;
    radius = {
      values: [v, v, v, v],
      category: categorizeRadius([v]),
      uniform: true,
    };
  }

  // Effects
  const seenEffects = new Set<string>();
  const effects: ResolvedStyle["effects"] = [];
  for (const effect of node.effects ?? []) {
    if (effect.visible === false) continue;
    const cat = categorizeEffect(effect.type, effect.radius);
    const key = `${effect.type}::${cat}`;
    if (seenEffects.has(key)) continue;
    seenEffects.add(key);
    effects.push({ type: effect.type, category: cat });
  }

  return { fills, strokes, typography, spacing, radius, effects };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Relationship Mapper
// ═══════════════════════════════════════════════════════════════════════════════

export interface ComponentRelationship {
  componentId: string;
  componentName: string;
  parentSetId?: string;
  parentSetName?: string;
  variantSiblings: Array<{
    id: string;
    name: string;
    variantProps: Record<string, string>;
  }>;
  instanceCount: number;
  dependsOn: string[];
  usedBy: string[];
}

export interface NodeRelationship {
  id: string;
  name: string;
  type: string;
  depth: number;
  parentId?: string;
  parentName?: string;
  siblingIndex: number;
  siblingCount: number;
  childCount: number;
  isAutoLayout: boolean;
  isComponent: boolean;
  isInstance: boolean;
}

export function mapRelationships(nodes: FigmaNode[]): NodeRelationship[] {
  const result: NodeRelationship[] = [];

  function walk(
    node: FigmaNode,
    depth: number,
    parentId: string | undefined,
    parentName: string | undefined,
    siblingIndex: number,
    siblingCount: number
  ): void {
    const children = node.children ?? [];
    result.push({
      id: node.id,
      name: node.name,
      type: node.type,
      depth,
      parentId,
      parentName,
      siblingIndex,
      siblingCount,
      childCount: children.length,
      isAutoLayout:
        node.layoutMode !== undefined && node.layoutMode !== "NONE",
      isComponent:
        node.type === "COMPONENT" || node.type === "COMPONENT_SET",
      isInstance: node.type === "INSTANCE",
    });

    for (let i = 0; i < children.length; i++) {
      walk(children[i], depth + 1, node.id, node.name, i, children.length);
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    walk(nodes[i], 0, undefined, undefined, i, nodes.length);
  }

  return result;
}

export function mapComponentRelationships(
  componentSets: ComponentSet[],
  allInstances?: Array<{ id: string; mainComponentId: string }>
): ComponentRelationship[] {
  const instances = allInstances ?? [];

  // Build instance count map: mainComponentId → count
  const instanceCountMap = new Map<string, number>();
  for (const inst of instances) {
    instanceCountMap.set(
      inst.mainComponentId,
      (instanceCountMap.get(inst.mainComponentId) ?? 0) + 1
    );
  }

  // Build usedBy map: nestedComponentId → set of parent component IDs
  const usedByMap = new Map<string, Set<string>>();

  const relationships: ComponentRelationship[] = [];

  for (const set of componentSets) {
    const variantSiblings: ComponentRelationship["variantSiblings"] = [];
    const dependsOn = new Set<string>();

    for (const child of set.children) {
      // Each child in a component set is a variant
      variantSiblings.push({
        id: child.id,
        name: child.name,
        variantProps: child.variantProperties ?? {},
      });

      // Detect nested component references by walking the child tree
      collectNestedComponentIds(child, dependsOn, child.id);
    }

    // Remove self-references from dependsOn
    const childIds = new Set(set.children.map((c) => c.id));
    const filteredDeps = [...dependsOn].filter(
      (id) => id !== set.id && !childIds.has(id)
    );

    // Register usedBy for each dependency
    for (const depId of filteredDeps) {
      if (!usedByMap.has(depId)) usedByMap.set(depId, new Set());
      usedByMap.get(depId)!.add(set.id);
    }

    // Sum instance counts across all children in the set
    let totalInstances = 0;
    for (const child of set.children) {
      totalInstances += instanceCountMap.get(child.id) ?? 0;
    }

    relationships.push({
      componentId: set.id,
      componentName: set.name,
      parentSetId: undefined,
      parentSetName: undefined,
      variantSiblings,
      instanceCount: totalInstances,
      dependsOn: filteredDeps,
      usedBy: [], // populated in second pass
    });
  }

  // Second pass: populate usedBy
  for (const rel of relationships) {
    const usedBy = usedByMap.get(rel.componentId);
    if (usedBy) {
      rel.usedBy = [...usedBy];
    }
  }

  return relationships;
}

/**
 * Recursively collects componentId references from a node tree.
 */
function collectNestedComponentIds(
  node: FigmaNode,
  result: Set<string>,
  selfId: string
): void {
  if (node.componentId && node.componentId !== selfId) {
    result.add(node.componentId);
  }
  for (const child of node.children ?? []) {
    collectNestedComponentIds(child, result, selfId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Data Enricher (main pipeline)
// ═══════════════════════════════════════════════════════════════════════════════

export interface EnrichedDesignSystem {
  summary: {
    totalTokens: number;
    totalComponents: number;
    totalStyles: number;
    colorTokenCount: number;
    spacingTokenCount: number;
    typographyCount: number;
    componentSetCount: number;
  };
  tokens: {
    colors: Array<{
      name: string;
      hex: string;
      opacity?: number;
      semanticGroup?: string;
      collectionName?: string;
    }>;
    spacing: Array<{ name: string; value: number; snappedTo4px: boolean }>;
    radii: Array<{ name: string; value: number; category: string }>;
    typography: Array<{ name: string; value: string }>;
    other: Array<{ name: string; type: string; value: unknown }>;
  };
  components: Array<{
    id: string;
    name: string;
    description?: string;
    variantProperties: string[];
    variantCount: number;
    category: string;
  }>;
  relationships: ComponentRelationship[];
}

/**
 * Infer a semantic group from a slash-separated token name.
 */
export function inferSemanticGroup(tokenName: string): string {
  const lower = tokenName.toLowerCase();
  const segments = lower.split("/").map((s) => s.trim());
  const joined = segments.join("/");

  // Color groups
  if (/primary/.test(joined)) return "color/primary";
  if (/secondary/.test(joined)) return "color/secondary";
  if (/tertiary/.test(joined)) return "color/tertiary";
  if (/neutral|gray|grey/.test(joined)) return "color/neutral";
  if (/success|green/.test(joined)) return "color/success";
  if (/warning|yellow|amber/.test(joined)) return "color/warning";
  if (/error|danger|red|destructive/.test(joined)) return "color/error";
  if (/info|blue/.test(joined)) return "color/info";
  if (/background|bg|surface/.test(joined)) return "color/background";
  if (/text|foreground|fg/.test(joined)) return "color/text";
  if (/border|stroke|outline/.test(joined)) return "color/border";
  if (/brand/.test(joined)) return "color/brand";
  if (/color|col|fill/.test(joined)) return "color/other";

  // Spacing
  if (/space|spacing|gap|padding|margin/.test(joined)) return "spacing";

  // Radius
  if (/radius|corner|round/.test(joined)) return "radius";

  // Typography
  if (/font|typo|text|letter|line-height|line_height/.test(joined)) return "typography";

  // Sizing
  if (/size|width|height/.test(joined)) return "sizing";

  // Opacity
  if (/opacity|alpha/.test(joined)) return "opacity";

  // Shadow / elevation
  if (/shadow|elevation/.test(joined)) return "elevation";

  // Use first segment as fallback
  if (segments.length > 1) return segments[0];
  return "other";
}

const COMPONENT_CATEGORY_RULES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(button|btn)\b/i, category: "button" },
  {
    pattern: /\b(input|field|select|checkbox|radio|toggle|switch)\b/i,
    category: "input",
  },
  { pattern: /\b(card)\b/i, category: "card" },
  {
    pattern: /\b(nav|menu|tab|sidebar|breadcrumb)\b/i,
    category: "navigation",
  },
  {
    pattern: /\b(alert|toast|snackbar|badge|tag|chip)\b/i,
    category: "feedback",
  },
  {
    pattern: /\b(container|section|grid|stack|divider)\b/i,
    category: "layout",
  },
  { pattern: /\b(table|list|avatar|icon)\b/i, category: "data-display" },
  {
    pattern: /\b(modal|dialog|popover|tooltip|drawer|sheet)\b/i,
    category: "overlay",
  },
];

function inferComponentCategory(name: string): string {
  for (const rule of COMPONENT_CATEGORY_RULES) {
    if (rule.pattern.test(name)) return rule.category;
  }
  return "other";
}

function isSpacingToken(name: string): boolean {
  return /space|spacing|gap|padding|margin/i.test(name);
}

function isRadiusToken(name: string): boolean {
  return /radius|corner|round/i.test(name);
}

export function enrichDesignSystem(
  tokens: Token[],
  componentSets: ComponentSet[],
  instances?: Array<{ id: string; mainComponentId: string }>
): EnrichedDesignSystem {
  // ── Categorize tokens ──────────────────────────────────────────────────────
  const colors: EnrichedDesignSystem["tokens"]["colors"] = [];
  const spacing: EnrichedDesignSystem["tokens"]["spacing"] = [];
  const radii: EnrichedDesignSystem["tokens"]["radii"] = [];
  const typography: EnrichedDesignSystem["tokens"]["typography"] = [];
  const other: EnrichedDesignSystem["tokens"]["other"] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "COLOR": {
        const colorVal =
          typeof token.value === "string" ? token.value : String(token.value);
        const parsed = parseColorTokenValue(colorVal);
        const hex = parsed
          ? rgbaToHex(parsed.r, parsed.g, parsed.b, parsed.a)
          : colorVal;
        const opacity =
          parsed && parsed.a < 1 ? parsed.a : undefined;
        colors.push({
          name: token.name,
          hex,
          opacity,
          semanticGroup: inferSemanticGroup(token.name),
          collectionName: token.collectionId,
        });
        break;
      }
      case "FLOAT": {
        const numVal =
          typeof token.value === "number"
            ? token.value
            : parseFloat(String(token.value));
        if (isSpacingToken(token.name)) {
          spacing.push({
            name: token.name,
            value: numVal,
            snappedTo4px: numVal % 4 === 0,
          });
        } else if (isRadiusToken(token.name)) {
          radii.push({
            name: token.name,
            value: numVal,
            category: categorizeRadiusSingle(numVal),
          });
        } else {
          other.push({ name: token.name, type: token.type, value: token.value });
        }
        break;
      }
      case "STRING": {
        // Strings with font/typography semantics
        if (/font|typo|text/i.test(token.name)) {
          typography.push({
            name: token.name,
            value: String(token.value),
          });
        } else {
          other.push({ name: token.name, type: token.type, value: token.value });
        }
        break;
      }
      default:
        other.push({ name: token.name, type: token.type, value: token.value });
    }
  }

  // ── Components ─────────────────────────────────────────────────────────────
  const components: EnrichedDesignSystem["components"] = componentSets.map(
    (set) => ({
      id: set.id,
      name: set.name,
      description: set.description || undefined,
      variantProperties: Object.keys(set.variantGroupProperties),
      variantCount: set.children.length,
      category: inferComponentCategory(set.name),
    })
  );

  // ── Relationships ──────────────────────────────────────────────────────────
  const relationships = mapComponentRelationships(componentSets, instances);

  // ── Summary ────────────────────────────────────────────────────────────────
  const summary: EnrichedDesignSystem["summary"] = {
    totalTokens: tokens.length,
    totalComponents: componentSets.reduce(
      (acc, s) => acc + s.children.length,
      0
    ),
    totalStyles: colors.length + typography.length,
    colorTokenCount: colors.length,
    spacingTokenCount: spacing.length,
    typographyCount: typography.length,
    componentSetCount: componentSets.length,
  };

  return {
    summary,
    tokens: { colors, spacing, radii, typography, other },
    components,
    relationships,
  };
}
