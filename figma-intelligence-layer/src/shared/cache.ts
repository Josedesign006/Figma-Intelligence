// ─────────────────────────────────────────────────────────────────────────────
// P1: Intelligent Caching Layer — TTL-based caching for Figma API responses
// ─────────────────────────────────────────────────────────────────────────────

import { FigmaBridge } from "./figma-bridge.js";
import { FigmaNode, Token, ComponentSet } from "./types.js";
import { enrichDesignSystem, EnrichedDesignSystem } from "./enrichment-pipeline.js";

// ─── Core cache types ────────────────────────────────────────────────────────

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

// ─── ResponseCache ───────────────────────────────────────────────────────────

export class ResponseCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxEntries: number;
  private defaultTTL: number;
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(options?: { maxEntries?: number; defaultTTL?: number }) {
    this.maxEntries = options?.maxEntries ?? 200;
    this.defaultTTL = options?.defaultTTL ?? 5 * 60 * 1000; // 5 minutes
  }

  get<T>(key: string): T | undefined {
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
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
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

  invalidate(key: string): boolean;
  invalidate(pattern: RegExp): number;
  invalidate(keyOrPattern: string | RegExp): boolean | number {
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

  invalidateAll(): void {
    this.cache.clear();
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: total === 0 ? 0 : this.stats.hits / total,
    };
  }

  private evictLRU(): void {
    // Find the entry with fewest hits; break ties by oldest timestamp.
    let victimKey: string | undefined;
    let victimHits = Infinity;
    let victimTimestamp = Infinity;

    for (const [key, entry] of this.cache) {
      if (
        entry.hits < victimHits ||
        (entry.hits === victimHits && entry.timestamp < victimTimestamp)
      ) {
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

// ─── BridgeCache ─────────────────────────────────────────────────────────────

export class BridgeCache {
  private cache: ResponseCache;
  private bridge: FigmaBridge;

  constructor(bridge: FigmaBridge) {
    this.cache = new ResponseCache();
    this.bridge = bridge;
  }

  /** Cache node lookups (2-min TTL — nodes change more frequently). */
  async getNode(nodeId: string): Promise<FigmaNode> {
    const key = `node:${nodeId}`;
    const cached = this.cache.get<FigmaNode>(key);
    if (cached) return cached;
    const node = await this.bridge.getNode(nodeId);
    this.cache.set(key, node, 2 * 60 * 1000);
    return node;
  }

  /** Cache tokens with longer TTL (5 min). */
  async getTokens(collectionId?: string): Promise<Token[]> {
    const key = `tokens:${collectionId || "all"}`;
    const cached = this.cache.get<Token[]>(key);
    if (cached) return cached;
    const tokens = await this.bridge.getTokens(collectionId);
    this.cache.set(key, tokens, 5 * 60 * 1000);
    return tokens;
  }

  /** Cache component sets (5 min TTL). */
  async getComponentSets(): Promise<ComponentSet[]> {
    const key = "componentSets";
    const cached = this.cache.get<ComponentSet[]>(key);
    if (cached) return cached;
    const sets = await this.bridge.getComponentSets();
    this.cache.set(key, sets, 5 * 60 * 1000);
    return sets;
  }

  /** Cache + enrich design system data (tokens + components combined). */
  async getEnrichedDesignSystem(): Promise<EnrichedDesignSystem> {
    const key = "enrichedDS";
    const cached = this.cache.get<EnrichedDesignSystem>(key);
    if (cached) return cached;

    const [tokens, componentSets] = await Promise.all([
      this.getTokens(),
      this.getComponentSets(),
    ]);
    const enriched = enrichDesignSystem(tokens, componentSets);
    this.cache.set(key, enriched, 5 * 60 * 1000);
    return enriched;
  }

  /** Invalidate all cached data on document changes. */
  onDocumentChange(): void {
    this.cache.invalidate(/^(node|tokens|componentSets|enrichedDS)/);
  }

  getStats(): CacheStats {
    return this.cache.getStats();
  }
}
