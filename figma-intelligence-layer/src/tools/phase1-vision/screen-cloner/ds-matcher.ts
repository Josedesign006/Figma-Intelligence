import {
  DesignSystemContext,
  DSComponentSet,
} from "../../../shared/design-system-context.js";
import {
  manifestToDSMatchRequest,
  matchComponentInContext,
} from "../../../shared/design-system-matcher.js";
import { inferComponentIntents, inferVariantSchema, normalizeName } from "../../../shared/design-system-normalizers.js";
import { ComponentManifest, ComponentSet } from "../../../shared/types.js";

export interface DSMatchResult {
  component: DSComponentSet | null;
  confidence: number;
  fallbackSuggestion: string | null;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0.75;

/**
 * Match a ComponentManifest to the nearest design-system component.
 *
 * @param manifest       Recognised component manifest from Vision Pass 2
 * @param context        Shared design-system context
 * @param threshold      Minimum confidence (0–1) to accept the match
 * @returns              Matched ComponentSet (or null) with confidence score
 */
export function matchToDesignSystem(
  manifest: ComponentManifest,
  contextOrSets: DesignSystemContext | ComponentSet[],
  threshold = DEFAULT_CONFIDENCE_THRESHOLD
): DSMatchResult {
  const context = Array.isArray(contextOrSets) ? createAdHocContext(contextOrSets) : contextOrSets;
  const result = matchComponentInContext(manifestToDSMatchRequest(manifest), context, threshold);
  return {
    component: result.component,
    confidence: result.confidence,
    fallbackSuggestion: result.fallbackSuggestion,
  };
}

function createAdHocContext(componentSets: ComponentSet[]): DesignSystemContext {
  const normalizedSets = componentSets.map((set) => ({
    id: set.id,
    name: set.name,
    normalizedName: normalizeName(set.name),
    description: set.description,
    childComponentIds: set.children.map((child) => child.id),
    variantSchema: inferVariantSchema(set),
    intents: Array.from(
      new Set([
        ...inferComponentIntents(set.name, set.description),
        ...set.children.flatMap((child) => inferComponentIntents(child.name, child.description)),
      ])
    ),
  }));

  const components = componentSets.flatMap((set) =>
    set.children.map((child) => ({
      id: child.id,
      setId: set.id,
      name: child.name,
      normalizedName: normalizeName(child.name),
      description: child.description,
      variantProps: {},
      intents: inferComponentIntents(child.name, child.description),
    }))
  );

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
      variantSchemas: Object.fromEntries(
        normalizedSets
          .filter((set) => set.variantSchema)
          .map((set) => [set.id, set.variantSchema!])
      ),
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
