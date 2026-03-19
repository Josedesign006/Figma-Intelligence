import { FigmaNode } from "../../../shared/types.js";
export type LayerSignal = "icon" | "text" | "image" | "input" | "avatar" | "chevron" | "cta" | "title" | "body" | "label" | "subtitle";
export interface LayerSummary {
    totalLayers: number;
    depth: number;
    hasImage: boolean;
    hasIcon: boolean;
    hasText: boolean;
    hasInput: boolean;
    hasAvatar: boolean;
    textCount: number;
    rectangleCount: number;
    frameCount: number;
    vectorCount: number;
    layoutMode: string | null;
    childCount: number;
}
export interface PatternRule {
    pattern: string;
    candidates: string[];
    confidence: number;
    rationale: string;
    test: (summary: LayerSummary, signals: LayerSignal[]) => boolean;
}
export declare function inferSignal(node: FigmaNode): LayerSignal | null;
export declare function buildLayerSummary(root: FigmaNode): LayerSummary;
/**
 * From the plan:
 *   [Icon + Text horizontal]           → Button, MenuItem, Breadcrumb, Tab
 *   [Image + Title + Body + CTA]       → Card, Feature tile, Blog post item
 *   [Label above + Input below]        → Form field, Text input
 *   [Avatar + Name + Subtitle]         → User profile, Comment header
 *   [Icon + Title + Chevron]           → List item, Navigation row
 *   [N equal-width columns]            → Data table, Comparison card
 */
export declare const PATTERN_RULES: PatternRule[];
/** Run all pattern rules against a node's summary and return matches. */
export declare function matchPatterns(summary: LayerSummary, root: FigmaNode): Array<{
    pattern: string;
    candidates: string[];
    confidence: number;
    rationale: string;
}>;
//# sourceMappingURL=pattern-fingerprints.d.ts.map