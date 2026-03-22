"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// P1: Intelligent Caching Layer — TTL-based caching for Figma API responses
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeCache = exports.ResponseCache = void 0;
const enrichment_pipeline_js_1 = require("./enrichment-pipeline.js");
// ─── ResponseCache ───────────────────────────────────────────────────────────
class ResponseCache {
    cache = new Map();
    maxEntries;
    defaultTTL;
    stats = { hits: 0, misses: 0, evictions: 0 };
    constructor(options) {
        this.maxEntries = options?.maxEntries ?? 200;
        this.defaultTTL = options?.defaultTTL ?? 5 * 60 * 1000; // 5 minutes
    }
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            this.stats.misses++;
            return undefined;
        }
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return undefined;
        }
        entry.hits++;
        this.stats.hits++;
        return entry.data;
    }
    set(key, data, ttl) {
        // LRU eviction when at capacity
        if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
            this.evictLRU();
        }
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            expiresAt: Date.now() + (ttl ?? this.defaultTTL),
            hits: 0,
        });
    }
    invalidate(keyOrPattern) {
        if (typeof keyOrPattern === "string") {
            return this.cache.delete(keyOrPattern);
        }
        let count = 0;
        for (const key of [...this.cache.keys()]) {
            if (keyOrPattern.test(key)) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }
    invalidateAll() {
        this.cache.clear();
    }
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            size: this.cache.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            evictions: this.stats.evictions,
            hitRate: total === 0 ? 0 : this.stats.hits / total,
        };
    }
    evictLRU() {
        // Find the entry with fewest hits; break ties by oldest timestamp.
        let victimKey;
        let victimHits = Infinity;
        let victimTimestamp = Infinity;
        for (const [key, entry] of this.cache) {
            if (entry.hits < victimHits ||
                (entry.hits === victimHits && entry.timestamp < victimTimestamp)) {
                victimKey = key;
                victimHits = entry.hits;
                victimTimestamp = entry.timestamp;
            }
        }
        if (victimKey !== undefined) {
            this.cache.delete(victimKey);
            this.stats.evictions++;
        }
    }
}
exports.ResponseCache = ResponseCache;
// ─── BridgeCache ─────────────────────────────────────────────────────────────
class BridgeCache {
    cache;
    bridge;
    constructor(bridge) {
        this.cache = new ResponseCache();
        this.bridge = bridge;
    }
    /** Cache node lookups (2-min TTL — nodes change more frequently). */
    async getNode(nodeId) {
        const key = `node:${nodeId}`;
        const cached = this.cache.get(key);
        if (cached)
            return cached;
        const node = await this.bridge.getNode(nodeId);
        this.cache.set(key, node, 2 * 60 * 1000);
        return node;
    }
    /** Cache tokens with longer TTL (5 min). */
    async getTokens(collectionId) {
        const key = `tokens:${collectionId || "all"}`;
        const cached = this.cache.get(key);
        if (cached)
            return cached;
        const tokens = await this.bridge.getTokens(collectionId);
        this.cache.set(key, tokens, 5 * 60 * 1000);
        return tokens;
    }
    /** Cache component sets (5 min TTL). */
    async getComponentSets() {
        const key = "componentSets";
        const cached = this.cache.get(key);
        if (cached)
            return cached;
        const sets = await this.bridge.getComponentSets();
        this.cache.set(key, sets, 5 * 60 * 1000);
        return sets;
    }
    /** Cache + enrich design system data (tokens + components combined). */
    async getEnrichedDesignSystem() {
        const key = "enrichedDS";
        const cached = this.cache.get(key);
        if (cached)
            return cached;
        const [tokens, componentSets] = await Promise.all([
            this.getTokens(),
            this.getComponentSets(),
        ]);
        const enriched = (0, enrichment_pipeline_js_1.enrichDesignSystem)(tokens, componentSets);
        this.cache.set(key, enriched, 5 * 60 * 1000);
        return enriched;
    }
    /** Invalidate all cached data on document changes. */
    onDocumentChange() {
        this.cache.invalidate(/^(node|tokens|componentSets|enrichedDS)/);
    }
    getStats() {
        return this.cache.getStats();
    }
}
exports.BridgeCache = BridgeCache;
//# sourceMappingURL=cache.js.map