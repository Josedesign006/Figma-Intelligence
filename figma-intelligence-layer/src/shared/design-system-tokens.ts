// ─────────────────────────────────────────────────────────────────────────────
// Design System Token Catalog
// Provides authoritative token data for each selectable design system.
// When a DS is selected, these tokens are used directly by MCP tools —
// they override Figma file variables (no fallback chain).
// ─────────────────────────────────────────────────────────────────────────────

import { Token } from "./types.js";

// ─── Hex-to-RGB conversion ─────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  // Handle 8-char hex with alpha (e.g. "#000000E0")
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return { r, g, b };
}

// ─── Design System Definitions ─────────────────────────────────────────────

interface DSDefinition {
  id: string;
  name: string;
  fontFamily: string;
  colors: Record<string, string>;       // semantic name → hex
  typography: { scale: Record<string, number> };
  spacing: number[];
  radius: Record<string, number>;
}

const DESIGN_SYSTEMS: DSDefinition[] = [
  {
    id: "mui",
    name: "Material UI",
    fontFamily: "Roboto",
    colors: { primary: "#1976D2", secondary: "#9C27B0", error: "#D32F2F", success: "#2E7D32", warning: "#ED6C02", info: "#0288D1", bg: "#FFFFFF", surface: "#F5F5F5", text: "#212121" },
    typography: { scale: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, "2xl": 34 } },
    spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
    radius: { sm: 4, md: 8, lg: 16 },
  },
  {
    id: "carbon",
    name: "IBM Carbon",
    fontFamily: "IBM Plex Sans",
    colors: { primary: "#0F62FE", danger: "#DA1E28", success: "#24A148", warning: "#F1C21B", info: "#4589FF", bg: "#FFFFFF", surface: "#F4F4F4", text: "#161616" },
    typography: { scale: { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, "2xl": 32 } },
    spacing: [0, 2, 4, 8, 12, 16, 24, 32, 48, 64, 96],
    radius: { sm: 0, md: 0, lg: 0 },
  },
  {
    id: "atlassian",
    name: "Atlassian DS",
    fontFamily: "Inter",
    colors: { primary: "#0052CC", danger: "#DE350B", success: "#00875A", warning: "#FF991F", info: "#0065FF", bg: "#FFFFFF", surface: "#FAFBFC", text: "#172B4D" },
    typography: { scale: { xs: 11, sm: 14, md: 16, lg: 20, xl: 24, "2xl": 29 } },
    spacing: [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48],
    radius: { sm: 3, md: 3, lg: 3 },
  },
  {
    id: "polaris",
    name: "Polaris",
    fontFamily: "Inter",
    colors: { primary: "#008060", critical: "#D72C0D", success: "#008060", warning: "#FFC453", highlight: "#5C6AC4", bg: "#FFFFFF", surface: "#F6F6F7", text: "#202223" },
    typography: { scale: { xs: 12, sm: 13, md: 14, lg: 16, xl: 20, "2xl": 26 } },
    spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
    radius: { sm: 4, md: 8, lg: 12 },
  },
  {
    id: "fluent",
    name: "Fluent UI",
    fontFamily: "Segoe UI",
    colors: { primary: "#0078D4", danger: "#D13438", success: "#107C10", warning: "#FFB900", info: "#0078D4", bg: "#FFFFFF", surface: "#F5F5F5", text: "#242424" },
    typography: { scale: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, "2xl": 28 } },
    spacing: [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32],
    radius: { sm: 2, md: 4, lg: 8 },
  },
  {
    id: "antd",
    name: "Ant Design",
    fontFamily: "system-ui",
    colors: { primary: "#1677FF", error: "#FF4D4F", success: "#52C41A", warning: "#FAAD14", info: "#1677FF", bg: "#FFFFFF", surface: "#F5F5F5", text: "#000000E0" },
    typography: { scale: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, "2xl": 30 } },
    spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
    radius: { sm: 4, md: 6, lg: 8 },
  },
  {
    id: "shadcn",
    name: "shadcn/ui",
    fontFamily: "Inter",
    colors: { primary: "#18181B", secondary: "#F4F4F5", accent: "#F4F4F5", destructive: "#EF4444", muted: "#F4F4F5", bg: "#FFFFFF", surface: "#FAFAFA", text: "#09090B", border: "#E4E4E7" },
    typography: { scale: { xs: 12, sm: 14, md: 16, lg: 18, xl: 24, "2xl": 30 } },
    spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
    radius: { sm: 6, md: 8, lg: 12 },
  },
  {
    id: "primer",
    name: "Primer",
    fontFamily: "system-ui",
    colors: { primary: "#0969DA", danger: "#CF222E", success: "#1A7F37", attention: "#BF8700", accent: "#8250DF", bg: "#FFFFFF", surface: "#F6F8FA", text: "#1F2328", border: "#D0D7DE" },
    typography: { scale: { xs: 12, sm: 14, md: 16, lg: 20, xl: 26, "2xl": 32 } },
    spacing: [0, 4, 8, 16, 24, 32, 40, 48, 64, 80, 96],
    radius: { sm: 3, md: 6, lg: 12 },
  },
];

