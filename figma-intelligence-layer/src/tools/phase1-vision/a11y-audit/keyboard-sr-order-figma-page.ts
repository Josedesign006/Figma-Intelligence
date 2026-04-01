/**
 * Keyboard & Screen Reader Order — Figma Page Renderer
 * Renders the full accessibility annotation as an enterprise-quality Figma page
 * with auto-layout tables, callout boxes, and structured sections.
 *
 * IMPORTANT Figma Plugin API pattern:
 *   layoutSizingHorizontal = "FILL" only works AFTER the node is appended
 *   to an auto-layout parent. Always: appendChild() first, then set sizing.
 */

import type {
  A11yOrderAnalysis,
  TabOrderEntry,
  ReadingOrderNode,
  FocusAnnouncement,
  StateChangeRule,
  FocusRule,
  AriaReq,
  KBRule,
  Warning,
  AuditSummaryRow,
} from "./keyboard-sr-order-analyzer.js";

// ── Design Tokens ────────────────────────────────────────────────────────────

const PAGE_W = 1200;
const PAD = 50;
const CONTENT_W = PAGE_W - PAD * 2;

const C = {
  textMain:      "{r:0.067,g:0.094,b:0.153}",
  textMuted:     "{r:0.294,g:0.333,b:0.388}",
  textWhite:     "{r:1,g:1,b:1}",
  bgPage:        "{r:1,g:1,b:1}",
  bgHeader:      "{r:0.067,g:0.094,b:0.153}",
  bgTableHeader: "{r:0.953,g:0.957,b:0.965}",
  border:        "{r:0.898,g:0.906,b:0.922}",
  accent:        "{r:0.2,g:0.45,b:0.9}",
  warnBg:        "{r:1,g:0.95,b:0.95}",
  warnBorder:    "{r:0.863,g:0.149,b:0.149}",
  warnAmberBg:   "{r:1,g:0.98,b:0.93}",
  warnAmberBdr:  "{r:0.918,g:0.576,b:0.051}",
  infoBg:        "{r:0.94,g:0.96,b:1}",
  infoBorder:    "{r:0.2,g:0.45,b:0.9}",
  green:         "{r:0.086,g:0.639,b:0.290}",
  greenBg:       "{r:0.863,g:0.965,b:0.898}",
};

type Bridge = {
  execute(code: string): Promise<{ success: boolean; result?: unknown; error?: string }>;
};

function esc(s: string): string { return JSON.stringify(s); }

// ── Font Loader ──────────────────────────────────────────────────────────────

const FL = `
var F={};
async function lf(k,a){for(var i=0;i<a.length;i++){try{await figma.loadFontAsync(a[i]);F[k]=a[i];return}catch(e){}}F[k]={family:"Arial",style:"Regular"};try{await figma.loadFontAsync(F[k])}catch(e){}}
await lf("b",[{family:"Inter",style:"Bold"},{family:"Roboto",style:"Bold"}]);
await lf("sb",[{family:"Inter",style:"SemiBold"},{family:"Inter",style:"Medium"},{family:"Roboto",style:"Medium"}]);
await lf("r",[{family:"Inter",style:"Regular"},{family:"Roboto",style:"Regular"}]);
await lf("mono",[{family:"Roboto Mono",style:"Regular"},{family:"Courier New",style:"Regular"}]);
`;

// ── Layout Helpers ───────────────────────────────────────────────────────────

function spacerJS(h: number, parent: string = "m"): string {
  return `(function(){var sp=figma.createFrame();sp.resize(4,${h});sp.fills=[];${parent}.appendChild(sp);sp.layoutSizingHorizontal="FILL";})();`;
}

function dividerJS(parent: string = "m"): string {
  return `(function(){var dv=figma.createRectangle();dv.resize(4,2);dv.fills=[{type:"SOLID",color:${C.border}}];${parent}.appendChild(dv);dv.layoutSizingHorizontal="FILL";})();`;
}

