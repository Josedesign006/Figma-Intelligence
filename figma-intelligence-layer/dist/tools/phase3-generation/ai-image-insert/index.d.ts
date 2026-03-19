export interface GenerateImageAndInsertArgs {
    prompt: string;
    targetNodeId?: string;
    width?: number;
    height?: number;
    style?: string;
    provider?: "gemini" | "automatic1111" | "comfyui";
}
export declare function generateImageAndInsertHandler(rawArgs: GenerateImageAndInsertArgs): Promise<Record<string, unknown>>;
//# sourceMappingURL=index.d.ts.map