export interface IntentTranslatorArgs {
    prompt: string;
    context?: string;
    strictMode?: boolean;
}
export interface MatchedComponent {
    dsNodeId: string;
    dsName: string;
    score: number;
    variantHints: Record<string, string>;
    tokenRefs: string[];
}
export interface ClarifyingQuestion {
    question: string;
    candidates: Array<{
        dsNodeId: string;
        dsName: string;
        score: number;
    }>;
}
export type IntentManifestStatus = "resolved" | "ambiguous" | "low-confidence";
export interface IntentManifest {
    status: IntentManifestStatus;
    confidence: number;
    parsedIntent: {
        componentTypes: string[];
        variants: Record<string, string>;
        tokens: string[];
        layout?: string;
        textContent?: string;
    };
    matches: MatchedComponent[];
    clarifyingQuestion?: ClarifyingQuestion;
    logEntryId: string;
}
export declare function intentTranslatorHandler(args: IntentTranslatorArgs): Promise<IntentManifest>;
//# sourceMappingURL=index.d.ts.map