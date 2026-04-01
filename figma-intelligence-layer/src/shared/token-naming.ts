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
    | "short-name";
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
