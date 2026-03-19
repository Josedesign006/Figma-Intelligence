"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Rule Engine
// Core engine that loads, stores, and executes lint rules against a Figma
// node tree.  Rules can be built-in or user-defined (loaded from YAML).
// ─────────────────────────────────────────────────────────────────────────────
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadStoredRules = loadStoredRules;
exports.saveStoredRules = saveStoredRules;
exports.loadRulesFromYaml = loadRulesFromYaml;
exports.mergeRules = mergeRules;
exports.hasHardcodedColor = hasHardcodedColor;
exports.isSpacingOffGrid = isSpacingOffGrid;
exports.isButton = isButton;
exports.isInteractiveButNotInstance = isInteractiveButNotInstance;
exports.collectAllNodes = collectAllNodes;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const js_yaml_1 = __importDefault(require("js-yaml"));
// ─── Persistence ──────────────────────────────────────────────────────────────
const RULES_STORE_PATH = process.env.LINT_RULES_PATH ||
    path_1.default.join(process.cwd(), ".figma-lint-rules.json");
async function loadStoredRules() {
    try {
        const data = await promises_1.default.readFile(RULES_STORE_PATH, "utf-8");
        const parsed = JSON.parse(data);
        return parsed.rules ?? [];
    }
    catch {
        return [];
    }
}
async function saveStoredRules(rules) {
    await promises_1.default.writeFile(RULES_STORE_PATH, JSON.stringify({ rules }, null, 2), "utf-8");
}
// ─── YAML loader ──────────────────────────────────────────────────────────────
async function loadRulesFromYaml(filePath) {
    const content = await promises_1.default.readFile(filePath, "utf-8");
    const parsed = js_yaml_1.default.load(content);
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
function mergeRules(builtIn, stored) {
    const custom = stored.filter((r) => !r.builtIn);
    const overridden = builtIn.map((br) => stored.find((r) => r.id === br.id) ?? br);
    return [...overridden, ...custom];
}
// ─── Node checks ──────────────────────────────────────────────────────────────
function hasHardcodedColor(fills) {
    if (!fills || fills.length === 0)
        return false;
    return fills.some((f) => f.type === "SOLID" && !f.variableId);
}
function isSpacingOffGrid(value) {
    if (value === undefined || value === 0)
        return false;
    return value % 4 !== 0;
}
function isButton(node) {
    return /\bbtn\b|\bbutton\b|\bcta\b/i.test(node.name) ||
        node.type === "INSTANCE" ||
        node.type === "COMPONENT";
}
function isInteractiveButNotInstance(node) {
    const isInteractive = /\bbtn\b|\bbutton\b|\binput\b|\blink\b|\bcheckbox\b|\bradio\b|\bswitch\b/i.test(node.name);
    return isInteractive && node.type !== "INSTANCE" && node.type !== "COMPONENT";
}
// ─── Tree traversal ───────────────────────────────────────────────────────────
function collectAllNodes(root) {
    const nodes = [root];
    if (root.children) {
        for (const child of root.children) {
            nodes.push(...collectAllNodes(child));
        }
    }
    return nodes;
}
//# sourceMappingURL=rule-engine.js.map