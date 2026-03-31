"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderFigmaPage = renderFigmaPage;
/**
 * Figma Page renderer — entire spec in ONE auto-layout master frame.
 *
 * Strategy: keep execute() payloads SMALL and SIMPLE.
 * - Master frame: VERTICAL auto layout
 * - Each section: 1 bridge call → title text + body text + optional spacer/divider
 * - Tables: rendered as well-formatted text (not sub-frames) for reliability
 * - All text nodes use layoutSizingHorizontal = "FILL"
 */
const figma_bridge_js_1 = require("../../../../shared/figma-bridge.js");
const anatomy_diagram_js_1 = require("./anatomy-diagram.js");
const PAGE_W = 1200;
const PAD = 50;
const SECTION_GAP = 44;
const INNER_GAP = 10;
function esc(s) { return JSON.stringify(s); }
// ── Font loader (compact) ──────────────────────────────────────────────────
const FL = `
var F={};
async function lf(k,a){for(var i=0;i<a.length;i++){try{await figma.loadFontAsync(a[i]);F[k]=a[i];return}catch(e){}}F[k]={family:"Arial",style:"Regular"};try{await figma.loadFontAsync(F[k])}catch(e){}}
await lf("b",[{family:"Inter",style:"Bold"},{family:"Roboto",style:"Bold"}]);
await lf("sb",[{family:"Inter",style:"SemiBold"},{family:"Inter",style:"Medium"},{family:"Roboto",style:"Medium"}]);
await lf("r",[{family:"Inter",style:"Regular"},{family:"Roboto",style:"Regular"}]);
`;
// ── Content → formatted string ─────────────────────────────────────────────
function formatTable(headers, rows) {
    if (rows.length === 0)
        return "(No data)";
    const all = [headers, ...rows];
    const widths = headers.map((_, ci) => Math.min(Math.max(...all.map(r => (r[ci] || "").length), 3), 45));
    const hdr = headers.map((h, i) => h.padEnd(widths[i])).join("    ");
    const sep = widths.map(w => "\u2500".repeat(w)).join("\u2500\u2500\u2500\u2500");
    const body = rows.slice(0, 50).map(row => row.map((cell, i) => (cell || "\u2014").padEnd(widths[i] || 4)).join("    "));
    return [hdr, sep, ...body].join("\n");
}
function contentToString(content) {
    switch (content.kind) {
        case "key-value":
            return content.entries.map(e => `${e.label}:  ${e.value}`).join("\n");
        case "table":
            return formatTable(content.headers, content.rows);
        case "structured-data":
            return formatTable(content.columns, content.rows.map(r => content.columns.map(c => r[c] ?? "\u2014")));
        case "list":
        case "rules":
            return content.items.map(item => `\u2022  ${item}`).join("\n");
        case "do-dont": {
            const parts = [];
            if (content.dos.length > 0) {
                parts.push("Do:");
                parts.push(...content.dos.map(d => `  \u2713  ${d}`));
            }
            if (content.donts.length > 0) {
                if (parts.length > 0)
                    parts.push("");
                parts.push("Don\u2019t:");
                parts.push(...content.donts.map(d => `  \u2717  ${d}`));
            }
            return parts.join("\n");
        }
        case "paragraph":
            return content.text;
        case "mixed":
            return content.blocks.map(b => contentToString(b)).filter(Boolean).join("\n\n");
    }
}
// ── Create page + master frame ─────────────────────────────────────────────
async function init(bridge, pageName) {
    const r = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      var nm = ${esc(pageName)};
      var mm = figma.root.children.filter(function(p){ return p.name === nm; });
      var pg;
      if (mm.length > 0) { pg = mm[0]; for (var d=1; d<mm.length; d++) mm[d].remove(); }
      else { pg = figma.createPage(); }
      pg.name = nm;
      await figma.setCurrentPageAsync(pg);
      var ch = pg.children.slice();
      for (var i=0; i<ch.length; i++) ch[i].remove();

      var m = figma.createFrame();
      m.name = "Component Spec";
      m.layoutMode = "VERTICAL";
      m.primaryAxisSizingMode = "AUTO";
      m.counterAxisSizingMode = "FIXED";
      m.resize(${PAGE_W}, 100);
      m.paddingTop = ${PAD};
      m.paddingBottom = ${PAD};
      m.paddingLeft = ${PAD};
      m.paddingRight = ${PAD};
      m.itemSpacing = 0;
      m.fills = [{type:"SOLID", color:{r:1,g:1,b:1}}];
      m.clipsContent = false;
      pg.appendChild(m);
      return { pageId: pg.id, mId: m.id };
    })();
  `);
    if (!r.success)
        throw new Error(`Init: ${r.error}`);
    return r.result;
}
// ── Render header ──────────────────────────────────────────────────────────
async function renderHeader(bridge, mId, name, subtitle) {
    const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m = await figma.getNodeByIdAsync(${esc(mId)});
      if (!m) return { error: "no master" };

      var t = figma.createText();
      t.fontName = F.b;
      t.fontSize = 36;
      t.lineHeight = {unit:"PIXELS", value:46};
      t.characters = ${esc(name)};
      t.fills = [{type:"SOLID", color:{r:0.07,g:0.07,b:0.07}}];
      t.textAutoResize = "HEIGHT";
      t.layoutSizingHorizontal = "FILL";
      m.appendChild(t);

      var sp = figma.createFrame();
      sp.resize(4, 10); sp.fills = [];
      sp.layoutSizingHorizontal = "FILL";
      m.appendChild(sp);

      var s = figma.createText();
      s.fontName = F.r;
      s.fontSize = 14;
      s.lineHeight = {unit:"PIXELS", value:22};
      s.characters = ${esc(subtitle)};
      s.fills = [{type:"SOLID", color:{r:0.5,g:0.5,b:0.53}}];
      s.textAutoResize = "HEIGHT";
      s.layoutSizingHorizontal = "FILL";
      m.appendChild(s);

      var sp2 = figma.createFrame();
      sp2.resize(4, 28); sp2.fills = [];
      sp2.layoutSizingHorizontal = "FILL";
      m.appendChild(sp2);

      var dv = figma.createRectangle();
      dv.resize(4, 1);
      dv.fills = [{type:"SOLID", color:{r:0.88,g:0.88,b:0.9}}];
      dv.layoutSizingHorizontal = "FILL";
      m.appendChild(dv);

      return { ok: true };
    })();
  `);
    if (!r.success)
        console.error("Header failed:", r.error);
}
// ── Render one section (title + body in one call) ──────────────────────────
async function renderSection(bridge, mId, title, body, addDivider) {
    const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m = await figma.getNodeByIdAsync(${esc(mId)});
      if (!m) return { error: "no master" };

      // Gap before section
      var sp1 = figma.createFrame();
      sp1.resize(4, ${SECTION_GAP}); sp1.fills = [];
      sp1.layoutSizingHorizontal = "FILL";
      m.appendChild(sp1);

      ${addDivider ? `
      var dv = figma.createRectangle();
      dv.resize(4, 1);
      dv.fills = [{type:"SOLID", color:{r:0.88,g:0.88,b:0.9}}];
      dv.layoutSizingHorizontal = "FILL";
      m.appendChild(dv);

      var sp2 = figma.createFrame();
      sp2.resize(4, ${SECTION_GAP}); sp2.fills = [];
      sp2.layoutSizingHorizontal = "FILL";
      m.appendChild(sp2);
      ` : ""}

      // Section title
      var tt = figma.createText();
      tt.fontName = F.b;
      tt.fontSize = 22;
      tt.lineHeight = {unit:"PIXELS", value:32};
      tt.characters = ${esc(title)};
      tt.fills = [{type:"SOLID", color:{r:0.07,g:0.07,b:0.07}}];
      tt.textAutoResize = "HEIGHT";
      tt.layoutSizingHorizontal = "FILL";
      m.appendChild(tt);

      // Small gap
      var sp3 = figma.createFrame();
      sp3.resize(4, ${INNER_GAP}); sp3.fills = [];
      sp3.layoutSizingHorizontal = "FILL";
      m.appendChild(sp3);

      // Body text
      var body = ${esc(body)};
      if (body && body.trim()) {
        var bt = figma.createText();
        bt.fontName = F.r;
        bt.fontSize = 14;
        bt.lineHeight = {unit:"PIXELS", value:24};
        bt.characters = body;
        bt.fills = [{type:"SOLID", color:{r:0.27,g:0.27,b:0.29}}];
        bt.textAutoResize = "HEIGHT";
        bt.layoutSizingHorizontal = "FILL";
        m.appendChild(bt);
      }

      return { ok: true };
    })();
  `);
    if (!r.success)
        console.error(`Section "${title}" failed:`, r.error);
}
// ── Main entry ─────────────────────────────────────────────────────────────
async function renderFigmaPage(spec, pageName) {
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    const resolvedName = pageName || `${spec.componentName} \u2014 Spec`;
    // 1. Page + master frame
    const { pageId, mId } = await init(bridge, resolvedName);
    // 2. Header
    const nav = spec.sections.map(s => s.title).slice(0, 8).join("  \u00B7  ");
    await renderHeader(bridge, mId, spec.componentName, `Full Component Spec  \u2192  ${nav}`);
    // 3. Sections — one call each, body pre-formatted as text
    for (let i = 0; i < spec.sections.length; i++) {
        const sec = spec.sections[i];
        const body = contentToString(sec.content);
        await renderSection(bridge, mId, sec.title, body, i > 0);
    }
    // 4. Bottom padding
    try {
        await bridge.execute(`
      (async () => {
        var m = await figma.getNodeByIdAsync(${esc(mId)});
        if (!m) return;
        var sp = figma.createFrame();
        sp.resize(4, ${PAD}); sp.fills = [];
        sp.layoutSizingHorizontal = "FILL";
        m.appendChild(sp);
      })();
    `);
    }
    catch { /* ok */ }
    // 5. Zoom to fit
    try {
        await bridge.execute(`
      (async () => {
        var pg = await figma.getNodeByIdAsync(${esc(pageId)});
        if (pg && pg.type === "PAGE" && pg.children.length > 0)
          figma.viewport.scrollAndZoomIntoView(pg.children);
      })();
    `);
    }
    catch { /* ok */ }
    // 6. Anatomy diagram below master
    if (spec.extraction.anatomy.elements.length > 0) {
        try {
            const hR = await bridge.execute(`
        (async () => {
          var m = await figma.getNodeByIdAsync(${esc(mId)});
          return m ? m.height : 2000;
        })();
      `);
            const mH = (hR.success && typeof hR.result === "number") ? hR.result : 2000;
            await (0, anatomy_diagram_js_1.renderAnatomyDiagram)(bridge, pageId, spec.nodeId, spec.extraction.anatomy, mH + 60);
        }
        catch (err) {
            console.error(`Anatomy diagram failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    return pageId;
}
//# sourceMappingURL=figma-page.js.map