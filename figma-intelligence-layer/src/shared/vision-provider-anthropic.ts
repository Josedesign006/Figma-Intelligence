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

const layoutAlignmentSchema = z
  .object({
    direction: z.enum(["horizontal", "vertical", "none"]).optional(),
    distribution: z.enum(["start", "center", "end", "space-between"]).optional(),
    crossAlignment: z.enum(["start", "center", "end", "stretch"]).optional(),
    gap: z.number().finite().min(0).max(1000).optional(),
    padding: z
      .object({
        top: z.number().finite().min(0).max(1000).optional(),
        right: z.number().finite().min(0).max(1000).optional(),
        bottom: z.number().finite().min(0).max(1000).optional(),
        left: z.number().finite().min(0).max(1000).optional(),
      })
      .optional(),
    columns: z.number().int().min(1).max(24).optional(),
    stackingOrder: z.enum(["normal", "reverse", "overlay"]).optional(),
  })
  .strict()
  .optional();

const siblingHintsSchema = z
  .object({
    alignedLeftWith: z.array(z.string()).optional(),
    equalSpacingWith: z.array(z.string()).optional(),
    repeatedChildren: z.array(z.string()).optional(),
    anchored: z.enum(["left", "right", "top", "bottom", "center"]).optional(),
    overlay: z.boolean().optional(),
  })
  .strict()
  .optional();

const repetitionSchema = z
  .object({
    isRepeated: z.boolean(),
    pattern: z.enum(["row", "column", "grid", "tabs", "menu", "list"]).optional(),
    itemCount: z.number().int().min(1).max(500).optional(),
    canonicalChildId: z.string().optional(),
    repeatedChildIds: z.array(z.string()).optional(),
    repeatAxis: z.enum(["horizontal", "vertical"]).optional(),
  })
  .strict()
  .optional();

const zoneSchema: z.ZodType<any> = z.lazy(() =>
  z
    .object({
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
    })
    .strict()
);

const manifestSchema = z.object({
  componentType: z.string().min(1).max(120),
  variants: z.record(z.string(), z.string()).default({}),
  textContent: z.string().nullish().transform((value) => value ?? undefined),
  textContentConfidence: confidenceSchema.optional(),
  iconPresent: z.boolean().default(false),
  iconName: z.string().nullish().transform((value) => value ?? undefined),
  iconNameConfidence: confidenceSchema.optional(),
  iconKind: z.enum(["system", "brand", "illustration", "unknown"]).optional(),
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
  layoutTree: z.unknown().optional(),
  zones: z.unknown().optional(),
  manifest: z.unknown().optional(),
});

export type AnthropicVisionPayload = z.infer<typeof visionPayloadSchema> & {
  layoutTree?: unknown;
  zones?: unknown;
  manifest?: unknown;
};

const SYSTEM_PROMPT = [
  "You are a UI vision analysis engine.",
  "Return strictly valid JSON matching the requested shape.",
  "Never wrap JSON in markdown.",
  "Prefer omission over invented values.",
  "Bounding boxes must be percentages from 0 to 100.",
  "Confidence values must be decimals from 0 to 1.",
].join(" ");

function extractTextOutput(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const content = (response as { content?: unknown[] }).content;
  if (!Array.isArray(content)) return "";

  return content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const candidate = item as { type?: string; text?: string };
      return candidate.type === "text" && typeof candidate.text === "string" ? candidate.text : "";
    })
    .join("")
    .trim();
}

function stripCodeFences(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return match ? match[1].trim() : text.trim();
}

function extractJsonObject(text: string): string {
  const stripped = stripCodeFences(text);
  if (stripped.startsWith("{") && stripped.endsWith("}")) return stripped;

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return stripped.slice(start, end + 1);
  }

  return stripped;
}

function parseLooseJsonPayload(text: string): AnthropicVisionPayload {
  const parsedJson = text ? JSON.parse(extractJsonObject(text)) : {};
  const outer = visionPayloadSchema.parse(parsedJson);
  return {
    rawAnalysis: outer.rawAnalysis,
    confidence: outer.confidence,
    layoutTree: (parsedJson as Record<string, unknown>).layoutTree,
    zones: (parsedJson as Record<string, unknown>).zones,
    manifest: (parsedJson as Record<string, unknown>).manifest,
  };
}

function inferMediaType(image: string): string {
  const dataUriMatch = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  if (dataUriMatch) return dataUriMatch[1];

  const lower = image.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/png";
}

async function imageToMessageSource(
  image: string
): Promise<
  | { type: "base64"; media_type: string; data: string }
  | { type: "url"; url: string }
> {
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

export class AnthropicVisionProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly apiUrl: string;
  private readonly apiVersion: string;

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

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private async createRequest(image: string, prompt: string): Promise<unknown> {
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

  private async requestJsonWithRetry(
    image: string,
    prompt: string,
    maxAttempts = 2
  ): Promise<AnthropicVisionPayload> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const retryPrompt =
        attempt === 1
          ? prompt
          : `${prompt}\n\nYour previous answer was not strict valid JSON. Return only valid JSON with no markdown fences, no commentary, and no trailing commas.`;

      try {
        const payload = await this.createRequest(image, retryPrompt);
        const rawText = extractTextOutput(payload);
        return parseLooseJsonPayload(rawText);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async analyze(image: string, prompt: string): Promise<AnthropicVisionPayload> {
    const payload = await this.createRequest(image, prompt);
    const rawAnalysis = extractTextOutput(payload);
    return {
      rawAnalysis,
      confidence: rawAnalysis ? 0.6 : 0.3,
    };
  }

  async identify(image: string, prompt: string): Promise<AnthropicVisionPayload> {
    return this.requestJsonWithRetry(image, prompt);
  }

  async segment(image: string, prompt: string): Promise<AnthropicVisionPayload> {
    return this.requestJsonWithRetry(image, prompt);
  }
}
