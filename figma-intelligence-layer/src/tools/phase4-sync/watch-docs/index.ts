// ─────────────────────────────────────────────────────────────────────────────
// figma_watch_docs — Auto-updating documentation
//
// Monitors components for changes and regenerates documentation when drift is
// detected. Produces changelogs, tracks doc freshness, and integrates with
// the webhook system for real-time updates.
//
// Features:
//   - Compare current component state against last-known spec snapshot
//   - Detect what changed (variants added, tokens changed, states modified)
//   - Auto-regenerate component spec when drift is detected
//   - Generate human-readable changelog entries
//   - Track doc freshness scores across the entire file
//   - Register webhook triggers for automated doc updates
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs/promises";
import path from "path";
import { getBridge } from "../../../shared/figma-bridge.js";
import { componentSpecHandler } from "../../phase5-governance/component-spec/index.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WatchDocsArgs {
  /** Action to perform */
  action: "check" | "regenerate" | "changelog" | "freshness" | "register-webhook";
  /** Component node IDs to watch (omit for all components on current page) */
  nodeIds?: string[];
  /** Path to store spec snapshots for comparison */
  snapshotDir?: string;
  /** Auto-regenerate specs that are stale */
  autoRegenerate?: boolean;
  /** Output format for regenerated specs */
  specFormat?: "json" | "markdown" | "figma-page" | "all";
  /** Webhook file key (for register-webhook action) */
  fileKey?: string;
}

interface ComponentSnapshot {
  nodeId: string;
  name: string;
  timestamp: string;
  variantCount: number;
  variantAxes: Array<{ name: string; values: string[] }>;
  stateCount: number;
  states: string[];
  tokenCount: number;
  tokenNames: string[];
  properties: Array<{ name: string; type: string }>;
  description: string;
  hash: string;
}

interface DriftEntry {
  nodeId: string;
  componentName: string;
  driftType: "variant-added" | "variant-removed" | "token-changed" | "state-changed" | "property-changed" | "new-component" | "description-changed";
  field: string;
  before: string;
  after: string;
  severity: "major" | "minor" | "patch";
}

interface ChangelogEntry {
  version: string;
  date: string;
  component: string;
  changes: Array<{
    type: "added" | "changed" | "removed" | "fixed";
    description: string;
  }>;
}

// ─── Snapshot management ───────────────────────────────────────────────────

function defaultSnapshotDir(): string {
  return path.join(process.cwd(), ".figma-docs-snapshots");
}

async function ensureSnapshotDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch { /* exists */ }
}