function sectionHeadingJS(title: string, parent: string = "m"): string {
  return `(function(){
    var t=figma.createText();t.fontName=F.b;t.fontSize=22;
    t.lineHeight={unit:"PIXELS",value:30};
    t.characters=${esc(title)};
    t.fills=[{type:"SOLID",color:${C.textMain}}];
    t.textAutoResize="HEIGHT";
    ${parent}.appendChild(t);t.layoutSizingHorizontal="FILL";
  })();`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

// ── Main Renderer ────────────────────────────────────────────────────────────

export async function renderKeyboardSrOrderPage(
  bridge: Bridge,
  analysis: A11yOrderAnalysis,
  customPageName?: string,
): Promise<{ pageId: string }> {
  const pageName =
    customPageName ||
    `A11y \u2014 Keyboard & SR Order \u2014 ${analysis.header.frameName} \u2014 ${analysis.header.date}`;

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
      m.name="Keyboard & SR Order Annotation";
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
  if (!initResult.success) throw new Error(`KSR init: ${initResult.error}`);
  const { pageId, mId } = initResult.result as { pageId: string; mId: string };

  // Step 2: Render header
  await renderHeader(bridge, mId, analysis);

  // Step 3: Scope & Assumptions
  await renderScopeAndAssumptions(bridge, mId, analysis);

  // Step 4: Keyboard Tab Order table
  await renderTabOrderTable(bridge, mId, analysis.keyboardTabOrder);

  // Step 5: Screen Reader Reading Order
  await renderReadingOrder(bridge, mId, analysis.screenReaderReadingOrder);

  // Step 6: Interaction Announcements
  await renderInteractionAnnouncements(bridge, mId, analysis);

  // Step 7: Focus Management
  await renderFocusManagement(bridge, mId, analysis.focusManagement);

  // Step 8: Implementation Notes
  await renderImplementationNotes(bridge, mId, analysis);

  // Step 9: Warnings
  await renderWarnings(bridge, mId, analysis.warnings);

  // Step 10: Audit Summary
  await renderAuditSummary(bridge, mId, analysis.auditSummary);

  // Final: Zoom to fit
  await bridge.execute(`
    (async () => {
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(m)figma.viewport.scrollAndZoomIntoView([m]);
      return{ok:true};
    })();
  `);

  return { pageId };
}

// ── Section Renderers ───────────────────────────────────────────────────────

async function renderHeader(
  bridge: Bridge,
  mId: string,
  analysis: A11yOrderAnalysis
): Promise<void> {
  const h = analysis.header;
  await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

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

      // Badge
      var badge=figma.createFrame();
      badge.name="Standard Badge";
      badge.layoutMode="HORIZONTAL";
      badge.primaryAxisSizingMode="AUTO";
      badge.counterAxisSizingMode="AUTO";
      badge.paddingTop=6;badge.paddingBottom=6;
      badge.paddingLeft=14;badge.paddingRight=14;
      badge.cornerRadius=6;
      badge.fills=[{type:"SOLID",color:${C.accent}}];
      hdr.appendChild(badge);
      var bt=figma.createText();bt.fontName=F.sb;bt.fontSize=13;
      bt.characters=${esc(h.standard)};
      bt.fills=[{type:"SOLID",color:${C.textWhite}}];
      badge.appendChild(bt);

      // Title
      var t1=figma.createText();t1.fontName=F.b;t1.fontSize=32;
      t1.lineHeight={unit:"PIXELS",value:40};
      t1.characters="Keyboard & Screen Reader Order";
      t1.fills=[{type:"SOLID",color:${C.textWhite}}];
      t1.textAutoResize="HEIGHT";
      hdr.appendChild(t1);t1.layoutSizingHorizontal="FILL";

      // Subtitle
      var sub=figma.createText();sub.fontName=F.r;sub.fontSize=15;
      sub.lineHeight={unit:"PIXELS",value:22};
      sub.characters=${esc(`${h.frameName}  \u00b7  ${h.date}  \u00b7  Node ${h.nodeId}`)};
      sub.fills=[{type:"SOLID",color:{r:0.7,g:0.75,b:0.82}}];
      sub.textAutoResize="HEIGHT";
      hdr.appendChild(sub);sub.layoutSizingHorizontal="FILL";

      // Subtitle line 2
      var sub2=figma.createText();sub2.fontName=F.r;sub2.fontSize=13;
      sub2.lineHeight={unit:"PIXELS",value:20};
      sub2.characters="Accessibility Annotation (Developer Handoff)";
      sub2.fills=[{type:"SOLID",color:{r:0.6,g:0.65,b:0.72}}];
      sub2.textAutoResize="HEIGHT";
      hdr.appendChild(sub2);sub2.layoutSizingHorizontal="FILL";

      return{ok:true};
    })();
  `);
}

async function renderScopeAndAssumptions(
  bridge: Bridge,
  mId: string,
  analysis: A11yOrderAnalysis
): Promise<void> {
  const assumptionsText = analysis.assumptions
    .map((a, i) => `\u2022 ${a}`)
    .join("\\n");

  await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${spacerJS(32)}
      ${sectionHeadingJS("Scope")}
      ${spacerJS(8)}

      var scope=figma.createText();scope.fontName=F.r;scope.fontSize=14;
      scope.lineHeight={unit:"PIXELS",value:22};
      scope.characters=${esc(analysis.scope)};
      scope.fills=[{type:"SOLID",color:${C.textMain}}];
      scope.textAutoResize="HEIGHT";
      m.appendChild(scope);scope.layoutSizingHorizontal="FILL";

      ${spacerJS(24)}
      ${sectionHeadingJS("Assumptions")}
      ${spacerJS(8)}

      var assumptions=figma.createText();assumptions.fontName=F.r;assumptions.fontSize=14;
      assumptions.lineHeight={unit:"PIXELS",value:22};
      assumptions.characters=${esc(analysis.assumptions.join("\n"))};
      assumptions.fills=[{type:"SOLID",color:${C.textMuted}}];
      assumptions.textAutoResize="HEIGHT";
      m.appendChild(assumptions);assumptions.layoutSizingHorizontal="FILL";

      ${spacerJS(16)}
      ${dividerJS()}

      return{ok:true};
    })();
  `);
}

