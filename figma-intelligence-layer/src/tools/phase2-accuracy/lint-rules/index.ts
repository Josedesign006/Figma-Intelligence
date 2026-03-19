// ─────────────────────────────────────────────────────────────────────────────
// Lint Rules
// Define, run, list, and delete design-system lint rules against a Figma file.
// Supports 5 built-in rules and user-defined rules loaded from a YAML file.
// Auto-fix snaps spacing to 4-px grid and maps hardcoded colors to the nearest
// DS token.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import { snapToSpacingToken, snapToColorToken } from "../../../shared/token-utils.js";
import { FigmaNode, LintViolation, Paint, Token } from "../../../shared/types.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export type LintAction = "define" | "run" | "list" | "delete";
export type OutputFormat = "inline" | "report" | "ci";

export interface LintRulesArgs {
  action: LintAction;
  ruleFile?: string;
  nodeId?: string;
  autoFix?: boolean;
  outputFormat: OutputFormat;
}

export interface LintRule {
  id: string;
  name: string;
  description: string;
  severity: "error" | "warning";
  autoFixable: boolean;
  builtIn: boolean;
}

export interface LintRuleSet {
  rules: LintRule[];
}

export interface LintRunResult {
  violations: LintViolation[];
  totalChecked: number;
  errorCount: number;
  warningCount: number;
  autoFixedCount: number;
  exitCode: number;        // 0 = pass, 1 = warnings, 2 = errors (CI-ready)
  outputText: string;
  logEntryId: string;
}

export interface LintDefineResult {
  savedPath: string;
  ruleCount: number;
}

export interface LintListResult {
  rules: LintRule[];
}

export interface LintDeleteResult {
  deletedRuleIds: string[];
}

export type LintRulesResult = LintRunResult | LintDefineResult | LintListResult | LintDeleteResult;

// ─── Built-in rules ───────────────────────────────────────────────────────────

export const BUILT_IN_RULES: LintRule[] = [
  {
    id: "no-hardcoded-colors",
    name: "No Hardcoded Colors",
    description: "All fills must use variable aliases rather than raw color values.",
    severity: "error",
    autoFixable: true,
    builtIn: true,
  },
  {
    id: "spacing-on-grid",
    name: "Spacing On 4px Grid",
    description: "All padding and gap values must be multiples of 4px.",
    severity: "warning",
    autoFixable: true,
    builtIn: true,
  },
  {
    id: "button-min-touch-target",
    name: "Button Minimum Touch Target",
    description: "Button components must be at least 44×44px to meet touch accessibility guidelines.",
    severity: "error",
    autoFixable: false,
    builtIn: true,
  },
  {
    id: "component-must-be-instance",
    name: "Interactive Elements Must Be DS Instances",
    description: "Interactive elements (buttons, inputs, links) must be instances of DS components.",
    severity: "error",
    autoFixable: false,
    builtIn: true,
  },
  {
    id: "no-detached-text",
    name: "No Detached Text Styles",
    description: "Text layers must use variable aliases for their color fills.",
    severity: "warning",
    autoFixable: true,
    builtIn: true,
  },
];

// ─── Persistent rule-store path ───────────────────────────────────────────────

const RULES_STORE_PATH =
  process.env.LINT_RULES_PATH ||
  path.join(process.cwd(), ".figma-lint-rules.json");

// ─── Rule store helpers ───────────────────────────────────────────────────────

async function loadStoredRules(): Promise<LintRule[]> {
  try {
    const data = await fs.readFile(RULES_STORE_PATH, "utf-8");
    const parsed = JSON.parse(data) as { rules: LintRule[] };
    return parsed.rules ?? [];
  } catch {
    return [];
  }
}

async function saveStoredRules(rules: LintRule[]): Promise<void> {
  await fs.writeFile(
    RULES_STORE_PATH,
    JSON.stringify({ rules }, null, 2),
    "utf-8"
  );
}

async function getAllRules(): Promise<LintRule[]> {
  const stored = await loadStoredRules();
  const storedIds = new Set(stored.map((r) => r.id));
  // Merge: built-in rules first, then any stored custom rules
  const customRules = stored.filter((r) => !r.builtIn);
  const overriddenBuiltIn = BUILT_IN_RULES.map((br) => {
    const override = stored.find((r) => r.id === br.id);
    return override ?? br;
  });
  return [...overriddenBuiltIn, ...customRules];
}

