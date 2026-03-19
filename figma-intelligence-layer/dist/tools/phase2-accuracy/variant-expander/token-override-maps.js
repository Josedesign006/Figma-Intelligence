"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Token Override Maps
// Defines how token values change across variant dimensions (state, size,
// theme, type).  Used by the variant-expander to apply token overrides
// when generating variant matrices.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIMENSION_OVERRIDES = exports.TYPE_OVERRIDES = exports.THEME_OVERRIDES = exports.SIZE_OVERRIDES = exports.STATE_OVERRIDES = void 0;
/**
 * State dimension overrides.
 *
 * From the plan:
 *   hover    → background: --color-primary-hover
 *   disabled → opacity: 0.4, pointer-events: none
 *   loading  → icon: Spinner, text: "Loading..."
 */
exports.STATE_OVERRIDES = {
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
exports.SIZE_OVERRIDES = {
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
exports.THEME_OVERRIDES = {
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
exports.TYPE_OVERRIDES = {
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
exports.DIMENSION_OVERRIDES = {
    state: exports.STATE_OVERRIDES,
    size: exports.SIZE_OVERRIDES,
    theme: exports.THEME_OVERRIDES,
    type: exports.TYPE_OVERRIDES,
};
//# sourceMappingURL=token-override-maps.js.map