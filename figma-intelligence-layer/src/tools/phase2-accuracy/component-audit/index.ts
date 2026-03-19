// ─────────────────────────────────────────────────────────────────────────────
// Component Audit
// Produces a comprehensive usage-analytics report for all Design-System
// components in the active (or specified) Figma file:
//   • Instance counts per main component
//   • Most / least used variants
//   • Detached instances (frames/groups that look like DS components but aren't)
//   • Orphaned components (0 instances)
//   • Override hotspots (properties overridden in > 10% of instances)
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import { ComponentSet, FigmaNode } from "../../../shared/types.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export type GroupBy = "page" | "component" | "team";

export interface ComponentAuditArgs {
  fileKey?: string;
  includeLibraryComponents?: boolean;
  detectOrphans?: boolean;
  groupBy?: GroupBy;
}

export interface ComponentUsageStat {
  componentId: string;
  componentName: string;
  instanceCount: number;
  pages: string[];
}

export interface VariantUsageStat {
  variantName: string;
  componentSetId: string;
  componentSetName: string;
  instanceCount: number;
  usageRatio: number;           // relative to most-used variant in the same set
}

export interface DetachedInstance {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  pageId: string;
  likelyShadows: string[];      // DS component names it resembles
}

export interface OrphanedComponent {
  componentId: string;
  componentName: string;
  componentSetId?: string;
  componentSetName?: string;
}

export interface OverrideHotspot {
  componentId: string;
  componentName: string;
  property: string;
  overrideCount: number;
  instanceCount: number;
  overrideRate: number;         // 0–1
}

export interface ComponentAuditGroup {
  groupKey: string;
  components: ComponentUsageStat[];
  totalInstances: number;
}

export interface ComponentAuditResult {
  fileKey: string | null;
  totalComponents: number;
  totalInstances: number;
  topUsed: ComponentUsageStat[];
  leastUsed: ComponentUsageStat[];
  variantUsage: VariantUsageStat[];
  detachedInstances: DetachedInstance[];
  orphanedComponents: OrphanedComponent[];
  overrideHotspots: OverrideHotspot[];
  groupedReport: ComponentAuditGroup[];
  logEntryId: string;
}

// ─── DS-pattern name heuristics (for detached-instance detection) ─────────────

const DS_PATTERN_KEYWORDS = [
  "button",
  "btn",
  "input",
  "field",
  "select",
  "dropdown",
  "checkbox",
  "radio",
  "toggle",
  "switch",
  "badge",
  "chip",
  "tag",
  "avatar",
  "icon",
  "tooltip",
  "modal",
  "dialog",
  "alert",
  "toast",
  "notification",
  "card",
  "tab",
  "nav",
  "breadcrumb",
  "pagination",
  "table",
  "list",
  "accordion",
];

function looksLikeDsComponent(node: FigmaNode): boolean {
  const name = node.name.toLowerCase();
  return DS_PATTERN_KEYWORDS.some((kw) => name.includes(kw));
}

function findLikelyShadows(node: FigmaNode, componentSets: ComponentSet[]): string[] {
  const name = node.name.toLowerCase();
  return componentSets
    .filter((cs) => {
      const csName = cs.name.toLowerCase();
      return DS_PATTERN_KEYWORDS.some(
        (kw) => name.includes(kw) && csName.includes(kw)
      );
    })
    .map((cs) => cs.name)
    .slice(0, 3);
}

// ─── Figma scripts ────────────────────────────────────────────────────────────

function buildGetAllNodesScript(): string {
  return `
    (async () => {
      var results = [];
      var page = figma.currentPage;
      var nodes = page.findAll(function() { return true; });
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        results.push({
          id: n.id,
          name: n.name,
          type: n.type,
          pageId: page.id,
          pageName: page.name,
          componentId: n.type === 'COMPONENT' ? n.id : undefined,
          mainComponentId: n.type === 'INSTANCE' ? (n.mainComponent ? n.mainComponent.id : null) : undefined,
          componentProperties: n.type === 'INSTANCE' ? (n.componentProperties || {}) : undefined,
          width: n.absoluteBoundingBox ? n.absoluteBoundingBox.width : 0,
          height: n.absoluteBoundingBox ? n.absoluteBoundingBox.height : 0,
        });
      }
      return results;
    })()
  `.trim();
}

// ─── Internal data structures ─────────────────────────────────────────────────

interface RawNode {
  id: string;
  name: string;
  type: string;
  pageId: string;
  pageName: string;
  componentId?: string;
  mainComponentId?: string | null;
  componentProperties?: Record<string, { type: string; value: unknown; defaultValue?: unknown }>;
  width: number;
  height: number;
}

// ─── Grouping helper ──────────────────────────────────────────────────────────