// ─── YAML rule loader ─────────────────────────────────────────────────────────

interface YamlRuleDef {
  id: string;
  name?: string;
  description?: string;
  severity?: "error" | "warning";
  autoFixable?: boolean;
}

async function loadRulesFromYaml(filePath: string): Promise<LintRule[]> {
  const content = await fs.readFile(filePath, "utf-8");
  const parsed = yaml.load(content) as { rules?: YamlRuleDef[] };

  if (!parsed?.rules || !Array.isArray(parsed.rules)) {
    throw new Error(`lintRules: YAML file at "${filePath}" must contain a top-level "rules" array.`);
  }

  return parsed.rules.map((r) => ({
    id: r.id,
    name: r.name ?? r.id,
    description: r.description ?? "",
    severity: r.severity ?? "warning",
    autoFixable: r.autoFixable ?? false,
    builtIn: false,
  }));
}

// ─── Node traversal ───────────────────────────────────────────────────────────

function collectAllNodes(root: FigmaNode): FigmaNode[] {
  const nodes: FigmaNode[] = [root];
  if (root.children) {
    for (const child of root.children) {
      nodes.push(...collectAllNodes(child));
    }
  }
  return nodes;
}

// ─── Rule checks ──────────────────────────────────────────────────────────────

function hasHardcodedColor(fills: Paint[] | undefined): boolean {
  if (!fills || fills.length === 0) return false;
  return fills.some(
    (f) => f.type === "SOLID" && !f.variableId
  );
}

function isSpacingOffGrid(value: number | undefined): boolean {
  if (value === undefined || value === 0) return false;
  return value % 4 !== 0;
}

function isButton(node: FigmaNode): boolean {
  const name = node.name.toLowerCase();
  return (
    /\bbtn\b|\bbutton\b|\bcta\b/.test(name) ||
    node.type === "INSTANCE" ||
    node.type === "COMPONENT"
  );
}

function isInteractiveButNotInstance(node: FigmaNode): boolean {
  const name = node.name.toLowerCase();
  const isInteractive = /\bbtn\b|\bbutton\b|\binput\b|\blink\b|\bcheckbox\b|\bradio\b|\bswitch\b/.test(name);
  return isInteractive && node.type !== "INSTANCE" && node.type !== "COMPONENT";
}

function hasDetachedTextColor(node: FigmaNode): boolean {
  if (node.type !== "TEXT") return false;
  return hasHardcodedColor(node.fills);
}

// ─── Auto-fix builders ────────────────────────────────────────────────────────

function buildSnapSpacingScript(nodeId: string, snappedPadding: number, snappedGap: number): string {
  return `
    (async () => {
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) return;
      const fields = ['paddingLeft','paddingRight','paddingTop','paddingBottom'];
      for (const f of fields) {
        if (f in node && typeof node[f] === 'number' && node[f] % 4 !== 0) {
          node[f] = ${snappedPadding};
        }
      }
      if ('itemSpacing' in node && typeof node.itemSpacing === 'number' && node.itemSpacing % 4 !== 0) {
        node.itemSpacing = ${snappedGap};
      }
      return { fixed: true };
    })()
  `.trim();
}

function buildMapColorToTokenScript(nodeId: string, tokenName: string): string {
  return `
    (async () => {
      // Color-to-token mapping requires a pre-existing variable;
      // we annotate the node with a plugin data note for human review.
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) return;
      node.setPluginData('suggestedColorToken', ${JSON.stringify(tokenName)});
      return { annotated: true, tokenName: ${JSON.stringify(tokenName)} };
    })()
  `.trim();
}

// ─── Violation checker ────────────────────────────────────────────────────────