async function loadSnapshot(dir: string, nodeId: string): Promise<ComponentSnapshot | null> {
  const filePath = path.join(dir, `${nodeId.replace(/[:/]/g, "_")}.json`);
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveSnapshot(dir: string, snapshot: ComponentSnapshot): Promise<void> {
  const filePath = path.join(dir, `${snapshot.nodeId.replace(/[:/]/g, "_")}.json`);
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
}

function hashSnapshot(snap: Omit<ComponentSnapshot, "hash" | "timestamp">): string {
  const str = JSON.stringify({
    variantAxes: snap.variantAxes,
    states: snap.states,
    tokenNames: snap.tokenNames,
    properties: snap.properties,
    description: snap.description,
  });
  // Simple hash for change detection
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// ─── Component scanning ───────────────────────────────────────────────────

async function scanComponents(nodeIds?: string[]): Promise<ComponentSnapshot[]> {
  const bridge = await getBridge();

  const script = nodeIds?.length
    ? `
      (async () => {
        var results = [];
        var ids = ${JSON.stringify(nodeIds)};
        for (var i = 0; i < ids.length; i++) {
          var node = figma.getNodeById(ids[i]);
          if (!node) continue;
          results.push(extractComponent(node));
        }
        function extractComponent(node) {
          var axes = [];
          var states = [];
          var tokenNames = [];
          var props = [];

          if (node.variantGroupProperties) {
            var vgp = node.variantGroupProperties;
            for (var key in vgp) {
              axes.push({ name: key, values: vgp[key].values || [] });
              if (key.toLowerCase() === 'state') {
                states = vgp[key].values || [];
              }
            }
          }

          if (node.componentPropertyDefinitions) {
            var cpd = node.componentPropertyDefinitions;
            for (var key in cpd) {
              props.push({ name: key, type: cpd[key].type });
            }
          }

          // Scan for tokens
          function scanTokens(n) {
            var bound = n.boundVariables || {};
            for (var prop in bound) {
              var binding = bound[prop];
              if (binding && binding.id) {
                try {
                  var v = figma.variables.getVariableById(binding.id);
                  if (v && tokenNames.indexOf(v.name) === -1) tokenNames.push(v.name);
                } catch (e) {}
              }
              if (Array.isArray(binding)) {
                for (var j = 0; j < binding.length; j++) {
                  if (binding[j] && binding[j].id) {
                    try {
                      var v = figma.variables.getVariableById(binding[j].id);
                      if (v && tokenNames.indexOf(v.name) === -1) tokenNames.push(v.name);
                    } catch (e) {}
                  }
                }
              }
            }
            if (n.children) {
              for (var i = 0; i < n.children.length; i++) {
                scanTokens(n.children[i]);
              }
            }
          }
          scanTokens(node);

          return {
            nodeId: node.id,
            name: node.name,
            variantCount: node.children ? node.children.length : 0,
            variantAxes: axes,
            stateCount: states.length,
            states: states,
            tokenCount: tokenNames.length,
            tokenNames: tokenNames,
            properties: props,
            description: node.description || ''
          };
        }
        return results;
      })();
    `
    : `
      (async () => {
        var results = [];
        var page = figma.currentPage;
        var components = page.findAll(function(n) {
          return n.type === 'COMPONENT_SET' || (n.type === 'COMPONENT' && !n.parent.type.includes('COMPONENT'));
        });
        for (var i = 0; i < Math.min(components.length, 50); i++) {
          var node = components[i];
          var axes = [];
          var states = [];
          var tokenNames = [];
          var props = [];

          if (node.variantGroupProperties) {
            var vgp = node.variantGroupProperties;
            for (var key in vgp) {
              axes.push({ name: key, values: vgp[key].values || [] });
              if (key.toLowerCase() === 'state') states = vgp[key].values || [];
            }
          }

          if (node.componentPropertyDefinitions) {
            var cpd = node.componentPropertyDefinitions;
            for (var key in cpd) {
              props.push({ name: key, type: cpd[key].type });
            }
          }

          function scanTokens(n, names) {
            var bound = n.boundVariables || {};
            for (var prop in bound) {
              var binding = bound[prop];
              if (binding && binding.id) {
                try {
                  var v = figma.variables.getVariableById(binding.id);
                  if (v && names.indexOf(v.name) === -1) names.push(v.name);
                } catch(e) {}
              }
              if (Array.isArray(binding)) {
                for (var j = 0; j < binding.length; j++) {
                  if (binding[j] && binding[j].id) {
                    try {
                      var v = figma.variables.getVariableById(binding[j].id);
                      if (v && names.indexOf(v.name) === -1) names.push(v.name);
                    } catch(e) {}
                  }
                }
              }
            }
            if (n.children) {
              for (var c = 0; c < n.children.length; c++) scanTokens(n.children[c], names);
            }
          }
          scanTokens(node, tokenNames);

          results.push({
            nodeId: node.id,
            name: node.name,
            variantCount: node.children ? node.children.length : 0,
            variantAxes: axes,
            stateCount: states.length,
            states: states,
            tokenCount: tokenNames.length,
            tokenNames: tokenNames,
            properties: props,
            description: node.description || ''
          });
        }
        return results;
      })();
    `;

  const result = await bridge.execute(script);
  if (!result.success || !result.result) {
    throw new Error(result.error || "Failed to scan components");
  }

  const rawSnapshots = result.result as Array<Omit<ComponentSnapshot, "hash" | "timestamp">>;
  const now = new Date().toISOString();

  return rawSnapshots.map((s) => ({
    ...s,
    timestamp: now,
    hash: hashSnapshot(s),
  }));
}

// ─── Drift detection ──────────────────────────────────────────────────────

function detectDrift(old: ComponentSnapshot, current: ComponentSnapshot): DriftEntry[] {
  const drifts: DriftEntry[] = [];

  // Check variant axes
  for (const axis of current.variantAxes) {
    const oldAxis = old.variantAxes.find((a) => a.name === axis.name);
    if (!oldAxis) {
      drifts.push({
        nodeId: current.nodeId,
        componentName: current.name,
        driftType: "variant-added",
        field: `variantAxis:${axis.name}`,
        before: "(none)",
        after: axis.values.join(", "),
        severity: "major",
      });
    } else {
      const added = axis.values.filter((v) => !oldAxis.values.includes(v));
      const removed = oldAxis.values.filter((v) => !axis.values.includes(v));
      for (const v of added) {
        drifts.push({
          nodeId: current.nodeId,
          componentName: current.name,
          driftType: "variant-added",
          field: `${axis.name}:${v}`,
          before: oldAxis.values.join(", "),
          after: axis.values.join(", "),
          severity: "minor",
        });
      }
      for (const v of removed) {
        drifts.push({
          nodeId: current.nodeId,
          componentName: current.name,
          driftType: "variant-removed",
          field: `${axis.name}:${v}`,
          before: oldAxis.values.join(", "),
          after: axis.values.join(", "),
          severity: "major",
        });
      }
    }
  }

  // Check removed axes
  for (const oldAxis of old.variantAxes) {
    if (!current.variantAxes.find((a) => a.name === oldAxis.name)) {
      drifts.push({
        nodeId: current.nodeId,
        componentName: current.name,
        driftType: "variant-removed",
        field: `variantAxis:${oldAxis.name}`,
        before: oldAxis.values.join(", "),
        after: "(removed)",
        severity: "major",
      });
    }
  }

  // Check states
  const addedStates = current.states.filter((s) => !old.states.includes(s));
  const removedStates = old.states.filter((s) => !current.states.includes(s));
  for (const s of addedStates) {
    drifts.push({ nodeId: current.nodeId, componentName: current.name, driftType: "state-changed", field: `state:${s}`, before: "(none)", after: s, severity: "minor" });
  }
  for (const s of removedStates) {
    drifts.push({ nodeId: current.nodeId, componentName: current.name, driftType: "state-changed", field: `state:${s}`, before: s, after: "(removed)", severity: "major" });
  }

  // Check tokens
  const addedTokens = current.tokenNames.filter((t) => !old.tokenNames.includes(t));
  const removedTokens = old.tokenNames.filter((t) => !current.tokenNames.includes(t));
  for (const t of addedTokens) {
    drifts.push({ nodeId: current.nodeId, componentName: current.name, driftType: "token-changed", field: t, before: "(none)", after: t, severity: "patch" });
  }
  for (const t of removedTokens) {
    drifts.push({ nodeId: current.nodeId, componentName: current.name, driftType: "token-changed", field: t, before: t, after: "(removed)", severity: "minor" });
  }

  // Check properties
  const currentPropNames = current.properties.map((p) => p.name);
  const oldPropNames = old.properties.map((p) => p.name);
  for (const p of current.properties) {
    if (!oldPropNames.includes(p.name)) {
      drifts.push({ nodeId: current.nodeId, componentName: current.name, driftType: "property-changed", field: p.name, before: "(none)", after: `${p.name} (${p.type})`, severity: "minor" });
    }
  }
  for (const p of old.properties) {
    if (!currentPropNames.includes(p.name)) {
      drifts.push({ nodeId: current.nodeId, componentName: current.name, driftType: "property-changed", field: p.name, before: `${p.name} (${p.type})`, after: "(removed)", severity: "major" });
    }
  }

  // Check description
  if (old.description !== current.description) {
    drifts.push({ nodeId: current.nodeId, componentName: current.name, driftType: "description-changed", field: "description", before: old.description.slice(0, 80), after: current.description.slice(0, 80), severity: "patch" });
  }

  return drifts;
}

// ─── Changelog generator ──────────────────────────────────────────────────

function generateChangelog(drifts: DriftEntry[]): ChangelogEntry[] {
  const byComponent = new Map<string, DriftEntry[]>();
  for (const d of drifts) {
    const existing = byComponent.get(d.componentName) ?? [];
    existing.push(d);
    byComponent.set(d.componentName, existing);
  }

  const entries: ChangelogEntry[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const [component, componentDrifts] of byComponent) {
    const changes: ChangelogEntry["changes"] = [];

    for (const d of componentDrifts) {
      switch (d.driftType) {
        case "variant-added":
          changes.push({ type: "added", description: `Added variant ${d.field}: ${d.after}` });
          break;
        case "variant-removed":
          changes.push({ type: "removed", description: `Removed variant ${d.field}` });
          break;
        case "state-changed":
          changes.push({
            type: d.after === "(removed)" ? "removed" : "added",
            description: d.after === "(removed)" ? `Removed state: ${d.before}` : `Added state: ${d.after}`,
          });
          break;
        case "token-changed":
          changes.push({
            type: d.after === "(removed)" ? "removed" : "changed",
            description: d.after === "(removed)" ? `Removed token binding: ${d.before}` : `Added token binding: ${d.after}`,
          });
          break;
        case "property-changed":
          changes.push({
            type: d.after === "(removed)" ? "removed" : "added",
            description: d.after === "(removed)" ? `Removed property: ${d.field}` : `Added property: ${d.after}`,
          });
          break;
        case "description-changed":
          changes.push({ type: "changed", description: `Updated component description` });
          break;
      }
    }

    // Determine version bump
    const hasMajor = componentDrifts.some((d) => d.severity === "major");
    const hasMinor = componentDrifts.some((d) => d.severity === "minor");
    const version = hasMajor ? "major" : hasMinor ? "minor" : "patch";

    entries.push({ version, date: today, component, changes });
  }

  return entries;
}

function renderChangelogMarkdown(entries: ChangelogEntry[]): string {
  const lines: string[] = [];
  lines.push(`# Component Changelog`);
  lines.push(`> Auto-generated by \`figma_watch_docs\``);
  lines.push(``);

  for (const entry of entries) {
    lines.push(`## ${entry.component} — ${entry.version} (${entry.date})`);
    lines.push(``);
    for (const change of entry.changes) {
      const icon = change.type === "added" ? "➕" : change.type === "removed" ? "➖" : change.type === "fixed" ? "🔧" : "🔄";
      lines.push(`- ${icon} **${change.type}**: ${change.description}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function watchDocsHandler(args: WatchDocsArgs): Promise<unknown> {
  const snapshotDir = args.snapshotDir ?? defaultSnapshotDir();
  await ensureSnapshotDir(snapshotDir);

  switch (args.action) {
    case "check": {
      // Scan current components and compare against snapshots
      const current = await scanComponents(args.nodeIds);
      const allDrifts: DriftEntry[] = [];
      const staleComponents: string[] = [];
      const freshComponents: string[] = [];

      for (const snap of current) {
        const old = await loadSnapshot(snapshotDir, snap.nodeId);
        if (!old) {
          allDrifts.push({
            nodeId: snap.nodeId,
            componentName: snap.name,
            driftType: "new-component",
            field: "component",
            before: "(none)",
            after: snap.name,
            severity: "major",
          });
          staleComponents.push(snap.name);
        } else if (old.hash !== snap.hash) {
          const drifts = detectDrift(old, snap);
          allDrifts.push(...drifts);
          if (drifts.length > 0) staleComponents.push(snap.name);
          else freshComponents.push(snap.name);
        } else {
          freshComponents.push(snap.name);
        }
      }

      // Auto-regenerate if requested
      const regenerated: string[] = [];
      if (args.autoRegenerate && staleComponents.length > 0) {
        for (const snap of current) {
          if (!staleComponents.includes(snap.name)) continue;
          try {
            await componentSpecHandler({
              nodeId: snap.nodeId,
              outputFormat: args.specFormat ?? "markdown",
            });
            await saveSnapshot(snapshotDir, snap);
            regenerated.push(snap.name);
          } catch { /* skip failed */ }
        }
      }

      // Save all current snapshots
      for (const snap of current) {
        await saveSnapshot(snapshotDir, snap);
      }

      const changelog = generateChangelog(allDrifts);

      return {
        action: "check",
        totalComponents: current.length,
        staleCount: staleComponents.length,
        freshCount: freshComponents.length,
        staleComponents,
        freshComponents,
        drifts: allDrifts,
        changelog: changelog.length > 0 ? renderChangelogMarkdown(changelog) : null,
        regenerated: regenerated.length > 0 ? regenerated : undefined,
        freshness: current.length > 0
          ? Math.round((freshComponents.length / current.length) * 100)
          : 100,
      };
    }

    case "regenerate": {
      // Force-regenerate specs for specified components
      const current = await scanComponents(args.nodeIds);
      const results: Array<{ name: string; success: boolean; error?: string }> = [];

      for (const snap of current) {
        try {
          await componentSpecHandler({
            nodeId: snap.nodeId,
            outputFormat: args.specFormat ?? "all",
          });
          await saveSnapshot(snapshotDir, snap);
          results.push({ name: snap.name, success: true });
        } catch (err) {
          results.push({ name: snap.name, success: false, error: err instanceof Error ? err.message : String(err) });
        }
      }

      return {
        action: "regenerate",
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      };
    }

    case "changelog": {
      // Generate changelog from drift detection
      const current = await scanComponents(args.nodeIds);
      const allDrifts: DriftEntry[] = [];

      for (const snap of current) {
        const old = await loadSnapshot(snapshotDir, snap.nodeId);
        if (!old) {
          allDrifts.push({
            nodeId: snap.nodeId,
            componentName: snap.name,
            driftType: "new-component",
            field: "component",
            before: "(none)",
            after: snap.name,
            severity: "major",
          });
        } else if (old.hash !== snap.hash) {
          allDrifts.push(...detectDrift(old, snap));
        }
      }

      const changelog = generateChangelog(allDrifts);
      const markdown = renderChangelogMarkdown(changelog);

      // Save updated snapshots
      for (const snap of current) {
        await saveSnapshot(snapshotDir, snap);
      }

      return {
        action: "changelog",
        entries: changelog,
        markdown,
        totalChanges: allDrifts.length,
      };
    }

    case "freshness": {
      // Report documentation freshness across all components
      const current = await scanComponents(args.nodeIds);
      const report: Array<{
        name: string;
        nodeId: string;
        fresh: boolean;
        lastUpdated: string | null;
        driftCount: number;
      }> = [];

      for (const snap of current) {
        const old = await loadSnapshot(snapshotDir, snap.nodeId);
        if (!old) {
          report.push({ name: snap.name, nodeId: snap.nodeId, fresh: false, lastUpdated: null, driftCount: -1 });
        } else {
          const drifts = old.hash === snap.hash ? [] : detectDrift(old, snap);
          report.push({
            name: snap.name,
            nodeId: snap.nodeId,
            fresh: drifts.length === 0,
            lastUpdated: old.timestamp,
            driftCount: drifts.length,
          });
        }
      }

      const freshCount = report.filter((r) => r.fresh).length;
      const freshness = report.length > 0 ? Math.round((freshCount / report.length) * 100) : 100;

      return {
        action: "freshness",
        totalComponents: report.length,
        freshCount,
        staleCount: report.length - freshCount,
        freshnessScore: freshness,
        components: report,
      };
    }

    case "register-webhook": {
      // Return webhook configuration for automated doc updates
      return {
        action: "register-webhook",
        message: "Use figma_webhook_listener to register a webhook that triggers doc regeneration on component changes.",
        suggestedConfig: {
          events: ["FILE_UPDATE", "LIBRARY_PUBLISH"],
          triggers: {
            onComponentChange: "run-audit",
            onLibraryPublish: "run-health-report",
          },
          automatedActions: [
            "On FILE_UPDATE: run figma_watch_docs(action: 'check', autoRegenerate: true)",
            "On LIBRARY_PUBLISH: run figma_watch_docs(action: 'changelog') then figma_ci_check(checks: ['all'])",
          ],
          fileKey: args.fileKey ?? "(provide your Figma file key)",
        },
      };
    }

    default:
      return { error: `Unknown action: ${args.action}` };
  }
}
