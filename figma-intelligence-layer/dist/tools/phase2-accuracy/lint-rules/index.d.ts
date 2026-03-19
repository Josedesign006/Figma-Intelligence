import { LintViolation } from "../../../shared/types.js";
export type LintAction = "define" | "run" | "list" | "delete";
export type OutputFormat = "inline" | "report" | "ci";
export interface LintRulesArgs {
    action: LintAction;
    ruleFile?: string;
    nodeId?: string;
    autoFix?: boolean;
    outputFormat: OutputFormat;
}
export interface LintRule {
    id: string;
    name: string;
    description: string;
    severity: "error" | "warning";
    autoFixable: boolean;
    builtIn: boolean;
}
export interface LintRuleSet {
    rules: LintRule[];
}
export interface LintRunResult {
    violations: LintViolation[];
    totalChecked: number;
    errorCount: number;
    warningCount: number;
    autoFixedCount: number;
    exitCode: number;
    outputText: string;
    logEntryId: string;
}
export interface LintDefineResult {
    savedPath: string;
    ruleCount: number;
}
export interface LintListResult {
    rules: LintRule[];
}
export interface LintDeleteResult {
    deletedRuleIds: string[];
}
export type LintRulesResult = LintRunResult | LintDefineResult | LintListResult | LintDeleteResult;
export declare const BUILT_IN_RULES: LintRule[];
export declare function lintRulesHandler(args: LintRulesArgs): Promise<LintRulesResult>;
//# sourceMappingURL=index.d.ts.map