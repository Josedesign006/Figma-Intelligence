// DTCG v2025.10 Specification Validator
// Validates design token files against the W3C Design Token Community Group format

export interface DtcgValidationIssue {
  path: string;
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface DtcgValidationResult {
  valid: boolean;
  issues: DtcgValidationIssue[];
  stats: {
    totalTokens: number;
    totalGroups: number;
    tokensByType: Record<string, number>;
    hasTypeInheritance: boolean;
    hasDeprecatedTokens: boolean;
    aliasCount: number;
    circularReferences: string[];
  };
}

// Valid DTCG token types per v2025.10
export const DTCG_TOKEN_TYPES = [
  "color", "dimension", "fontFamily", "fontWeight", "duration",
  "cubicBezier", "number", "string", "boolean",
  // Composite types
  "shadow", "strokeStyle", "border", "transition", "gradient", "typography"
] as const;

export type DtcgTokenType = typeof DTCG_TOKEN_TYPES[number];

const VALID_DOLLAR_PROPS = new Set([
  "$value", "$type", "$description", "$deprecated", "$extensions"
]);

const FONT_WEIGHT_KEYWORDS = new Set([
  "thin", "hairline", "extra-light", "ultra-light", "light",
  "normal", "regular", "medium", "semi-bold", "demi-bold",
  "bold", "extra-bold", "ultra-bold", "black", "heavy", "extra-black", "ultra-black"
]);

// ---------------------------------------------------------------------------
// Alias utilities
// ---------------------------------------------------------------------------

const ALIAS_REGEX = /^\{([^}]+)\}$/;

function isAlias(value: unknown): value is string {
  return typeof value === "string" && ALIAS_REGEX.test(value);
}

function parseAliasPath(alias: string): string[] {
  const match = alias.match(ALIAS_REGEX);
  return match ? match[1].split(".") : [];
}

