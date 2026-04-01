"use strict";
/**
 * VPAT Figma Page Renderer
 * Renders a VPAT-style accessibility conformance report as a structured
 * Figma page with auto-layout tables, badges, and summary cards.
 *
 * IMPORTANT Figma Plugin API pattern:
 *   layoutSizingHorizontal = "FILL" only works AFTER the node is appended
 *   to an auto-layout parent. Always: appendChild() first, then set sizing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderVPATPage = renderVPATPage;
// ── Design Tokens ────────────────────────────────────────────────────────────
const PAGE_W = 1440;
const PAD = 50;
const CONTENT_W = PAGE_W - PAD * 2;
const C = {
    textMain: "{r:0.067,g:0.094,b:0.153}",
    textMuted: "{r:0.294,g:0.333,b:0.388}",
    textWhite: "{r:1,g:1,b:1}",
    bgPage: "{r:1,g:1,b:1}",
    bgHeader: "{r:0.067,g:0.094,b:0.153}",
    bgTableHeader: "{r:0.953,g:0.957,b:0.965}",
    border: "{r:0.898,g:0.906,b:0.922}",
    // Conformance status colours
    supports: "{r:0.086,g:0.639,b:0.290}", // green
    supportsBg: "{r:0.863,g:0.965,b:0.898}",
    partial: "{r:0.918,g:0.576,b:0.051}", // amber
    partialBg: "{r:1,g:0.949,b:0.878}",
    fail: "{r:0.863,g:0.149,b:0.149}", // red
    failBg: "{r:1,g:0.898,b:0.898}",
    review: "{r:0.369,g:0.408,b:0.463}", // gray
    reviewBg: "{r:0.953,g:0.957,b:0.965}",
    na: "{r:0.6,g:0.6,b:0.6}",
    naBg: "{r:0.969,g:0.969,b:0.969}",
};
function esc(s) { return JSON.stringify(s); }
// ── Font Loader ──────────────────────────────────────────────────────────────
const FL = `
var F={};
async function lf(k,a){for(var i=0;i<a.length;i++){try{await figma.loadFontAsync(a[i]);F[k]=a[i];return}catch(e){}}F[k]={family:"Arial",style:"Regular"};try{await figma.loadFontAsync(F[k])}catch(e){}}
await lf("b",[{family:"Inter",style:"Bold"},{family:"Roboto",style:"Bold"}]);
await lf("sb",[{family:"Inter",style:"SemiBold"},{family:"Inter",style:"Medium"},{family:"Roboto",style:"Medium"}]);
await lf("r",[{family:"Inter",style:"Regular"},{family:"Roboto",style:"Regular"}]);
`;
// ── Layout Helpers ───────────────────────────────────────────────────────────
function spacerJS(h, parent = "m") {
    return `(function(){var sp=figma.createFrame();sp.resize(4,${h});sp.fills=[];${parent}.appendChild(sp);sp.layoutSizingHorizontal="FILL";})();`;
}
function dividerJS(parent = "m") {
    return `(function(){var dv=figma.createRectangle();dv.resize(4,2);dv.fills=[{type:"SOLID",color:${C.border}}];${parent}.appendChild(dv);dv.layoutSizingHorizontal="FILL";})();`;
}
// ── Status colour mapping ────────────────────────────────────────────────────
function statusColors(status) {
    switch (status) {
        case "Supports": return { text: C.supports, bg: C.supportsBg };
        case "Partially Supports": return { text: C.partial, bg: C.partialBg };
        case "Does Not Support": return { text: C.fail, bg: C.failBg };
        case "Not Applicable": return { text: C.na, bg: C.naBg };
        case "Not Evaluated": return { text: C.review, bg: C.reviewBg };
        default: return { text: C.review, bg: C.reviewBg };
    }
}
// ── Main Renderer ────────────────────────────────────────────────────────────
async function renderVPATPage(bridge, report) {
    const pageName = `VPAT — Level ${report.evaluatedLevel} — ${report.evaluationDate}`;
    // Step 1: Create page + master frame
    const initResult = await bridge.execute(`
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
      m.name="VPAT Report";
      m.layoutMode="VERTICAL";
      m.primaryAxisSizingMode="AUTO";
      m.counterAxisSizingMode="FIXED";
      m.resize(${PAGE_W},100);
      m.paddingTop=${PAD};m.paddingBottom=${PAD};
      m.paddingLeft=${PAD};m.paddingRight=${PAD};
      m.itemSpacing=0;
      m.fills=[{type:"SOLID",color:${C.bgPage}}];
      m.clipsContent=false;
      pg.appendChild(m);
      return {pageId:pg.id,mId:m.id};
    })();
  `);
    if (!initResult.success)
        throw new Error(`VPAT init: ${initResult.error}`);
    const { pageId, mId } = initResult.result;
    // Step 2: Render header
    await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      // Dark header band
      var hdr=figma.createFrame();
      hdr.name="Header";
      hdr.layoutMode="VERTICAL";
      hdr.primaryAxisSizingMode="AUTO";
      hdr.counterAxisSizingMode="AUTO";
      hdr.paddingTop=40;hdr.paddingBottom=40;
      hdr.paddingLeft=40;hdr.paddingRight=40;
      hdr.itemSpacing=12;
      hdr.cornerRadius=12;
      hdr.fills=[{type:"SOLID",color:${C.bgHeader}}];
      m.appendChild(hdr);
      hdr.layoutSizingHorizontal="FILL";

      // Level badge
      var badge=figma.createFrame();
      badge.name="Level Badge";
      badge.layoutMode="HORIZONTAL";
      badge.primaryAxisSizingMode="AUTO";
      badge.counterAxisSizingMode="AUTO";
      badge.paddingTop=6;badge.paddingBottom=6;
      badge.paddingLeft=14;badge.paddingRight=14;
      badge.cornerRadius=6;
      badge.fills=[{type:"SOLID",color:{r:0.2,g:0.45,b:0.9}}];
      hdr.appendChild(badge);
      var bt=figma.createText();bt.fontName=F.sb;bt.fontSize=13;
      bt.characters="WCAG 2.2 Level "+${esc(report.evaluatedLevel)};
      bt.fills=[{type:"SOLID",color:${C.textWhite}}];
      badge.appendChild(bt);

      // Title
      var t1=figma.createText();t1.fontName=F.b;t1.fontSize=32;
      t1.lineHeight={unit:"PIXELS",value:40};
      t1.characters="Accessibility Conformance Report";
      t1.fills=[{type:"SOLID",color:${C.textWhite}}];
      t1.textAutoResize="HEIGHT";
      hdr.appendChild(t1);t1.layoutSizingHorizontal="FILL";

      // Subtitle
      var sub=figma.createText();sub.fontName=F.r;sub.fontSize=15;
      sub.lineHeight={unit:"PIXELS",value:22};
      sub.characters=${esc(`${report.nodeName}  ·  ${report.evaluationDate}  ·  Node ${report.nodeId}`)};
      sub.fills=[{type:"SOLID",color:{r:0.7,g:0.75,b:0.82}}];
      sub.textAutoResize="HEIGHT";
      hdr.appendChild(sub);sub.layoutSizingHorizontal="FILL";

      return{ok:true};
    })();
  `);
    // Step 3: Render summary cards
    const s = report.summary;
    const cards = [
        { label: "Total Criteria", value: String(s.totalCriteria), color: C.textMain },
        { label: "Supports", value: String(s.supports), color: C.supports },
        { label: "Partially Supports", value: String(s.partiallySupports), color: C.partial },
        { label: "Does Not Support", value: String(s.doesNotSupport), color: C.fail },
        { label: "Not Evaluated", value: String(s.notEvaluated), color: C.review },
        { label: "Not Applicable", value: String(s.notApplicable), color: C.na },
    ];
    await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${spacerJS(32)}

      // Summary title
      var st=figma.createText();st.fontName=F.b;st.fontSize=22;
      st.lineHeight={unit:"PIXELS",value:30};
      st.characters="Summary";
      st.fills=[{type:"SOLID",color:${C.textMain}}];
      st.textAutoResize="HEIGHT";
      m.appendChild(st);st.layoutSizingHorizontal="FILL";

      ${spacerJS(16)}

      // Cards row
      var row=figma.createFrame();
      row.name="Summary Cards";
      row.layoutMode="HORIZONTAL";
      row.primaryAxisSizingMode="AUTO";
      row.counterAxisSizingMode="AUTO";
      row.itemSpacing=12;
      row.fills=[];
      m.appendChild(row);
      row.layoutSizingHorizontal="FILL";

      var cards=${JSON.stringify(cards)};
      for(var i=0;i<cards.length;i++){
        var card=figma.createFrame();
        card.name=cards[i].label;
        card.layoutMode="VERTICAL";
        card.primaryAxisSizingMode="AUTO";
        card.counterAxisSizingMode="AUTO";
        card.primaryAxisAlignItems="CENTER";
        card.counterAxisAlignItems="CENTER";
        card.paddingTop=20;card.paddingBottom=20;
        card.paddingLeft=16;card.paddingRight=16;
        card.itemSpacing=6;
        card.cornerRadius=10;
        card.fills=[{type:"SOLID",color:${C.bgTableHeader}}];
        row.appendChild(card);
        card.layoutSizingHorizontal="FILL";

        var num=figma.createText();num.fontName=F.b;num.fontSize=28;
        num.characters=cards[i].value;
        var cc=cards[i].color;
        num.fills=[{type:"SOLID",color:typeof cc==="string"?eval("("+cc+")"):cc}];
        card.appendChild(num);

        var lbl=figma.createText();lbl.fontName=F.r;lbl.fontSize=12;
        lbl.characters=cards[i].label;
        lbl.fills=[{type:"SOLID",color:${C.textMuted}}];
        card.appendChild(lbl);
      }

      ${spacerJS(16)}

      // Automated / Heuristic / Manual breakdown line
      var bk=figma.createText();bk.fontName=F.r;bk.fontSize=13;
      bk.lineHeight={unit:"PIXELS",value:20};
      bk.characters=${esc(`Automated checks: ${s.automatedChecks}  ·  Heuristic checks: ${s.heuristicChecks}  ·  Manual review required: ${s.manualReviewRequired}`)};
      bk.fills=[{type:"SOLID",color:${C.textMuted}}];
      bk.textAutoResize="HEIGHT";
      m.appendChild(bk);bk.layoutSizingHorizontal="FILL";

      return{ok:true};
    })();
  `);
    // Step 4: Render per-principle tables
    const principleOrder = ["Perceivable", "Operable", "Understandable", "Robust"];
    for (const principle of principleOrder) {
        const rows = report.principles[principle];
        if (rows.length === 0)
            continue;
        await renderPrincipleTable(bridge, mId, principle, rows);
    }
    // Step 5: Zoom to fit
    await bridge.execute(`
    (async () => {
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(m)figma.viewport.scrollAndZoomIntoView([m]);
      return{ok:true};
    })();
  `);
    return { pageId };
}
// ── Principle Table ──────────────────────────────────────────────────────────
async function renderPrincipleTable(bridge, mId, principle, rows) {
    // Prepare row data for serialisation
    const tableRows = rows.map((r) => ({
        sc: r.criterionId,
        name: r.criterionName,
        level: r.level,
        status: r.conformanceStatus,
        type: r.checkType,
        remarks: truncateRemarkForTable(r.remarks),
        issueCount: r.issues.length,
    }));
    // Column widths (total ~CONTENT_W)
    const COL = { sc: 60, name: 220, level: 50, status: 180, type: 90, remarks: CONTENT_W - 60 - 220 - 50 - 180 - 90 - 32 };
    await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${spacerJS(36)}

      // Principle heading
      var ph=figma.createText();ph.fontName=F.b;ph.fontSize=20;
      ph.lineHeight={unit:"PIXELS",value:28};
      ph.characters=${esc(principle)};
      ph.fills=[{type:"SOLID",color:${C.textMain}}];
      ph.textAutoResize="HEIGHT";
      m.appendChild(ph);ph.layoutSizingHorizontal="FILL";

      ${spacerJS(12)}

      var rows=${JSON.stringify(tableRows)};

      // Table frame
      var tbl=figma.createFrame();
      tbl.name=${esc(`Table — ${principle}`)};
      tbl.layoutMode="VERTICAL";
      tbl.primaryAxisSizingMode="AUTO";
      tbl.counterAxisSizingMode="AUTO";
      tbl.itemSpacing=0;
      tbl.fills=[{type:"SOLID",color:${C.bgPage}}];
      tbl.cornerRadius=8;
      tbl.strokes=[{type:"SOLID",color:${C.border}}];
      tbl.strokeWeight=1;tbl.strokeAlign="INSIDE";
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

      var hLabels=["SC","Name","Level","Conformance","Check","Remarks"];
      var hWidths=[${COL.sc},${COL.name},${COL.level},${COL.status},${COL.type},${COL.remarks}];
      for(var c=0;c<hLabels.length;c++){
        var ht=figma.createText();ht.fontName=F.sb;ht.fontSize=12;
        ht.lineHeight={unit:"PIXELS",value:18};
        ht.characters=hLabels[c];
        ht.fills=[{type:"SOLID",color:${C.textMain}}];
        ht.textAutoResize="HEIGHT";
        ht.resize(hWidths[c],18);
        hdr.appendChild(ht);ht.layoutSizingHorizontal="FIXED";
      }

      // Status colour map
      var scm={
        "Supports":          {text:${C.supports},bg:${C.supportsBg}},
        "Partially Supports":{text:${C.partial},bg:${C.partialBg}},
        "Does Not Support":  {text:${C.fail},bg:${C.failBg}},
        "Not Applicable":    {text:${C.na},bg:${C.naBg}},
        "Not Evaluated":     {text:${C.review},bg:${C.reviewBg}},
      };

      // Data rows
      for(var ri=0;ri<rows.length;ri++){
        var d=rows[ri];
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

        // SC column
        var c0=figma.createText();c0.fontName=F.sb;c0.fontSize=12;
        c0.lineHeight={unit:"PIXELS",value:18};
        c0.characters=d.sc;
        c0.fills=[{type:"SOLID",color:${C.textMain}}];
        c0.textAutoResize="HEIGHT";c0.resize(${COL.sc},18);
        row.appendChild(c0);c0.layoutSizingHorizontal="FIXED";

        // Name column
        var c1=figma.createText();c1.fontName=F.r;c1.fontSize=12;
        c1.lineHeight={unit:"PIXELS",value:18};
        c1.characters=d.name;
        c1.fills=[{type:"SOLID",color:${C.textMain}}];
        c1.textAutoResize="HEIGHT";c1.resize(${COL.name},18);
        row.appendChild(c1);c1.layoutSizingHorizontal="FIXED";

        // Level column
        var c2=figma.createText();c2.fontName=F.r;c2.fontSize=12;
        c2.lineHeight={unit:"PIXELS",value:18};
        c2.characters=d.level;
        c2.fills=[{type:"SOLID",color:${C.textMuted}}];
        c2.textAutoResize="HEIGHT";c2.resize(${COL.level},18);
        row.appendChild(c2);c2.layoutSizingHorizontal="FIXED";

        // Conformance status badge
        var sc2=scm[d.status]||scm["Not Evaluated"];
        var bdg=figma.createFrame();
        bdg.name="Status";
        bdg.layoutMode="HORIZONTAL";
        bdg.primaryAxisSizingMode="AUTO";
        bdg.counterAxisSizingMode="AUTO";
        bdg.paddingTop=4;bdg.paddingBottom=4;
        bdg.paddingLeft=8;bdg.paddingRight=8;
        bdg.cornerRadius=4;
        bdg.fills=[{type:"SOLID",color:sc2.bg}];
        bdg.resize(${COL.status - 8},24);
        row.appendChild(bdg);
        bdg.layoutSizingHorizontal="FIXED";

        var bt2=figma.createText();bt2.fontName=F.sb;bt2.fontSize=11;
        bt2.characters=d.status;
        bt2.fills=[{type:"SOLID",color:sc2.text}];
        bdg.appendChild(bt2);

        // Check type column
        var c4=figma.createText();c4.fontName=F.r;c4.fontSize=11;
        c4.lineHeight={unit:"PIXELS",value:16};
        c4.characters=d.type;
        c4.fills=[{type:"SOLID",color:${C.textMuted}}];
        c4.textAutoResize="HEIGHT";c4.resize(${COL.type},16);
        row.appendChild(c4);c4.layoutSizingHorizontal="FIXED";

        // Remarks column
        var c5=figma.createText();c5.fontName=F.r;c5.fontSize=11;
        c5.lineHeight={unit:"PIXELS",value:16};
        c5.characters=d.remarks||"\\u2014";
        c5.fills=[{type:"SOLID",color:${C.textMuted}}];
        c5.textAutoResize="HEIGHT";c5.resize(${COL.remarks},16);
        row.appendChild(c5);c5.layoutSizingHorizontal="FIXED";
      }

      return{ok:true};
    })();
  `);
}
// ── Utility ──────────────────────────────────────────────────────────────────
function truncate(text, maxLen) {
    if (text.length <= maxLen)
        return text;
    return text.slice(0, maxLen - 3) + "...";
}
/** Extract the most useful preview from multi-line remarks for table display */
function truncateRemarkForTable(remarks) {
    const lines = remarks.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0)
        return "\u2014";
    // Skip the "[Manual Review Required]" prefix and get the substantive line
    let preview = lines[0];
    if (preview.startsWith("[Manual Review Required]") && lines.length > 1) {
        preview = lines[0] + " " + lines[1];
    }
    // Try to include a DEV ACTION or RISK line for added value
    const devAction = lines.find((l) => l.startsWith("DEV ACTION:") || l.startsWith("RISK:") || l.startsWith("IMPORTANT:"));
    if (devAction && !preview.includes(devAction)) {
        preview += " | " + devAction;
    }
    // Cap at 300 chars for the table
    if (preview.length > 300) {
        return preview.slice(0, 297) + "...";
    }
    return preview;
}
//# sourceMappingURL=vpat-figma-page.js.map