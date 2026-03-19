import { LogEntry } from "../../../shared/types.js";
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
export declare function decisionLogToolHandler(args: DecisionLogArgs): Promise<DecisionLogResult>;
//# sourceMappingURL=index.d.ts.map