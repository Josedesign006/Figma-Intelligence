import { getBridge } from "../../../shared/figma-bridge.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TokenAnalyticsArgs {
  action: "usage" | "orphans" | "coverage" | "adoption" | "full-report";
  collectionFilter?: string;
  pageFilter?: string;
  includeHidden?: boolean;
}

interface VariableCollectionSummary {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  variables: Array<{ id: string; name: string; type: string }>;
}

interface VariableUsageRecord {
  variableId: string;
  variableName: string;
  collectionName: string;
  resolvedType: string;
  bindingCount: number;
  boundProperties: string[];
}

interface OrphanRecord {
  variableId: string;
  variableName: string;
  collectionName: string;
  resolvedType: string;
  suggestion: "keep" | "deprecate" | "delete";
  reason: string;
}

interface CategoryCoverage {
  category: string;
  exists: boolean;
  tokenCount: number;
  hasSemanticLayer: boolean;
  hasComponentLayer: boolean;
}

interface AdoptionBreakdown {
  property: string;
  total: number;
  bound: number;
  hardcoded: number;
  rate: number;
}

interface UsageResult {
  tokens: VariableUsageRecord[];
  totalBindings: number;
  uniqueTokensUsed: number;
}

interface OrphanResult {
  orphans: OrphanRecord[];
  totalDefined: number;
  totalOrphaned: number;
  orphanRate: number;
}

interface CoverageResult {
  categories: CategoryCoverage[];
  overallScore: number;
  coveredCount: number;
  totalCategories: number;
}

interface AdoptionResult {
  overallRate: number;
  totalProperties: number;
  boundProperties: number;
  hardcodedProperties: number;
  breakdown: AdoptionBreakdown[];
}

interface FullReportResult {
  usage: UsageResult;
  orphans: OrphanResult;
  coverage: CoverageResult;
  adoption: AdoptionResult;
  generatedAt: string;
}

// ─── Standard token categories ───────────────────────────────────────────────

const STANDARD_CATEGORIES = [
  "color",
  "spacing",
  "radius",
  "typography",
  "elevation",
  "motion",
  "opacity",
  "border-width",
  "z-index",
  "breakpoint",
  "grid",
  "density",
] as const;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  color: ["color", "colour", "fill", "paint", "brand", "neutral", "feedback", "surface", "text", "border"],
  spacing: ["space", "spacing", "gap", "padding", "margin", "inset", "offset"],
  radius: ["radius", "corner", "rounded", "border-radius"],
  typography: ["typography", "font", "type", "text-size", "line-height", "weight", "letter-spacing"],
  elevation: ["elevation", "shadow", "depth", "z-depth"],
  motion: ["motion", "duration", "easing", "animation", "transition"],
  opacity: ["opacity", "alpha", "transparency"],
  "border-width": ["border-width", "stroke-width", "outline-width", "border-size"],
  "z-index": ["z-index", "z-layer", "layer-order"],
  breakpoint: ["breakpoint", "screen", "viewport", "media"],
  grid: ["grid", "column", "gutter", "container-width"],
  density: ["density", "compact", "comfortable", "spacious"],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getFilteredCollections(
  collectionFilter?: string
): Promise<VariableCollectionSummary[]> {
  const bridge = await getBridge();
  const collections = await bridge.getVariables(undefined, "full") as VariableCollectionSummary[];
  if (!collectionFilter) return collections;
  const filter = collectionFilter.toLowerCase();
  return collections.filter(
    (c) => c.name.toLowerCase().includes(filter)
  );
}

function buildVariableIndex(
  collections: VariableCollectionSummary[]
): Map<string, { name: string; collectionName: string; type: string }> {
  const index = new Map<string, { name: string; collectionName: string; type: string }>();
  for (const collection of collections) {
    for (const variable of collection.variables) {
      index.set(variable.id, {
        name: variable.name,
        collectionName: collection.name,
        type: variable.type,
      });
    }
  }
  return index;
}

function classifyCategory(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return null;
}

