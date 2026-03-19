import { ComponentManifest, TokenRef } from "../../../shared/types.js";
export interface InferredTokens {
    spacing: TokenRef;
    radius?: TokenRef;
    fontSize?: TokenRef;
}
/**
 * Snap raw values from a component manifest to the nearest design tokens.
 *
 * Token inference algorithm (from plan):
 *   rawSpacing  → Math.round(raw / 4) * 4 → nearest spacing token
 *   rawRadius   → snap to [0, 2, 4, 8, 12, 16, 24, 32] → nearest token
 *   rawFontSize → snap to type scale tokens → nearest token
 */
export declare function inferTokens(manifest: ComponentManifest): InferredTokens;
//# sourceMappingURL=token-inferencer.d.ts.map