"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildQaCriteriaSection = buildQaCriteriaSection;
function buildQaCriteriaSection(data) {
    const { knowledge } = data;
    if (!knowledge || knowledge.qaAcceptanceCriteria.length === 0)
        return null;
    return {
        id: "qa-criteria",
        title: "QA Acceptance Criteria",
        content: {
            kind: "structured-data",
            columns: ["check", "platform", "expectedResult"],
            rows: knowledge.qaAcceptanceCriteria,
        },
    };
}
//# sourceMappingURL=qa-criteria.js.map