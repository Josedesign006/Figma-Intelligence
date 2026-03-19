import { ComponentManifest, ComponentSet } from "../../../shared/types.js";
export interface IconComponentMatch {
    nodeId: string;
    name: string;
    confidence: number;
    nodeType: string;
}
export declare function resolveIconComponentMatch(manifest: ComponentManifest, componentSets: ComponentSet[]): IconComponentMatch | null;
//# sourceMappingURL=icon-resolver.d.ts.map