"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Icon Fetch
// Shared SVG fetching utility for icons from Iconify and custom endpoints.
// Used by screen-cloner, component-script-builder, and other tools.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchIconSvg = fetchIconSvg;
exports.fetchCustomIconSvg = fetchCustomIconSvg;
exports.fetchIconifySvg = fetchIconifySvg;
const icon_catalog_js_1 = require("./icon-catalog.js");
const ICONIFY_BASE = "https://api.iconify.design";
/**
 * Fetch SVG for a catalog icon entry from Iconify.
 * Returns raw SVG string or null on failure.
 */
async function fetchIconSvg(entry, type = "filled") {
    const iconifyId = (0, icon_catalog_js_1.resolveIconifyId)(entry, type);
    const [prefix, name] = iconifyId.split(":");
    if (!prefix || !name)
        return null;
    const url = `${ICONIFY_BASE}/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`;
    try {
        const response = await fetch(url);
        if (!response.ok)
            return null;
        return await response.text();
    }
    catch {
        return null;
    }
}
/**
 * Fetch SVG for a custom icon from an enterprise icon set.
 * Tries inline svgMap first, then apiEndpoint if available.
 */
async function fetchCustomIconSvg(set, iconName) {
    // Try inline SVG map first
    if (set.svgMap?.[iconName]) {
        return set.svgMap[iconName];
    }
    // Try API endpoint
    if (set.apiEndpoint) {
        const url = `${set.apiEndpoint}/${encodeURIComponent(iconName)}.svg`;
        try {
            const response = await fetch(url);
            if (!response.ok)
                return null;
            return await response.text();
        }
        catch {
            return null;
        }
    }
    return null;
}
/**
 * Fetch SVG by raw Iconify prefix:name identifier.
 * Lower-level than fetchIconSvg — for use when you have a raw ID
 * rather than an IconEntry.
 */
async function fetchIconifySvg(prefix, name) {
    const url = `${ICONIFY_BASE}/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`;
    try {
        const response = await fetch(url);
        if (!response.ok)
            return null;
        return await response.text();
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=icon-fetch.js.map