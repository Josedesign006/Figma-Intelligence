// ─────────────────────────────────────────────────────────────────────────────
// Rule Engine
// Core engine that loads, stores, and executes lint rules against a Figma
// node tree.  Rules can be built-in or user-defined (loaded from YAML).
// ─────────────────────────────────────────────────────────────────────────────

import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { FigmaNode, LintViolation, Paint, Token } from "../../../shared/types.js";
import { snapToSpacingToken, snapToColorToken } from "../../../shared/token-utils.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LintRule {
  id: string;
  name: string;
  description: string;
  severity: "error" | "warning";
  autoFixable: boolean;
  builtIn: boolean;
}

interface YamlRuleDef {
  id: string;
  name?: string;
  description?: string;
  severity?: "error" | "warning";
  autoFixable?: boolean;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const RULES_STORE_PATH =
  process.env.LINT_RULES_PATH ||
  path.join(process.cwd(), ".figma-lint-rules.json");

export async function loadStoredRules(): Promise<LintRule[]> {
  try {
    const data = await fs.readFile(RULES_STORE_PATH, "utf-8");
    const parsed = JSON.parse(data) as { rules: LintRule[] };
    return parsed.rules ?? [];
  } catch {
    return [];
  }
}

export async function saveStoredRules(rules: LintRule[]): Promise<void> {
  await fs.writeFile(RULES_STORE_PATH, JSON.stringify({ rules }, null, 2), "utf-8");
}

// ─── YAML loader ──────────────────────────────────────────────────────────────

export async function loadRulesFromYaml(filePath: string): Promise<LintRule[]> {
  const content = await fs.readFile(filePath, "utf-8");
  const parsed = yaml.load(content) as { rules?: YamlRuleDef[] };

  if (!parsed?.rules || !Array.isArray(parsed.rules)) {
    throw new Error(`YAML file at "${filePath}" must contain a top-level "rules" array.`);
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

// ─── Merge helpers ────────────────────────────────────────────────────────────

export function mergeRules(builtIn: LintRule[], stored: LintRule[]): LintRule[] {
  const custom = stored.filter((r) => !r.builtIn);
  const overridden = builtIn.map((br) => stored.find((r) => r.id === br.id) ?? br);
  return [...overridden, ...custom];
}

// ─── Node checks ──────────────────────────────────────────────────────────────

export function hasHardcodedColor(fills: Paint[] | undefined): boolean {
  if (!fills || fills.length === 0) return false;
  return fills.some((f) => f.type === "SOLID" && !f.variableId);
}

export function isSpacingOffGrid(value: number | undefined): boolean {
  if (value === undefined || value === 0) return false;
  return value % 4 !== 0;
}

export function isButton(node: FigmaNode): boolean {
  return /\bbtn\b|\bbutton\b|\bcta\b/i.test(node.name) ||
    node.type === "INSTANCE" ||
    node.type === "COMPONENT";
}

export function isInteractiveButNotInstance(node: FigmaNode): boolean {
  const isInteractive = /\bbtn\b|\bbutton\b|\binput\b|\blink\b|\bcheckbox\b|\bradio\b|\bswitch\b/i.test(node.name);
  return isInteractive && node.type !== "INSTANCE" && node.type !== "COMPONENT";
}

// ─── Tree traversal ───────────────────────────────────────────────────────────

export function collectAllNodes(root: FigmaNode): FigmaNode[] {
  const nodes: FigmaNode[] = [root];
  if (root.children) {
    for (const child of root.children) {
      nodes.push(...collectAllNodes(child));
    }
  }
  return nodes;
}
