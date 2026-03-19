export interface SketchToDesignArgs {
    image: string;
    productContext?: string;
    strictDSOnly?: boolean;
    frameWidth?: number;
    annotateInterpretations?: boolean;
}
export interface SketchToDesignResult {
    frameId: string;
    zones: number;
    matched: number;
    unmatched: number;
    unmatchedZones: string[];
    tokenCoverage: string;
    generatedFrame: {
        nodeId: string;
    };
    productContext: string;
}
export declare function sketchToDesignHandler(args: SketchToDesignArgs): Promise<SketchToDesignResult>;
//# sourceMappingURL=index.d.ts.map