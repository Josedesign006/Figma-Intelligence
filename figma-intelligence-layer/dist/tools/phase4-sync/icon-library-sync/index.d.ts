export interface IconLibrarySyncArgs {
    /** Sync direction */
    action: "export" | "diff" | "catalog";
    /** Figma page or frame containing the icon set (default: page named "Icons" or current page) */
    sourceNodeId?: string;
    /** Icon component name prefix filter (e.g. "icon/" or "Icon/") */
    namePrefix?: string;
    /** Output framework for generated components */
    framework?: "react" | "vue" | "svelte" | "svg-only";
    /** Whether to generate a TypeScript icon catalog */
    generateCatalog?: boolean;
    /** Export size in px (default: 24) */
    exportSize?: number;
    /** Include size variants (16, 20, 24, 32) */
    includeSizeVariants?: boolean;
    /** Existing icon names for diff comparison */
    existingIcons?: string[];
}
export declare function iconLibrarySyncHandler(args: IconLibrarySyncArgs): Promise<unknown>;
//# sourceMappingURL=index.d.ts.map