async function renderTabOrderTable(
  bridge: Bridge,
  mId: string,
  tabOrder: TabOrderEntry[]
): Promise<void> {
  const BATCH_SIZE = 15;
  const COL = { num: 40, element: 220, role: 100, label: 300, notes: CONTENT_W - 40 - 220 - 100 - 300 - 32 };

  // Section heading + table frame + header row
  await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${spacerJS(32)}
      ${sectionHeadingJS("Keyboard Tab Order")}
      ${spacerJS(8)}

      var desc=figma.createText();desc.fontName=F.r;desc.fontSize=13;
      desc.lineHeight={unit:"PIXELS",value:20};
      desc.characters="Complete linear tab sequence for all focusable elements. Static text (prices, labels, headings) is excluded.";
      desc.fills=[{type:"SOLID",color:${C.textMuted}}];
      desc.textAutoResize="HEIGHT";
      m.appendChild(desc);desc.layoutSizingHorizontal="FILL";

      ${spacerJS(12)}

      var tbl=figma.createFrame();
      tbl.name="Tab Order Table";
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

      var hLabels=["#","Element","Role","Label","Notes"];
      var hWidths=[${COL.num},${COL.element},${COL.role},${COL.label},${COL.notes}];
      for(var c=0;c<hLabels.length;c++){
        var ht=figma.createText();ht.fontName=F.sb;ht.fontSize=12;
        ht.lineHeight={unit:"PIXELS",value:18};
        ht.characters=hLabels[c];
        ht.fills=[{type:"SOLID",color:${C.textMain}}];
        ht.textAutoResize="HEIGHT";
        ht.resize(hWidths[c],18);
        hdr.appendChild(ht);ht.layoutSizingHorizontal="FIXED";
      }

      return{tblId:tbl.id};
    })();
  `);

  // Render data rows in batches
  for (let i = 0; i < tabOrder.length; i += BATCH_SIZE) {
    const batch = tabOrder.slice(i, i + BATCH_SIZE);
    const rows = batch.map((r) => ({
      num: String(r.order),
      element: truncate(r.elementDescription, 50),
      role: r.role,
      label: truncate(r.label, 60),
      notes: truncate(r.notes, 80),
    }));

    await bridge.execute(`
      (async () => {
        ${FL}
        var m=await figma.getNodeByIdAsync(${esc(mId)});
        if(!m)return{error:"no master"};
        // Find the table frame
        var tbl=null;
        for(var i=0;i<m.children.length;i++){
          if(m.children[i].name==="Tab Order Table"){tbl=m.children[i];break;}
        }
        if(!tbl)return{error:"no table"};

        var rows=${JSON.stringify(rows)};
        var widths=[${COL.num},${COL.element},${COL.role},${COL.label},${COL.notes}];
        var keys=["num","element","role","label","notes"];

        for(var ri=0;ri<rows.length;ri++){
          var d=rows[ri];
          var row=figma.createFrame();
          row.name="Row "+(${i}+ri+1);
          row.layoutMode="HORIZONTAL";
          row.primaryAxisSizingMode="AUTO";
          row.counterAxisSizingMode="AUTO";
          row.itemSpacing=0;
          row.paddingTop=10;row.paddingBottom=10;
          row.paddingLeft=16;row.paddingRight=16;
          row.fills=[];
          row.counterAxisAlignItems="MIN";
          row.strokes=[{type:"SOLID",color:${C.border}}];
          row.strokeWeight=1;
          row.strokeTopWeight=0;row.strokeRightWeight=0;
          row.strokeBottomWeight=1;row.strokeLeftWeight=0;
          row.strokeAlign="INSIDE";
          tbl.appendChild(row);
          row.layoutSizingHorizontal="FILL";

          for(var c=0;c<keys.length;c++){
            var ct=figma.createText();
            ct.fontName=c===0?F.sb:(c===2?F.mono:F.r);
            ct.fontSize=12;
            ct.lineHeight={unit:"PIXELS",value:18};
            ct.characters=d[keys[c]]||"\\u2014";
            ct.fills=[{type:"SOLID",color:c===2?${C.accent}:${C.textMain}}];
            ct.textAutoResize="HEIGHT";
            ct.resize(widths[c],18);
            row.appendChild(ct);ct.layoutSizingHorizontal="FIXED";
          }
        }

        return{ok:true};
      })();
    `);
  }
}

async function renderReadingOrder(
  bridge: Bridge,
  mId: string,
  readingOrder: ReadingOrderNode[]
): Promise<void> {
  // Flatten reading order into numbered lines with indentation
  const lines: { text: string; indent: number }[] = [];
  let counter = 1;

  function flattenNodes(nodes: ReadingOrderNode[], depth: number): void {
    for (const node of nodes) {
      if (node.landmarkRole) {
        lines.push({
          text: `${counter++}. ${node.landmarkLabel || node.landmarkRole} region`,
          indent: depth,
        });
        if (node.children) flattenNodes(node.children, depth + 1);
      } else if (node.children && node.children.length > 0) {
        lines.push({
          text: `${counter++}. ${node.content}`,
          indent: depth,
        });
        flattenNodes(node.children, depth + 1);
      } else {
        const roleTag = node.role ? ` (${node.role})` : "";
        lines.push({
          text: `${counter++}. ${node.content}${roleTag}`,
          indent: depth,
        });
      }
    }
  }

  flattenNodes(readingOrder, 0);

  // Limit to keep script manageable
  const displayLines = lines.slice(0, 60);

  await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${spacerJS(32)}
      ${sectionHeadingJS("Screen Reader Reading Order")}
      ${spacerJS(8)}

      var desc=figma.createText();desc.fontName=F.r;desc.fontSize=13;
      desc.lineHeight={unit:"PIXELS",value:20};
      desc.characters="Virtual cursor (Browse mode) reading order, reflecting DOM order inferred from auto-layout hierarchy:";
      desc.fills=[{type:"SOLID",color:${C.textMuted}}];
      desc.textAutoResize="HEIGHT";
      m.appendChild(desc);desc.layoutSizingHorizontal="FILL";

      ${spacerJS(12)}

      var list=figma.createFrame();
      list.name="Reading Order List";
      list.layoutMode="VERTICAL";
      list.primaryAxisSizingMode="AUTO";
      list.counterAxisSizingMode="AUTO";
      list.itemSpacing=4;
      list.paddingTop=16;list.paddingBottom=16;
      list.paddingLeft=20;list.paddingRight=20;
      list.fills=[{type:"SOLID",color:${C.bgTableHeader}}];
      list.cornerRadius=8;
      m.appendChild(list);
      list.layoutSizingHorizontal="FILL";

      var lines=${JSON.stringify(displayLines)};
      for(var i=0;i<lines.length;i++){
        var ln=lines[i];
        var row=figma.createFrame();
        row.name="Line "+(i+1);
        row.layoutMode="HORIZONTAL";
        row.primaryAxisSizingMode="AUTO";
        row.counterAxisSizingMode="AUTO";
        row.paddingLeft=ln.indent*24;
        row.fills=[];
        row.itemSpacing=0;
        list.appendChild(row);
        row.layoutSizingHorizontal="FILL";

        var txt=figma.createText();
        txt.fontName=ln.indent===0?F.sb:F.r;
        txt.fontSize=ln.indent===0?14:13;
        txt.lineHeight={unit:"PIXELS",value:ln.indent===0?22:20};
        txt.characters=ln.text;
        txt.fills=[{type:"SOLID",color:ln.indent===0?${C.textMain}:${C.textMuted}}];
        txt.textAutoResize="HEIGHT";
        row.appendChild(txt);txt.layoutSizingHorizontal="FILL";
      }

      ${spacerJS(16)}
      ${dividerJS()}

      return{ok:true};
    })();
  `);
}