function getDSById(id: string): DSDefinition | null {
  return DESIGN_SYSTEMS.find((ds) => ds.id === id) ?? null;
}

// ─── Semantic color mapping ────────────────────────────────────────────────
// Maps DS color keys to the semantic token paths that resolveDesignPalette()
// and other tools use for lookup.

interface SemanticColorMapping {
  dsKey: string;                  // key in the DS colors object
  tokenNames: string[];           // semantic token paths to generate
}

const SEMANTIC_COLOR_MAP: SemanticColorMapping[] = [
  { dsKey: "primary",    tokenNames: ["color/semantic/actions/primary/bg/default", "color/semantic/primary", "color/primary/500"] },
  { dsKey: "bg",         tokenNames: ["color/semantic/surface/default", "color/surface/default", "color/neutral/50"] },
  { dsKey: "surface",    tokenNames: ["color/semantic/surface/raised", "color/semantic/surface/subtle"] },
  { dsKey: "text",       tokenNames: ["color/semantic/text/primary", "color/text/primary"] },
  { dsKey: "error",      tokenNames: ["color/semantic/status/error/default", "color/semantic/feedback/error/bg"] },
  { dsKey: "danger",     tokenNames: ["color/semantic/status/error/default", "color/semantic/feedback/error/bg"] },
  { dsKey: "critical",   tokenNames: ["color/semantic/status/error/default", "color/semantic/feedback/error/bg"] },
  { dsKey: "destructive",tokenNames: ["color/semantic/status/error/default", "color/semantic/feedback/error/bg"] },
  { dsKey: "success",    tokenNames: ["color/semantic/status/success/default", "color/semantic/feedback/success/bg", "color/semantic/feedback/success/text"] },
  { dsKey: "warning",    tokenNames: ["color/semantic/status/warning/default", "color/semantic/feedback/warning/bg"] },
  { dsKey: "info",       tokenNames: ["color/semantic/status/info/default", "color/semantic/feedback/info/bg"] },
  { dsKey: "secondary",  tokenNames: ["color/semantic/actions/secondary/bg/default", "color/semantic/secondary"] },
  { dsKey: "accent",     tokenNames: ["color/semantic/accent", "color/accent/500"] },
  { dsKey: "highlight",  tokenNames: ["color/semantic/accent", "color/accent/500"] },
  { dsKey: "attention",  tokenNames: ["color/semantic/status/warning/default"] },
  { dsKey: "muted",      tokenNames: ["color/semantic/text/secondary", "color/text/secondary", "color/text/disabled"] },
  { dsKey: "border",     tokenNames: ["color/semantic/border/default", "color/border/default", "color/neutral/200"] },
];

// Fixed synthetic tokens that don't come from DS color definitions
const FIXED_TOKENS: Array<{ name: string; rgb: { r: number; g: number; b: number } }> = [
  { name: "color/semantic/text/on-color",    rgb: { r: 1, g: 1, b: 1 } },
  { name: "color/text/on-primary",           rgb: { r: 1, g: 1, b: 1 } },
  { name: "color/semantic/primary-on",       rgb: { r: 1, g: 1, b: 1 } },
  { name: "color/semantic/surface/inverse",  rgb: { r: 0.09, g: 0.09, b: 0.09 } },
  { name: "color/semantic/text/inverse",     rgb: { r: 1, g: 1, b: 1 } },
];

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Get all tokens for a design system as Token[] objects.
 * These are synthetic tokens that match the same interface as
 * bridge.getTokens() returns, so they plug directly into
 * resolveDesignPalette() and all other token-consuming functions.
 */
