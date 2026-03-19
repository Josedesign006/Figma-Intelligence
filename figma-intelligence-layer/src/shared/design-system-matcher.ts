import Fuse from "fuse.js";
import { ComponentManifest } from "./types";
import { DSComponentSet, DesignSystemContext } from "./design-system-context";
import { normalizeName } from "./design-system-normalizers";

export interface DSMatchRequest {
  componentType?: string;
  textContent?: string | null;
  variants?: Record<string, string | undefined>;
  estimatedRadius?: number;
  estimatedSpacing?: number;
  estimatedFontSize?: number;
  interactiveElement?: boolean;
}

export interface DesignSystemMatchResult {
  component: DSComponentSet | null;
  confidence: number;
  fallbackSuggestion: string | null;
  scores: {
    name: number;
    intent: number;
    variant: number;
    usage: number;
  };
}

function inferRequestIntents(request: DSMatchRequest): string[] {
  const corpus = normalizeName(
    [request.componentType, request.textContent, request.interactiveElement ? "interactive" : ""]
      .filter(Boolean)
      .join(" ")
  );
  const intents = new Set<string>();

  if (/\bbutton|cta|submit|confirm\b/.test(corpus)) intents.add("button");
  if (/\bprimary\b/.test(corpus)) intents.add("primary-action");
  if (/\bsecondary|ghost|tertiary\b/.test(corpus)) intents.add("secondary-action");
  if (/\binput|field|textbox|search\b/.test(corpus)) intents.add("input-field");
  if (/\bnav|menu|tab|navigation\b/.test(corpus)) intents.add("navigation-item");
  if (/\bmodal|dialog|sheet\b/.test(corpus)) intents.add("modal");
  if (/\bcard|tile|panel\b/.test(corpus)) intents.add("card");
  if (/\bheader|hero|title\b/.test(corpus)) intents.add("page-header");

  return Array.from(intents);
}

function buildFuseIndex(componentSets: DSComponentSet[]): Fuse<DSComponentSet> {
  return new Fuse(componentSets, {
    keys: ["name", "description", "normalizedName", "intents"],
    threshold: 0.45,
    includeScore: true,
    minMatchCharLength: 2,
  });
}

function variantCompatibilityScore(
  requestVariants: Record<string, string | undefined> | undefined,
  schema: DSComponentSet["variantSchema"]
): number {
  if (!requestVariants || Object.keys(requestVariants).length === 0) return 0.5;
  if (!schema || Object.keys(schema.properties).length === 0) return 0.2;

  const scores = Object.entries(requestVariants).map(([property, value]) => {
    const expected = value ? normalizeName(value) : "";
    const allowed = schema.properties[normalizeName(property)] ?? [];
    if (!expected) return 0.5;
    if (allowed.includes(expected)) return 1;
    if (allowed.some((candidate) => candidate.includes(expected) || expected.includes(candidate))) {
      return 0.75;
    }
    return 0;
  });

  return scores.reduce<number>((sum, value) => sum + value, 0) / scores.length;
}

function usageScore(componentSet: DSComponentSet, ctx: DesignSystemContext, requestIntents: string[]): number {
  const intentScores = requestIntents
    .map((intent) => ctx.intelligence.preferredComponentsByIntent[intent] ?? [])
    .flat();

  if (intentScores.length === 0) return 0.5;

  const ranking = unique(intentScores);
  const index = ranking.indexOf(componentSet.id);
  if (index === -1) return 0;
  if (ranking.length === 1) return 1;
  return 1 - index / (ranking.length - 1);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function matchComponentInContext(
  request: DSMatchRequest,
  ctx: DesignSystemContext,
  threshold = 0.7
): DesignSystemMatchResult {
  const componentSets = ctx.inventory.componentSets;
  if (componentSets.length === 0) {
    return {
      component: null,
      confidence: 0,
      fallbackSuggestion: null,
      scores: { name: 0, intent: 0, variant: 0, usage: 0 },
    };
  }

  const query = [request.componentType, request.textContent].filter(Boolean).join(" ").trim();
  const requestIntents = inferRequestIntents(request);
  const fuse = buildFuseIndex(componentSets);
  const fuseResults = query ? fuse.search(query) : [];
  const searchResults = fuseResults.length > 0
    ? fuseResults
    : componentSets.map((item) => ({ item, score: 1 }));

  const scored = searchResults
    .map((result) => {
      const item = result.item;
      const nameScore = result.score != null ? 1 - result.score : 0.5;
      const intentScore = requestIntents.length === 0
        ? 0.5
        : requestIntents.filter((intent) => item.intents.includes(intent)).length / requestIntents.length;
      const variantScore = variantCompatibilityScore(request.variants, item.variantSchema);
      const preferredBoost = usageScore(item, ctx, requestIntents);
      const confidence =
        nameScore * 0.45 +
        intentScore * 0.25 +
        variantScore * 0.15 +
        preferredBoost * 0.15;

      return {
        item,
        confidence,
        scores: {
          name: nameScore,
          intent: intentScore,
          variant: variantScore,
          usage: preferredBoost,
        },
      };
    })
    .sort((left, right) => right.confidence - left.confidence);

  const best = scored[0];
  if (!best) {
    return {
      component: null,
      confidence: 0,
      fallbackSuggestion: query ? `Consider creating a "${query}" component` : null,
      scores: { name: 0, intent: 0, variant: 0, usage: 0 },
    };
  }

  if (best.confidence >= threshold) {
    return {
      component: best.item,
      confidence: best.confidence,
      fallbackSuggestion: null,
      scores: best.scores,
    };
  }

  return {
    component: null,
    confidence: best.confidence,
    fallbackSuggestion: `Closest match: "${best.item.name}" (${(best.confidence * 100).toFixed(0)}% confidence)`,
    scores: best.scores,
  };
}

export function manifestToDSMatchRequest(manifest: ComponentManifest): DSMatchRequest {
  return {
    componentType: [manifest.dsBestMatch, manifest.componentType].filter(Boolean).join(" ").trim(),
    textContent: manifest.textContent ?? null,
    variants: manifest.variants,
    estimatedRadius: manifest.estimatedRadius,
    estimatedSpacing: manifest.estimatedSpacing,
    estimatedFontSize: manifest.estimatedFontSize,
    interactiveElement: manifest.interactiveElement,
  };
}
