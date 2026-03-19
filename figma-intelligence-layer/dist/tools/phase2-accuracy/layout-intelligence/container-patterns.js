"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Container Patterns
// Lookup table that maps detected container kinds to optimal Auto Layout
// configuration and spacing tokens.  Used by layout-intelligence.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTAINER_SPECS = exports.SPACE = void 0;
/** Spacing token name → px */
exports.SPACE = {
    "--space-xs": 4,
    "--space-sm": 8,
    "--space-md": 16,
    "--space-lg": 24,
    "--space-xl": 32,
    "--space-2xl": 48,
};
/**
 * Container type → recommended Auto Layout + token settings.
 *
 * From the plan:
 *   Navigation bar  → Horizontal, Fill W / Hug H, --space-md
 *   Card            → Vertical,   Fill W / Hug H, --space-lg
 *   Form            → Vertical,   Fill W / Hug H, --space-md gap
 *   Button          → Horizontal, Hug W / Hug H,  --space-sm × --space-md
 *   Grid container  → Wrap,       Fill W / Hug H, --space-md gap
 *   List item       → Horizontal, Fill W / Hug H, --space-sm gap
 *   Modal           → Vertical,   Fixed W / Hug H, --space-xl padding
 *   Page section    → Vertical,   Fill W / Hug H, --space-2xl padding
 */
exports.CONTAINER_SPECS = {
    "navigation bar": {
        direction: "HORIZONTAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-md",
        gapToken: "--space-md",
        paddingValue: exports.SPACE["--space-md"],
        gapValue: exports.SPACE["--space-md"],
    },
    card: {
        direction: "VERTICAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-lg",
        gapToken: "--space-lg",
        paddingValue: exports.SPACE["--space-lg"],
        gapValue: exports.SPACE["--space-lg"],
    },
    form: {
        direction: "VERTICAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-md",
        gapToken: "--space-md",
        paddingValue: exports.SPACE["--space-md"],
        gapValue: exports.SPACE["--space-md"],
    },
    button: {
        direction: "HORIZONTAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-sm",
        gapToken: "--space-sm",
        paddingValue: exports.SPACE["--space-sm"],
        gapValue: exports.SPACE["--space-sm"],
    },
    grid: {
        direction: "WRAP",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-md",
        gapToken: "--space-md",
        paddingValue: exports.SPACE["--space-md"],
        gapValue: exports.SPACE["--space-md"],
    },
    "list item": {
        direction: "HORIZONTAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-sm",
        gapToken: "--space-sm",
        paddingValue: exports.SPACE["--space-sm"],
        gapValue: exports.SPACE["--space-sm"],
    },
    modal: {
        direction: "VERTICAL",
        primaryAxisSizingMode: "FIXED",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-xl",
        gapToken: "--space-xl",
        paddingValue: exports.SPACE["--space-xl"],
        gapValue: exports.SPACE["--space-xl"],
    },
    section: {
        direction: "VERTICAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-2xl",
        gapToken: "--space-2xl",
        paddingValue: exports.SPACE["--space-2xl"],
        gapValue: exports.SPACE["--space-2xl"],
    },
};
//# sourceMappingURL=container-patterns.js.map