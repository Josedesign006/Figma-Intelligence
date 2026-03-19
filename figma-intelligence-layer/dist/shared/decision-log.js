"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decisionLog = exports.DecisionLog = void 0;
exports.resolveLogPath = resolveLogPath;
const promises_1 = __importDefault(require("fs/promises"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
function getFallbackLogDir() {
    return path_1.default.join(process.env.CODEX_HOME || path_1.default.join(os_1.default.homedir(), ".codex"), "figma-intelligence-layer");
}
async function resolveLogPath() {
    const configuredPath = process.env.DECISION_LOG_PATH;
    if (configuredPath) {
        await promises_1.default.mkdir(path_1.default.dirname(configuredPath), { recursive: true });
        return configuredPath;
    }
    const cwdPath = path_1.default.join(process.cwd(), ".decision-log.json");
    try {
        await promises_1.default.mkdir(path_1.default.dirname(cwdPath), { recursive: true });
        await promises_1.default.access(path_1.default.dirname(cwdPath), promises_1.default.constants.W_OK);
        return cwdPath;
    }
    catch {
        const fallbackLogDir = getFallbackLogDir();
        await promises_1.default.mkdir(fallbackLogDir, { recursive: true });
        return path_1.default.join(fallbackLogDir, ".decision-log.json");
    }
}
class DecisionLog {
    async readAll() {
        try {
            const logPath = await resolveLogPath();
            const data = await promises_1.default.readFile(logPath, "utf-8");
            return JSON.parse(data);
        }
        catch {
            return [];
        }
    }
    async writeAll(entries) {
        const logPath = await resolveLogPath();
        await promises_1.default.writeFile(logPath, JSON.stringify(entries, null, 2), "utf-8");
    }
    async log(entry) {
        const entries = await this.readAll();
        const full = {
            id: `log_${new Date().toISOString().replace(/\D/g, "").slice(0, 15)}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            ...entry,
        };
        entries.push(full);
        await this.writeAll(entries);
        return full;
    }
    async query(question) {
        const entries = await this.readAll();
        if (entries.length === 0)
            return [];
        const keywords = question
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 2);
        const scored = entries.map((entry) => {
            const text = [
                entry.tool,
                entry.rationale,
                ...(entry.tokens ?? []),
                ...entry.nodeIds,
            ]
                .join(" ")
                .toLowerCase();
            const score = keywords.reduce((sum, kw) => sum + (text.includes(kw) ? 1 : 0), 0);
            return { entry, score };
        });
        return scored
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map((s) => s.entry);
    }
    async export(format) {
        const entries = await this.readAll();
        if (format === "json") {
            return JSON.stringify(entries, null, 2);
        }
        // Markdown format
        const lines = [
            "# Design Decision Log",
            `*Exported: ${new Date().toISOString()}*`,
            `*Total entries: ${entries.length}*`,
            "",
        ];
        for (const e of entries) {
            lines.push(`## ${e.id}`);
            lines.push(`- **Tool:** \`${e.tool}\``);
            lines.push(`- **Time:** ${e.timestamp}`);
            lines.push(`- **Nodes:** ${e.nodeIds.join(", ")}`);
            if (e.tokens?.length)
                lines.push(`- **Tokens:** ${e.tokens.join(", ")}`);
            lines.push(`- **Reversible:** ${e.reversible ? "Yes" : "No"}`);
            lines.push(`\n${e.rationale}`);
            lines.push("");
        }
        return lines.join("\n");
    }
    async clear() {
        await this.writeAll([]);
    }
    async getRecent(days) {
        const entries = await this.readAll();
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        return entries.filter((e) => new Date(e.timestamp).getTime() > cutoff);
    }
}
exports.DecisionLog = DecisionLog;
exports.decisionLog = new DecisionLog();
//# sourceMappingURL=decision-log.js.map