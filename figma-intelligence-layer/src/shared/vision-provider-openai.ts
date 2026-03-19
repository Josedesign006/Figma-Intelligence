import { z } from "zod";

const layoutTypeSchema = z.enum([
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

const boundedNumberSchema = z.number().finite().min(0).max(100);
const confidenceSchema = z.number().finite().min(0).max(1);

const rectSchema = z.object({
  x: boundedNumberSchema,
  y: boundedNumberSchema,
  width: boundedNumberSchema,
  height: boundedNumberSchema,
});

const layoutAlignmentSchema = z.object({
  direction: z.enum(["horizontal", "vertical", "none"]).optional(),
  distribution: z.enum(["start", "center", "end", "space-between"]).optional(),
  crossAlignment: z.enum(["start", "center", "end", "stretch"]).optional(),
  gap: z.number().finite().min(0).max(1000).optional(),
  padding: z.object({
    top: z.number().finite().min(0).max(1000).optional(),
    right: z.number().finite().min(0).max(1000).optional(),
    bottom: z.number().finite().min(0).max(1000).optional(),
    left: z.number().finite().min(0).max(1000).optional(),
  }).optional(),
  columns: z.number().int().min(1).max(24).optional(),
  stackingOrder: z.enum(["normal", "reverse", "overlay"]).optional(),
}).strict().optional();

const siblingHintsSchema = z.object({
  alignedLeftWith: z.array(z.string()).optional(),
  equalSpacingWith: z.array(z.string()).optional(),
  repeatedChildren: z.array(z.string()).optional(),
  anchored: z.enum(["left", "right", "top", "bottom", "center"]).optional(),
  overlay: z.boolean().optional(),
}).strict().optional();

const repetitionSchema = z.object({
  isRepeated: z.boolean(),
  pattern: z.enum(["row", "column", "grid", "tabs", "menu", "list"]).optional(),
  itemCount: z.number().int().min(1).max(500).optional(),
  canonicalChildId: z.string().optional(),
  repeatedChildIds: z.array(z.string()).optional(),
  repeatAxis: z.enum(["horizontal", "vertical"]).optional(),
}).strict().optional();

const zoneSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(160),
    label: z.string().min(1).max(120),
    boundingBox: rectSchema,
    layoutType: layoutTypeSchema,
    childCount: z.number().int().min(0).max(200),
    children: z.array(zoneSchema).optional(),
    layout: layoutAlignmentSchema,
    siblingHints: siblingHintsSchema,
    repetition: repetitionSchema,
    zoneImage: z.string().optional(),
  }).strict()
);

const manifestSchema = z.object({
  componentType: z.string().min(1).max(120),
  variants: z.record(z.string(), z.string()).default({}),
  textContent: z.string().nullish().transform((value) => value ?? undefined),
  textContentConfidence: confidenceSchema.optional(),
  iconPresent: z.boolean().default(false),
  iconName: z.string().nullish().transform((value) => value ?? undefined),
  iconNameConfidence: confidenceSchema.optional(),
  iconKind: z
    .enum(["system", "brand", "illustration", "unknown"])
    .optional(),
  preferredIconLibrary: z.string().nullish().transform((value) => value ?? undefined),
  openSourceIconName: z.string().nullish().transform((value) => value ?? undefined),
  interactiveElement: z.boolean().default(false),
  estimatedSpacing: z.number().finite().min(0).max(1000).default(8),
  estimatedSpacingConfidence: confidenceSchema.optional(),
  estimatedRadius: z.number().finite().min(0).max(1000).optional(),
  estimatedRadiusConfidence: confidenceSchema.optional(),
  estimatedFontSize: z.number().finite().min(1).max(512).optional(),
  estimatedFontSizeConfidence: confidenceSchema.optional(),
  fontFamilyGuess: z.string().nullish().transform((value) => value ?? undefined),
  fontFamilyGuessConfidence: confidenceSchema.optional(),
  fontStyleGuess: z.string().nullish().transform((value) => value ?? undefined),
  fontStyleGuessConfidence: confidenceSchema.optional(),
  fontWeightGuess: z.number().int().min(100).max(1000).optional(),
  fontWeightGuessConfidence: confidenceSchema.optional(),
  confidence: confidenceSchema.default(0.5),
  dsBestMatch: z.string().nullish().transform((value) => value ?? undefined),
  dsNodeId: z.string().nullish().transform((value) => value ?? undefined),
});

const visionPayloadSchema = z.object({
  rawAnalysis: z.string().default(""),
  confidence: confidenceSchema.default(0.5),
  layoutTree: z.array(zoneSchema).optional(),
  zones: z.array(zoneSchema).optional(),
  manifest: manifestSchema.optional(),
});

export type OpenAIVisionPayload = z.infer<typeof visionPayloadSchema>;

const SYSTEM_PROMPT = [
  "You are a UI vision analysis engine.",
  "Return strictly valid JSON matching the provided schema.",
  "Never wrap JSON in markdown.",
  "Prefer null or omission over invented values.",
  "Bounding boxes must be percentages from 0 to 100.",
  "Confidence values must be decimals from 0 to 1.",
].join(" ");

function extractTextOutput(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const output = (response as { output?: unknown[] }).output;
  if (!Array.isArray(output)) return "";

  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown[] }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const maybeText = part as { type?: string; text?: string };
      if (maybeText.type === "output_text" && typeof maybeText.text === "string") {
        chunks.push(maybeText.text);
      }
    }
  }
  return chunks.join("").trim();
}

async function imageToBase64(image: string): Promise<string> {
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

export class OpenAIVisionProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiUrl: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY ?? "";
    this.model = process.env.VISION_MODEL || "gpt-4.1-mini";
    this.apiUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/responses";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private async createRequest(
    image: string,
    prompt: string,
    format?: Record<string, unknown>
  ): Promise<unknown> {
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

  async analyze(image: string, prompt: string): Promise<OpenAIVisionPayload> {
    const payload = await this.createRequest(image, prompt);
    const rawAnalysis = extractTextOutput(payload);
    return {
      rawAnalysis,
      confidence: rawAnalysis ? 0.6 : 0.3,
    };
  }

  async identify(image: string, prompt: string): Promise<OpenAIVisionPayload> {
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

  async segment(image: string, prompt: string): Promise<OpenAIVisionPayload> {
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
