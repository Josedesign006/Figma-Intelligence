import { DesignSystemContext, DSComponentSet } from "../../../shared/design-system-context.js";
import { ComponentManifest, ComponentSet } from "../../../shared/types.js";
export interface DSMatchResult {
    component: DSComponentSet | null;
    confidence: number;
    fallbackSuggestion: string | null;
}
/**
 * Match a ComponentManifest to the nearest design-system component.
 *
 * @param manifest       Recognised component manifest from Vision Pass 2
 * @param context        Shared design-system context
 * @param threshold      Minimum confidence (0–1) to accept the match
 * @returns              Matched ComponentSet (or null) with confidence score
 */
export declare function matchToDesignSystem(manifest: ComponentManifest, contextOrSets: DesignSystemContext | ComponentSet[], threshold?: number): DSMatchResult;
//# sourceMappingURL=ds-matcher.d.ts.map