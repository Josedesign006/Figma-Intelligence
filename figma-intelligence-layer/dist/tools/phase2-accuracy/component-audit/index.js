"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.componentAuditHandler = componentAuditHandler;
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
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
function looksLikeDsComponent(node) {
    const name = node.name.toLowerCase();
    return DS_PATTERN_KEYWORDS.some((kw) => name.includes(kw));
}
function findLikelyShadows(node, componentSets) {
    const name = node.name.toLowerCase();
    return componentSets
        .filter((cs) => {
        const csName = cs.name.toLowerCase();
        return DS_PATTERN_KEYWORDS.some((kw) => name.includes(kw) && csName.includes(kw));
    })
        .map((cs) => cs.name)
        .slice(0, 3);
}
// ─── Figma scripts ────────────────────────────────────────────────────────────
function buildGetAllNodesScript() {
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
// ─── Grouping helper ──────────────────────────────────────────────────────────
function groupStats(stats, instances, pages, groupBy) {
    if (groupBy === "component") {
        // Each component is its own group
        return stats.map((s) => ({
            groupKey: s.componentName,
            components: [s],
            totalInstances: s.instanceCount,
        }));
    }
    if (groupBy === "page") {
        const pageMap = new Map(pages.map((p) => [p.id, p.name]));
        const byPage = new Map();
        for (const stat of stats) {
            for (const pageId of stat.pages) {
                const pageName = pageMap.get(pageId) ?? pageId;
                if (!byPage.has(pageName))
                    byPage.set(pageName, []);
                byPage.get(pageName).push(stat);
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
        const byTeam = new Map();
        for (const stat of stats) {
            const teamName = stat.componentName.includes("/")
                ? stat.componentName.split("/")[0]
                : "Unassigned";
            if (!byTeam.has(teamName))
                byTeam.set(teamName, []);
            byTeam.get(teamName).push(stat);
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
async function componentAuditHandler(args) {
    const { fileKey = null, includeLibraryComponents = false, detectOrphans = true, groupBy = "component", } = args;
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    // 1. Get all component sets (DS building blocks)
    const componentSets = await bridge.getComponentSets();
    // 2. Get all instances in the file
    const allInstances = await bridge.getAllInstances();
    // 3. Get all pages
    const pages = await bridge.getAllPages();
    // 4. Fetch raw node data for detached-instance and override detection
    const rawNodesResult = await bridge.execute(buildGetAllNodesScript());
    const rawNodes = rawNodesResult.success
        ? rawNodesResult.result
        : [];
    // ── 5. Build a component-id → ComponentSet lookup ─────────────────────────
    // Each ComponentSet child is a COMPONENT variant
    const componentIdToSet = new Map();
    for (const cs of componentSets) {
        for (const child of cs.children) {
            componentIdToSet.set(child.id, cs);
        }
        // Also index the set itself
        componentIdToSet.set(cs.id, cs);
    }
    // ── 6. Instance counts per main component ─────────────────────────────────
    const instanceCountMap = new Map();
    const instancePagesMap = new Map();
    for (const inst of allInstances) {
        if (!inst.mainComponentId)
            continue;
        instanceCountMap.set(inst.mainComponentId, (instanceCountMap.get(inst.mainComponentId) ?? 0) + 1);
        if (!instancePagesMap.has(inst.mainComponentId)) {
            instancePagesMap.set(inst.mainComponentId, new Set());
        }
        instancePagesMap.get(inst.mainComponentId).add(inst.pageId);
    }
    // ── 7. Build usage stats per component variant ────────────────────────────
    const usageStats = [];
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
    const variantUsage = [];
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
    const detachedInstances = [];
    const instanceIds = new Set(allInstances.map((i) => i.id));
    for (const node of rawNodes) {
        // Skip actual instances, components, component sets, and non-frame types
        if (node.type === "INSTANCE" ||
            node.type === "COMPONENT" ||
            node.type === "COMPONENT_SET" ||
            instanceIds.has(node.id)) {
            continue;
        }
        // Only look at FRAME and GROUP nodes that match DS naming patterns
        if ((node.type === "FRAME" || node.type === "GROUP") && looksLikeDsComponent(node)) {
            const shadowedComponentNames = findLikelyShadows(node, componentSets);
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
    const orphanedComponents = [];
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
    const overrideCounts = new Map();
    for (const rawNode of rawNodes) {
        if (rawNode.type !== "INSTANCE" || !rawNode.mainComponentId)
            continue;
        if (!rawNode.componentProperties)
            continue;
        const mainId = rawNode.mainComponentId;
        const componentName = usageStats.find((s) => s.componentId === mainId)?.componentName ?? rawNode.name;
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
            const entry = overrideCounts.get(key);
            entry.total++;
            // An override is when value differs from defaultValue (if defined)
            const isOverridden = propData.defaultValue !== undefined &&
                JSON.stringify(propData.value) !== JSON.stringify(propData.defaultValue);
            if (isOverridden)
                entry.count++;
        }
    }
    const OVERRIDE_THRESHOLD = 0.1; // 10%
    const overrideHotspots = [];
    for (const entry of overrideCounts.values()) {
        if (entry.total === 0)
            continue;
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
    const logEntry = await decision_log_js_1.decisionLog.log({
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
//# sourceMappingURL=index.js.map