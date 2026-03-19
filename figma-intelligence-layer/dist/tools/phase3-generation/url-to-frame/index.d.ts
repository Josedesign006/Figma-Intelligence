export type Breakpoint = "mobile" | "tablet" | "desktop";
export interface UrlToFrameArgs {
    url: string;
    breakpoints: Array<Breakpoint>;
    cloneMode: "pixel" | "system" | "adaptive";
    addCompetitorAnnotations?: boolean;
    dsGapReport?: boolean;
}
export interface BreakpointCapture {
    breakpoint: Breakpoint;
    width: number;
    frameId: string;
    screenshot: string;
    dsCoverage: number;
}
export interface DsGapEntry {
    pattern: string;
    breakpoint: Breakpoint;
    hasEquivalent: boolean;
    suggestedComponent: string | null;
}
export interface UrlToFrameResult {
    url: string;
    captures: BreakpointCapture[];
    frameIds: string[];
    screenshotsTaken: number;
    dsCoveragePercentage: number;
    dsGapReport: DsGapEntry[] | null;
    competitorAnnotations: string[] | null;
    logEntryId: string;
}
export declare function urlToFrameHandler(args: UrlToFrameArgs): Promise<UrlToFrameResult>;
//# sourceMappingURL=index.d.ts.map