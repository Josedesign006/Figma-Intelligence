"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPropertiesSection = buildPropertiesSection;
function buildPropertiesSection(data) {
    const { properties, snapshot } = data;
    const blocks = [];
    const hasProperties = properties.variantAxes.length > 0 ||
        properties.booleanToggles.length > 0 ||
        properties.instanceSwaps.length > 0 ||
        properties.textProperties.length > 0;
    if (hasProperties) {
        const propDescriptions = data.knowledge?.propertyDescriptions ?? {};
        const headers = ["Property", "Type", "Values / Default", "Required", "Description"];
        const rows = [];
        for (const axis of properties.variantAxes) {
            const desc = propDescriptions[axis.name] ?? propDescriptions[axis.name.toLowerCase()] ?? "";
            rows.push([axis.name, "Variant", `${axis.values.join(", ")} (default: ${axis.defaultValue})`, "Yes", desc]);
        }
        for (const toggle of properties.booleanToggles) {
            const desc = propDescriptions[toggle.name] ?? propDescriptions[toggle.name.toLowerCase()] ?? "";
            rows.push([toggle.name, "Boolean", `true / false (default: ${toggle.defaultValue})`, "No", desc]);
        }
        for (const swap of properties.instanceSwaps) {
            const desc = propDescriptions[swap.name] ?? propDescriptions[swap.name.toLowerCase()] ?? "";
            rows.push([swap.name, "Instance Swap", swap.currentComponentName || "Any component", "No", desc]);
        }
        for (const text of properties.textProperties) {
            const desc = propDescriptions[text.name] ?? propDescriptions[text.name.toLowerCase()] ?? "";
            rows.push([text.name, "Text Override", text.value ? `"${text.value}"` : "Editable", "No", desc]);
        }
        blocks.push({ kind: "table", headers, rows });
        // Summary
        blocks.push({
            kind: "paragraph",
            text: `Total properties: ${rows.length} (${properties.variantAxes.length} variants, ${properties.booleanToggles.length} booleans, ${properties.instanceSwaps.length} instance swaps, ${properties.textProperties.length} text overrides).`,
        });
    }
    else {
        // No properties — still produce useful content
        blocks.push({
            kind: "paragraph",
            text: `No component properties detected on "${snapshot.name}". This means the component cannot be configured by consumers without detaching. Consider exposing properties for: variant selection, text overrides, icon swaps, and visibility toggles.`,
        });
        // Suggest properties based on anatomy
        const suggestions = [];
        const hasText = snapshot.textLayers.length > 0;
        const hasInstances = snapshot.scanNodes?.some((n) => n.type === "INSTANCE");
        if (hasText)
            suggestions.push("Add text override properties for editable labels");
        if (hasInstances)
            suggestions.push("Add instance swap properties for icon/sub-component slots");
        suggestions.push("Add a boolean toggle for optional elements");
        suggestions.push("Add variant axes for size, state, or style variations");
        if (suggestions.length > 0) {
            blocks.push({ kind: "list", items: suggestions });
        }
    }
    return {
        id: "properties",
        title: "Properties / API",
        content: blocks.length === 1 ? blocks[0] : { kind: "mixed", blocks },
    };
}
//# sourceMappingURL=properties-api.js.map