"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionClient = void 0;
const vision_provider_openai_js_1 = require("./vision-provider-openai.js");
const vision_provider_anthropic_js_1 = require("./vision-provider-anthropic.js");
const DEFAULT_MANIFEST = {
    componentType: "Unknown",
    variants: {},
    iconPresent: false,
    iconKind: "unknown",
    preferredIconLibrary: "material-symbols",
    interactiveElement: false,
    estimatedSpacing: 8,
    confidence: 0.3,
};
function clampConfidence(value, fallback = 0.5) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return fallback;
    return Math.min(1, Math.max(0, value));
}
function coerceOptionalConfidence(value) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return undefined;
    return Math.min(1, Math.max(0, value));
}
function coerceOptionalString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function coerceOptionalNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function coerceStringArray(value) {
    if (!Array.isArray(value))
        return undefined;
    const strings = value.filter((item) => typeof item === "string" && item.trim().length > 0);
    return strings.length > 0 ? strings : undefined;
}
function normalizeLayoutType(value) {
    switch (value) {
        case "page":
        case "sidebar":
        case "header":
        case "toolbar":
        case "content":
        case "footer":
        case "drawer":
        case "modal":
        case "card":
        case "form":
        case "form-row":
        case "nav":
        case "button-group":
        case "tab-bar":
        case "table":
        case "table-row":
        case "list":
        case "list-item":
        case "section":
        case "overlay":
            return value;
        default:
            return "content";
    }
}
function normalizeLayoutAlignment(raw) {
    if (!raw || typeof raw !== "object")
        return undefined;
    const candidate = raw;
    const padding = candidate.padding && typeof candidate.padding === "object"
        ? candidate.padding
        : null;
    const direction = candidate.direction === "horizontal" ||
        candidate.direction === "vertical" ||
        candidate.direction === "none"
        ? candidate.direction
        : undefined;
    const distribution = candidate.distribution === "start" ||
        candidate.distribution === "center" ||
        candidate.distribution === "end" ||
        candidate.distribution === "space-between"
        ? candidate.distribution
        : undefined;
    const crossAlignment = candidate.crossAlignment === "start" ||
        candidate.crossAlignment === "center" ||
        candidate.crossAlignment === "end" ||
        candidate.crossAlignment === "stretch"
        ? candidate.crossAlignment
        : undefined;
    const stackingOrder = candidate.stackingOrder === "normal" ||
        candidate.stackingOrder === "reverse" ||
        candidate.stackingOrder === "overlay"
        ? candidate.stackingOrder
        : undefined;
    const normalizedPadding = padding &&
        [padding.top, padding.right, padding.bottom, padding.left].some((value) => coerceOptionalNumber(value) != null)
        ? {
            top: coerceOptionalNumber(padding.top),
            right: coerceOptionalNumber(padding.right),
            bottom: coerceOptionalNumber(padding.bottom),
            left: coerceOptionalNumber(padding.left),
        }
        : undefined;
    if (direction == null &&
        distribution == null &&
        crossAlignment == null &&
        coerceOptionalNumber(candidate.gap) == null &&
        normalizedPadding == null &&
        coerceOptionalNumber(candidate.columns) == null &&
        stackingOrder == null) {
        return undefined;
    }
    return {
        direction,
        distribution,
        crossAlignment,
        gap: coerceOptionalNumber(candidate.gap),
        padding: normalizedPadding,
        columns: coerceOptionalNumber(candidate.columns),
        stackingOrder,
    };
}
function normalizeLayoutNode(raw, path, fallbackType = "content") {
    if (!raw || typeof raw !== "object")
        return null;
    const candidate = raw;
    const boundingBox = candidate.boundingBox && typeof candidate.boundingBox === "object"
        ? candidate.boundingBox
        : null;
    if (!boundingBox)
        return null;
    const x = coerceOptionalNumber(boundingBox.x);
    const y = coerceOptionalNumber(boundingBox.y);
    const width = coerceOptionalNumber(boundingBox.width);
    const height = coerceOptionalNumber(boundingBox.height);
    if ([x, y, width, height].some((value) => value == null))
        return null;
    const children = Array.isArray(candidate.children)
        ? candidate.children
            .map((child, index) => normalizeLayoutNode(child, `${path}.${index}`))
            .filter((child) => child !== null)
        : undefined;
    const normalizedChildCount = Math.max(0, Math.round(coerceOptionalNumber(candidate.childCount) ??
        children?.length ??
        0));
    const alignedLeftWith = coerceStringArray(candidate.siblingHints?.alignedLeftWith);
    const equalSpacingWith = coerceStringArray(candidate.siblingHints?.equalSpacingWith);
    const repeatedChildren = coerceStringArray(candidate.siblingHints?.repeatedChildren);
    const anchored = candidate.siblingHints?.anchored === "left" ||
        candidate.siblingHints?.anchored === "right" ||
        candidate.siblingHints?.anchored === "top" ||
        candidate.siblingHints?.anchored === "bottom" ||
        candidate.siblingHints?.anchored === "center"
        ? candidate.siblingHints.anchored
        : undefined;
    const repetitionCandidate = candidate.repetition && typeof candidate.repetition === "object"
        ? candidate.repetition
        : null;
    return {
        id: coerceOptionalString(candidate.id) ?? path,
        label: coerceOptionalString(candidate.label) ?? "Zone",
        boundingBox: { x: x, y: y, width: width, height: height },
        layoutType: normalizeLayoutType(candidate.layoutType ?? fallbackType),
        childCount: normalizedChildCount,
        children: children && children.length > 0 ? children : undefined,
        layout: normalizeLayoutAlignment(candidate.layout),
        siblingHints: alignedLeftWith || equalSpacingWith || repeatedChildren || anchored || candidate.overlay === true
            ? {
                alignedLeftWith,
                equalSpacingWith,
                repeatedChildren,
                anchored,
                overlay: candidate.overlay === true || candidate.siblingHints?.overlay === true,
            }
            : undefined,
        repetition: repetitionCandidate && repetitionCandidate.isRepeated === true
            ? {
                isRepeated: true,
                pattern: repetitionCandidate.pattern === "row" ||
                    repetitionCandidate.pattern === "column" ||
                    repetitionCandidate.pattern === "grid" ||
                    repetitionCandidate.pattern === "tabs" ||
                    repetitionCandidate.pattern === "menu" ||
                    repetitionCandidate.pattern === "list"
                    ? repetitionCandidate.pattern
                    : undefined,
                itemCount: coerceOptionalNumber(repetitionCandidate.itemCount),
                canonicalChildId: coerceOptionalString(repetitionCandidate.canonicalChildId),
                repeatedChildIds: coerceStringArray(repetitionCandidate.repeatedChildIds),
                repeatAxis: repetitionCandidate.repeatAxis === "horizontal" || repetitionCandidate.repeatAxis === "vertical"
                    ? repetitionCandidate.repeatAxis
                    : undefined,
            }
            : undefined,
        zoneImage: coerceOptionalString(candidate.zoneImage),
    };
}
function inferDirectionFromChildren(children) {
    if (children.length < 2)
        return "none";
    const xSpread = Math.max(...children.map((child) => child.boundingBox.x + child.boundingBox.width / 2)) -
        Math.min(...children.map((child) => child.boundingBox.x + child.boundingBox.width / 2));
    const ySpread = Math.max(...children.map((child) => child.boundingBox.y + child.boundingBox.height / 2)) -
        Math.min(...children.map((child) => child.boundingBox.y + child.boundingBox.height / 2));
    return xSpread > ySpread ? "horizontal" : "vertical";
}
function enrichRepeatedPatterns(nodes) {
    return nodes.map((node) => {
        const children = node.children ? enrichRepeatedPatterns(node.children) : undefined;
        const nextNode = { ...node, children };
        if (!children || children.length < 2 || nextNode.repetition?.isRepeated) {
            return nextNode;
        }
        const repeated = children.filter((child) => child.layoutType === children[0].layoutType);
        const aligned = repeated.length >= 2 &&
            repeated.every((child) => {
                const widthDelta = Math.abs(child.boundingBox.width - repeated[0].boundingBox.width);
                const heightDelta = Math.abs(child.boundingBox.height - repeated[0].boundingBox.height);
                return widthDelta <= 6 || heightDelta <= 6;
            });
        if (!aligned)
            return nextNode;
        const repeatAxis = nextNode.layout?.direction && nextNode.layout.direction !== "none"
            ? nextNode.layout.direction
            : inferDirectionFromChildren(children);
        const pattern = repeated[0].layoutType === "table-row"
            ? "row"
            : repeated[0].layoutType === "tab-bar"
                ? "tabs"
                : repeated[0].layoutType === "list-item"
                    ? "list"
                    : repeatAxis === "horizontal"
                        ? "row"
                        : "list";
        nextNode.repetition = {
            isRepeated: true,
            pattern,
            itemCount: repeated.length,
            canonicalChildId: repeated[0].id,
            repeatedChildIds: repeated.map((child) => child.id),
            repeatAxis: repeatAxis === "none" ? "vertical" : repeatAxis,
        };
        return nextNode;
    });
}
function normalizeManifest(raw) {
    if (!raw || typeof raw !== "object")
        return { ...DEFAULT_MANIFEST };
    const candidate = raw;
    const iconPresent = Boolean(candidate.iconPresent ?? candidate.iconName);
    const normalized = {
        componentType: coerceOptionalString(candidate.componentType) ?? DEFAULT_MANIFEST.componentType,
        variants: candidate.variants && typeof candidate.variants === "object"
            ? Object.fromEntries(Object.entries(candidate.variants).filter((entry) => typeof entry[1] === "string"))
            : {},
        textContent: coerceOptionalString(candidate.textContent),
        textContentConfidence: coerceOptionalConfidence(candidate.textContentConfidence),
        iconPresent,
        iconName: coerceOptionalString(candidate.iconName),
        iconNameConfidence: coerceOptionalConfidence(candidate.iconNameConfidence),
        iconKind: candidate.iconKind === "system" ||
            candidate.iconKind === "brand" ||
            candidate.iconKind === "illustration" ||
            candidate.iconKind === "unknown"
            ? candidate.iconKind
            : "unknown",
        preferredIconLibrary: coerceOptionalString(candidate.preferredIconLibrary),
        openSourceIconName: coerceOptionalString(candidate.openSourceIconName),
        interactiveElement: Boolean(candidate.interactiveElement),
        estimatedSpacing: coerceOptionalNumber(candidate.estimatedSpacing) ?? DEFAULT_MANIFEST.estimatedSpacing,
        estimatedSpacingConfidence: coerceOptionalConfidence(candidate.estimatedSpacingConfidence),
        estimatedRadius: coerceOptionalNumber(candidate.estimatedRadius),
        estimatedRadiusConfidence: coerceOptionalConfidence(candidate.estimatedRadiusConfidence),
        estimatedFontSize: coerceOptionalNumber(candidate.estimatedFontSize),
        estimatedFontSizeConfidence: coerceOptionalConfidence(candidate.estimatedFontSizeConfidence),
        fontFamilyGuess: coerceOptionalString(candidate.fontFamilyGuess),
        fontFamilyGuessConfidence: coerceOptionalConfidence(candidate.fontFamilyGuessConfidence),
        fontStyleGuess: coerceOptionalString(candidate.fontStyleGuess),
        fontStyleGuessConfidence: coerceOptionalConfidence(candidate.fontStyleGuessConfidence),
        fontWeightGuess: coerceOptionalNumber(candidate.fontWeightGuess),
        fontWeightGuessConfidence: coerceOptionalConfidence(candidate.fontWeightGuessConfidence),
        confidence: clampConfidence(candidate.confidence, DEFAULT_MANIFEST.confidence),
        dsBestMatch: coerceOptionalString(candidate.dsBestMatch),
        dsNodeId: coerceOptionalString(candidate.dsNodeId),
    };
    if (!normalized.iconPresent) {
        normalized.iconName = undefined;
        normalized.iconNameConfidence = undefined;
    }
    return normalized;
}
function normalizeZones(raw) {
    if (!Array.isArray(raw))
        return undefined;
    const zones = raw
        .map((zone, index) => normalizeLayoutNode(zone, `zone-${index}`))
        .filter((zone) => zone !== null);
    return zones.length > 0 ? enrichRepeatedPatterns(zones) : undefined;
}
function normalizeVisionResult(raw) {
    const candidate = raw && typeof raw === "object" ? raw : {};
    const layoutTree = normalizeZones(candidate.layoutTree ?? candidate.zones);
    return {
        rawAnalysis: typeof candidate.rawAnalysis === "string" && candidate.rawAnalysis.trim()
            ? candidate.rawAnalysis
            : "[Vision analysis unavailable]",
        confidence: clampConfidence(candidate.confidence, 0.5),
        layoutTree,
        zones: layoutTree,
        manifest: candidate.manifest ? normalizeManifest(candidate.manifest) : undefined,
    };
}
/**
 * VisionClient — local heuristic image analysis utility.
 *
 * No external API key required. Returns reasonable defaults.
 * The MCP client AI provides actual vision intelligence by
 * seeing images returned in tool responses.
 */
