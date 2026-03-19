import { DriftReport } from "../../../shared/types.js";
export interface SystemDriftArgs {
    canonicalFileKey: string;
    targetFileKeys: string[];
    tokenTypes?: string[];
    threshold?: number;
    outputFormat: "report" | "annotations" | "pr-comment";
}
export interface DriftSummary {
    filesChecked: number;
    healthyFiles: number;
    warningFiles: number;
    criticalFiles: number;
    totalTokensCompared: number;
    totalDriftingTokens: number;
    overallDriftScore: number;
}
export interface SystemDriftResult {
    reports: DriftReport[];
    summary: DriftSummary;
    formattedOutput: string;
    logEntryId: string;
}
export declare function systemDriftHandler(args: SystemDriftArgs): Promise<SystemDriftResult>;
//# sourceMappingURL=index.d.ts.map