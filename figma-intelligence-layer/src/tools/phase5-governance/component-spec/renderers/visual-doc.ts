/**
 * Visual Doc renderer — Enterprise exhibit-based component spec as a Figma page.
 *
 * Produces Zeroheight/Specify-level spec pages with:
 * - 1343px wide white card sections with 48px gaps
 * - Exhibit pattern: gray artwork (350×248) + content metadata
 * - Orange (#C54600) anatomy markers with type icons
 * - Green/orange/blue spacing overlays
 * - Per-variant live instance exhibits grouped by axis
 * - DS-aware font + palette integration via font-config / token-binder
 *
 * IMPORTANT Figma Plugin API pattern:
 *   layoutSizingHorizontal = "FILL" only works AFTER the node is appended
 *   to an auto-layout parent. Always: appendChild() first, then set sizing.
 */
import { getBridge } from "../../../../shared/figma-bridge.js";
import type { ComponentSpec, SpecSectionContent, ClassifiedElement } from "../types.js";
import { computeMarkerPositions } from "./anatomy-diagram.js";

// ── Design Tokens ─────────────────────────────────────────────────────────

const PAGE_W = 1343;
const PAD = 64;
const SECTION_GAP = 48;
const CARD_PAD = 64;
const CARD_ITEM_GAP = 64;
const CONTENT_W = PAGE_W - PAD * 2; // 1215

// Exhibit artwork dimensions
const ARTWORK_W = 350;
const ARTWORK_H = 160;
const EXHIBIT_GAP = 64;

const C = {
  textMain:      "{r:0,g:0,b:0}",                   // #000000
  textMuted:     "{r:0.42,g:0.42,b:0.42}",          // #6B6B6B
  bgCard:        "{r:0.949,g:0.949,b:0.949}",       // #F2F2F2
  bgPage:        "{r:1,g:1,b:1}",                    // #FFFFFF
  border:        "{r:0.898,g:0.906,b:0.922}",       // #E5E7EB
  success:       "{r:0.086,g:0.639,b:0.290}",       // #16A34A
  error:         "{r:0.863,g:0.149,b:0.149}",       // #DC2626
  white:         "{r:1,g:1,b:1}",
  // Spec annotation colors
  markerOrange:  "{r:0.773,g:0.275,b:0}",           // #C54600
  padGreen:      "{r:0,g:0.490,b:0}",               // #007D00
  gapOrange:     "{r:0.773,g:0.275,b:0}",           // #C54600
  sizeBlue:      "{r:0.051,g:0.412,b:0.831}",       // #0D69D4
};

type Bridge = {
  execute(code: string): Promise<{ success: boolean; result?: unknown; error?: string }>;
};

function esc(s: string): string { return JSON.stringify(s); }

// ── Font loader (Inter with fallbacks) ────────────────────────────────────

const FL = `
var F={};
async function lf(k,a){for(var i=0;i<a.length;i++){try{await figma.loadFontAsync(a[i]);F[k]=a[i];return}catch(e){}}F[k]={family:"Arial",style:"Regular"};try{await figma.loadFontAsync(F[k])}catch(e){}}
await lf("b",[{family:"Inter",style:"Bold"},{family:"Roboto",style:"Bold"}]);
await lf("sb",[{family:"Inter",style:"SemiBold"},{family:"Inter",style:"Medium"},{family:"Roboto",style:"Medium"}]);
await lf("r",[{family:"Inter",style:"Regular"},{family:"Roboto",style:"Regular"}]);
await lf("mono",[{family:"SF Mono",style:"Regular"},{family:"Roboto Mono",style:"Regular"},{family:"Courier New",style:"Regular"}]);
`;

// ── Helpers ───────────────────────────────────────────────────────────────

function spacerJS(h: number, parent: string = "m"): string {
  return `
    (function(){
      var sp=figma.createFrame();
      sp.resize(4,${h});sp.fills=[];
      ${parent}.appendChild(sp);
      sp.layoutSizingHorizontal="FILL";
    })();`;
}

// Helper: create a text node, append to parent, then set FILL sizing
function textFillJS(
  varName: string,
  parent: string,
  fontKey: string,
  fontSize: number,
  lineH: number,
  charsExpr: string,
  colorExpr: string,
  extra: string = "",
): string {
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

// ── Deep style extractor (injected into Figma script for variants) ────────

const EXTRACT_STYLE_FN = `
function extractStyle(node){
  var info={fills:[],texts:[],padding:null,radius:null,w:Math.round(node.width),h:Math.round(node.height)};
  if(Array.isArray(node.fills)){
    for(var fi=0;fi<node.fills.length;fi++){
      var p=node.fills[fi];
      if(p.type==="SOLID"&&p.visible!==false&&p.color){
        var r=Math.round(p.color.r*255),g=Math.round(p.color.g*255),b=Math.round(p.color.b*255);
        info.fills.push("#"+[r,g,b].map(function(v){return v.toString(16).padStart(2,"0")}).join(""));
      }
    }
  }
  if(typeof node.cornerRadius==="number"&&node.cornerRadius>0)info.radius=node.cornerRadius;
  if("paddingTop" in node){
    var pt=node.paddingTop||0,pr=node.paddingRight||0,pb=node.paddingBottom||0,pl=node.paddingLeft||0;
    if(pt+pr+pb+pl>0)info.padding=pt+", "+pr+", "+pb+", "+pl;
  }
  var q=("children" in node)?node.children.slice(0,12):[];
  var depth=0;
  while(q.length>0&&depth<3){
    var next=[];depth++;
    for(var qi=0;qi<q.length;qi++){
      var c=q[qi];
      if(c.type==="TEXT"){
        var fn=c.fontName;
        var family=(fn&&fn!==figma.mixed)?fn.family:"Mixed";
        var style=(fn&&fn!==figma.mixed)?fn.style:"";
        var fs=(typeof c.fontSize==="number")?c.fontSize:0;
        info.texts.push(family+" "+style+" "+fs);
      }
      if(Array.isArray(c.fills)){
        for(var cfi=0;cfi<c.fills.length;cfi++){
          var cp=c.fills[cfi];
          if(cp.type==="SOLID"&&cp.visible!==false&&cp.color){
            var cr=Math.round(cp.color.r*255),cg=Math.round(cp.color.g*255),cb=Math.round(cp.color.b*255);
            var hex="#"+[cr,cg,cb].map(function(v){return v.toString(16).padStart(2,"0")}).join("");
            if(info.fills.indexOf(hex)===-1)info.fills.push(hex);
          }
        }
      }
      if("children" in c&&c.children)for(var sci=0;sci<Math.min(c.children.length,8);sci++)next.push(c.children[sci]);
    }
    q=next;
  }
  var seen={};info.texts=info.texts.filter(function(t){if(seen[t])return false;seen[t]=true;return true;});
  return info;
}
`;

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 1: LAYOUT FOUNDATION — Card-based sections
// ══════════════════════════════════════════════════════════════════════════

async function initPage(bridge: Bridge, pageName: string): Promise<{ pageId: string; mId: string }> {
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
      m.itemSpacing=${SECTION_GAP};
      m.fills=[{type:"SOLID",color:${C.bgPage}}];
      m.clipsContent=false;
      pg.appendChild(m);
      return {pageId:pg.id,mId:m.id};
    })();
  `);
  if (!r.success) throw new Error(`Init: ${r.error}`);
  return r.result as { pageId: string; mId: string };
}

// ── renderDocHeader — Large title + minimal description (no pill badges) ──

async function renderDocHeaderAndHero(
  bridge: Bridge, mId: string, name: string, description: string, spec: ComponentSpec,
  sectionLabels?: string[],
): Promise<void> {
  // Build subtitle from available sections
  const subtitle = sectionLabels && sectionLabels.length > 0
    ? "Interactive " + sectionLabels.join(", ") + " \u00B7 Component Specification"
    : "Component Specification";
  const compW = spec.extraction.snapshot.width || 200;
  const compH = spec.extraction.snapshot.height || 60;
  const heroScale = Math.min(3, Math.max(1.5, 400 / Math.max(compW, compH)));
  const canvasW = Math.max(600, Math.round(compW * heroScale) + 120);
  const canvasH = Math.round(compH * heroScale) + 80;

  const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      // Header card
      var hCard=figma.createFrame();
      hCard.name="Header";
      hCard.layoutMode="VERTICAL";
      hCard.primaryAxisSizingMode="AUTO";
      hCard.counterAxisSizingMode="AUTO";
      hCard.paddingTop=${CARD_PAD};hCard.paddingBottom=${CARD_PAD};
      hCard.paddingLeft=${CARD_PAD};hCard.paddingRight=${CARD_PAD};
      hCard.itemSpacing=16;
      hCard.fills=[{type:"SOLID",color:${C.white}}];
      hCard.cornerRadius=12;
      m.appendChild(hCard);
      hCard.layoutSizingHorizontal="FILL";

      // 64px title
      var t=figma.createText();
      t.fontName=F.b;t.fontSize=64;
      t.lineHeight={unit:"PIXELS",value:72};
      t.characters=${esc(name)};
      t.fills=[{type:"SOLID",color:${C.textMain}}];
      t.letterSpacing={unit:"PIXELS",value:-2};
      t.textAutoResize="HEIGHT";
      hCard.appendChild(t);
      t.layoutSizingHorizontal="FILL";

      // Subtitle (section summary)
      var sub=figma.createText();
      sub.fontName=F.r;sub.fontSize=16;
      sub.lineHeight={unit:"PIXELS",value:24};
      sub.characters=${esc(subtitle)};
      sub.fills=[{type:"SOLID",color:${C.textMuted}}];
      sub.letterSpacing={unit:"PIXELS",value:0.3};
      sub.textAutoResize="HEIGHT";
      hCard.appendChild(sub);
      sub.layoutSizingHorizontal="FILL";

      // Description
      var desc=figma.createText();
      desc.fontName=F.r;desc.fontSize=18;
      desc.lineHeight={unit:"PIXELS",value:28};
      desc.characters=${esc(description)};
      desc.fills=[{type:"SOLID",color:${C.textMuted}}];
      desc.textAutoResize="HEIGHT";
      hCard.appendChild(desc);
      desc.layoutSizingHorizontal="FILL";

      // Hero section (merged into same call)
      var sourceNode=await figma.getNodeByIdAsync(${esc(spec.nodeId)});
      if(sourceNode){
        var heroCard=figma.createFrame();heroCard.name="Hero";
        heroCard.layoutMode="VERTICAL";
        heroCard.primaryAxisSizingMode="AUTO";heroCard.counterAxisSizingMode="AUTO";
        heroCard.itemSpacing=0;heroCard.fills=[];
        m.appendChild(heroCard);heroCard.layoutSizingHorizontal="FILL";

        var canvas=figma.createFrame();canvas.name="Hero Canvas";
        canvas.layoutMode="HORIZONTAL";
        canvas.primaryAxisSizingMode="FIXED";canvas.counterAxisSizingMode="FIXED";
        canvas.resize(${canvasW},${canvasH});
        canvas.fills=[{type:"SOLID",color:${C.bgCard}}];canvas.cornerRadius=12;
        canvas.primaryAxisAlignItems="CENTER";canvas.counterAxisAlignItems="CENTER";
        canvas.clipsContent=true;
        heroCard.appendChild(canvas);canvas.layoutSizingHorizontal="FILL";

        var src=sourceNode;
        if(src.type==="COMPONENT_SET"&&src.children.length>0)src=src.children[0];
        var clone=src.clone();
        ${heroScale > 1 ? `clone.rescale(${heroScale});` : ""}
        canvas.appendChild(clone);
      }

      return{ok:true};
    })();
  `);
  if (!r.success) console.error("Header+Hero failed:", r.error);
}

// ── Section card wrapper — white card with 64px padding ──────────────────

function sectionCardOpenJS(varName: string, parent: string, sectionName: string): string {
  return `
    var ${varName}=figma.createFrame();
    ${varName}.name=${esc(sectionName)};
    ${varName}.layoutMode="VERTICAL";
    ${varName}.primaryAxisSizingMode="AUTO";
    ${varName}.counterAxisSizingMode="AUTO";
    ${varName}.paddingTop=0;${varName}.paddingBottom=${CARD_PAD};
    ${varName}.paddingLeft=${CARD_PAD};${varName}.paddingRight=${CARD_PAD};
    ${varName}.itemSpacing=${CARD_ITEM_GAP};
    ${varName}.fills=[{type:"SOLID",color:${C.white}}];
    ${varName}.cornerRadius=12;
    ${varName}.clipsContent=true;
    ${parent}.appendChild(${varName});
    ${varName}.layoutSizingHorizontal="FILL";

    // Accent bar at top of card
    var ${varName}Accent=figma.createFrame();
    ${varName}Accent.name="Accent";
    ${varName}Accent.resize(4,3);
    ${varName}Accent.fills=[{type:"SOLID",color:${C.markerOrange}}];
    ${varName}.appendChild(${varName}Accent);
    ${varName}Accent.layoutSizingHorizontal="FILL";

    // Top padding spacer (replaces paddingTop since accent bar is first child)
    var ${varName}TopPad=figma.createFrame();
    ${varName}TopPad.name="TopPad";
    ${varName}TopPad.resize(4,${CARD_PAD - 3});
    ${varName}TopPad.fills=[];
    ${varName}.appendChild(${varName}TopPad);
    ${varName}TopPad.layoutSizingHorizontal="FILL";`;
}

// ── Section title — 48px Inter Bold ──────────────────────────────────────

function sectionTitleJS(varName: string, parent: string, title: string, sectionNum?: number): string {
  const displayTitle = sectionNum != null
    ? String(sectionNum).padStart(2, "0") + "  " + title
    : title;
  return `
    var ${varName}=figma.createText();
    ${varName}.fontName=F.b;${varName}.fontSize=28;
    ${varName}.lineHeight={unit:"PIXELS",value:36};
    ${varName}.characters=${esc(displayTitle)};
    ${varName}.fills=[{type:"SOLID",color:${C.textMain}}];
    ${varName}.letterSpacing={unit:"PIXELS",value:-0.5};
    ${varName}.textAutoResize="HEIGHT";
    ${parent}.appendChild(${varName});
    ${varName}.layoutSizingHorizontal="FILL";`;
}

// ── Subsection title — 36px Inter Bold ───────────────────────────────────

function subsectionTitleJS(varName: string, parent: string, title: string): string {
  return `
    var ${varName}=figma.createText();
    ${varName}.fontName=F.b;${varName}.fontSize=20;
    ${varName}.lineHeight={unit:"PIXELS",value:28};
    ${varName}.characters=${esc(title)};
    ${varName}.fills=[{type:"SOLID",color:${C.textMain}}];
    ${varName}.letterSpacing={unit:"PIXELS",value:0};
    ${varName}.textAutoResize="HEIGHT";
    ${parent}.appendChild(${varName});
    ${varName}.layoutSizingHorizontal="FILL";`;
}

// ══════════════════════════════════════════════════════════════════════════
//  TEXT-BASED SUB-RENDERERS (for knowledge sections)
// ══════════════════════════════════════════════════════════════════════════