class VisionClient {
    providerName;
    openaiProvider;
    anthropicProvider;
    constructor() {
        const explicit = (process.env.VISION_PROVIDER || "").toLowerCase();
        // Auto-detect a real vision provider when none is explicitly configured.
        // Priority: explicit env → anthropic (if API key present) → openai (if API key present) → offline
        if (explicit) {
            this.providerName = explicit;
        }
        else if (process.env.ANTHROPIC_API_KEY) {
            this.providerName = "anthropic";
        }
        else if (process.env.OPENAI_API_KEY) {
            this.providerName = "openai";
        }
        else {
            this.providerName = "offline";
        }
        this.openaiProvider = new vision_provider_openai_js_1.OpenAIVisionProvider();
        this.anthropicProvider = new vision_provider_anthropic_js_1.AnthropicVisionProvider();
    }
    isOfflineProvider() {
        return (this.providerName === "offline" ||
            this.providerName === "local" ||
            this.providerName === "heuristic" ||
            this.providerName === "none");
    }
    async analyze(image, prompt) {
        if (this.providerName === "openai") {
            const result = await this.openaiProvider.analyze(image, prompt);
            return normalizeVisionResult(result);
        }
        if (this.providerName === "anthropic") {
            const result = await this.anthropicProvider.analyze(image, prompt);
            return normalizeVisionResult(result);
        }
        if (this.isOfflineProvider()) {
            return {
                rawAnalysis: "[Offline heuristic analysis] Remote vision is disabled, so the cloner is using a local fallback summary.",
                confidence: 0.25,
            };
        }
        return {
            rawAnalysis: `[Vision provider "${this.providerName}" is not supported]`,
            confidence: 0,
        };
    }
    async segment(_image) {
        const prompt = `Identify the UI layout as a nested hierarchy, not a flat zone list. Return strict JSON with:
- rawAnalysis: short machine-readable summary string
- confidence: overall confidence from 0 to 1
- layoutTree: array of root layout nodes
- each layout node must include:
  - id: stable node id string
  - label: descriptive name of the region
  - boundingBox: {x, y, width, height} as percentages (0-100) of total image size
  - layoutType: one of "page"|"sidebar"|"header"|"toolbar"|"content"|"footer"|"drawer"|"modal"|"card"|"form"|"form-row"|"nav"|"button-group"|"tab-bar"|"table"|"table-row"|"list"|"list-item"|"section"|"overlay"
  - childCount: estimated number of direct child elements
  - children: nested layout nodes
  - layout: { direction, distribution, crossAlignment, gap, padding, columns, stackingOrder }
  - siblingHints: { alignedLeftWith, equalSpacingWith, repeatedChildren, anchored, overlay }
  - repetition: { isRepeated, pattern, itemCount, canonicalChildId, repeatedChildIds, repeatAxis } when a repeated row/list/tab/menu structure exists

Prefer a single "page" root when the whole screen is one page. Include repeated row/list hints whenever items visually repeat. Only use overlays for floating drawers, modals, popovers, badges, or absolute-positioned elements.

    Return ONLY valid JSON.`;
        if (this.providerName === "openai") {
            const result = await this.openaiProvider.segment(_image, prompt);
            return normalizeVisionResult(result).layoutTree ?? [];
        }
        if (this.providerName === "anthropic") {
            const result = await this.anthropicProvider.segment(_image, prompt);
            return normalizeVisionResult(result).layoutTree ?? [];
        }
        if (this.isOfflineProvider()) {
            return [
                {
                    id: "page-root",
                    label: "Page",
                    boundingBox: { x: 0, y: 0, width: 100, height: 100 },
                    layoutType: "page",
                    childCount: 0,
                    layout: {
                        direction: "vertical",
                        distribution: "start",
                        crossAlignment: "stretch",
                        gap: 0,
                        padding: { top: 0, right: 0, bottom: 0, left: 0 },
                        stackingOrder: "normal",
                    },
                },
            ];
        }
        return [];
    }
    async identify(zoneImage) {
        const prompt = `Analyze this UI region and identify the component. Return JSON with:
- componentType: specific UI component name (e.g. "PrimaryButton", "TextInput", "NavigationBar")
- variants: object of detected variants {size, state, theme, type}
- textContent: visible text content (null if none)
- iconPresent: boolean
- iconName: best guess for the icon or logo name (null if none)
- iconKind: "system" | "brand" | "illustration" | "unknown"
- preferredIconLibrary: best open-source icon family for this region, prefer "material-symbols" for common UI icons and "simple-icons" for brands
- openSourceIconName: exact open-source icon slug if recognizable (examples: "menu", "search", "close", "shopping_cart")
- interactiveElement: boolean (is this clickable/focusable?)
- estimatedSpacing: measured padding/gap in pixels, prefer exact visual estimate over assumptions
- estimatedRadius: border radius in pixels if visible
- estimatedFontSize: visible text size in pixels if text is present
- fontFamilyGuess: closest visible font family name if text is present
- fontStyleGuess: closest visible font style name if text is present
- fontWeightGuess: closest visible font weight number if text is present
- confidence: 0-1 how confident you are in this identification

Return ONLY valid JSON.`;
        if (this.providerName === "openai") {
            const result = await this.openaiProvider.identify(zoneImage, prompt);
            return normalizeVisionResult(result).manifest ?? { ...DEFAULT_MANIFEST };
        }
        if (this.providerName === "anthropic") {
            const result = await this.anthropicProvider.identify(zoneImage, prompt);
            return normalizeVisionResult(result).manifest ?? { ...DEFAULT_MANIFEST };
        }
        if (this.isOfflineProvider()) {
            return {
                ...DEFAULT_MANIFEST,
                componentType: "ScreenshotRegion",
                interactiveElement: false,
                estimatedSpacing: 0,
                confidence: 0.2,
            };
        }
        return { ...DEFAULT_MANIFEST };
    }
    async describeComponent(image) {
        const prompt = `Describe this UI component in one concise sentence focusing on its purpose, visual style, and key properties. Be specific about size, color, state, and interactive behavior.`;
        const result = await this.analyze(image, prompt);
        return result.rawAnalysis;
    }
    async auditVisualQuality(image, areas) {
        const prompt = `Perform a professional UX quality audit of this UI screenshot. Analyze: ${areas.join(", ")}.

Return JSON with:
{
  "hierarchyScore": 0-100,
  "cognitiveLoadRating": "low"|"medium"|"high",
  "brandAlignmentNotes": "...",
  "consistencyIssues": ["..."],
  "overallScore": 0-100,
  "topIssues": [{"severity":"error"|"warning"|"suggestion","description":"...","area":"..."}],
  "estimatedFixTimeMinutes": N
}

Return ONLY valid JSON.`;
        const result = await this.analyze(image, prompt);
        try {
            const jsonMatch = result.rawAnalysis.match(/```json\n?([\s\S]*?)\n?```/);
            if (jsonMatch)
                return JSON.parse(jsonMatch[1]);
            return JSON.parse(result.rawAnalysis);
        }
        catch {
            return { rawAnalysis: result.rawAnalysis };
        }
    }
    async interpretSketch(_image, _productContext) {
        return [
            { id: "sketch-header", label: "Top Section", boundingBox: { x: 0, y: 0, width: 100, height: 20 }, layoutType: "header", childCount: 2 },
            { id: "sketch-content", label: "Content Area", boundingBox: { x: 0, y: 20, width: 100, height: 60 }, layoutType: "content", childCount: 4 },
            { id: "sketch-footer", label: "Action Area", boundingBox: { x: 0, y: 80, width: 100, height: 20 }, layoutType: "footer", childCount: 2 },
        ];
    }
    async extractDesignLanguage(_references, _extractTypes) {
        return {
            layout: { gridStructure: "12-column", zoneProportions: "balanced", hierarchy: "standard" },
            spacing: { density: "comfortable", paddingPattern: "16px", dominantGap: 16 },
            colorPalette: [
                { role: "primary", hex: "#2563EB", frequency: "dominant" },
                { role: "surface", hex: "#FFFFFF", frequency: "dominant" },
                { role: "text", hex: "#1E293B", frequency: "dominant" },
            ],
            typography: { scalePattern: "modular", dominantWeights: [400, 600], hierarchyLevels: 3 },
        };
    }
}
exports.VisionClient = VisionClient;
//# sourceMappingURL=vision-client.js.map