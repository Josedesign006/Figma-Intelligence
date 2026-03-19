"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIVisionProvider = void 0;
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
const layoutAlignmentSchema = zod_1.z.object({
    direction: zod_1.z.enum(["horizontal", "vertical", "none"]).optional(),
    distribution: zod_1.z.enum(["start", "center", "end", "space-between"]).optional(),
    crossAlignment: zod_1.z.enum(["start", "center", "end", "stretch"]).optional(),
    gap: zod_1.z.number().finite().min(0).max(1000).optional(),
    padding: zod_1.z.object({
        top: zod_1.z.number().finite().min(0).max(1000).optional(),
        right: zod_1.z.number().finite().min(0).max(1000).optional(),
        bottom: zod_1.z.number().finite().min(0).max(1000).optional(),
        left: zod_1.z.number().finite().min(0).max(1000).optional(),
    }).optional(),
    columns: zod_1.z.number().int().min(1).max(24).optional(),
    stackingOrder: zod_1.z.enum(["normal", "reverse", "overlay"]).optional(),
}).strict().optional();
const siblingHintsSchema = zod_1.z.object({
    alignedLeftWith: zod_1.z.array(zod_1.z.string()).optional(),
    equalSpacingWith: zod_1.z.array(zod_1.z.string()).optional(),
    repeatedChildren: zod_1.z.array(zod_1.z.string()).optional(),
    anchored: zod_1.z.enum(["left", "right", "top", "bottom", "center"]).optional(),
    overlay: zod_1.z.boolean().optional(),
}).strict().optional();
const repetitionSchema = zod_1.z.object({
    isRepeated: zod_1.z.boolean(),
    pattern: zod_1.z.enum(["row", "column", "grid", "tabs", "menu", "list"]).optional(),
    itemCount: zod_1.z.number().int().min(1).max(500).optional(),
    canonicalChildId: zod_1.z.string().optional(),
    repeatedChildIds: zod_1.z.array(zod_1.z.string()).optional(),
    repeatAxis: zod_1.z.enum(["horizontal", "vertical"]).optional(),
}).strict().optional();
const zoneSchema = zod_1.z.lazy(() => zod_1.z.object({
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
}).strict());
const manifestSchema = zod_1.z.object({
    componentType: zod_1.z.string().min(1).max(120),
    variants: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).default({}),
    textContent: zod_1.z.string().nullish().transform((value) => value ?? undefined),
    textContentConfidence: confidenceSchema.optional(),
    iconPresent: zod_1.z.boolean().default(false),
    iconName: zod_1.z.string().nullish().transform((value) => value ?? undefined),
    iconNameConfidence: confidenceSchema.optional(),
    iconKind: zod_1.z
        .enum(["system", "brand", "illustration", "unknown"])
        .optional(),
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
    layoutTree: zod_1.z.array(zoneSchema).optional(),
    zones: zod_1.z.array(zoneSchema).optional(),
    manifest: manifestSchema.optional(),
});
const SYSTEM_PROMPT = [
    "You are a UI vision analysis engine.",
    "Return strictly valid JSON matching the provided schema.",
    "Never wrap JSON in markdown.",
    "Prefer null or omission over invented values.",
    "Bounding boxes must be percentages from 0 to 100.",
    "Confidence values must be decimals from 0 to 1.",
].join(" ");
function extractTextOutput(response) {
    if (!response || typeof response !== "object")
        return "";
    const output = response.output;
    if (!Array.isArray(output))
        return "";
    const chunks = [];
    for (const item of output) {
        if (!item || typeof item !== "object")
            continue;
        const content = item.content;
        if (!Array.isArray(content))
            continue;
        for (const part of content) {
            if (!part || typeof part !== "object")
                continue;
            const maybeText = part;
            if (maybeText.type === "output_text" && typeof maybeText.text === "string") {
                chunks.push(maybeText.text);
            }
        }
    }
    return chunks.join("").trim();
}
async function imageToBase64(image) {
    if (image.startsWith("data:image")) {
        return image.replace(/^data:image\/\w+;base64,/, "");
    }
    if (image.startsWith("http")) {
        const resp = await fetch(image);
        const buf = Buffer.from(await resp.arrayBuffer());
        return buf.toString("base64");
    }
    return image;
}
class OpenAIVisionProvider {
    apiKey;
    model;
    apiUrl;
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY ?? "";
        this.model = process.env.VISION_MODEL || "gpt-4.1-mini";
        this.apiUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/responses";
    }
    isConfigured() {
        return Boolean(this.apiKey);
    }
    async createRequest(image, prompt, format) {
        if (!this.isConfigured()) {
            throw new Error("OpenAIVisionProvider: OPENAI_API_KEY is not configured");
        }
        const base64 = await imageToBase64(image);
        const response = await fetch(this.apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                input: [
                    {
                        role: "system",
                        content: [{ type: "input_text", text: SYSTEM_PROMPT }],
                    },
                    {
                        role: "user",
                        content: [
                            { type: "input_text", text: prompt },
                            {
                                type: "input_image",
                                image_url: `data:image/png;base64,${base64}`,
                                detail: process.env.VISION_DETAIL_LEVEL || "high",
                            },
                        ],
                    },
                ],
                ...(format ? { text: { format } } : {}),
            }),
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`OpenAIVisionProvider: API request failed (${response.status}) ${body}`);
        }
        return response.json();
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
        const payload = await this.createRequest(image, prompt, {
            type: "json_schema",
            name: "vision_manifest",
            schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                    rawAnalysis: { type: "string" },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    manifest: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            componentType: { type: "string" },
                            variants: {
                                type: "object",
                                additionalProperties: { type: "string" },
                            },
                            textContent: { type: ["string", "null"] },
                            textContentConfidence: { type: "number", minimum: 0, maximum: 1 },
                            iconPresent: { type: "boolean" },
                            iconName: { type: ["string", "null"] },
                            iconNameConfidence: { type: "number", minimum: 0, maximum: 1 },
                            iconKind: {
                                type: "string",
                                enum: ["system", "brand", "illustration", "unknown"],
                            },
                            preferredIconLibrary: { type: ["string", "null"] },
                            openSourceIconName: { type: ["string", "null"] },
                            interactiveElement: { type: "boolean" },
                            estimatedSpacing: { type: "number", minimum: 0, maximum: 1000 },
                            estimatedSpacingConfidence: { type: "number", minimum: 0, maximum: 1 },
                            estimatedRadius: { type: "number", minimum: 0, maximum: 1000 },
                            estimatedRadiusConfidence: { type: "number", minimum: 0, maximum: 1 },
                            estimatedFontSize: { type: "number", minimum: 1, maximum: 512 },
                            estimatedFontSizeConfidence: { type: "number", minimum: 0, maximum: 1 },
                            fontFamilyGuess: { type: ["string", "null"] },
                            fontFamilyGuessConfidence: { type: "number", minimum: 0, maximum: 1 },
                            fontStyleGuess: { type: ["string", "null"] },
                            fontStyleGuessConfidence: { type: "number", minimum: 0, maximum: 1 },
                            fontWeightGuess: { type: "number", minimum: 100, maximum: 1000 },
                            fontWeightGuessConfidence: { type: "number", minimum: 0, maximum: 1 },
                            confidence: { type: "number", minimum: 0, maximum: 1 },
                            dsBestMatch: { type: ["string", "null"] },
                            dsNodeId: { type: ["string", "null"] },
                        },
                        required: [
                            "componentType",
                            "variants",
                            "iconPresent",
                            "interactiveElement",
                            "estimatedSpacing",
                            "confidence",
                        ],
                    },
                },
                required: ["rawAnalysis", "confidence", "manifest"],
            },
            strict: true,
        });
        const parsedText = extractTextOutput(payload);
        const parsedJson = parsedText ? JSON.parse(parsedText) : {};
        return visionPayloadSchema.parse(parsedJson);
    }
    async segment(image, prompt) {
        const payload = await this.createRequest(image, prompt, {
            type: "json_schema",
            name: "vision_layout_tree",
            schema: {
                type: "object",
                additionalProperties: false,
                $defs: {
                    layoutNode: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            id: { type: "string" },
                            label: { type: "string" },
                            boundingBox: {
                                type: "object",
                                additionalProperties: false,
                                properties: {
                                    x: { type: "number", minimum: 0, maximum: 100 },
                                    y: { type: "number", minimum: 0, maximum: 100 },
                                    width: { type: "number", minimum: 0, maximum: 100 },
                                    height: { type: "number", minimum: 0, maximum: 100 },
                                },
                                required: ["x", "y", "width", "height"],
                            },
                            layoutType: {
                                type: "string",
                                enum: [
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
                                ],
                            },
                            childCount: { type: "integer", minimum: 0, maximum: 200 },
                            children: {
                                type: "array",
                                items: { $ref: "#/$defs/layoutNode" },
                            },
                            layout: {
                                type: "object",
                                additionalProperties: false,
                                properties: {
                                    direction: {
                                        type: "string",
                                        enum: ["horizontal", "vertical", "none"],
                                    },
                                    distribution: {
                                        type: "string",
                                        enum: ["start", "center", "end", "space-between"],
                                    },
                                    crossAlignment: {
                                        type: "string",
                                        enum: ["start", "center", "end", "stretch"],
                                    },
                                    gap: { type: "number", minimum: 0, maximum: 1000 },
                                    padding: {
                                        type: "object",
                                        additionalProperties: false,
                                        properties: {
                                            top: { type: "number", minimum: 0, maximum: 1000 },
                                            right: { type: "number", minimum: 0, maximum: 1000 },
                                            bottom: { type: "number", minimum: 0, maximum: 1000 },
                                            left: { type: "number", minimum: 0, maximum: 1000 },
                                        },
                                    },
                                    columns: { type: "integer", minimum: 1, maximum: 24 },
                                    stackingOrder: {
                                        type: "string",
                                        enum: ["normal", "reverse", "overlay"],
                                    },
                                },
                            },
                            siblingHints: {
                                type: "object",
                                additionalProperties: false,
                                properties: {
                                    alignedLeftWith: { type: "array", items: { type: "string" } },
                                    equalSpacingWith: { type: "array", items: { type: "string" } },
                                    repeatedChildren: { type: "array", items: { type: "string" } },
                                    anchored: {
                                        type: "string",
                                        enum: ["left", "right", "top", "bottom", "center"],
                                    },
                                    overlay: { type: "boolean" },
                                },
                            },
                            repetition: {
                                type: "object",
                                additionalProperties: false,
                                properties: {
                                    isRepeated: { type: "boolean" },
                                    pattern: {
                                        type: "string",
                                        enum: ["row", "column", "grid", "tabs", "menu", "list"],
                                    },
                                    itemCount: { type: "integer", minimum: 1, maximum: 500 },
                                    canonicalChildId: { type: "string" },
                                    repeatedChildIds: { type: "array", items: { type: "string" } },
                                    repeatAxis: {
                                        type: "string",
                                        enum: ["horizontal", "vertical"],
                                    },
                                },
                                required: ["isRepeated"],
                            },
                            zoneImage: { type: "string" },
                        },
                        required: ["id", "label", "boundingBox", "layoutType", "childCount"],
                    },
                },
                properties: {
                    rawAnalysis: { type: "string" },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    layoutTree: {
                        type: "array",
                        items: { $ref: "#/$defs/layoutNode" },
                    },
                },
                required: ["rawAnalysis", "confidence", "layoutTree"],
            },
            strict: true,
        });
        const parsedText = extractTextOutput(payload);
        const parsedJson = parsedText ? JSON.parse(parsedText) : {};
        return visionPayloadSchema.parse(parsedJson);
    }
}
exports.OpenAIVisionProvider = OpenAIVisionProvider;
//# sourceMappingURL=vision-provider-openai.js.map