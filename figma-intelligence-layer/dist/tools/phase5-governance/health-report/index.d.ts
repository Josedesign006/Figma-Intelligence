import { HealthScore } from "../../../shared/types.js";
export interface HealthReportArgs {
    fileKey?: string;
    includeHistory?: boolean;
    outputFormat: "report" | "figma-page" | "slack-digest" | "all";
    runAudits: Array<"a11y" | "lint" | "tokens" | "components" | "drift" | "all">;
}
export interface HealthReportResult {
    scores: HealthScore;
    topActions: string[];
    outputText: string;
    figmaPageId?: string;
    historicalTrend?: Array<{
        date: string;
        overall: number;
    }>;
    logEntryId: string;
}
export declare function healthReportHandler(args: HealthReportArgs): Promise<HealthReportResult>;
//# sourceMappingURL=index.d.ts.map