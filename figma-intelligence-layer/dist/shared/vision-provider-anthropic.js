"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicVisionProvider = void 0;
const zod_1 = require("zod");
const layoutTypeSchema = zod_1.z.enum([
    "page",
    "sidebar",
    "header",
    "toolbar",
    "content",
    "footer",
    "drawer",
    "modal",
    "card",
    "form",
    "form-row",
    "nav",
    "button-group",
    "tab-bar",
    "table",
    "table-row",
    "list",
    "list-item",
    "section",
    "overlay",
]);
const boundedNumberSchema = zod_1.z.number().finite().min(0).max(100);
const confidenceSchema = zod_1.z.number().finite().min(0).max(1);
const rectSchema = zod_1.z.object({
    x: boundedNumberSchema,
    y: boundedNumberSchema,
    width: boundedNumberSchema,
    height: boundedNumberSchema,
});
const layoutAlignmentSchema = zod_1.z
    .object({
    direction: zod_1.z.enum(["horizontal", "vertical", "none"]).optional(),
    distribution: zod_1.z.enum(["start", "center", "end", "space-between"]).optional(),
    crossAlignment: zod_1.z.enum(["start", "center", "end", "stretch"]).optional(),
    gap: zod_1.z.number().finite().min(0).max(1000).optional(),
    padding: zod_1.z
        .object({
        top: zod_1.z.number().finite().min(0).max(1000).optional(),
        right: zod_1.z.number().finite().min(0).max(1000).optional(),
        bottom: zod_1.z.number().finite().min(0).max(1000).optional(),
        left: zod_1.z.number().finite().min(0).max(1000).optional(),
    })
        .optional(),
    columns: zod_1.z.number().int().min(1).max(24).optional(),
    stackingOrder: zod_1.z.enum(["normal", "reverse", "overlay"]).optional(),
})
    .strict()
    .optional();
const siblingHintsSchema = zod_1.z
    .object({
    alignedLeftWith: zod_1.z.array(zod_1.z.string()).optional(),
    equalSpacingWith: zod_1.z.array(zod_1.z.string()).optional(),
    repeatedChildren: zod_1.z.array(zod_1.z.string()).optional(),
    anchored: zod_1.z.enum(["left", "right", "top", "bottom", "center"]).optional(),
    overlay: zod_1.z.boolean().optional(),
})
    .strict()
    .optional();
const repetitionSchema = zod_1.z
    .object({
    isRepeated: zod_1.z.boolean(),
    pattern: zod_1.z.enum(["row", "column", "grid", "tabs", "menu", "list"]).optional(),
    itemCount: zod_1.z.number().int().min(1).max(500).optional(),
    canonicalChildId: zod_1.z.string().optional(),
    repeatedChildIds: zod_1.z.array(zod_1.z.string()).optional(),
    repeatAxis: zod_1.z.enum(["horizontal", "vertical"]).optional(),
})
    .strict()
    .optional();
const zoneSchema = zod_1.z.lazy(() => zod_1.z
    .object({
    id: zod_1.z.string().min(1).max(160),
    label: zod_1.z.string().min(1).max(120),
    boundingBox: rectSchema,
    layoutType: layoutTypeSchema,
    childCount: zod_1.z.number().int().min(0).max(200),
    children: zod_1.z.array(zoneSchema).optional(),
    layout: layoutAlignmentSchema,
    siblingHints: siblingHintsSchema,
    repetition: repetitionSchema,
    zoneImage: zod_1.z.string().optional(),
})
    .strict());
