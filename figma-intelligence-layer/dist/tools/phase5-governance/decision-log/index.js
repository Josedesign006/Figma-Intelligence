"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Decision Log Tool
// Provides log / query / export / clear operations over the shared DecisionLog
// that records every design action taken across all tools.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.decisionLogToolHandler = decisionLogToolHandler;
const decision_log_js_1 = require("../../../shared/decision-log.js");
// ─── Action implementations ───────────────────────────────────────────────────
async function actionLog(args) {
    if (!args.entry) {
        throw new Error('decisionLogTool: action "log" requires an "entry" object with tool, nodeIds, and rationale.');
    }
    const { tool, nodeIds, rationale, tokens, reversible } = args.entry;
    if (!tool)
        throw new Error('decisionLogTool: entry.tool is required.');
    if (!rationale)
        throw new Error('decisionLogTool: entry.rationale is required.');
    const created = await decision_log_js_1.decisionLog.log({
        tool,
        nodeIds: nodeIds ?? [],
        rationale,
        tokens,
        reversible: reversible ?? false,
    });
    return {
        action: "log",
        createdEntry: created,
        message: `Decision logged with id "${created.id}" for tool "${tool}".`,
    };
}
async function actionQuery(args) {
    if (!args.query) {
        throw new Error('decisionLogTool: action "query" requires a "query" string.');
    }
    const entries = await decision_log_js_1.decisionLog.query(args.query);
    return {
        action: "query",
        entries,
        message: `Found ${entries.length} log entr${entries.length === 1 ? "y" : "ies"} matching query: "${args.query}".`,
    };
}
async function actionExport(args) {
    const format = args.exportFormat ?? "json";
    const exportedContent = await decision_log_js_1.decisionLog.export(format);
    const sizeKb = (Buffer.byteLength(exportedContent, "utf-8") / 1024).toFixed(1);
    return {
        action: "export",
        exportedContent,
        message: `Exported decision log as ${format} (${sizeKb} KB).`,
    };
}
async function actionClear() {
    // Read the current count before clearing so we can report it
    const beforeExport = await decision_log_js_1.decisionLog.export("json");
    let clearedCount = 0;
    try {
        const entries = JSON.parse(beforeExport);
        clearedCount = Array.isArray(entries) ? entries.length : 0;
    }
    catch {
        clearedCount = 0;
    }
    await decision_log_js_1.decisionLog.clear();
    return {
        action: "clear",
        clearedCount,
        message: `Cleared ${clearedCount} decision log entr${clearedCount === 1 ? "y" : "ies"}.`,
    };
}
// ─── Main handler ─────────────────────────────────────────────────────────────
async function decisionLogToolHandler(args) {
    switch (args.action) {
        case "log":
            return actionLog(args);
        case "query":
            return actionQuery(args);
        case "export":
            return actionExport(args);
        case "clear":
            return actionClear();
        default: {
            const exhaustive = args.action;
            throw new Error(`decisionLogTool: Unknown action "${exhaustive}". Valid actions: log | query | export | clear.`);
        }
    }
}
//# sourceMappingURL=index.js.map