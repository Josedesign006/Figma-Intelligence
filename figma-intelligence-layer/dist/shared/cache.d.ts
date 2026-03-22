import { FigmaBridge } from "./figma-bridge.js";
import { FigmaNode, Token, ComponentSet } from "./types.js";
import { EnrichedDesignSystem } from "./enrichment-pipeline.js";
export interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
    hits: number;
}
export interface CacheStats {
    size: number;
    hits: number;
    misses: number;
    evictions: number;
    hitRate: number;
}
export declare class ResponseCache {
    private cache;
    private maxEntries;
    private defaultTTL;
    private stats;
    constructor(options?: {
        maxEntries?: number;
        defaultTTL?: number;
    });
    get<T>(key: string): T | undefined;
    set<T>(key: string, data: T, ttl?: number): void;
    invalidate(key: string): boolean;
    invalidate(pattern: RegExp): number;
    invalidateAll(): void;
    getStats(): CacheStats;
    private evictLRU;
}
export declare class BridgeCache {
    private cache;
    private bridge;
    constructor(bridge: FigmaBridge);
    /** Cache node lookups (2-min TTL — nodes change more frequently). */
    getNode(nodeId: string): Promise<FigmaNode>;
    /** Cache tokens with longer TTL (5 min). */
    getTokens(collectionId?: string): Promise<Token[]>;
    /** Cache component sets (5 min TTL). */
    getComponentSets(): Promise<ComponentSet[]>;
    /** Cache + enrich design system data (tokens + components combined). */
    getEnrichedDesignSystem(): Promise<EnrichedDesignSystem>;
    /** Invalidate all cached data on document changes. */
    onDocumentChange(): void;
    getStats(): CacheStats;
}
//# sourceMappingURL=cache.d.ts.map