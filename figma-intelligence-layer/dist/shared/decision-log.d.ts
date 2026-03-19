import { LogEntry } from "./types.js";
export declare function resolveLogPath(): Promise<string>;
export declare class DecisionLog {
    private readAll;
    private writeAll;
    log(entry: Omit<LogEntry, "id" | "timestamp">): Promise<LogEntry>;
    query(question: string): Promise<LogEntry[]>;
    export(format: "json" | "markdown"): Promise<string>;
    clear(): Promise<void>;
    getRecent(days: number): Promise<LogEntry[]>;
}
export declare const decisionLog: DecisionLog;
//# sourceMappingURL=decision-log.d.ts.map