async function renderInteractionAnnouncements(
  bridge: Bridge,
  mId: string,
  analysis: A11yOrderAnalysis
): Promise<void> {
  const focusRows = analysis.interactionAnnouncements.onFocus.map((f) => ({
    element: truncate(f.element, 50),
    announcement: truncate(f.announcement, 80),
  }));
  const stateRows = analysis.interactionAnnouncements.stateChanges.map(
    (s) => ({
      trigger: truncate(s.trigger, 50),
      behavior: truncate(s.behavior, 100),
    })
  );

  // Limit focus rows for rendering
  const displayFocusRows = focusRows.slice(0, 25);

  const COL_FOCUS = { element: 320, announcement: CONTENT_W - 320 - 32 };
  const COL_STATE = { trigger: 320, behavior: CONTENT_W - 320 - 32 };

  await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${spacerJS(32)}
      ${sectionHeadingJS("Screen Reader Interaction Announcements")}
      ${spacerJS(16)}

      // Sub-heading: On Focus
      var sh1=figma.createText();sh1.fontName=F.sb;sh1.fontSize=16;
      sh1.lineHeight={unit:"PIXELS",value:24};
      sh1.characters="On Focus";
      sh1.fills=[{type:"SOLID",color:${C.textMain}}];
      sh1.textAutoResize="HEIGHT";
      m.appendChild(sh1);sh1.layoutSizingHorizontal="FILL";

      ${spacerJS(8)}

      // Focus announcements table
      var tbl1=figma.createFrame();
      tbl1.name="Focus Announcements";
      tbl1.layoutMode="VERTICAL";
      tbl1.primaryAxisSizingMode="AUTO";
      tbl1.counterAxisSizingMode="AUTO";
      tbl1.itemSpacing=0;
      tbl1.fills=[{type:"SOLID",color:${C.bgPage}}];
      tbl1.cornerRadius=8;
      tbl1.strokes=[{type:"SOLID",color:${C.border}}];
      tbl1.strokeWeight=1;tbl1.strokeAlign="INSIDE";
      tbl1.clipsContent=true;
      m.appendChild(tbl1);
      tbl1.layoutSizingHorizontal="FILL";

      // Header
      var hdr1=figma.createFrame();
      hdr1.name="Header";
      hdr1.layoutMode="HORIZONTAL";
      hdr1.primaryAxisSizingMode="AUTO";
      hdr1.counterAxisSizingMode="AUTO";
      hdr1.itemSpacing=0;
      hdr1.paddingTop=12;hdr1.paddingBottom=12;
      hdr1.paddingLeft=16;hdr1.paddingRight=16;
      hdr1.fills=[{type:"SOLID",color:${C.bgTableHeader}}];
      hdr1.counterAxisAlignItems="MIN";
      hdr1.strokes=[{type:"SOLID",color:${C.border}}];
      hdr1.strokeWeight=1;
      hdr1.strokeTopWeight=0;hdr1.strokeRightWeight=0;
      hdr1.strokeBottomWeight=1;hdr1.strokeLeftWeight=0;
      hdr1.strokeAlign="INSIDE";
      tbl1.appendChild(hdr1);
      hdr1.layoutSizingHorizontal="FILL";

      var h1a=figma.createText();h1a.fontName=F.sb;h1a.fontSize=12;
      h1a.lineHeight={unit:"PIXELS",value:18};h1a.characters="Element";
      h1a.fills=[{type:"SOLID",color:${C.textMain}}];
      h1a.textAutoResize="HEIGHT";h1a.resize(${COL_FOCUS.element},18);
      hdr1.appendChild(h1a);h1a.layoutSizingHorizontal="FIXED";

      var h1b=figma.createText();h1b.fontName=F.sb;h1b.fontSize=12;
      h1b.lineHeight={unit:"PIXELS",value:18};h1b.characters="Announcement";
      h1b.fills=[{type:"SOLID",color:${C.textMain}}];
      h1b.textAutoResize="HEIGHT";h1b.resize(${COL_FOCUS.announcement},18);
      hdr1.appendChild(h1b);h1b.layoutSizingHorizontal="FIXED";

      // Focus rows
      var fRows=${JSON.stringify(displayFocusRows)};
      for(var i=0;i<fRows.length;i++){
        var r=fRows[i];
        var row=figma.createFrame();
        row.name="Row "+(i+1);
        row.layoutMode="HORIZONTAL";
        row.primaryAxisSizingMode="AUTO";
        row.counterAxisSizingMode="AUTO";
        row.itemSpacing=0;
        row.paddingTop=10;row.paddingBottom=10;
        row.paddingLeft=16;row.paddingRight=16;
        row.fills=[];
        row.counterAxisAlignItems="MIN";
        if(i<fRows.length-1){
          row.strokes=[{type:"SOLID",color:${C.border}}];
          row.strokeWeight=1;
          row.strokeTopWeight=0;row.strokeRightWeight=0;
          row.strokeBottomWeight=1;row.strokeLeftWeight=0;
          row.strokeAlign="INSIDE";
        }
        tbl1.appendChild(row);
        row.layoutSizingHorizontal="FILL";

        var c1=figma.createText();c1.fontName=F.sb;c1.fontSize=12;
        c1.lineHeight={unit:"PIXELS",value:18};c1.characters=r.element;
        c1.fills=[{type:"SOLID",color:${C.textMain}}];
        c1.textAutoResize="HEIGHT";c1.resize(${COL_FOCUS.element},18);
        row.appendChild(c1);c1.layoutSizingHorizontal="FIXED";

        var c2=figma.createText();c2.fontName=F.r;c2.fontSize=12;
        c2.lineHeight={unit:"PIXELS",value:18};c2.characters=r.announcement;
        c2.fills=[{type:"SOLID",color:${C.textMuted}}];
        c2.textAutoResize="HEIGHT";c2.resize(${COL_FOCUS.announcement},18);
        row.appendChild(c2);c2.layoutSizingHorizontal="FIXED";
      }

      ${spacerJS(24)}

      // Sub-heading: State Changes
      var sh2=figma.createText();sh2.fontName=F.sb;sh2.fontSize=16;
      sh2.lineHeight={unit:"PIXELS",value:24};
      sh2.characters="On State Change";
      sh2.fills=[{type:"SOLID",color:${C.textMain}}];
      sh2.textAutoResize="HEIGHT";
      m.appendChild(sh2);sh2.layoutSizingHorizontal="FILL";

      ${spacerJS(8)}

      // State changes table
      var tbl2=figma.createFrame();
      tbl2.name="State Changes";
      tbl2.layoutMode="VERTICAL";
      tbl2.primaryAxisSizingMode="AUTO";
      tbl2.counterAxisSizingMode="AUTO";
      tbl2.itemSpacing=0;
      tbl2.fills=[{type:"SOLID",color:${C.bgPage}}];
      tbl2.cornerRadius=8;
      tbl2.strokes=[{type:"SOLID",color:${C.border}}];
      tbl2.strokeWeight=1;tbl2.strokeAlign="INSIDE";
      tbl2.clipsContent=true;
      m.appendChild(tbl2);
      tbl2.layoutSizingHorizontal="FILL";

      // Header
      var hdr2=figma.createFrame();
      hdr2.name="Header";
      hdr2.layoutMode="HORIZONTAL";
      hdr2.primaryAxisSizingMode="AUTO";
      hdr2.counterAxisSizingMode="AUTO";
      hdr2.itemSpacing=0;
      hdr2.paddingTop=12;hdr2.paddingBottom=12;
      hdr2.paddingLeft=16;hdr2.paddingRight=16;
      hdr2.fills=[{type:"SOLID",color:${C.bgTableHeader}}];
      hdr2.counterAxisAlignItems="MIN";
      hdr2.strokes=[{type:"SOLID",color:${C.border}}];
      hdr2.strokeWeight=1;
      hdr2.strokeTopWeight=0;hdr2.strokeRightWeight=0;
      hdr2.strokeBottomWeight=1;hdr2.strokeLeftWeight=0;
      hdr2.strokeAlign="INSIDE";
      tbl2.appendChild(hdr2);
      hdr2.layoutSizingHorizontal="FILL";

      var h2a=figma.createText();h2a.fontName=F.sb;h2a.fontSize=12;
      h2a.lineHeight={unit:"PIXELS",value:18};h2a.characters="Trigger";
      h2a.fills=[{type:"SOLID",color:${C.textMain}}];
      h2a.textAutoResize="HEIGHT";h2a.resize(${COL_STATE.trigger},18);
      hdr2.appendChild(h2a);h2a.layoutSizingHorizontal="FIXED";

      var h2b=figma.createText();h2b.fontName=F.sb;h2b.fontSize=12;
      h2b.lineHeight={unit:"PIXELS",value:18};h2b.characters="Behavior";
      h2b.fills=[{type:"SOLID",color:${C.textMain}}];
      h2b.textAutoResize="HEIGHT";h2b.resize(${COL_STATE.behavior},18);
      hdr2.appendChild(h2b);h2b.layoutSizingHorizontal="FIXED";

      var sRows=${JSON.stringify(stateRows)};
      for(var i=0;i<sRows.length;i++){
        var r=sRows[i];
        var row=figma.createFrame();
        row.name="Row "+(i+1);
        row.layoutMode="HORIZONTAL";
        row.primaryAxisSizingMode="AUTO";
        row.counterAxisSizingMode="AUTO";
        row.itemSpacing=0;
        row.paddingTop=10;row.paddingBottom=10;
        row.paddingLeft=16;row.paddingRight=16;
        row.fills=[];
        row.counterAxisAlignItems="MIN";
        if(i<sRows.length-1){
          row.strokes=[{type:"SOLID",color:${C.border}}];
          row.strokeWeight=1;
          row.strokeTopWeight=0;row.strokeRightWeight=0;
          row.strokeBottomWeight=1;row.strokeLeftWeight=0;
          row.strokeAlign="INSIDE";
        }
        tbl2.appendChild(row);
        row.layoutSizingHorizontal="FILL";

        var c1=figma.createText();c1.fontName=F.sb;c1.fontSize=12;
        c1.lineHeight={unit:"PIXELS",value:18};c1.characters=r.trigger;
        c1.fills=[{type:"SOLID",color:${C.textMain}}];
        c1.textAutoResize="HEIGHT";c1.resize(${COL_STATE.trigger},18);
        row.appendChild(c1);c1.layoutSizingHorizontal="FIXED";

        var c2=figma.createText();c2.fontName=F.r;c2.fontSize=12;
        c2.lineHeight={unit:"PIXELS",value:18};c2.characters=r.behavior;
        c2.fills=[{type:"SOLID",color:${C.textMuted}}];
        c2.textAutoResize="HEIGHT";c2.resize(${COL_STATE.behavior},18);
        row.appendChild(c2);c2.layoutSizingHorizontal="FIXED";
      }

      ${spacerJS(16)}
      ${dividerJS()}

      return{ok:true};
    })();
  `);
}

async function renderFocusManagement(
  bridge: Bridge,
  mId: string,
  rules: FocusRule[]
): Promise<void> {
  const ruleItems = rules.map((r) => ({
    scenario: r.scenario,
    rule: r.rule,
  }));

  await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${spacerJS(32)}
      ${sectionHeadingJS("Focus Management & State Changes")}
      ${spacerJS(12)}

      var items=${JSON.stringify(ruleItems)};
      for(var i=0;i<items.length;i++){
        var item=items[i];

        var card=figma.createFrame();
        card.name="Focus Rule "+(i+1);
        card.layoutMode="VERTICAL";
        card.primaryAxisSizingMode="AUTO";
        card.counterAxisSizingMode="AUTO";
        card.paddingTop=12;card.paddingBottom=12;
        card.paddingLeft=16;card.paddingRight=16;
        card.itemSpacing=4;
        card.fills=[{type:"SOLID",color:${C.bgTableHeader}}];
        card.cornerRadius=8;
        m.appendChild(card);
        card.layoutSizingHorizontal="FILL";

        var title=figma.createText();title.fontName=F.sb;title.fontSize=13;
        title.lineHeight={unit:"PIXELS",value:20};
        title.characters=item.scenario;
        title.fills=[{type:"SOLID",color:${C.textMain}}];
        title.textAutoResize="HEIGHT";
        card.appendChild(title);title.layoutSizingHorizontal="FILL";

        var body=figma.createText();body.fontName=F.r;body.fontSize=13;
        body.lineHeight={unit:"PIXELS",value:20};
        body.characters=item.rule;
        body.fills=[{type:"SOLID",color:${C.textMuted}}];
        body.textAutoResize="HEIGHT";
        card.appendChild(body);body.layoutSizingHorizontal="FILL";

        ${spacerJS(8)}
      }

      ${spacerJS(16)}
      ${dividerJS()}

      return{ok:true};
    })();
  `);
}

