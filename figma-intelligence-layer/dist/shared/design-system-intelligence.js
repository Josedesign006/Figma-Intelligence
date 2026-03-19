"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDesignSystemIntelligence = buildDesignSystemIntelligence;
const design_system_normalizers_1 = require("./design-system-normalizers");
function buildDesignSystemIntelligence(args) {
    const aliases = {};
    const semanticTokenGroups = {};
    const preferredComponentsByIntent = {};
    const instanceCounts = new Map();
    for (const instance of args.instances) {
        instanceCounts.set(instance.mainComponentId, (instanceCounts.get(instance.mainComponentId) ?? 0) + 1);
    }
    for (const componentSet of args.componentSets) {
        aliases[componentSet.id] = (0, design_system_normalizers_1.componentNameVariants)(componentSet.name);
    }
    for (const token of args.tokens) {
        if (!token.semanticGroup)
            continue;
        if (!semanticTokenGroups[token.semanticGroup]) {
            semanticTokenGroups[token.semanticGroup] = [];
        }
        semanticTokenGroups[token.semanticGroup].push(token.id);
    }
    const setUsageScores = new Map();
    for (const component of args.components) {
        const usage = instanceCounts.get(component.id) ?? 0;
        if (component.setId) {
            setUsageScores.set(component.setId, (setUsageScores.get(component.setId) ?? 0) + usage);
        }
    }
    for (const componentSet of args.componentSets) {
        const candidateIntents = componentSet.intents.length > 0 ? componentSet.intents : ["component"];
        for (const intent of candidateIntents) {
            if (!preferredComponentsByIntent[intent]) {
                preferredComponentsByIntent[intent] = [];
            }
            preferredComponentsByIntent[intent].push(componentSet.id);
        }
    }
    for (const intent of Object.keys(preferredComponentsByIntent)) {
        preferredComponentsByIntent[intent].sort((leftId, rightId) => {
            const leftSet = args.componentSets.find((set) => set.id === leftId);
            const rightSet = args.componentSets.find((set) => set.id === rightId);
            const leftScore = setUsageScores.get(leftId) ?? 0;
            const rightScore = setUsageScores.get(rightId) ?? 0;
            if (leftScore !== rightScore) {
                return rightScore - leftScore;
            }
            return (0, design_system_normalizers_1.normalizeName)(leftSet?.name ?? "").localeCompare((0, design_system_normalizers_1.normalizeName)(rightSet?.name ?? ""));
        });
    }
    const namingRules = (0, design_system_normalizers_1.inferNamingRules)([
        ...args.componentSets.map((item) => ({ kind: "component", name: item.name })),
        ...args.tokens.map((item) => ({ kind: "token", name: item.name })),
        ...args.styles.map((item) => ({ kind: "style", name: item.name })),
    ]);
    return {
        aliases,
        variantSchemas: args.variantSchemas,
        semanticTokenGroups,
        preferredComponentsByIntent,
        namingRules,
    };
}
//# sourceMappingURL=design-system-intelligence.js.map