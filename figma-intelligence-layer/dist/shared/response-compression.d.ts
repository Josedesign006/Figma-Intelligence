import { FigmaNode, Token, ComponentSet } from "./types.js";
export type CompressionTier = "full" | "summary" | "inventory" | "compact";
export interface CompressionOptions {
    forceTier?: CompressionTier;
    maxSizeBytes?: number;
}
export interface CompressedResponse {
    tier: CompressionTier;
    originalSizeBytes: number;
    compressedSizeBytes: number;
    data: unknown;
}
/**
 * Compress a Figma node tree according to the specified tier.
 */
export declare function compressNodeTree(node: FigmaNode, tier?: CompressionTier): unknown;
/**
 * Compress a list of design tokens according to the specified tier.
 */
export declare function compressTokenList(tokens: Token[], tier?: CompressionTier): unknown;
/**
 * Compress component sets according to the specified tier.
 */
export declare function compressComponentSets(sets: ComponentSet[], tier?: CompressionTier): unknown;
/**
 * Adaptively compress a Figma data payload so it fits comfortably inside an
 * AI context window.
 *
 * 1. Measures the serialised byte size.
 * 2. Selects an appropriate compression tier (or honours `forceTier`).
 * 3. Detects the data shape and delegates to the correct compressor.
 * 4. Returns metadata alongside the compressed payload.
 */
export declare function compressResponse(data: unknown, options?: CompressionOptions): CompressedResponse;
//# sourceMappingURL=response-compression.d.ts.map