async function renderTextSection(
  bridge: Bridge, mId: string, title: string, content: SpecSectionContent, sectionNum?: number,
): Promise<void> {
  // Create a section card, add title, then render content inside it
  const contentJS = buildContentJS("sc", content);

  const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${sectionCardOpenJS("sc", "m", title)}
      ${sectionTitleJS("stitle", "sc", title, sectionNum)}
      ${contentJS}

      return{ok:true};
    })();
  `);
  if (!r.success) console.error(`Text section "${title}" failed:`, r.error);
}

function buildContentJS(parent: string, content: SpecSectionContent): string {
  switch (content.kind) {
    case "paragraph":
      return textFillJS("_p", parent, "r", 16, 26, esc(content.text), C.textMuted);

    case "key-value": {
      const capped = content.entries.slice(0, 40);
      return `
        var _kvOuter=figma.createFrame();_kvOuter.name="Key-Value";
        _kvOuter.layoutMode="VERTICAL";
        _kvOuter.primaryAxisSizingMode="AUTO";_kvOuter.counterAxisSizingMode="AUTO";
        _kvOuter.itemSpacing=0;_kvOuter.fills=[];
        ${parent}.appendChild(_kvOuter);_kvOuter.layoutSizingHorizontal="FILL";
        var _kvEntries=${JSON.stringify(capped)};
        for(var _kvi=0;_kvi<_kvEntries.length;_kvi++){
          var _kvRow=figma.createFrame();_kvRow.name=_kvEntries[_kvi].label;
          _kvRow.layoutMode="HORIZONTAL";
          _kvRow.primaryAxisSizingMode="AUTO";_kvRow.counterAxisSizingMode="AUTO";
          _kvRow.itemSpacing=16;_kvRow.paddingTop=10;_kvRow.paddingBottom=10;
          _kvRow.fills=[];_kvRow.counterAxisAlignItems="MIN";
          _kvRow.strokes=[{type:"SOLID",color:${C.border}}];
          _kvRow.strokeWeight=1;_kvRow.strokeTopWeight=0;_kvRow.strokeRightWeight=0;
          _kvRow.strokeBottomWeight=1;_kvRow.strokeLeftWeight=0;_kvRow.strokeAlign="INSIDE";
          _kvOuter.appendChild(_kvRow);_kvRow.layoutSizingHorizontal="FILL";
          var _kvLbl=figma.createText();_kvLbl.fontName=F.sb;_kvLbl.fontSize=14;
          _kvLbl.lineHeight={unit:"PIXELS",value:20};
          _kvLbl.characters=_kvEntries[_kvi].label;
          _kvLbl.fills=[{type:"SOLID",color:${C.textMuted}}];
          _kvLbl.textAutoResize="HEIGHT";_kvLbl.resize(200,20);
          _kvRow.appendChild(_kvLbl);_kvLbl.layoutSizingHorizontal="FIXED";
          var _kvVal=figma.createText();_kvVal.fontName=F.r;_kvVal.fontSize=16;
          _kvVal.lineHeight={unit:"PIXELS",value:24};
          _kvVal.characters=_kvEntries[_kvi].value||"\\u2014";
          _kvVal.fills=[{type:"SOLID",color:${C.textMain}}];
          _kvVal.textAutoResize="HEIGHT";
          _kvRow.appendChild(_kvVal);_kvVal.layoutSizingHorizontal="FILL";
        }`;
    }

    case "table":
    case "structured-data": {
      const headers = content.kind === "table" ? content.headers : content.columns;
      const rows = content.kind === "table"
        ? content.rows.slice(0, 50)
        : content.rows.slice(0, 50).map(r => headers.map(c => r[c] ?? "\u2014"));
      const colCount = headers.length;
      const cellW = Math.floor((CONTENT_W - CARD_PAD * 2 - 32) / colCount);
      return `
        var _tHeaders=${JSON.stringify(headers)};
        var _tRows=${JSON.stringify(rows)};
        var _tCellW=${cellW};
        var _tbl=figma.createFrame();_tbl.name="Table";
        _tbl.layoutMode="VERTICAL";
        _tbl.primaryAxisSizingMode="AUTO";_tbl.counterAxisSizingMode="AUTO";
        _tbl.itemSpacing=0;_tbl.fills=[{type:"SOLID",color:${C.white}}];
        _tbl.cornerRadius=8;
        _tbl.strokes=[{type:"SOLID",color:${C.border}}];_tbl.strokeWeight=1;_tbl.strokeAlign="INSIDE";
        _tbl.clipsContent=true;
        ${parent}.appendChild(_tbl);_tbl.layoutSizingHorizontal="FILL";
        var _tHdr=figma.createFrame();_tHdr.name="Header";
        _tHdr.layoutMode="HORIZONTAL";
        _tHdr.primaryAxisSizingMode="AUTO";_tHdr.counterAxisSizingMode="AUTO";
        _tHdr.itemSpacing=0;_tHdr.paddingTop=12;_tHdr.paddingBottom=12;
        _tHdr.paddingLeft=16;_tHdr.paddingRight=16;
        _tHdr.fills=[{type:"SOLID",color:${C.bgCard}}];_tHdr.counterAxisAlignItems="MIN";
        _tHdr.strokes=[{type:"SOLID",color:${C.border}}];_tHdr.strokeWeight=1;
        _tHdr.strokeTopWeight=0;_tHdr.strokeRightWeight=0;_tHdr.strokeBottomWeight=1;_tHdr.strokeLeftWeight=0;
        _tHdr.strokeAlign="INSIDE";
        _tbl.appendChild(_tHdr);_tHdr.layoutSizingHorizontal="FILL";
        for(var _hc=0;_hc<_tHeaders.length;_hc++){
          var _ht=figma.createText();_ht.fontName=F.sb;_ht.fontSize=14;
          _ht.lineHeight={unit:"PIXELS",value:20};_ht.characters=_tHeaders[_hc]||"";
          _ht.fills=[{type:"SOLID",color:${C.textMain}}];_ht.textAutoResize="HEIGHT";
          _ht.resize(_tCellW,20);_tHdr.appendChild(_ht);_ht.layoutSizingHorizontal="FIXED";
        }
        for(var _ri=0;_ri<_tRows.length;_ri++){
          var _tRow=figma.createFrame();_tRow.name="Row "+(_ri+1);
          _tRow.layoutMode="HORIZONTAL";
          _tRow.primaryAxisSizingMode="AUTO";_tRow.counterAxisSizingMode="AUTO";
          _tRow.itemSpacing=0;_tRow.paddingTop=10;_tRow.paddingBottom=10;
          _tRow.paddingLeft=16;_tRow.paddingRight=16;_tRow.fills=[];_tRow.counterAxisAlignItems="MIN";
          if(_ri<_tRows.length-1){
            _tRow.strokes=[{type:"SOLID",color:${C.border}}];_tRow.strokeWeight=1;
            _tRow.strokeTopWeight=0;_tRow.strokeRightWeight=0;_tRow.strokeBottomWeight=1;_tRow.strokeLeftWeight=0;
            _tRow.strokeAlign="INSIDE";
          }
          _tbl.appendChild(_tRow);_tRow.layoutSizingHorizontal="FILL";
          for(var _rc=0;_rc<_tHeaders.length;_rc++){
            var _ct=figma.createText();_ct.fontName=F.r;_ct.fontSize=14;
            _ct.lineHeight={unit:"PIXELS",value:20};
            _ct.characters=(_tRows[_ri][_rc]!=null?_tRows[_ri][_rc]:"")||"\\u2014";
            _ct.fills=[{type:"SOLID",color:${C.textMuted}}];_ct.textAutoResize="HEIGHT";
            _ct.resize(_tCellW,20);_tRow.appendChild(_ct);_ct.layoutSizingHorizontal="FIXED";
          }
        }`;
    }

    case "list":
    case "rules": {
      const items = content.items.slice(0, 60);
      return `
        var _lItems=${JSON.stringify(items)};
        var _lOuter=figma.createFrame();_lOuter.name="List";
        _lOuter.layoutMode="VERTICAL";
        _lOuter.primaryAxisSizingMode="AUTO";_lOuter.counterAxisSizingMode="AUTO";
        _lOuter.itemSpacing=6;_lOuter.fills=[];_lOuter.paddingLeft=8;
        ${parent}.appendChild(_lOuter);_lOuter.layoutSizingHorizontal="FILL";
        for(var _li=0;_li<_lItems.length;_li++){
          var _lRow=figma.createFrame();_lRow.name="Item "+(_li+1);
          _lRow.layoutMode="HORIZONTAL";
          _lRow.primaryAxisSizingMode="AUTO";_lRow.counterAxisSizingMode="AUTO";
          _lRow.itemSpacing=8;_lRow.fills=[];_lRow.counterAxisAlignItems="MIN";
          _lOuter.appendChild(_lRow);_lRow.layoutSizingHorizontal="FILL";
          var _lBul=figma.createText();_lBul.fontName=F.r;_lBul.fontSize=16;
          _lBul.lineHeight={unit:"PIXELS",value:26};_lBul.characters="\\u2022";
          _lBul.fills=[{type:"SOLID",color:${C.textMuted}}];_lBul.textAutoResize="WIDTH_AND_HEIGHT";
          _lRow.appendChild(_lBul);
          var _lTxt=figma.createText();_lTxt.fontName=F.r;_lTxt.fontSize=16;
          _lTxt.lineHeight={unit:"PIXELS",value:26};_lTxt.characters=_lItems[_li]||"\\u2014";
          _lTxt.fills=[{type:"SOLID",color:${C.textMuted}}];_lTxt.textAutoResize="HEIGHT";
          _lRow.appendChild(_lTxt);_lTxt.layoutSizingHorizontal="FILL";
        }`;
    }

    case "do-dont": {
      const cappedDos = content.dos.slice(0, 30);
      const cappedDonts = content.donts.slice(0, 30);
      return `
        var _ddDos=${JSON.stringify(cappedDos)};
        var _ddDonts=${JSON.stringify(cappedDonts)};
        var _ddOuter=figma.createFrame();_ddOuter.name="Do-Dont";
        _ddOuter.layoutMode="HORIZONTAL";
        _ddOuter.primaryAxisSizingMode="AUTO";_ddOuter.counterAxisSizingMode="AUTO";
        _ddOuter.itemSpacing=24;_ddOuter.fills=[];_ddOuter.counterAxisAlignItems="MIN";
        ${parent}.appendChild(_ddOuter);_ddOuter.layoutSizingHorizontal="FILL";

        function _ddBuildCol(parent,title,items,iconChar,iconColor,titleColor){
          var col=figma.createFrame();col.name=title;
          col.layoutMode="VERTICAL";
          col.primaryAxisSizingMode="AUTO";col.counterAxisSizingMode="AUTO";
          col.itemSpacing=8;col.paddingTop=16;col.paddingBottom=16;
          col.paddingLeft=16;col.paddingRight=16;
          col.fills=[{type:"SOLID",color:${C.bgCard}}];col.cornerRadius=8;
          parent.appendChild(col);col.layoutSizingHorizontal="FILL";
          var ct=figma.createText();ct.fontName=F.sb;ct.fontSize=16;
          ct.lineHeight={unit:"PIXELS",value:22};ct.characters=iconChar+" "+title;
          ct.fills=[{type:"SOLID",color:titleColor}];ct.textAutoResize="WIDTH_AND_HEIGHT";
          col.appendChild(ct);
          var sp=figma.createFrame();sp.resize(4,4);sp.fills=[];col.appendChild(sp);sp.layoutSizingHorizontal="FILL";
          for(var i=0;i<items.length;i++){
            var row=figma.createFrame();row.name=title+" "+(i+1);
            row.layoutMode="HORIZONTAL";
            row.primaryAxisSizingMode="AUTO";row.counterAxisSizingMode="AUTO";
            row.itemSpacing=8;row.fills=[];row.counterAxisAlignItems="MIN";
            col.appendChild(row);row.layoutSizingHorizontal="FILL";
            var icon=figma.createText();icon.fontName=F.sb;icon.fontSize=14;
            icon.lineHeight={unit:"PIXELS",value:22};icon.characters=iconChar;
            icon.fills=[{type:"SOLID",color:iconColor}];icon.textAutoResize="WIDTH_AND_HEIGHT";
            row.appendChild(icon);
            var txt=figma.createText();txt.fontName=F.r;txt.fontSize=14;
            txt.lineHeight={unit:"PIXELS",value:22};txt.characters=items[i]||"\\u2014";
            txt.fills=[{type:"SOLID",color:${C.textMuted}}];txt.textAutoResize="HEIGHT";
            row.appendChild(txt);txt.layoutSizingHorizontal="FILL";
          }
        }
        if(_ddDos.length>0)_ddBuildCol(_ddOuter,"Do",_ddDos,"\\u2713",${C.success},${C.success});
        if(_ddDonts.length>0)_ddBuildCol(_ddOuter,"Don\\u2019t",_ddDonts,"\\u2717",${C.error},${C.error});`;
    }

    case "mixed":
      return content.blocks.map(b => buildContentJS(parent, b)).join("\n");

    default:
      return "";
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 2: EXHIBIT RENDERER — Reusable artwork + content pattern
// ══════════════════════════════════════════════════════════════════════════

/**
 * Generate JS for a single exhibit: gray artwork left + content metadata right.
 * The artwork frame is absolute-positioned for component placement;
 * content is an auto-layout column with label, element info, and attributes.
 */
function exhibitOpenJS(
  varName: string,
  parent: string,
  label: string,
  artworkVar: string,
  contentVar: string,
): string {
  return `
    var ${varName}=figma.createFrame();${varName}.name=${esc(label)};
    ${varName}.layoutMode="HORIZONTAL";
    ${varName}.primaryAxisSizingMode="AUTO";${varName}.counterAxisSizingMode="AUTO";
    ${varName}.itemSpacing=${EXHIBIT_GAP};
    ${varName}.fills=[];
    ${varName}.counterAxisAlignItems="MIN";
    ${parent}.appendChild(${varName});${varName}.layoutSizingHorizontal="FILL";

    var ${artworkVar}=figma.createFrame();${artworkVar}.name="Artwork";
    ${artworkVar}.layoutMode="HORIZONTAL";
    ${artworkVar}.primaryAxisSizingMode="FIXED";${artworkVar}.counterAxisSizingMode="FIXED";
    ${artworkVar}.resize(${ARTWORK_W},${ARTWORK_H});
    ${artworkVar}.fills=[{type:"SOLID",color:${C.bgCard}}];
    ${artworkVar}.cornerRadius=8;
    ${artworkVar}.primaryAxisAlignItems="CENTER";${artworkVar}.counterAxisAlignItems="CENTER";
    ${artworkVar}.clipsContent=true;
    ${varName}.appendChild(${artworkVar});

    var ${contentVar}=figma.createFrame();${contentVar}.name="Content";
    ${contentVar}.layoutMode="VERTICAL";
    ${contentVar}.primaryAxisSizingMode="AUTO";${contentVar}.counterAxisSizingMode="AUTO";
    ${contentVar}.itemSpacing=16;${contentVar}.fills=[];
    ${varName}.appendChild(${contentVar});${contentVar}.layoutSizingHorizontal="FILL";`;
}

/**
 * Generate JS for a type icon (20x20 frame with node type indicator)
 */
function typeIconJS(varName: string, parent: string, nodeType: string): string {
  let glyph = "\u25A1"; // default: square for FRAME
  if (nodeType === "INSTANCE") glyph = "\u25C7"; // diamond
  else if (nodeType === "TEXT") glyph = "T";

  return `
    var ${varName}=figma.createFrame();${varName}.name="TypeIcon";
    ${varName}.layoutMode="HORIZONTAL";
    ${varName}.primaryAxisSizingMode="FIXED";${varName}.counterAxisSizingMode="FIXED";
    ${varName}.resize(20,20);
    ${varName}.fills=[];
    ${varName}.strokes=[{type:"SOLID",color:${C.textMuted}}];
    ${varName}.strokeWeight=1;${varName}.strokeAlign="INSIDE";
    ${varName}.cornerRadius=3;
    ${varName}.primaryAxisAlignItems="CENTER";${varName}.counterAxisAlignItems="CENTER";
    ${parent}.appendChild(${varName});
    var ${varName}Lbl=figma.createText();${varName}Lbl.fontName=F.r;${varName}Lbl.fontSize=10;
    ${varName}Lbl.characters=${esc(glyph)};
    ${varName}Lbl.fills=[{type:"SOLID",color:${C.textMuted}}];
    ${varName}Lbl.textAutoResize="WIDTH_AND_HEIGHT";
    ${varName}.appendChild(${varName}Lbl);`;
}

/**
 * Generate JS for an attribute row (name: value)
 */
function attrRowJS(varName: string, parent: string, name: string, value: string): string {
  return `
    var ${varName}=figma.createFrame();${varName}.name=${esc(name)};
    ${varName}.layoutMode="HORIZONTAL";
    ${varName}.primaryAxisSizingMode="AUTO";${varName}.counterAxisSizingMode="AUTO";
    ${varName}.itemSpacing=4;${varName}.fills=[];
    ${parent}.appendChild(${varName});${varName}.layoutSizingHorizontal="FILL";
    var ${varName}N=figma.createText();${varName}N.fontName=F.r;${varName}N.fontSize=11;
    ${varName}N.lineHeight={unit:"PIXELS",value:16};
    ${varName}N.characters=${esc(name + ":")};
    ${varName}N.fills=[{type:"SOLID",color:${C.textMuted}}];
    ${varName}N.textAutoResize="WIDTH_AND_HEIGHT";
    ${varName}N.resize(90,16);
    ${varName}.appendChild(${varName}N);
    ${varName}N.layoutSizingHorizontal="FIXED";
    var ${varName}V=figma.createText();${varName}V.fontName=F.sb;${varName}V.fontSize=11;
    ${varName}V.lineHeight={unit:"PIXELS",value:16};
    ${varName}V.characters=${esc(value)};
    ${varName}V.fills=[{type:"SOLID",color:${C.textMain}}];
    ${varName}V.textAutoResize="WIDTH_AND_HEIGHT";
    ${varName}.appendChild(${varName}V);`;
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 4: ANATOMY EXHIBIT — Orange markers, type icons, attributes
// ══════════════════════════════════════════════════════════════════════════

async function renderAnatomyExhibit(
  bridge: Bridge, mId: string, spec: ComponentSpec, sectionNum?: number,
): Promise<void> {
  const anatomy = spec.extraction.anatomy;
  const elements = anatomy.elements.filter(
    el => el.visible && el.position.w > 0 && el.position.h > 0,
  );
  if (elements.length === 0) return;

  const compW = anatomy.componentBounds?.w || spec.extraction.snapshot.width || 200;
  const compH = anatomy.componentBounds?.h || spec.extraction.snapshot.height || 60;

  // Scale up small components
  const scale = Math.min(3, Math.max(1, 140 / Math.min(compW, compH)));
  const displayW = Math.round(compW * scale);
  const displayH = Math.round(compH * scale);

  const scaledElements = elements.map(el => ({
    ...el,
    position: {
      x: Math.round(el.position.x * scale),
      y: Math.round(el.position.y * scale),
      w: Math.round(el.position.w * scale),
      h: Math.round(el.position.h * scale),
    },
  }));

  const MARGIN = 60;
  const markers = computeMarkerPositions(displayW, displayH, MARGIN, MARGIN, scaledElements);
  if (markers.length === 0) return;

  // Build anatomy content items JS
  const anatomyItemsJS = elements.slice(0, markers.length).map((el, idx) => {
    const num = idx + 1;
    const vPrefix = `_ai${num}`;
    let attributeLines = "";

    if (el.nodeType === "TEXT") {
      if (el.fontFamily) attributeLines += attrRowJS(`${vPrefix}a1`, `${vPrefix}col`, "Font family", el.fontFamily);
      if (el.fontStyle) attributeLines += attrRowJS(`${vPrefix}a2`, `${vPrefix}col`, "Font weight", el.fontStyle);
      if (el.fontSize) attributeLines += attrRowJS(`${vPrefix}a3`, `${vPrefix}col`, "Font size", String(el.fontSize) + "px");
      if (el.lineHeightPx) attributeLines += attrRowJS(`${vPrefix}a4`, `${vPrefix}col`, "Line height", String(el.lineHeightPx) + "px");
      if (el.tokenName) attributeLines += attrRowJS(`${vPrefix}a5`, `${vPrefix}col`, "Text style", el.tokenName);
      if (el.fills?.[0]) attributeLines += attrRowJS(`${vPrefix}a6`, `${vPrefix}col`, "Fill", el.fills[0]);
    } else if (el.nodeType === "INSTANCE") {
      if (el.componentName) attributeLines += attrRowJS(`${vPrefix}a1`, `${vPrefix}col`, "Depends on", el.componentName);
      if (el.instanceOf && el.instanceOf !== el.componentName) attributeLines += attrRowJS(`${vPrefix}a2`, `${vPrefix}col`, "Variant", el.instanceOf);
      if (el.position?.w) attributeLines += attrRowJS(`${vPrefix}a3`, `${vPrefix}col`, "Size", `${el.position.w}\u00D7${el.position.h}`);
      if (el.variantProperties) {
        const vpEntries = Object.entries(el.variantProperties).slice(0, 3);
        vpEntries.forEach(([k, v], i) => {
          attributeLines += attrRowJS(`${vPrefix}vp${i}`, `${vPrefix}col`, k, v);
        });
      }
      if (el.fills?.[0]) attributeLines += attrRowJS(`${vPrefix}a4`, `${vPrefix}col`, "Fill", el.fills[0]);
    } else if (el.nodeType === "FRAME" || el.nodeType === "COMPONENT") {
      if (el.layoutMode && el.layoutMode !== "NONE") attributeLines += attrRowJS(`${vPrefix}a1`, `${vPrefix}col`, "Direction", el.layoutMode === "HORIZONTAL" ? "Horizontal" : "Vertical");
      if (el.itemSpacing != null && el.itemSpacing > 0) attributeLines += attrRowJS(`${vPrefix}a2`, `${vPrefix}col`, "Item spacing", String(el.itemSpacing) + "px");
      if (el.cornerRadius != null && el.cornerRadius > 0) attributeLines += attrRowJS(`${vPrefix}a3`, `${vPrefix}col`, "Radius", String(el.cornerRadius) + "px");
      if (el.fills?.[0]) attributeLines += attrRowJS(`${vPrefix}a4`, `${vPrefix}col`, "Fill", el.fills[0]);
      if (el.strokes?.[0]) attributeLines += attrRowJS(`${vPrefix}a5`, `${vPrefix}col`, "Stroke", el.strokes[0]);
    } else {
      if (el.fills?.[0]) attributeLines += attrRowJS(`${vPrefix}a1`, `${vPrefix}col`, "Fill", el.fills[0]);
      if (el.strokes?.[0]) attributeLines += attrRowJS(`${vPrefix}a2`, `${vPrefix}col`, "Stroke", el.strokes[0]);
      if (el.cornerRadius != null && el.cornerRadius > 0) attributeLines += attrRowJS(`${vPrefix}a3`, `${vPrefix}col`, "Radius", String(el.cornerRadius) + "px");
    }
    // Size for all non-instance elements
    if (el.nodeType !== "INSTANCE" && el.position?.w > 0) {
      attributeLines += attrRowJS(`${vPrefix}sz`, `${vPrefix}col`, "Size", `${el.position.w}\u00D7${el.position.h}`);
    }

    return `
      // Anatomy item ${num}
      var ${vPrefix}=figma.createFrame();${vPrefix}.name="Item ${num}";
      ${vPrefix}.layoutMode="HORIZONTAL";
      ${vPrefix}.primaryAxisSizingMode="AUTO";${vPrefix}.counterAxisSizingMode="AUTO";
      ${vPrefix}.itemSpacing=8;${vPrefix}.fills=[];${vPrefix}.counterAxisAlignItems="MIN";
      ${vPrefix}.paddingLeft=28;
      anatContent.appendChild(${vPrefix});${vPrefix}.layoutSizingHorizontal="FILL";

      // Orange numbered dot (overlapping left edge)
      var ${vPrefix}dot=figma.createEllipse();${vPrefix}dot.resize(20,20);
      ${vPrefix}dot.fills=[{type:"SOLID",color:${C.markerOrange}}];
      ${vPrefix}dot.name="Dot ${num}";

      var ${vPrefix}dotWrap=figma.createFrame();${vPrefix}dotWrap.name="DotWrap";
      ${vPrefix}dotWrap.layoutMode="NONE";${vPrefix}dotWrap.resize(20,20);${vPrefix}dotWrap.fills=[];
      ${vPrefix}dotWrap.appendChild(${vPrefix}dot);${vPrefix}dot.x=0;${vPrefix}dot.y=0;
      var ${vPrefix}dotNum=figma.createText();${vPrefix}dotNum.fontName=F.b;${vPrefix}dotNum.fontSize=12;
      ${vPrefix}dotNum.characters="${num}";
      ${vPrefix}dotNum.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];
      ${vPrefix}dotNum.textAutoResize="WIDTH_AND_HEIGHT";
      ${vPrefix}dotWrap.appendChild(${vPrefix}dotNum);
      ${vPrefix}dotNum.x=10-${vPrefix}dotNum.width/2;
      ${vPrefix}dotNum.y=10-${vPrefix}dotNum.height/2;
      ${vPrefix}.appendChild(${vPrefix}dotWrap);

      // Element info column
      var ${vPrefix}col=figma.createFrame();${vPrefix}col.name="Info";
      ${vPrefix}col.layoutMode="VERTICAL";
      ${vPrefix}col.primaryAxisSizingMode="AUTO";${vPrefix}col.counterAxisSizingMode="AUTO";
      ${vPrefix}col.itemSpacing=4;${vPrefix}col.fills=[];
      ${vPrefix}.appendChild(${vPrefix}col);${vPrefix}col.layoutSizingHorizontal="FILL";

      // Element row: type icon + name
      var ${vPrefix}elRow=figma.createFrame();${vPrefix}elRow.name="ElRow";
      ${vPrefix}elRow.layoutMode="HORIZONTAL";
      ${vPrefix}elRow.primaryAxisSizingMode="AUTO";${vPrefix}elRow.counterAxisSizingMode="AUTO";
      ${vPrefix}elRow.itemSpacing=6;${vPrefix}elRow.fills=[];${vPrefix}elRow.counterAxisAlignItems="CENTER";
      ${vPrefix}col.appendChild(${vPrefix}elRow);${vPrefix}elRow.layoutSizingHorizontal="FILL";

      ${typeIconJS(`${vPrefix}icon`, `${vPrefix}elRow`, el.nodeType)}

      var ${vPrefix}name=figma.createText();${vPrefix}name.fontName=F.b;${vPrefix}name.fontSize=16;
      ${vPrefix}name.lineHeight={unit:"PIXELS",value:22};
      ${vPrefix}name.characters=${esc(el.name)};
      ${vPrefix}name.fills=[{type:"SOLID",color:${C.textMain}}];
      ${vPrefix}name.textAutoResize="WIDTH_AND_HEIGHT";
      ${vPrefix}elRow.appendChild(${vPrefix}name);

      ${attributeLines}
    `;
  }).join("\n");

  const markersJSON = JSON.stringify(markers);
  const MD = 24; // marker diameter

  const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};
      var sourceNode=await figma.getNodeByIdAsync(${esc(spec.nodeId)});
      if(!sourceNode)return{error:"no source"};

      // Section card
      ${sectionCardOpenJS("anatCard", "m", "Anatomy")}
      ${sectionTitleJS("anatTitle", "anatCard", "Anatomy", sectionNum)}

      // Exhibit: artwork left | content right
      var anatExhibit=figma.createFrame();anatExhibit.name="Anatomy Exhibit";
      anatExhibit.layoutMode="HORIZONTAL";
      anatExhibit.primaryAxisSizingMode="AUTO";anatExhibit.counterAxisSizingMode="AUTO";
      anatExhibit.itemSpacing=${EXHIBIT_GAP};anatExhibit.fills=[];
      anatExhibit.counterAxisAlignItems="MIN";
      anatCard.appendChild(anatExhibit);anatExhibit.layoutSizingHorizontal="FILL";

      // Left: artwork with component clone + markers (absolute positioning)
      var artWrap=figma.createFrame();artWrap.name="Artwork";
      artWrap.layoutMode="NONE";
      artWrap.fills=[{type:"SOLID",color:${C.bgCard}}];artWrap.cornerRadius=8;
      anatExhibit.appendChild(artWrap);

      var src=sourceNode;
      if(src.type==="COMPONENT_SET"&&src.children.length>0)src=src.children[0];
      var clone=src.clone();
      clone.x=${MARGIN};clone.y=${MARGIN};
      ${scale > 1 ? `clone.rescale(${scale});` : ""}
      artWrap.appendChild(clone);
      var artW=clone.width+${MARGIN * 2}+40;
      artWrap.resize(artW,clone.height+${MARGIN * 2});

      var markers=${markersJSON};
      var MD=${MD},MR=${MD / 2};

      for(var i=0;i<markers.length;i++){
        var mk=markers[i];

        // Orange marker dot ON the element
        var dot=figma.createEllipse();dot.resize(MD,MD);
        dot.fills=[{type:"SOLID",color:${C.markerOrange}}];
        dot.x=mk.markerX-MR;dot.y=mk.markerY-MR;dot.name="Marker "+(i+1);
        artWrap.appendChild(dot);

        // Number label centered on dot
        var num=figma.createText();num.fontName=F.b;num.fontSize=11;
        num.characters=String(i+1);
        num.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];
        num.textAutoResize="WIDTH_AND_HEIGHT";
        artWrap.appendChild(num);
        num.x=mk.markerX-num.width/2;num.y=mk.markerY-num.height/2;

        // Dashed leader line from marker to right edge
        var leaderStartX=mk.markerX+MR+2;
        var leaderEndX=artW-8;
        var leaderY=mk.markerY;
        if(leaderEndX>leaderStartX+10){
          var leader=figma.createVector();
          leader.vectorPaths=[{windingRule:"NONZERO",data:"M "+leaderStartX+" "+leaderY+" L "+leaderEndX+" "+leaderY}];
          leader.strokes=[{type:"SOLID",color:${C.markerOrange}}];
          leader.strokeWeight=0.75;leader.fills=[];
          leader.dashPattern=[3,3];leader.opacity=0.5;
          leader.name="Leader "+(i+1);
          artWrap.appendChild(leader);
        }
      }

      // Right: anatomy content
      var anatContent=figma.createFrame();anatContent.name="Anatomy Items";
      anatContent.layoutMode="VERTICAL";
      anatContent.primaryAxisSizingMode="AUTO";anatContent.counterAxisSizingMode="AUTO";
      anatContent.itemSpacing=24;anatContent.fills=[];
      anatExhibit.appendChild(anatContent);anatContent.layoutSizingHorizontal="FILL";

      ${anatomyItemsJS}

      return{ok:true};
    })();
  `);
  if (!r.success) console.error("Anatomy exhibit failed:", r.error);
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 3: PROPERTY SECTIONS WITH GROUPED EXHIBITS
// ══════════════════════════════════════════════════════════════════════════

