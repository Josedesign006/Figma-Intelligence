import { WCAGLevel, WCAGPrinciple, ConformanceStatus } from "./wcag-criteria.js";
import { WCAGIssue } from "../../../shared/types.js";
/** Summary of what the design contains — drives contextual VPAT remarks. */
export interface DesignContext {
    /** Human-readable name of the audited frame/page */
    frameName: string;
    /** Total node count in the tree */
    totalNodes: number;
    /** Count of TEXT nodes */
    textNodeCount: number;
    /** Count of interactive elements (buttons, links, inputs, etc.) */
    interactiveCount: number;
    /** Count of IMAGE / VECTOR nodes (non-text visuals) */
    imageCount: number;
    /** Count of COMPONENT_SET nodes */
    componentSetCount: number;
    /** Count of FRAME / GROUP containers */
    frameCount: number;
    /** Names of detected landmarks (nav, header, footer, sidebar, etc.) */
    landmarkNames: string[];
    /** Names/labels of detected interactive elements (first N) */
    interactiveLabels: string[];
    /** Whether the design appears to contain form inputs */
    hasFormInputs: boolean;
    /** Whether the design contains navigation-like structures */
    hasNavigation: boolean;
    /** Whether the design contains images or icons */
    hasImages: boolean;
    /** Whether the design contains headings (large/bold text) */
    hasHeadings: boolean;
    /** Sample heading texts found */
    headingTexts: string[];
    /** Whether auto-layout is used on frames */
    hasAutoLayout: boolean;
    /** Sample text content (first few text strings for context) */
    sampleTexts: string[];
    /** Interactive element type breakdown */
    interactiveBreakdown: Record<string, number>;
}
export interface VPATRow {
    criterionId: string;
    criterionName: string;
    level: WCAGLevel;
    principle: WCAGPrinciple;
    guideline: string;
    conformanceStatus: ConformanceStatus;
    checkType: "automated" | "heuristic" | "manual";
    remarks: string;
    issues: WCAGIssue[];
}
export interface VPATSummary {
    totalCriteria: number;
    supports: number;
    partiallySupports: number;
    doesNotSupport: number;
    notApplicable: number;
    notEvaluated: number;
    automatedChecks: number;
    heuristicChecks: number;
    manualReviewRequired: number;
}
export interface VPATReport {
    title: string;
    wcagVersion: "2.2";
    evaluatedLevel: WCAGLevel;
    evaluationDate: string;
    nodeId: string;
    nodeName: string;
    summary: VPATSummary;
    principles: Record<WCAGPrinciple, VPATRow[]>;
    rows: VPATRow[];
    formattedReport: string;
}
/**
 * Build a VPAT-style accessibility conformance report.
 *
 * @param evaluatedLevel - WCAG conformance level to evaluate
 * @param nodeId         - Figma node ID that was audited
 * @param nodeName       - Human-readable name of the audited node
 * @param issues         - All issues found by the checker functions
 * @param designContext  - Summary of design contents for contextual remarks
 * @param applicabilityOverrides - Optional overrides for specific SC (e.g. mark media criteria as N/A)
 */
export declare function buildVPATReport(evaluatedLevel: WCAGLevel, nodeId: string, nodeName: string, issues: WCAGIssue[], designContext?: DesignContext, applicabilityOverrides?: Record<string, ConformanceStatus>): VPATReport;
//# sourceMappingURL=vpat-report.d.ts.map