export interface DesignDecisionLogArgs {
    /** Frame title (e.g. "Login Screen Design Decisions") */
    name: string;
    /** Detailed description of the screen and key design choices */
    description: string;
    /** Decision status badge text */
    status?: "Approved" | "Under review" | "Requires revisions" | "Blocked" | "In progress" | "Info";
    /** Category badge text */
    category?: string;
    /** Page name context (e.g. "prototype example") */
    pageName?: string;
    /** Number of screens covered */
    screenCount?: number;
    /** Decision entries with UX rationale */
    decisions: Array<{
        /** Decision title (e.g. "Linear Checkout Flow") */
        title: string;
        /** Detailed rationale text */
        rationale: string;
        /** Source attribution (e.g. "NN Group", "Baymard Institute", "UX Best Practice") */
        source: string;
    }>;
    /** Place the frame near this node ID */
    nearNodeId?: string;
}
export interface DesignDecisionLogResult {
    success: boolean;
    nodeId?: string;
    message: string;
}
export declare function designDecisionLogHandler(args: DesignDecisionLogArgs): Promise<DesignDecisionLogResult>;
//# sourceMappingURL=index.d.ts.map