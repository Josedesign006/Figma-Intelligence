/**
 * token-resolver.js — Resolves token names to actual values locally (zero AI tokens).
 *
 * When Claude receives only token NAMES (e.g. "primary", "md", "sm"), it picks
 * which tokens to use. This module resolves those names back to real values
 * (#1976D2, 16px, 4px) using the design system data from shared-prompt-config.js.
 */

const { DESIGN_SYSTEMS, getDesignSystemById } = require("./shared-prompt-config");

/**
 * Build a flat lookup map for a design system: tokenName → value.
 * Handles colors, typography scale, spacing (by index and value), and radius.
 */
function buildTokenMap(dsId) {
  const ds = getDesignSystemById(dsId);
  if (!ds) return {};

  const map = {};

  // Colors: "primary" → "#1976D2"
  for (const [name, hex] of Object.entries(ds.tokens.colors)) {
    map[name] = hex;
    map[`color.${name}`] = hex;
  }

  // Typography scale: "text.md" → "16px" (no bare names to avoid collision with radius)
  for (const [name, size] of Object.entries(ds.tokens.typography.scale)) {
    map[`text.${name}`] = `${size}px`;
  }

  // Font family
  map["font"] = ds.tokens.typography.fontFamily;
  map["fontFamily"] = ds.tokens.typography.fontFamily;

  // Spacing: "spacing.md" → "16px", also index-based "spacing.4" → "16px"
  ds.tokens.spacing.forEach((val, idx) => {
    map[`spacing.${idx}`] = `${val}px`;
    map[`spacing.${val}`] = `${val}px`;
  });
  // Named spacing shortcuts
  const spacingNames = ["none", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];
  ds.tokens.spacing.forEach((val, idx) => {
    if (idx < spacingNames.length) {
      map[`spacing.${spacingNames[idx]}`] = `${val}px`;
    }
  });

  // Radius: "sm" → "4px", "radius.sm" → "4px"
  for (const [name, val] of Object.entries(ds.tokens.radius)) {
    map[`radius.${name}`] = `${val}px`;
  }

  return map;
}

/**
 * Resolve a token mapping from Claude's response.
 * Input:  { bg: "primary", text: "bg", radius: "sm", paddingX: "spacing.md" }
 * Output: { bg: { name: "primary", value: "#1976D2" }, ... }
 *
 * Uses property name hints to disambiguate (e.g. "radius" prop → radius.sm, not text.sm).
 */
function resolveTokens(dsId, tokenMapping) {
  const map = buildTokenMap(dsId);
  const resolved = {};

  // Property name → token namespace hints for disambiguation
  const propHints = {
    bg: "color.", bgHover: "color.", bgDisabled: "color.", text: "color.",
    border: "color.", borderFocus: "color.", placeholder: "color.", linkHover: "color.",
    radius: "radius.", cornerRadius: "radius.",
    paddingX: "spacing.", paddingY: "spacing.", padding: "spacing.",
    gap: "spacing.", height: "spacing.", minWidth: "spacing.",
    fontSize: "text.", fontWeight: "font.",
  };

  for (const [prop, tokenName] of Object.entries(tokenMapping)) {
    // Try exact match first
    if (map[tokenName]) {
      resolved[prop] = { name: tokenName, value: map[tokenName] };
      continue;
    }

    // Try with property-based namespace hint
    const hint = propHints[prop];
    if (hint && map[hint + tokenName]) {
      resolved[prop] = { name: tokenName, value: map[hint + tokenName] };
      continue;
    }

    // Fallback: try common prefixes
    const value = map[`color.${tokenName}`] || map[`radius.${tokenName}`] || map[`spacing.${tokenName}`] || map[`text.${tokenName}`] || tokenName;
    resolved[prop] = { name: tokenName, value };
  }

  return resolved;
}

/**
 * Get the full token map for a design system (useful for Figma-side resolution).
 */
function getTokenMap(dsId) {
  return buildTokenMap(dsId);
}

module.exports = { resolveTokens, getTokenMap, buildTokenMap };
