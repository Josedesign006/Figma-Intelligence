"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// P0: Adaptive Response Compression
// 4-tier compression system to prevent context window overflow from large
// Figma data payloads.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressNodeTree = compressNodeTree;
exports.compressTokenList = compressTokenList;
exports.compressComponentSets = compressComponentSets;
exports.compressResponse = compressResponse;
// ─── Tier thresholds (bytes) ─────────────────────────────────────────────────
const TIER_THRESHOLDS = {
    full: 100_000, // <100 KB
    summary: 200_000, // 100–200 KB
    inventory: 500_000, // 200–500 KB
    // >500 KB → compact
};
// ─── Helpers ─────────────────────────────────────────────────────────────────
function byteSize(data) {
    try {
        return new TextEncoder().encode(JSON.stringify(data)).byteLength;
    }
    catch {
        return Infinity; // unparseable → treat as very large
    }
}
function determineTier(sizeBytes, maxFull) {
    const fullLimit = maxFull ?? TIER_THRESHOLDS.full;
    if (sizeBytes < fullLimit)
        return "full";
    if (sizeBytes < TIER_THRESHOLDS.summary)
        return "summary";
    if (sizeBytes < TIER_THRESHOLDS.inventory)
        return "inventory";
    return "compact";
}
function uniqueStrings(arr) {
    return [...new Set(arr)];
}
// ─── Node tree compression ──────────────────────────────────────────────────
function summarizeNode(node, depth, maxDepth) {
    const base = {
        id: node.id,
        name: node.name,
        type: node.type,
    };
    // Always keep dimensional / layout info
    if (node.width !== undefined)
        base.width = node.width;
    if (node.height !== undefined)
        base.height = node.height;
    if (node.layoutMode !== undefined)
        base.layoutMode = node.layoutMode;
    // Boolean flags instead of full detail arrays
    if (node.fills && node.fills.length > 0) {
        base.hasFills = true;
        base.fillTypes = uniqueStrings(node.fills.map((f) => f.type));
    }
    if (node.strokes && node.strokes.length > 0) {
        base.hasStrokes = true;
        base.strokeTypes = uniqueStrings(node.strokes.map((s) => s.type));
    }
    if (node.effects && node.effects.length > 0) {
        base.hasEffects = true;
        base.effectCount = node.effects.length;
    }
    if (node.componentProperties) {
        base.hasComponentProperties = true;
    }
    // Children handling
    if (node.children && node.children.length > 0) {
        if (depth < maxDepth) {
            base.children = node.children.map((child) => summarizeNode(child, depth + 1, maxDepth));
        }
        else {
            base._childCount = node.children.length;
            base._childTypes = uniqueStrings(node.children.map((c) => c.type));
        }
    }
    return base;
}
function flattenNodes(node) {
    const result = [node];
    if (node.children) {
        for (const child of node.children) {
            result.push(...flattenNodes(child));
        }
    }
    return result;
}
function inventoryNode(node) {
    const allNodes = flattenNodes(node);
    return allNodes.map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        childCount: n.children?.length ?? 0,
        hasAutoLayout: n.layoutMode !== undefined && n.layoutMode !== "NONE",
        hasFills: (n.fills?.length ?? 0) > 0,
    }));
}
/**
 * Compress a Figma node tree according to the specified tier.
 */
function compressNodeTree(node, tier = "summary") {
    if (tier === "full")
        return node;
    if (tier === "summary") {
        return summarizeNode(node, 0, 2);
    }
    if (tier === "inventory") {
        return inventoryNode(node);
    }
    // compact
    const allNodes = flattenNodes(node);
    return allNodes.map((n) => ({ id: n.id, name: n.name, type: n.type }));
}
// ─── Token list compression ─────────────────────────────────────────────────
/**
 * Compress a list of design tokens according to the specified tier.
 */
function compressTokenList(tokens, tier = "summary") {
    if (tier === "full")
        return tokens;
    if (tier === "summary") {
        return tokens.map((t) => ({
            id: t.id,
            name: t.name,
            type: t.type,
            value: t.value,
            collectionId: t.collectionId,
        }));
    }
    if (tier === "inventory") {
        const byCollection = new Map();
        for (const token of tokens) {
            const existing = byCollection.get(token.collectionId);
            if (existing) {
                existing.count += 1;
                existing.types.add(token.type);
            }
            else {
                byCollection.set(token.collectionId, {
                    collectionId: token.collectionId,
                    types: new Set([token.type]),
                    count: 1,
                });
            }
        }
        return [...byCollection.values()].map((entry) => ({
            collectionId: entry.collectionId,
            tokenCount: entry.count,
            types: [...entry.types],
        }));
    }
    // compact
    return tokens.map((t) => ({ id: t.id, name: t.name, type: t.type }));
}
// ─── Component sets compression ─────────────────────────────────────────────
/**
 * Compress component sets according to the specified tier.
 */
