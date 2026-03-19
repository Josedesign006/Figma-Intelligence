import { z } from "zod";
declare const visionPayloadSchema: z.ZodObject<{
    rawAnalysis: z.ZodDefault<z.ZodString>;
    confidence: z.ZodDefault<z.ZodNumber>;
    layoutTree: z.ZodOptional<z.ZodUnknown>;
    zones: z.ZodOptional<z.ZodUnknown>;
    manifest: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    confidence: number;
    rawAnalysis: string;
    layoutTree?: unknown;
    zones?: unknown;
    manifest?: unknown;
}, {
    confidence?: number | undefined;
    rawAnalysis?: string | undefined;
    layoutTree?: unknown;
    zones?: unknown;
    manifest?: unknown;
}>;
export type AnthropicVisionPayload = z.infer<typeof visionPayloadSchema> & {
    layoutTree?: unknown;
    zones?: unknown;
    manifest?: unknown;
};
export declare class AnthropicVisionProvider {
    private readonly apiKey;
    private readonly model;
    private readonly apiUrl;
    private readonly apiVersion;
    constructor();
    isConfigured(): boolean;
    private createRequest;
    private requestJsonWithRetry;
    analyze(image: string, prompt: string): Promise<AnthropicVisionPayload>;
    identify(image: string, prompt: string): Promise<AnthropicVisionPayload>;
    segment(image: string, prompt: string): Promise<AnthropicVisionPayload>;
}
export {};
//# sourceMappingURL=vision-provider-anthropic.d.ts.map