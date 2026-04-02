// ─────────────────────────────────────────────────────────────────────────────
// figma_export_tokens — Export Figma variables to code-ready formats
//
// Reads all variables from the connected Figma file via the bridge and exports
// them as CSS custom properties, SCSS, Tailwind config, Style Dictionary JSON,
// DTCG (W3C Design Token Community Group) JSON, Swift, Kotlin, Flutter, Android
// XML, JS, TS, Less, React Native, Tailwind v4, CSS rem, or plain JSON.
//
// Falls back to the built-in semantic token catalog when no Figma connection
// is available, so specs and code can still be generated offline.
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";
import { SEMANTIC_TOKEN_CATALOG, SemanticTokenEntry } from "../../../shared/semantic-token-catalog.js";
import { figmaRgbaToHex } from "../../../shared/token-utils.js";
import { formatCssColor } from "../../../shared/color-operations.js";
import { pxToRem } from "../../../shared/token-math.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExportTokensArgs {
  format:
    | "css"
    | "scss"
    | "tailwind"
    | "style-dictionary"
    | "dtcg"
    | "swift"
    | "kotlin"
    | "json"
    | "flutter"
    | "android-xml"
    | "js"
    | "ts"
    | "less"
    | "react-native"
    | "tailwind-v4"
    | "css-rem"
    | "all";
  /** Filter by collection name (substring match, case-insensitive) */
  collectionFilter?: string;
  /** Filter by token type */
  tokenTypes?: Array<"COLOR" | "FLOAT" | "STRING" | "BOOLEAN">;
  /** Which mode to export (e.g. "Light", "Dark"). Exports all modes if omitted. */
  mode?: string;
  /** Include alias chain comments showing semantic → primitive → raw */
  includeAliasChains?: boolean;
  /** CSS selector to wrap custom properties in (default ":root") */
  cssSelector?: string;
  /** Tailwind: prefix for custom token keys (default "ds") */
  tailwindPrefix?: string;
  /** Base font size for rem conversion (default 16) */
  remBase?: number;
  /** Include $deprecated field in DTCG output (default true) */
  deprecated?: boolean;
  /** Color space for DTCG output */
  colorSpace?: "srgb" | "display-p3" | "oklch";
}

