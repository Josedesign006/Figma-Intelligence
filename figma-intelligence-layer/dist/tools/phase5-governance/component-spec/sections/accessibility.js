"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAccessibilitySection = buildAccessibilitySection;
function buildAccessibilitySection(data) {
    const { snapshot, anatomy, states, properties } = data;
    const blocks = [];
    // Touch target analysis
    const isInteractive = /button|btn|input|field|toggle|switch|checkbox|radio|tab|link|select|slider/i.test(snapshot.name);
    const touchTargetItems = [];
    if (isInteractive) {
        const w = Math.round(snapshot.width);
        const h = Math.round(snapshot.height);
        if (w < 44 || h < 44) {
            touchTargetItems.push(`Current size is ${w}×${h}px — below the 44×44px WCAG 2.5.8 minimum touch target.`);
        }
        else {
            touchTargetItems.push(`Current size is ${w}×${h}px — meets 44×44px minimum touch target.`);
        }
    }
    // Typography contrast notes
    const textItems = [];
    const smallText = snapshot.textLayers.filter((t) => t.fontSize < 12);
    if (smallText.length > 0) {
        textItems.push(`${smallText.length} text layer(s) below 12px — review readability and scaling.`);
    }
    for (const t of snapshot.textLayers.slice(0, 4)) {
        const lh = t.lineHeightPx ? ` / ${Math.round(t.lineHeightPx)}px line height` : "";
        textItems.push(`${t.name}: ${t.fontFamily} ${t.fontStyle} ${t.fontSize}px${lh}`);
    }
    // Keyboard interaction notes (from states and properties)
    const keyboardItems = [];
    if (isInteractive) {
        keyboardItems.push("Component must be focusable and operable via keyboard.");
        if (states.states.some((s) => /disabled/i.test(s.name))) {
            keyboardItems.push("Disabled state: remove from tab order or use aria-disabled='true'.");
        }
        if (states.states.some((s) => /focus/i.test(s.name))) {
            keyboardItems.push("Focus state detected — ensure visible focus indicator meets 3:1 contrast.");
        }
    }
    // Structure notes
    const structureItems = [];
    if (snapshot.tokenAliases.length === 0) {
        structureItems.push("No token aliases detected — verify token bindings for theming support.");
    }
    else {
        structureItems.push(`${snapshot.tokenAliases.length} token alias(es) bound — supports theming.`);
    }
    if (snapshot.effects.some((e) => e.type === "DROP_SHADOW")) {
        structureItems.push("Drop shadow present — verify contrast in all themes and elevation levels.");
    }
    // Semantic role hint
    if (data.typeGuidance) {
        structureItems.push(`Expected semantic role: ${data.typeGuidance.semanticRole}`);
        structureItems.push(`WCAG APG pattern: ${data.typeGuidance.wcagPattern}`);
        structureItems.push(`Minimum contrast: ${data.typeGuidance.contrastRequirement}`);
    }
    if (touchTargetItems.length > 0)
        blocks.push({ kind: "list", items: touchTargetItems });
    if (textItems.length > 0)
        blocks.push({ kind: "list", items: textItems });
    if (keyboardItems.length > 0)
        blocks.push({ kind: "list", items: keyboardItems });
    if (structureItems.length > 0)
        blocks.push({ kind: "list", items: structureItems });
    // Knowledge-based structured accessibility requirements
    if (data.knowledge?.accessibilitySpec) {
        const spec = data.knowledge.accessibilitySpec;
        if (spec.intro) {
            blocks.push({ kind: "paragraph", text: spec.intro });
        }
        if (spec.requirements.length > 0) {
            blocks.push({
                kind: "structured-data",
                columns: ["requirement", "level", "notes"],
                rows: spec.requirements.map((r) => ({
                    requirement: r.requirement,
                    level: r.level,
                    notes: r.notes,
                })),
            });
        }
        if (spec.outro.length > 0) {
            blocks.push({ kind: "list", items: spec.outro });
        }
    }
    if (blocks.length === 0) {
        blocks.push({ kind: "paragraph", text: "Run manual accessibility review for this component." });
    }
    return {
        id: "accessibility",
        title: "Accessibility Specification",
        content: { kind: "mixed", blocks },
    };
}
//# sourceMappingURL=accessibility.js.map