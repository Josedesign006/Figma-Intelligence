// ─────────────────────────────────────────────────────────────────────────────
// Decision Log Tool
// Provides log / query / export / clear operations over the shared DecisionLog
// that records every design action taken across all tools.
// ─────────────────────────────────────────────────────────────────────────────

import { decisionLog } from "../../../shared/decision-log.js";
import { LogEntry } from "../../../shared/types.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DecisionLogArgs {
  action: "log" | "query" | "export" | "clear";
  entry?: {
    tool: string;
    nodeIds: string[];
    rationale: string;
    tokens?: string[];
    reversible?: boolean;
  };
  query?: string;
  exportFormat?: "json" | "markdown";
}

export interface DecisionLogResult {
  action: "log" | "query" | "export" | "clear";
  /** Populated for action="log" — the created LogEntry */
  createdEntry?: LogEntry;
  /** Populated for action="query" — matching entries */
  entries?: LogEntry[];
  /** Populated for action="export" — serialized string */
  exportedContent?: string;
  /** Populated for action="clear" — count of removed entries */
  clearedCount?: number;
  message: string;
}

// ─── Action implementations ───────────────────────────────────────────────────

async function actionLog(args: DecisionLogArgs): Promise<DecisionLogResult> {
  if (!args.entry) {
    throw new Error(
      'decisionLogTool: action "log" requires an "entry" object with tool, nodeIds, and rationale.'
    );
  }

  const { tool, nodeIds, rationale, tokens, reversible } = args.entry;

  if (!tool) throw new Error('decisionLogTool: entry.tool is required.');
  if (!rationale) throw new Error('decisionLogTool: entry.rationale is required.');

  const created = await decisionLog.log({
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

async function actionQuery(args: DecisionLogArgs): Promise<DecisionLogResult> {
  if (!args.query) {
    throw new Error('decisionLogTool: action "query" requires a "query" string.');
  }

  const entries = await decisionLog.query(args.query);

  return {
    action: "query",
    entries,
    message: `Found ${entries.length} log entr${entries.length === 1 ? "y" : "ies"} matching query: "${args.query}".`,
  };
}

async function actionExport(args: DecisionLogArgs): Promise<DecisionLogResult> {
  const format = args.exportFormat ?? "json";
  const exportedContent = await decisionLog.export(format);

  const sizeKb = (Buffer.byteLength(exportedContent, "utf-8") / 1024).toFixed(1);

  return {
    action: "export",
    exportedContent,
    message: `Exported decision log as ${format} (${sizeKb} KB).`,
  };
}

async function actionClear(): Promise<DecisionLogResult> {
  // Read the current count before clearing so we can report it
  const beforeExport = await decisionLog.export("json");
  let clearedCount = 0;
  try {
    const entries: LogEntry[] = JSON.parse(beforeExport);
    clearedCount = Array.isArray(entries) ? entries.length : 0;
  } catch {
    clearedCount = 0;
  }

  await decisionLog.clear();

  return {
    action: "clear",
    clearedCount,
    message: `Cleared ${clearedCount} decision log entr${clearedCount === 1 ? "y" : "ies"}.`,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function decisionLogToolHandler(
  args: DecisionLogArgs
): Promise<DecisionLogResult> {
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
      const exhaustive: never = args.action;
      throw new Error(
        `decisionLogTool: Unknown action "${exhaustive}". Valid actions: log | query | export | clear.`
      );
    }
  }
}