function suggestOrphanAction(
  variableName: string,
  resolvedType: string,
  collectionName: string
): { suggestion: OrphanRecord["suggestion"]; reason: string } {
  const lower = variableName.toLowerCase();
  const collectionLower = collectionName.toLowerCase();

  // Component-layer tokens that are unused may be stale
  if (lower.startsWith("components/") || lower.startsWith("component/") || collectionLower.includes("component")) {
    return { suggestion: "delete", reason: "Component-layer token with zero usage; likely stale after component refactor." };
  }

  // Primitive tokens are foundational; keep them even if unused directly
  if (collectionLower.includes("primitive") || lower.startsWith("color/") && lower.split("/").length <= 3) {
    return { suggestion: "keep", reason: "Primitive token; may be referenced by semantic aliases rather than direct bindings." };
  }

  // Semantic tokens with no bindings are candidates for deprecation
  if (collectionLower.includes("semantic") || lower.startsWith("semantic/")) {
    return { suggestion: "deprecate", reason: "Semantic token with no direct bindings; mark deprecated and audit alias chains." };
  }

  // Default: deprecate and review
  return { suggestion: "deprecate", reason: "No bindings detected; review whether this token is consumed via aliases or external code." };
}

// ─── Action: usage ───────────────────────────────────────────────────────────

async function analyzeUsage(
  collections: VariableCollectionSummary[],
  pageFilter?: string,
  includeHidden?: boolean
): Promise<UsageResult> {
  const bridge = await getBridge();
  const variableIndex = buildVariableIndex(collections);

  // Execute plugin script to walk all nodes and collect boundVariables
  const scanResult = await bridge.execute(`
    (async () => {
      var page = figma.currentPage;
      ${pageFilter ? `
      await figma.loadAllPagesAsync();
      var targetPage = figma.root.children.find(function(p) {
        return p.name.toLowerCase().includes(${JSON.stringify(pageFilter.toLowerCase())});
      });
      if (targetPage) page = targetPage;
      ` : ""}

      var nodes = page.findAll(function(n) {
        ${includeHidden ? "return true;" : "return n.visible !== false;"}
      });

      var usageMap = {};

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var bv = node.boundVariables;
        if (!bv) continue;

        var propertyKeys = Object.keys(bv);
        for (var k = 0; k < propertyKeys.length; k++) {
          var prop = propertyKeys[k];
          var binding = bv[prop];

          // boundVariables can be a single binding or an array of bindings
          var bindings = Array.isArray(binding) ? binding : (binding ? [binding] : []);
          for (var b = 0; b < bindings.length; b++) {
            var entry = bindings[b];
            if (!entry || !entry.id) continue;
            var varId = entry.id;
            if (!usageMap[varId]) {
              usageMap[varId] = { count: 0, properties: {} };
            }
            usageMap[varId].count++;
            usageMap[varId].properties[prop] = (usageMap[varId].properties[prop] || 0) + 1;
          }
        }
      }

      return { usageMap: usageMap, nodeCount: nodes.length };
    })();
  `);

  if (!scanResult.success || !scanResult.result) {
    return { tokens: [], totalBindings: 0, uniqueTokensUsed: 0 };
  }

  const { usageMap } = scanResult.result as {
    usageMap: Record<string, { count: number; properties: Record<string, number> }>;
    nodeCount: number;
  };

  const tokens: VariableUsageRecord[] = [];
  let totalBindings = 0;

  for (const [varId, usage] of Object.entries(usageMap)) {
    const info = variableIndex.get(varId);
    tokens.push({
      variableId: varId,
      variableName: info?.name ?? varId,
      collectionName: info?.collectionName ?? "unknown",
      resolvedType: info?.type ?? "unknown",
      bindingCount: usage.count,
      boundProperties: Object.keys(usage.properties),
    });
    totalBindings += usage.count;
  }

  // Sort most-used first
  tokens.sort((a, b) => b.bindingCount - a.bindingCount);

  return {
    tokens,
    totalBindings,
    uniqueTokensUsed: tokens.length,
  };
}

// ─── Action: orphans ─────────────────────────────────────────────────────────

async function analyzeOrphans(
  collections: VariableCollectionSummary[],
  usageResult: UsageResult
): Promise<OrphanResult> {
  const usedIds = new Set(usageResult.tokens.map((t) => t.variableId));
  const orphans: OrphanRecord[] = [];
  let totalDefined = 0;

  for (const collection of collections) {
    for (const variable of collection.variables) {
      totalDefined++;
      if (!usedIds.has(variable.id)) {
        const { suggestion, reason } = suggestOrphanAction(variable.name, variable.type, collection.name);
        orphans.push({
          variableId: variable.id,
          variableName: variable.name,
          collectionName: collection.name,
          resolvedType: variable.type,
          suggestion,
          reason,
        });
      }
    }
  }

  return {
    orphans,
    totalDefined,
    totalOrphaned: orphans.length,
    orphanRate: totalDefined > 0 ? Math.round((orphans.length / totalDefined) * 100) : 0,
  };
}

