"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOverviewSection = buildOverviewSection;
function buildOverviewSection(data) {
    const { snapshot, properties, states, anatomy, colorTokens, typography, knowledge } = data;
    const name = snapshot.name;
    const isComponentSet = snapshot.type === "COMPONENT_SET";
    // Build a rich description from component data
    const descParts = [];
    if (knowledge?.description) {
        descParts.push(knowledge.description);
    }
    else if (snapshot.description) {
        descParts.push(snapshot.description);
    }
    else {
        const typeLabel = isComponentSet ? "component set" : snapshot.type.toLowerCase();
        descParts.push(`${name} is a ${typeLabel}.`);
    }
    if (isComponentSet && snapshot.variants.length > 0) {
        descParts.push(`Contains ${snapshot.variants.length} variant${snapshot.variants.length > 1 ? "s" : ""}.`);
    }
    if (properties.variantAxes.length > 0) {
        const axes = properties.variantAxes.map((a) => `${a.name} (${a.values.join(", ")})`);
        descParts.push(`Configurable via ${properties.variantAxes.length} variant ax${properties.variantAxes.length > 1 ? "es" : "is"}: ${axes.join("; ")}.`);
    }
    if (properties.booleanToggles.length > 0) {
        descParts.push(`${properties.booleanToggles.length} boolean toggle${properties.booleanToggles.length > 1 ? "s" : ""}: ${properties.booleanToggles.map((t) => t.name).join(", ")}.`);
    }
    if (properties.instanceSwaps.length > 0) {
        descParts.push(`${properties.instanceSwaps.length} swappable slot${properties.instanceSwaps.length > 1 ? "s" : ""}: ${properties.instanceSwaps.map((s) => s.name).join(", ")}.`);
    }
    if (anatomy.elements.length > 0) {
        const roles = anatomy.elements.reduce((acc, el) => {
            acc[el.role] = (acc[el.role] || 0) + 1;
            return acc;
        }, {});
        const roleSummary = Object.entries(roles).map(([r, c]) => `${c} ${r}`).join(", ");
        descParts.push(`Composed of ${anatomy.elements.length} elements (${roleSummary}).`);
    }
    if (colorTokens.length > 0) {
        const tokenCount = colorTokens.filter((t) => t.tokenName).length;
        descParts.push(tokenCount > 0
            ? `${tokenCount} color token${tokenCount > 1 ? "s" : ""} bound for theming.`
            : `${colorTokens.length} color fills detected (no tokens bound).`);
    }
    if (typography.length > 0) {
        const fonts = [...new Set(typography.map((t) => `${t.fontFamily} ${t.fontStyle}`))];
        descParts.push(`Typography: ${fonts.join(", ")}.`);
    }
    const layoutDesc = snapshot.layoutMode === "NONE"
        ? "No auto layout (absolute positioning)"
        : `${snapshot.layoutMode} auto layout, ${snapshot.itemSpacing}px gap, padding ${snapshot.paddingTop}/${snapshot.paddingRight}/${snapshot.paddingBottom}/${snapshot.paddingLeft}`;
    const entries = [
        { label: "Component", value: name },
        { label: "Type", value: isComponentSet ? `COMPONENT_SET (${snapshot.variants.length} variants)` : snapshot.type },
        { label: "Node ID", value: snapshot.id },
        { label: "Dimensions", value: `${Math.round(snapshot.width)} × ${Math.round(snapshot.height)} px` },
        { label: "Layout", value: layoutDesc },
        { label: "Description", value: descParts.join(" ") },
    ];
    if (states.states.length > 0) {
        entries.push({ label: "States", value: states.states.map((s) => s.name).join(", ") });
    }
    if (data.componentType) {
        entries.push({ label: "Detected pattern", value: data.componentType });
    }
    // Add child summary
    if (snapshot.childNames.length > 0) {
        entries.push({ label: "Direct children", value: snapshot.childNames.join(", ") });
    }
    return {
        id: "overview",
        title: "Overview",
        content: { kind: "key-value", entries },
    };
}
//# sourceMappingURL=overview.js.map