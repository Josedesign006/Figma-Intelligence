"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractProperties = extractProperties;
function extractProperties(snapshot) {
    const variantAxes = [];
    const booleanToggles = [];
    const instanceSwaps = [];
    const textProperties = [];
    // Extract variant axes from variantGroupProperties (COMPONENT_SET)
    for (const [property, values] of Object.entries(snapshot.variantGroupProperties)) {
        variantAxes.push({
            name: property,
            values,
            defaultValue: values[0] || "",
        });
    }
    // Process component properties
    for (const prop of snapshot.componentProperties) {
        const cleanName = prop.name.replace(/#.*$/, "").trim();
        if (prop.type === "VARIANT" && prop.options.length > 0) {
            // Only add if not already covered by variantGroupProperties
            if (!variantAxes.some((v) => v.name === prop.name)) {
                variantAxes.push({
                    name: cleanName,
                    values: prop.options,
                    defaultValue: prop.value || prop.options[0] || "",
                });
            }
        }
        else if (prop.type === "BOOLEAN") {
            booleanToggles.push({
                name: cleanName,
                defaultValue: prop.value === "true",
                controlsElement: cleanName.replace(/^(show|has|is|with)\s*/i, ""),
            });
        }
        else if (prop.type === "INSTANCE_SWAP") {
            instanceSwaps.push({
                name: cleanName,
                currentComponentName: prop.value || "",
            });
        }
        else if (prop.type === "TEXT") {
            textProperties.push({
                name: cleanName,
                value: prop.value || "",
            });
        }
    }
    return { variantAxes, booleanToggles, instanceSwaps, textProperties };
}
//# sourceMappingURL=properties.js.map