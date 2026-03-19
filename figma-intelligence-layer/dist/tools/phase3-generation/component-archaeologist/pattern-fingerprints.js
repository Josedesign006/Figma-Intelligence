"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Pattern Fingerprints
// Layer-structure pattern database used by the component archaeologist.
// Maps structural "fingerprints" (combinations of layer types) to the
// most likely DS component candidates.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATTERN_RULES = void 0;
exports.inferSignal = inferSignal;
exports.buildLayerSummary = buildLayerSummary;
exports.matchPatterns = matchPatterns;
// ─── Signal inference from node names ─────────────────────────────────────────
function inferSignal(node) {
    const name = node.name.toLowerCase();
    if (/\bicon\b|\bsvg\b|\bvector\b/.test(name) || node.type === "VECTOR")
        return "icon";
    if (/\bavatar\b|\bprofile\s*pic\b|\bthumb(nail)?\b/.test(name))
        return "avatar";
    if (/\bimage\b|\bphoto\b|\billustration\b|\bhero\b/.test(name) || node.type === "IMAGE")
        return "image";
    if (/\binput\b|\bfield\b|\btextarea\b|\bsearch\b/.test(name))
        return "input";
    if (/\bchevron\b|\barrow\b|\bcaret\b/.test(name))
        return "chevron";
    if (/\btitle\b|\bheading\b|\bh[1-6]\b/.test(name))
        return "title";
    if (/\bsubtitle\b|\bsub\s*heading\b|\bsecondary\s*text\b/.test(name))
        return "subtitle";
    if (/\bbody\b|\bdescription\b|\bparagraph\b|\bcontent\b/.test(name))
        return "body";
    if (/\blabel\b|\bcaption\b/.test(name))
        return "label";
    if (/\bbtn\b|\bbutton\b|\bcta\b/.test(name))
        return "cta";
    if (node.type === "TEXT")
        return "text";
    return null;
}
// ─── Layer summary builder ────────────────────────────────────────────────────
function buildLayerSummary(root) {
    let totalLayers = 0;
    let maxDepth = 0;
    let textCount = 0;
    let rectangleCount = 0;
    let frameCount = 0;
    let vectorCount = 0;
    const signals = new Set();
    function walk(node, depth) {
        totalLayers++;
        maxDepth = Math.max(maxDepth, depth);
        if (node.type === "TEXT")
            textCount++;
        if (node.type === "RECTANGLE")
            rectangleCount++;
        if (node.type === "FRAME" || node.type === "GROUP")
            frameCount++;
        if (node.type === "VECTOR")
            vectorCount++;
        const sig = inferSignal(node);
        if (sig)
            signals.add(sig);
        if (node.children)
            node.children.forEach((c) => walk(c, depth + 1));
    }
    walk(root, 0);
    return {
        totalLayers,
        depth: maxDepth,
        hasImage: signals.has("image"),
        hasIcon: signals.has("icon"),
        hasText: signals.has("text") || signals.has("title") || signals.has("body"),
        hasInput: signals.has("input"),
        hasAvatar: signals.has("avatar"),
        textCount,
        rectangleCount,
        frameCount,
        vectorCount,
        layoutMode: root.layoutMode ?? null,
        childCount: root.children?.length ?? 0,
    };
}
// ─── Pattern rules (from plan) ────────────────────────────────────────────────
/**
 * From the plan:
 *   [Icon + Text horizontal]           → Button, MenuItem, Breadcrumb, Tab
 *   [Image + Title + Body + CTA]       → Card, Feature tile, Blog post item
 *   [Label above + Input below]        → Form field, Text input
 *   [Avatar + Name + Subtitle]         → User profile, Comment header
 *   [Icon + Title + Chevron]           → List item, Navigation row
 *   [N equal-width columns]            → Data table, Comparison card
 */
exports.PATTERN_RULES = [
    {
        pattern: "Icon + Text horizontal",
        candidates: ["Button", "MenuItem", "Breadcrumb", "Tab"],
        confidence: 0.85,
        rationale: "Horizontal layout with icon and text is characteristic of buttons or navigation items",
        test: (s, sigs) => s.layoutMode === "HORIZONTAL" && sigs.includes("icon") && sigs.includes("text"),
    },
    {
        pattern: "Image + Title + Body + CTA",
        candidates: ["Card", "FeatureTile", "BlogPostItem"],
        confidence: 0.88,
        rationale: "Vertical layout with image, heading text, body text, and action matches card pattern",
        test: (s, sigs) => s.hasImage && sigs.includes("title") && (sigs.includes("body") || s.textCount >= 3),
    },
    {
        pattern: "Label + Input",
        candidates: ["FormField", "TextInput", "Select"],
        confidence: 0.90,
        rationale: "Label above an input field is a classic form pattern",
        test: (s, sigs) => sigs.includes("label") && sigs.includes("input"),
    },
    {
        pattern: "Avatar + Name + Subtitle",
        candidates: ["UserProfile", "CommentHeader", "MemberCard"],
        confidence: 0.86,
        rationale: "Avatar with name and secondary text matches user identity components",
        test: (s, sigs) => sigs.includes("avatar") && s.textCount >= 2,
    },
    {
        pattern: "Icon + Title + Chevron",
        candidates: ["ListItem", "NavigationRow", "AccordionHeader"],
        confidence: 0.84,
        rationale: "Icon-title-chevron pattern is characteristic of tappable list rows",
        test: (s, sigs) => sigs.includes("icon") && sigs.includes("title") && sigs.includes("chevron"),
    },
    {
        pattern: "Equal-width columns",
        candidates: ["DataTable", "ComparisonCard", "Grid"],
        confidence: 0.75,
        rationale: "Multiple equal-width children suggest a data grid or table layout",
        test: (s) => s.childCount >= 3 && s.layoutMode === "HORIZONTAL",
    },
    {
        pattern: "Single CTA button",
        candidates: ["Button", "IconButton", "FAB"],
        confidence: 0.92,
        rationale: "Small frame with CTA signal is most likely a standalone button",
        test: (s, sigs) => sigs.includes("cta") && s.totalLayers <= 5,
    },
    {
        pattern: "Text stack",
        candidates: ["TextBlock", "Heading", "Paragraph"],
        confidence: 0.70,
        rationale: "Vertical stack of only text layers is a content block",
        test: (s) => s.textCount >= 2 && s.textCount === s.childCount && s.layoutMode === "VERTICAL",
    },
];
/** Run all pattern rules against a node's summary and return matches. */
function matchPatterns(summary, root) {
    // Collect signals from top-level children
    const signals = [];
    if (root.children) {
        for (const child of root.children) {
            const sig = inferSignal(child);
            if (sig)
                signals.push(sig);
        }
    }
    return exports.PATTERN_RULES
        .filter((rule) => rule.test(summary, signals))
        .map(({ pattern, candidates, confidence, rationale }) => ({
        pattern,
        candidates,
        confidence,
        rationale,
    }));
}
//# sourceMappingURL=pattern-fingerprints.js.map