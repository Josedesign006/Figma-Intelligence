"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Intent Translator
// Parses a natural-language prompt into a structured IntentManifest by
// performing NLP decomposition with Claude, then fuzzy-matching the extracted
// component names against the live Design-System component sets in Figma.
// ─────────────────────────────────────────────────────────────────────────────
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.intentTranslatorHandler = intentTranslatorHandler;
const fuse_js_1 = __importDefault(require("fuse.js"));
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
// ─── NLP prompt sent to Claude ────────────────────────────────────────────────
const PARSE_SYSTEM_PROMPT = `You are a design-system intent parser.
Given a natural-language UI description, extract structured information.
Return ONLY valid JSON — no markdown fences, no explanation — matching this schema:
{
  "componentTypes": ["string"],   // e.g. ["Button","Card","Avatar"]
  "variants": {                   // known variant keys and their values
    "size": "md",
    "state": "default",
    "theme": "light"
  },
  "tokens": ["string"],           // CSS custom-property names if mentioned
  "layout": "string | null",      // e.g. "horizontal", "grid"
  "textContent": "string | null"  // visible text if specified
}`;
function parseFromKeywords(prompt, context) {
    const lower = ((context ? context + " " : "") + prompt).toLowerCase();
    const componentPatterns = {
        Button: ["button", "btn", "cta", "submit", "action button"],
        TextInput: ["input", "text field", "textbox", "search bar", "form field", "text input"],
        Card: ["card", "tile", "panel"],
        Avatar: ["avatar", "profile picture", "user icon"],
        Badge: ["badge", "chip", "tag", "pill"],
        Modal: ["modal", "dialog", "popup", "overlay"],
        Heading: ["heading", "title", "header text", "h1", "h2"],
        Navigation: ["nav", "navigation", "sidebar", "menu", "breadcrumb", "tabs"],
        Image: ["image", "photo", "illustration", "hero image", "banner"],
        Toggle: ["toggle", "switch", "checkbox"],
        Select: ["select", "dropdown", "picker", "combobox"],
        Toast: ["toast", "snackbar", "notification", "alert"],
        Tooltip: ["tooltip", "popover"],
        Table: ["table", "data grid", "list view"],
        Link: ["link", "anchor", "hyperlink"],
    };
    const componentTypes = [];
    for (const [component, keywords] of Object.entries(componentPatterns)) {
        if (keywords.some((kw) => lower.includes(kw))) {
            componentTypes.push(component);
        }
    }
    if (componentTypes.length === 0) {
        componentTypes.push(prompt.split(" ").slice(0, 3).join(" "));
    }
    const variants = {};
    const sizeMatch = lower.match(/\b(small|sm|medium|md|large|lg|xl|xs)\b/);
    if (sizeMatch)
        variants.size = sizeMatch[1];
    const stateMatch = lower.match(/\b(default|hover|active|disabled|focused|pressed|loading)\b/);
    if (stateMatch)
        variants.state = stateMatch[1];
    const themeMatch = lower.match(/\b(light|dark|brand|outline|ghost|solid)\b/);
    if (themeMatch)
        variants.theme = themeMatch[1];
    const tokenMatches = lower.match(/--[\w-]+/g) ?? [];
    return {
        componentTypes,
        variants,
        tokens: tokenMatches,
        layout: lower.includes("horizontal") ? "horizontal" : lower.includes("grid") ? "grid" : undefined,
        textContent: undefined,
    };
}
function buildFuseIndex(componentSets) {
    const docs = componentSets.map((cs) => ({
        id: cs.id,
        name: cs.name,
        tokens: [],
        variantKeys: Object.keys(cs.variantGroupProperties ?? {}),
    }));
    return new fuse_js_1.default(docs, {
        keys: ["name", "variantKeys"],
        threshold: 0.6, // generous threshold; we filter by score later
        includeScore: true,
        minMatchCharLength: 2,
    });
}
function fuseScoreToConfidence(fuseScore) {
    // Fuse score is 0 (perfect) → 1 (worst); invert to get confidence
    return 1 - (fuseScore ?? 1);
}
function extractVariantHints(componentSet, parsedVariants) {
    const hints = {};
    const groupProps = componentSet.variantGroupProperties ?? {};
    for (const [key, { values }] of Object.entries(groupProps)) {
        const normalizedKey = key.toLowerCase();
        // Direct match from parsed variants
        if (parsedVariants[normalizedKey]) {
            const requested = parsedVariants[normalizedKey].toLowerCase();
            const matched = values.find((v) => v.toLowerCase() === requested);
            if (matched)
                hints[key] = matched;
        }
        // Default: first value
        if (!hints[key] && values.length > 0) {
            hints[key] = values[0];
        }
    }
    return hints;
}
function matchComponents(componentTypes, componentSets, parsedVariants) {
    const index = buildFuseIndex(componentSets);
    const seen = new Set();
    const results = [];
    for (const typeName of componentTypes) {
        const hits = index.search(typeName);
        for (const hit of hits) {
            if (seen.has(hit.item.id))
                continue;
            seen.add(hit.item.id);
            const cs = componentSets.find((c) => c.id === hit.item.id);
            if (!cs)
                continue;
            const confidence = fuseScoreToConfidence(hit.score);
            results.push({
                dsNodeId: cs.id,
                dsName: cs.name,
                score: confidence,
                variantHints: extractVariantHints(cs, parsedVariants),
                tokenRefs: [], // populated below if needed
            });
        }
    }
    // Sort descending by score
    results.sort((a, b) => b.score - a.score);
    return results;
}
// ─── Main handler ─────────────────────────────────────────────────────────────
async function intentTranslatorHandler(args) {
    const { prompt, context, strictMode = false } = args;
    if (!prompt || prompt.trim().length === 0) {
        throw new Error("intentTranslator: `prompt` must be a non-empty string.");
    }
    // 1. Parse the prompt into components using keyword matching
    const parsedIntent = parseFromKeywords(prompt, context);
    // 2. Fetch DS component sets via the bridge (graceful fallback on timeout)
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    let componentSets = [];
    try {
        componentSets = await bridge.getComponentSets();
    }
    catch {
        // If scanning times out, continue with keyword-only results
    }
    // 3. Fuzzy match parsed component names against DS sets
    const allMatches = matchComponents(parsedIntent.componentTypes, componentSets, parsedIntent.variants);
    // 4. Determine overall confidence from the best match
    const bestScore = allMatches.length > 0 ? allMatches[0].score : 0;
    // In strictMode any ambiguity below 0.75 is treated as low-confidence
    const effectiveScore = strictMode && bestScore < 0.75 ? bestScore * 0.8 : bestScore;
    let status;
    let selectedMatches;
    let clarifyingQuestion;
    if (effectiveScore >= 0.75) {
        // High confidence — return the single best match
        status = "resolved";
        selectedMatches = allMatches.slice(0, 1).map((m) => ({
            dsNodeId: m.dsNodeId,
            dsName: m.dsName,
            score: m.score,
            variantHints: m.variantHints,
            tokenRefs: m.tokenRefs,
        }));
    }
    else if (effectiveScore >= 0.5) {
        // Medium confidence — ask a clarifying question
        status = "ambiguous";
        const topThree = allMatches.slice(0, 3);
        selectedMatches = topThree.map((m) => ({
            dsNodeId: m.dsNodeId,
            dsName: m.dsName,
            score: m.score,
            variantHints: m.variantHints,
            tokenRefs: m.tokenRefs,
        }));
        clarifyingQuestion = {
            question: `I found multiple components that could match "${prompt}". Which did you mean?`,
            candidates: topThree.map((m) => ({
                dsNodeId: m.dsNodeId,
                dsName: m.dsName,
                score: m.score,
            })),
        };
    }
    else {
        // Low confidence — list the 3 closest matches for user inspection
        status = "low-confidence";
        selectedMatches = allMatches.slice(0, 3).map((m) => ({
            dsNodeId: m.dsNodeId,
            dsName: m.dsName,
            score: m.score,
            variantHints: m.variantHints,
            tokenRefs: m.tokenRefs,
        }));
    }
    // 5. Log the decision
    const logEntry = await decision_log_js_1.decisionLog.log({
        tool: "intent-translator",
        nodeIds: selectedMatches.map((m) => m.dsNodeId),
        rationale: `Parsed prompt "${prompt}" → components: [${parsedIntent.componentTypes.join(", ")}]. Status: ${status}. Best confidence: ${effectiveScore.toFixed(2)}.`,
        tokens: parsedIntent.tokens,
        reversible: false,
        metadata: {
            prompt,
            context,
            strictMode,
            parsedIntent,
            status,
            matchCount: allMatches.length,
        },
    });
    return {
        status,
        confidence: effectiveScore,
        parsedIntent,
        matches: selectedMatches,
        clarifyingQuestion,
        logEntryId: logEntry.id,
    };
}
//# sourceMappingURL=index.js.map