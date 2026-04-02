// ─────────────────────────────────────────────────────────────────────────────
// figma_export_tokens — Export Figma variables to code-ready formats
//
// Reads all variables from the connected Figma file via the bridge and exports
// them as CSS custom properties, SCSS, Tailwind config, Style Dictionary JSON,
// DTCG (W3C Design Token Community Group) JSON, Swift, or Kotlin.
//
// Falls back to the built-in semantic token catalog when no Figma connection
// is available, so specs and code can still be generated offline.
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";
import { SEMANTIC_TOKEN_CATALOG, SemanticTokenEntry } from "../../../shared/semantic-token-catalog.js";
import { figmaRgbaToHex } from "../../../shared/token-utils.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExportTokensArgs {
  format: "css" | "scss" | "tailwind" | "style-dictionary" | "dtcg" | "swift" | "kotlin" | "json" | "all";
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

function generateDTCG(tokens: NormalizedToken[], args: ExportTokensArgs): string {
  const result: Record<string, unknown> = {};

  for (const token of tokens) {
    const path = tokenNameToDtcgPath(token.name);
    const val = Object.values(token.values)[0];
    if (val === undefined) continue;

    const leaf: Record<string, unknown> = {
      $value: formatRawValue(val, token.type),
      $type: dtcgType(token.type, token.name),
    };

    if (token.description) leaf.$description = token.description;

    // DTCG extensions for modes
    if (Object.keys(token.values).length > 1) {
      const extensions: Record<string, unknown> = {};
      for (const [mode, modeVal] of Object.entries(token.values)) {
        extensions[mode.toLowerCase()] = formatRawValue(modeVal, token.type);
      }
      leaf.$extensions = { "com.figma.modes": extensions };
    }

    setNestedValue(result, path, leaf);
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

function dtcgType(type: string, name: string): string {
  if (type === "COLOR") return "color";
  if (name.includes("spacing") || name.includes("space") || name.includes("gap") || name.includes("inset") || name.includes("padding")) return "dimension";
  if (name.includes("radius")) return "dimension";
  if (name.includes("border-width")) return "dimension";
  if (name.includes("font-size") || name.includes("text-")) return "dimension";
  if (name.includes("font-weight")) return "fontWeight";
  if (name.includes("line-height")) return "number";
  if (name.includes("letter-spacing")) return "dimension";
  if (name.includes("opacity")) return "number";
  if (name.includes("z-index")) return "number";
  if (name.includes("duration")) return "duration";
  if (name.includes("easing")) return "cubicBezier";
  if (name.includes("shadow") || name.includes("elevation")) return "shadow";
  if (type === "FLOAT") return "number";
  if (type === "STRING") return "string";
  return "string";
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
    ? ["css", "scss", "tailwind", "style-dictionary", "dtcg", "swift", "kotlin", "json"] as const
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
      dtcg: "W3C Design Token Community Group format — compatible with Tokens Studio, Specify, and other tools.",
      swift: "Add DesignTokens.swift to your Xcode project. Requires Color+Hex extension.",
      kotlin: "Add DesignTokens.kt to your Compose project.",
    },
  };
}
