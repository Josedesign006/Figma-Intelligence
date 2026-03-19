export interface ScreenClonerArgs {
    image: string;
    cloneMode: "pixel" | "system" | "adaptive";
    frameWidth?: number;
    targetPage?: string;
    annotateUnmatched?: boolean;
}
export interface ScreenClonerResult {
    frameId: string;
    cloneMode: string;
    zones: number;
    matched: number;
    unmatched: number;
    unmatchedComponents: string[];
    tokenCoverage: string;
    generatedFrame: {
        nodeId: string;
    };
}
export declare function imageBufferToPngDataUri(buffer: Buffer): Promise<string>;
export declare function resolveImage(image: string): Promise<string>;
export declare function screenClonerHandler(args: ScreenClonerArgs): Promise<ScreenClonerResult>;
//# sourceMappingURL=index.d.ts.map