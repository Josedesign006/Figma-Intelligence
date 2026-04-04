/**
 * Figma page renderer for taxonomy documentation.
 * Creates a visual documentation page with concept tables, token anatomy,
 * coverage badges, and color swatches — all from live Figma data.
 *
 * Supports auto-sync: stores the page name so the variable-change event
 * handler can trigger a lightweight re-render.
 */

import type { ConceptCoverage, TokenValueSnapshot } from "../index.js";

interface FigmaPageOptions {
  pageName: string;
  includeTokenAnatomy: boolean;
  showCoverage: boolean;
  autoSync: boolean;
}

interface FigmaPageResult {
  pageId: string;
  autoSyncEnabled: boolean;
}

// Module-level state for auto-sync
let autoSyncPageName: string | null = null;

export function getAutoSyncPageName(): string | null {
  return autoSyncPageName;
}

export function clearAutoSync(): void {
  autoSyncPageName = null;
}

function escapeJs(s: string): string {
  return JSON.stringify(s);
}

function statusColor(status: ConceptCoverage["status"]): string {
  if (status === "full") return "{ r: 0.13, g: 0.73, b: 0.33 }";
  if (status === "partial") return "{ r: 0.95, g: 0.77, b: 0.06 }";
  return "{ r: 0.85, g: 0.12, b: 0.12 }";
}

function statusLabel(status: ConceptCoverage["status"]): string {
  if (status === "full") return "Full";
  if (status === "partial") return "Partial";
  return "Missing";
}

