"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Token Override Maps
// Defines how token values change across variant dimensions (state, size,
// theme, type).  Used by the variant-expander to apply token overrides
// when generating variant matrices.
//
// Heights on 8px grid: xs(24h), sm(32h), md(40h), lg(48h), xl(56h)
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIMENSION_OVERRIDES = exports.TYPE_OVERRIDES = exports.THEME_OVERRIDES = exports.SIZE_OVERRIDES = exports.STATE_OVERRIDES = void 0;
/**
 * State dimension overrides.
 */
exports.STATE_OVERRIDES = {
    default: [],
    hover: [
        { property: "background", token: "color/semantic/actions/primary/bg/hover" },
    ],
    pressed: [
        { property: "background", token: "color/semantic/actions/primary/bg/pressed" },
    ],
    focused: [
        { property: "borderColor", token: "color/semantic/border/focus" },
        { property: "borderWidth", token: "border/width/strong", rawValue: 2 },
    ],
    disabled: [
        { property: "opacity", token: "opacity/disabled", rawValue: 0.4 },
    ],
    loading: [
        { property: "icon", token: "Spinner" },
        { property: "text", token: "", rawValue: "Loading…" },
    ],
    error: [
        { property: "borderColor", token: "color/semantic/feedback/danger/text" },
        { property: "background", token: "color/semantic/feedback/danger/bg" },
    ],
    success: [
        { property: "borderColor", token: "color/semantic/feedback/success/text" },
        { property: "background", token: "color/semantic/feedback/success/bg" },
    ],
    warning: [
        { property: "borderColor", token: "color/semantic/feedback/warning/text" },
        { property: "background", token: "color/semantic/feedback/warning/bg" },
    ],
    active: [
        { property: "background", token: "color/semantic/actions/primary/bg/pressed" },
        { property: "borderColor", token: "color/semantic/border/focus" },
    ],
};
/**
 * Size dimension overrides.
 * All heights on 8px grid: xs=24, sm=32, md=40, lg=48, xl=56
 */
exports.SIZE_OVERRIDES = {
    xs: [
        { property: "paddingY", token: "space/0.5", rawValue: 2 },
        { property: "paddingX", token: "space/1", rawValue: 4 },
        { property: "fontSize", token: "typography/size/xs", rawValue: 12 },
        { property: "height", token: "", rawValue: 24 },
    ],
    sm: [
        { property: "paddingY", token: "space/1", rawValue: 4 },
        { property: "paddingX", token: "space/2", rawValue: 8 },
        { property: "fontSize", token: "typography/size/sm", rawValue: 14 },
        { property: "height", token: "", rawValue: 32 },
    ],
    md: [
        { property: "paddingY", token: "space/2", rawValue: 8 },
        { property: "paddingX", token: "space/4", rawValue: 16 },
        { property: "fontSize", token: "typography/size/md", rawValue: 16 },
        { property: "height", token: "", rawValue: 40 },
    ],
    lg: [
        { property: "paddingY", token: "space/4", rawValue: 16 },
        { property: "paddingX", token: "space/6", rawValue: 24 },
        { property: "fontSize", token: "typography/size/lg", rawValue: 18 },
        { property: "height", token: "", rawValue: 48 },
    ],
    xl: [
        { property: "paddingY", token: "space/6", rawValue: 24 },
        { property: "paddingX", token: "space/8", rawValue: 32 },
        { property: "fontSize", token: "typography/size/xl", rawValue: 20 },
        { property: "height", token: "", rawValue: 56 },
    ],
};
/**
 * Theme dimension overrides.
 */
exports.THEME_OVERRIDES = {
    light: [],
    dark: [
        { property: "background", token: "color/semantic/surface/default" },
        { property: "textColor", token: "color/semantic/text/primary" },
        { property: "borderColor", token: "color/semantic/border/default" },
    ],
    "high-contrast": [
        { property: "background", token: "color/semantic/surface/default" },
        { property: "textColor", token: "color/semantic/text/primary" },
        { property: "borderColor", token: "color/semantic/border/strong" },
    ],
};
/**
 * Type / variant-purpose dimension overrides.
 */
exports.TYPE_OVERRIDES = {
    primary: [
        { property: "background", token: "color/semantic/actions/primary/bg/default" },
        { property: "textColor", token: "color/semantic/text/on-color" },
    ],
    secondary: [
        { property: "background", token: "color/semantic/actions/secondary/bg/default" },
        { property: "textColor", token: "color/semantic/text/primary" },
        { property: "borderColor", token: "color/semantic/actions/secondary/border/default" },
    ],
    ghost: [
        { property: "background", token: "transparent" },
        { property: "textColor", token: "color/semantic/actions/primary/bg/default" },
    ],
    destructive: [
        { property: "background", token: "color/semantic/actions/destructive/bg/default" },
        { property: "textColor", token: "color/semantic/text/on-color" },
    ],
    outline: [
        { property: "background", token: "transparent" },
        { property: "textColor", token: "color/semantic/actions/primary/bg/default" },
        { property: "borderColor", token: "color/semantic/actions/primary/bg/default" },
        { property: "borderWidth", token: "border/width/default", rawValue: 1.5 },
    ],
    link: [
        { property: "background", token: "transparent" },
        { property: "textColor", token: "color/semantic/actions/primary/bg/default" },
        { property: "textDecoration", token: "", rawValue: "underline" },
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