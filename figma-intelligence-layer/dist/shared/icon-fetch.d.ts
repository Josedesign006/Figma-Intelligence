import type { IconEntry, CustomIconSet } from "./icon-catalog.js";
/**
 * Fetch SVG for a catalog icon entry from Iconify.
 * Returns raw SVG string or null on failure.
 */
export declare function fetchIconSvg(entry: IconEntry, type?: "filled" | "outlined"): Promise<string | null>;
/**
 * Fetch SVG for a custom icon from an enterprise icon set.
 * Tries inline svgMap first, then apiEndpoint if available.
 */
export declare function fetchCustomIconSvg(set: CustomIconSet, iconName: string): Promise<string | null>;
/**
 * Fetch SVG by raw Iconify prefix:name identifier.
 * Lower-level than fetchIconSvg — for use when you have a raw ID
 * rather than an IconEntry.
 */
export declare function fetchIconifySvg(prefix: string, name: string): Promise<string | null>;
//# sourceMappingURL=icon-fetch.d.ts.map