import fs from "fs/promises";
import os from "os";
import path from "path";
import { LogEntry } from "./types.js";

function getFallbackLogDir(): string {
  return path.join(
    process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
    "figma-intelligence-layer"
  );
}

export async function resolveLogPath(): Promise<string> {
  const configuredPath = process.env.DECISION_LOG_PATH;
  if (configuredPath) {
    await fs.mkdir(path.dirname(configuredPath), { recursive: true });
    return configuredPath;
  }

  const cwdPath = path.join(process.cwd(), ".decision-log.json");
  try {
    await fs.mkdir(path.dirname(cwdPath), { recursive: true });
    await fs.access(path.dirname(cwdPath), fs.constants.W_OK);
    return cwdPath;
  } catch {
    const fallbackLogDir = getFallbackLogDir();
    await fs.mkdir(fallbackLogDir, { recursive: true });
    return path.join(fallbackLogDir, ".decision-log.json");
  }
}

export class DecisionLog {
  private async readAll(): Promise<LogEntry[]> {
    try {
      const logPath = await resolveLogPath();
      const data = await fs.readFile(logPath, "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeAll(entries: LogEntry[]): Promise<void> {
    const logPath = await resolveLogPath();
    await fs.writeFile(logPath, JSON.stringify(entries, null, 2), "utf-8");
  }

  async log(entry: Omit<LogEntry, "id" | "timestamp">): Promise<LogEntry> {
    const entries = await this.readAll();
    const full: LogEntry = {
      id: `log_${new Date().toISOString().replace(/\D/g, "").slice(0, 15)}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    entries.push(full);
    await this.writeAll(entries);
    return full;
  }

  async query(question: string): Promise<LogEntry[]> {
    const entries = await this.readAll();
    if (entries.length === 0) return [];

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
      const score = keywords.reduce(
        (sum, kw) => sum + (text.includes(kw) ? 1 : 0),
        0
      );
      return { entry, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((s) => s.entry);
  }

  async export(format: "json" | "markdown"): Promise<string> {
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
      if (e.tokens?.length) lines.push(`- **Tokens:** ${e.tokens.join(", ")}`);
      lines.push(`- **Reversible:** ${e.reversible ? "Yes" : "No"}`);
      lines.push(`\n${e.rationale}`);
      lines.push("");
    }
    return lines.join("\n");
  }

  async clear(): Promise<void> {
    await this.writeAll([]);
  }

  async getRecent(days: number): Promise<LogEntry[]> {
    const entries = await this.readAll();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return entries.filter((e) => new Date(e.timestamp).getTime() > cutoff);
  }
}

export const decisionLog = new DecisionLog();