const manifestSchema = zod_1.z.object({
    componentType: zod_1.z.string().min(1).max(120),
    variants: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).default({}),
    textContent: zod_1.z.string().nullish().transform((value) => value ?? undefined),
    textContentConfidence: confidenceSchema.optional(),
    iconPresent: zod_1.z.boolean().default(false),
    iconName: zod_1.z.string().nullish().transform((value) => value ?? undefined),
    iconNameConfidence: confidenceSchema.optional(),
    iconKind: zod_1.z.enum(["system", "brand", "illustration", "unknown"]).optional(),
    preferredIconLibrary: zod_1.z.string().nullish().transform((value) => value ?? undefined),
    openSourceIconName: zod_1.z.string().nullish().transform((value) => value ?? undefined),
    interactiveElement: zod_1.z.boolean().default(false),
    estimatedSpacing: zod_1.z.number().finite().min(0).max(1000).default(8),
    estimatedSpacingConfidence: confidenceSchema.optional(),
    estimatedRadius: zod_1.z.number().finite().min(0).max(1000).optional(),
    estimatedRadiusConfidence: confidenceSchema.optional(),
    estimatedFontSize: zod_1.z.number().finite().min(1).max(512).optional(),
    estimatedFontSizeConfidence: confidenceSchema.optional(),
    fontFamilyGuess: zod_1.z.string().nullish().transform((value) => value ?? undefined),
    fontFamilyGuessConfidence: confidenceSchema.optional(),
    fontStyleGuess: zod_1.z.string().nullish().transform((value) => value ?? undefined),
    fontStyleGuessConfidence: confidenceSchema.optional(),
    fontWeightGuess: zod_1.z.number().int().min(100).max(1000).optional(),
    fontWeightGuessConfidence: confidenceSchema.optional(),
    confidence: confidenceSchema.default(0.5),
    dsBestMatch: zod_1.z.string().nullish().transform((value) => value ?? undefined),
    dsNodeId: zod_1.z.string().nullish().transform((value) => value ?? undefined),
});
const visionPayloadSchema = zod_1.z.object({
    rawAnalysis: zod_1.z.string().default(""),
    confidence: confidenceSchema.default(0.5),
    layoutTree: zod_1.z.unknown().optional(),
    zones: zod_1.z.unknown().optional(),
    manifest: zod_1.z.unknown().optional(),
});
const SYSTEM_PROMPT = [
    "You are a UI vision analysis engine.",
    "Return strictly valid JSON matching the requested shape.",
    "Never wrap JSON in markdown.",
    "Prefer omission over invented values.",
    "Bounding boxes must be percentages from 0 to 100.",
    "Confidence values must be decimals from 0 to 1.",
].join(" ");
function extractTextOutput(response) {
    if (!response || typeof response !== "object")
        return "";
    const content = response.content;
    if (!Array.isArray(content))
        return "";
    return content
        .map((item) => {
        if (!item || typeof item !== "object")
            return "";
        const candidate = item;
        return candidate.type === "text" && typeof candidate.text === "string" ? candidate.text : "";
    })
        .join("")
        .trim();
}
function stripCodeFences(text) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    return match ? match[1].trim() : text.trim();
}
function extractJsonObject(text) {
    const stripped = stripCodeFences(text);
    if (stripped.startsWith("{") && stripped.endsWith("}"))
        return stripped;
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) {
        return stripped.slice(start, end + 1);
    }
    return stripped;
}
function parseLooseJsonPayload(text) {
    const parsedJson = text ? JSON.parse(extractJsonObject(text)) : {};
    const outer = visionPayloadSchema.parse(parsedJson);
    return {
        rawAnalysis: outer.rawAnalysis,
        confidence: outer.confidence,
        layoutTree: parsedJson.layoutTree,
        zones: parsedJson.zones,
        manifest: parsedJson.manifest,
    };
}
function inferMediaType(image) {
    const dataUriMatch = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    if (dataUriMatch)
        return dataUriMatch[1];
    const lower = image.toLowerCase();
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
        return "image/jpeg";
    if (lower.endsWith(".gif"))
        return "image/gif";
    if (lower.endsWith(".webp"))
        return "image/webp";
    return "image/png";
}
async function imageToMessageSource(image) {
    if (image.startsWith("http://") || image.startsWith("https://")) {
        return { type: "url", url: image };
    }
    if (image.startsWith("data:image")) {
        return {
            type: "base64",
            media_type: inferMediaType(image),
            data: image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""),
        };
    }
    return {
        type: "base64",
        media_type: inferMediaType(image),
        data: image,
    };
}
class AnthropicVisionProvider {
    apiKey;
    model;
    apiUrl;
    apiVersion;
    constructor() {
        this.apiKey = process.env.ANTHROPIC_API_KEY ?? "";
        this.model =
            process.env.ANTHROPIC_VISION_MODEL ||
                process.env.ANTHROPIC_MODEL ||
                process.env.VISION_MODEL ||
                "claude-sonnet-4-20250514";
        this.apiUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1/messages";
        this.apiVersion = process.env.ANTHROPIC_API_VERSION || "2023-06-01";
    }
    isConfigured() {
        return Boolean(this.apiKey);
    }
    async createRequest(image, prompt) {
        if (!this.isConfigured()) {
            throw new Error("AnthropicVisionProvider: ANTHROPIC_API_KEY is not configured");
        }
        const source = await imageToMessageSource(image);
        const response = await fetch(this.apiUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-api-key": this.apiKey,
                "anthropic-version": this.apiVersion,
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: 4096,
                system: SYSTEM_PROMPT,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "image",
                                source,
                            },
                            {
                                type: "text",
                                text: prompt,
                            },
                        ],
                    },
                ],
            }),
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`AnthropicVisionProvider: API request failed (${response.status}) ${body}`);
        }
        return response.json();
    }
    async requestJsonWithRetry(image, prompt, maxAttempts = 2) {
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const retryPrompt = attempt === 1
                ? prompt
                : `${prompt}\n\nYour previous answer was not strict valid JSON. Return only valid JSON with no markdown fences, no commentary, and no trailing commas.`;
            try {
                const payload = await this.createRequest(image, retryPrompt);
                const rawText = extractTextOutput(payload);
                return parseLooseJsonPayload(rawText);
            }
            catch (error) {
                lastError = error;
            }
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
    async analyze(image, prompt) {
        const payload = await this.createRequest(image, prompt);
        const rawAnalysis = extractTextOutput(payload);
        return {
            rawAnalysis,
            confidence: rawAnalysis ? 0.6 : 0.3,
        };
    }
    async identify(image, prompt) {
        return this.requestJsonWithRetry(image, prompt);
    }
    async segment(image, prompt) {
        return this.requestJsonWithRetry(image, prompt);
    }
}
exports.AnthropicVisionProvider = AnthropicVisionProvider;
//# sourceMappingURL=vision-provider-anthropic.js.map