export function getDesignSystemTokens(dsId: string): Token[] {
  const ds = getDSById(dsId);
  if (!ds) return [];

  const collectionId = `ds-${dsId}`;
  const tokens: Token[] = [];
  let counter = 0;

  // ── Color tokens ──
  for (const mapping of SEMANTIC_COLOR_MAP) {
    const hex = ds.colors[mapping.dsKey];
    if (!hex) continue;

    const rgb = hexToRgb(hex);
    for (const tokenName of mapping.tokenNames) {
      tokens.push({
        id: `ds-${dsId}-${counter++}`,
        name: tokenName,
        type: "COLOR",
        value: rgb as unknown as string, // Runtime: { r, g, b } object — matches Figma's actual token format
        collectionId,
        description: `${ds.name} ${mapping.dsKey}`,
      });
    }
  }

  // Fixed tokens (on-color text, inverse surface, etc.)
  for (const fixed of FIXED_TOKENS) {
    tokens.push({
      id: `ds-${dsId}-${counter++}`,
      name: fixed.name,
      type: "COLOR",
      value: fixed.rgb as unknown as string,
      collectionId,
      description: `${ds.name} fixed token`,
    });
  }

  // ── Border/outline token from DS border color or derived from text ──
  if (!ds.colors.border) {
    const textRgb = hexToRgb(ds.colors.text);
    const borderRgb = { r: textRgb.r * 0.3 + 0.7, g: textRgb.g * 0.3 + 0.7, b: textRgb.b * 0.3 + 0.7 };
    for (const name of ["color/semantic/border/default", "color/border/default", "color/neutral/200"]) {
      if (!tokens.find((t) => t.name === name)) {
        tokens.push({
          id: `ds-${dsId}-${counter++}`,
          name,
          type: "COLOR",
          value: borderRgb as unknown as string,
          collectionId,
          description: `${ds.name} derived border`,
        });
      }
    }
  }

  // ── Subtle surface derived from surface color ──
  if (!tokens.find((t) => t.name === "color/semantic/border/subtle")) {
    const surfaceRgb = hexToRgb(ds.colors.surface || ds.colors.bg);
    tokens.push({
      id: `ds-${dsId}-${counter++}`,
      name: "color/semantic/border/subtle",
      type: "COLOR",
      value: surfaceRgb as unknown as string,
      collectionId,
      description: `${ds.name} subtle border`,
    });
  }

  // ── Spacing tokens ──
  const spacingNames = ["none", "2xs", "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];
  ds.spacing.forEach((val, idx) => {
    if (idx < spacingNames.length) {
      tokens.push({
        id: `ds-${dsId}-sp-${counter++}`,
        name: `space/semantic/inset/control/${spacingNames[idx]}`,
        type: "FLOAT",
        value: val,
        collectionId,
        description: `${ds.name} spacing ${spacingNames[idx]}`,
      });
    }
  });

  // ── Radius tokens ──
  for (const [name, val] of Object.entries(ds.radius)) {
    tokens.push({
      id: `ds-${dsId}-r-${counter++}`,
      name: `radius/semantic/control/${name}`,
      type: "FLOAT",
      value: val,
      collectionId,
      description: `${ds.name} radius ${name}`,
    });
    tokens.push({
      id: `ds-${dsId}-r-${counter++}`,
      name: `radius/semantic/surface/${name}`,
      type: "FLOAT",
      value: val,
      collectionId,
      description: `${ds.name} radius ${name}`,
    });
  }

  // ── Pill radius ──
  tokens.push({
    id: `ds-${dsId}-r-${counter++}`,
    name: "radius/semantic/pill",
    type: "FLOAT",
    value: 9999,
    collectionId,
    description: `${ds.name} pill radius`,
  });

  return tokens;
}

/**
 * Get the font family for a design system.
 */
export function getDesignSystemFontFamily(dsId: string): string | null {
  const ds = getDSById(dsId);
  return ds?.fontFamily ?? null;
}

/**
 * Get the full DS definition (colors, spacing, radius, font, typography scale).
 */
export function getDesignSystemDefinition(dsId: string): DSDefinition | null {
  return getDSById(dsId);
}

/**
 * Get list of all available design system IDs.
 */
export function getAvailableDesignSystemIds(): string[] {
  return DESIGN_SYSTEMS.map((ds) => ds.id);
}
