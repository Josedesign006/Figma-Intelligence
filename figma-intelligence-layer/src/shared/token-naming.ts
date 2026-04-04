export type TokenNamingDomain = "primitive" | "semantic" | "component" | "unknown";

export interface TokenNamingRuleSet {
  primitiveCategories: string[];
  semanticCategories: string[];
  componentPrefix: string;
  semanticPrefix: string;
  separator: "/";
}

export interface TokenNamingIssue {
  severity: "error" | "warning";
  code:
    | "empty-name"
    | "invalid-characters"
    | "duplicate-separator"
    | "uppercase"
    | "unknown-domain"
    | "unknown-primitive-category"
    | "typo"
    | "component-prefix"
    | "semantic-prefix"
    | "short-name"
    | "unknown-concept"
    | "invalid-state-for-concept"
    | "invalid-property-for-concept";
  message: string;
}

export interface TokenNamingAnalysis {
  originalName: string;
  normalizedName: string;
  domain: TokenNamingDomain;
  isValid: boolean;
  issues: TokenNamingIssue[];
  suggestedName: string | null;
}

const DEFAULT_RULES: TokenNamingRuleSet = {
  primitiveCategories: ["color", "space", "typography", "radius", "elevation", "border", "opacity", "motion", "z-index", "border-width", "icon-size", "breakpoint", "grid", "density"],
  semanticCategories: ["text", "surface", "icon", "action", "feedback", "field", "chart", "overlay", "stroke"],
  componentPrefix: "component",
  semanticPrefix: "semantic",
  separator: "/",
};

const COMMON_TYPOS: Record<string, string> = {
  typogrpahy: "typography",
  typographyy: "typography",
  eleveation: "elevation",
  elevetion: "elevation",
  bordre: "border",
  opactiy: "opacity",
  primitve: "primitive",
  componet: "component",
};

