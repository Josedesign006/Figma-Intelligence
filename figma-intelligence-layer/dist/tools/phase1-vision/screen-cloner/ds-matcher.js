"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchToDesignSystem = matchToDesignSystem;
const design_system_matcher_js_1 = require("../../../shared/design-system-matcher.js");
const design_system_normalizers_js_1 = require("../../../shared/design-system-normalizers.js");
const DEFAULT_CONFIDENCE_THRESHOLD = 0.75;
/**
 * Match a ComponentManifest to the nearest design-system component.
 *
 * @param manifest       Recognised component manifest from Vision Pass 2
 * @param context        Shared design-system context
 * @param threshold      Minimum confidence (0–1) to accept the match
 * @returns              Matched ComponentSet (or null) with confidence score
 */
function matchToDesignSystem(manifest, contextOrSets, threshold = DEFAULT_CONFIDENCE_THRESHOLD) {
    const context = Array.isArray(contextOrSets) ? createAdHocContext(contextOrSets) : contextOrSets;
    const result = (0, design_system_matcher_js_1.matchComponentInContext)((0, design_system_matcher_js_1.manifestToDSMatchRequest)(manifest), context, threshold);
    return {
        component: result.component,
        confidence: result.confidence,
        fallbackSuggestion: result.fallbackSuggestion,
    };
}
function createAdHocContext(componentSets) {
    const normalizedSets = componentSets.map((set) => ({
        id: set.id,
        name: set.name,
        normalizedName: (0, design_system_normalizers_js_1.normalizeName)(set.name),
        description: set.description,
        childComponentIds: set.children.map((child) => child.id),
        variantSchema: (0, design_system_normalizers_js_1.inferVariantSchema)(set),
        intents: Array.from(new Set([
            ...(0, design_system_normalizers_js_1.inferComponentIntents)(set.name, set.description),
            ...set.children.flatMap((child) => (0, design_system_normalizers_js_1.inferComponentIntents)(child.name, child.description)),
        ])),
    }));
    const components = componentSets.flatMap((set) => set.children.map((child) => ({
        id: child.id,
        setId: set.id,
        name: child.name,
        normalizedName: (0, design_system_normalizers_js_1.normalizeName)(child.name),
        description: child.description,
        variantProps: {},
        intents: (0, design_system_normalizers_js_1.inferComponentIntents)(child.name, child.description),
    })));
    return {
        file: {
            lastSyncedAt: Date.now(),
            source: "mixed",
        },
        inventory: {
            componentSets: normalizedSets,
            components,
            variables: [],
            styles: [],
            pages: [],
            instances: [],
        },
        indexes: {
            componentById: new Map(components.map((component) => [component.id, component])),
            componentSetById: new Map(normalizedSets.map((componentSet) => [componentSet.id, componentSet])),
            tokenById: new Map(),
            styleById: new Map(),
            componentsByNormalizedName: new Map(),
            tokensByNormalizedName: new Map(),
            componentsByIntent: new Map(),
        },
        intelligence: {
            aliases: {},
            variantSchemas: Object.fromEntries(normalizedSets
                .filter((set) => set.variantSchema)
                .map((set) => [set.id, set.variantSchema])),
            semanticTokenGroups: {},
            preferredComponentsByIntent: {},
            namingRules: [],
        },
        freshness: {
            componentSets: Date.now(),
            variables: 0,
            styles: 0,
            pages: 0,
            instances: 0,
        },
    };
}
//# sourceMappingURL=ds-matcher.js.map