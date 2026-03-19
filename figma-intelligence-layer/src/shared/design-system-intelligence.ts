import {
  componentNameVariants,
  inferNamingRules,
  NamingRule,
  normalizeName,
} from "./design-system-normalizers";

export interface DSComponentSetLike {
  id: string;
  name: string;
  normalizedName: string;
  childComponentIds: string[];
  intents: string[];
}

export interface DSComponentLike {
  id: string;
  name: string;
  normalizedName: string;
  setId?: string;
  intents: string[];
}

export interface DSTokenLike {
  id: string;
  name: string;
  semanticGroup?: string;
}

export interface DSStyleLike {
  id: string;
  name: string;
}

export interface DSInstanceLike {
  id: string;
  mainComponentId: string;
}

export interface DSVariantSchemaLike {
  properties: Record<string, string[]>;
  required?: string[];
}

export interface DesignSystemIntelligence {
  aliases: Record<string, string[]>;
  variantSchemas: Record<string, DSVariantSchemaLike>;
  semanticTokenGroups: Record<string, string[]>;
  preferredComponentsByIntent: Record<string, string[]>;
  namingRules: NamingRule[];
}

export function buildDesignSystemIntelligence(args: {
  componentSets: DSComponentSetLike[];
  components: DSComponentLike[];
  tokens: DSTokenLike[];
  styles: DSStyleLike[];
  instances: DSInstanceLike[];
  variantSchemas: Record<string, DSVariantSchemaLike>;
}): DesignSystemIntelligence {
  const aliases: Record<string, string[]> = {};
  const semanticTokenGroups: Record<string, string[]> = {};
  const preferredComponentsByIntent: Record<string, string[]> = {};
  const instanceCounts = new Map<string, number>();

  for (const instance of args.instances) {
    instanceCounts.set(
      instance.mainComponentId,
      (instanceCounts.get(instance.mainComponentId) ?? 0) + 1
    );
  }

  for (const componentSet of args.componentSets) {
    aliases[componentSet.id] = componentNameVariants(componentSet.name);
  }

  for (const token of args.tokens) {
    if (!token.semanticGroup) continue;
    if (!semanticTokenGroups[token.semanticGroup]) {
      semanticTokenGroups[token.semanticGroup] = [];
    }
    semanticTokenGroups[token.semanticGroup].push(token.id);
  }

  const setUsageScores = new Map<string, number>();
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

      return normalizeName(leftSet?.name ?? "").localeCompare(normalizeName(rightSet?.name ?? ""));
    });
  }

  const namingRules = inferNamingRules([
    ...args.componentSets.map((item) => ({ kind: "component" as const, name: item.name })),
    ...args.tokens.map((item) => ({ kind: "token" as const, name: item.name })),
    ...args.styles.map((item) => ({ kind: "style" as const, name: item.name })),
  ]);

  return {
    aliases,
    variantSchemas: args.variantSchemas,
    semanticTokenGroups,
    preferredComponentsByIntent,
    namingRules,
  };
}
