"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildInteractionRulesSection = buildInteractionRulesSection;
function buildInteractionRulesSection(data) {
    const { knowledge } = data;
    if (!knowledge || knowledge.interactionRules.length === 0)
        return null;
    return {
        id: "interaction-rules",
        title: "Interaction Rules",
        content: {
            kind: "structured-data",
            columns: ["event", "trigger", "action"],
            rows: knowledge.interactionRules,
        },
    };
}
//# sourceMappingURL=interaction-rules.js.map