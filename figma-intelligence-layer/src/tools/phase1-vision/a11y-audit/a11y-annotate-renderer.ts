/**
 * Accessibility Annotation Renderer — Page-based
 * Creates a new Figma page matching the reference layout:
 *   1. Header: "Keyboard Focus Order" + subtitle + divider
 *   2. Left: Screenshot of the target frame with numbered circle markers
 *   3. Right: "Tab Order Sequence" table (# | Element | Role | ARIA/Notes)
 *            + "Implementation Notes" bullets
 *
 * Rendering is split into small bridge.execute steps for reliability.
 *
 * CRITICAL Figma Plugin API rules:
 *   1. fontName MUST be set BEFORE characters
 *   2. layoutSizingHorizontal = "FILL" only works AFTER appendChild()
 *   3. exportAsync returns Uint8Array; figma.createImage(bytes) makes ImageHash
 */

import { STAMP_SPECS } from "./a11y-annotation-kit.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MarkerDef {
  number: number;
  elementX: number;
  elementY: number;
  elementW: number;
  elementH: number;
}

export interface TabOrderRow {
  number: number;
  element: string;
  role: string;
  ariaNote: string;
}

export interface AnnotationPageOpts {
  sourceNodeId: string;
  frameName: string;
  markers: MarkerDef[];
  tableRows: TabOrderRow[];
  implNotes: string[];
  annotationType: string;
}

// ─── Bridge type ────────────────────────────────────────────────────────────

type Bridge = {
  execute(code: string): Promise<{ success: boolean; result?: unknown; error?: string }>;
};

function esc(s: string): string { return JSON.stringify(s); }

// ─── Font Loader ────────────────────────────────────────────────────────────

const FL = `
var F={};
async function lf(k,a){for(var i=0;i<a.length;i++){try{await figma.loadFontAsync(a[i]);F[k]=a[i];return}catch(e){}}F[k]={family:"Arial",style:"Regular"};try{await figma.loadFontAsync(F[k])}catch(e){}}
await lf("b",[{family:"Inter",style:"Bold"},{family:"Roboto",style:"Bold"}]);
await lf("r",[{family:"Inter",style:"Regular"},{family:"Roboto",style:"Regular"}]);
`;

// ─── Design Tokens ──────────────────────────────────────────────────────────

const MK = STAMP_SPECS;
const MAX_LEFT_COL_W = 620;

// ─── Main Renderer ──────────────────────────────────────────────────────────

