export type AuditArea = "hierarchy" | "contrast" | "density" | "brand" | "consistency";
export interface VisualAuditArgs {
    nodeId?: string;
    imageInput?: string;
    auditAreas: AuditArea[];
    outputFormat: "report" | "annotations" | "both";
}
interface AuditIssue {
    severity: "error" | "warning" | "suggestion";
    description: string;
    area: string;
}
export interface VisualAuditResult {
    hierarchyScore: number;
    cognitiveLoadRating: "low" | "medium" | "high";
    brandAlignmentNotes: string;
    consistencyIssues: string[];
    overallScore: number;
    topIssues: AuditIssue[];
    estimatedFixTimeMinutes: number;
    annotationPageId?: string;
    auditAreas: AuditArea[];
    nodeId?: string;
    rawAnalysis?: Record<string, unknown>;
}
export declare function visualAuditHandler(args: VisualAuditArgs): Promise<VisualAuditResult>;
export {};
//# sourceMappingURL=index.d.ts.map