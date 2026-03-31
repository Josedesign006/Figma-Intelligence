"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRelatedSection = buildRelatedSection;
function buildRelatedSection(data) {
    const blocks = [];
    // Map component types to related alternatives
    const relationships = {
        button: [
            { name: "Link / Anchor", relationship: "Use for navigation instead of actions" },
            { name: "Icon Button", relationship: "Use for icon-only actions with tooltip" },
            { name: "FAB (Floating Action Button)", relationship: "Use for primary page-level actions" },
        ],
        input: [
            { name: "Textarea", relationship: "Use for multi-line text input" },
            { name: "Select / Dropdown", relationship: "Use when options are predefined" },
            { name: "Search Field", relationship: "Use for search with suggestions" },
            { name: "Number Input", relationship: "Use for numeric values with increment/decrement" },
        ],
        select: [
            { name: "Combobox", relationship: "Use when options need search/filter" },
            { name: "Radio Group", relationship: "Use for fewer than 5 visible choices" },
            { name: "Listbox", relationship: "Use for visible multi-select" },
        ],
        checkbox: [
            { name: "Toggle / Switch", relationship: "Use for immediate on/off settings" },
            { name: "Radio", relationship: "Use for mutually exclusive choices" },
        ],
        radio: [
            { name: "Select", relationship: "Use for more than 7 options" },
            { name: "Checkbox", relationship: "Use for non-exclusive multi-select" },
            { name: "Segmented Control", relationship: "Use for compact 2-5 option toggle" },
        ],
        toggle: [
            { name: "Checkbox", relationship: "Use when changes require save/submit" },
            { name: "Radio", relationship: "Use for multiple mutually exclusive options" },
        ],
        card: [
            { name: "List Item", relationship: "Use for simpler content rows" },
            { name: "Tile", relationship: "Use for grid-based content" },
        ],
        modal: [
            { name: "Drawer / Sheet", relationship: "Use for side-panel content" },
            { name: "Toast / Snackbar", relationship: "Use for non-blocking notifications" },
            { name: "Alert Dialog", relationship: "Use for critical confirmations" },
        ],
        toast: [
            { name: "Alert / Banner", relationship: "Use for persistent notifications" },
            { name: "Modal", relationship: "Use for blocking confirmations" },
        ],
        badge: [
            { name: "Tag / Chip", relationship: "Use for interactive/removable labels" },
            { name: "Status Indicator", relationship: "Use for real-time status dots" },
        ],
        tag: [
            { name: "Badge", relationship: "Use for read-only status indicators" },
            { name: "Chip", relationship: "Use for selectable/dismissable items" },
        ],
        tab: [
            { name: "Segmented Control", relationship: "Use for compact content switching" },
            { name: "Navigation", relationship: "Use for page-level navigation" },
        ],
        avatar: [
            { name: "Icon", relationship: "Use for system/action icons" },
            { name: "Thumbnail", relationship: "Use for content previews" },
        ],
        tooltip: [
            { name: "Popover", relationship: "Use for interactive content on hover/click" },
            { name: "Toast", relationship: "Use for timed feedback messages" },
        ],
    };
    const related = data.componentType ? relationships[data.componentType] : undefined;
    if (related && related.length > 0) {
        blocks.push({
            kind: "table",
            headers: ["Related Component", "When to Use Instead"],
            rows: related.map((r) => [r.name, r.relationship]),
        });
    }
    // Infer from component name if no type matched
    if (!related || related.length === 0) {
        const name = data.snapshot.name.toLowerCase();
        const suggestions = [];
        if (/field|input|text/i.test(name)) {
            suggestions.push("Consider related: Textarea (multi-line), Select (predefined options), Search Field");
        }
        else if (/btn|button|cta/i.test(name)) {
            suggestions.push("Consider related: Link (navigation), Icon Button (icon-only), FAB (primary action)");
        }
        else if (/card|tile/i.test(name)) {
            suggestions.push("Consider related: List Item (simpler rows), Banner (promotional content)");
        }
        else if (/nav|menu|bar/i.test(name)) {
            suggestions.push("Consider related: Tabs (content switching), Breadcrumb (hierarchical navigation)");
        }
        else {
            suggestions.push("No direct component type mapping found. Review your design system for similar components that serve overlapping use cases.");
        }
        blocks.push({ kind: "list", items: suggestions });
    }
    return {
        id: "related",
        title: "Related Components",
        content: blocks.length === 1 ? blocks[0] : { kind: "mixed", blocks },
    };
}
//# sourceMappingURL=related-components.js.map