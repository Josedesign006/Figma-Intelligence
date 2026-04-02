/**
 * figma_token_docs — Living token documentation generator
 *
 * Fetches all design tokens from the Figma bridge, organizes them by category,
 * and generates documentation in multiple output formats (Figma, Markdown, JSON, HTML).
 * Token data is never fabricated — all values come from actual Figma variables.
 */

import { getBridge } from "../../../shared/figma-bridge.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TokenDocsArgs {
  outputFormat: "figma" | "markdown" | "json" | "html";
  categories?: string[];
  collectionFilter?: string;
  includeVisualSwatches?: boolean;
  includeUsageExamples?: boolean;
  includeAliasChains?: boolean;
  pageName?: string;
}

export interface TokenDocsResult {
  ok: boolean;
  format: TokenDocsArgs["outputFormat"];
  tokenCount: number;
  collectionCount: number;
  categoryCount: number;
  output: string | TokenDocsJsonOutput;
  notes: string[];
}

interface RawVariable {
  id: string;
  name: string;
  type: string;
  resolvedType?: string;
  description?: string;
  valuesByMode?: Record<string, unknown>;
  aliasOf?: string;
}

interface RawCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  variables: RawVariable[];
}

interface CategorizedToken {
  name: string;
  id: string;
  collection: string;
  resolvedType: string;
  description: string;
  values: Record<string, unknown>;
  aliasOf?: string;
  aliasChain?: string[];
}

interface TokenCategory {
  label: string;
  tokens: CategorizedToken[];
}

interface TokenDocsJsonOutput {
  generatedAt: string;
  totalTokens: number;
  collections: string[];
  categories: Record<string, {
    count: number;
    tokens: Array<{
      name: string;
      resolvedType: string;
      description: string;
      values: Record<string, unknown>;
      aliasOf?: string;
      aliasChain?: string[];
    }>;
  }>;
}

// ─── Category Definitions ───────────────────────────────────────────────────

const CATEGORY_MATCHERS: Array<{ label: string; test: (name: string, type: string) => boolean }> = [
  { label: "Colors",           test: (n, t) => t === "COLOR" || /color|fill|stroke|bg|background|foreground/i.test(n) },
  { label: "Spacing",          test: (n, t) => t === "FLOAT" && /spacing|space|gap|padding|margin|inset/i.test(n) },
  { label: "Typography",       test: (n, _) => /font|type|typography|text|letter-spacing|line-height/i.test(n) },
  { label: "Radius",           test: (n, t) => t === "FLOAT" && /radius|corner|rounded/i.test(n) },
  { label: "Elevation",        test: (n, _) => /elevation|shadow|box-shadow|drop-shadow/i.test(n) },
  { label: "Motion",           test: (n, _) => /motion|animation|duration|easing|transition|delay/i.test(n) },
  { label: "Z-Index",          test: (n, t) => t === "FLOAT" && /z-index|z-layer|layer/i.test(n) },
  { label: "Opacity",          test: (n, t) => t === "FLOAT" && /opacity|alpha|transparency/i.test(n) },
  { label: "Border Width",     test: (n, t) => t === "FLOAT" && /border-width|border-size|stroke-width/i.test(n) },
  { label: "Breakpoints",      test: (n, t) => t === "FLOAT" && /breakpoint|screen|viewport/i.test(n) },
  { label: "Grid",             test: (n, _) => /grid|column|gutter/i.test(n) },
  { label: "Density",          test: (n, _) => /density|compact|comfortable|spacious/i.test(n) },
  { label: "Icon Sizes",       test: (n, t) => t === "FLOAT" && /icon-size|icon-width|icon-height/i.test(n) },
];

const UNCATEGORIZED_LABEL = "Other";

// ─── Helpers ────────────────────────────────────────────────────────────────

function categorizeToken(name: string, type: string): string {
  for (const matcher of CATEGORY_MATCHERS) {
    if (matcher.test(name, type)) return matcher.label;
  }
  return UNCATEGORIZED_LABEL;
}

function formatColorValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "r" in value) {
    const c = value as { r: number; g: number; b: number; a?: number };
    const r = Math.round(c.r * 255);
    const g = Math.round(c.g * 255);
    const b = Math.round(c.b * 255);
    if (c.a !== undefined && c.a < 1) {
      return `rgba(${r}, ${g}, ${b}, ${c.a.toFixed(2)})`;
    }
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
  }
  return String(value);
}

function formatValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return "—";
  if (type === "COLOR") return formatColorValue(value);
  if (typeof value === "object" && value !== null && "type" in value && (value as Record<string, unknown>).type === "VARIABLE_ALIAS") {
    return `-> ${(value as unknown as { variableId: string }).variableId}`;
  }
  return String(value);
}

function resolveAliasChain(
  variable: RawVariable,
  allVariablesById: Map<string, RawVariable>,
  maxDepth = 10
): string[] {
  const chain: string[] = [];
  let current = variable;
  let depth = 0;

  while (depth < maxDepth) {
    const firstModeValue = current.valuesByMode
      ? Object.values(current.valuesByMode)[0]
      : undefined;

    if (
      firstModeValue &&
      typeof firstModeValue === "object" &&
      firstModeValue !== null &&
      "type" in firstModeValue &&
      (firstModeValue as Record<string, unknown>).type === "VARIABLE_ALIAS"
    ) {
      const aliasId = (firstModeValue as unknown as { variableId: string }).variableId;
      const target = allVariablesById.get(aliasId);
      if (target) {
        chain.push(target.name);
        current = target;
        depth++;
      } else {
        chain.push(`[unresolved: ${aliasId}]`);
        break;
      }
    } else {
      break;
    }
  }

  return chain;
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Data Fetching & Organizing ─────────────────────────────────────────────

async function fetchAndOrganizeTokens(
  args: TokenDocsArgs
): Promise<{ categories: Map<string, TokenCategory>; collections: RawCollection[]; allTokenCount: number }> {
  const bridge = await getBridge();
  const raw = await bridge.getVariables(undefined, "full") as RawCollection[];

  // Filter collections if requested
  const collections = args.collectionFilter
    ? raw.filter((c) => c.name.toLowerCase().includes(args.collectionFilter!.toLowerCase()))
    : raw;

  // Build variable-by-id index for alias resolution
  const allVariablesById = new Map<string, RawVariable>();
  for (const col of raw) {
    for (const v of col.variables) {
      allVariablesById.set(v.id, v);
    }
  }

  // Organize tokens into categories
  const categoryMap = new Map<string, TokenCategory>();
  let allTokenCount = 0;

  for (const collection of collections) {
    const modeNames = collection.modes.map((m) => m.name);

    for (const variable of collection.variables) {
      const type = variable.resolvedType || variable.type || "STRING";
      const category = categorizeToken(variable.name, type);

      // Apply category filter if specified
      if (args.categories && args.categories.length > 0) {
        if (!args.categories.some((c) => c.toLowerCase() === category.toLowerCase())) {
          continue;
        }
      }

      if (!categoryMap.has(category)) {
        categoryMap.set(category, { label: category, tokens: [] });
      }

      // Build mode values
      const values: Record<string, unknown> = {};
      if (variable.valuesByMode) {
        const modeEntries = Object.entries(variable.valuesByMode);
        for (let i = 0; i < modeEntries.length; i++) {
          const modeName = modeNames[i] || modeEntries[i][0];
          values[modeName] = modeEntries[i][1];
        }
      }

      // Resolve alias
      let aliasOf: string | undefined;
      let aliasChain: string[] | undefined;
      const firstValue = variable.valuesByMode ? Object.values(variable.valuesByMode)[0] : undefined;
      if (
        firstValue &&
        typeof firstValue === "object" &&
        firstValue !== null &&
        "type" in firstValue &&
        (firstValue as Record<string, unknown>).type === "VARIABLE_ALIAS"
      ) {
        const target = allVariablesById.get((firstValue as unknown as { variableId: string }).variableId);
        aliasOf = target?.name || (firstValue as unknown as { variableId: string }).variableId;
      }

      if (args.includeAliasChains) {
        aliasChain = resolveAliasChain(variable, allVariablesById);
        if (aliasChain.length === 0) aliasChain = undefined;
      }

      categoryMap.get(category)!.tokens.push({
        name: variable.name,
        id: variable.id,
        collection: collection.name,
        resolvedType: type,
        description: variable.description || "",
        values,
        aliasOf,
        aliasChain,
      });

      allTokenCount++;
    }
  }

  return { categories: categoryMap, collections, allTokenCount };
}

// ─── Renderers ──────────────────────────────────────────────────────────────

function renderMarkdown(
  categories: Map<string, TokenCategory>,
  collections: RawCollection[],
  allTokenCount: number,
  args: TokenDocsArgs
): string {
  const lines: string[] = [];
  const date = todayStamp();

  lines.push(`# Design Token Documentation`);
  lines.push(`Generated: ${date} | Tokens: ${allTokenCount} | Collections: ${collections.length}`);
  lines.push("");

  for (const [, category] of categories) {
    lines.push(`## ${category.label}`);
    lines.push("");

    if (category.tokens.length === 0) {
      lines.push("_No tokens in this category._");
      lines.push("");
      continue;
    }

    // Determine mode columns from first token
    const modeNames = Object.keys(category.tokens[0].values);
    const isColor = category.label === "Colors";
    const hasAlias = category.tokens.some((t) => t.aliasOf);

    // Build header
    const headerCols = ["Token"];
    for (const mode of modeNames) headerCols.push(mode);
    if (hasAlias) headerCols.push("Alias Of");
    if (args.includeAliasChains) headerCols.push("Alias Chain");
    headerCols.push("Description");

    lines.push(`| ${headerCols.join(" | ")} |`);
    lines.push(`| ${headerCols.map(() => "---").join(" | ")} |`);

    for (const token of category.tokens) {
      const row: string[] = [`\`${token.name}\``];
      for (const mode of modeNames) {
        row.push(formatValue(token.values[mode], token.resolvedType));
      }
      if (hasAlias) row.push(token.aliasOf ? `\`${token.aliasOf}\`` : "—");
      if (args.includeAliasChains) {
        row.push(token.aliasChain ? token.aliasChain.map((a) => `\`${a}\``).join(" -> ") : "—");
      }
      row.push(token.description || "—");
      lines.push(`| ${row.join(" | ")} |`);
    }

    lines.push("");

    if (args.includeUsageExamples && isColor) {
      lines.push("### Usage Examples");
      lines.push("```css");
      for (const token of category.tokens.slice(0, 3)) {
        const cssVar = token.name.replace(/\//g, "-");
        lines.push(`.element { color: var(--${cssVar}); }`);
      }
      lines.push("```");
      lines.push("");
    }
  }

  return lines.join("\n");
}

function renderJson(
  categories: Map<string, TokenCategory>,
  collections: RawCollection[],
  allTokenCount: number,
  _args: TokenDocsArgs
): TokenDocsJsonOutput {
  const output: TokenDocsJsonOutput = {
    generatedAt: todayStamp(),
    totalTokens: allTokenCount,
    collections: collections.map((c) => c.name),
    categories: {},
  };

  for (const [key, category] of categories) {
    output.categories[key] = {
      count: category.tokens.length,
      tokens: category.tokens.map((t) => ({
        name: t.name,
        resolvedType: t.resolvedType,
        description: t.description,
        values: t.values,
        ...(t.aliasOf ? { aliasOf: t.aliasOf } : {}),
        ...(t.aliasChain ? { aliasChain: t.aliasChain } : {}),
      })),
    };
  }

  return output;
}

function renderHtml(
  categories: Map<string, TokenCategory>,
  collections: RawCollection[],
  allTokenCount: number,
  args: TokenDocsArgs
): string {
  const date = todayStamp();
  const categoryEntries = Array.from(categories.entries());

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Design Token Documentation</title>
<style>
  :root { --bg: #ffffff; --fg: #1a1a1a; --muted: #6b7280; --border: #e5e7eb; --card-bg: #f9fafb; --accent: #2563eb; }
  [data-theme="dark"] { --bg: #111827; --fg: #f3f4f6; --muted: #9ca3af; --border: #374151; --card-bg: #1f2937; --accent: #60a5fa; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--fg); padding: 2rem; max-width: 1200px; margin: 0 auto; transition: background 0.2s, color 0.2s; }
  h1 { font-size: 2rem; margin-bottom: 0.25rem; }
  .meta { color: var(--muted); margin-bottom: 1.5rem; font-size: 0.875rem; }
  .controls { display: flex; gap: 1rem; margin-bottom: 2rem; align-items: center; flex-wrap: wrap; }
  .controls input { padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.875rem; background: var(--card-bg); color: var(--fg); min-width: 250px; }
  .controls button { padding: 0.5rem 1rem; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; background: var(--card-bg); color: var(--fg); font-size: 0.875rem; }
  .controls button:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
  .category { margin-bottom: 2.5rem; }
  .category h2 { font-size: 1.4rem; margin-bottom: 1rem; border-bottom: 2px solid var(--accent); padding-bottom: 0.25rem; }
  .token-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
  .token-card { border: 1px solid var(--border); border-radius: 8px; padding: 1rem; background: var(--card-bg); }
  .token-name { font-family: 'SF Mono', Monaco, monospace; font-size: 0.8rem; color: var(--accent); cursor: pointer; word-break: break-all; }
  .token-name:hover { text-decoration: underline; }
  .token-values { margin-top: 0.5rem; font-size: 0.85rem; }
  .token-values .mode { display: flex; justify-content: space-between; padding: 0.15rem 0; }
  .token-values .mode-label { color: var(--muted); }
  .token-desc { margin-top: 0.5rem; font-size: 0.8rem; color: var(--muted); }
  .color-swatch { width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--border); display: inline-block; vertical-align: middle; margin-right: 0.5rem; }
  .spacing-bar { height: 8px; background: var(--accent); border-radius: 4px; margin-top: 0.25rem; min-width: 2px; }
  .alias-chain { font-size: 0.75rem; color: var(--muted); margin-top: 0.25rem; }
  .shadow-preview { width: 60px; height: 40px; background: var(--bg); border-radius: 6px; margin-top: 0.5rem; }
  .type-specimen { margin-top: 0.5rem; }
  .toast { position: fixed; bottom: 1.5rem; right: 1.5rem; padding: 0.5rem 1rem; background: #10b981; color: #fff; border-radius: 6px; font-size: 0.85rem; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
  .toast.show { opacity: 1; }
  .nav-links { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; }
  .nav-links a { font-size: 0.85rem; color: var(--accent); text-decoration: none; padding: 0.25rem 0.5rem; border: 1px solid var(--border); border-radius: 4px; }
  .nav-links a:hover { background: var(--accent); color: #fff; }
</style>
</head>
<body>
<h1>Design Token Documentation</h1>
<p class="meta">Generated: ${date} | Tokens: ${allTokenCount} | Collections: ${collections.length}</p>

<div class="controls">
  <input type="text" id="search" placeholder="Search tokens..." oninput="filterTokens()">
  <button onclick="toggleTheme()">Toggle Dark Mode</button>
</div>

<nav class="nav-links">
${categoryEntries.map(([key, cat]) => `  <a href="#cat-${encodeURIComponent(key)}">${cat.label} (${cat.tokens.length})</a>`).join("\n")}
</nav>

${categoryEntries.map(([key, category]) => {
    const modeNames = category.tokens.length > 0 ? Object.keys(category.tokens[0].values) : [];
    return `<section class="category" id="cat-${encodeURIComponent(key)}">
  <h2>${category.label}</h2>
  <div class="token-grid">
${category.tokens.map((token) => {
      const isColor = token.resolvedType === "COLOR";
      const isSpacing = /spacing|space|gap|padding|margin/i.test(token.name);
      const isShadow = /shadow|elevation/i.test(token.name);
      const isTypo = /font-size|font-weight|line-height|letter-spacing/i.test(token.name);

      let extras = "";
      if (isColor && args.includeVisualSwatches !== false) {
        const val = formatValue(Object.values(token.values)[0], "COLOR");
        extras += `<div class="color-swatch" style="background:${val};" title="${val}"></div>`;
      }
      if (isSpacing) {
        const val = Object.values(token.values)[0];
        const px = typeof val === "number" ? val : parseInt(String(val), 10) || 0;
        extras += `<div class="spacing-bar" style="width:${Math.min(px, 200)}px;" title="${px}px"></div>`;
      }
      if (isShadow) {
        extras += `<div class="shadow-preview" style="box-shadow: 0 2px 8px rgba(0,0,0,0.15);"></div>`;
      }
      if (isTypo) {
        const val = Object.values(token.values)[0];
        extras += `<div class="type-specimen" style="font-size:${typeof val === "number" ? val + "px" : val};">Aa Bb Cc 123</div>`;
      }

      const aliasHtml = token.aliasOf ? `<div class="alias-chain">Alias of: ${token.aliasOf}</div>` : "";
      const chainHtml = token.aliasChain ? `<div class="alias-chain">Chain: ${token.aliasChain.join(" -> ")}</div>` : "";

      return `    <div class="token-card" data-name="${token.name.toLowerCase()}">
      <div class="token-name" onclick="copyToken('${token.name}')">${token.name}</div>
      ${extras}
      <div class="token-values">
${modeNames.map((mode) => `        <div class="mode"><span class="mode-label">${mode}:</span> <span>${formatValue(token.values[mode], token.resolvedType)}</span></div>`).join("\n")}
      </div>
      ${aliasHtml}${chainHtml}
      ${token.description ? `<div class="token-desc">${token.description}</div>` : ""}
    </div>`;
    }).join("\n")}
  </div>
</section>`;
  }).join("\n\n")}

<div class="toast" id="toast">Copied!</div>

<script>
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', current === 'dark' ? '' : 'dark');
}

function filterTokens() {
  const q = document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('.token-card').forEach(card => {
    const name = card.getAttribute('data-name') || '';
    card.style.display = name.includes(q) ? '' : 'none';
  });
}

function copyToken(name) {
  navigator.clipboard.writeText(name).then(() => {
    const toast = document.getElementById('toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
  });
}
</script>
</body>
</html>`;
}

function renderFigmaPluginCode(
  categories: Map<string, TokenCategory>,
  _collections: RawCollection[],
  _allTokenCount: number,
  args: TokenDocsArgs
): string {
  const pageName = args.pageName || "Token Documentation";
  const categoryEntries = Array.from(categories.entries());

  // Build Plugin API code string to be executed via bridge.execute()
  const lines: string[] = [];
  lines.push(`(async () => {`);
  lines.push(`  // Create or find documentation page`);
  lines.push(`  let page = figma.root.children.find(p => p.name === ${JSON.stringify(pageName)});`);
  lines.push(`  if (!page) {`);
  lines.push(`    page = figma.createPage();`);
  lines.push(`    page.name = ${JSON.stringify(pageName)};`);
  lines.push(`  }`);
  lines.push(`  figma.currentPage = page;`);
  lines.push(``);
  lines.push(`  // Clear existing content on the page`);
  lines.push(`  for (const child of [...page.children]) child.remove();`);
  lines.push(``);
  lines.push(`  // Root frame with auto layout`);
  lines.push(`  const root = figma.createFrame();`);
  lines.push(`  root.name = "Token Documentation";`);
  lines.push(`  root.layoutMode = "VERTICAL";`);
  lines.push(`  root.primaryAxisSizingMode = "AUTO";`);
  lines.push(`  root.counterAxisSizingMode = "AUTO";`);
  lines.push(`  root.itemSpacing = 48;`);
  lines.push(`  root.paddingTop = 40;`);
  lines.push(`  root.paddingBottom = 40;`);
  lines.push(`  root.paddingLeft = 40;`);
  lines.push(`  root.paddingRight = 40;`);
  lines.push(`  root.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];`);
  lines.push(`  page.appendChild(root);`);
  lines.push(``);
  lines.push(`  // Helper: create text node`);
  lines.push(`  async function makeText(content, fontSize, isBold) {`);
  lines.push(`    const t = figma.createText();`);
  lines.push(`    await figma.loadFontAsync({ family: "Inter", style: isBold ? "Bold" : "Regular" });`);
  lines.push(`    t.fontName = { family: "Inter", style: isBold ? "Bold" : "Regular" };`);
  lines.push(`    t.fontSize = fontSize;`);
  lines.push(`    t.characters = content;`);
  lines.push(`    return t;`);
  lines.push(`  }`);
  lines.push(``);
  lines.push(`  // Title`);
  lines.push(`  const title = await makeText("Design Token Documentation", 32, true);`);
  lines.push(`  root.appendChild(title);`);
  lines.push(``);

  for (const [key, category] of categoryEntries) {
    const safeKey = key.replace(/[^a-zA-Z0-9]/g, "_");
    lines.push(`  // ── ${category.label} ──`);
    lines.push(`  const section_${safeKey} = figma.createFrame();`);
    lines.push(`  section_${safeKey}.name = "Section: ${category.label}";`);
    lines.push(`  section_${safeKey}.layoutMode = "VERTICAL";`);
    lines.push(`  section_${safeKey}.primaryAxisSizingMode = "AUTO";`);
    lines.push(`  section_${safeKey}.counterAxisSizingMode = "AUTO";`);
    lines.push(`  section_${safeKey}.itemSpacing = 16;`);
    lines.push(`  section_${safeKey}.fills = [];`);
    lines.push(`  root.appendChild(section_${safeKey});`);
    lines.push(``);
    lines.push(`  const header_${safeKey} = await makeText(${JSON.stringify(category.label)}, 24, true);`);
    lines.push(`  section_${safeKey}.appendChild(header_${safeKey});`);
    lines.push(``);

    // Token grid frame
    lines.push(`  const grid_${safeKey} = figma.createFrame();`);
    lines.push(`  grid_${safeKey}.name = "Tokens: ${category.label}";`);
    lines.push(`  grid_${safeKey}.layoutMode = "HORIZONTAL";`);
    lines.push(`  grid_${safeKey}.layoutWrap = "WRAP";`);
    lines.push(`  grid_${safeKey}.primaryAxisSizingMode = "FIXED";`);
    lines.push(`  grid_${safeKey}.resize(1000, 10);`);
    lines.push(`  grid_${safeKey}.counterAxisSizingMode = "AUTO";`);
    lines.push(`  grid_${safeKey}.itemSpacing = 12;`);
    lines.push(`  grid_${safeKey}.counterAxisSpacing = 12;`);
    lines.push(`  grid_${safeKey}.fills = [];`);
    lines.push(`  section_${safeKey}.appendChild(grid_${safeKey});`);
    lines.push(``);

    for (let i = 0; i < category.tokens.length; i++) {
      const token = category.tokens[i];
      const isColor = token.resolvedType === "COLOR";
      const firstModeValue = Object.values(token.values)[0];
      const modeNames = Object.keys(token.values);
      const tId = `${safeKey}_t${i}`;

      lines.push(`  {`);
      lines.push(`    const card = figma.createFrame();`);
      lines.push(`    card.name = ${JSON.stringify(token.name)};`);
      lines.push(`    card.layoutMode = "VERTICAL";`);
      lines.push(`    card.primaryAxisSizingMode = "AUTO";`);
      lines.push(`    card.counterAxisSizingMode = "FIXED";`);
      lines.push(`    card.resize(200, 10);`);
      lines.push(`    card.itemSpacing = 4;`);
      lines.push(`    card.paddingTop = 8; card.paddingBottom = 8; card.paddingLeft = 8; card.paddingRight = 8;`);
      lines.push(`    card.cornerRadius = 8;`);
      lines.push(`    card.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.97 } }];`);

      // Color swatch
      if (isColor && args.includeVisualSwatches !== false) {
        const colorVal = firstModeValue as { r?: number; g?: number; b?: number } | undefined;
        if (colorVal && typeof colorVal === "object" && "r" in colorVal) {
          lines.push(`    const swatch = figma.createRectangle();`);
          lines.push(`    swatch.resize(184, 40);`);
          lines.push(`    swatch.cornerRadius = 4;`);
          lines.push(`    swatch.fills = [{ type: "SOLID", color: { r: ${colorVal.r}, g: ${colorVal.g}, b: ${colorVal.b} } }];`);
          lines.push(`    card.appendChild(swatch);`);
        }
      }

      lines.push(`    const label = await makeText(${JSON.stringify(token.name)}, 11, true);`);
      lines.push(`    card.appendChild(label);`);

      // Show values per mode
      for (const mode of modeNames) {
        const val = formatValue(token.values[mode], token.resolvedType);
        lines.push(`    const val_${mode.replace(/[^a-zA-Z0-9]/g, "_")} = await makeText("${mode}: ${val.replace(/"/g, '\\"')}", 10, false);`);
        lines.push(`    card.appendChild(val_${mode.replace(/[^a-zA-Z0-9]/g, "_")});`);
      }

      lines.push(`    grid_${safeKey}.appendChild(card);`);
      lines.push(`  }`);
      lines.push(``);
    }
  }

  lines.push(`  figma.viewport.scrollAndZoomIntoView([root]);`);
  lines.push(`  return { success: true, page: page.name, nodeId: root.id };`);
  lines.push(`})();`);

  return lines.join("\n");
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function tokenDocsHandler(args: TokenDocsArgs): Promise<unknown> {
  const notes: string[] = [];
  const { categories, collections, allTokenCount } = await fetchAndOrganizeTokens(args);

  if (allTokenCount === 0) {
    return {
      ok: true,
      format: args.outputFormat,
      tokenCount: 0,
      collectionCount: collections.length,
      categoryCount: 0,
      output: args.outputFormat === "json" ? { generatedAt: todayStamp(), totalTokens: 0, collections: [], categories: {} } : "No tokens found.",
      notes: ["No variables found in the current Figma file. Ensure variables exist and the bridge plugin is running."],
    } satisfies TokenDocsResult;
  }

  notes.push(`Found ${allTokenCount} tokens across ${collections.length} collection(s) in ${categories.size} categor${categories.size === 1 ? "y" : "ies"}.`);

  let output: string | TokenDocsJsonOutput;

  switch (args.outputFormat) {
    case "markdown":
      output = renderMarkdown(categories, collections, allTokenCount, args);
      break;

    case "json":
      output = renderJson(categories, collections, allTokenCount, args);
      break;

    case "html":
      output = renderHtml(categories, collections, allTokenCount, args);
      break;

    case "figma": {
      const pluginCode = renderFigmaPluginCode(categories, collections, allTokenCount, args);
      const bridge = await getBridge();
      const result = await bridge.execute(pluginCode);
      if (!result.success) {
        return {
          ok: false,
          format: "figma",
          tokenCount: allTokenCount,
          collectionCount: collections.length,
          categoryCount: categories.size,
          output: `Figma plugin execution failed: ${JSON.stringify(result)}`,
          notes: ["The Plugin API code failed to execute. Check that Figma is open and the bridge plugin is active."],
        } satisfies TokenDocsResult;
      }
      output = `Documentation page created in Figma. ${JSON.stringify(result.result)}`;
      notes.push("Created Figma documentation page with token swatches, labels, and values.");
      break;
    }

    default:
      throw new Error(`Unsupported output format: ${args.outputFormat}`);
  }

  return {
    ok: true,
    format: args.outputFormat,
    tokenCount: allTokenCount,
    collectionCount: collections.length,
    categoryCount: categories.size,
    output,
    notes,
  } satisfies TokenDocsResult;
}
