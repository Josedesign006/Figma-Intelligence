"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildContentGuidanceSection = buildContentGuidanceSection;
function buildContentGuidanceSection(data) {
    const { knowledge } = data;
    if (!knowledge || knowledge.contentGuidance.length === 0)
        return null;
    return {
        id: "content-guidance",
        title: "Content Guidance",
        content: {
            kind: "rules",
            items: knowledge.contentGuidance,
        },
    };
}
//# sourceMappingURL=content-guidance.js.map