// ─────────────────────────────────────────────────────────────────────────────
// Icon Fetch
// Shared SVG fetching utility for icons from Iconify and custom endpoints.
// Used by screen-cloner, component-script-builder, and other tools.
// ─────────────────────────────────────────────────────────────────────────────

import type { IconEntry, CustomIconSet } from "./icon-catalog.js";
import { resolveIconifyId } from "./icon-catalog.js";

const ICONIFY_BASE = "https://api.iconify.design";

/**
 * Fetch SVG for a catalog icon entry from Iconify.
 * Returns raw SVG string or null on failure.
 */
export async function fetchIconSvg(
  entry: IconEntry,
  type: "filled" | "outlined" = "filled",
): Promise<string | null> {
  const iconifyId = resolveIconifyId(entry, type);
  const [prefix, name] = iconifyId.split(":");
  if (!prefix || !name) return null;

  const url = `${ICONIFY_BASE}/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Fetch SVG for a custom icon from an enterprise icon set.
 * Tries inline svgMap first, then apiEndpoint if available.
 */
export async function fetchCustomIconSvg(
  set: CustomIconSet,
  iconName: string,
): Promise<string | null> {
  // Try inline SVG map first
  if (set.svgMap?.[iconName]) {
    return set.svgMap[iconName];
  }

  // Try API endpoint
  if (set.apiEndpoint) {
    const url = `${set.apiEndpoint}/${encodeURIComponent(iconName)}.svg`;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return await response.text();
    } catch {
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
export async function fetchIconifySvg(
  prefix: string,
  name: string,
): Promise<string | null> {
  const url = `${ICONIFY_BASE}/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
