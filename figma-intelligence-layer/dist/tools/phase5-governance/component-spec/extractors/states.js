"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractStates = extractStates;
function extractStates(snapshot) {
    const states = [];
    let stateAxisName = null;
    // Check variant group properties for state-like axes
    for (const [property, values] of Object.entries(snapshot.variantGroupProperties)) {
        if (/^(state|status|interaction|mode)$/i.test(property)) {
            stateAxisName = property;
            for (const value of values) {
                states.push({
                    name: value,
                    source: "variant-axis",
                    axisName: property,
                });
            }
        }
    }
    // Check component properties for state-like properties
    for (const prop of snapshot.componentProperties) {
        if (/^(state|status|interaction|mode)$/i.test(prop.name.replace(/#.*$/, "").trim())) {
            if (states.length === 0) {
                stateAxisName = prop.name.replace(/#.*$/, "").trim();
            }
            for (const value of prop.options) {
                if (!states.some((s) => s.name === value)) {
                    states.push({
                        name: value,
                        source: "component-property",
                        axisName: prop.name.replace(/#.*$/, "").trim(),
                    });
                }
            }
        }
    }
    return { states, stateAxisName };
}
//# sourceMappingURL=states.js.map