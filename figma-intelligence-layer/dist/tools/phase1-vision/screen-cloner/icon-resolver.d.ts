import { ComponentManifest, ComponentSet } from "../../../shared/types.js";
import { type IconEntry } from "../../../shared/icon-catalog.js";
export interface IconComponentMatch {
    nodeId: string;
    name: string;
    confidence: number;
    nodeType: string;
}
/**
 * Try to resolve an icon name against the catalog before falling back
 * to Fuse.js component set matching.
 */
export declare function resolveFromCatalog(iconName: string): IconEntry | null;
export declare function resolveIconComponentMatch(manifest: ComponentManifest, componentSets: ComponentSet[]): IconComponentMatch | null;
//# sourceMappingURL=icon-resolver.d.ts.map