function resolveNode(
  root: Record<string, unknown>,
  segments: string[]
): unknown | undefined {
  let cur: unknown = root;
  for (const seg of segments) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function isTokenNode(node: unknown): node is Record<string, unknown> {
  return (
    node !== null &&
    typeof node === "object" &&
    !Array.isArray(node) &&
    "$value" in (node as Record<string, unknown>)
  );
}

// ---------------------------------------------------------------------------
// resolveInheritedType
// ---------------------------------------------------------------------------

export function resolveInheritedType(
  tokens: Record<string, unknown>,
  path: string[]
): DtcgTokenType | null {
  // Walk from the deepest node upward looking for $type
  for (let depth = path.length; depth >= 0; depth--) {
    const segments = path.slice(0, depth);
    const node = segments.length === 0 ? tokens : resolveNode(tokens, segments);
    if (node && typeof node === "object" && !Array.isArray(node)) {
      const t = (node as Record<string, unknown>)["$type"];
      if (typeof t === "string") {
        return DTCG_TOKEN_TYPES.includes(t as DtcgTokenType)
          ? (t as DtcgTokenType)
          : null;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// validateTokenValue
// ---------------------------------------------------------------------------

export function validateTokenValue(
  value: unknown,
  type: DtcgTokenType
): DtcgValidationIssue[] {
  const issues: DtcgValidationIssue[] = [];

  // Aliases are always structurally valid at this level – reference resolution
  // is checked elsewhere.
  if (isAlias(value)) return issues;

  const err = (code: string, message: string) =>
    issues.push({ path: "", severity: "error", code, message });

  switch (type) {
    // -- color --
    case "color": {
      if (typeof value === "string") break; // CSS color string
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const v = value as Record<string, unknown>;
        if (!("colorSpace" in v)) err("color.missing-colorSpace", "Color object must have colorSpace");
        if (!("components" in v)) err("color.missing-components", "Color object must have components");
        // alpha is optional per spec
      } else {
        err("color.invalid", "Color must be a string or {colorSpace, components, alpha} object");
      }
      break;
    }

    // -- dimension --
    case "dimension": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        err("dimension.invalid", "Dimension must be {value, unit}");
        break;
      }
      const v = value as Record<string, unknown>;
      if (typeof v.value !== "number") err("dimension.value", "Dimension value must be a number");
      if (v.unit !== "px" && v.unit !== "rem") err("dimension.unit", 'Dimension unit must be "px" or "rem"');
      break;
    }

    // -- fontFamily --
    case "fontFamily": {
      if (typeof value === "string") break;
      if (Array.isArray(value) && value.every((v) => typeof v === "string")) break;
      err("fontFamily.invalid", "fontFamily must be a string or string[]");
      break;
    }

    // -- fontWeight --
    case "fontWeight": {
      if (typeof value === "number") {
        if (value < 1 || value > 1000) {
          err("fontWeight.range", "fontWeight number must be 1-1000");
        }
        break;
      }
      if (typeof value === "string") {
        if (!FONT_WEIGHT_KEYWORDS.has(value.toLowerCase())) {
          err("fontWeight.keyword", `Unknown fontWeight keyword "${value}"`);
        }
        break;
      }
      err("fontWeight.invalid", "fontWeight must be a number (1-1000) or keyword string");
      break;
    }

    // -- duration --
    case "duration": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        err("duration.invalid", "Duration must be {value, unit}");
        break;
      }
      const v = value as Record<string, unknown>;
      if (typeof v.value !== "number") err("duration.value", "Duration value must be a number");
      if (v.unit !== "ms" && v.unit !== "s") err("duration.unit", 'Duration unit must be "ms" or "s"');
      break;
    }

    // -- cubicBezier --
    case "cubicBezier": {
      if (!Array.isArray(value) || value.length !== 4 || !value.every((n) => typeof n === "number")) {
        err("cubicBezier.invalid", "cubicBezier must be [number, number, number, number]");
      }
      break;
    }

    // -- number --
    case "number": {
      if (typeof value !== "number") err("number.invalid", "number token must have a numeric $value");
      break;
    }

    // -- string --
    case "string": {
      if (typeof value !== "string") err("string.invalid", "string token must have a string $value");
      break;
    }

    // -- boolean --
    case "boolean": {
      if (typeof value !== "boolean") err("boolean.invalid", "boolean token must have a boolean $value");
      break;
    }

    // -- shadow --
    case "shadow": {
      const check = (obj: unknown) => {
        if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
          err("shadow.invalid", "shadow must be an object with {color, offsetX, offsetY, blur, spread}");
          return;
        }
        const v = obj as Record<string, unknown>;
        for (const k of ["color", "offsetX", "offsetY", "blur", "spread"]) {
          if (!(k in v)) err(`shadow.missing-${k}`, `shadow is missing "${k}"`);
        }
      };
      // Shadow can be a single object or an array of shadows
      if (Array.isArray(value)) {
        value.forEach(check);
      } else {
        check(value);
      }
      break;
    }

    // -- border --
    case "border": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        err("border.invalid", "border must be {color, width, style}");
        break;
      }
      const v = value as Record<string, unknown>;
      for (const k of ["color", "width", "style"]) {
        if (!(k in v)) err(`border.missing-${k}`, `border is missing "${k}"`);
      }
      break;
    }

    // -- gradient --
    case "gradient": {
      if (!Array.isArray(value)) {
        err("gradient.invalid", "gradient must be an array of {color, position} stops");
        break;
      }
      for (let i = 0; i < value.length; i++) {
        const stop = value[i];
        if (typeof stop !== "object" || stop === null || Array.isArray(stop)) {
          err("gradient.stop", `gradient stop[${i}] must be an object`);
          continue;
        }
        const s = stop as Record<string, unknown>;
        if (!("color" in s)) err("gradient.stop.color", `gradient stop[${i}] missing "color"`);
        if (!("position" in s)) err("gradient.stop.position", `gradient stop[${i}] missing "position"`);
      }
      break;
    }

    // -- typography --
    case "typography": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        err("typography.invalid", "typography must be {fontFamily, fontSize, fontWeight, letterSpacing, lineHeight}");
        break;
      }
      const v = value as Record<string, unknown>;
      for (const k of ["fontFamily", "fontSize", "fontWeight", "letterSpacing", "lineHeight"]) {
        if (!(k in v)) err(`typography.missing-${k}`, `typography is missing "${k}"`);
      }
      break;
    }

    // -- transition --
    case "transition": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        err("transition.invalid", "transition must be {duration, delay, timingFunction}");
        break;
      }
      const v = value as Record<string, unknown>;
      for (const k of ["duration", "delay", "timingFunction"]) {
        if (!(k in v)) err(`transition.missing-${k}`, `transition is missing "${k}"`);
      }
      break;
    }

    // -- strokeStyle --
    case "strokeStyle": {
      if (typeof value === "string") break;
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const v = value as Record<string, unknown>;
        if (!("dashArray" in v)) err("strokeStyle.missing-dashArray", 'strokeStyle object must have "dashArray"');
        if (!("lineCap" in v)) err("strokeStyle.missing-lineCap", 'strokeStyle object must have "lineCap"');
      } else {
        err("strokeStyle.invalid", "strokeStyle must be a string or {dashArray, lineCap}");
      }
      break;
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// detectCircularReferences
// ---------------------------------------------------------------------------

export function detectCircularReferences(tokens: Record<string, unknown>): string[] {
  const circular: string[] = [];

  // Build a map of alias edges: tokenPath -> referencedPath
  const aliasEdges = new Map<string, string>();

  function collectAliases(node: unknown, path: string[]) {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return;
    const obj = node as Record<string, unknown>;

    if ("$value" in obj) {
      const val = obj["$value"];
      if (isAlias(val)) {
        aliasEdges.set(path.join("."), parseAliasPath(val).join("."));
      }
      return; // token leaf
    }

    for (const [key, child] of Object.entries(obj)) {
      if (key.startsWith("$")) continue;
      collectAliases(child, [...path, key]);
    }
  }

  collectAliases(tokens, []);

  // DFS cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string) {
    if (inStack.has(node)) {
      circular.push(node);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    const next = aliasEdges.get(node);
    if (next) dfs(next);
    inStack.delete(node);
  }

  for (const key of aliasEdges.keys()) {
    dfs(key);
  }

  return circular;
}

