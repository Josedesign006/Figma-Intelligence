export interface CompositionBuilderArgs {
    /** Natural language description of the pattern to build */
    pattern: string;
    /** Explicit list of components to compose (overrides AI pattern matching) */
    components?: Array<{
        name: string;
        props?: Record<string, string>;
        count?: number;
    }>;
    /** Target frame width (default 400) */
    frameWidth?: number;
    /** Layout direction (default auto-detected from pattern) */
    layoutDirection?: "VERTICAL" | "HORIZONTAL";
    /** Spacing between components in px (default: from DS tokens or 16) */
    spacing?: number;
    /** Padding inside the container frame (default: 24) */
    padding?: number;
    /** Include a background fill */
    includeBackground?: boolean;
    /** Place result on a specific Figma page */
    targetPage?: string;
}
export declare function compositionBuilderHandler(args: CompositionBuilderArgs): Promise<unknown>;
//# sourceMappingURL=index.d.ts.map