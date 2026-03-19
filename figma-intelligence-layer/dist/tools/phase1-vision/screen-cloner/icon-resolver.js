"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveIconComponentMatch = resolveIconComponentMatch;
const fuse_js_1 = __importDefault(require("fuse.js"));
function normalize(value) {
    return (value ?? "").trim().toLowerCase();
}
function buildCandidates(componentSets) {
    const candidates = [];
    for (const set of componentSets) {
        const setName = normalize(set.name);
        const isIconLikeSet = /\bicon\b|\blogo\b|\bglyph\b|\bsymbol\b/.test(setName);
        if (isIconLikeSet) {
            candidates.push({
                nodeId: set.id,
                name: set.name,
                description: set.description,
                nodeType: "COMPONENT_SET",
            });
        }
        for (const child of set.children) {
            const childName = normalize(child.name);
            if (isIconLikeSet || /\bicon\b|\blogo\b|\bglyph\b|\bsymbol\b/.test(childName)) {
                candidates.push({
                    nodeId: child.id,
                    name: `${set.name} ${child.name}`,
                    description: child.description ?? set.description,
                    nodeType: child.type,
                });
            }
        }
    }
    return candidates;
}
function resolveIconComponentMatch(manifest, componentSets) {
    if (!manifest.iconPresent)
        return null;
    const query = [manifest.iconName, manifest.componentType, manifest.textContent]
        .filter(Boolean)
        .join(" ")
        .trim();
    if (!query)
        return null;
    const candidates = buildCandidates(componentSets);
    if (candidates.length === 0)
        return null;
    const fuse = new fuse_js_1.default(candidates, {
        keys: ["name", "description"],
        threshold: 0.4,
        includeScore: true,
        minMatchCharLength: 2,
    });
    const result = fuse.search(query)[0];
    if (!result)
        return null;
    const confidence = result.score != null ? 1 - result.score : 0.5;
    if (confidence < 0.45)
        return null;
    return {
        nodeId: result.item.nodeId,
        name: result.item.name,
        confidence,
        nodeType: result.item.nodeType,
    };
}
//# sourceMappingURL=icon-resolver.js.map