async function renderVariantsExhibit(
  bridge: Bridge, mId: string, spec: ComponentSpec,
): Promise<void> {
  const snapshot = spec.extraction.snapshot;
  const variantGroupProps = snapshot.variantGroupProperties || {};
  const axisNames = Object.keys(variantGroupProps);
  if (axisNames.length === 0) return;

  const defaultProps = snapshot.variants?.[0]?.properties || {};
  const MAX_PER_AXIS = 6;

  // Create the section card first
  const r0 = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};
      ${sectionCardOpenJS("varCard", "m", "Properties")}
      ${sectionTitleJS("varTitle", "varCard", "Properties")}
      return{ok:true,cardId:varCard.id};
    })();
  `);
  if (!r0.success) { console.error("Variants card failed:", r0.error); return; }
  const cardId = (r0.result as { cardId: string }).cardId;

  // Render each axis as a subsection with exhibits
  for (const axisName of axisNames) {
    const values = variantGroupProps[axisName].slice(0, MAX_PER_AXIS);
    const samples = values.map(val => ({
      label: val,
      props: { ...defaultProps, [axisName]: val },
    }));

    const r = await bridge.execute(`
      (async () => {
        ${FL}
        ${EXTRACT_STYLE_FN}
        var card=await figma.getNodeByIdAsync(${esc(cardId)});
        if(!card)return{error:"no card"};
        var sourceNode=await figma.getNodeByIdAsync(${esc(spec.nodeId)});
        if(!sourceNode)return{error:"no source"};

        // Axis group
        var axGrp=figma.createFrame();axGrp.name=${esc(axisName + " Axis")};
        axGrp.layoutMode="VERTICAL";
        axGrp.primaryAxisSizingMode="AUTO";axGrp.counterAxisSizingMode="AUTO";
        axGrp.itemSpacing=40;axGrp.fills=[];
        card.appendChild(axGrp);axGrp.layoutSizingHorizontal="FILL";

        // Axis title (36px bold)
        ${subsectionTitleJS("axTitle", "axGrp", axisName)}

        var compSet=sourceNode.type==="COMPONENT_SET"?sourceNode:(sourceNode.parent&&sourceNode.parent.type==="COMPONENT_SET"?sourceNode.parent:null);
        if(!compSet)return{ok:true,skip:"not a component set"};

        var samples=${JSON.stringify(samples)};

        for(var si=0;si<samples.length;si++){
          var s=samples[si];

          // Find matching variant
          var target=null;
          for(var ci=0;ci<compSet.children.length;ci++){
            var ch=compSet.children[ci];
            if(!ch.variantProperties)continue;
            var match=true;
            for(var pk in s.props){if(ch.variantProperties[pk]!==s.props[pk]){match=false;break;}}
            if(match){target=ch;break;}
          }
          if(!target&&compSet.children.length>0)target=compSet.children[0];
          if(!target)continue;
          var inst=target.createInstance();
          var style=extractStyle(inst);

          // Exhibit: artwork + content
          var exh=figma.createFrame();exh.name=s.label;
          exh.layoutMode="HORIZONTAL";
          exh.primaryAxisSizingMode="AUTO";exh.counterAxisSizingMode="AUTO";
          exh.itemSpacing=${EXHIBIT_GAP};exh.fills=[];
          exh.counterAxisAlignItems="MIN";
          axGrp.appendChild(exh);exh.layoutSizingHorizontal="FILL";

          // Artwork (350x248 gray)
          var art=figma.createFrame();art.name="Artwork";
          art.layoutMode="HORIZONTAL";
          art.primaryAxisSizingMode="FIXED";art.counterAxisSizingMode="FIXED";
          art.resize(${ARTWORK_W},${ARTWORK_H});
          art.fills=[{type:"SOLID",color:${C.bgCard}}];art.cornerRadius=8;
          art.primaryAxisAlignItems="CENTER";art.counterAxisAlignItems="CENTER";
          art.clipsContent=true;
          exh.appendChild(art);
          art.appendChild(inst);

          // Content metadata
          var cnt=figma.createFrame();cnt.name="Content";
          cnt.layoutMode="VERTICAL";
          cnt.primaryAxisSizingMode="AUTO";cnt.counterAxisSizingMode="AUTO";
          cnt.itemSpacing=12;cnt.fills=[];
          exh.appendChild(cnt);cnt.layoutSizingHorizontal="FILL";

          // Option label (16px bold)
          var optLbl=figma.createText();optLbl.fontName=F.b;optLbl.fontSize=16;
          optLbl.lineHeight={unit:"PIXELS",value:22};
          optLbl.characters=s.label;
          optLbl.fills=[{type:"SOLID",color:${C.textMain}}];
          optLbl.textAutoResize="HEIGHT";
          cnt.appendChild(optLbl);optLbl.layoutSizingHorizontal="FILL";

          // Style attributes
          var attrCol=figma.createFrame();attrCol.name="Attributes";
          attrCol.layoutMode="VERTICAL";
          attrCol.primaryAxisSizingMode="AUTO";attrCol.counterAxisSizingMode="AUTO";
          attrCol.itemSpacing=4;attrCol.fills=[];
          cnt.appendChild(attrCol);attrCol.layoutSizingHorizontal="FILL";

          // EightShapes-style: circle icon + element name, then indented attrs
          function addElement(parent,name){
            var elRow=figma.createFrame();elRow.name=name;
            elRow.layoutMode="HORIZONTAL";
            elRow.primaryAxisSizingMode="AUTO";elRow.counterAxisSizingMode="AUTO";
            elRow.itemSpacing=6;elRow.fills=[];elRow.counterAxisAlignItems="CENTER";
            parent.appendChild(elRow);elRow.layoutSizingHorizontal="FILL";
            var ic=figma.createEllipse();ic.resize(10,10);
            ic.fills=[];ic.strokes=[{type:"SOLID",color:${C.textMuted}}];ic.strokeWeight=1;
            elRow.appendChild(ic);
            var nm=figma.createText();nm.fontName=F.sb;nm.fontSize=12;
            nm.lineHeight={unit:"PIXELS",value:18};nm.characters=name;
            nm.fills=[{type:"SOLID",color:${C.textMain}}];nm.textAutoResize="WIDTH_AND_HEIGHT";
            elRow.appendChild(nm);
          }
          function addAttr(parent,name,value){
            var row=figma.createFrame();row.name=name;
            row.layoutMode="HORIZONTAL";
            row.primaryAxisSizingMode="AUTO";row.counterAxisSizingMode="AUTO";
            row.itemSpacing=4;row.fills=[];row.paddingLeft=16;
            parent.appendChild(row);row.layoutSizingHorizontal="FILL";
            var n=figma.createText();n.fontName=F.r;n.fontSize=11;
            n.lineHeight={unit:"PIXELS",value:16};n.characters=name+":";
            n.fills=[{type:"SOLID",color:${C.textMuted}}];n.textAutoResize="WIDTH_AND_HEIGHT";
            n.resize(80,16);row.appendChild(n);n.layoutSizingHorizontal="FIXED";
            if(value&&value.charAt(0)==="#"&&value.length===7){
              var hex=value.replace("#","");
              var sw=figma.createRectangle();sw.resize(12,12);sw.cornerRadius=2;
              sw.fills=[{type:"SOLID",color:{
                r:parseInt(hex.substring(0,2),16)/255,
                g:parseInt(hex.substring(2,4),16)/255,
                b:parseInt(hex.substring(4,6),16)/255
              }}];sw.strokes=[{type:"SOLID",color:${C.border}}];sw.strokeWeight=0.5;
              row.appendChild(sw);
            }
            var v=figma.createText();v.fontName=F.sb;v.fontSize=11;
            v.lineHeight={unit:"PIXELS",value:16};v.characters=value;
            v.fills=[{type:"SOLID",color:${C.textMain}}];v.textAutoResize="WIDTH_AND_HEIGHT";
            row.appendChild(v);
          }

          // Root element
          addElement(attrCol,inst.name||s.label);
          for(var fi=0;fi<Math.min(style.fills.length,3);fi++){
            addAttr(attrCol,"Fill",style.fills[fi]);
          }
          if(style.radius)addAttr(attrCol,"Radius",style.radius+"px");
          if(style.padding)addAttr(attrCol,"Padding",style.padding);
          addAttr(attrCol,"Size",style.w+" \\u00D7 "+style.h);
          // Child text elements as separate entries
          for(var ti=0;ti<Math.min(style.texts.length,4);ti++){
            var parts=style.texts[ti].split(" ");
            var tName=parts[0]||"Text";
            addElement(attrCol,tName);
            addAttr(attrCol,"Font",style.texts[ti]);
          }
        }

        return{ok:true};
      })();
    `);
    if (!r.success) console.error(`Variants exhibit "${axisName}" failed:`, r.error);
  }

  // Phase 6: Boolean toggles
  const boolToggles = (snapshot.componentProperties || []).filter(cp => cp.type === "BOOLEAN");
  for (const toggle of boolToggles) {
    const cleanName = toggle.name.replace(/#.*$/, "").trim();
    const r = await bridge.execute(`
      (async () => {
        ${FL}
        var card=await figma.getNodeByIdAsync(${esc(cardId)});
        if(!card)return{error:"no card"};
        var sourceNode=await figma.getNodeByIdAsync(${esc(spec.nodeId)});
        if(!sourceNode)return{error:"no source"};

        // Bool group
        var boolGrp=figma.createFrame();boolGrp.name=${esc(cleanName + " (Boolean)")};
        boolGrp.layoutMode="VERTICAL";
        boolGrp.primaryAxisSizingMode="AUTO";boolGrp.counterAxisSizingMode="AUTO";
        boolGrp.itemSpacing=40;boolGrp.fills=[];
        card.appendChild(boolGrp);boolGrp.layoutSizingHorizontal="FILL";

        ${subsectionTitleJS("boolTitle", "boolGrp", cleanName + " (Boolean)")}

        var compSet=sourceNode.type==="COMPONENT_SET"?sourceNode:null;
        if(!compSet||compSet.children.length===0)return{ok:true};
        var base=compSet.children[0];

        var propKey=null;
        if("componentProperties" in compSet&&compSet.componentProperties){
          for(var k in compSet.componentProperties){
            if(k.replace(/#.*$/,"").trim()===${esc(cleanName)}){propKey=k;break;}
          }
        }

        // True/false exhibits side by side
        var boolRow=figma.createFrame();boolRow.name="Toggle Comparison";
        boolRow.layoutMode="HORIZONTAL";
        boolRow.primaryAxisSizingMode="AUTO";boolRow.counterAxisSizingMode="AUTO";
        boolRow.itemSpacing=24;boolRow.fills=[];
        boolGrp.appendChild(boolRow);boolRow.layoutSizingHorizontal="FILL";

        var vals=[{v:true,label:"Visible (true)"},{v:false,label:"Hidden (false)"}];
        for(var vi=0;vi<vals.length;vi++){
          var inst=base.createInstance();
          if(propKey){try{var pp={};pp[propKey]=vals[vi].v;inst.setProperties(pp);}catch(e){}}

          var bCard=figma.createFrame();bCard.name=${esc(cleanName)}+"="+vals[vi].v;
          bCard.layoutMode="VERTICAL";
          bCard.primaryAxisSizingMode="AUTO";bCard.counterAxisSizingMode="AUTO";
          bCard.itemSpacing=16;
          bCard.paddingTop=24;bCard.paddingBottom=24;bCard.paddingLeft=24;bCard.paddingRight=24;
          bCard.fills=[{type:"SOLID",color:${C.bgCard}}];bCard.cornerRadius=8;
          bCard.primaryAxisAlignItems="CENTER";
          boolRow.appendChild(bCard);bCard.layoutSizingHorizontal="FILL";

          bCard.appendChild(inst);

          var bLbl=figma.createText();bLbl.fontName=F.b;bLbl.fontSize=16;
          bLbl.characters=vals[vi].label;
          bLbl.fills=[{type:"SOLID",color:${C.textMain}}];
          bLbl.textAutoResize="WIDTH_AND_HEIGHT";
          bCard.appendChild(bLbl);

          var bSub=figma.createText();bSub.fontName=F.r;bSub.fontSize=12;
          bSub.characters="Boolean layer";
          bSub.fills=[{type:"SOLID",color:${C.textMuted}}];
          bSub.textAutoResize="WIDTH_AND_HEIGHT";
          bCard.appendChild(bSub);
        }

        return{ok:true};
      })();
    `);
    if (!r.success) console.error(`Boolean toggle "${cleanName}" failed:`, r.error);
  }

  // Phase 6: Instance swaps
  const instSwaps = (snapshot.componentProperties || []).filter(cp => cp.type === "INSTANCE_SWAP");
  for (const swap of instSwaps) {
    const cleanName = swap.name.replace(/#.*$/, "").trim();
    const r = await bridge.execute(`
      (async () => {
        ${FL}
        var card=await figma.getNodeByIdAsync(${esc(cardId)});
        if(!card)return{error:"no card"};

        var swapGrp=figma.createFrame();swapGrp.name=${esc(cleanName + " (Instance Swap)")};
        swapGrp.layoutMode="VERTICAL";
        swapGrp.primaryAxisSizingMode="AUTO";swapGrp.counterAxisSizingMode="AUTO";
        swapGrp.itemSpacing=16;swapGrp.fills=[];
        card.appendChild(swapGrp);swapGrp.layoutSizingHorizontal="FILL";

        ${subsectionTitleJS("swapTitle", "swapGrp", cleanName + " (Instance Swap)")}

        // Info card
        var swapInfo=figma.createFrame();swapInfo.name="Swap Info";
        swapInfo.layoutMode="HORIZONTAL";
        swapInfo.primaryAxisSizingMode="AUTO";swapInfo.counterAxisSizingMode="AUTO";
        swapInfo.itemSpacing=${EXHIBIT_GAP};swapInfo.fills=[];
        swapInfo.counterAxisAlignItems="MIN";
        swapGrp.appendChild(swapInfo);swapInfo.layoutSizingHorizontal="FILL";

        var swapArt=figma.createFrame();swapArt.name="Artwork";
        swapArt.layoutMode="HORIZONTAL";
        swapArt.primaryAxisSizingMode="FIXED";swapArt.counterAxisSizingMode="FIXED";
        swapArt.resize(${ARTWORK_W},${ARTWORK_H / 2});
        swapArt.fills=[{type:"SOLID",color:${C.bgCard}}];swapArt.cornerRadius=8;
        swapArt.primaryAxisAlignItems="CENTER";swapArt.counterAxisAlignItems="CENTER";
        swapInfo.appendChild(swapArt);

        // Placeholder text in artwork
        var phTxt=figma.createText();phTxt.fontName=F.r;phTxt.fontSize=14;
        phTxt.characters="Instance Swap: "+${esc(cleanName)};
        phTxt.fills=[{type:"SOLID",color:${C.textMuted}}];
        phTxt.textAutoResize="WIDTH_AND_HEIGHT";
        swapArt.appendChild(phTxt);

        var swapCnt=figma.createFrame();swapCnt.name="Content";
        swapCnt.layoutMode="VERTICAL";
        swapCnt.primaryAxisSizingMode="AUTO";swapCnt.counterAxisSizingMode="AUTO";
        swapCnt.itemSpacing=8;swapCnt.fills=[];
        swapInfo.appendChild(swapCnt);swapCnt.layoutSizingHorizontal="FILL";

        var swapLbl=figma.createText();swapLbl.fontName=F.b;swapLbl.fontSize=20;
        swapLbl.characters=${esc(cleanName)};
        swapLbl.fills=[{type:"SOLID",color:${C.textMain}}];
        swapLbl.textAutoResize="WIDTH_AND_HEIGHT";
        swapCnt.appendChild(swapLbl);

        var swapVal=figma.createText();swapVal.fontName=F.r;swapVal.fontSize=14;
        swapVal.characters="Current: "+${esc(swap.value || "Default")};
        swapVal.fills=[{type:"SOLID",color:${C.textMuted}}];
        swapVal.textAutoResize="WIDTH_AND_HEIGHT";
        swapCnt.appendChild(swapVal);

        var swapType=figma.createText();swapType.fontName=F.r;swapType.fontSize=12;
        swapType.characters="Type: Instance Swap";
        swapType.fills=[{type:"SOLID",color:${C.textMuted}}];
        swapType.textAutoResize="WIDTH_AND_HEIGHT";
        swapCnt.appendChild(swapType);

        return{ok:true};
      })();
    `);
    if (!r.success) console.error(`Instance swap "${cleanName}" failed:`, r.error);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 3b: COMPACT PROPERTY TABLE — Summary table + variant strips
// ══════════════════════════════════════════════════════════════════════════

async function renderPropertyTable(
  bridge: Bridge, mId: string, spec: ComponentSpec, sectionNum?: number,
): Promise<void> {
  const snapshot = spec.extraction.snapshot;
  const variantGroupProps = snapshot.variantGroupProperties || {};
  const axisNames = Object.keys(variantGroupProps);
  const boolToggles = (snapshot.componentProperties || []).filter(cp => cp.type === "BOOLEAN");
  const instSwaps = (snapshot.componentProperties || []).filter(cp => cp.type === "INSTANCE_SWAP");

  if (axisNames.length === 0 && boolToggles.length === 0 && instSwaps.length === 0) return;

  // Build property summary rows
  const propRows: Array<[string, string, string, string]> = [];
  for (const axis of axisNames) {
    const vals = variantGroupProps[axis];
    propRows.push([axis, "Variant", vals[0] || "\u2014", vals.slice(0, 8).join(", ")]);
  }
  for (const b of boolToggles) {
    const name = b.name.replace(/#.*$/, "").trim();
    propRows.push([name, "Boolean", String(b.value), "true, false"]);
  }
  for (const s of instSwaps) {
    const name = s.name.replace(/#.*$/, "").trim();
    propRows.push([name, "Instance Swap", s.value || "Default", "\u2014"]);
  }

  // Build all variant strips + boolean toggles JS to embed in single call
  const defaultProps = snapshot.variants?.[0]?.properties || {};
  const MAX_PER_AXIS = 6;
  const compW = snapshot.width || 200;
  const compH = snapshot.height || 60;
  // 3-column grid: card width = (content area - 2 gaps) / 3
  const GRID_GAP = 16;
  const GRID_COLS = 3;
  const cardInnerW = Math.floor((CONTENT_W - CARD_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);
  const thumbScale = Math.min(2, Math.max(0.8, (cardInnerW - 32) / Math.max(compW, 1)));
  const thumbW = cardInnerW - 32; // artwork width = card width minus padding
  const thumbH = Math.max(48, Math.min(120, Math.round(compH * thumbScale) + 16));

  // Build JS for all axis strips — 3-column card grid with style metadata
  const allAxesJS = axisNames.map((axisName, ai) => {
    const values = variantGroupProps[axisName].slice(0, MAX_PER_AXIS);
    const remaining = variantGroupProps[axisName].length - values.length;
    const samples = values.map(val => ({
      label: val,
      props: { ...defaultProps, [axisName]: val },
    }));
    return `
      // ── Axis: ${axisName} ──
      ${subsectionTitleJS(`axT${ai}`, "propCard", axisName)}
      var grid${ai}=figma.createFrame();grid${ai}.name=${esc(axisName + " Grid")};
      grid${ai}.layoutMode="HORIZONTAL";grid${ai}.layoutWrap="WRAP";
      grid${ai}.primaryAxisSizingMode="AUTO";grid${ai}.counterAxisSizingMode="AUTO";
      grid${ai}.itemSpacing=${GRID_GAP};grid${ai}.counterAxisSpacing=${GRID_GAP};grid${ai}.fills=[];
      propCard.appendChild(grid${ai});grid${ai}.layoutSizingHorizontal="FILL";

      ${EXTRACT_STYLE_FN}

      if(compSet){
        var samples${ai}=${JSON.stringify(samples)};
        for(var si=0;si<samples${ai}.length;si++){
          var s=samples${ai}[si];
          var target=null;
          for(var ci=0;ci<compSet.children.length;ci++){
            var ch=compSet.children[ci];
            if(!ch.variantProperties)continue;
            var match=true;
            for(var pk in s.props){if(ch.variantProperties[pk]!==s.props[pk]){match=false;break;}}
            if(match){target=ch;break;}
          }
          if(!target&&compSet.children.length>0)target=compSet.children[0];
          if(!target)continue;

          // Fixed-width card for 3-column grid
          var card${ai}=figma.createFrame();card${ai}.name=s.label;
          card${ai}.layoutMode="VERTICAL";
          card${ai}.primaryAxisSizingMode="AUTO";card${ai}.counterAxisSizingMode="FIXED";
          card${ai}.resize(${cardInnerW},10);
          card${ai}.itemSpacing=12;
          card${ai}.paddingTop=16;card${ai}.paddingBottom=16;card${ai}.paddingLeft=16;card${ai}.paddingRight=16;
          card${ai}.fills=[{type:"SOLID",color:${C.bgCard}}];card${ai}.cornerRadius=8;
          grid${ai}.appendChild(card${ai});

          // Artwork container — centered
          var art=figma.createFrame();art.name="Artwork";
          art.layoutMode="HORIZONTAL";
          art.primaryAxisSizingMode="FIXED";art.counterAxisSizingMode="FIXED";
          art.resize(${thumbW},${thumbH});
          art.fills=[];art.cornerRadius=4;
          art.primaryAxisAlignItems="CENTER";art.counterAxisAlignItems="CENTER";
          art.clipsContent=true;
          card${ai}.appendChild(art);art.layoutSizingHorizontal="FILL";
          var inst=target.createInstance();
          art.appendChild(inst);

          // Bold label
          var lbl=figma.createText();lbl.fontName=F.b;lbl.fontSize=14;
          lbl.lineHeight={unit:"PIXELS",value:20};lbl.characters=s.label;
          lbl.fills=[{type:"SOLID",color:${C.textMain}}];
          lbl.textAutoResize="HEIGHT";
          card${ai}.appendChild(lbl);lbl.layoutSizingHorizontal="FILL";

          // Style metadata from instance
          var sInfo=extractStyle(inst);
          var metaParts=[];
          if(sInfo.fills.length>0)metaParts.push("Fill: "+sInfo.fills[0]);
          if(sInfo.radius)metaParts.push("Radius: "+sInfo.radius+"px");
          if(sInfo.padding)metaParts.push("Padding: "+sInfo.padding);
          if(sInfo.w&&sInfo.h)metaParts.push(sInfo.w+"\\u00D7"+sInfo.h);
          if(sInfo.texts.length>0)metaParts.push(sInfo.texts[0]);
          var metaStr=metaParts.slice(0,3).join("  \\u00B7  ");
          if(metaStr){
            var meta=figma.createText();meta.fontName=F.mono;meta.fontSize=11;
            meta.lineHeight={unit:"PIXELS",value:16};meta.characters=metaStr;
            meta.fills=[{type:"SOLID",color:${C.textMuted}}];
            meta.textAutoResize="HEIGHT";
            card${ai}.appendChild(meta);meta.layoutSizingHorizontal="FILL";
          }
        }
        ${remaining > 0 ? `
        // "and N more" label
        var moreLabel${ai}=figma.createText();moreLabel${ai}.fontName=F.r;moreLabel${ai}.fontSize=13;
        moreLabel${ai}.lineHeight={unit:"PIXELS",value:20};
        moreLabel${ai}.characters="and ${remaining} more value${remaining > 1 ? "s" : ""}\\u2026";
        moreLabel${ai}.fills=[{type:"SOLID",color:${C.textMuted}}];
        moreLabel${ai}.textAutoResize="WIDTH_AND_HEIGHT";
        propCard.appendChild(moreLabel${ai});
        ` : ""}
      }`;
  }).join("\n");

  // Build JS for boolean toggles
  const allBoolsJS = boolToggles.map((toggle, bi) => {
    const cleanName = toggle.name.replace(/#.*$/, "").trim();
    return `
      // ── Boolean: ${cleanName} ──
      ${subsectionTitleJS(`boolT${bi}`, "propCard", cleanName + " (Boolean)")}
      if(compSet&&compSet.children.length>0){
        var base${bi}=compSet.children[0];
        var propKey${bi}=null;
        if("componentProperties" in compSet&&compSet.componentProperties){
          for(var k in compSet.componentProperties){
            if(k.replace(/#.*$/,"").trim()===${esc(cleanName)}){propKey${bi}=k;break;}
          }
        }
        var boolRow${bi}=figma.createFrame();boolRow${bi}.name="Toggle Comparison";
        boolRow${bi}.layoutMode="HORIZONTAL";
        boolRow${bi}.primaryAxisSizingMode="AUTO";boolRow${bi}.counterAxisSizingMode="AUTO";
        boolRow${bi}.itemSpacing=16;boolRow${bi}.fills=[];
        propCard.appendChild(boolRow${bi});boolRow${bi}.layoutSizingHorizontal="FILL";
        var bvals${bi}=[{v:true,label:"true"},{v:false,label:"false"}];
        for(var vi=0;vi<bvals${bi}.length;vi++){
          var binst=base${bi}.createInstance();
          if(propKey${bi}){try{var pp={};pp[propKey${bi}]=bvals${bi}[vi].v;binst.setProperties(pp);}catch(e){}}
          var bc=figma.createFrame();bc.name=${esc(cleanName)}+"="+bvals${bi}[vi].v;
          bc.layoutMode="VERTICAL";
          bc.primaryAxisSizingMode="AUTO";bc.counterAxisSizingMode="AUTO";
          bc.itemSpacing=8;
          bc.paddingTop=16;bc.paddingBottom=16;bc.paddingLeft=16;bc.paddingRight=16;
          bc.fills=[{type:"SOLID",color:${C.bgCard}}];bc.cornerRadius=8;
          bc.primaryAxisAlignItems="CENTER";
          boolRow${bi}.appendChild(bc);bc.layoutSizingHorizontal="FILL";
          bc.appendChild(binst);
          var blbl=figma.createText();blbl.fontName=F.sb;blbl.fontSize=12;
          blbl.characters=bvals${bi}[vi].label;
          blbl.fills=[{type:"SOLID",color:${C.textMain}}];
          blbl.textAutoResize="WIDTH_AND_HEIGHT";
          bc.appendChild(blbl);
        }
      }`;
  }).join("\n");

  // Single consolidated call: table + all strips + all booleans
  const propRowsJSON = JSON.stringify(propRows);
  const r0 = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};
      var sourceNode=await figma.getNodeByIdAsync(${esc(spec.nodeId)});
      if(!sourceNode)return{error:"no source"};

      ${sectionCardOpenJS("propCard", "m", "Properties")}
      ${sectionTitleJS("propTitle", "propCard", "Properties", sectionNum)}

      // ── Property summary table ──
      var headers=["Property","Type","Default","Options"];
      var rows=${propRowsJSON};
      var colWidths=[180,120,140,0];

      var tbl=figma.createFrame();tbl.name="Property Table";
      tbl.layoutMode="VERTICAL";
      tbl.primaryAxisSizingMode="AUTO";tbl.counterAxisSizingMode="AUTO";
      tbl.itemSpacing=0;tbl.fills=[{type:"SOLID",color:${C.white}}];
      tbl.cornerRadius=8;
      tbl.strokes=[{type:"SOLID",color:${C.border}}];tbl.strokeWeight=1;tbl.strokeAlign="INSIDE";
      tbl.clipsContent=true;
      propCard.appendChild(tbl);tbl.layoutSizingHorizontal="FILL";

      var hdr=figma.createFrame();hdr.name="Header";
      hdr.layoutMode="HORIZONTAL";
      hdr.primaryAxisSizingMode="AUTO";hdr.counterAxisSizingMode="AUTO";
      hdr.itemSpacing=0;hdr.paddingTop=12;hdr.paddingBottom=12;
      hdr.paddingLeft=20;hdr.paddingRight=20;
      hdr.fills=[{type:"SOLID",color:${C.bgCard}}];hdr.counterAxisAlignItems="CENTER";
      hdr.strokes=[{type:"SOLID",color:${C.border}}];hdr.strokeWeight=1;
      hdr.strokeTopWeight=0;hdr.strokeRightWeight=0;hdr.strokeBottomWeight=1;hdr.strokeLeftWeight=0;
      hdr.strokeAlign="INSIDE";
      tbl.appendChild(hdr);hdr.layoutSizingHorizontal="FILL";

      for(var hi=0;hi<headers.length;hi++){
        var ht=figma.createText();ht.fontName=F.sb;ht.fontSize=13;
        ht.lineHeight={unit:"PIXELS",value:20};ht.characters=headers[hi];
        ht.fills=[{type:"SOLID",color:${C.textMain}}];ht.textAutoResize="HEIGHT";
        hdr.appendChild(ht);
        if(colWidths[hi]>0){ht.resize(colWidths[hi],20);ht.layoutSizingHorizontal="FIXED";}
        else{ht.layoutSizingHorizontal="FILL";}
      }

      for(var ri=0;ri<rows.length;ri++){
        var row=figma.createFrame();row.name=rows[ri][0];
        row.layoutMode="HORIZONTAL";
        row.primaryAxisSizingMode="AUTO";row.counterAxisSizingMode="AUTO";
        row.itemSpacing=0;row.paddingTop=10;row.paddingBottom=10;
        row.paddingLeft=20;row.paddingRight=20;
        row.fills=[{type:"SOLID",color:ri%2===0?${C.white}:${C.bgCard}}];
        row.counterAxisAlignItems="CENTER";
        if(ri<rows.length-1){
          row.strokes=[{type:"SOLID",color:${C.border}}];row.strokeWeight=1;
          row.strokeTopWeight=0;row.strokeRightWeight=0;row.strokeBottomWeight=1;row.strokeLeftWeight=0;
          row.strokeAlign="INSIDE";
        }
        tbl.appendChild(row);row.layoutSizingHorizontal="FILL";
        for(var ci=0;ci<4;ci++){
          var ct=figma.createText();
          ct.fontName=ci===3?F.mono:(ci===0?F.sb:F.r);
          ct.fontSize=ci===3?11:13;
          ct.lineHeight={unit:"PIXELS",value:ci===3?16:20};
          ct.characters=rows[ri][ci]||"\\u2014";
          ct.fills=[{type:"SOLID",color:ci===0?${C.textMain}:${C.textMuted}}];
          ct.textAutoResize="HEIGHT";
          row.appendChild(ct);
          if(colWidths[ci]>0){ct.resize(colWidths[ci],20);ct.layoutSizingHorizontal="FIXED";}
          else{ct.layoutSizingHorizontal="FILL";}
        }
      }

      // ── Variant strips + booleans ──
      var compSet=sourceNode.type==="COMPONENT_SET"?sourceNode:(sourceNode.parent&&sourceNode.parent.type==="COMPONENT_SET"?sourceNode.parent:null);

      ${allAxesJS}
      ${allBoolsJS}

      return{ok:true};
    })();
  `);
  if (!r0.success) console.error("Property table failed:", r0.error);
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 4b: SIZING COMPARISON — Side-by-side size variants with dimensions
// ══════════════════════════════════════════════════════════════════════════

async function renderSizingComparison(
  bridge: Bridge, mId: string, spec: ComponentSpec, sectionNum?: number,
): Promise<void> {
  const snapshot = spec.extraction.snapshot;
  const variantGroupProps = snapshot.variantGroupProperties || {};
  // Find a "Size" axis
  const sizeAxis = Object.keys(variantGroupProps).find(k => /^size$/i.test(k));
  if (!sizeAxis) return;

  const sizeValues = variantGroupProps[sizeAxis];
  if (sizeValues.length < 2) return;

  const defaultProps = snapshot.variants?.[0]?.properties || {};
  const spacing = spec.extraction.spacing;
  const root = spacing.length > 0 ? spacing[0] : null;
  const LINE_W = 1.5;

  // Build samples for each size value
  const samples = sizeValues.slice(0, 5).map(val => ({
    label: val,
    props: { ...defaultProps, [sizeAxis]: val },
  }));
  const samplesJSON = JSON.stringify(samples);

  const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};
      var sourceNode=await figma.getNodeByIdAsync(${esc(spec.nodeId)});
      if(!sourceNode)return{error:"no source"};

      ${sectionCardOpenJS("szCard", "m", "Spacing & Dimensions")}
      ${sectionTitleJS("szTitle", "szCard", "Spacing & Dimensions", sectionNum)}

      var compSet=sourceNode.type==="COMPONENT_SET"?sourceNode:(sourceNode.parent&&sourceNode.parent.type==="COMPONENT_SET"?sourceNode.parent:null);
      if(!compSet)return{ok:true};

      // Horizontal row of size variants, bottom-aligned
      var szRow=figma.createFrame();szRow.name="Size Comparison";
      szRow.layoutMode="HORIZONTAL";
      szRow.primaryAxisSizingMode="AUTO";szRow.counterAxisSizingMode="AUTO";
      szRow.itemSpacing=32;szRow.fills=[];
      szRow.counterAxisAlignItems="MAX";
      szCard.appendChild(szRow);szRow.layoutSizingHorizontal="FILL";

      var samples=${samplesJSON};
      var sizeColor=${C.sizeBlue};
      var padColor=${C.padGreen};

      ${EXTRACT_STYLE_FN}

      for(var si=0;si<samples.length;si++){
        var s=samples[si];
        var target=null;
        for(var ci=0;ci<compSet.children.length;ci++){
          var ch=compSet.children[ci];
          if(!ch.variantProperties)continue;
          var match=true;
          for(var pk in s.props){if(ch.variantProperties[pk]!==s.props[pk]){match=false;break;}}
          if(match){target=ch;break;}
        }
        if(!target)continue;

        // Column for this size variant
        var col=figma.createFrame();col.name=s.label;
        col.layoutMode="VERTICAL";
        col.primaryAxisSizingMode="AUTO";col.counterAxisSizingMode="AUTO";
        col.itemSpacing=0;col.fills=[];
        col.primaryAxisAlignItems="CENTER";
        szRow.appendChild(col);col.layoutSizingHorizontal="FILL";

        // Size label header
        var szLbl=figma.createText();szLbl.fontName=F.b;szLbl.fontSize=14;
        szLbl.lineHeight={unit:"PIXELS",value:20};
        szLbl.characters=s.label;
        szLbl.fills=[{type:"SOLID",color:${C.textMain}}];
        szLbl.textAutoResize="WIDTH_AND_HEIGHT";
        col.appendChild(szLbl);

        // Spacer
        var sp1=figma.createFrame();sp1.resize(4,16);sp1.fills=[];
        col.appendChild(sp1);sp1.layoutSizingHorizontal="FILL";

        // Canvas with component + dimension annotations
        var inst=target.createInstance();
        var iW=inst.width,iH=inst.height;
        var margin=40;

        var canvas=figma.createFrame();canvas.name=s.label+" Canvas";
        canvas.layoutMode="NONE";
        canvas.fills=[{type:"SOLID",color:${C.bgCard}}];canvas.cornerRadius=8;
        canvas.resize(iW+margin*2,iH+margin*2);
        col.appendChild(canvas);

        inst.x=margin;inst.y=margin;
        canvas.appendChild(inst);

        // Blue outline
        var outline=figma.createRectangle();
        outline.resize(iW,iH);outline.x=margin;outline.y=margin;outline.fills=[];
        outline.strokes=[{type:"SOLID",color:sizeColor}];outline.strokeWeight=1;outline.strokeAlign="OUTSIDE";
        canvas.appendChild(outline);

        // Width dimension line (above)
        function dimLine(parent,x1,y1,x2,y2,label,color){
          var isH=Math.abs(y2-y1)<Math.abs(x2-x1);
          var line=figma.createVector();
          line.vectorPaths=[{windingRule:"NONZERO",data:"M "+x1+" "+y1+" L "+x2+" "+y2}];
          line.strokes=[{type:"SOLID",color:color}];line.strokeWeight=${LINE_W};line.fills=[];
          line.strokeCap="ROUND";parent.appendChild(line);
          var cap=4;
          if(isH){
            var c1=figma.createVector();c1.vectorPaths=[{windingRule:"NONZERO",data:"M "+x1+" "+(y1-cap)+" L "+x1+" "+(y1+cap)}];
            c1.strokes=[{type:"SOLID",color:color}];c1.strokeWeight=${LINE_W};c1.fills=[];parent.appendChild(c1);
            var c2=figma.createVector();c2.vectorPaths=[{windingRule:"NONZERO",data:"M "+x2+" "+(y2-cap)+" L "+x2+" "+(y2+cap)}];
            c2.strokes=[{type:"SOLID",color:color}];c2.strokeWeight=${LINE_W};c2.fills=[];parent.appendChild(c2);
          }else{
            var c1=figma.createVector();c1.vectorPaths=[{windingRule:"NONZERO",data:"M "+(x1-cap)+" "+y1+" L "+(x1+cap)+" "+y1}];
            c1.strokes=[{type:"SOLID",color:color}];c1.strokeWeight=${LINE_W};c1.fills=[];parent.appendChild(c1);
            var c2=figma.createVector();c2.vectorPaths=[{windingRule:"NONZERO",data:"M "+(x2-cap)+" "+y2+" L "+(x2+cap)+" "+y2}];
            c2.strokes=[{type:"SOLID",color:color}];c2.strokeWeight=${LINE_W};c2.fills=[];parent.appendChild(c2);
          }
          var lbl=figma.createText();lbl.fontName=F.mono;lbl.fontSize=10;
          lbl.characters=label;lbl.fills=[{type:"SOLID",color:color}];
          lbl.textAutoResize="WIDTH_AND_HEIGHT";parent.appendChild(lbl);
          var mx=(x1+x2)/2,my=(y1+y2)/2;
          if(isH){lbl.x=mx-lbl.width/2;lbl.y=my-lbl.height-4;}
          else{lbl.x=mx+4;lbl.y=my-lbl.height/2;}
        }

        dimLine(canvas,margin,margin-14,margin+iW,margin-14,Math.round(iW)+"px",sizeColor);
        dimLine(canvas,margin-14,margin,margin-14,margin+iH,Math.round(iH)+"px",sizeColor);

        // Spacer before metadata
        var sp2=figma.createFrame();sp2.resize(4,12);sp2.fills=[];
        col.appendChild(sp2);sp2.layoutSizingHorizontal="FILL";

        // Extract and show key dimensions
        var info=extractStyle(inst);
        var dimParts=[];
        dimParts.push("Height: "+Math.round(iH)+"px");
        dimParts.push("Width: "+Math.round(iW)+"px");
        if(info.padding)dimParts.push("Padding: "+info.padding);
        if(info.radius)dimParts.push("Radius: "+info.radius+"px");

        for(var di=0;di<dimParts.length;di++){
          var dTxt=figma.createText();dTxt.fontName=F.mono;dTxt.fontSize=11;
          dTxt.lineHeight={unit:"PIXELS",value:18};
          dTxt.characters=dimParts[di];
          dTxt.fills=[{type:"SOLID",color:${C.textMuted}}];
          dTxt.textAutoResize="HEIGHT";
          col.appendChild(dTxt);dTxt.layoutSizingHorizontal="FILL";
        }
      }

      return{ok:true};
    })();
  `);
  if (!r.success) console.error("Sizing comparison failed:", r.error);
}

// ══════════════════════════════════════════════════════════════════════════
//  PHASE 5: SPACING EXHIBIT — Green/orange/blue overlays + content panel
// ══════════════════════════════════════════════════════════════════════════

async function renderSpacingExhibit(
  bridge: Bridge, mId: string, spec: ComponentSpec, sectionNum?: number,
): Promise<void> {
  const spacing = spec.extraction.spacing;
  if (spacing.length === 0) return;

  const root = spacing[0];
  const childrenData = JSON.stringify(root.children || []);
  const LINE_W = 1.5;

  const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};
      var sourceNode=await figma.getNodeByIdAsync(${esc(spec.nodeId)});
      if(!sourceNode)return{error:"no source"};

      // Section card
      ${sectionCardOpenJS("spcCard", "m", "Layout & Spacing")}
      ${sectionTitleJS("spcTitle", "spcCard", "Layout & Spacing", sectionNum)}

      // Exhibit: artwork left | content right
      var spcExh=figma.createFrame();spcExh.name="Spacing Exhibit";
      spcExh.layoutMode="HORIZONTAL";
      spcExh.primaryAxisSizingMode="AUTO";spcExh.counterAxisSizingMode="AUTO";
      spcExh.itemSpacing=${EXHIBIT_GAP};spcExh.fills=[];
      spcExh.counterAxisAlignItems="MIN";
      spcCard.appendChild(spcExh);spcExh.layoutSizingHorizontal="FILL";

      // ── Left: Artwork with overlays (absolute positioning) ──
      var src=sourceNode;
      if(src.type==="COMPONENT_SET"&&src.children.length>0)src=src.children[0];
      var compClone=src.clone();
      var cW=compClone.width,cH=compClone.height;
      var AM=80;

      var canvas=figma.createFrame();canvas.name="Spacing Artwork";
      canvas.layoutMode="NONE";
      canvas.fills=[{type:"SOLID",color:${C.bgCard}}];canvas.cornerRadius=8;
      canvas.resize(Math.max(cW+AM*2,500),cH+AM*2);
      spcExh.appendChild(canvas);

      compClone.x=AM;compClone.y=AM;
      canvas.appendChild(compClone);

      // Blue outline around component
      var blueOutline=figma.createRectangle();
      blueOutline.resize(cW,cH);blueOutline.x=AM;blueOutline.y=AM;
      blueOutline.fills=[];
      blueOutline.strokes=[{type:"SOLID",color:${C.sizeBlue}}];
      blueOutline.strokeWeight=1;blueOutline.strokeAlign="OUTSIDE";
      canvas.appendChild(blueOutline);

      var padColor=${C.padGreen};
      var gapColor=${C.gapOrange};
      var sizeColor=${C.sizeBlue};
      var pt=${root.paddingTop},pr=${root.paddingRight},pb=${root.paddingBottom},pl=${root.paddingLeft};
      var compX=AM,compY=AM;

      // ── Green padding: L-shaped corner brackets ──
      function drawBracket(parent,x,y,orient,armLen,color){
        var hPath,vPath;
        if(orient==="TL"){hPath="M "+x+" "+y+" L "+(x+armLen)+" "+y;vPath="M "+x+" "+y+" L "+x+" "+(y+armLen);}
        else if(orient==="TR"){hPath="M "+x+" "+y+" L "+(x-armLen)+" "+y;vPath="M "+x+" "+y+" L "+x+" "+(y+armLen);}
        else if(orient==="BL"){hPath="M "+x+" "+y+" L "+(x+armLen)+" "+y;vPath="M "+x+" "+y+" L "+x+" "+(y-armLen);}
        else{hPath="M "+x+" "+y+" L "+(x-armLen)+" "+y;vPath="M "+x+" "+y+" L "+x+" "+(y-armLen);}
        var h=figma.createVector();h.vectorPaths=[{windingRule:"NONZERO",data:hPath}];
        h.strokes=[{type:"SOLID",color:color}];h.strokeWeight=1.5;h.fills=[];h.strokeCap="ROUND";parent.appendChild(h);
        var v=figma.createVector();v.vectorPaths=[{windingRule:"NONZERO",data:vPath}];
        v.strokes=[{type:"SOLID",color:color}];v.strokeWeight=1.5;v.fills=[];v.strokeCap="ROUND";parent.appendChild(v);
      }
      var bArm=Math.min(12,cW/6,cH/6);
      if(pt>0){
        drawBracket(canvas,compX,compY+pt,"TL",bArm,padColor);
        drawBracket(canvas,compX+cW,compY+pt,"TR",bArm,padColor);
      }
      if(pb>0){
        drawBracket(canvas,compX,compY+cH-pb,"BL",bArm,padColor);
        drawBracket(canvas,compX+cW,compY+cH-pb,"BR",bArm,padColor);
      }
      if(pl>0){
        drawBracket(canvas,compX+pl,compY,"TL",bArm,padColor);
        drawBracket(canvas,compX+pl,compY+cH,"BL",bArm,padColor);
      }
      if(pr>0){
        drawBracket(canvas,compX+cW-pr,compY,"TR",bArm,padColor);
        drawBracket(canvas,compX+cW-pr,compY+cH,"BR",bArm,padColor);
      }

      // Green padding pills with px suffix
      function padPill(x,y,value){
        var pill=figma.createFrame();pill.name="PadPill";
        pill.layoutMode="HORIZONTAL";
        pill.primaryAxisSizingMode="AUTO";pill.counterAxisSizingMode="AUTO";
        pill.paddingTop=2;pill.paddingBottom=2;pill.paddingLeft=4;pill.paddingRight=4;
        pill.fills=[{type:"SOLID",color:padColor}];pill.cornerRadius=4;
        canvas.appendChild(pill);pill.x=x;pill.y=y;
        var pTxt=figma.createText();pTxt.fontName=F.r;pTxt.fontSize=11;
        pTxt.characters=value+"px";
        pTxt.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];
        pTxt.textAutoResize="WIDTH_AND_HEIGHT";
        pill.appendChild(pTxt);
      }
      if(pt>0)padPill(compX+cW/2-12,compY+2,pt);
      if(pb>0)padPill(compX+cW/2-12,compY+cH-16,pb);
      if(pl>0)padPill(compX-28,compY+cH/2-8,pl);
      if(pr>0)padPill(compX+cW+4,compY+cH/2-8,pr);

      // ── Orange gap dashed lines + pills between children ──
      var children=${childrenData};
      var layoutMode="${root.layoutMode}";
      var itemSpacing=${root.itemSpacing};
      if(children.length>1&&itemSpacing>0){
        for(var ci=0;ci<children.length-1;ci++){
          var c1=children[ci],c2=children[ci+1];
          if(layoutMode==="HORIZONTAL"){
            var gapX1=compX+c1.x+c1.w;
            var gapX2=compX+c2.x;
            var gapW=gapX2-gapX1;
            if(gapW>0){
              // Dashed line spanning the gap
              var gLine=figma.createVector();
              gLine.vectorPaths=[{windingRule:"NONZERO",data:"M "+gapX1+" "+(compY+cH/2)+" L "+gapX2+" "+(compY+cH/2)}];
              gLine.strokes=[{type:"SOLID",color:gapColor}];gLine.strokeWeight=1;gLine.fills=[];
              gLine.dashPattern=[4,4];canvas.appendChild(gLine);
              // Gap pill centered above
              var gPill=figma.createFrame();gPill.name="GapPill";
              gPill.layoutMode="HORIZONTAL";
              gPill.primaryAxisSizingMode="AUTO";gPill.counterAxisSizingMode="AUTO";
              gPill.paddingTop=2;gPill.paddingBottom=2;gPill.paddingLeft=4;gPill.paddingRight=4;
              gPill.fills=[{type:"SOLID",color:gapColor}];gPill.cornerRadius=4;
              canvas.appendChild(gPill);gPill.x=gapX1+gapW/2-12;gPill.y=compY+cH/2-18;
              var gTxt=figma.createText();gTxt.fontName=F.r;gTxt.fontSize=11;
              gTxt.characters=String(itemSpacing)+"px";
              gTxt.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];
              gTxt.textAutoResize="WIDTH_AND_HEIGHT";
              gPill.appendChild(gTxt);
            }
          }else{
            var gapY1=compY+c1.y+c1.h;
            var gapY2=compY+c2.y;
            var gapH=gapY2-gapY1;
            if(gapH>0){
              var gLine=figma.createVector();
              gLine.vectorPaths=[{windingRule:"NONZERO",data:"M "+(compX+cW/2)+" "+gapY1+" L "+(compX+cW/2)+" "+gapY2}];
              gLine.strokes=[{type:"SOLID",color:gapColor}];gLine.strokeWeight=1;gLine.fills=[];
              gLine.dashPattern=[4,4];canvas.appendChild(gLine);
              var gPill=figma.createFrame();gPill.name="GapPill";
              gPill.layoutMode="HORIZONTAL";
              gPill.primaryAxisSizingMode="AUTO";gPill.counterAxisSizingMode="AUTO";
              gPill.paddingTop=2;gPill.paddingBottom=2;gPill.paddingLeft=4;gPill.paddingRight=4;
              gPill.fills=[{type:"SOLID",color:gapColor}];gPill.cornerRadius=4;
              canvas.appendChild(gPill);gPill.x=compX+cW+8;gPill.y=gapY1+gapH/2-8;
              var gTxt=figma.createText();gTxt.fontName=F.r;gTxt.fontSize=11;
              gTxt.characters=String(itemSpacing)+"px";
              gTxt.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];
              gTxt.textAutoResize="WIDTH_AND_HEIGHT";
              gPill.appendChild(gTxt);
            }
          }
        }
      }

      // ── Blue child element overlays (subtle) ──
      for(var chi=0;chi<children.length;chi++){
        var ch=children[chi];
        var chRect=figma.createRectangle();
        chRect.resize(ch.w,ch.h);chRect.x=compX+ch.x;chRect.y=compY+ch.y;
        chRect.fills=[{type:"SOLID",color:sizeColor}];chRect.opacity=0.08;
        canvas.appendChild(chRect);
      }

      // ── Blue dimension lines (width above, height left) ──
      function drawDimLine(parent,x1,y1,x2,y2,label,color){
        var isH=Math.abs(y2-y1)<Math.abs(x2-x1);
        var line=figma.createVector();
        line.vectorPaths=[{windingRule:"NONZERO",data:"M "+x1+" "+y1+" L "+x2+" "+y2}];
        line.strokes=[{type:"SOLID",color:color}];
        line.strokeWeight=${LINE_W};line.fills=[];line.strokeCap="ROUND";
        parent.appendChild(line);
        var capLen=4;
        if(isH){
          var c1=figma.createVector();
          c1.vectorPaths=[{windingRule:"NONZERO",data:"M "+x1+" "+(y1-capLen)+" L "+x1+" "+(y1+capLen)}];
          c1.strokes=[{type:"SOLID",color:color}];c1.strokeWeight=${LINE_W};c1.fills=[];parent.appendChild(c1);
          var c2=figma.createVector();
          c2.vectorPaths=[{windingRule:"NONZERO",data:"M "+x2+" "+(y2-capLen)+" L "+x2+" "+(y2+capLen)}];
          c2.strokes=[{type:"SOLID",color:color}];c2.strokeWeight=${LINE_W};c2.fills=[];parent.appendChild(c2);
        }else{
          var c1=figma.createVector();
          c1.vectorPaths=[{windingRule:"NONZERO",data:"M "+(x1-capLen)+" "+y1+" L "+(x1+capLen)+" "+y1}];
          c1.strokes=[{type:"SOLID",color:color}];c1.strokeWeight=${LINE_W};c1.fills=[];parent.appendChild(c1);
          var c2=figma.createVector();
          c2.vectorPaths=[{windingRule:"NONZERO",data:"M "+(x2-capLen)+" "+y2+" L "+(x2+capLen)+" "+y2}];
          c2.strokes=[{type:"SOLID",color:color}];c2.strokeWeight=${LINE_W};c2.fills=[];parent.appendChild(c2);
        }
        var lbl=figma.createText();lbl.fontName=F.mono;lbl.fontSize=10;
        lbl.characters=label;lbl.fills=[{type:"SOLID",color:color}];
        lbl.textAutoResize="WIDTH_AND_HEIGHT";parent.appendChild(lbl);
        var mx=(x1+x2)/2,my=(y1+y2)/2;
        if(isH){lbl.x=mx-lbl.width/2;lbl.y=my-lbl.height-4;}
        else{lbl.x=mx+4;lbl.y=my-lbl.height/2;}
      }

      // Width dimension (above component)
      drawDimLine(canvas,compX,compY-20,compX+cW,compY-20,Math.round(cW)+"px",sizeColor);
      // Height dimension (left of component)
      drawDimLine(canvas,compX-20,compY,compX-20,compY+cH,Math.round(cH)+"px",sizeColor);

      // Resize canvas to fit
      canvas.resize(Math.max(cW+AM*2,500),cH+AM*2);

      // ── Right: Content panel ──
      var spcCnt=figma.createFrame();spcCnt.name="Spacing Details";
      spcCnt.layoutMode="VERTICAL";
      spcCnt.primaryAxisSizingMode="AUTO";spcCnt.counterAxisSizingMode="AUTO";
      spcCnt.itemSpacing=12;spcCnt.fills=[];
      spcExh.appendChild(spcCnt);spcCnt.layoutSizingHorizontal="FILL";

      // Element header with type icon
      var spcElRow=figma.createFrame();spcElRow.name="ElementHeader";
      spcElRow.layoutMode="HORIZONTAL";
      spcElRow.primaryAxisSizingMode="AUTO";spcElRow.counterAxisSizingMode="AUTO";
      spcElRow.itemSpacing=6;spcElRow.fills=[];spcElRow.counterAxisAlignItems="CENTER";
      spcCnt.appendChild(spcElRow);spcElRow.layoutSizingHorizontal="FILL";

      // Type icon (diamond for component)
      var spcIcon=figma.createFrame();spcIcon.name="TypeIcon";
      spcIcon.layoutMode="HORIZONTAL";
      spcIcon.primaryAxisSizingMode="FIXED";spcIcon.counterAxisSizingMode="FIXED";
      spcIcon.resize(20,20);spcIcon.fills=[];
      spcIcon.strokes=[{type:"SOLID",color:${C.textMuted}}];
      spcIcon.strokeWeight=1;spcIcon.strokeAlign="INSIDE";spcIcon.cornerRadius=3;
      spcIcon.primaryAxisAlignItems="CENTER";spcIcon.counterAxisAlignItems="CENTER";
      spcElRow.appendChild(spcIcon);
      var spcIconLbl=figma.createText();spcIconLbl.fontName=F.r;spcIconLbl.fontSize=10;
      spcIconLbl.characters="\\u25C7";
      spcIconLbl.fills=[{type:"SOLID",color:${C.textMuted}}];
      spcIconLbl.textAutoResize="WIDTH_AND_HEIGHT";
      spcIcon.appendChild(spcIconLbl);

      // Element name
      var spcName=figma.createText();spcName.fontName=F.b;spcName.fontSize=20;
      spcName.lineHeight={unit:"PIXELS",value:28};
      spcName.characters=${esc(root.element)};
      spcName.fills=[{type:"SOLID",color:${C.textMain}}];
      spcName.textAutoResize="WIDTH_AND_HEIGHT";
      spcElRow.appendChild(spcName);

      // Attributes — two-column layout (muted label + semibold value)
      function spcAttr(parent,label,value){
        var row=figma.createFrame();row.name=label;
        row.layoutMode="HORIZONTAL";
        row.primaryAxisSizingMode="AUTO";row.counterAxisSizingMode="AUTO";
        row.itemSpacing=8;row.fills=[];
        parent.appendChild(row);row.layoutSizingHorizontal="FILL";
        var lTxt=figma.createText();lTxt.fontName=F.r;lTxt.fontSize=12;
        lTxt.lineHeight={unit:"PIXELS",value:18};lTxt.characters=label;
        lTxt.fills=[{type:"SOLID",color:${C.textMuted}}];lTxt.textAutoResize="HEIGHT";
        lTxt.resize(140,18);row.appendChild(lTxt);lTxt.layoutSizingHorizontal="FIXED";
        var vTxt=figma.createText();vTxt.fontName=F.sb;vTxt.fontSize=12;
        vTxt.lineHeight={unit:"PIXELS",value:18};vTxt.characters=String(value);
        vTxt.fills=[{type:"SOLID",color:${C.textMain}}];vTxt.textAutoResize="HEIGHT";
        row.appendChild(vTxt);vTxt.layoutSizingHorizontal="FILL";
      }

      spcAttr(spcCnt,"Direction",${esc(root.layoutMode === "HORIZONTAL" ? "Horizontal" : root.layoutMode === "VERTICAL" ? "Vertical" : "None")});
      spcAttr(spcCnt,"Vertical resizing",${esc(root.layoutSizingV || "Fixed")});
      spcAttr(spcCnt,"Horizontal resizing",${esc(root.layoutSizingH || "Fixed")});
      spcAttr(spcCnt,"Item spacing",String(${root.itemSpacing}));
      spcAttr(spcCnt,"Padding top",String(${root.paddingTop}));
      spcAttr(spcCnt,"Padding bottom",String(${root.paddingBottom}));
      spcAttr(spcCnt,"Padding left",String(${root.paddingLeft}));
      spcAttr(spcCnt,"Padding right",String(${root.paddingRight}));

      // ── Legend ──
      var spcLeg=figma.createFrame();spcLeg.name="Legend";
      spcLeg.layoutMode="HORIZONTAL";
      spcLeg.primaryAxisSizingMode="AUTO";spcLeg.counterAxisSizingMode="AUTO";
      spcLeg.itemSpacing=24;spcLeg.fills=[];spcLeg.paddingTop=16;
      spcCard.appendChild(spcLeg);spcLeg.layoutSizingHorizontal="FILL";

      function legItem(parent,color,label){
        var li=figma.createFrame();li.layoutMode="HORIZONTAL";
        li.primaryAxisSizingMode="AUTO";li.counterAxisSizingMode="AUTO";
        li.itemSpacing=8;li.fills=[];li.counterAxisAlignItems="CENTER";
        parent.appendChild(li);
        var sw=figma.createRectangle();sw.resize(12,12);
        sw.fills=[{type:"SOLID",color:color}];sw.cornerRadius=2;li.appendChild(sw);
        var lt=figma.createText();lt.fontName=F.r;lt.fontSize=12;
        lt.characters=label;lt.fills=[{type:"SOLID",color:${C.textMuted}}];
        lt.textAutoResize="WIDTH_AND_HEIGHT";li.appendChild(lt);
      }
      legItem(spcLeg,padColor,"Padding");
      legItem(spcLeg,gapColor,"Item spacing");
      legItem(spcLeg,sizeColor,"Element sizing");

      return{ok:true};
    })();
  `);
  if (!r.success) console.error("Spacing exhibit failed:", r.error);
}

