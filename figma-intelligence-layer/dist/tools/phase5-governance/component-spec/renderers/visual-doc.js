"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderVisualDoc = renderVisualDoc;
/**
 * Visual Doc renderer — enterprise-quality component spec as a Figma page.
 *
 * IMPORTANT Figma Plugin API pattern:
 *   layoutSizingHorizontal = "FILL" only works AFTER the node is appended
 *   to an auto-layout parent. Always: appendChild() first, then set sizing.
 */
const figma_bridge_js_1 = require("../../../../shared/figma-bridge.js");
const anatomy_diagram_js_1 = require("./anatomy-diagram.js");
// ── Design Tokens ─────────────────────────────────────────────────────────
const PAGE_W = 1024;
const PAD = 64;
const SECTION_GAP = 40;
const INNER_GAP = 16;
const CONTENT_W = PAGE_W - PAD * 2; // 896
const C = {
    textMain: "{r:0.067,g:0.094,b:0.153}", // #111827
    textMuted: "{r:0.294,g:0.333,b:0.388}", // #4b5563
    bgTableHeader: "{r:0.953,g:0.957,b:0.965}", // #f3f4f6
    bgTableHover: "{r:0.976,g:0.98,b:0.984}", // #f9fafb
    border: "{r:0.898,g:0.906,b:0.922}", // #e5e7eb
    success: "{r:0.086,g:0.639,b:0.290}", // #16a34a
    error: "{r:0.863,g:0.149,b:0.149}", // #dc2626
    white: "{r:1,g:1,b:1}",
};
function esc(s) { return JSON.stringify(s); }
// ── Font loader ───────────────────────────────────────────────────────────
const FL = `
var F={};
async function lf(k,a){for(var i=0;i<a.length;i++){try{await figma.loadFontAsync(a[i]);F[k]=a[i];return}catch(e){}}F[k]={family:"Arial",style:"Regular"};try{await figma.loadFontAsync(F[k])}catch(e){}}
await lf("b",[{family:"Inter",style:"Bold"},{family:"Roboto",style:"Bold"}]);
await lf("sb",[{family:"Inter",style:"SemiBold"},{family:"Inter",style:"Medium"},{family:"Roboto",style:"Medium"}]);
await lf("r",[{family:"Inter",style:"Regular"},{family:"Roboto",style:"Regular"}]);
await lf("mono",[{family:"SF Mono",style:"Regular"},{family:"Roboto Mono",style:"Regular"},{family:"Courier New",style:"Regular"}]);
`;
// ── Helpers: spacer + divider (append first, then set FILL) ───────────────
function spacerJS(h, parent = "m") {
    return `
    (function(){
      var sp=figma.createFrame();
      sp.resize(4,${h});sp.fills=[];
      ${parent}.appendChild(sp);
      sp.layoutSizingHorizontal="FILL";
    })();`;
}
function dividerJS(parent = "m") {
    return `
    (function(){
      var dv=figma.createRectangle();
      dv.resize(4,2);
      dv.fills=[{type:"SOLID",color:${C.border}}];
      ${parent}.appendChild(dv);
      dv.layoutSizingHorizontal="FILL";
    })();`;
}
// Helper: create a text node, append to parent, then set FILL sizing
function textFillJS(varName, parent, fontKey, fontSize, lineH, charsExpr, colorExpr, extra = "") {
    return `
    var ${varName}=figma.createText();
    ${varName}.fontName=F.${fontKey};
    ${varName}.fontSize=${fontSize};
    ${varName}.lineHeight={unit:"PIXELS",value:${lineH}};
    ${varName}.characters=${charsExpr};
    ${varName}.fills=[{type:"SOLID",color:${colorExpr}}];
    ${extra}
    ${varName}.textAutoResize="HEIGHT";
    ${parent}.appendChild(${varName});
    ${varName}.layoutSizingHorizontal="FILL";`;
}
// ── initPage ──────────────────────────────────────────────────────────────
async function initPage(bridge, pageName) {
    const r = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      var nm=${esc(pageName)};
      var mm=figma.root.children.filter(function(p){return p.name===nm;});
      var pg;
      if(mm.length>0){pg=mm[0];for(var d=1;d<mm.length;d++)mm[d].remove();}
      else{pg=figma.createPage();}
      pg.name=nm;
      await figma.setCurrentPageAsync(pg);
      var ch=pg.children.slice();
      for(var i=0;i<ch.length;i++)ch[i].remove();

      var m=figma.createFrame();
      m.name="Component Spec";
      m.layoutMode="VERTICAL";
      m.primaryAxisSizingMode="AUTO";
      m.counterAxisSizingMode="FIXED";
      m.resize(${PAGE_W},100);
      m.paddingTop=${PAD};
      m.paddingBottom=${PAD};
      m.paddingLeft=${PAD};
      m.paddingRight=${PAD};
      m.itemSpacing=0;
      m.fills=[{type:"SOLID",color:${C.white}}];
      m.clipsContent=false;
      pg.appendChild(m);
      return {pageId:pg.id,mId:m.id};
    })();
  `);
    if (!r.success)
        throw new Error(`Init: ${r.error}`);
    return r.result;
}
// ── renderDocHeader ───────────────────────────────────────────────────────
async function renderDocHeader(bridge, mId, name, description, sectionTitles) {
    // Step 1: Title + description + divider
    const r1 = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      // H1 title
      ${textFillJS("t", "m", "b", 40, 52, esc(name), C.textMain, `t.letterSpacing={unit:"PIXELS",value:-1};`)}

      ${spacerJS(10)}

      // Description
      ${textFillJS("desc", "m", "r", 15, 24, esc(description), C.textMuted)}

      ${spacerJS(20)}

      return{ok:true};
    })();
  `);
    if (!r1.success)
        console.error("Header text failed:", r1.error);
    // Step 2: Section navigation badges (horizontal wrap row of pills)
    const r2 = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      var titles=${JSON.stringify(sectionTitles)};

      // Badge container — horizontal wrap
      var badgeRow=figma.createFrame();
      badgeRow.name="Section Nav";
      badgeRow.layoutMode="HORIZONTAL";
      badgeRow.layoutWrap="WRAP";
      badgeRow.primaryAxisSizingMode="AUTO";
      badgeRow.counterAxisSizingMode="AUTO";
      badgeRow.itemSpacing=8;
      badgeRow.counterAxisSpacing=8;
      badgeRow.fills=[];
      m.appendChild(badgeRow);
      badgeRow.layoutSizingHorizontal="FILL";

      for(var i=0;i<titles.length;i++){
        // Each badge: small rounded pill frame with text
        var pill=figma.createFrame();
        pill.name=titles[i];
        pill.layoutMode="HORIZONTAL";
        pill.primaryAxisSizingMode="AUTO";
        pill.counterAxisSizingMode="AUTO";
        pill.paddingTop=6;
        pill.paddingBottom=6;
        pill.paddingLeft=14;
        pill.paddingRight=14;
        pill.cornerRadius=100;
        pill.fills=[{type:"SOLID",color:${C.bgTableHeader}}];
        pill.strokes=[{type:"SOLID",color:${C.border}}];
        pill.strokeWeight=1;
        pill.strokeAlign="INSIDE";
        badgeRow.appendChild(pill);

        var pillTxt=figma.createText();
        pillTxt.fontName=F.sb;
        pillTxt.fontSize=12;
        pillTxt.lineHeight={unit:"PIXELS",value:16};
        pillTxt.characters=titles[i];
        pillTxt.fills=[{type:"SOLID",color:${C.textMuted}}];
        pillTxt.textAutoResize="WIDTH_AND_HEIGHT";
        pill.appendChild(pillTxt);
      }

      ${spacerJS(24)}
      ${dividerJS()}

      return{ok:true};
    })();
  `);
    if (!r2.success)
        console.error("Header badges failed:", r2.error);
}
// ── renderSectionTitle ────────────────────────────────────────────────────
async function renderSectionTitle(bridge, mId, title, index) {
    const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${spacerJS(SECTION_GAP)}
      ${index > 0 ? `${dividerJS()}${spacerJS(SECTION_GAP)}` : ""}

      // Section title
      ${textFillJS("tt", "m", "b", 20, 28, esc(title), C.textMain)}

      ${spacerJS(INNER_GAP)}

      return{ok:true};
    })();
  `);
    if (!r.success)
        console.error(`Section title "${title}" failed:`, r.error);
}
// ── Sub-renderers ─────────────────────────────────────────────────────────
async function renderVisualParagraph(bridge, mId, text) {
    const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${textFillJS("t", "m", "r", 15, 24, esc(text), C.textMuted)}

      return{ok:true};
    })();
  `);
    if (!r.success)
        console.error("Paragraph failed:", r.error);
}
async function renderVisualList(bridge, mId, items) {
    const capped = items.slice(0, 60);
    const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      var items=${JSON.stringify(capped)};

      var outer=figma.createFrame();
      outer.name="List";
      outer.layoutMode="VERTICAL";
      outer.primaryAxisSizingMode="AUTO";
      outer.counterAxisSizingMode="AUTO";
      outer.itemSpacing=6;
      outer.fills=[];
      outer.paddingLeft=8;
      m.appendChild(outer);
      outer.layoutSizingHorizontal="FILL";

      for(var i=0;i<items.length;i++){
        var row=figma.createFrame();
        row.name="Item "+(i+1);
        row.layoutMode="HORIZONTAL";
        row.primaryAxisSizingMode="AUTO";
        row.counterAxisSizingMode="AUTO";
        row.itemSpacing=8;
        row.fills=[];
        row.counterAxisAlignItems="MIN";
        outer.appendChild(row);
        row.layoutSizingHorizontal="FILL";

        var bullet=figma.createText();
        bullet.fontName=F.r;
        bullet.fontSize=15;
        bullet.lineHeight={unit:"PIXELS",value:24};
        bullet.characters="\\u2022";
        bullet.fills=[{type:"SOLID",color:${C.textMuted}}];
        bullet.textAutoResize="WIDTH_AND_HEIGHT";
        row.appendChild(bullet);

        var txt=figma.createText();
        txt.fontName=F.r;
        txt.fontSize=15;
        txt.lineHeight={unit:"PIXELS",value:24};
        txt.characters=items[i]||"\\u2014";
        txt.fills=[{type:"SOLID",color:${C.textMuted}}];
        txt.textAutoResize="HEIGHT";
        row.appendChild(txt);
        txt.layoutSizingHorizontal="FILL";
      }

      return{ok:true};
    })();
  `);
    if (!r.success)
        console.error("List failed:", r.error);
}
async function renderVisualKeyValue(bridge, mId, entries) {
    const capped = entries.slice(0, 40);
    const labelW = 200;
    const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      var entries=${JSON.stringify(capped)};

      var outer=figma.createFrame();
      outer.name="Key-Value";
      outer.layoutMode="VERTICAL";
      outer.primaryAxisSizingMode="AUTO";
      outer.counterAxisSizingMode="AUTO";
      outer.itemSpacing=0;
      outer.fills=[];
      m.appendChild(outer);
      outer.layoutSizingHorizontal="FILL";

      for(var i=0;i<entries.length;i++){
        var row=figma.createFrame();
        row.name=entries[i].label;
        row.layoutMode="HORIZONTAL";
        row.primaryAxisSizingMode="AUTO";
        row.counterAxisSizingMode="AUTO";
        row.itemSpacing=16;
        row.paddingTop=10;
        row.paddingBottom=10;
        row.fills=[];
        row.counterAxisAlignItems="MIN";

        // Bottom border
        row.strokes=[{type:"SOLID",color:${C.border}}];
        row.strokeWeight=1;
        row.strokeTopWeight=0;
        row.strokeRightWeight=0;
        row.strokeBottomWeight=1;
        row.strokeLeftWeight=0;
        row.strokeAlign="INSIDE";

        outer.appendChild(row);
        row.layoutSizingHorizontal="FILL";

        // Label — fixed width
        var lbl=figma.createText();
        lbl.fontName=F.sb;
        lbl.fontSize=14;
        lbl.lineHeight={unit:"PIXELS",value:20};
        lbl.characters=entries[i].label;
        lbl.fills=[{type:"SOLID",color:${C.textMuted}}];
        lbl.textAutoResize="HEIGHT";
        lbl.resize(${labelW},20);
        row.appendChild(lbl);
        lbl.layoutSizingHorizontal="FIXED";

        // Value — fill remaining width
        var val=figma.createText();
        val.fontName=F.r;
        val.fontSize=15;
        val.lineHeight={unit:"PIXELS",value:24};
        val.characters=entries[i].value||"\\u2014";
        val.fills=[{type:"SOLID",color:${C.textMain}}];
        val.textAutoResize="HEIGHT";
        row.appendChild(val);
        val.layoutSizingHorizontal="FILL";
      }

      return{ok:true};
    })();
  `);
    if (!r.success)
        console.error("Key-value failed:", r.error);
}
async function renderVisualTable(bridge, mId, headers, rows) {
    const capped = rows.slice(0, 50);
    const colCount = headers.length;
    const cellW = Math.floor((CONTENT_W - 32) / colCount);
    const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      var headers=${JSON.stringify(headers)};
      var rows=${JSON.stringify(capped)};
      var cellW=${cellW};
      var colCount=${colCount};

      // Outer table frame
      var tbl=figma.createFrame();
      tbl.name="Table";
      tbl.layoutMode="VERTICAL";
      tbl.primaryAxisSizingMode="AUTO";
      tbl.counterAxisSizingMode="AUTO";
      tbl.itemSpacing=0;
      tbl.fills=[{type:"SOLID",color:${C.white}}];
      tbl.cornerRadius=8;
      tbl.strokes=[{type:"SOLID",color:${C.border}}];
      tbl.strokeWeight=1;
      tbl.strokeAlign="INSIDE";
      tbl.clipsContent=true;
      m.appendChild(tbl);
      tbl.layoutSizingHorizontal="FILL";

      // Header row
      var hdr=figma.createFrame();
      hdr.name="Header";
      hdr.layoutMode="HORIZONTAL";
      hdr.primaryAxisSizingMode="AUTO";
      hdr.counterAxisSizingMode="AUTO";
      hdr.itemSpacing=0;
      hdr.paddingTop=12;hdr.paddingBottom=12;
      hdr.paddingLeft=16;hdr.paddingRight=16;
      hdr.fills=[{type:"SOLID",color:${C.bgTableHeader}}];
      hdr.counterAxisAlignItems="MIN";
      hdr.strokes=[{type:"SOLID",color:${C.border}}];
      hdr.strokeWeight=1;
      hdr.strokeTopWeight=0;hdr.strokeRightWeight=0;
      hdr.strokeBottomWeight=1;hdr.strokeLeftWeight=0;
      hdr.strokeAlign="INSIDE";
      tbl.appendChild(hdr);
      hdr.layoutSizingHorizontal="FILL";

      for(var c=0;c<colCount;c++){
        var ht=figma.createText();
        ht.fontName=F.sb;
        ht.fontSize=14;
        ht.lineHeight={unit:"PIXELS",value:20};
        ht.characters=headers[c]||"";
        ht.fills=[{type:"SOLID",color:${C.textMain}}];
        ht.textAutoResize="HEIGHT";
        ht.resize(cellW,20);
        hdr.appendChild(ht);
        ht.layoutSizingHorizontal="FIXED";
      }

      // Data rows
      for(var ri=0;ri<rows.length;ri++){
        var row=figma.createFrame();
        row.name="Row "+(ri+1);
        row.layoutMode="HORIZONTAL";
        row.primaryAxisSizingMode="AUTO";
        row.counterAxisSizingMode="AUTO";
        row.itemSpacing=0;
        row.paddingTop=10;row.paddingBottom=10;
        row.paddingLeft=16;row.paddingRight=16;
        row.fills=[];
        row.counterAxisAlignItems="MIN";

        if(ri<rows.length-1){
          row.strokes=[{type:"SOLID",color:${C.border}}];
          row.strokeWeight=1;
          row.strokeTopWeight=0;row.strokeRightWeight=0;
          row.strokeBottomWeight=1;row.strokeLeftWeight=0;
          row.strokeAlign="INSIDE";
        }

        tbl.appendChild(row);
        row.layoutSizingHorizontal="FILL";

        for(var c=0;c<colCount;c++){
          var ct=figma.createText();
          ct.fontName=F.r;
          ct.fontSize=14;
          ct.lineHeight={unit:"PIXELS",value:20};
          ct.characters=(rows[ri][c]!=null?rows[ri][c]:"")||"\\u2014";
          ct.fills=[{type:"SOLID",color:${C.textMuted}}];
          ct.textAutoResize="HEIGHT";
          ct.resize(cellW,20);
          row.appendChild(ct);
          ct.layoutSizingHorizontal="FIXED";
        }
      }

      return{ok:true};
    })();
  `);
    if (!r.success)
        console.error("Table failed:", r.error);
}
async function renderVisualDoDont(bridge, mId, dos, donts) {
    const cappedDos = dos.slice(0, 30);
    const cappedDonts = donts.slice(0, 30);
    const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      var dosArr=${JSON.stringify(cappedDos)};
      var dontsArr=${JSON.stringify(cappedDonts)};

      // Outer two-column frame
      var outer=figma.createFrame();
      outer.name="Do-Dont";
      outer.layoutMode="HORIZONTAL";
      outer.primaryAxisSizingMode="AUTO";
      outer.counterAxisSizingMode="AUTO";
      outer.itemSpacing=24;
      outer.fills=[];
      outer.counterAxisAlignItems="MIN";
      m.appendChild(outer);
      outer.layoutSizingHorizontal="FILL";

      function buildColumn(parent,title,items,iconChar,iconColor,titleColor){
        var col=figma.createFrame();
        col.name=title;
        col.layoutMode="VERTICAL";
        col.primaryAxisSizingMode="AUTO";
        col.counterAxisSizingMode="AUTO";
        col.itemSpacing=8;
        col.paddingTop=16;col.paddingBottom=16;
        col.paddingLeft=16;col.paddingRight=16;
        col.fills=[{type:"SOLID",color:${C.bgTableHover}}];
        col.cornerRadius=8;
        parent.appendChild(col);
        col.layoutSizingHorizontal="FILL";

        // Column title
        var ct=figma.createText();
        ct.fontName=F.sb;
        ct.fontSize=15;
        ct.lineHeight={unit:"PIXELS",value:22};
        ct.characters=iconChar+" "+title;
        ct.fills=[{type:"SOLID",color:titleColor}];
        ct.textAutoResize="WIDTH_AND_HEIGHT";
        col.appendChild(ct);

        // 4px spacer
        var sp=figma.createFrame();
        sp.resize(4,4);sp.fills=[];
        col.appendChild(sp);
        sp.layoutSizingHorizontal="FILL";

        // Items
        for(var i=0;i<items.length;i++){
          var row=figma.createFrame();
          row.name=title+" "+(i+1);
          row.layoutMode="HORIZONTAL";
          row.primaryAxisSizingMode="AUTO";
          row.counterAxisSizingMode="AUTO";
          row.itemSpacing=8;
          row.fills=[];
          row.counterAxisAlignItems="MIN";
          col.appendChild(row);
          row.layoutSizingHorizontal="FILL";

          var icon=figma.createText();
          icon.fontName=F.sb;
          icon.fontSize=14;
          icon.lineHeight={unit:"PIXELS",value:22};
          icon.characters=iconChar;
          icon.fills=[{type:"SOLID",color:iconColor}];
          icon.textAutoResize="WIDTH_AND_HEIGHT";
          row.appendChild(icon);

          var txt=figma.createText();
          txt.fontName=F.r;
          txt.fontSize=14;
          txt.lineHeight={unit:"PIXELS",value:22};
          txt.characters=items[i]||"\\u2014";
          txt.fills=[{type:"SOLID",color:${C.textMuted}}];
          txt.textAutoResize="HEIGHT";
          row.appendChild(txt);
          txt.layoutSizingHorizontal="FILL";
        }
      }

      if(dosArr.length>0){
        buildColumn(outer,"Do",dosArr,"\\u2713",${C.success},${C.success});
      }
      if(dontsArr.length>0){
        buildColumn(outer,"Don\\u2019t",dontsArr,"\\u2717",${C.error},${C.error});
      }

      return{ok:true};
    })();
  `);
    if (!r.success)
        console.error("Do/Dont failed:", r.error);
}
// ── Content kind router ───────────────────────────────────────────────────
async function renderSectionContent(bridge, mId, content) {
    switch (content.kind) {
        case "paragraph":
            return renderVisualParagraph(bridge, mId, content.text);
        case "key-value":
            return renderVisualKeyValue(bridge, mId, content.entries);
        case "table":
            return renderVisualTable(bridge, mId, content.headers, content.rows);
        case "structured-data": {
            const rows = content.rows.map(r => content.columns.map(c => r[c] ?? "\u2014"));
            return renderVisualTable(bridge, mId, content.columns, rows);
        }
        case "list":
        case "rules":
            return renderVisualList(bridge, mId, content.items);
        case "do-dont":
            return renderVisualDoDont(bridge, mId, content.dos, content.donts);
        case "mixed":
            for (const block of content.blocks) {
                await renderSectionContent(bridge, mId, block);
                try {
                    await bridge.execute(`
            (async () => {
              var m=await figma.getNodeByIdAsync(${esc(mId)});
              if(!m)return;
              var sp=figma.createFrame();
              sp.resize(4,8);sp.fills=[];
              m.appendChild(sp);
              sp.layoutSizingHorizontal="FILL";
            })();
          `);
                }
                catch { /* ok */ }
            }
            return;
    }
}
// ── Main entry ────────────────────────────────────────────────────────────
async function renderVisualDoc(spec, pageName) {
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    const resolvedName = pageName || `${spec.componentName} \u2014 Spec`;
    // 1. Page + master frame
    const { pageId, mId } = await initPage(bridge, resolvedName);
    // 2. Header — description + section badges
    const description = spec.description
        || `${spec.componentName} is a ${(spec.nodeType || "component").toLowerCase().replace(/_/g, " ")} used in the design system.`;
    const sectionTitles = spec.sections.map(s => s.title);
    await renderDocHeader(bridge, mId, spec.componentName, description, sectionTitles);
    // 3. Sections
    for (let i = 0; i < spec.sections.length; i++) {
        const sec = spec.sections[i];
        await renderSectionTitle(bridge, mId, sec.title, i);
        await renderSectionContent(bridge, mId, sec.content);
    }
    // 4. Bottom padding
    try {
        await bridge.execute(`
      (async () => {
        var m=await figma.getNodeByIdAsync(${esc(mId)});
        if(!m)return;
        var sp=figma.createFrame();
        sp.resize(4,${PAD});sp.fills=[];
        m.appendChild(sp);
        sp.layoutSizingHorizontal="FILL";
      })();
    `);
    }
    catch { /* ok */ }
    // 5. Zoom to fit
    try {
        await bridge.execute(`
      (async () => {
        var pg=await figma.getNodeByIdAsync(${esc(pageId)});
        if(pg&&pg.type==="PAGE"&&pg.children.length>0)
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
          var m=await figma.getNodeByIdAsync(${esc(mId)});
          return m?m.height:2000;
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
//# sourceMappingURL=visual-doc.js.map