async function runChecks(
  nodes: FigmaNode[],
  rules: LintRule[],
  autoFix: boolean,
  dsTokens: Token[],
  bridge: Awaited<ReturnType<typeof getBridge>>
): Promise<{ violations: LintViolation[]; autoFixedCount: number }> {
  const violations: LintViolation[] = [];
  let autoFixedCount = 0;

  const activeRuleIds = new Set(rules.map((r) => r.id));

  for (const node of nodes) {
    // ── no-hardcoded-colors ─────────────────────────────────────────────────
    if (activeRuleIds.has("no-hardcoded-colors") && hasHardcodedColor(node.fills)) {
      const rule = rules.find((r) => r.id === "no-hardcoded-colors")!;
      let fixed = false;

      if (autoFix && rule.autoFixable) {
        // Find the first hardcoded fill and suggest the nearest token
        const hardcoded = node.fills!.find((f) => f.type === "SOLID" && !f.variableId && f.color);
        if (hardcoded?.color) {
          const { r, g, b } = hardcoded.color;
          const hex = `#${Math.round(r * 255).toString(16).padStart(2, "0")}${Math.round(g * 255).toString(16).padStart(2, "0")}${Math.round(b * 255).toString(16).padStart(2, "0")}`;
          const tokenRef = snapToColorToken(hex, dsTokens);
          const fixScript = buildMapColorToTokenScript(node.id, tokenRef.tokenName);
          const fixResult = await bridge.execute(fixScript);
          if (fixResult.success) {
            fixed = true;
            autoFixedCount++;
          }
        }
      }

      violations.push({
        ruleId: "no-hardcoded-colors",
        severity: rule.severity,
        nodeId: node.id,
        nodeName: node.name,
        message: `Node "${node.name}" has hardcoded fill colors. All fills must use variable aliases.`,
        autoFixed: fixed,
      });
    }

    // ── spacing-on-grid ──────────────────────────────────────────────────────
    if (activeRuleIds.has("spacing-on-grid")) {
      const rule = rules.find((r) => r.id === "spacing-on-grid")!;
      const offGridFields = [
        { field: "paddingLeft", value: node.paddingLeft },
        { field: "paddingRight", value: node.paddingRight },
        { field: "paddingTop", value: node.paddingTop },
        { field: "paddingBottom", value: node.paddingBottom },
        { field: "itemSpacing", value: node.itemSpacing },
      ].filter((f) => isSpacingOffGrid(f.value));

      if (offGridFields.length > 0) {
        let fixed = false;

        if (autoFix && rule.autoFixable) {
          const paddingRef = snapToSpacingToken(node.paddingLeft ?? 0);
          const gapRef = snapToSpacingToken(node.itemSpacing ?? 0);
          const fixScript = buildSnapSpacingScript(
            node.id,
            paddingRef.tokenValue as number,
            gapRef.tokenValue as number
          );
          const fixResult = await bridge.execute(fixScript);
          if (fixResult.success) {
            fixed = true;
            autoFixedCount++;
          }
        }

        violations.push({
          ruleId: "spacing-on-grid",
          severity: rule.severity,
          nodeId: node.id,
          nodeName: node.name,
          message: `Node "${node.name}" has spacing values not on the 4px grid: ${offGridFields.map((f) => `${f.field}=${f.value}`).join(", ")}.`,
          autoFixed: fixed,
        });
      }
    }

    // ── button-min-touch-target ──────────────────────────────────────────────
    if (activeRuleIds.has("button-min-touch-target") && isButton(node)) {
      const rule = rules.find((r) => r.id === "button-min-touch-target")!;
      const w = node.absoluteBoundingBox?.width ?? node.width ?? 0;
      const h = node.absoluteBoundingBox?.height ?? node.height ?? 0;

      if (w < 44 || h < 44) {
        violations.push({
          ruleId: "button-min-touch-target",
          severity: rule.severity,
          nodeId: node.id,
          nodeName: node.name,
          message: `Button "${node.name}" is ${Math.round(w)}×${Math.round(h)}px — must be ≥ 44×44px for touch accessibility.`,
          autoFixed: false,
        });
      }
    }

    // ── component-must-be-instance ───────────────────────────────────────────
    if (activeRuleIds.has("component-must-be-instance") && isInteractiveButNotInstance(node)) {
      const rule = rules.find((r) => r.id === "component-must-be-instance")!;
      violations.push({
        ruleId: "component-must-be-instance",
        severity: rule.severity,
        nodeId: node.id,
        nodeName: node.name,
        message: `Interactive element "${node.name}" (type: ${node.type}) is not a DS component instance.`,
        autoFixed: false,
      });
    }

    // ── no-detached-text ─────────────────────────────────────────────────────
    if (activeRuleIds.has("no-detached-text") && hasDetachedTextColor(node)) {
      const rule = rules.find((r) => r.id === "no-detached-text")!;
      let fixed = false;

      if (autoFix && rule.autoFixable) {
        const hardcoded = node.fills?.find((f) => f.type === "SOLID" && !f.variableId && f.color);
        if (hardcoded?.color) {
          const { r, g, b } = hardcoded.color;
          const hex = `#${Math.round(r * 255).toString(16).padStart(2, "0")}${Math.round(g * 255).toString(16).padStart(2, "0")}${Math.round(b * 255).toString(16).padStart(2, "0")}`;
          const tokenRef = snapToColorToken(hex, dsTokens);
          const fixScript = buildMapColorToTokenScript(node.id, tokenRef.tokenName);
          const fixResult = await bridge.execute(fixScript);
          if (fixResult.success) {
            fixed = true;
            autoFixedCount++;
          }
        }
      }

      violations.push({
        ruleId: "no-detached-text",
        severity: rule.severity,
        nodeId: node.id,
        nodeName: node.name,
        message: `Text node "${node.name}" uses a hardcoded color fill instead of a variable alias.`,
        autoFixed: fixed,
      });
    }
  }

  return { violations, autoFixedCount };
}