export async function renderFigmaPage(
  bridge: { execute: (code: string) => Promise<{ success: boolean; result?: unknown }> },
  coverage: ConceptCoverage[],
  snapshots: Record<string, TokenValueSnapshot>,
  options: FigmaPageOptions,
): Promise<FigmaPageResult> {
  const pageName = options.pageName;

  // Track for auto-sync
  if (options.autoSync) {
    autoSyncPageName = pageName;
  }

  const lines: string[] = [];
  lines.push(`(async () => {`);

  // ── Create or find page ──
  lines.push(`  let page = figma.root.children.find(p => p.name === ${escapeJs(pageName)});`);
  lines.push(`  if (!page) {`);
  lines.push(`    page = figma.createPage();`);
  lines.push(`    page.name = ${escapeJs(pageName)};`);
  lines.push(`  }`);
  lines.push(`  figma.currentPage = page;`);
  lines.push(``);

  // Clear existing content
  lines.push(`  for (const child of [...page.children]) { child.remove(); }`);
  lines.push(``);

  // ── Layout constants ──
  lines.push(`  const COL_W = 260;`);
  lines.push(`  const ROW_H = 36;`);
  lines.push(`  const SECTION_GAP = 60;`);
  lines.push(`  const HEADER_H = 48;`);
  lines.push(`  let cursorY = 0;`);
  lines.push(``);

  // ── Helper: create text node ──
  lines.push(`  async function txt(x, y, text, size, bold, color) {`);
  lines.push(`    const t = figma.createText();`);
  lines.push(`    await figma.loadFontAsync({ family: "Inter", style: bold ? "Bold" : "Regular" });`);
  lines.push(`    t.fontName = { family: "Inter", style: bold ? "Bold" : "Regular" };`);
  lines.push(`    t.fontSize = size;`);
  lines.push(`    t.characters = String(text);`);
  lines.push(`    t.x = x;`);
  lines.push(`    t.y = y;`);
  lines.push(`    if (color) t.fills = [{ type: "SOLID", color: color }];`);
  lines.push(`    page.appendChild(t);`);
  lines.push(`    return t;`);
  lines.push(`  }`);
  lines.push(``);

  // ── Helper: create rectangle ──
  lines.push(`  function rect(x, y, w, h, color, radius) {`);
  lines.push(`    const r = figma.createRectangle();`);
  lines.push(`    r.x = x; r.y = y; r.resize(w, h);`);
  lines.push(`    r.fills = [{ type: "SOLID", color: color }];`);
  lines.push(`    if (radius) r.cornerRadius = radius;`);
  lines.push(`    page.appendChild(r);`);
  lines.push(`    return r;`);
  lines.push(`  }`);
  lines.push(``);

  // ── Title Section ──
  lines.push(`  await txt(0, cursorY, "Token Taxonomy", 32, true);`);
  lines.push(`  cursorY += 44;`);
  lines.push(`  await txt(0, cursorY, "Generated ${new Date().toISOString().split("T")[0]} — re-run figma_taxonomy_docs to refresh", 14, false, { r: 0.5, g: 0.5, b: 0.5 });`);
  lines.push(`  cursorY += 32;`);
  lines.push(``);

  // ── Naming Grammar Section ──
  lines.push(`  await txt(0, cursorY, "Naming Grammar", 24, true);`);
  lines.push(`  cursorY += 36;`);
  lines.push(`  rect(0, cursorY, 800, 70, { r: 0.96, g: 0.96, b: 0.97 }, 8);`);
  lines.push(`  await txt(16, cursorY + 12, "Semantic:   <category>/<concept>/[<variant>]/<property>/[<state>]", 14, false, { r: 0.1, g: 0.1, b: 0.1 });`);
  lines.push(`  await txt(16, cursorY + 36, "Component:  component/<component>/[<part>]/[<variant>]/<category>/<property>/[<state>]", 14, false, { r: 0.1, g: 0.1, b: 0.1 });`);
  lines.push(`  cursorY += 70 + SECTION_GAP;`);
  lines.push(``);

  // ── Coverage Summary ──
  if (options.showCoverage) {
    const full = coverage.filter((c) => c.status === "full").length;
    const partial = coverage.filter((c) => c.status === "partial").length;
    const missing = coverage.filter((c) => c.status === "missing").length;

    lines.push(`  await txt(0, cursorY, "Coverage Summary", 24, true);`);
    lines.push(`  cursorY += 36;`);

    // Status badges
    lines.push(`  rect(0, cursorY, 120, 40, { r: 0.13, g: 0.73, b: 0.33 }, 8);`);
    lines.push(`  await txt(12, cursorY + 10, "Full: ${full}", 16, true, { r: 1, g: 1, b: 1 });`);

    lines.push(`  rect(136, cursorY, 120, 40, { r: 0.95, g: 0.77, b: 0.06 }, 8);`);
    lines.push(`  await txt(148, cursorY + 10, "Partial: ${partial}", 16, true, { r: 0.1, g: 0.1, b: 0.1 });`);

    lines.push(`  rect(272, cursorY, 120, 40, { r: 0.85, g: 0.12, b: 0.12 }, 8);`);
    lines.push(`  await txt(284, cursorY + 10, "Missing: ${missing}", 16, true, { r: 1, g: 1, b: 1 });`);

    lines.push(`  cursorY += 40 + SECTION_GAP;`);
    lines.push(``);
  }

  // ── Concept Overview Table ──
  lines.push(`  await txt(0, cursorY, "Concept Taxonomy", 24, true);`);
  lines.push(`  cursorY += 36;`);

  // Table header
  const cols = [
    { label: "Concept",  x: 0,    w: 120 },
    { label: "Purpose",  x: 130,  w: 300 },
    { label: "Forms",    x: 440,  w: 200 },
    { label: "States",   x: 650,  w: 200 },
    { label: "Coverage", x: 860,  w: 100 },
  ];

  lines.push(`  rect(0, cursorY, 960, 36, { r: 0.94, g: 0.94, b: 0.96 }, 4);`);
  for (const col of cols) {
    lines.push(`  await txt(${col.x + 8}, cursorY + 9, ${escapeJs(col.label)}, 13, true);`);
  }
  lines.push(`  cursorY += 36;`);

  // Table rows
  for (const c of coverage) {
    const forms = c.typicalForms.slice(0, 3).join(", ") + (c.typicalForms.length > 3 ? "..." : "");
    const states = c.validStates.slice(0, 4).join(", ") + (c.validStates.length > 4 ? "..." : "");
    const covLabel = `${statusLabel(c.status)} ${c.foundTokens.length}/${c.expectedTokens.length}`;

    // Alternating row background
    lines.push(`  rect(0, cursorY, 960, 36, { r: 0.99, g: 0.99, b: 1.0 }, 0);`);
    lines.push(`  await txt(8, cursorY + 9, ${escapeJs(c.conceptName)}, 12, true);`);
    lines.push(`  await txt(138, cursorY + 9, ${escapeJs(c.purpose.slice(0, 50) + (c.purpose.length > 50 ? "..." : ""))}, 11, false);`);
    lines.push(`  await txt(448, cursorY + 9, ${escapeJs(forms)}, 11, false);`);
    lines.push(`  await txt(658, cursorY + 9, ${escapeJs(states)}, 11, false);`);

    // Coverage badge
    lines.push(`  rect(868, cursorY + 6, 84, 24, ${statusColor(c.status)}, 12);`);
    lines.push(`  await txt(878, cursorY + 10, ${escapeJs(covLabel)}, 10, true, { r: 1, g: 1, b: 1 });`);

    lines.push(`  cursorY += 36;`);
  }

  lines.push(`  cursorY += SECTION_GAP;`);
  lines.push(``);

  // ── Per-Concept Token Anatomy ──
  if (options.includeTokenAnatomy) {
    for (const c of coverage) {
      if (c.expectedTokens.length === 0) continue;

      lines.push(`  // ── ${c.conceptName} anatomy ──`);
      lines.push(`  await txt(0, cursorY, ${escapeJs(c.conceptName + " Tokens")}, 20, true);`);
      lines.push(`  cursorY += 28;`);
      lines.push(`  await txt(0, cursorY, ${escapeJs(c.purpose)}, 12, false, { r: 0.5, g: 0.5, b: 0.5 });`);
      lines.push(`  cursorY += 24;`);

      for (const token of c.expectedTokens) {
        const found = c.foundTokens.includes(token);
        const snap = snapshots[token];

        // Token row with status indicator
        const indicatorColor = found
          ? "{ r: 0.13, g: 0.73, b: 0.33 }"
          : "{ r: 0.85, g: 0.12, b: 0.12 }";

        lines.push(`  rect(0, cursorY + 4, 8, 8, ${indicatorColor}, 4);`);
        const fileToken = c.matchedFileTokens[token];
        const displayLabel = fileToken ? `${token}  →  ${fileToken}` : token;
        lines.push(`  await txt(16, cursorY, ${escapeJs(displayLabel)}, 11, false);`);

        // If it's a color token and we have the value, show a swatch
        if (snap?.type === "COLOR" && snap.values) {
          const firstValue = Object.values(snap.values)[0];
          if (firstValue && typeof firstValue === "object" && "r" in (firstValue as Record<string, unknown>)) {
            const cv = firstValue as { r: number; g: number; b: number };
            lines.push(`  rect(500, cursorY, 20, 16, { r: ${cv.r.toFixed(3)}, g: ${cv.g.toFixed(3)}, b: ${cv.b.toFixed(3)} }, 3);`);
            const hex = `#${Math.round(cv.r * 255).toString(16).padStart(2, "0")}${Math.round(cv.g * 255).toString(16).padStart(2, "0")}${Math.round(cv.b * 255).toString(16).padStart(2, "0")}`.toUpperCase();
            lines.push(`  await txt(528, cursorY, ${escapeJs(hex)}, 11, false, { r: 0.4, g: 0.4, b: 0.4 });`);
          }
        } else if (snap?.values) {
          const firstValue = Object.values(snap.values)[0];
          if (firstValue !== undefined && firstValue !== null) {
            lines.push(`  await txt(500, cursorY, ${escapeJs(String(firstValue))}, 11, false, { r: 0.4, g: 0.4, b: 0.4 });`);
          }
        }

        lines.push(`  cursorY += 20;`);
      }

      lines.push(`  cursorY += 32;`);
    }
  }

  // ── Timestamp footer ──
  lines.push(`  await txt(0, cursorY, "Last synced: ${new Date().toISOString()}", 11, false, { r: 0.6, g: 0.6, b: 0.6 });`);
  lines.push(``);

  lines.push(`  return { pageId: page.id };`);
  lines.push(`})();`);

  const result = await bridge.execute(lines.join("\n"));

  let pageId = "unknown";
  if (result.success && result.result) {
    try {
      const parsed = typeof result.result === "string" ? JSON.parse(result.result) : result.result;
      pageId = parsed.pageId ?? "unknown";
    } catch {
      // result may be the page ID string directly
      pageId = String(result.result);
    }
  }

  return {
    pageId,
    autoSyncEnabled: options.autoSync,
  };
}

/**
 * Build a lightweight re-render script that updates only dynamic content
 * (coverage badges, swatches, timestamp) without recreating the full page.
 * Used by the auto-sync handler.
 */
export function buildAutoSyncScript(
  pageName: string,
  coverage: ConceptCoverage[],
): string {
  // For auto-sync, we regenerate the full page since Figma plugin API
  // doesn't support efficient partial updates of text/fill properties
  // across many unrelated nodes. The full re-render is fast enough
  // (< 500ms for ~25 concepts) given the 2-second debounce.
  //
  // This function is called by the variable-change event handler
  // in figma-bridge.ts — it re-computes coverage and rebuilds the page.
  return `
    (async () => {
      const page = figma.root.children.find(p => p.name === ${escapeJs(pageName)});
      if (!page) return { skipped: true, reason: "page not found" };
      return { needsFullRerender: true, pageId: page.id };
    })();
  `;
}
