import { ComponentManifest } from "./types";
import { DSComponentSet, DesignSystemContext } from "./design-system-context";
export interface DSMatchRequest {
    componentType?: string;
    textContent?: string | null;
    variants?: Record<string, string | undefined>;
    estimatedRadius?: number;
    estimatedSpacing?: number;
    estimatedFontSize?: number;
    interactiveElement?: boolean;
}
export interface DesignSystemMatchResult {
    component: DSComponentSet | null;
    confidence: number;
    fallbackSuggestion: string | null;
    scores: {
        name: number;
        intent: number;
        variant: number;
        usage: number;
    };
}
export declare function matchComponentInContext(request: DSMatchRequest, ctx: DesignSystemContext, threshold?: number): DesignSystemMatchResult;
export declare function manifestToDSMatchRequest(manifest: ComponentManifest): DSMatchRequest;
//# sourceMappingURL=design-system-matcher.d.ts.map