import { ComponentSet, FigmaNode, Token } from "./types.js";

export interface DSVariantSchema {
  properties: Record<string, string[]>;
  required?: string[];
}

export interface NamingRuleInput {
  kind: "component" | "token" | "style";
  name: string;
}

export interface NamingRule {
  kind: "component" | "token" | "style";
  pattern: string;
  examples: string[];
}

const INTENT_RULES: Array<{ intent: string; patterns: RegExp[] }> = [
  { intent: "primary-action", patterns: [/\bprimary\b/, /\bcta\b/, /\bsubmit\b/, /\bconfirm\b/] },
  { intent: "secondary-action", patterns: [/\bsecondary\b/, /\bghost\b/, /\btertiary\b/] },
  { intent: "input-field", patterns: [/\binput\b/, /\bfield\b/, /\btextbox\b/, /\btext field\b/] },
  { intent: "navigation-item", patterns: [/\bnav\b/, /\bnavigation\b/, /\bmenu\b/, /\btab\b/] },
  { intent: "modal", patterns: [/\bmodal\b/, /\bdialog\b/, /\bsheet\b/] },
  { intent: "card", patterns: [/\bcard\b/, /\bpanel\b/, /\btile\b/] },
  { intent: "page-header", patterns: [/\bheader\b/, /\bhero\b/, /\bpage title\b/] },
  { intent: "icon", patterns: [/\bicon\b/, /\blogo\b/, /\bglyph\b/, /\bsymbol\b/] },
  { intent: "button", patterns: [/\bbutton\b/, /\bbtn\b/] },
];

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\/:,_=-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseVariantPropsFromName(name: string): Record<string, string> {
  const entries = name
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [key, value] = part.split("=").map((piece) => piece.trim());
      return key && value ? [normalizeName(key), normalizeName(value)] : null;
    })
    .filter((entry): entry is [string, string] => entry !== null);

  return Object.fromEntries(entries);
}

function pushUnique(values: string[], nextValue: string) {
  if (!values.includes(nextValue)) {
    values.push(nextValue);
  }
}

export function inferVariantSchema(componentSet: ComponentSet): DSVariantSchema | undefined {
  const properties = new Map<string, string[]>();

  for (const [name, property] of Object.entries(componentSet.variantGroupProperties || {})) {
    const normalizedProperty = normalizeName(name);
    const values = Array.isArray(property?.values) ? property.values : [];
    if (!properties.has(normalizedProperty)) {
      properties.set(normalizedProperty, []);
    }
    for (const value of values) {
      const normalizedValue = normalizeName(value);
      if (normalizedValue) {
        pushUnique(properties.get(normalizedProperty) ?? [], normalizedValue);
      }
    }
  }

  for (const child of componentSet.children || []) {
    const variantProps = parseVariantPropsFromName(child.name);
    for (const [property, value] of Object.entries(variantProps)) {
      if (!properties.has(property)) {
        properties.set(property, []);
      }
      pushUnique(properties.get(property) ?? [], value);
    }
  }

  if (properties.size === 0) {
    return undefined;
  }

  return {
    properties: Object.fromEntries(
      Array.from(properties.entries()).map(([property, values]) => [property, values.sort()])
    ),
  };
}

export function inferComponentIntents(name: string, description?: string): string[] {
  const corpus = `${normalizeName(name)} ${normalizeName(description ?? "")}`.trim();
  const intents = new Set<string>();

  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(corpus))) {
      intents.add(rule.intent);
    }
  }

  if (corpus.includes("primary")) {
    intents.add("button");
  }

  return Array.from(intents);
}

export function inferTokenSemanticGroup(token: Token): string | undefined {
  const normalized = normalizeName(token.name);

  if (/\b(background|surface|bg)\b/.test(normalized)) return "color.background";
  if (/\b(text|foreground|fg)\b/.test(normalized)) return "color.text";
  if (/\b(border|stroke|outline|separator|divider)\b/.test(normalized)) return "color.border";
  if (token.type === "COLOR") return "color.generic";
  if (/\b(space|spacing|gap|padding|margin|inset)\b/.test(normalized)) return "space";
  if (/\b(radius|rounded|corner)\b/.test(normalized)) return "radius";
  if (/\b(font family|font-family|typeface)\b/.test(normalized)) return "typography.fontFamily";
  if (/\b(font size|font-size|size)\b/.test(normalized) && token.type === "FLOAT") {
    return "typography.fontSize";
  }
  if (/\b(line height|leading)\b/.test(normalized)) return "typography.lineHeight";
  if (/\b(letter spacing|tracking)\b/.test(normalized)) return "typography.letterSpacing";

  return undefined;
}

export function inferStyleSemanticGroup(name: string, styleType: string): string | undefined {
  const normalized = normalizeName(name);

  if (styleType === "TEXT") {
    if (/\bheading|title|display\b/.test(normalized)) return "typography.heading";
    if (/\bbody|paragraph|copy\b/.test(normalized)) return "typography.body";
    return "typography";
  }

  if (styleType === "PAINT") {
    if (/\b(background|surface)\b/.test(normalized)) return "color.background";
    if (/\b(border|stroke|outline)\b/.test(normalized)) return "color.border";
    return "color";
  }

  if (styleType === "EFFECT") return "effect";
  if (styleType === "GRID") return "layout.grid";

  return undefined;
}

function inferPattern(name: string): string {
  if (name.includes("/")) return "slash";
  if (name.includes(",")) return "variant-csv";
  if (name.includes("_")) return "snake_case";
  if (name.includes("-")) return "kebab-case";
  return "space";
}

export function inferNamingRules(inputs: NamingRuleInput[]): NamingRule[] {
  const grouped = new Map<string, string[]>();

  for (const input of inputs) {
    const key = `${input.kind}:${inferPattern(input.name)}`;
    const examples = grouped.get(key) ?? [];
    if (examples.length < 3) {
      examples.push(input.name);
      grouped.set(key, examples);
    }
  }

  return Array.from(grouped.entries()).map(([key, examples]) => {
    const [kind, pattern] = key.split(":") as [NamingRule["kind"], string];
    return { kind, pattern, examples };
  });
}

export function componentNameVariants(name: string): string[] {
  const normalized = normalizeName(name);
  const compact = normalized.replace(/\s+/g, "");
  const variants = new Set<string>([normalized, compact]);

  for (const token of normalized.split(" ")) {
    if (token) {
      variants.add(token);
    }
  }

  return Array.from(variants);
}

export function firstComponentChildId(node: FigmaNode[] | undefined): string | undefined {
  return node?.[0]?.id;
}