// ─── Action: coverage ────────────────────────────────────────────────────────

async function analyzeCoverage(
  collections: VariableCollectionSummary[]
): Promise<CoverageResult> {
  // Build a map of category -> variables
  const categoryMap = new Map<string, { tokens: string[]; collectionNames: Set<string> }>();

  for (const cat of STANDARD_CATEGORIES) {
    categoryMap.set(cat, { tokens: [], collectionNames: new Set() });
  }

  for (const collection of collections) {
    for (const variable of collection.variables) {
      const cat = classifyCategory(variable.name) ?? classifyCategory(collection.name);
      if (cat && categoryMap.has(cat)) {
        const entry = categoryMap.get(cat)!;
        entry.tokens.push(variable.name);
        entry.collectionNames.add(collection.name.toLowerCase());
      }
    }
  }

  const categories: CategoryCoverage[] = [];
  let coveredCount = 0;

  for (const cat of STANDARD_CATEGORIES) {
    const entry = categoryMap.get(cat)!;
    const exists = entry.tokens.length > 0;
    const hasSemanticLayer = Array.from(entry.collectionNames).some(
      (name) => name.includes("semantic") || name.includes("alias") || name.includes("theme")
    );
    const hasComponentLayer = Array.from(entry.collectionNames).some(
      (name) => name.includes("component") || name.includes("comp")
    );

    if (exists) coveredCount++;

    categories.push({
      category: cat,
      exists,
      tokenCount: entry.tokens.length,
      hasSemanticLayer,
      hasComponentLayer,
    });
  }

  const totalCategories = STANDARD_CATEGORIES.length;
  // Score: base coverage (60%) + semantic layer bonus (25%) + component layer bonus (15%)
  const baseCoverage = totalCategories > 0 ? coveredCount / totalCategories : 0;
  const semanticCount = categories.filter((c) => c.exists && c.hasSemanticLayer).length;
  const componentCount = categories.filter((c) => c.exists && c.hasComponentLayer).length;
  const semanticBonus = coveredCount > 0 ? semanticCount / coveredCount : 0;
  const componentBonus = coveredCount > 0 ? componentCount / coveredCount : 0;

  const overallScore = Math.round(
    baseCoverage * 60 + semanticBonus * 25 + componentBonus * 15
  );

  return {
    categories,
    overallScore,
    coveredCount,
    totalCategories,
  };
}

// ─── Action: adoption ────────────────────────────────────────────────────────