async function renderImplementationNotes(
  bridge: Bridge,
  mId: string,
  analysis: A11yOrderAnalysis
): Promise<void> {
  const notes = analysis.implementationNotes;

  // ARIA table
  const ariaRows = notes.ariaTable.map((a) => ({
    element: truncate(a.element, 40),
    attribute: a.attribute,
    value: a.value,
  }));
  const displayAriaRows = ariaRows.slice(0, 25);

  // KB behavior table
  const kbRows = notes.keyboardBehavior.map((k) => ({
    component: k.component,
    key: k.key,
    action: k.action,
  }));

  const COL_ARIA = { element: 280, attribute: 180, value: CONTENT_W - 280 - 180 - 32 };
  const COL_KB = { component: 200, key: 220, action: CONTENT_W - 200 - 220 - 32 };

  await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${spacerJS(32)}
      ${sectionHeadingJS("Implementation Notes for Developers")}
      ${spacerJS(16)}

      // Sub-heading: Required ARIA
      var sh1=figma.createText();sh1.fontName=F.sb;sh1.fontSize=16;
      sh1.lineHeight={unit:"PIXELS",value:24};
      sh1.characters="Required ARIA (only where native HTML is insufficient)";
      sh1.fills=[{type:"SOLID",color:${C.textMain}}];
      sh1.textAutoResize="HEIGHT";
      m.appendChild(sh1);sh1.layoutSizingHorizontal="FILL";

      ${spacerJS(8)}

      // ARIA table
      var tbl1=figma.createFrame();
      tbl1.name="ARIA Table";
      tbl1.layoutMode="VERTICAL";
      tbl1.primaryAxisSizingMode="AUTO";
      tbl1.counterAxisSizingMode="AUTO";
      tbl1.itemSpacing=0;
      tbl1.fills=[{type:"SOLID",color:${C.bgPage}}];
      tbl1.cornerRadius=8;
      tbl1.strokes=[{type:"SOLID",color:${C.border}}];
      tbl1.strokeWeight=1;tbl1.strokeAlign="INSIDE";
      tbl1.clipsContent=true;
      m.appendChild(tbl1);
      tbl1.layoutSizingHorizontal="FILL";

      // Header
      var hdr1=figma.createFrame();
      hdr1.name="Header";
      hdr1.layoutMode="HORIZONTAL";
      hdr1.primaryAxisSizingMode="AUTO";
      hdr1.counterAxisSizingMode="AUTO";
      hdr1.itemSpacing=0;
      hdr1.paddingTop=12;hdr1.paddingBottom=12;
      hdr1.paddingLeft=16;hdr1.paddingRight=16;
      hdr1.fills=[{type:"SOLID",color:${C.bgTableHeader}}];
      hdr1.counterAxisAlignItems="MIN";
      hdr1.strokes=[{type:"SOLID",color:${C.border}}];
      hdr1.strokeWeight=1;
      hdr1.strokeTopWeight=0;hdr1.strokeRightWeight=0;
      hdr1.strokeBottomWeight=1;hdr1.strokeLeftWeight=0;
      hdr1.strokeAlign="INSIDE";
      tbl1.appendChild(hdr1);
      hdr1.layoutSizingHorizontal="FILL";

      var h1Labels=["Element","Attribute","Value"];
      var h1Widths=[${COL_ARIA.element},${COL_ARIA.attribute},${COL_ARIA.value}];
      for(var c=0;c<h1Labels.length;c++){
        var ht=figma.createText();ht.fontName=F.sb;ht.fontSize=12;
        ht.lineHeight={unit:"PIXELS",value:18};ht.characters=h1Labels[c];
        ht.fills=[{type:"SOLID",color:${C.textMain}}];
        ht.textAutoResize="HEIGHT";ht.resize(h1Widths[c],18);
        hdr1.appendChild(ht);ht.layoutSizingHorizontal="FIXED";
      }

      var aRows=${JSON.stringify(displayAriaRows)};
      for(var i=0;i<aRows.length;i++){
        var d=aRows[i];
        var row=figma.createFrame();
        row.name="Row "+(i+1);
        row.layoutMode="HORIZONTAL";
        row.primaryAxisSizingMode="AUTO";
        row.counterAxisSizingMode="AUTO";
        row.itemSpacing=0;
        row.paddingTop=10;row.paddingBottom=10;
        row.paddingLeft=16;row.paddingRight=16;
        row.fills=[];
        row.counterAxisAlignItems="MIN";
        if(i<aRows.length-1){
          row.strokes=[{type:"SOLID",color:${C.border}}];
          row.strokeWeight=1;
          row.strokeTopWeight=0;row.strokeRightWeight=0;
          row.strokeBottomWeight=1;row.strokeLeftWeight=0;
          row.strokeAlign="INSIDE";
        }
        tbl1.appendChild(row);
        row.layoutSizingHorizontal="FILL";

        var vals=[d.element,d.attribute,d.value];
        var fonts=[F.r,F.mono,F.mono];
        var colors=[${C.textMain},${C.accent},${C.textMuted}];
        var ws=[${COL_ARIA.element},${COL_ARIA.attribute},${COL_ARIA.value}];
        for(var c=0;c<3;c++){
          var ct=figma.createText();ct.fontName=fonts[c];ct.fontSize=12;
          ct.lineHeight={unit:"PIXELS",value:18};ct.characters=vals[c];
          ct.fills=[{type:"SOLID",color:colors[c]}];
          ct.textAutoResize="HEIGHT";ct.resize(ws[c],18);
          row.appendChild(ct);ct.layoutSizingHorizontal="FIXED";
        }
      }

      return{ok:true};
    })();
  `);

  // Keyboard behavior table
  await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${spacerJS(24)}

      var sh2=figma.createText();sh2.fontName=F.sb;sh2.fontSize=16;
      sh2.lineHeight={unit:"PIXELS",value:24};
      sh2.characters="Keyboard Behaviour Expectations";
      sh2.fills=[{type:"SOLID",color:${C.textMain}}];
      sh2.textAutoResize="HEIGHT";
      m.appendChild(sh2);sh2.layoutSizingHorizontal="FILL";

      ${spacerJS(8)}

      var tbl2=figma.createFrame();
      tbl2.name="Keyboard Behavior";
      tbl2.layoutMode="VERTICAL";
      tbl2.primaryAxisSizingMode="AUTO";
      tbl2.counterAxisSizingMode="AUTO";
      tbl2.itemSpacing=0;
      tbl2.fills=[{type:"SOLID",color:${C.bgPage}}];
      tbl2.cornerRadius=8;
      tbl2.strokes=[{type:"SOLID",color:${C.border}}];
      tbl2.strokeWeight=1;tbl2.strokeAlign="INSIDE";
      tbl2.clipsContent=true;
      m.appendChild(tbl2);
      tbl2.layoutSizingHorizontal="FILL";

      var hdr2=figma.createFrame();
      hdr2.name="Header";
      hdr2.layoutMode="HORIZONTAL";
      hdr2.primaryAxisSizingMode="AUTO";
      hdr2.counterAxisSizingMode="AUTO";
      hdr2.itemSpacing=0;
      hdr2.paddingTop=12;hdr2.paddingBottom=12;
      hdr2.paddingLeft=16;hdr2.paddingRight=16;
      hdr2.fills=[{type:"SOLID",color:${C.bgTableHeader}}];
      hdr2.counterAxisAlignItems="MIN";
      hdr2.strokes=[{type:"SOLID",color:${C.border}}];
      hdr2.strokeWeight=1;
      hdr2.strokeTopWeight=0;hdr2.strokeRightWeight=0;
      hdr2.strokeBottomWeight=1;hdr2.strokeLeftWeight=0;
      hdr2.strokeAlign="INSIDE";
      tbl2.appendChild(hdr2);
      hdr2.layoutSizingHorizontal="FILL";

      var h2Labels=["Component","Key","Action"];
      var h2Widths=[${COL_KB.component},${COL_KB.key},${COL_KB.action}];
      for(var c=0;c<h2Labels.length;c++){
        var ht=figma.createText();ht.fontName=F.sb;ht.fontSize=12;
        ht.lineHeight={unit:"PIXELS",value:18};ht.characters=h2Labels[c];
        ht.fills=[{type:"SOLID",color:${C.textMain}}];
        ht.textAutoResize="HEIGHT";ht.resize(h2Widths[c],18);
        hdr2.appendChild(ht);ht.layoutSizingHorizontal="FIXED";
      }

      var kRows=${JSON.stringify(kbRows)};
      for(var i=0;i<kRows.length;i++){
        var d=kRows[i];
        var row=figma.createFrame();
        row.name="Row "+(i+1);
        row.layoutMode="HORIZONTAL";
        row.primaryAxisSizingMode="AUTO";
        row.counterAxisSizingMode="AUTO";
        row.itemSpacing=0;
        row.paddingTop=10;row.paddingBottom=10;
        row.paddingLeft=16;row.paddingRight=16;
        row.fills=[];
        row.counterAxisAlignItems="MIN";
        if(i<kRows.length-1){
          row.strokes=[{type:"SOLID",color:${C.border}}];
          row.strokeWeight=1;
          row.strokeTopWeight=0;row.strokeRightWeight=0;
          row.strokeBottomWeight=1;row.strokeLeftWeight=0;
          row.strokeAlign="INSIDE";
        }
        tbl2.appendChild(row);
        row.layoutSizingHorizontal="FILL";

        var vals=[d.component,d.key,d.action];
        var fonts=[F.r,F.mono,F.r];
        var colors=[${C.textMain},${C.accent},${C.textMuted}];
        var ws=[${COL_KB.component},${COL_KB.key},${COL_KB.action}];
        for(var c=0;c<3;c++){
          var ct=figma.createText();ct.fontName=fonts[c];ct.fontSize=12;
          ct.lineHeight={unit:"PIXELS",value:18};ct.characters=vals[c];
          ct.fills=[{type:"SOLID",color:colors[c]}];
          ct.textAutoResize="HEIGHT";ct.resize(ws[c],18);
          row.appendChild(ct);ct.layoutSizingHorizontal="FIXED";
        }
      }

      return{ok:true};
    })();
  `);

  // Do/Don't rules
  const doRules = notes.dosDonts.filter((r) => r.startsWith("Do:"));
  const dontRules = notes.dosDonts.filter((r) => r.startsWith("Don't:"));

  await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${spacerJS(24)}

      var sh3=figma.createText();sh3.fontName=F.sb;sh3.fontSize=16;
      sh3.lineHeight={unit:"PIXELS",value:24};
      sh3.characters="Do / Don't Rules";
      sh3.fills=[{type:"SOLID",color:${C.textMain}}];
      sh3.textAutoResize="HEIGHT";
      m.appendChild(sh3);sh3.layoutSizingHorizontal="FILL";

      ${spacerJS(8)}

      // Two-column layout
      var cols=figma.createFrame();
      cols.name="Do Dont Columns";
      cols.layoutMode="HORIZONTAL";
      cols.primaryAxisSizingMode="AUTO";
      cols.counterAxisSizingMode="AUTO";
      cols.itemSpacing=16;
      cols.fills=[];
      m.appendChild(cols);
      cols.layoutSizingHorizontal="FILL";

      // Do column
      var doCol=figma.createFrame();
      doCol.name="Do";
      doCol.layoutMode="VERTICAL";
      doCol.primaryAxisSizingMode="AUTO";
      doCol.counterAxisSizingMode="AUTO";
      doCol.paddingTop=16;doCol.paddingBottom=16;
      doCol.paddingLeft=16;doCol.paddingRight=16;
      doCol.itemSpacing=8;
      doCol.cornerRadius=8;
      doCol.fills=[{type:"SOLID",color:${C.greenBg}}];
      cols.appendChild(doCol);
      doCol.layoutSizingHorizontal="FILL";

      var doTitle=figma.createText();doTitle.fontName=F.sb;doTitle.fontSize=14;
      doTitle.characters="\\u2705 Do";
      doTitle.fills=[{type:"SOLID",color:${C.green}}];
      doCol.appendChild(doTitle);doTitle.layoutSizingHorizontal="FILL";

      var doRules=${JSON.stringify(doRules)};
      for(var i=0;i<doRules.length;i++){
        var dt=figma.createText();dt.fontName=F.r;dt.fontSize=12;
        dt.lineHeight={unit:"PIXELS",value:18};
        dt.characters=doRules[i].replace(/^Do: /,"\\u2022 ");
        dt.fills=[{type:"SOLID",color:${C.textMain}}];
        dt.textAutoResize="HEIGHT";
        doCol.appendChild(dt);dt.layoutSizingHorizontal="FILL";
      }

      // Don't column
      var dontCol=figma.createFrame();
      dontCol.name="Don't";
      dontCol.layoutMode="VERTICAL";
      dontCol.primaryAxisSizingMode="AUTO";
      dontCol.counterAxisSizingMode="AUTO";
      dontCol.paddingTop=16;dontCol.paddingBottom=16;
      dontCol.paddingLeft=16;dontCol.paddingRight=16;
      dontCol.itemSpacing=8;
      dontCol.cornerRadius=8;
      dontCol.fills=[{type:"SOLID",color:${C.warnBg}}];
      cols.appendChild(dontCol);
      dontCol.layoutSizingHorizontal="FILL";

      var dontTitle=figma.createText();dontTitle.fontName=F.sb;dontTitle.fontSize=14;
      dontTitle.characters="\\u274c Don't";
      dontTitle.fills=[{type:"SOLID",color:${C.warnBorder}}];
      dontCol.appendChild(dontTitle);dontTitle.layoutSizingHorizontal="FILL";

      var dontRules=${JSON.stringify(dontRules)};
      for(var i=0;i<dontRules.length;i++){
        var dt=figma.createText();dt.fontName=F.r;dt.fontSize=12;
        dt.lineHeight={unit:"PIXELS",value:18};
        dt.characters=dontRules[i].replace(/^Don't: /,"\\u2022 ");
        dt.fills=[{type:"SOLID",color:${C.textMain}}];
        dt.textAutoResize="HEIGHT";
        dontCol.appendChild(dt);dt.layoutSizingHorizontal="FILL";
      }

      ${spacerJS(16)}
      ${dividerJS()}

      return{ok:true};
    })();
  `);
}

async function renderWarnings(
  bridge: Bridge,
  mId: string,
  warnings: Warning[]
): Promise<void> {
  if (warnings.length === 0) return;

  const warningData = warnings.map((w) => ({
    id: w.id,
    severity: w.severity,
    title: w.title,
    description: w.description,
  }));

  await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${spacerJS(32)}
      ${sectionHeadingJS("Warnings")}
      ${spacerJS(12)}

      var warnings=${JSON.stringify(warningData)};
      var sevColors={
        "Critical":{bg:${C.warnBg},border:${C.warnBorder},text:${C.warnBorder}},
        "Warning":{bg:${C.warnAmberBg},border:${C.warnAmberBdr},text:${C.warnAmberBdr}},
        "Info":{bg:${C.infoBg},border:${C.infoBorder},text:${C.infoBorder}}
      };

      for(var i=0;i<warnings.length;i++){
        var w=warnings[i];
        var sc=sevColors[w.severity]||sevColors["Info"];

        var card=figma.createFrame();
        card.name="Warning "+(i+1);
        card.layoutMode="VERTICAL";
        card.primaryAxisSizingMode="AUTO";
        card.counterAxisSizingMode="AUTO";
        card.paddingTop=16;card.paddingBottom=16;
        card.paddingLeft=20;card.paddingRight=16;
        card.itemSpacing=6;
        card.cornerRadius=8;
        card.fills=[{type:"SOLID",color:sc.bg}];
        card.strokes=[{type:"SOLID",color:sc.border}];
        card.strokeWeight=2;
        card.strokeLeftWeight=4;
        card.strokeAlign="INSIDE";
        m.appendChild(card);
        card.layoutSizingHorizontal="FILL";

        // Severity + Title
        var title=figma.createText();title.fontName=F.sb;title.fontSize=14;
        title.lineHeight={unit:"PIXELS",value:22};
        title.characters=w.id+". ["+w.severity+"] "+w.title;
        title.fills=[{type:"SOLID",color:sc.text}];
        title.textAutoResize="HEIGHT";
        card.appendChild(title);title.layoutSizingHorizontal="FILL";

        // Description
        var desc=figma.createText();desc.fontName=F.r;desc.fontSize=13;
        desc.lineHeight={unit:"PIXELS",value:20};
        desc.characters=w.description;
        desc.fills=[{type:"SOLID",color:${C.textMain}}];
        desc.textAutoResize="HEIGHT";
        card.appendChild(desc);desc.layoutSizingHorizontal="FILL";

        ${spacerJS(8)}
      }

      ${spacerJS(16)}
      ${dividerJS()}

      return{ok:true};
    })();
  `);
}

