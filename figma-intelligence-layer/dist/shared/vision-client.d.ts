import { VisionResult, LayoutZone, LayoutNode, ComponentManifest } from "./types.js";
/**
 * VisionClient — local heuristic image analysis utility.
 *
 * No external API key required. Returns reasonable defaults.
 * The MCP client AI provides actual vision intelligence by
 * seeing images returned in tool responses.
 */
export declare class VisionClient {
    private readonly providerName;
    private readonly openaiProvider;
    private readonly anthropicProvider;
    constructor();
    private isOfflineProvider;
    analyze(image: string, prompt: string): Promise<VisionResult>;
    segment(_image: string): Promise<LayoutNode[]>;
    identify(zoneImage: string): Promise<ComponentManifest>;
    describeComponent(image: string): Promise<string>;
    auditVisualQuality(image: string, areas: string[]): Promise<Record<string, unknown>>;
    interpretSketch(_image: string, _productContext: string): Promise<LayoutZone[]>;
    extractDesignLanguage(_references: string[], _extractTypes: string[]): Promise<Record<string, unknown>>;
}
//# sourceMappingURL=vision-client.d.ts.map