function normalizeSegment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[.\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeName(name: string, separator: string): string {
  return name
    .trim()
    .replace(/\s*\/\s*/g, separator)
    .split(separator)
    .map(normalizeSegment)
    .filter(Boolean)
    .join(separator);
}

function inferDomain(segments: string[], rules: TokenNamingRuleSet): TokenNamingDomain {
  if (segments.length === 0) return "unknown";
  if (rules.primitiveCategories.includes(segments[0])) return "primitive";
  if (segments[0] === rules.semanticPrefix) return "semantic";
  if (segments[0] === rules.componentPrefix || segments[0] === `${rules.componentPrefix}s`) return "component";
  if (rules.semanticCategories.includes(segments[0])) return "semantic";
  return "unknown";
}

function suggestSemanticPrefix(segments: string[], rules: TokenNamingRuleSet): string {
  if (segments[0] === rules.semanticPrefix) return segments.join(rules.separator);
  return [rules.semanticPrefix, ...segments].join(rules.separator);
}

function suggestComponentPrefix(segments: string[], rules: TokenNamingRuleSet): string {
  const withoutPlural = segments[0] === `${rules.componentPrefix}s` ? segments.slice(1) : segments;
  if (withoutPlural[0] === rules.componentPrefix) return withoutPlural.join(rules.separator);
  return [rules.componentPrefix, ...withoutPlural].join(rules.separator);
}

export function getDefaultTokenNamingRules(): TokenNamingRuleSet {
  return { ...DEFAULT_RULES };
}

export function analyzeTokenName(
  name: string,
  rules: TokenNamingRuleSet = DEFAULT_RULES
): TokenNamingAnalysis {
  const issues: TokenNamingIssue[] = [];
  const trimmed = name.trim();

  if (!trimmed) {
    return {
      originalName: name,
      normalizedName: "",
      domain: "unknown",
      isValid: false,
      issues: [{ severity: "error", code: "empty-name", message: "Token name cannot be empty." }],
      suggestedName: null,
    };
  }

  if (/[A-Z]/.test(trimmed)) {
    issues.push({ severity: "warning", code: "uppercase", message: "Use lowercase token names." });
  }
  if (/[^a-zA-Z0-9/_\-. ]/.test(trimmed)) {
    issues.push({
      severity: "error",
      code: "invalid-characters",
      message: "Use only letters, numbers, spaces, hyphens, underscores, dots, and slashes.",
    });
  }
  if (/\/{2,}/.test(trimmed)) {
    issues.push({
      severity: "error",
      code: "duplicate-separator",
      message: "Avoid duplicate path separators in token names.",
    });
  }

  const normalizedName = normalizeName(trimmed, rules.separator);
  const segments = normalizedName.split(rules.separator).filter(Boolean);

  for (const [typo, correction] of Object.entries(COMMON_TYPOS)) {
    if (segments.includes(typo)) {
      issues.push({
        severity: "warning",
        code: "typo",
        message: `Possible typo '${typo}'. Use '${correction}'.`,
      });
    }
  }

  if (segments.length < 2) {
    issues.push({
      severity: "warning",
      code: "short-name",
      message: "Token names should usually include at least category and item.",
    });
  }

  let domain = inferDomain(segments, rules);
  if (domain === "unknown") {
    issues.push({
      severity: "warning",
      code: "unknown-domain",
      message: "Token name does not match the primitive, semantic, or component naming grammar.",
    });
  }

  if (domain === "primitive" && !rules.primitiveCategories.includes(segments[0])) {
    issues.push({
      severity: "error",
      code: "unknown-primitive-category",
      message: `Unknown primitive category '${segments[0]}'.`,
    });
  }

  if (domain === "semantic" && segments[0] !== rules.semanticPrefix) {
    issues.push({
      severity: "warning",
      code: "semantic-prefix",
      message: `Semantic tokens should start with '${rules.semanticPrefix}/'.`,
    });
  }

  if (segments[0] === `${rules.componentPrefix}s`) {
    domain = "component";
    issues.push({
      severity: "warning",
      code: "component-prefix",
      message: `Prefer '${rules.componentPrefix}/' over '${rules.componentPrefix}s/'.`,
    });
  }

  let suggestedSegments = [...segments];
  suggestedSegments = suggestedSegments.map((segment) => COMMON_TYPOS[segment] ?? segment);

  if (rules.semanticCategories.includes(suggestedSegments[0])) {
    suggestedSegments = suggestSemanticPrefix(suggestedSegments, rules).split(rules.separator);
  } else if (suggestedSegments[0] === `${rules.componentPrefix}s`) {
    suggestedSegments = suggestComponentPrefix(suggestedSegments, rules).split(rules.separator);
  }

  const suggestedName = suggestedSegments.join(rules.separator);

  return {
    originalName: name,
    normalizedName,
    domain,
    isValid: issues.every((issue) => issue.severity !== "error"),
    issues,
    suggestedName: suggestedName !== normalizedName ? suggestedName : null,
  };
}

export function analyzeTokenNames(
  names: string[],
  rules: TokenNamingRuleSet = DEFAULT_RULES
): TokenNamingAnalysis[] {
  return names.map((name) => analyzeTokenName(name, rules));
}

// ─── Semantic Grammar Validation ─────────────────────────────────────────

import {
  getConceptById,
  getConceptIds,
  parseTokenName,
  generateTokenName as _generateTokenName,
  GRAMMAR,
} from "./concept-taxonomy.js";

export interface SemanticGrammarResult {
  isValid: boolean;
  issues: TokenNamingIssue[];
  parsed: {
    category: string;
    concept: string;
    variant: string | null;
    property: string;
    state: string | null;
  } | null;
}

/**
 * Validate a token name against the semantic grammar from the concept taxonomy.
 * Checks concept existence, state validity for that concept, and property validity.
 */
export function validateSemanticGrammar(name: string): SemanticGrammarResult {
  const issues: TokenNamingIssue[] = [];
  const parsed = parseTokenName(name);

  if (!parsed) {
    return { isValid: true, issues: [], parsed: null };
  }

  const { concept, state } = parsed;

  // Check if concept is known in taxonomy
  const knownConcepts = new Set(getConceptIds());
  // Also check plural forms (e.g., "actions" → "action")
  const conceptSingular = concept.replace(/s$/, "");
  const matchedConcept = knownConcepts.has(concept)
    ? concept
    : knownConcepts.has(conceptSingular)
      ? conceptSingular
      : null;

  if (!matchedConcept && concept !== "primitive" && concept !== "semantic") {
    // Only warn — many tokens use categories/subcategories that aren't concepts
    // (e.g., "color/semantic/text/primary" where "text" is a sub-group, not a concept per se)
    const conceptDef = getConceptById(concept) ?? getConceptById(conceptSingular);
    if (!conceptDef) {
      // Soft warning — don't block tokens that follow the existing convention
      issues.push({
        severity: "warning",
        code: "unknown-concept",
        message: `Concept '${concept}' is not in the taxonomy. Known concepts: ${[...knownConcepts].slice(0, 8).join(", ")}...`,
      });
    }
  }

  // Check if state is valid for this concept
  if (state && matchedConcept) {
    const conceptDef = getConceptById(matchedConcept);
    if (conceptDef && conceptDef.validStates.length > 0) {
      if (!conceptDef.validStates.includes(state)) {
        issues.push({
          severity: "warning",
          code: "invalid-state-for-concept",
          message: `State '${state}' is not valid for concept '${matchedConcept}'. Valid states: ${conceptDef.validStates.join(", ")}.`,
        });
      }
    }
  }

  return {
    isValid: issues.every((i) => i.severity !== "error"),
    issues,
    parsed,
  };
}

/**
 * Convenience wrapper for generating token names following the grammar.
 */
export { _generateTokenName as generateTokenName };

// ─── Advanced Validation ───────────────────────────────────────────────────

export interface TokenGraphNode {
  id: string;
  name: string;
  aliasTarget?: string; // variable ID this aliases to
}

export interface CircularRefResult {
  hasCircular: boolean;
  cycles: string[][]; // each cycle is an array of token names
}

/**
 * Detect circular references in token alias chains.
 * Takes a map of variable ID → { name, aliasTarget (variable ID) }.
 * Returns all cycles found via DFS.
 */
export function detectCircularAliases(tokens: Map<string, TokenGraphNode>): CircularRefResult {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(id: string, path: string[]): void {
    if (inStack.has(id)) {
      // Found a cycle — extract it from the path
      const node = tokens.get(id);
      const cycleName = node?.name ?? id;
      const cycleStart = path.indexOf(cycleName);
      if (cycleStart >= 0) {
        cycles.push(path.slice(cycleStart).concat(cycleName));
      } else {
        cycles.push([...path, cycleName]);
      }
      return;
    }
    if (visited.has(id)) return;

    const node = tokens.get(id);
    if (!node) return;

    visited.add(id);
    inStack.add(id);

    if (node.aliasTarget && tokens.has(node.aliasTarget)) {
      dfs(node.aliasTarget, [...path, node.name]);
    }

    inStack.delete(id);
  }

  for (const id of tokens.keys()) {
    if (!visited.has(id)) {
      dfs(id, []);
    }
  }

  return { hasCircular: cycles.length > 0, cycles };
}

export interface CrossModeIssue {
  tokenName: string;
  collection: string;
  presentModes: string[];
  missingModes: string[];
}

/**
 * Check cross-mode consistency: find tokens that exist in some modes but not others.
 * Takes raw Figma variable collections.
 */
export function detectCrossModeGaps(
  collections: Array<{
    name: string;
    modes: Array<{ modeId: string; name: string }>;
    variables: Array<{
      name: string;
      valuesByMode: Record<string, unknown>;
    }>;
  }>
): CrossModeIssue[] {
  const issues: CrossModeIssue[] = [];

  for (const coll of collections) {
    const allModeIds = coll.modes.map(m => m.modeId);
    const modeNameMap = new Map(coll.modes.map(m => [m.modeId, m.name]));

    for (const variable of coll.variables) {
      const presentModeIds = Object.keys(variable.valuesByMode).filter(
        mid => variable.valuesByMode[mid] !== undefined && variable.valuesByMode[mid] !== null
      );
      const missingModeIds = allModeIds.filter(mid => !presentModeIds.includes(mid));

      if (missingModeIds.length > 0 && presentModeIds.length > 0) {
        issues.push({
          tokenName: variable.name,
          collection: coll.name,
          presentModes: presentModeIds.map(mid => modeNameMap.get(mid) ?? mid),
          missingModes: missingModeIds.map(mid => modeNameMap.get(mid) ?? mid),
        });
      }
    }
  }

  return issues;
}

export interface OrphanTokenResult {
  tokenName: string;
  collection: string;
  type: string;
  isReferenced: boolean; // is this token aliased by another token?
}

/**
 * Find orphan tokens — tokens that are neither bound to any node
 * nor referenced as aliases by other tokens.
 * Takes collections and a set of used variable IDs from the file.
 */
export function findOrphanTokens(
  collections: Array<{
    name: string;
    variables: Array<{
      id: string;
      name: string;
      resolvedType: string;
      valuesByMode: Record<string, unknown>;
    }>;
  }>,
  usedVariableIds: Set<string>
): OrphanTokenResult[] {
  // Build set of IDs that are alias targets
  const aliasTargetIds = new Set<string>();
  for (const coll of collections) {
    for (const v of coll.variables) {
      for (const val of Object.values(v.valuesByMode)) {
        if (val && typeof val === "object" && "type" in (val as Record<string, unknown>)) {
          const alias = val as { type: string; id?: string };
          if (alias.type === "VARIABLE_ALIAS" && alias.id) {
            aliasTargetIds.add(alias.id);
          }
        }
      }
    }
  }

  const orphans: OrphanTokenResult[] = [];
  for (const coll of collections) {
    for (const v of coll.variables) {
      if (!usedVariableIds.has(v.id) && !aliasTargetIds.has(v.id)) {
        orphans.push({
          tokenName: v.name,
          collection: coll.name,
          type: v.resolvedType,
          isReferenced: false,
        });
      }
    }
  }

  return orphans;
}