async function renderAuditSummary(
  bridge: Bridge,
  mId: string,
  summary: AuditSummaryRow[]
): Promise<void> {
  const COL_SUM = { severity: 120, count: 80, category: CONTENT_W - 120 - 80 - 32 };

  await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${spacerJS(32)}
      ${sectionHeadingJS("A11y Audit Summary")}
      ${spacerJS(12)}

      var tbl=figma.createFrame();
      tbl.name="Audit Summary";
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

      // Header
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

      var hLabels=["Severity","Count","Category"];
      var hWidths=[${COL_SUM.severity},${COL_SUM.count},${COL_SUM.category}];
      for(var c=0;c<hLabels.length;c++){
        var ht=figma.createText();ht.fontName=F.sb;ht.fontSize=12;
        ht.lineHeight={unit:"PIXELS",value:18};ht.characters=hLabels[c];
        ht.fills=[{type:"SOLID",color:${C.textMain}}];
        ht.textAutoResize="HEIGHT";ht.resize(hWidths[c],18);
        hdr.appendChild(ht);ht.layoutSizingHorizontal="FIXED";
      }

      var sevColorMap={
        "Error":${C.warnBorder},
        "Warning":${C.warnAmberBdr},
        "Suggestion":${C.accent},
        "Total":${C.textMain}
      };

      var rows=${JSON.stringify(summary)};
      for(var i=0;i<rows.length;i++){
        var d=rows[i];
        var row=figma.createFrame();
        row.name="Row "+(i+1);
        row.layoutMode="HORIZONTAL";
        row.primaryAxisSizingMode="AUTO";
        row.counterAxisSizingMode="AUTO";
        row.itemSpacing=0;
        row.paddingTop=10;row.paddingBottom=10;
        row.paddingLeft=16;row.paddingRight=16;
        row.fills=[];
        row.counterAxisAlignItems="MIN";
        if(i<rows.length-1){
          row.strokes=[{type:"SOLID",color:${C.border}}];
          row.strokeWeight=1;
          row.strokeTopWeight=0;row.strokeRightWeight=0;
          row.strokeBottomWeight=1;row.strokeLeftWeight=0;
          row.strokeAlign="INSIDE";
        }
        tbl.appendChild(row);
        row.layoutSizingHorizontal="FILL";

        var sc=sevColorMap[d.severity]||${C.textMain};
        var isTotal=d.severity==="Total";

        var c0=figma.createText();c0.fontName=isTotal?F.b:F.sb;c0.fontSize=12;
        c0.lineHeight={unit:"PIXELS",value:18};c0.characters=d.severity;
        c0.fills=[{type:"SOLID",color:sc}];
        c0.textAutoResize="HEIGHT";c0.resize(${COL_SUM.severity},18);
        row.appendChild(c0);c0.layoutSizingHorizontal="FIXED";

        var c1=figma.createText();c1.fontName=isTotal?F.b:F.sb;c1.fontSize=12;
        c1.lineHeight={unit:"PIXELS",value:18};c1.characters=String(d.count);
        c1.fills=[{type:"SOLID",color:sc}];
        c1.textAutoResize="HEIGHT";c1.resize(${COL_SUM.count},18);
        row.appendChild(c1);c1.layoutSizingHorizontal="FIXED";

        var c2=figma.createText();c2.fontName=F.r;c2.fontSize=12;
        c2.lineHeight={unit:"PIXELS",value:18};c2.characters=d.category;
        c2.fills=[{type:"SOLID",color:${C.textMuted}}];
        c2.textAutoResize="HEIGHT";c2.resize(${COL_SUM.category},18);
        row.appendChild(c2);c2.layoutSizingHorizontal="FIXED";
      }

      return{ok:true};
    })();
  `);
}
