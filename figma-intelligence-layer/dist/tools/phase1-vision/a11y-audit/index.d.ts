import { WCAGIssue } from "../../../shared/types.js";
export interface A11yAuditArgs {
    nodeId: string;
    wcagLevel: "A" | "AA" | "AAA";
    includeColorBlindSim?: boolean;
    outputFormat: "inline" | "report" | "both";
    autoSuggestFixes?: boolean;
}
interface ColorBlindSimResult {
    profile: string;
    contrastRatio: number;
    passes: boolean;
}
interface ExtendedWCAGIssue extends WCAGIssue {
    colorBlindSims?: ColorBlindSimResult[];
}
export interface A11yAuditResult {
    nodeId: string;
    wcagLevel: "A" | "AA" | "AAA";
    totalChecks: number;
    passed: number;
    failed: number;
    passRate: string;
    issues: ExtendedWCAGIssue[];
    annotationsAdded: number;
}
export declare function a11yAuditHandler(args: A11yAuditArgs): Promise<A11yAuditResult>;
export {};
//# sourceMappingURL=index.d.ts.map