export async function renderAnnotationPage(
  bridge: Bridge,
  opts: AnnotationPageOpts,
): Promise<{ pageId: string }> {
  const { sourceNodeId, frameName, markers, tableRows, implNotes } = opts;
  const pageName = `Keyboard Focus Order — ${frameName}`;

  // ── Step 1: Create page + master frame ──────────────────────────────────
  const step1 = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      var nm = ${esc(pageName)};
      var existing = figma.root.children.filter(function(p) { return p.name === nm; });
      var pg;
      if (existing.length > 0) {
        pg = existing[0];
        for (var d = 1; d < existing.length; d++) existing[d].remove();
        var ch = pg.children.slice();
        for (var i = 0; i < ch.length; i++) ch[i].remove();
      } else {
        pg = figma.createPage();
      }
      pg.name = nm;
      await figma.setCurrentPageAsync(pg);

      var m = figma.createFrame();
      m.name = "Keyboard Focus Order";
      m.layoutMode = "VERTICAL";
      m.primaryAxisSizingMode = "AUTO";
      m.counterAxisSizingMode = "FIXED";
      m.resize(1440, 100);
      m.paddingTop = 60;
      m.paddingBottom = 60;
      m.paddingLeft = 60;
      m.paddingRight = 60;
      m.itemSpacing = 0;
      m.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      m.clipsContent = false;
      pg.appendChild(m);

      return { pageId: pg.id, mId: m.id };
    })();
  `);
  if (!step1.success) throw new Error(`Step 1 failed: ${step1.error}`);
  const { pageId, mId } = step1.result as { pageId: string; mId: string };

  // ── Step 2: Header — title, subtitle, divider ──────────────────────────
  await bridge.execute(`
    (async () => {
      ${FL}
      var m = await figma.getNodeByIdAsync(${esc(mId)});

      var title = figma.createText();
      title.fontName = F.b;
      title.fontSize = 28;
      title.lineHeight = { unit: "PIXELS", value: 36 };
      title.characters = "Keyboard Focus Order";
      title.fills = [{ type: "SOLID", color: { r: 0.13, g: 0.13, b: 0.13 } }];
      title.textAutoResize = "HEIGHT";
      m.appendChild(title);
      title.layoutSizingHorizontal = "FILL";

      var sp1 = figma.createFrame(); sp1.resize(4, 6); sp1.fills = [];
      m.appendChild(sp1); sp1.layoutSizingHorizontal = "FILL";

      var sub = figma.createText();
      sub.fontName = F.r;
      sub.fontSize = 14;
      sub.lineHeight = { unit: "PIXELS", value: 20 };
      sub.characters = ${esc(`${frameName}  \u00b7  WCAG 2.1 AA  \u00b7  Tab Order Sequence`)};
      sub.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
      sub.textAutoResize = "HEIGHT";
      m.appendChild(sub);
      sub.layoutSizingHorizontal = "FILL";

      var sp2 = figma.createFrame(); sp2.resize(4, 24); sp2.fills = [];
      m.appendChild(sp2); sp2.layoutSizingHorizontal = "FILL";

      var dv = figma.createRectangle();
      dv.resize(4, 1);
      dv.fills = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.88 } }];
      m.appendChild(dv);
      dv.layoutSizingHorizontal = "FILL";

      var sp3 = figma.createFrame(); sp3.resize(4, 40); sp3.fills = [];
      m.appendChild(sp3); sp3.layoutSizingHorizontal = "FILL";

      return { ok: true };
    })();
  `);

  // ── Step 3: Content row + left column with exported image + markers ────
  const step3 = await bridge.execute(`
    (async () => {
      ${FL}
      var m = await figma.getNodeByIdAsync(${esc(mId)});

      // Content row
      var row = figma.createFrame();
      row.name = "Content";
      row.layoutMode = "HORIZONTAL";
      row.primaryAxisSizingMode = "AUTO";
      row.counterAxisSizingMode = "AUTO";
      row.primaryAxisAlignItems = "MIN";
      row.counterAxisAlignItems = "MIN";
      row.itemSpacing = 60;
      row.fills = [];
      m.appendChild(row);
      row.layoutSizingHorizontal = "FILL";

      // Get source node for export
      var srcNode = await figma.getNodeByIdAsync(${esc(sourceNodeId)});
      if (!srcNode) throw new Error("Source node not found");

      var srcBBox = srcNode.absoluteBoundingBox;
      var srcW = srcBBox ? srcBBox.width : (srcNode.width || 600);
      var srcH = srcBBox ? srcBBox.height : (srcNode.height || 800);
      var srcX = srcBBox ? srcBBox.x : 0;
      var srcY = srcBBox ? srcBBox.y : 0;

      // Scale image to fit within max left column width
      var maxLeftW = ${MAX_LEFT_COL_W};
      var scale = 1;
      if (srcW > maxLeftW) {
        scale = maxLeftW / srcW;
      }
      var dispW = Math.round(srcW * scale);
      var dispH = Math.round(srcH * scale);

      // Export frame as PNG image
      var bytes = await srcNode.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 2 } });
      var img = figma.createImage(bytes);

      // Left column — container for image + markers
      var pad = 20;
      var leftCol = figma.createFrame();
      leftCol.name = "Design Preview";
      leftCol.layoutMode = "NONE";
      leftCol.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
      leftCol.cornerRadius = 8;
      leftCol.clipsContent = false;
      leftCol.resize(dispW + pad * 2, dispH + pad * 2);

      // Image rectangle (scaled)
      var imgRect = figma.createRectangle();
      imgRect.name = "Screen Image";
      imgRect.resize(dispW, dispH);
      imgRect.x = pad;
      imgRect.y = pad;
      imgRect.fills = [{
        type: "IMAGE",
        imageHash: img.hash,
        scaleMode: "FILL",
      }];
      imgRect.cornerRadius = 4;
      leftCol.appendChild(imgRect);

      // Place markers at top-right corner of each element (scaled)
      var markers = ${JSON.stringify(markers)};
      var markerSize = ${MK.markerSize};
      for (var mi = 0; mi < markers.length; mi++) {
        var mk = markers[mi];
        // Scale element position relative to source frame
        var elX = (mk.elementX - srcX) * scale;
        var elY = (mk.elementY - srcY) * scale;
        var elW = mk.elementW * scale;

        // Position marker outside the element — anchor at top-right,
        // shifted so the circle sits beyond the bounding box edge
        var markerX = elX + elW - 4 + pad;
        var markerY = elY - markerSize + 4 + pad;

        // Clamp to stay within preview bounds
        markerX = Math.max(0, Math.min(markerX, dispW + pad * 2 - markerSize));
        markerY = Math.max(0, Math.min(markerY, dispH + pad * 2 - markerSize));

        var circle = figma.createEllipse();
        circle.name = "Marker " + mk.number;
        circle.resize(markerSize, markerSize);
        circle.fills = [{ type: "SOLID", color: { r: ${MK.markerColor.r}, g: ${MK.markerColor.g}, b: ${MK.markerColor.b} } }];
        circle.strokes = [{ type: "SOLID", color: { r: ${MK.markerStrokeColor.r}, g: ${MK.markerStrokeColor.g}, b: ${MK.markerStrokeColor.b} } }];
        circle.strokeWeight = ${MK.markerStrokeWeight};
        circle.strokeAlign = "OUTSIDE";
        circle.effects = [{
          type: "DROP_SHADOW",
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 1 },
          radius: 3,
          visible: true,
        }];
        circle.x = markerX;
        circle.y = markerY;
        leftCol.appendChild(circle);

        var numTxt = figma.createText();
        numTxt.fontName = F.b;
        numTxt.fontSize = ${MK.markerFontSize};
        numTxt.characters = String(mk.number);
        numTxt.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        numTxt.textAlignHorizontal = "CENTER";
        numTxt.textAutoResize = "WIDTH_AND_HEIGHT";
        leftCol.appendChild(numTxt);
        numTxt.x = markerX + (markerSize - numTxt.width) / 2;
        numTxt.y = markerY + (markerSize - numTxt.height) / 2;
      }

      row.appendChild(leftCol);

      return { rowId: row.id, srcW: srcW, srcH: srcH };
    })();
  `);
  if (!step3.success) throw new Error(`Step 3 failed: ${step3.error}`);
  const { rowId } = step3.result as { rowId: string };

  // ── Step 4: Right column — table + implementation notes ────────────────
  await renderRightColumn(bridge, rowId, tableRows, implNotes);

  // ── Step 5: Zoom to fit ────────────────────────────────────────────────
  await bridge.execute(`
    (async () => {
      var m = await figma.getNodeByIdAsync(${esc(mId)});
      if (m) figma.viewport.scrollAndZoomIntoView([m]);
      return { ok: true };
    })();
  `);

  return { pageId };
}

// ─── Right Column: Table + Implementation Notes ────────────────────────────

async function renderRightColumn(
  bridge: Bridge,
  contentRowId: string,
  tableRows: TabOrderRow[],
  implNotes: string[],
): Promise<void> {
  // Create right column + table heading + table header row
  const initRight = await bridge.execute(`
    (async () => {
      ${FL}
      var row = await figma.getNodeByIdAsync(${esc(contentRowId)});
      if (!row) throw new Error("Content row not found");

      var rightCol = figma.createFrame();
      rightCol.name = "Tab Order Details";
      rightCol.layoutMode = "VERTICAL";
      rightCol.primaryAxisSizingMode = "AUTO";
      rightCol.counterAxisSizingMode = "AUTO";
      rightCol.itemSpacing = 0;
      rightCol.fills = [];

      // Table heading
      var tblTitle = figma.createText();
      tblTitle.fontName = F.b;
      tblTitle.fontSize = 20;
      tblTitle.lineHeight = { unit: "PIXELS", value: 28 };
      tblTitle.characters = "Tab Order Sequence";
      tblTitle.fills = [{ type: "SOLID", color: { r: 0.13, g: 0.13, b: 0.13 } }];
      tblTitle.textAutoResize = "HEIGHT";
      rightCol.appendChild(tblTitle);
      tblTitle.layoutSizingHorizontal = "FILL";

      var sp = figma.createFrame(); sp.resize(4, 16); sp.fills = [];
      rightCol.appendChild(sp); sp.layoutSizingHorizontal = "FILL";

      // Table frame
      var tbl = figma.createFrame();
      tbl.name = "Tab Order Table";
      tbl.layoutMode = "VERTICAL";
      tbl.primaryAxisSizingMode = "AUTO";
      tbl.counterAxisSizingMode = "FIXED";
      tbl.resize(580, 10);
      tbl.itemSpacing = 0;
      tbl.fills = [];
      tbl.strokes = [{ type: "SOLID", color: { r: 0.88, g: 0.88, b: 0.9 } }];
      tbl.strokeWeight = 1;
      tbl.cornerRadius = 4;
      tbl.clipsContent = true;

      // Header row
      var hdr = figma.createFrame();
      hdr.name = "Header";
      hdr.layoutMode = "HORIZONTAL";
      hdr.primaryAxisSizingMode = "AUTO";
      hdr.counterAxisSizingMode = "AUTO";
      hdr.primaryAxisAlignItems = "MIN";
      hdr.counterAxisAlignItems = "CENTER";
      hdr.paddingTop = 12; hdr.paddingBottom = 12;
      hdr.itemSpacing = 0;
      hdr.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.25 } }];

      function addHeaderCell(parent, text, w, grow) {
        var f = figma.createFrame();
        f.layoutMode = "HORIZONTAL";
        f.primaryAxisSizingMode = "FIXED";
        f.counterAxisSizingMode = "AUTO";
        f.resize(w, 10);
        f.paddingLeft = 16;
        f.fills = [];
        var t = figma.createText();
        t.fontName = F.b;
        t.fontSize = 13;
        t.characters = text;
        t.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        f.appendChild(t);
        parent.appendChild(f);
        if (grow) { f.layoutGrow = 1; }
      }
      addHeaderCell(hdr, "#", 50);
      addHeaderCell(hdr, "Element", 200);
      addHeaderCell(hdr, "Role", 120);
      addHeaderCell(hdr, "ARIA / Notes", 210, true);

      tbl.appendChild(hdr);
      hdr.layoutSizingHorizontal = "FILL";

      rightCol.appendChild(tbl);
      tbl.layoutSizingHorizontal = "FILL";
      row.appendChild(rightCol);
      rightCol.layoutGrow = 1;

      return { rightColId: rightCol.id, tblId: tbl.id };
    })();
  `);
  if (!initRight.success) throw new Error(`Right column init failed: ${initRight.error}`);
  const { rightColId, tblId } = initRight.result as { rightColId: string; tblId: string };

  // Add table rows in batches of 8 for reliability
  const BATCH_SIZE = 8;
  for (let batchStart = 0; batchStart < tableRows.length; batchStart += BATCH_SIZE) {
    const batch = tableRows.slice(batchStart, batchStart + BATCH_SIZE);
    const batchJS = batch.map((row, idx) => {
      const i = batchStart + idx;
      const bgColor = i % 2 === 0
        ? "{ r: 1, g: 1, b: 1 }"
        : "{ r: 0.97, g: 0.97, b: 0.97 }";
      return `
        (function() {
          var r = figma.createFrame();
          r.name = "Row ${row.number}";
          r.layoutMode = "HORIZONTAL";
          r.primaryAxisSizingMode = "AUTO";
          r.counterAxisSizingMode = "AUTO";
          r.primaryAxisAlignItems = "MIN";
          r.counterAxisAlignItems = "CENTER";
          r.paddingTop = 10; r.paddingBottom = 10;
          r.itemSpacing = 0;
          r.fills = [{ type: "SOLID", color: ${bgColor} }];

          function addCell(parent, text, w, bold, color, grow) {
            var f = figma.createFrame();
            f.layoutMode = "HORIZONTAL";
            f.primaryAxisSizingMode = "FIXED";
            f.counterAxisSizingMode = "AUTO";
            f.resize(w, 10);
            f.paddingLeft = 16;
            f.fills = [];
            var t = figma.createText();
            t.fontName = bold ? F.b : F.r;
            t.fontSize = 13;
            t.characters = text;
            t.fills = [{ type: "SOLID", color: color }];
            f.appendChild(t);
            parent.appendChild(f);
            if (grow) { f.layoutGrow = 1; }
          }

          addCell(r, ${JSON.stringify(String(row.number))}, 50, true, { r: 0.42, g: 0.31, b: 0.75 });
          addCell(r, ${JSON.stringify(row.element)}, 200, false, { r: 0.13, g: 0.13, b: 0.13 });
          addCell(r, ${JSON.stringify(row.role)}, 120, false, { r: 0.13, g: 0.13, b: 0.13 });
          addCell(r, ${JSON.stringify(row.ariaNote)}, 210, false, { r: 0.4, g: 0.4, b: 0.4 }, true);

          tbl.appendChild(r);
          r.layoutSizingHorizontal = "FILL";
        })();
      `;
    }).join("\n");

    await bridge.execute(`
      (async () => {
        ${FL}
        var tbl = await figma.getNodeByIdAsync(${esc(tblId)});
        if (!tbl) throw new Error("Table not found");
        ${batchJS}
        return { ok: true };
      })();
    `);
  }

  // Add Implementation Notes
  const notesText = implNotes.map(n => `\u2022 ${n}`).join("\n");
  await bridge.execute(`
    (async () => {
      ${FL}
      var rightCol = await figma.getNodeByIdAsync(${esc(rightColId)});
      if (!rightCol) throw new Error("Right col not found");

      var sp = figma.createFrame(); sp.resize(4, 32); sp.fills = [];
      rightCol.appendChild(sp); sp.layoutSizingHorizontal = "FILL";

      var nt = figma.createText();
      nt.fontName = F.b;
      nt.fontSize = 16;
      nt.lineHeight = { unit: "PIXELS", value: 24 };
      nt.characters = "Implementation Notes";
      nt.fills = [{ type: "SOLID", color: { r: 0.13, g: 0.13, b: 0.13 } }];
      nt.textAutoResize = "HEIGHT";
      rightCol.appendChild(nt);
      nt.layoutSizingHorizontal = "FILL";

      var sp2 = figma.createFrame(); sp2.resize(4, 12); sp2.fills = [];
      rightCol.appendChild(sp2); sp2.layoutSizingHorizontal = "FILL";

      var body = figma.createText();
      body.fontName = F.r;
      body.fontSize = 13;
      body.lineHeight = { unit: "PIXELS", value: 22 };
      body.characters = ${esc(notesText)};
      body.fills = [{ type: "SOLID", color: { r: 0.13, g: 0.13, b: 0.13 } }];
      body.textAutoResize = "HEIGHT";
      rightCol.appendChild(body);
      body.layoutSizingHorizontal = "FILL";

      return { ok: true };
    })();
  `);
}
