"use strict";
/**
 * Accessibility Annotation Kit — Constants & Types
 * Defines the visual specs for 7 annotation types: Focus Order, Reading Order,
 * Input, Landmark, Heading, Link, Button.
 *
 * Each type has 3 visual components:
 *   1. Stamp — pill badge pinned to element edge
 *   2. Lasso — dotted border rectangle highlighting the element
 *   3. Details Card — property table with type-specific fields
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DETAILS_CARD_SPECS = exports.STAMP_SPECS = exports.ANNOTATION_TYPES = exports.ANNOTATION_COLORS = void 0;
exports.roleToAnnotationType = roleToAnnotationType;
exports.inferInputType = inferInputType;
exports.ANNOTATION_COLORS = {
    "focus-order": {
        fill: { r: 0.0, g: 0.65, b: 0.32 }, // #00A651 green
        text: { r: 1.0, g: 1.0, b: 1.0 },
        stroke: { r: 0.0, g: 0.65, b: 0.32 },
    },
    "reading-order": {
        fill: { r: 0.8, g: 0.2, b: 0.2 }, // #CC3333 red
        text: { r: 1.0, g: 1.0, b: 1.0 },
        stroke: { r: 0.8, g: 0.2, b: 0.2 },
    },
    input: {
        fill: { r: 0.18, g: 0.18, b: 0.42 }, // #2D2D6B dark navy
        text: { r: 1.0, g: 1.0, b: 1.0 },
        stroke: { r: 0.18, g: 0.18, b: 0.42 },
    },
    landmark: {
        fill: { r: 0.42, g: 0.31, b: 0.75 }, // #6B4EBF purple
        text: { r: 1.0, g: 1.0, b: 1.0 },
        stroke: { r: 0.42, g: 0.31, b: 0.75 },
    },
    heading: {
        fill: { r: 0.24, g: 0.24, b: 0.36 }, // #3D3D5C dark slate
        text: { r: 1.0, g: 1.0, b: 1.0 },
        stroke: { r: 0.24, g: 0.24, b: 0.36 },
    },
    link: {
        fill: { r: 0.42, g: 0.31, b: 0.75 }, // #6B4EBF purple
        text: { r: 1.0, g: 1.0, b: 1.0 },
        stroke: { r: 0.42, g: 0.31, b: 0.75 },
    },
    button: {
        fill: { r: 0.61, g: 0.18, b: 0.53 }, // #9B2D86 magenta
        text: { r: 1.0, g: 1.0, b: 1.0 },
        stroke: { r: 0.61, g: 0.18, b: 0.53 },
    },
};
exports.ANNOTATION_TYPES = {
    "focus-order": {
        key: "focus-order",
        label: "Tab",
        icon: "", // no icon — kit uses "Tab #N" format
        showNumber: true,
        detailsTitle: "Focus Order Details",
        detailsFields: ["role", "label", "keyboard support", "notes"],
    },
    "reading-order": {
        key: "reading-order",
        label: "",
        icon: "", // no icon — kit uses "#N" format
        showNumber: true,
        detailsTitle: "Reading Order Details",
        detailsFields: ["description", "code snippet"],
    },
    input: {
        key: "input",
        label: "Input",
        icon: "", // no icon prefix
        showNumber: true,
        detailsTitle: "Input Details",
        detailsFields: [
            "type", "required", "autocomplete", "inputmode", "size",
            "maxlength", "minlength", "title", "disabled", "label",
            "description", "keyboard support", "error handling", "context", "ARIA",
        ],
    },
    landmark: {
        key: "landmark",
        label: "",
        icon: "", // no icon
        showNumber: true,
        detailsTitle: "Landmark Details",
        detailsFields: ["element", "accessible name", "role", "code snippet"],
    },
    heading: {
        key: "heading",
        label: "", // dynamically set to H1, H2, etc.
        icon: "",
        showNumber: false,
        detailsTitle: "Heading Details",
        detailsFields: ["description", "code snippet"],
    },
    link: {
        key: "link",
        label: "Link",
        icon: "", // no icon prefix
        showNumber: true,
        detailsTitle: "Link Details",
        detailsFields: ["element", "target", "accessible name", "description"],
    },
    button: {
        key: "button",
        label: "Button",
        icon: "", // no icon prefix
        showNumber: true,
        detailsTitle: "Button Details",
        detailsFields: [
            "element", "accessible name", "description", "type", "scenario",
            "code snippet",
        ],
    },
};
// ─── Stamp Visual Specs ───────────────────────────────────────────────────
exports.STAMP_SPECS = {
    height: 24,
    paddingH: 8,
    paddingV: 4,
    cornerRadius: 12, // pill shape
    fontSize: 11,
    fontFamily: "Inter",
    fontFallback: "Roboto",
    gap: 4, // between number, icon, label
    lassoPadding: 8, // padding between element bounds and lasso border
    lassoStrokeWidth: 2,
    lassoDashPattern: [6, 4],
    lassoCornerRadius: 4,
    connectorStrokeWidth: 1.5,
    connectorDashPattern: [4, 4],
    // Circle marker specs for page-based annotation
    markerSize: 28, // circle diameter for focus-order markers
    markerFontSize: 13, // font size for number inside circle
    markerColor: { r: 0.42, g: 0.31, b: 0.75 }, // purple
    markerTextColor: { r: 1, g: 1, b: 1 }, // white
    markerStrokeColor: { r: 1, g: 1, b: 1 }, // white outline
    markerStrokeWeight: 2.5, // outline thickness
};
// ─── Details Card Visual Specs ────────────────────────────────────────────
exports.DETAILS_CARD_SPECS = {
    width: 260,
    headerHeight: 32,
    rowHeight: 28,
    padding: 12,
    fontSize: 11,
    fontSizeBold: 12,
    fontFamily: "Inter",
    fontFallback: "Roboto",
    cornerRadius: 4,
    borderWidth: 3, // left accent border
    bgColor: { r: 1.0, g: 1.0, b: 1.0 },
    textColor: { r: 0.13, g: 0.13, b: 0.13 },
    labelColor: { r: 0.4, g: 0.4, b: 0.4 },
    dividerColor: { r: 0.9, g: 0.9, b: 0.9 },
    shadowColor: { r: 0.0, g: 0.0, b: 0.0, a: 0.1 },
};
/** Map inferred ARIA role to the annotation type(s) it triggers. */
function roleToAnnotationType(role) {
    switch (role) {
        case "button":
            return "button";
        case "link":
            return "link";
        case "textbox":
        case "searchbox":
        case "checkbox":
        case "radio":
        case "switch":
        case "listbox":
        case "slider":
        case "spinbutton":
            return "input";
        default:
            return null;
    }
}
/** Infer input sub-type from element name for Details card. */
function inferInputType(name) {
    const n = name.toLowerCase();
    if (/email/i.test(n))
        return "email";
    if (/password/i.test(n))
        return "password";
    if (/phone|tel/i.test(n))
        return "tel";
    if (/number|qty|quantity/i.test(n))
        return "number";
    if (/date/i.test(n))
        return "date";
    if (/time/i.test(n))
        return "time";
    if (/search/i.test(n))
        return "search";
    if (/url|website/i.test(n))
        return "url";
    if (/checkbox|check/i.test(n))
        return "checkbox";
    if (/radio/i.test(n))
        return "radio";
    if (/select|dropdown|combo/i.test(n))
        return "select";
    if (/textarea|multiline/i.test(n))
        return "textarea";
    if (/fieldset|field-set|form.*group/i.test(n))
        return "fieldset";
    return "text";
}
//# sourceMappingURL=a11y-annotation-kit.js.map