function groupStats(
  stats: ComponentUsageStat[],
  instances: Array<{ id: string; mainComponentId: string; name: string; pageId: string }>,
  pages: Array<{ id: string; name: string }>,
  groupBy: GroupBy
): ComponentAuditGroup[] {
  if (groupBy === "component") {
    // Each component is its own group
    return stats.map((s) => ({
      groupKey: s.componentName,
      components: [s],
      totalInstances: s.instanceCount,
    }));
  }

  if (groupBy === "page") {
    const pageMap = new Map<string, string>(pages.map((p) => [p.id, p.name]));
    const byPage = new Map<string, ComponentUsageStat[]>();

    for (const stat of stats) {
      for (const pageId of stat.pages) {
        const pageName = pageMap.get(pageId) ?? pageId;
        if (!byPage.has(pageName)) byPage.set(pageName, []);
        byPage.get(pageName)!.push(stat);
      }
    }

    return [...byPage.entries()].map(([pageName, comps]) => ({
      groupKey: pageName,
      components: comps,
      totalInstances: comps.reduce((acc, c) => acc + c.instanceCount, 0),
    }));
  }

  if (groupBy === "team") {
    // Team grouping is inferred from naming convention "Team/Component"
    const byTeam = new Map<string, ComponentUsageStat[]>();

    for (const stat of stats) {
      const teamName = stat.componentName.includes("/")
        ? stat.componentName.split("/")[0]
        : "Unassigned";
      if (!byTeam.has(teamName)) byTeam.set(teamName, []);
      byTeam.get(teamName)!.push(stat);
    }

    return [...byTeam.entries()].map(([team, comps]) => ({
      groupKey: team,
      components: comps,
      totalInstances: comps.reduce((acc, c) => acc + c.instanceCount, 0),
    }));
  }

  return [];
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function componentAuditHandler(
  args: ComponentAuditArgs
): Promise<ComponentAuditResult> {
  const {
    fileKey = null,
    includeLibraryComponents = false,
    detectOrphans = true,
    groupBy = "component",
  } = args;

  const bridge = await getBridge();

  // 1. Get all component sets (DS building blocks)
  const componentSets = await bridge.getComponentSets();

  // 2. Get all instances in the file
  const allInstances = await bridge.getAllInstances();

  // 3. Get all pages
  const pages = await bridge.getAllPages();

  // 4. Fetch raw node data for detached-instance and override detection
  const rawNodesResult = await bridge.execute(buildGetAllNodesScript());
  const rawNodes: RawNode[] = rawNodesResult.success
    ? (rawNodesResult.result as RawNode[])
    : [];

  // ── 5. Build a component-id → ComponentSet lookup ─────────────────────────
  // Each ComponentSet child is a COMPONENT variant
  const componentIdToSet = new Map<string, ComponentSet>();
  for (const cs of componentSets) {
    for (const child of cs.children) {
      componentIdToSet.set(child.id, cs);
    }
    // Also index the set itself
    componentIdToSet.set(cs.id, cs);
  }

  // ── 6. Instance counts per main component ─────────────────────────────────
  const instanceCountMap = new Map<string, number>();
  const instancePagesMap = new Map<string, Set<string>>();

  for (const inst of allInstances) {
    if (!inst.mainComponentId) continue;
    instanceCountMap.set(
      inst.mainComponentId,
      (instanceCountMap.get(inst.mainComponentId) ?? 0) + 1
    );
    if (!instancePagesMap.has(inst.mainComponentId)) {
      instancePagesMap.set(inst.mainComponentId, new Set());
    }
    instancePagesMap.get(inst.mainComponentId)!.add(inst.pageId);
  }

  // ── 7. Build usage stats per component variant ────────────────────────────
  const usageStats: ComponentUsageStat[] = [];

  for (const cs of componentSets) {
    for (const child of cs.children) {
      const count = instanceCountMap.get(child.id) ?? 0;
      const pageset = instancePagesMap.get(child.id) ?? new Set();
      usageStats.push({
        componentId: child.id,
        componentName: `${cs.name} / ${child.name}`,
        instanceCount: count,
        pages: [...pageset],
      });
    }
  }

  // Sort by instanceCount descending
  usageStats.sort((a, b) => b.instanceCount - a.instanceCount);

  const totalInstances = allInstances.length;

  const topUsed = usageStats.slice(0, 10);
  const leastUsed = [...usageStats].reverse().slice(0, 10);

  // ── 8. Variant usage within each ComponentSet ────────────────────────────
  const variantUsage: VariantUsageStat[] = [];

  for (const cs of componentSets) {
    const variantCounts = cs.children.map((child) => ({
      name: child.name,
      count: instanceCountMap.get(child.id) ?? 0,
    }));

    const maxCount = Math.max(...variantCounts.map((v) => v.count), 1);

    for (const vc of variantCounts) {
      variantUsage.push({
        variantName: vc.name,
        componentSetId: cs.id,
        componentSetName: cs.name,
        instanceCount: vc.count,
        usageRatio: vc.count / maxCount,
      });
    }
  }

  // Sort by usage ratio descending
  variantUsage.sort((a, b) => b.usageRatio - a.usageRatio);

  // ── 9. Detached instance detection ───────────────────────────────────────
  const detachedInstances: DetachedInstance[] = [];
  const instanceIds = new Set(allInstances.map((i) => i.id));

  for (const node of rawNodes) {
    // Skip actual instances, components, component sets, and non-frame types
    if (
      node.type === "INSTANCE" ||
      node.type === "COMPONENT" ||
      node.type === "COMPONENT_SET" ||
      instanceIds.has(node.id)
    ) {
      continue;
    }

    // Only look at FRAME and GROUP nodes that match DS naming patterns
    if ((node.type === "FRAME" || node.type === "GROUP") && looksLikeDsComponent(node as unknown as FigmaNode)) {
      const shadowedComponentNames = findLikelyShadows(
        node as unknown as FigmaNode,
        componentSets
      );

      if (shadowedComponentNames.length > 0) {
        detachedInstances.push({
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          pageId: node.pageId,
          likelyShadows: shadowedComponentNames,
        });
      }
    }
  }

  // ── 10. Orphaned components (0 instances) ─────────────────────────────────
  const orphanedComponents: OrphanedComponent[] = [];

  if (detectOrphans) {
    for (const cs of componentSets) {
      for (const child of cs.children) {
        const count = instanceCountMap.get(child.id) ?? 0;
        if (count === 0) {
          orphanedComponents.push({
            componentId: child.id,
            componentName: child.name,
            componentSetId: cs.id,
            componentSetName: cs.name,
          });
        }
      }
    }
  }

  // ── 11. Override hotspot detection ────────────────────────────────────────
  // For each instance, count how many times each componentProperty is overridden
  // (i.e. differs from the defaultValue)
  const overrideCounts = new Map<
    string, // key: `${mainComponentId}::${property}`
    { componentId: string; componentName: string; property: string; count: number; total: number }
  >();

  for (const rawNode of rawNodes) {
    if (rawNode.type !== "INSTANCE" || !rawNode.mainComponentId) continue;
    if (!rawNode.componentProperties) continue;

    const mainId = rawNode.mainComponentId;
    const componentName =
      usageStats.find((s) => s.componentId === mainId)?.componentName ?? rawNode.name;

    for (const [propName, propData] of Object.entries(rawNode.componentProperties)) {
      const key = `${mainId}::${propName}`;

      if (!overrideCounts.has(key)) {
        overrideCounts.set(key, {
          componentId: mainId,
          componentName,
          property: propName,
          count: 0,
          total: 0,
        });
      }

      const entry = overrideCounts.get(key)!;
      entry.total++;

      // An override is when value differs from defaultValue (if defined)
      const isOverridden =
        propData.defaultValue !== undefined &&
        JSON.stringify(propData.value) !== JSON.stringify(propData.defaultValue);

      if (isOverridden) entry.count++;
    }
  }

  const OVERRIDE_THRESHOLD = 0.1; // 10%
  const overrideHotspots: OverrideHotspot[] = [];

  for (const entry of overrideCounts.values()) {
    if (entry.total === 0) continue;
    const rate = entry.count / entry.total;

    if (rate > OVERRIDE_THRESHOLD) {
      overrideHotspots.push({
        componentId: entry.componentId,
        componentName: entry.componentName,
        property: entry.property,
        overrideCount: entry.count,
        instanceCount: entry.total,
        overrideRate: Math.round(rate * 1000) / 1000,
      });
    }
  }

  // Sort hotspots by override rate descending
  overrideHotspots.sort((a, b) => b.overrideRate - a.overrideRate);

  // ── 12. Grouped report ────────────────────────────────────────────────────
  const groupedReport = groupStats(usageStats, allInstances, pages, groupBy);

  // ── 13. Log the decision ──────────────────────────────────────────────────
  const logEntry = await decisionLog.log({
    tool: "component-audit",
    nodeIds: orphanedComponents.map((o) => o.componentId).slice(0, 20),
    rationale: `Audited ${componentSets.length} component sets, ${allInstances.length} instances. Orphans: ${orphanedComponents.length}. Detached: ${detachedInstances.length}. Override hotspots: ${overrideHotspots.length}.`,
    tokens: [],
    reversible: false,
    metadata: {
      fileKey,
      totalComponents: usageStats.length,
      totalInstances,
      orphanCount: orphanedComponents.length,
      detachedCount: detachedInstances.length,
      overrideHotspotCount: overrideHotspots.length,
      groupBy,
    },
  });

  return {
    fileKey,
    totalComponents: usageStats.length,
    totalInstances,
    topUsed,
    leastUsed,
    variantUsage,
    detachedInstances,
    orphanedComponents,
    overrideHotspots,
    groupedReport,
    logEntryId: logEntry.id,
  };
}