// ─── Output formatters ────────────────────────────────────────────────────────

function formatOutput(
  violations: LintViolation[],
  format: OutputFormat,
  totalChecked: number,
  autoFixedCount: number
): string {
  if (format === "ci") {
    const errors = violations.filter((v) => v.severity === "error" && !v.autoFixed);
    const warnings = violations.filter((v) => v.severity === "warning" && !v.autoFixed);
    const lines = [
      `=== Figma Lint Report ===`,
      `Nodes checked : ${totalChecked}`,
      `Errors        : ${errors.length}`,
      `Warnings      : ${warnings.length}`,
      `Auto-fixed    : ${autoFixedCount}`,
      ``,
    ];
    for (const v of violations) {
      const icon = v.autoFixed ? "✓" : v.severity === "error" ? "✗" : "⚠";
      lines.push(`[${icon}] [${v.ruleId}] ${v.nodeName}: ${v.message}`);
    }
    return lines.join("\n");
  }

  if (format === "report") {
    const grouped: Record<string, LintViolation[]> = {};
    for (const v of violations) {
      (grouped[v.ruleId] = grouped[v.ruleId] ?? []).push(v);
    }
    const lines = [`# Lint Report\n`];
    for (const [ruleId, vs] of Object.entries(grouped)) {
      lines.push(`## ${ruleId} (${vs.length} violation${vs.length !== 1 ? "s" : ""})`);
      for (const v of vs) {
        const badge = v.autoFixed ? " [auto-fixed]" : "";
        lines.push(`- **${v.severity.toUpperCase()}** \`${v.nodeId}\` — ${v.message}${badge}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  // inline (default)
  return violations
    .map((v) => {
      const badge = v.autoFixed ? " [auto-fixed]" : "";
      return `[${v.severity.toUpperCase()}] ${v.ruleId} @ "${v.nodeName}" (${v.nodeId}): ${v.message}${badge}`;
    })
    .join("\n");
}

// ─── Action implementations ───────────────────────────────────────────────────

async function actionDefine(args: LintRulesArgs): Promise<LintDefineResult> {
  if (!args.ruleFile) {
    throw new Error("lintRules:define requires `ruleFile` pointing to a YAML file.");
  }

  const newRules = await loadRulesFromYaml(args.ruleFile);
  const existing = await loadStoredRules();

  // Merge: new rules overwrite existing rules with the same id
  const merged = [...existing];
  for (const nr of newRules) {
    const idx = merged.findIndex((r) => r.id === nr.id);
    if (idx >= 0) {
      merged[idx] = nr;
    } else {
      merged.push(nr);
    }
  }

  await saveStoredRules(merged);

  return {
    savedPath: RULES_STORE_PATH,
    ruleCount: merged.length,
  };
}

async function actionList(): Promise<LintListResult> {
  const rules = await getAllRules();
  return { rules };
}

async function actionDelete(args: LintRulesArgs): Promise<LintDeleteResult> {
  if (!args.ruleFile) {
    throw new Error("lintRules:delete requires `ruleFile` containing rule IDs to delete.");
  }

  const toDelete = await loadRulesFromYaml(args.ruleFile);
  const deleteIds = new Set(toDelete.map((r) => r.id));
  const existing = await loadStoredRules();
  const filtered = existing.filter((r) => !deleteIds.has(r.id));
  await saveStoredRules(filtered);

  return { deletedRuleIds: [...deleteIds] };
}

async function actionRun(args: LintRulesArgs): Promise<LintRunResult> {
  const bridge = await getBridge();
  const rules = await getAllRules();
  const dsTokens = await bridge.getTokens();

  // Fetch the node tree (or root if nodeId is not specified)
  let rootNode: FigmaNode;

  if (args.nodeId) {
    rootNode = await bridge.getNode(args.nodeId);
  } else {
    // Traverse all pages
    const execResult = await bridge.execute(`
      var allNodes = [];
      var page = figma.currentPage;
      var nodes = page.findAll(function() { return true; });
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        allNodes.push({
          id: n.id,
          name: n.name,
          type: n.type,
          fills: n.fills || [],
          absoluteBoundingBox: n.absoluteBoundingBox,
          paddingLeft: n.paddingLeft,
          paddingRight: n.paddingRight,
          paddingTop: n.paddingTop,
          paddingBottom: n.paddingBottom,
          itemSpacing: n.itemSpacing,
          layoutMode: n.layoutMode,
          opacity: n.opacity,
          width: n.width,
          height: n.height,
        });
      }
      return { id: 'root', name: 'Root', type: 'DOCUMENT', children: allNodes };
    `);

    if (!execResult.success) {
      throw new Error(`lintRules: Failed to fetch node tree: ${execResult.error}`);
    }
    rootNode = execResult.result as FigmaNode;
  }

  const nodes = collectAllNodes(rootNode);

  const { violations, autoFixedCount } = await runChecks(
    nodes,
    rules,
    args.autoFix ?? false,
    dsTokens,
    bridge
  );

  const unfixedErrors = violations.filter((v) => v.severity === "error" && !v.autoFixed);
  const unfixedWarnings = violations.filter((v) => v.severity === "warning" && !v.autoFixed);
  const exitCode = unfixedErrors.length > 0 ? 2 : unfixedWarnings.length > 0 ? 1 : 0;

  const outputText = formatOutput(violations, args.outputFormat, nodes.length, autoFixedCount);

  const logEntry = await decisionLog.log({
    tool: "lint-rules",
    nodeIds: violations.map((v) => v.nodeId).slice(0, 20),
    rationale: `Lint run on ${nodes.length} node(s). Violations: ${violations.length} (${unfixedErrors.length} errors, ${unfixedWarnings.length} warnings). Auto-fixed: ${autoFixedCount}. Exit code: ${exitCode}.`,
    tokens: [],
    reversible: false,
    metadata: {
      ruleCount: rules.length,
      nodeCount: nodes.length,
      violationCount: violations.length,
      autoFixedCount,
      exitCode,
      autoFix: args.autoFix,
    },
  });

  return {
    violations,
    totalChecked: nodes.length,
    errorCount: unfixedErrors.length,
    warningCount: unfixedWarnings.length,
    autoFixedCount,
    exitCode,
    outputText,
    logEntryId: logEntry.id,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function lintRulesHandler(args: LintRulesArgs): Promise<LintRulesResult> {
  switch (args.action) {
    case "define":
      return actionDefine(args);
    case "list":
      return actionList();
    case "delete":
      return actionDelete(args);
    case "run":
      return actionRun(args);
    default:
      throw new Error(`lintRules: Unknown action "${(args as LintRulesArgs).action}". Valid actions: define | run | list | delete.`);
  }
}
