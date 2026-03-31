"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAnatomySection = buildAnatomySection;
function buildAnatomySection(data) {
    const { anatomy } = data;
    if (anatomy.elements.length === 0) {
        return {
            id: "anatomy",
            title: "Anatomy",
            content: { kind: "paragraph", text: "No child elements detected." },
        };
    }
    const headers = ["#", "Element", "Type", "Role", "Visible", "Controlled By"];
    const rows = anatomy.elements.map((el) => [
        String(el.index + 1),
        el.name,
        el.nodeType,
        el.role,
        el.visible ? "Yes" : "No",
        el.controlledByBoolean || "—",
    ]);
    return {
        id: "anatomy",
        title: "Anatomy",
        content: { kind: "table", headers, rows },
    };
}
//# sourceMappingURL=anatomy.js.map