export type IconCategory = "action" | "navigation" | "content" | "communication" | "status" | "media" | "file" | "social" | "editor" | "toggle" | "device" | "custom";
export interface IconEntry {
    /** Canonical name following icon/{category}/{name} taxonomy */
    name: string;
    /** Display name for browsing UI */
    displayName: string;
    /** Category for grouping and filtering */
    category: IconCategory;
    /** Tags for search */
    tags: string[];
    /** Iconify prefix:name identifier for fetching SVG */
    iconifyId: string;
    /** Whether a filled variant exists */
    hasFilled: boolean;
    /** Whether an outlined variant exists */
    hasOutlined: boolean;
    /** Common aliases for fuzzy matching */
    aliases: string[];
}
export interface CustomIconSet {
    /** Unique prefix for the custom set (e.g., "acme") */
    prefix: string;
    /** Display name */
    name: string;
    /** Description */
    description: string;
    /** Icon entries in this custom set */
    icons: IconEntry[];
    /** Optional Iconify-compatible API endpoint */
    apiEndpoint?: string;
    /** Inline SVG map for offline/bundled icons */
    svgMap?: Record<string, string>;
}
export interface IconCatalog {
    /** Default icon library prefix for Iconify */
    defaultLibrary: string;
    /** All registered icons */
    entries: IconEntry[];
    /** Custom icon sets registered by enterprise teams */
    customSets: CustomIconSet[];
}
export declare const DEFAULT_ICON_CATALOG: IconCatalog;
/** Exact match by canonical name (e.g. "icon/action/search"). */
export declare function getIconByName(name: string): IconEntry | null;
/** Filter icons by category. */
export declare function getIconsByCategory(category: IconCategory): IconEntry[];
/**
 * Score-based search across names, display names, tags, and aliases.
 * Returns results sorted by relevance (higher score first).
 * No external dependencies — uses substring + starts-with scoring.
 */
export declare function searchIcons(query: string, options?: {
    category?: IconCategory;
    limit?: number;
}): IconEntry[];
/**
 * Register a custom icon set at runtime. Enterprise teams call this at
 * plugin startup to add their branded icons to the catalog.
 */
export declare function registerCustomIconSet(set: CustomIconSet): void;
/**
 * Resolve the full Iconify API identifier for an icon entry.
 * For Material Symbols, appends "-outline" suffix for outlined variant.
 */
export declare function resolveIconifyId(entry: IconEntry, type?: "filled" | "outlined"): string;
/**
 * Get all available icon categories with their entry counts.
 */
export declare function getIconCategorySummary(): Array<{
    category: IconCategory;
    count: number;
}>;
//# sourceMappingURL=icon-catalog.d.ts.map