// ── Color Token Exhibit ─────────────────────────────────────────────────

async function renderColorExhibit(
  bridge: Bridge, mId: string, spec: ComponentSpec, sectionNum?: number,
): Promise<void> {
  const tokens = spec.extraction.colorTokens;
  if (tokens.length === 0) return;

  const seen = new Set<string>();
  const unique = tokens.filter(t => {
    const key = `${t.colorHex}|${t.tokenName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);

  // Group tokens by semantic role derived from token name or element
  const rolePatterns: [RegExp, string][] = [
    [/primary|brand/i, "Primary"],
    [/secondary/i, "Secondary"],
    [/danger|error|destructive/i, "Danger"],
    [/warning|caution/i, "Warning"],
    [/success|positive/i, "Success"],
    [/interactive|action|link/i, "Interactive"],
    [/disabled|inactive/i, "Disabled"],
    [/inverse|on-color/i, "Inverse"],
    [/border|stroke|outline/i, "Border"],
    [/background|bg|surface|layer/i, "Background"],
    [/text|label|content|foreground/i, "Text"],
    [/icon/i, "Icon"],
    [/focus|ring/i, "Focus"],
    [/hover/i, "Hover"],
  ];

  function classifyToken(t: { tokenName: string; element: string }): string {
    const combined = `${t.tokenName} ${t.element}`;
    for (const [re, label] of rolePatterns) {
      if (re.test(combined)) return label;
    }
    return "Other";
  }

  // Build grouped structure
  const groupMap = new Map<string, typeof unique>();
  for (const t of unique) {
    const role = classifyToken(t);
    if (!groupMap.has(role)) groupMap.set(role, []);
    groupMap.get(role)!.push(t);
  }
  const groups = Array.from(groupMap.entries());

  const groupsJSON = JSON.stringify(groups);

  const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${sectionCardOpenJS("colCard", "m", "Color Tokens")}
      ${sectionTitleJS("colTitle", "colCard", "Color Tokens by Type", sectionNum)}

      var groups=${groupsJSON};

      for(var gi=0;gi<groups.length;gi++){
        var groupName=groups[gi][0];
        var groupTokens=groups[gi][1];

        // Group sub-header
        var grpTitle=figma.createText();grpTitle.fontName=F.b;grpTitle.fontSize=16;
        grpTitle.lineHeight={unit:"PIXELS",value:24};grpTitle.characters=groupName;
        grpTitle.fills=[{type:"SOLID",color:${C.textMain}}];
        grpTitle.textAutoResize="HEIGHT";
        colCard.appendChild(grpTitle);grpTitle.layoutSizingHorizontal="FILL";

        // Horizontal swatch row for this group
        var swatchRow=figma.createFrame();swatchRow.name=groupName+" Swatches";
        swatchRow.layoutMode="HORIZONTAL";swatchRow.layoutWrap="WRAP";
        swatchRow.primaryAxisSizingMode="AUTO";swatchRow.counterAxisSizingMode="AUTO";
        swatchRow.itemSpacing=12;swatchRow.counterAxisSpacing=12;swatchRow.fills=[];
        colCard.appendChild(swatchRow);swatchRow.layoutSizingHorizontal="FILL";

        for(var ti=0;ti<groupTokens.length;ti++){
          var t=groupTokens[ti];

          // Swatch card: color block + label
          var sc=figma.createFrame();sc.name=t.tokenName||t.colorHex;
          sc.layoutMode="VERTICAL";
          sc.primaryAxisSizingMode="AUTO";sc.counterAxisSizingMode="FIXED";
          sc.resize(140,10);
          sc.itemSpacing=6;sc.paddingTop=8;sc.paddingBottom=10;sc.paddingLeft=8;sc.paddingRight=8;
          sc.fills=[{type:"SOLID",color:${C.bgCard}}];sc.cornerRadius=8;
          swatchRow.appendChild(sc);

          // Color swatch rectangle
          var sw=figma.createRectangle();sw.resize(124,36);sw.cornerRadius=6;
          var hex=t.colorHex.replace("#","");
          var cr=parseInt(hex.substring(0,2),16)/255;
          var cg=parseInt(hex.substring(2,4),16)/255;
          var cb=parseInt(hex.substring(4,6),16)/255;
          sw.fills=[{type:"SOLID",color:{r:cr,g:cg,b:cb}}];
          sw.strokes=[{type:"SOLID",color:${C.border}}];sw.strokeWeight=1;sw.strokeAlign="INSIDE";
          sc.appendChild(sw);sw.layoutSizingHorizontal="FILL";

          // Hex label
          var hexLbl=figma.createText();hexLbl.fontName=F.mono;hexLbl.fontSize=11;
          hexLbl.lineHeight={unit:"PIXELS",value:16};hexLbl.characters=t.colorHex.toUpperCase();
          hexLbl.fills=[{type:"SOLID",color:${C.textMain}}];
          hexLbl.textAutoResize="HEIGHT";
          sc.appendChild(hexLbl);hexLbl.layoutSizingHorizontal="FILL";

          // Token name
          if(t.tokenName){
            var tokLbl=figma.createText();tokLbl.fontName=F.r;tokLbl.fontSize=10;
            tokLbl.lineHeight={unit:"PIXELS",value:14};tokLbl.characters=t.tokenName;
            tokLbl.fills=[{type:"SOLID",color:${C.textMuted}}];
            tokLbl.textAutoResize="HEIGHT";
            sc.appendChild(tokLbl);tokLbl.layoutSizingHorizontal="FILL";
          }
        }

        // Spacer between groups (except last)
        if(gi<groups.length-1){
          var sep=figma.createFrame();sep.resize(4,8);sep.fills=[];
          colCard.appendChild(sep);sep.layoutSizingHorizontal="FILL";
        }
      }

      return{ok:true};
    })();
  `);
  if (!r.success) console.error("Color exhibit failed:", r.error);
}

// ── Typography Exhibit ──────────────────────────────────────────────────

async function renderTypographyExhibit(
  bridge: Bridge, mId: string, spec: ComponentSpec, sectionNum?: number,
): Promise<void> {
  const typo = spec.extraction.typography;
  if (typo.length === 0) return;

  const seen = new Set<string>();
  const unique = typo.filter(t => {
    const key = `${t.fontFamily}|${t.fontStyle}|${t.fontSize}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 16);

  const typoJSON = JSON.stringify(unique.map(t => ({
    element: t.element,
    sample: (t.characters || "").slice(0, 40) || t.element,
    family: t.fontFamily,
    style: t.fontStyle,
    size: t.fontSize,
    lineHeight: t.lineHeightPx,
    letterSpacing: t.letterSpacing,
    token: t.tokenName,
  })));

  const r = await bridge.execute(`
    (async () => {
      ${FL}
      var m=await figma.getNodeByIdAsync(${esc(mId)});
      if(!m)return{error:"no master"};

      ${sectionCardOpenJS("typCard", "m", "Typography")}
      ${sectionTitleJS("typTitle", "typCard", "Typography", sectionNum)}

      var typo=${typoJSON};

      // Batch-load all unique fonts
      var fontCache={};
      for(var fi=0;fi<typo.length;fi++){
        var fk=typo[fi].family+"|"+typo[fi].style;
        if(!fontCache[fk]){
          try{
            await figma.loadFontAsync({family:typo[fi].family,style:typo[fi].style});
            fontCache[fk]={family:typo[fi].family,style:typo[fi].style};
          }catch(e){
            try{
              await figma.loadFontAsync({family:typo[fi].family,style:"Regular"});
              fontCache[fk]={family:typo[fi].family,style:"Regular"};
            }catch(e2){fontCache[fk]=F.r;}
          }
        }
      }

      var outer=figma.createFrame();outer.name="Typography Table";
      outer.layoutMode="VERTICAL";
      outer.primaryAxisSizingMode="AUTO";outer.counterAxisSizingMode="AUTO";
      outer.itemSpacing=0;outer.fills=[];
      outer.cornerRadius=8;
      outer.strokes=[{type:"SOLID",color:${C.border}}];outer.strokeWeight=1;outer.strokeAlign="INSIDE";
      outer.clipsContent=true;
      typCard.appendChild(outer);outer.layoutSizingHorizontal="FILL";

      for(var i=0;i<typo.length;i++){
        var t=typo[i];
        var actualSize=Math.min(t.size||14,72);
        var rowPadV=Math.max(16,Math.round(actualSize*0.4));

        var row=figma.createFrame();row.name=t.element;
        row.layoutMode="HORIZONTAL";
        row.primaryAxisSizingMode="AUTO";row.counterAxisSizingMode="AUTO";
        row.itemSpacing=24;
        row.paddingTop=rowPadV;row.paddingBottom=rowPadV;row.paddingLeft=20;row.paddingRight=20;
        row.fills=[{type:"SOLID",color:i%2===0?${C.white}:${C.bgCard}}];
        row.counterAxisAlignItems="CENTER";
        if(i<typo.length-1){
          row.strokes=[{type:"SOLID",color:${C.border}}];row.strokeWeight=1;
          row.strokeTopWeight=0;row.strokeRightWeight=0;row.strokeBottomWeight=1;row.strokeLeftWeight=0;
          row.strokeAlign="INSIDE";
        }
        outer.appendChild(row);row.layoutSizingHorizontal="FILL";

        var eName=figma.createText();eName.fontName=F.sb;eName.fontSize=13;
        eName.lineHeight={unit:"PIXELS",value:20};eName.characters=t.element;
        eName.fills=[{type:"SOLID",color:${C.textMuted}}];
        eName.textAutoResize="HEIGHT";eName.resize(140,20);
        row.appendChild(eName);eName.layoutSizingHorizontal="FIXED";

        // Render sample at actual font size and family
        var sampleFont=fontCache[t.family+"|"+t.style]||F.r;
        var sample=figma.createText();sample.fontName=sampleFont;sample.fontSize=actualSize;
        sample.lineHeight={unit:"PIXELS",value:Math.round(actualSize*1.4)};
        sample.characters=t.sample;
        sample.fills=[{type:"SOLID",color:${C.textMain}}];
        sample.textAutoResize="HEIGHT";
        row.appendChild(sample);sample.layoutSizingHorizontal="FILL";

        var spec=t.family+" "+t.style+" "+t.size;
        if(t.lineHeight)spec+="/"+Math.round(t.lineHeight);
        var specTxt=figma.createText();specTxt.fontName=F.mono;specTxt.fontSize=11;
        specTxt.lineHeight={unit:"PIXELS",value:16};specTxt.characters=spec;
        specTxt.fills=[{type:"SOLID",color:${C.textMuted}}];
        specTxt.textAutoResize="HEIGHT";specTxt.resize(220,16);
        row.appendChild(specTxt);specTxt.layoutSizingHorizontal="FIXED";

        if(t.token){
          var tokTxt=figma.createText();tokTxt.fontName=F.mono;tokTxt.fontSize=11;
          tokTxt.lineHeight={unit:"PIXELS",value:16};tokTxt.characters=t.token;
          tokTxt.fills=[{type:"SOLID",color:${C.padGreen}}];
          tokTxt.textAutoResize="WIDTH_AND_HEIGHT";
          row.appendChild(tokTxt);
        }
      }

      return{ok:true};
    })();
  `);
  if (!r.success) console.error("Typography exhibit failed:", r.error);
}

// ══════════════════════════════════════════════════════════════════════════
//  MAIN ENTRY — routes visual sections to exhibits, others to text cards
// ══════════════════════════════════════════════════════════════════════════

export async function renderVisualDoc(spec: ComponentSpec, pageName?: string): Promise<string> {
  const bridge = await getBridge();
  const resolvedName = pageName || `${spec.componentName} \u2014 Spec`;

  // 1. Page + master frame
  const { pageId, mId } = await initPage(bridge, resolvedName);

  // 2. Header + Hero (merged into one call)
  const description = spec.description
    || `${spec.componentName} is a ${(spec.nodeType || "component").toLowerCase().replace(/_/g, " ")} used in the design system.`;
  // Derive section labels for subtitle
  const sectionLabelMap: Record<string, string> = {
    anatomy: "Anatomy", variants: "Properties", spacing: "Spacing",
    "color-tokens": "Color Tokens", typography: "Typography",
  };
  const sectionLabels = spec.sections
    .map(s => sectionLabelMap[s.id])
    .filter((l): l is string => !!l);
  await renderDocHeaderAndHero(bridge, mId, spec.componentName, description, spec, sectionLabels);

  // 3. Sections — route visual sections to exhibit renderers, others to text cards
  let sectionNumber = 0;
  for (let i = 0; i < spec.sections.length; i++) {
    const sec = spec.sections[i];
    sectionNumber++;

    switch (sec.id) {
      // ── Visual exhibits (each creates its own card) ──
      case "anatomy":
        if (spec.extraction.anatomy.elements.length > 0) {
          await renderAnatomyExhibit(bridge, mId, spec, sectionNumber);
        } else {
          await renderTextSection(bridge, mId, sec.title, sec.content, sectionNumber);
        }
        break;

      case "variants":
        if (spec.extraction.snapshot.variants?.length > 1) {
          await renderPropertyTable(bridge, mId, spec, sectionNumber);
        } else {
          await renderTextSection(bridge, mId, sec.title, sec.content, sectionNumber);
        }
        break;

      case "spacing":
        // Render side-by-side sizing comparison if a Size axis exists
        await renderSizingComparison(bridge, mId, spec, sectionNumber);
        if (spec.extraction.spacing.length > 0) {
          sectionNumber++;
          await renderSpacingExhibit(bridge, mId, spec, sectionNumber);
        } else if (!(spec.extraction.snapshot.variantGroupProperties || {})[
          Object.keys(spec.extraction.snapshot.variantGroupProperties || {}).find(k => /^size$/i.test(k)) || ""
        ]) {
          await renderTextSection(bridge, mId, sec.title, sec.content, sectionNumber);
        }
        break;

      case "color-tokens":
        if (spec.extraction.colorTokens.length > 0) {
          await renderColorExhibit(bridge, mId, spec, sectionNumber);
        } else {
          await renderTextSection(bridge, mId, sec.title, sec.content, sectionNumber);
        }
        break;

      case "typography":
        if (spec.extraction.typography.length > 0) {
          await renderTypographyExhibit(bridge, mId, spec, sectionNumber);
        } else {
          await renderTextSection(bridge, mId, sec.title, sec.content, sectionNumber);
        }
        break;

      // ── Text-based sections (each in its own white card) ──
      default:
        await renderTextSection(bridge, mId, sec.title, sec.content, sectionNumber);
    }
  }

  // 3b. Footer + Zoom to fit (merged into one call)
  {
    const timestamp = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    try {
      await bridge.execute(`
        (async () => {
          ${FL}
          var m=await figma.getNodeByIdAsync(${esc(mId)});
          if(!m)return{error:"no master"};

          // Footer
          var footer=figma.createFrame();footer.name="Footer";
          footer.layoutMode="HORIZONTAL";
          footer.primaryAxisSizingMode="AUTO";footer.counterAxisSizingMode="AUTO";
          footer.itemSpacing=0;footer.fills=[];
          footer.paddingTop=16;footer.paddingBottom=0;
          footer.paddingLeft=8;footer.paddingRight=8;
          footer.strokes=[{type:"SOLID",color:${C.border}}];
          footer.strokeWeight=1;footer.strokeAlign="INSIDE";
          footer.strokeTopWeight=1;footer.strokeRightWeight=0;
          footer.strokeBottomWeight=0;footer.strokeLeftWeight=0;
          footer.counterAxisAlignItems="CENTER";
          m.appendChild(footer);footer.layoutSizingHorizontal="FILL";

          var left=figma.createText();left.fontName=F.r;left.fontSize=12;
          left.lineHeight={unit:"PIXELS",value:18};
          left.characters="Generated by MCP Power";
          left.fills=[{type:"SOLID",color:${C.textMuted}}];
          left.textAutoResize="WIDTH_AND_HEIGHT";
          footer.appendChild(left);

          var spacer=figma.createFrame();spacer.name="Spacer";
          spacer.resize(4,4);spacer.fills=[];
          footer.appendChild(spacer);spacer.layoutGrow=1;

          var right=figma.createText();right.fontName=F.r;right.fontSize=12;
          right.lineHeight={unit:"PIXELS",value:18};
          right.characters=${esc(timestamp)};
          right.fills=[{type:"SOLID",color:${C.textMuted}}];
          right.textAutoResize="WIDTH_AND_HEIGHT";
          footer.appendChild(right);

          // Zoom to fit
          var pg=await figma.getNodeByIdAsync(${esc(pageId)});
          if(pg&&pg.type==="PAGE"&&pg.children.length>0)
            figma.viewport.scrollAndZoomIntoView(pg.children);

          return{ok:true};
        })();
      `);
    } catch { /* ok */ }
  }

  return pageId;
}
