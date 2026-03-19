// ─────────────────────────────────────────────────────────────────────────────
// Token Override Maps
// Defines how token values change across variant dimensions (state, size,
// theme, type).  Used by the variant-expander to apply token overrides
// when generating variant matrices.
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenOverride {
  property: string;     // e.g. "background", "opacity", "fontSize"
  token: string;        // design token name
  rawValue?: string | number;
}

export type OverrideMap = Record<string, TokenOverride[]>;

/**
 * State dimension overrides.
 *
 * From the plan:
 *   hover    → background: --color-primary-hover
 *   disabled → opacity: 0.4, pointer-events: none
 *   loading  → icon: Spinner, text: "Loading..."
 */
export const STATE_OVERRIDES: OverrideMap = {
  default: [],
  hover: [
    { property: "background", token: "--color-primary-hover" },
  ],
  pressed: [
    { property: "background", token: "--color-primary-pressed" },
  ],
  focused: [
    { property: "borderColor", token: "--color-focus-ring" },
    { property: "borderWidth", token: "--border-width-focus", rawValue: 2 },
  ],
  disabled: [
    { property: "opacity", token: "--opacity-disabled", rawValue: 0.4 },
  ],
  loading: [
    { property: "icon", token: "Spinner" },
    { property: "text", token: "", rawValue: "Loading…" },
  ],
};

/**
 * Size dimension overrides.
 *
 * From the plan:
 *   sm → padding: --space-xs --space-sm, fontSize: --text-sm
 *   md → defaults
 *   lg → padding: --space-md --space-lg, fontSize: --text-lg
 */
export const SIZE_OVERRIDES: OverrideMap = {
  sm: [
    { property: "paddingY", token: "--space-xs", rawValue: 4 },
    { property: "paddingX", token: "--space-sm", rawValue: 8 },
    { property: "fontSize", token: "--text-sm", rawValue: 14 },
  ],
  md: [
    { property: "paddingY", token: "--space-sm", rawValue: 8 },
    { property: "paddingX", token: "--space-md", rawValue: 16 },
    { property: "fontSize", token: "--text-md", rawValue: 16 },
  ],
  lg: [
    { property: "paddingY", token: "--space-md", rawValue: 16 },
    { property: "paddingX", token: "--space-lg", rawValue: 24 },
    { property: "fontSize", token: "--text-lg", rawValue: 18 },
  ],
  xl: [
    { property: "paddingY", token: "--space-lg", rawValue: 24 },
    { property: "paddingX", token: "--space-xl", rawValue: 32 },
    { property: "fontSize", token: "--text-xl", rawValue: 20 },
  ],
};

/**
 * Theme dimension overrides.
 *
 * From the plan:
 *   dark → background: --color-surface-dark, text: --color-text-dark
 */
export const THEME_OVERRIDES: OverrideMap = {
  light: [],
  dark: [
    { property: "background", token: "--color-surface-dark" },
    { property: "textColor", token: "--color-text-dark" },
    { property: "borderColor", token: "--color-border-dark" },
  ],
  "high-contrast": [
    { property: "background", token: "--color-surface-hc" },
    { property: "textColor", token: "--color-text-hc" },
    { property: "borderColor", token: "--color-border-hc" },
  ],
};

/**
 * Type / variant-purpose dimension overrides.
 */
export const TYPE_OVERRIDES: OverrideMap = {
  primary: [
    { property: "background", token: "--color-primary" },
    { property: "textColor", token: "--color-on-primary" },
  ],
  secondary: [
    { property: "background", token: "--color-secondary" },
    { property: "textColor", token: "--color-on-secondary" },
  ],
  ghost: [
    { property: "background", token: "transparent" },
    { property: "textColor", token: "--color-primary" },
    { property: "borderColor", token: "--color-primary" },
  ],
  destructive: [
    { property: "background", token: "--color-danger" },
    { property: "textColor", token: "--color-on-danger" },
  ],
};

/** All dimension maps for convenient iteration. */
export const DIMENSION_OVERRIDES = {
  state: STATE_OVERRIDES,
  size: SIZE_OVERRIDES,
  theme: THEME_OVERRIDES,
  type: TYPE_OVERRIDES,
} as const;