// ---------------------------------------------------------------------------
// validateDtcg (main entry)
// ---------------------------------------------------------------------------

export function validateDtcg(tokens: Record<string, unknown>): DtcgValidationResult {
  const issues: DtcgValidationIssue[] = [];
  let totalTokens = 0;
  let totalGroups = 0;
  const tokensByType: Record<string, number> = {};
  let hasTypeInheritance = false;
  let hasDeprecatedTokens = false;
  let aliasCount = 0;

  function walk(node: unknown, path: string[]) {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return;
    const obj = node as Record<string, unknown>;
    const pathStr = path.join(".");

    // Check for unknown $-prefixed properties
    for (const key of Object.keys(obj)) {
      if (key.startsWith("$") && !VALID_DOLLAR_PROPS.has(key)) {
        issues.push({
          path: pathStr,
          severity: "warning",
          code: "unknown-dollar-prop",
          message: `Unknown $-prefixed property "${key}"`
        });
      }
    }

    // --- Token node ---
    if ("$value" in obj) {
      totalTokens++;

      // $deprecated check
      if ("$deprecated" in obj) {
        hasDeprecatedTokens = true;
        const dep = obj["$deprecated"];
        if (typeof dep !== "boolean" && typeof dep !== "string") {
          issues.push({
            path: pathStr,
            severity: "error",
            code: "deprecated.invalid",
            message: "$deprecated must be a boolean or string"
          });
        }
      }

      // Resolve type (direct or inherited)
      const directType = obj["$type"] as string | undefined;
      const inheritedType = resolveInheritedType(tokens, path);

      if (!directType && inheritedType) {
        hasTypeInheritance = true;
      }

      const effectiveType = (directType || inheritedType) as DtcgTokenType | null;

      if (!effectiveType) {
        issues.push({
          path: pathStr,
          severity: "error",
          code: "missing-type",
          message: "Token has no $type (directly or inherited)"
        });
      } else if (!DTCG_TOKEN_TYPES.includes(effectiveType as DtcgTokenType)) {
        issues.push({
          path: pathStr,
          severity: "error",
          code: "invalid-type",
          message: `Unknown $type "${effectiveType}"`
        });
      } else {
        // Count by type
        tokensByType[effectiveType] = (tokensByType[effectiveType] || 0) + 1;

        // Validate $value structure
        const val = obj["$value"];
        if (isAlias(val)) {
          aliasCount++;
          // Check alias target exists
          const targetSegments = parseAliasPath(val);
          const target = resolveNode(tokens, targetSegments);
          if (target === undefined) {
            issues.push({
              path: pathStr,
              severity: "error",
              code: "alias.unresolved",
              message: `Alias "${val}" references non-existent token`
            });
          }
        } else {
          const valueIssues = validateTokenValue(val, effectiveType);
          for (const vi of valueIssues) {
            issues.push({ ...vi, path: pathStr });
          }
        }
      }

      return; // don't descend into token children
    }

    // --- Group node ---
    // Count only non-root groups
    if (path.length > 0) {
      totalGroups++;
    }

    // Validate group $type if present
    if ("$type" in obj) {
      const gt = obj["$type"] as string;
      if (!DTCG_TOKEN_TYPES.includes(gt as DtcgTokenType)) {
        issues.push({
          path: pathStr,
          severity: "error",
          code: "invalid-type",
          message: `Unknown $type "${gt}" on group`
        });
      }
    }

    // $deprecated on groups
    if ("$deprecated" in obj) {
      hasDeprecatedTokens = true;
      const dep = obj["$deprecated"];
      if (typeof dep !== "boolean" && typeof dep !== "string") {
        issues.push({
          path: pathStr,
          severity: "error",
          code: "deprecated.invalid",
          message: "$deprecated must be a boolean or string"
        });
      }
    }

    // Recurse into child groups/tokens
    for (const [key, child] of Object.entries(obj)) {
      if (key.startsWith("$")) continue;
      walk(child, [...path, key]);
    }
  }

  walk(tokens, []);

  const circularReferences = detectCircularReferences(tokens);
  for (const ref of circularReferences) {
    issues.push({
      path: ref,
      severity: "error",
      code: "alias.circular",
      message: `Circular alias reference detected at "${ref}"`
    });
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    stats: {
      totalTokens,
      totalGroups,
      tokensByType,
      hasTypeInheritance,
      hasDeprecatedTokens,
      aliasCount,
      circularReferences
    }
  };
}
