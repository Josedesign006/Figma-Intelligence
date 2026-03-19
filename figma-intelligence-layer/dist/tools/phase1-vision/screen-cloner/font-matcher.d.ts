import { ComponentManifest } from "../../../shared/types.js";
export interface FontStyleMatch {
    styleId: string;
    styleName: string;
    fontFamily: string;
    fontStyle: string;
    fontSize: number;
    lineHeightPx?: number;
    confidence: number;
}
export declare function resolveFontStyleMatch(manifest: ComponentManifest, styles: Record<string, unknown> | undefined): FontStyleMatch | null;
//# sourceMappingURL=font-matcher.d.ts.map