async function analyzeAdoption(
  pageFilter?: string,
  includeHidden?: boolean
): Promise<AdoptionResult> {
  const bridge = await getBridge();

  const adoptionResult = await bridge.execute(`
    (async () => {
      var page = figma.currentPage;
      ${pageFilter ? `
      await figma.loadAllPagesAsync();
      var targetPage = figma.root.children.find(function(p) {
        return p.name.toLowerCase().includes(${JSON.stringify(pageFilter.toLowerCase())});
      });
      if (targetPage) page = targetPage;
      ` : ""}

      var nodes = page.findAll(function(n) {
        ${includeHidden ? "return true;" : "return n.visible !== false;"}
      });

      var stats = {
        fills:    { total: 0, bound: 0 },
        strokes:  { total: 0, bound: 0 },
        spacing:  { total: 0, bound: 0 },
        radius:   { total: 0, bound: 0 },
        fontSize: { total: 0, bound: 0 },
        fontWeight: { total: 0, bound: 0 },
        effects:  { total: 0, bound: 0 }
      };

      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var bv = node.boundVariables || {};

        // Fills
        if (node.fills && Array.isArray(node.fills)) {
          for (var f = 0; f < node.fills.length; f++) {
            if (node.fills[f].visible !== false) {
              stats.fills.total++;
              if (bv.fills && bv.fills[f] && bv.fills[f].id) {
                stats.fills.bound++;
              }
            }
          }
        }

        // Strokes
        if (node.strokes && Array.isArray(node.strokes)) {
          for (var s = 0; s < node.strokes.length; s++) {
            if (node.strokes[s].visible !== false) {
              stats.strokes.total++;
              if (bv.strokes && bv.strokes[s] && bv.strokes[s].id) {
                stats.strokes.bound++;
              }
            }
          }
        }

        // Spacing (paddingLeft, paddingRight, paddingTop, paddingBottom, itemSpacing)
        var spacingProps = ["paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "itemSpacing"];
        for (var sp = 0; sp < spacingProps.length; sp++) {
          var prop = spacingProps[sp];
          if (typeof node[prop] === "number" && node[prop] > 0) {
            stats.spacing.total++;
            if (bv[prop] && bv[prop].id) {
              stats.spacing.bound++;
            }
          }
        }

        // Border radius
        var radiusProps = ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius", "cornerRadius"];
        for (var rp = 0; rp < radiusProps.length; rp++) {
          var rProp = radiusProps[rp];
          if (typeof node[rProp] === "number" && node[rProp] > 0) {
            stats.radius.total++;
            if (bv[rProp] && bv[rProp].id) {
              stats.radius.bound++;
            }
          }
        }

        // Font size
        if (node.type === "TEXT" && typeof node.fontSize === "number") {
          stats.fontSize.total++;
          if (bv.fontSize && bv.fontSize.id) {
            stats.fontSize.bound++;
          }
        }

        // Font weight (via fontWeight property if available)
        if (node.type === "TEXT" && node.fontWeight !== undefined) {
          stats.fontWeight.total++;
          if (bv.fontWeight && bv.fontWeight.id) {
            stats.fontWeight.bound++;
          }
        }

        // Effects
        if (node.effects && Array.isArray(node.effects)) {
          for (var e = 0; e < node.effects.length; e++) {
            if (node.effects[e].visible !== false) {
              stats.effects.total++;
              if (bv.effects && bv.effects[e] && bv.effects[e].id) {
                stats.effects.bound++;
              }
            }
          }
        }
      }

      return stats;
    })();
  `);

  if (!adoptionResult.success || !adoptionResult.result) {
    return {
      overallRate: 0,
      totalProperties: 0,
      boundProperties: 0,
      hardcodedProperties: 0,
      breakdown: [],
    };
  }

  const stats = adoptionResult.result as Record<string, { total: number; bound: number }>;

  const breakdown: AdoptionBreakdown[] = [];
  let totalProperties = 0;
  let boundProperties = 0;

  const propertyLabels: Record<string, string> = {
    fills: "Fill colors",
    strokes: "Stroke colors",
    spacing: "Spacing (padding/gap)",
    radius: "Border radius",
    fontSize: "Font size",
    fontWeight: "Font weight",
    effects: "Effects (shadows, blurs)",
  };

  for (const [key, { total, bound }] of Object.entries(stats)) {
    if (total === 0) continue;
    totalProperties += total;
    boundProperties += bound;
    breakdown.push({
      property: propertyLabels[key] ?? key,
      total,
      bound,
      hardcoded: total - bound,
      rate: Math.round((bound / total) * 100),
    });
  }

  const hardcodedProperties = totalProperties - boundProperties;
  const overallRate = totalProperties > 0 ? Math.round((boundProperties / totalProperties) * 100) : 0;

  return {
    overallRate,
    totalProperties,
    boundProperties,
    hardcodedProperties,
    breakdown,
  };
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function tokenAnalyticsHandler(args: TokenAnalyticsArgs): Promise<unknown> {
  const collections = await getFilteredCollections(args.collectionFilter);

  switch (args.action) {
    case "usage": {
      return analyzeUsage(collections, args.pageFilter, args.includeHidden);
    }

    case "orphans": {
      const usageResult = await analyzeUsage(collections, args.pageFilter, args.includeHidden);
      return analyzeOrphans(collections, usageResult);
    }

    case "coverage": {
      return analyzeCoverage(collections);
    }

    case "adoption": {
      return analyzeAdoption(args.pageFilter, args.includeHidden);
    }

    case "full-report": {
      const usageResult = await analyzeUsage(collections, args.pageFilter, args.includeHidden);
      const orphanResult = await analyzeOrphans(collections, usageResult);
      const coverageResult = await analyzeCoverage(collections);
      const adoptionResult = await analyzeAdoption(args.pageFilter, args.includeHidden);

      const report: FullReportResult = {
        usage: usageResult,
        orphans: orphanResult,
        coverage: coverageResult,
        adoption: adoptionResult,
        generatedAt: new Date().toISOString(),
      };

      return report;
    }

    default: {
      const _exhaustive: never = args.action;
      throw new Error(`Unknown action: ${_exhaustive}`);
    }
  }
}
