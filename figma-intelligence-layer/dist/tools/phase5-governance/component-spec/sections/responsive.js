"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildResponsiveSection = buildResponsiveSection;
function buildResponsiveSection(data) {
    const { knowledge } = data;
    if (!knowledge || knowledge.responsiveBehaviour.length === 0)
        return null;
    return {
        id: "responsive",
        title: "Responsive Behaviour",
        content: {
            kind: "structured-data",
            columns: ["breakpoint", "behavior"],
            rows: knowledge.responsiveBehaviour,
        },
    };
}
//# sourceMappingURL=responsive.js.map