function compressComponentSets(sets, tier = "summary") {
    if (tier === "full")
        return sets;
    if (tier === "summary") {
        return sets.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            variantPropertyNames: Object.keys(s.variantGroupProperties ?? {}),
            childCount: s.children?.length ?? 0,
        }));
    }
    if (tier === "inventory") {
        return sets.map((s) => ({
            id: s.id,
            name: s.name,
            variantCount: s.children?.length ?? 0,
            propertyNames: Object.keys(s.variantGroupProperties ?? {}),
        }));
    }
    // compact
    return sets.map((s) => ({ id: s.id, name: s.name }));
}
function detectShape(data) {
    if (data == null || typeof data !== "object")
        return "generic";
    // Array shapes
    if (Array.isArray(data)) {
        if (data.length === 0)
            return "generic";
        const first = data[0];
        // Token list: objects with collectionId + type matching token types
        if (first &&
            typeof first.collectionId === "string" &&
            typeof first.type === "string") {
            return "tokenList";
        }
        // Component set list: objects with variantGroupProperties
        if (first && typeof first.variantGroupProperties === "object") {
            return "componentSetList";
        }
        return "generic";
    }
    // Single object shapes
    const obj = data;
    // Node tree: has id + type + possibly children
    if (typeof obj.id === "string" &&
        typeof obj.type === "string" &&
        typeof obj.name === "string") {
        // Distinguish node from component set
        if (typeof obj.variantGroupProperties === "object") {
            return "componentSetList"; // single component set — wrap when compressing
        }
        return "nodeTree";
    }
    return "generic";
}
// ─── Main entry point ───────────────────────────────────────────────────────
/**
 * Adaptively compress a Figma data payload so it fits comfortably inside an
 * AI context window.
 *
 * 1. Measures the serialised byte size.
 * 2. Selects an appropriate compression tier (or honours `forceTier`).
 * 3. Detects the data shape and delegates to the correct compressor.
 * 4. Returns metadata alongside the compressed payload.
 */
function compressResponse(data, options) {
    const originalSizeBytes = byteSize(data);
    const tier = options?.forceTier ?? determineTier(originalSizeBytes, options?.maxSizeBytes);
    // Fast path — no compression needed
    if (tier === "full") {
        return {
            tier,
            originalSizeBytes,
            compressedSizeBytes: originalSizeBytes,
            data,
        };
    }
    const shape = detectShape(data);
    let compressed;
    switch (shape) {
        case "nodeTree":
            compressed = compressNodeTree(data, tier);
            break;
        case "tokenList":
            compressed = compressTokenList(data, tier);
            break;
        case "componentSetList": {
            // Handle both single set and array of sets
            const sets = Array.isArray(data)
                ? data
                : [data];
            compressed = compressComponentSets(sets, tier);
            break;
        }
        case "generic":
        default:
            // For unknown shapes, apply a best-effort generic trim
            compressed = compressGeneric(data, tier);
            break;
    }
    const compressedSizeBytes = byteSize(compressed);
    return {
        tier,
        originalSizeBytes,
        compressedSizeBytes,
        data: compressed,
    };
}
// ─── Generic fallback compression ───────────────────────────────────────────
function compressGeneric(data, tier) {
    if (data == null || typeof data !== "object")
        return data;
    if (tier === "compact") {
        // For arrays, keep only primitive summaries
        if (Array.isArray(data)) {
            return {
                _type: "array",
                _length: data.length,
                _sampleKeys: data.length > 0 && typeof data[0] === "object" && data[0] !== null
                    ? Object.keys(data[0])
                    : [],
            };
        }
        // For objects, return top-level keys only
        return {
            _type: "object",
            _keys: Object.keys(data),
        };
    }
    if (tier === "inventory") {
        if (Array.isArray(data)) {
            return {
                _type: "array",
                _length: data.length,
                _items: data.slice(0, 5).map((item) => {
                    if (item == null || typeof item !== "object")
                        return item;
                    const obj = item;
                    const summary = {};
                    for (const key of Object.keys(obj)) {
                        const val = obj[key];
                        if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
                            summary[key] = val;
                        }
                        else if (Array.isArray(val)) {
                            summary[key] = `[Array(${val.length})]`;
                        }
                        else if (typeof val === "object" && val !== null) {
                            summary[key] = `{Object(${Object.keys(val).length} keys)}`;
                        }
                    }
                    return summary;
                }),
            };
        }
        // Single object — shallow summary
        const obj = data;
        const result = {};
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
                result[key] = val;
            }
            else if (Array.isArray(val)) {
                result[key] = `[Array(${val.length})]`;
            }
            else if (typeof val === "object" && val !== null) {
                result[key] = `{Object(${Object.keys(val).length} keys)}`;
            }
        }
        return result;
    }
    // summary tier — trim nested objects to depth 2
    return trimDepth(data, 0, 2);
}
function trimDepth(data, depth, maxDepth) {
    if (data == null || typeof data !== "object")
        return data;
    if (Array.isArray(data)) {
        if (depth >= maxDepth) {
            return `[Array(${data.length})]`;
        }
        return data.map((item) => trimDepth(item, depth + 1, maxDepth));
    }
    const obj = data;
    const result = {};
    for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (depth >= maxDepth) {
            if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
                result[key] = val;
            }
            else if (Array.isArray(val)) {
                result[key] = `[Array(${val.length})]`;
            }
            else if (typeof val === "object" && val !== null) {
                result[key] = `{Object(${Object.keys(val).length} keys)}`;
            }
        }
        else {
            result[key] = trimDepth(val, depth + 1, maxDepth);
        }
    }
    return result;
}
//# sourceMappingURL=response-compression.js.map