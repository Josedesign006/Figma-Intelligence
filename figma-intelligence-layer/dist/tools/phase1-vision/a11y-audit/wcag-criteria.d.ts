export type WCAGLevel = "A" | "AA" | "AAA";
export type CheckCapability = "automated" | "heuristic" | "manual";
export type ConformanceStatus = "Supports" | "Partially Supports" | "Does Not Support" | "Not Applicable" | "Not Evaluated";
export type WCAGPrinciple = "Perceivable" | "Operable" | "Understandable" | "Robust";
export interface WCAGCriterionDef {
    id: string;
    name: string;
    level: WCAGLevel;
    principle: WCAGPrinciple;
    guideline: string;
    checkCapability: CheckCapability;
    figmaRelevance: string;
    manualGuidance: string;
    checkerFnName?: string;
}
export declare const WCAG_CRITERIA: WCAGCriterionDef[];
/** Return all criteria at or below the given conformance level. */
export declare function getCriteriaForLevel(level: WCAGLevel): WCAGCriterionDef[];
/** Return a single criterion definition by ID, or undefined. */
export declare function getCriterionById(id: string): WCAGCriterionDef | undefined;
//# sourceMappingURL=wcag-criteria.d.ts.map