interface NormalizedToken {
  name: string;
  cssName: string;
  type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  collection: string;
  description: string;
  values: Record<string, string | number | boolean>;
  aliasOf?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function tokenNameToCssVar(name: string): string {
  return "--" + name
    .replace(/\//g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-_]/g, "")
    .toLowerCase();
}

function tokenNameToSwiftCase(name: string): string {
  const parts = name.replace(/\//g, "-").replace(/\s+/g, "-").split("-").filter(Boolean);
  return parts
    .map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join("");
}

function tokenNameToKotlinCase(name: string): string {
  const parts = name.replace(/\//g, "-").replace(/\s+/g, "-").split("-").filter(Boolean);
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("");
}

function tokenNameToCamelCase(name: string): string {
  const parts = name
    .replace(/\//g, "-")
    .replace(/\s+/g, "-")
    .split("-")
    .filter(Boolean);
  return parts
    .map((p, i) => (i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join("");
}

function tokenNameToSnakeCase(name: string): string {
  return name
    .replace(/\//g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function tokenNameToDtcgPath(name: string): string[] {
  return name.split("/").map((s) => s.trim()).filter(Boolean);
}

function figmaColorToHex(color: Record<string, number>): string {
  const r = color.r ?? 0;
  const g = color.g ?? 0;
  const b = color.b ?? 0;
  const a = color.a ?? 1;
  const hex = figmaRgbaToHex(r, g, b);
  if (a < 1) {
    const alpha = Math.round(a * 255).toString(16).padStart(2, "0");
    return hex + alpha;
  }
  return hex;
}

function resolveValue(raw: unknown, type: string): string | number | boolean {
  if (raw === null || raw === undefined) return type === "COLOR" ? "#000000" : 0;

  // Figma color object {r, g, b, a} with 0-1 range
  if (type === "COLOR" && typeof raw === "object" && raw !== null && "r" in raw) {
    return figmaColorToHex(raw as Record<string, number>);
  }

  // Variable alias {type: "VARIABLE_ALIAS", id: "..."}
  if (typeof raw === "object" && raw !== null && "type" in raw) {
    const alias = raw as { type: string; id?: string };
    if (alias.type === "VARIABLE_ALIAS" && alias.id) {
      return `alias:${alias.id}`;
    }
  }

  if (typeof raw === "number" || typeof raw === "string" || typeof raw === "boolean") {
    return raw;
  }

  return String(raw);
}

// ─── DTCG composite type parsers ───────────────────────────────────────────

function parseShadowString(val: string): Record<string, unknown> {
  // Parse CSS shadow: "offsetX offsetY blur spread color" or "offsetX offsetY blur color"
  const parts = val.trim().split(/\s+/);
  if (parts.length >= 4) {
    const color = parts.slice(3).join(" ") || parts[parts.length - 1];
    return {
      offsetX: { value: parseFloat(parts[0]) || 0, unit: "px" },
      offsetY: { value: parseFloat(parts[1]) || 0, unit: "px" },
      blur: { value: parseFloat(parts[2]) || 0, unit: "px" },
      spread: { value: parts.length >= 5 ? parseFloat(parts[3]) || 0 : 0, unit: "px" },
      color: parts.length >= 5 ? parts.slice(4).join(" ") || parts[4] : color,
    };
  }
  return {
    offsetX: { value: 0, unit: "px" },
    offsetY: { value: 0, unit: "px" },
    blur: { value: 0, unit: "px" },
    spread: { value: 0, unit: "px" },
    color: val,
  };
}

function parseCubicBezierString(val: string): number[] {
  // Parse "cubic-bezier(P1x, P1y, P2x, P2y)" or just "P1x, P1y, P2x, P2y"
  const match = val.match(/cubic-bezier\(\s*([^)]+)\s*\)/i);
  const inner = match ? match[1] : val;
  const nums = inner.split(",").map((s) => parseFloat(s.trim()));
  if (nums.length === 4 && nums.every((n) => !isNaN(n))) {
    return nums;
  }
  return [0, 0, 1, 1]; // linear fallback
}

function parseTypographyString(val: string): Record<string, unknown> {
  // Best-effort parse of typography composite strings
  return {
    fontFamily: val,
    fontSize: { value: 16, unit: "px" },
    fontWeight: 400,
    letterSpacing: { value: 0, unit: "px" },
    lineHeight: { value: 1.5, unit: "px" },
  };
}

function parseBorderString(val: string): Record<string, unknown> {
  // Parse "width style color" e.g. "1px solid #000"
  const parts = val.trim().split(/\s+/);
  return {
    width: { value: parseFloat(parts[0]) || 1, unit: "px" },
    style: parts[1] || "solid",
    color: parts.slice(2).join(" ") || "#000000",
  };
}

function parseGradientString(val: string): Array<Record<string, unknown>> {
  // Best-effort gradient stop parse
  const match = val.match(/linear-gradient\(\s*([^)]+)\s*\)/i);
  if (!match) return [{ color: val, position: 0 }];
  const inner = match[1];
  const stopParts = inner.split(",").map((s) => s.trim());
  const stops: Array<Record<string, unknown>> = [];
  for (const part of stopParts) {
    const m = part.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s*(\d+%)?/);
    if (m) {
      stops.push({
        color: m[1],
        position: m[2] ? parseFloat(m[2]) / 100 : stops.length === 0 ? 0 : 1,
      });
    }
  }
  return stops.length > 0 ? stops : [{ color: val, position: 0 }];
}

function parseTransitionString(val: string): Record<string, unknown> {
  // Parse "duration delay timingFunction" e.g. "200ms 0ms ease-in-out"
  const parts = val.trim().split(/\s+/);
  return {
    duration: { value: parseFloat(parts[0]) || 200, unit: "ms" },
    delay: { value: parts.length > 1 ? parseFloat(parts[1]) || 0 : 0, unit: "ms" },
    timingFunction: parts.length > 2 ? parseCubicBezierString(parts.slice(2).join(" ")) : [0, 0, 1, 1],
  };
}

// ─── Figma variable fetcher ─────────────────────────────────────────────────

async function fetchFigmaTokens(args: ExportTokensArgs): Promise<NormalizedToken[]> {
  const bridge = await getBridge();
  const rawVars = (await bridge.getVariables(undefined, "full")) as unknown as {
    collections: Array<{
      id: string;
      name: string;
      modes: Array<{ modeId: string; name: string }>;
      variables: Array<{
        id: string;
        name: string;
        resolvedType: string;
        description?: string;
        valuesByMode: Record<string, unknown>;
        aliasOf?: string;
      }>;
    }>;
  };

  if (!rawVars?.collections?.length) return [];

  const tokens: NormalizedToken[] = [];
  const collFilter = args.collectionFilter?.toLowerCase();

  for (const coll of rawVars.collections) {
    if (collFilter && !coll.name.toLowerCase().includes(collFilter)) continue;

    const modeMap = new Map(coll.modes.map((m) => [m.modeId, m.name]));

    for (const v of coll.variables) {
      const type = v.resolvedType as NormalizedToken["type"];
      if (args.tokenTypes?.length && !args.tokenTypes.includes(type)) continue;

      const values: Record<string, string | number | boolean> = {};

      for (const [modeId, rawVal] of Object.entries(v.valuesByMode)) {
        const modeName = modeMap.get(modeId) ?? modeId;
        if (args.mode && modeName.toLowerCase() !== args.mode.toLowerCase()) continue;
        values[modeName] = resolveValue(rawVal, type);
      }

      if (Object.keys(values).length === 0) continue;

      tokens.push({
        name: v.name,
        cssName: tokenNameToCssVar(v.name),
        type,
        collection: coll.name,
        description: v.description ?? "",
        values,
        aliasOf: v.aliasOf,
      });
    }
  }

  return tokens;
}

// ─── Catalog fallback ───────────────────────────────────────────────────────

function catalogToTokens(args: ExportTokensArgs): NormalizedToken[] {
  return SEMANTIC_TOKEN_CATALOG
    .filter((entry) => {
      if (args.tokenTypes?.length && !args.tokenTypes.includes(entry.type)) return false;
      if (args.collectionFilter && !entry.category.toLowerCase().includes(args.collectionFilter.toLowerCase())) return false;
      return true;
    })
    .map((entry) => {
      const values: Record<string, string | number | boolean> = {};

      if (!args.mode || args.mode.toLowerCase() === "light") {
        values["Light"] = parseCatalogRef(entry.lightRef, entry.type);
      }
      if (!args.mode || args.mode.toLowerCase() === "dark") {
        values["Dark"] = parseCatalogRef(entry.darkRef, entry.type);
      }

      return {
        name: entry.name,
        cssName: tokenNameToCssVar(entry.name),
        type: entry.type,
        collection: `Semantic/${entry.category}`,
        description: entry.description,
        values,
        aliasOf: entry.lightRef.includes("/") ? entry.lightRef : undefined,
      };
    });
}

function parseCatalogRef(ref: string, type: string): string | number {
  if (type === "FLOAT") {
    const num = parseFloat(ref);
    return isNaN(num) ? ref : num;
  }
  return ref;
}

// ─── Format generators ──────────────────────────────────────────────────────

function generateCSS(tokens: NormalizedToken[], args: ExportTokensArgs): string {
  const selector = args.cssSelector ?? ":root";
  const modes = collectModes(tokens);
  const lines: string[] = [
    `/* Design Tokens — CSS Custom Properties */`,
    `/* Generated by figma_export_tokens */`,
    `/* ${tokens.length} tokens across ${new Set(tokens.map((t) => t.collection)).size} collections */`,
    ``,
  ];

  for (const mode of modes) {
    const modeSelector = mode === "Light" || modes.length === 1
      ? selector
      : mode === "Dark"
        ? `${selector === ":root" ? "[data-theme=\"dark\"]" : `${selector}[data-theme=\"dark\"]`}`
        : `${selector === ":root" ? `[data-theme="${mode.toLowerCase()}"]` : `${selector}[data-theme="${mode.toLowerCase()}"]`}`;

    const attrs = mode === "Dark" && selector === ":root"
      ? `@media (prefers-color-scheme: dark) {\n  :root`
      : modeSelector;

    const isMediaWrapped = mode === "Dark" && selector === ":root";

    lines.push(`${isMediaWrapped ? attrs : modeSelector} {`);

    for (const token of tokens) {
      const val = token.values[mode];
      if (val === undefined) continue;

      const cssVal = formatCssValue(val, token.type);
      if (args.includeAliasChains && token.aliasOf) {
        lines.push(`  /* alias: ${token.aliasOf} */`);
      }
      if (token.description) {
        lines.push(`  /* ${token.description} */`);
      }
      lines.push(`  ${token.cssName}: ${cssVal};`);
    }

    lines.push(`${isMediaWrapped ? "  }\n}" : "}"}`);
    lines.push(``);
  }

  return lines.join("\n");
}

function generateSCSS(tokens: NormalizedToken[], args: ExportTokensArgs): string {
  const modes = collectModes(tokens);
  const lines: string[] = [
    `// Design Tokens — SCSS Variables`,
    `// Generated by figma_export_tokens`,
    `// ${tokens.length} tokens`,
    ``,
  ];

  for (const mode of modes) {
    if (modes.length > 1) {
      lines.push(`// ─── Mode: ${mode} ${"─".repeat(50)}`);
    }

    for (const token of tokens) {
      const val = token.values[mode];
      if (val === undefined) continue;

      const scssName = token.cssName.replace(/^--/, "$");
      const suffix = modes.length > 1 && mode !== "Light" ? `-${mode.toLowerCase()}` : "";
      const cssVal = formatCssValue(val, token.type);

      if (token.description) {
        lines.push(`/// ${token.description}`);
      }
      lines.push(`${scssName}${suffix}: ${cssVal};`);
    }
    lines.push(``);
  }

  // Generate a mixin for mode switching
  if (modes.length > 1) {
    lines.push(`// ─── Theme mixin ─────────────────────────────────────────────`);
    lines.push(`@mixin theme($mode: "light") {`);
    for (const token of tokens) {
      const cssVal = Object.values(token.values)[0];
      if (cssVal === undefined) continue;
      const scssName = token.cssName.replace(/^--/, "$");
      lines.push(`  ${token.cssName}: #{${scssName}-#{$mode}};`);
    }
    lines.push(`}`);
  }

  return lines.join("\n");
}

function generateTailwind(tokens: NormalizedToken[], args: ExportTokensArgs): string {
  const prefix = args.tailwindPrefix ?? "ds";

  const colors: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const borderRadius: Record<string, string> = {};
  const fontSize: Record<string, string> = {};
  const zIndex: Record<string, string> = {};
  const opacity: Record<string, string> = {};
  const boxShadow: Record<string, string> = {};
  const transitionDuration: Record<string, string> = {};
  const transitionTimingFunction: Record<string, string> = {};
  const borderWidth: Record<string, string> = {};

  for (const token of tokens) {
    // Use first mode value (typically Light)
    const val = Object.values(token.values)[0];
    if (val === undefined) continue;

    const key = token.name
      .split("/")
      .slice(-2)
      .join("-")
      .replace(/[^a-zA-Z0-9\-]/g, "")
      .toLowerCase();

    const cssRef = `var(${token.cssName})`;

    if (token.type === "COLOR") {
      colors[key] = cssRef;
    } else if (token.name.includes("space") || token.name.includes("spacing") || token.name.includes("gap") || token.name.includes("inset") || token.name.includes("padding")) {
      spacing[key] = typeof val === "number" ? `${val}px` : String(val);
    } else if (token.name.includes("radius")) {
      borderRadius[key] = typeof val === "number" ? `${val}px` : String(val);
    } else if (token.name.includes("font-size") || token.name.includes("text-")) {
      fontSize[key] = typeof val === "number" ? `${val}px` : String(val);
    } else if (token.name.includes("z-index")) {
      zIndex[key] = String(val);
    } else if (token.name.includes("opacity")) {
      opacity[key] = String(val);
    } else if (token.name.includes("shadow") || token.name.includes("elevation")) {
      boxShadow[key] = String(val);
    } else if (token.name.includes("duration")) {
      transitionDuration[key] = typeof val === "number" ? `${val}ms` : String(val);
    } else if (token.name.includes("easing")) {
      transitionTimingFunction[key] = String(val);
    } else if (token.name.includes("border-width")) {
      borderWidth[key] = typeof val === "number" ? `${val}px` : String(val);
    }
  }

  const config: Record<string, unknown> = {
    theme: {
      extend: {
        ...(Object.keys(colors).length > 0 && { colors: { [prefix]: colors } }),
        ...(Object.keys(spacing).length > 0 && { spacing: { [prefix]: spacing } }),
        ...(Object.keys(borderRadius).length > 0 && { borderRadius: { [prefix]: borderRadius } }),
        ...(Object.keys(fontSize).length > 0 && { fontSize: { [prefix]: fontSize } }),
        ...(Object.keys(zIndex).length > 0 && { zIndex: { [prefix]: zIndex } }),
        ...(Object.keys(opacity).length > 0 && { opacity: { [prefix]: opacity } }),
        ...(Object.keys(boxShadow).length > 0 && { boxShadow: { [prefix]: boxShadow } }),
        ...(Object.keys(transitionDuration).length > 0 && { transitionDuration: { [prefix]: transitionDuration } }),
        ...(Object.keys(transitionTimingFunction).length > 0 && { transitionTimingFunction: { [prefix]: transitionTimingFunction } }),
        ...(Object.keys(borderWidth).length > 0 && { borderWidth: { [prefix]: borderWidth } }),
      },
    },
  };

  const lines = [
    `// Design Tokens — Tailwind CSS Config`,
    `// Generated by figma_export_tokens`,
    `// Usage: import and spread into your tailwind.config.{js,ts}`,
    ``,
    `/** @type {import('tailwindcss').Config} */`,
    `module.exports = ${JSON.stringify(config, null, 2)};`,
  ];

  return lines.join("\n");
}

function generateStyleDictionary(tokens: NormalizedToken[], args: ExportTokensArgs): string {
  const modes = collectModes(tokens);
  const result: Record<string, unknown> = {};

  for (const token of tokens) {
    const path = token.name.split("/").filter(Boolean);
    const val = Object.values(token.values)[0];
    if (val === undefined) continue;

    const leaf: Record<string, unknown> = {
      value: formatRawValue(val, token.type),
      type: sdType(token.type),
    };

    if (token.description) leaf.comment = token.description;
    if (token.aliasOf) leaf.original = { value: `{${token.aliasOf.replace(/\//g, ".")}}` };

    // Modes as attributes
    if (modes.length > 1) {
      const modeVals: Record<string, unknown> = {};
      for (const [mode, modeVal] of Object.entries(token.values)) {
        modeVals[mode.toLowerCase()] = formatRawValue(modeVal, token.type);
      }
      leaf.modes = modeVals;
    }

    setNestedValue(result, path, leaf);
  }

  return JSON.stringify(result, null, 2);
}

// ─── DTCG v2025.10 compliant generator ─────────────────────────────────────

function dtcgType(type: string, name: string): string {
  if (type === "COLOR") return "color";

  if (type === "FLOAT") {
    if (name.includes("opacity") || name.includes("z-index")) return "number";
    if (name.includes("font-weight") || name.includes("fontWeight")) return "fontWeight";
    if (name.includes("duration")) return "duration";
    // spacing, radius, border-width, font-size, letter-spacing, line-height, size, etc.
    return "dimension";
  }

  if (type === "STRING") {
    if (name.includes("easing") || name.includes("timing") || name.includes("cubic-bezier")) return "cubicBezier";
    if (name.includes("shadow") || name.includes("elevation")) return "shadow";
    if (name.includes("font-family") || name.includes("fontFamily")) return "fontFamily";
    if (name.includes("typography")) return "typography";
    if (name.includes("border") && !name.includes("border-width") && !name.includes("border-radius")) return "border";
    if (name.includes("gradient")) return "gradient";
    if (name.includes("transition")) return "transition";
    return "string";
  }

  return "string";
}

function dtcgValue(
  val: string | number | boolean,
  type: string,
  dtcgTypeName: string,
): unknown {
  switch (dtcgTypeName) {
    case "color":
      return typeof val === "string" ? val : String(val);

    case "dimension":
      return { value: typeof val === "number" ? val : parseFloat(String(val)) || 0, unit: "px" };

    case "number":
    case "fontWeight":
      return typeof val === "number" ? val : parseFloat(String(val)) || 0;

    case "duration":
      return { value: typeof val === "number" ? val : parseFloat(String(val)) || 0, unit: "ms" };

    case "cubicBezier":
      return typeof val === "string" ? parseCubicBezierString(val) : [0, 0, 1, 1];

    case "shadow":
      return typeof val === "string" ? parseShadowString(val) : val;

    case "fontFamily":
      return typeof val === "string" ? val : String(val);

    case "typography":
      return typeof val === "string" ? parseTypographyString(val) : val;

    case "border":
      return typeof val === "string" ? parseBorderString(val) : val;

    case "gradient":
      return typeof val === "string" ? parseGradientString(val) : val;

    case "transition":
      return typeof val === "string" ? parseTransitionString(val) : val;

    default:
      return val;
  }
}

function generateDTCG(tokens: NormalizedToken[], args: ExportTokensArgs): string {
  const includeDeprecated = args.deprecated !== false; // default true
  const result: Record<string, unknown> = {};

  // Group tokens by DTCG path prefix for $type inheritance
  const groupTypes = new Map<string, Set<string>>();

  for (const token of tokens) {
    const path = tokenNameToDtcgPath(token.name);
    const val = Object.values(token.values)[0];
    if (val === undefined) continue;

    const typeName = dtcgType(token.type, token.name);

    // Track types per group for $type inheritance
    if (path.length > 1) {
      const groupKey = path.slice(0, -1).join("/");
      if (!groupTypes.has(groupKey)) {
        groupTypes.set(groupKey, new Set());
      }
      groupTypes.get(groupKey)!.add(typeName);
    }

    const leaf: Record<string, unknown> = {
      $value: dtcgValue(val, token.type, typeName),
      $type: typeName,
    };

    if (token.description) leaf.$description = token.description;

    // $deprecated support
    if (includeDeprecated && token.description?.toLowerCase().includes("deprecated")) {
      leaf.$deprecated = true;
    }

    // DTCG extensions for modes
    if (Object.keys(token.values).length > 1) {
      const extensions: Record<string, unknown> = {};
      for (const [mode, modeVal] of Object.entries(token.values)) {
        extensions[mode.toLowerCase()] = dtcgValue(modeVal, token.type, typeName);
      }
      leaf.$extensions = { "com.figma.modes": extensions };
    }

    setNestedValue(result, path, leaf);
  }

  // Apply $type inheritance: set $type on groups when all children share the same type,
  // then remove $type from individual children
  for (const [groupKey, types] of groupTypes.entries()) {
    if (types.size === 1) {
      const sharedType = [...types][0];
      const groupPath = groupKey.split("/");
      const group = getNestedValue(result, groupPath);
      if (group && typeof group === "object" && group !== null) {
        const groupObj = group as Record<string, unknown>;
        // Set $type on the group
        groupObj.$type = sharedType;
        // Remove $type from children
        for (const [childKey, childVal] of Object.entries(groupObj)) {
          if (childKey.startsWith("$")) continue;
          if (childVal && typeof childVal === "object" && childVal !== null) {
            const child = childVal as Record<string, unknown>;
            if (child.$type === sharedType) {
              delete child.$type;
            }
          }
        }
      }
    }
  }

  return JSON.stringify(result, null, 2);
}

function generateSwift(tokens: NormalizedToken[], args: ExportTokensArgs): string {
  const modes = collectModes(tokens);
  const colorTokens = tokens.filter((t) => t.type === "COLOR");
  const floatTokens = tokens.filter((t) => t.type === "FLOAT");
  const stringTokens = tokens.filter((t) => t.type === "STRING");

  const lines: string[] = [
    `// Design Tokens — Swift`,
    `// Generated by figma_export_tokens`,
    `// ${tokens.length} tokens`,
    ``,
    `import SwiftUI`,
    ``,
  ];

  // Color tokens
  if (colorTokens.length > 0) {
    lines.push(`// MARK: - Colors`);
    lines.push(`extension Color {`);
    lines.push(`    enum DesignSystem {`);

    for (const token of colorTokens) {
      const val = Object.values(token.values)[0];
      if (val === undefined || typeof val !== "string") continue;

      const name = tokenNameToSwiftCase(token.name);
      const hex = val.replace("#", "");

      if (token.description) {
        lines.push(`        /// ${token.description}`);
      }
      lines.push(`        static let ${name} = Color(hex: 0x${hex.toUpperCase().slice(0, 6)})`);
    }

    lines.push(`    }`);
    lines.push(`}`);
    lines.push(``);

    // Dark mode support
    if (modes.includes("Dark")) {
      lines.push(`// MARK: - Dark Mode Colors`);
      lines.push(`extension Color.DesignSystem {`);
      lines.push(`    static func resolved(_ colorScheme: ColorScheme) -> [String: Color] {`);
      lines.push(`        switch colorScheme {`);
      lines.push(`        case .dark:`);
      lines.push(`            return [`);
      for (const token of colorTokens) {
        const darkVal = token.values["Dark"];
        if (darkVal === undefined || typeof darkVal !== "string") continue;
        const hex = darkVal.replace("#", "");
        lines.push(`                "${tokenNameToSwiftCase(token.name)}": Color(hex: 0x${hex.toUpperCase().slice(0, 6)}),`);
      }
      lines.push(`            ]`);
      lines.push(`        default:`);
      lines.push(`            return [:]`);
      lines.push(`        }`);
      lines.push(`    }`);
      lines.push(`}`);
      lines.push(``);
    }
  }

  // Spacing / dimension tokens
  if (floatTokens.length > 0) {
    lines.push(`// MARK: - Dimensions`);
    lines.push(`enum DSSpacing {`);
    for (const token of floatTokens) {
      const val = Object.values(token.values)[0];
      if (val === undefined) continue;
      const name = tokenNameToSwiftCase(token.name);
      if (token.description) {
        lines.push(`    /// ${token.description}`);
      }
      lines.push(`    static let ${name}: CGFloat = ${val}`);
    }
    lines.push(`}`);
    lines.push(``);
  }

  // String tokens (shadows, easing)
  if (stringTokens.length > 0) {
    lines.push(`// MARK: - String Tokens`);
    lines.push(`enum DSTokens {`);
    for (const token of stringTokens) {
      const val = Object.values(token.values)[0];
      if (val === undefined) continue;
      const name = tokenNameToSwiftCase(token.name);
      lines.push(`    static let ${name} = "${val}"`);
    }
    lines.push(`}`);
  }

  return lines.join("\n");
}

function generateKotlin(tokens: NormalizedToken[], args: ExportTokensArgs): string {
  const colorTokens = tokens.filter((t) => t.type === "COLOR");
  const floatTokens = tokens.filter((t) => t.type === "FLOAT");
  const modes = collectModes(tokens);

  const lines: string[] = [
    `// Design Tokens — Kotlin (Jetpack Compose)`,
    `// Generated by figma_export_tokens`,
    `// ${tokens.length} tokens`,
    ``,
    `package com.designsystem.tokens`,
    ``,
    `import androidx.compose.ui.graphics.Color`,
    `import androidx.compose.ui.unit.dp`,
    `import androidx.compose.ui.unit.sp`,
    ``,
  ];

  if (colorTokens.length > 0) {
    lines.push(`object DSColors {`);
    for (const token of colorTokens) {
      const val = Object.values(token.values)[0];
      if (val === undefined || typeof val !== "string") continue;
      const name = tokenNameToKotlinCase(token.name);
      const hex = val.replace("#", "").toUpperCase();
      if (token.description) {
        lines.push(`    /** ${token.description} */`);
      }
      lines.push(`    val ${name} = Color(0xFF${hex.slice(0, 6)})`);
    }
    lines.push(`}`);
    lines.push(``);

    if (modes.includes("Dark")) {
      lines.push(`object DSColorsDark {`);
      for (const token of colorTokens) {
        const darkVal = token.values["Dark"];
        if (darkVal === undefined || typeof darkVal !== "string") continue;
        const name = tokenNameToKotlinCase(token.name);
        const hex = darkVal.replace("#", "").toUpperCase();
        lines.push(`    val ${name} = Color(0xFF${hex.slice(0, 6)})`);
      }
      lines.push(`}`);
      lines.push(``);
    }
  }

  if (floatTokens.length > 0) {
    lines.push(`object DSDimensions {`);
    for (const token of floatTokens) {
      const val = Object.values(token.values)[0];
      if (val === undefined) continue;
      const name = tokenNameToKotlinCase(token.name);
      const unit = token.name.includes("font-size") || token.name.includes("text") ? "sp" : "dp";
      if (token.description) {
        lines.push(`    /** ${token.description} */`);
      }
      lines.push(`    val ${name} = ${val}.${unit}`);
    }
    lines.push(`}`);
  }

  return lines.join("\n");
}

function generateJSON(tokens: NormalizedToken[], _args: ExportTokensArgs): string {
  const output = tokens.map((t) => ({
    name: t.name,
    cssVariable: t.cssName,
    type: t.type,
    collection: t.collection,
    description: t.description,
    values: t.values,
    ...(t.aliasOf ? { aliasOf: t.aliasOf } : {}),
  }));
  return JSON.stringify(output, null, 2);
}

// ─── New format generators ─────────────────────────────────────────────────

function generateFlutter(tokens: NormalizedToken[], _args: ExportTokensArgs): string {
  const colorTokens = tokens.filter((t) => t.type === "COLOR");
  const floatTokens = tokens.filter((t) => t.type === "FLOAT");
  const stringTokens = tokens.filter((t) => t.type === "STRING");

  const lines: string[] = [
    `// Design Tokens — Flutter/Dart`,
    `// Generated by figma_export_tokens`,
    `// ${tokens.length} tokens`,
    ``,
    `import 'package:flutter/material.dart';`,
    ``,
  ];

  if (colorTokens.length > 0) {
    lines.push(`class DSColors {`);
    for (const token of colorTokens) {
      const val = Object.values(token.values)[0];
      if (val === undefined || typeof val !== "string") continue;
      const name = tokenNameToCamelCase(token.name);
      const hex = val.replace("#", "").toUpperCase();
      const alpha = hex.length > 6 ? hex.slice(6, 8) : "FF";
      const rgb = hex.slice(0, 6);
      if (token.description) {
        lines.push(`  /// ${token.description}`);
      }
      lines.push(`  static const ${name} = Color(0x${alpha}${rgb});`);
    }
    lines.push(`}`);
    lines.push(``);
  }

  if (floatTokens.length > 0) {
    lines.push(`class DSDimensions {`);
    for (const token of floatTokens) {
      const val = Object.values(token.values)[0];
      if (val === undefined) continue;
      const name = tokenNameToCamelCase(token.name);
      const numVal = typeof val === "number" ? val : parseFloat(String(val)) || 0;
      if (token.description) {
        lines.push(`  /// ${token.description}`);
      }
      lines.push(`  static const ${name} = ${numVal.toFixed(1)};`);
    }
    lines.push(`}`);
    lines.push(``);
  }

  if (stringTokens.length > 0) {
    lines.push(`class DSStrings {`);
    for (const token of stringTokens) {
      const val = Object.values(token.values)[0];
      if (val === undefined) continue;
      const name = tokenNameToCamelCase(token.name);
      lines.push(`  static const ${name} = '${String(val).replace(/'/g, "\\'")}';`);
    }
    lines.push(`}`);
  }

  return lines.join("\n");
}

function generateAndroidXml(tokens: NormalizedToken[], _args: ExportTokensArgs): string {
  const lines: string[] = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<!-- Design Tokens — Android Resources -->`,
    `<!-- Generated by figma_export_tokens -->`,
    `<!-- ${tokens.length} tokens -->`,
    `<resources>`,
  ];

  for (const token of tokens) {
    const val = Object.values(token.values)[0];
    if (val === undefined) continue;

    const xmlName = "ds_" + tokenNameToSnakeCase(token.name);

    if (token.description) {
      lines.push(`  <!-- ${token.description} -->`);
    }

    if (token.type === "COLOR" && typeof val === "string") {
      // Android expects #AARRGGBB format
      const hex = val.replace("#", "").toUpperCase();
      const alpha = hex.length > 6 ? hex.slice(6, 8) : "FF";
      const rgb = hex.slice(0, 6);
      lines.push(`  <color name="${xmlName}">#${alpha}${rgb}</color>`);
    } else if (token.type === "FLOAT") {
      const numVal = typeof val === "number" ? val : parseFloat(String(val)) || 0;
      if (token.name.includes("font-size") || token.name.includes("text")) {
        lines.push(`  <dimen name="${xmlName}">${numVal}sp</dimen>`);
      } else {
        lines.push(`  <dimen name="${xmlName}">${numVal}dp</dimen>`);
      }
    } else if (token.type === "STRING") {
      const escaped = String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
      lines.push(`  <string name="${xmlName}">${escaped}</string>`);
    } else if (token.type === "BOOLEAN") {
      lines.push(`  <bool name="${xmlName}">${val}</bool>`);
    }
  }

  lines.push(`</resources>`);
  return lines.join("\n");
}

function generateJsModule(tokens: NormalizedToken[], _args: ExportTokensArgs): string {
  const lines: string[] = [
    `// Design Tokens — JavaScript ES Module`,
    `// Generated by figma_export_tokens`,
    `// ${tokens.length} tokens`,
    ``,
  ];

  for (const token of tokens) {
    const val = Object.values(token.values)[0];
    if (val === undefined) continue;

    const name = tokenNameToCamelCase(token.name);

    if (token.description) {
      lines.push(`/** ${token.description} */`);
    }

    if (typeof val === "string") {
      lines.push(`export const ${name} = "${val.replace(/"/g, '\\"')}";`);
    } else if (typeof val === "number") {
      lines.push(`export const ${name} = ${val};`);
    } else {
      lines.push(`export const ${name} = ${JSON.stringify(val)};`);
    }
  }

  return lines.join("\n");
}

function generateTsModule(tokens: NormalizedToken[], _args: ExportTokensArgs): string {
  const lines: string[] = [
    `// Design Tokens — TypeScript Module`,
    `// Generated by figma_export_tokens`,
    `// ${tokens.length} tokens`,
    ``,
  ];

  const tokenNames: string[] = [];
  const colorNames: string[] = [];
  const dimensionNames: string[] = [];

  for (const token of tokens) {
    const val = Object.values(token.values)[0];
    if (val === undefined) continue;

    const name = tokenNameToCamelCase(token.name);
    tokenNames.push(name);

    if (token.type === "COLOR") colorNames.push(name);
    if (token.type === "FLOAT") dimensionNames.push(name);

    if (token.description) {
      lines.push(`/** ${token.description} */`);
    }

    if (typeof val === "string") {
      lines.push(`export const ${name} = "${val.replace(/"/g, '\\"')}" as const;`);
    } else if (typeof val === "number") {
      lines.push(`export const ${name} = ${val} as const;`);
    } else {
      lines.push(`export const ${name} = ${JSON.stringify(val)} as const;`);
    }
  }

  // Type declarations
  lines.push(``);
  if (tokenNames.length > 0) {
    lines.push(`export type TokenName = ${tokenNames.map((n) => `"${n}"`).join(" | ")};`);
  }
  if (colorNames.length > 0) {
    lines.push(`export type ColorToken = ${colorNames.map((n) => `typeof ${n}`).join(" | ")};`);
  }
  if (dimensionNames.length > 0) {
    lines.push(`export type DimensionToken = ${dimensionNames.map((n) => `typeof ${n}`).join(" | ")};`);
  }

  return lines.join("\n");
}

function generateLess(tokens: NormalizedToken[], _args: ExportTokensArgs): string {
  const modes = collectModes(tokens);
  const lines: string[] = [
    `// Design Tokens — Less Variables`,
    `// Generated by figma_export_tokens`,
    `// ${tokens.length} tokens`,
    ``,
  ];

  for (const mode of modes) {
    if (modes.length > 1) {
      lines.push(`// ─── Mode: ${mode} ${"─".repeat(50)}`);
    }

    for (const token of tokens) {
      const val = token.values[mode];
      if (val === undefined) continue;

      const lessName = "@" + token.cssName.replace(/^--/, "");
      const suffix = modes.length > 1 && mode !== "Light" ? `-${mode.toLowerCase()}` : "";
      const cssVal = formatCssValue(val, token.type);

      if (token.description) {
        lines.push(`// ${token.description}`);
      }
      lines.push(`${lessName}${suffix}: ${cssVal};`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}

function generateReactNative(tokens: NormalizedToken[], _args: ExportTokensArgs): string {
  const colorTokens = tokens.filter((t) => t.type === "COLOR");
  const floatTokens = tokens.filter((t) => t.type === "FLOAT");

  const lines: string[] = [
    `// Design Tokens — React Native`,
    `// Generated by figma_export_tokens`,
    `// ${tokens.length} tokens`,
    ``,
    `import { StyleSheet } from 'react-native';`,
    ``,
  ];

  // Colors object
  if (colorTokens.length > 0) {
    lines.push(`export const colors = {`);
    for (const token of colorTokens) {
      const val = Object.values(token.values)[0];
      if (val === undefined || typeof val !== "string") continue;
      const name = tokenNameToCamelCase(token.name);
      lines.push(`  ${name}: '${val}',`);
    }
    lines.push(`};`);
    lines.push(``);
  }

  // Categorize float tokens
  const spacingTokens = floatTokens.filter((t) =>
    t.name.includes("space") || t.name.includes("spacing") || t.name.includes("gap") || t.name.includes("padding") || t.name.includes("inset")
  );
  const radiusTokens = floatTokens.filter((t) => t.name.includes("radius"));
  const fontSizeTokens = floatTokens.filter((t) => t.name.includes("font-size") || t.name.includes("text-"));
  const otherFloats = floatTokens.filter((t) =>
    !spacingTokens.includes(t) && !radiusTokens.includes(t) && !fontSizeTokens.includes(t)
  );

  if (spacingTokens.length > 0) {
    lines.push(`export const spacing = {`);
    for (const token of spacingTokens) {
      const val = Object.values(token.values)[0];
      if (val === undefined) continue;
      const name = tokenNameToCamelCase(token.name);
      lines.push(`  ${name}: ${typeof val === "number" ? val : parseFloat(String(val)) || 0},`);
    }
    lines.push(`};`);
    lines.push(``);
  }

  if (radiusTokens.length > 0) {
    lines.push(`export const borderRadius = {`);
    for (const token of radiusTokens) {
      const val = Object.values(token.values)[0];
      if (val === undefined) continue;
      const name = tokenNameToCamelCase(token.name);
      lines.push(`  ${name}: ${typeof val === "number" ? val : parseFloat(String(val)) || 0},`);
    }
    lines.push(`};`);
    lines.push(``);
  }

  if (fontSizeTokens.length > 0) {
    lines.push(`export const fontSize = {`);
    for (const token of fontSizeTokens) {
      const val = Object.values(token.values)[0];
      if (val === undefined) continue;
      const name = tokenNameToCamelCase(token.name);
      lines.push(`  ${name}: ${typeof val === "number" ? val : parseFloat(String(val)) || 0},`);
    }
    lines.push(`};`);
    lines.push(``);
  }

  if (otherFloats.length > 0) {
    lines.push(`export const dimensions = {`);
    for (const token of otherFloats) {
      const val = Object.values(token.values)[0];
      if (val === undefined) continue;
      const name = tokenNameToCamelCase(token.name);
      lines.push(`  ${name}: ${typeof val === "number" ? val : parseFloat(String(val)) || 0},`);
    }
    lines.push(`};`);
    lines.push(``);
  }

  return lines.join("\n");
}

function generateTailwindV4(tokens: NormalizedToken[], args: ExportTokensArgs): string {
  const prefix = args.tailwindPrefix ?? "ds";

  const lines: string[] = [
    `/* Design Tokens — Tailwind CSS v4 @theme */`,
    `/* Generated by figma_export_tokens */`,
    `/* ${tokens.length} tokens */`,
    ``,
    `@theme {`,
  ];

  for (const token of tokens) {
    const val = Object.values(token.values)[0];
    if (val === undefined) continue;

    const rawKey = token.name
      .replace(/\//g, "-")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9\-]/g, "")
      .toLowerCase();

    if (token.type === "COLOR") {
      lines.push(`  --color-${prefix}-${rawKey}: ${typeof val === "string" ? val : String(val)};`);
    } else if (token.name.includes("space") || token.name.includes("spacing") || token.name.includes("gap") || token.name.includes("padding") || token.name.includes("inset")) {
      lines.push(`  --spacing-${prefix}-${rawKey}: ${typeof val === "number" ? `${val}px` : String(val)};`);
    } else if (token.name.includes("radius")) {
      lines.push(`  --radius-${prefix}-${rawKey}: ${typeof val === "number" ? `${val}px` : String(val)};`);
    } else if (token.name.includes("font-size") || token.name.includes("text-")) {
      lines.push(`  --font-size-${prefix}-${rawKey}: ${typeof val === "number" ? `${val}px` : String(val)};`);
    } else if (token.name.includes("shadow") || token.name.includes("elevation")) {
      lines.push(`  --shadow-${prefix}-${rawKey}: ${String(val)};`);
    } else if (token.name.includes("duration")) {
      lines.push(`  --duration-${prefix}-${rawKey}: ${typeof val === "number" ? `${val}ms` : String(val)};`);
    } else if (token.name.includes("easing")) {
      lines.push(`  --ease-${prefix}-${rawKey}: ${String(val)};`);
    } else if (token.name.includes("border-width")) {
      lines.push(`  --border-${prefix}-${rawKey}: ${typeof val === "number" ? `${val}px` : String(val)};`);
    } else if (token.name.includes("z-index")) {
      lines.push(`  --z-${prefix}-${rawKey}: ${String(val)};`);
    } else if (token.name.includes("opacity")) {
      lines.push(`  --opacity-${prefix}-${rawKey}: ${String(val)};`);
    } else {
      lines.push(`  --${prefix}-${rawKey}: ${typeof val === "number" ? `${val}px` : String(val)};`);
    }
  }

  lines.push(`}`);
  return lines.join("\n");
}

function generateCssRem(tokens: NormalizedToken[], args: ExportTokensArgs): string {
  const selector = args.cssSelector ?? ":root";
  const remBase = args.remBase ?? 16;
  const modes = collectModes(tokens);
  const lines: string[] = [
    `/* Design Tokens — CSS Custom Properties (rem) */`,
    `/* Generated by figma_export_tokens */`,
    `/* Base font size: ${remBase}px */`,
    `/* ${tokens.length} tokens across ${new Set(tokens.map((t) => t.collection)).size} collections */`,
    ``,
  ];

  for (const mode of modes) {
    const modeSelector = mode === "Light" || modes.length === 1
      ? selector
      : mode === "Dark"
        ? `${selector === ":root" ? "[data-theme=\"dark\"]" : `${selector}[data-theme=\"dark\"]`}`
        : `${selector === ":root" ? `[data-theme="${mode.toLowerCase()}"]` : `${selector}[data-theme="${mode.toLowerCase()}"]`}`;

    const attrs = mode === "Dark" && selector === ":root"
      ? `@media (prefers-color-scheme: dark) {\n  :root`
      : modeSelector;

    const isMediaWrapped = mode === "Dark" && selector === ":root";

    lines.push(`${isMediaWrapped ? attrs : modeSelector} {`);

    for (const token of tokens) {
      const val = token.values[mode];
      if (val === undefined) continue;

      let cssVal: string;
      if (token.type === "COLOR" && typeof val === "string") {
        // Colors stay as-is
        cssVal = val;
      } else if (token.type === "FLOAT" && typeof val === "number") {
        // Convert px to rem
        cssVal = pxToRem(val, remBase);
      } else {
        cssVal = formatCssValue(val, token.type);
      }

      if (args.includeAliasChains && token.aliasOf) {
        lines.push(`  /* alias: ${token.aliasOf} */`);
      }
      if (token.description) {
        lines.push(`  /* ${token.description} */`);
      }
      lines.push(`  ${token.cssName}: ${cssVal};`);
    }

    lines.push(`${isMediaWrapped ? "  }\n}" : "}"}`);
    lines.push(``);
  }

  return lines.join("\n");
}

// ─── Utility helpers ────────────────────────────────────────────────────────

function collectModes(tokens: NormalizedToken[]): string[] {
  const modes = new Set<string>();
  for (const token of tokens) {
    for (const mode of Object.keys(token.values)) {
      modes.add(mode);
    }
  }
  // Sort: Light first, Dark second, rest alphabetical
  return [...modes].sort((a, b) => {
    if (a === "Light") return -1;
    if (b === "Light") return 1;
    if (a === "Dark") return -1;
    if (b === "Dark") return 1;
    return a.localeCompare(b);
  });
}

function formatCssValue(val: string | number | boolean, type: string): string {
  if (type === "COLOR" && typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "1" : "0";
  return String(val);
}

function formatRawValue(val: string | number | boolean, type: string): unknown {
  if (type === "COLOR" && typeof val === "string") return val;
  return val;
}

function sdType(type: string): string {
  switch (type) {
    case "COLOR": return "color";
    case "FLOAT": return "number";
    case "STRING": return "string";
    case "BOOLEAN": return "boolean";
    default: return "other";
  }
}

function setNestedValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// ─── Main handler ───────────────────────────────────────────────────────────

export async function exportTokensHandler(args: ExportTokensArgs): Promise<unknown> {
  // Try Figma bridge first, fall back to built-in catalog
  let tokens: NormalizedToken[];
  let source: "figma" | "catalog";

  try {
    tokens = await fetchFigmaTokens(args);
    source = "figma";
  } catch {
    tokens = [];
    source = "catalog";
  }

  if (tokens.length === 0) {
    tokens = catalogToTokens(args);
    source = "catalog";
  }

  if (tokens.length === 0) {
    return {
      error: "No tokens found. Ensure the Figma file has variables or adjust your filters.",
      filters: {
        collectionFilter: args.collectionFilter,
        tokenTypes: args.tokenTypes,
        mode: args.mode,
      },
    };
  }

  const formats = args.format === "all"
    ? [
        "css", "scss", "tailwind", "style-dictionary", "dtcg", "swift", "kotlin",
        "json", "flutter", "android-xml", "js", "ts", "less", "react-native",
        "tailwind-v4", "css-rem",
      ] as const
    : [args.format] as const;

  const outputs: Record<string, string> = {};

  for (const fmt of formats) {
    switch (fmt) {
      case "css":
        outputs["tokens.css"] = generateCSS(tokens, args);
        break;
      case "scss":
        outputs["_tokens.scss"] = generateSCSS(tokens, args);
        break;
      case "tailwind":
        outputs["tokens.tailwind.js"] = generateTailwind(tokens, args);
        break;
      case "style-dictionary":
        outputs["tokens.style-dictionary.json"] = generateStyleDictionary(tokens, args);
        break;
      case "dtcg":
        outputs["tokens.tokens.json"] = generateDTCG(tokens, args);
        break;
      case "swift":
        outputs["DesignTokens.swift"] = generateSwift(tokens, args);
        break;
      case "kotlin":
        outputs["DesignTokens.kt"] = generateKotlin(tokens, args);
        break;
      case "json":
        outputs["tokens.json"] = generateJSON(tokens, args);
        break;
      case "flutter":
        outputs["design_tokens.dart"] = generateFlutter(tokens, args);
        break;
      case "android-xml":
        outputs["tokens.xml"] = generateAndroidXml(tokens, args);
        break;
      case "js":
        outputs["tokens.mjs"] = generateJsModule(tokens, args);
        break;
      case "ts":
        outputs["tokens.ts"] = generateTsModule(tokens, args);
        break;
      case "less":
        outputs["tokens.less"] = generateLess(tokens, args);
        break;
      case "react-native":
        outputs["tokens.native.ts"] = generateReactNative(tokens, args);
        break;
      case "tailwind-v4":
        outputs["tokens.tailwind-v4.css"] = generateTailwindV4(tokens, args);
        break;
      case "css-rem":
        outputs["tokens.rem.css"] = generateCssRem(tokens, args);
        break;
    }
  }

  const collections = [...new Set(tokens.map((t) => t.collection))];
  const modes = collectModes(tokens);

  return {
    source,
    summary: {
      totalTokens: tokens.length,
      collections,
      modes,
      types: {
        COLOR: tokens.filter((t) => t.type === "COLOR").length,
        FLOAT: tokens.filter((t) => t.type === "FLOAT").length,
        STRING: tokens.filter((t) => t.type === "STRING").length,
        BOOLEAN: tokens.filter((t) => t.type === "BOOLEAN").length,
      },
    },
    files: outputs,
    usage: {
      css: "Add tokens.css to your HTML <head> or @import in your main stylesheet.",
      scss: "Import _tokens.scss in your main SCSS file: @use 'tokens';",
      tailwind: "Spread into tailwind.config.js: const dsTokens = require('./tokens.tailwind'); module.exports = { ...dsTokens, ... }",
      "style-dictionary": "Use as Style Dictionary source: https://amzn.github.io/style-dictionary/",
      dtcg: "W3C Design Token Community Group v2025.10 format — compatible with Tokens Studio, Specify, and other tools. Supports composite types (shadow, typography, border, gradient, transition, cubicBezier) and $type inheritance.",
      swift: "Add DesignTokens.swift to your Xcode project. Requires Color+Hex extension.",
      kotlin: "Add DesignTokens.kt to your Compose project.",
      flutter: "Add design_tokens.dart to your Flutter project. Uses Material Color class.",
      "android-xml": "Add tokens.xml to res/values/. Colors use #AARRGGBB format, dimensions use dp/sp.",
      js: "Import as ES module: import { colorPrimary, spacingSm } from './tokens.mjs';",
      ts: "Import with full type safety: import { colorPrimary, type TokenName } from './tokens';",
      less: "Import in your Less file: @import 'tokens.less';",
      "react-native": "Import in your RN project: import { colors, spacing } from './tokens.native';",
      "tailwind-v4": "Import in your Tailwind v4 CSS: @import './tokens.tailwind-v4.css'; Uses @theme directive.",
      "css-rem": `CSS custom properties with rem units (base: ${args.remBase ?? 16}px). Colors remain as hex values.`,
    },
  };
}
