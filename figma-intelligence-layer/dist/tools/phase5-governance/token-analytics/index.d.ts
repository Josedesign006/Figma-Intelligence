export interface TokenAnalyticsArgs {
    action: "usage" | "orphans" | "coverage" | "adoption" | "full-report";
    collectionFilter?: string;
    pageFilter?: string;
    includeHidden?: boolean;
}
export declare function tokenAnalyticsHandler(args: TokenAnalyticsArgs): Promise<unknown>;
//# sourceMappingURL=index.d.ts.map