/**
 * component-spec-sheet/renderer.ts
 *
 * Builds a single Figma Plugin API script that creates an EightShapes-Specs-style
 * visual spec sheet directly on canvas.
 *
 * Key visual output (matching the reference):
 *   ┌───────────────────────────────────────────┐
 *   │  Type=Primary, Size=sm, State=Default      │  ← header: variant string only
 *   │                                             │
 *   │  Anatomy                                    │
 *   │  ┌─ gray card ──────────────────────────┐  │
 *   │  │  [component]  ① ②  │  ① leadingIcon  │  │  ← numbered colored dots on
 *   │  │                     │  ② Label         │  │    the component + legend
 *   │  │                     │  ③ trailingIcon  │  │
 *   │  └─────────────────────────────────────┘  │
 *   │                                             │
 *   │  Properties                                 │
 *   │  Type                                       │
 *   │  ┌─ gray row ──────────────────────────┐  │
 *   │  │  [instance]  │ Primary               │  │  ← each value = own row
 *   │  │              │ • Button               │  │    with deep style extraction
 *   │  │              │ • fill: #2563EB        │  │
 *   │  │              │ • font: Inter 14       │  │
 *   │  │              │ • size: 120 × 40      │  │
 *   │  └─────────────────────────────────────┘  │
 *   │  ┌─ gray row ──────────────────────────┐  │
 *   │  │  [instance]  │ Secondary             │  │
 *   │  │              │ • Button ...           │  │
 *   │  └─────────────────────────────────────┘  │
 *   │  ...                                        │
 *   │                                             │
 *   │  Layout and spacing                         │
 *   │  Selected node                              │
 *   │  ┌─ gray card ──────────────────────────┐  │
 *   │  │  [component]  │  • Button             │  │
 *   │  │   ██ overlay  │  • layoutMode: H      │  │  ← colored padding/gap
 *   │  │               │  • padding: 8,16,8,16 │  │    overlays + property dump
 *   │  └─────────────────────────────────────┘  │
 *   └───────────────────────────────────────────┘
 *
 * IMPORTANT Figma pattern: layoutSizingHorizontal = "FILL" only works
 * AFTER the node is appended to an auto-layout parent.
 */
import type { SpecSheetPlan } from "./types.js";

// ── Design tokens ────────────────────────────────────────────────────────

const PAGE_W = 960;
const PAD = 40;

const C = {
  textMain:  "{ r: 0.067, g: 0.094, b: 0.153 }",   // #111827
  textMuted: "{ r: 0.42, g: 0.45, b: 0.49 }",       // #6b7280
  textLabel: "{ r: 0.294, g: 0.333, b: 0.388 }",    // #4b5563
  bgCard:    "{ r: 0.965, g: 0.968, b: 0.973 }",    // #f6f7f8
  border:    "{ r: 0.898, g: 0.906, b: 0.922 }",    // #e5e7eb
  white:     "{ r: 1, g: 1, b: 1 }",
  markerRed: "{ r: 0.85, g: 0.24, b: 0.24 }",       // #d93d3d  (like the ref)
  padGreen:  "{ r: 0.18, g: 0.72, b: 0.33 }",       // #2eb854
  gapBlue:   "{ r: 0.26, g: 0.52, b: 0.96 }",       // #4285f5
  elemBlue:  "{ r: 0.73, g: 0.85, b: 0.98 }",       // #bad9fa
};

function esc(s: string): string { return JSON.stringify(s); }

// ── Font loader ─────────────────────────────────────────────────────────

const FL = `
var F={};
async function lf(k,a){for(var i=0;i<a.length;i++){try{await figma.loadFontAsync(a[i]);F[k]=a[i];return}catch(e){}}F[k]={family:"Arial",style:"Regular"};try{await figma.loadFontAsync(F[k])}catch(e){}}
await lf("b",[{family:"Inter",style:"Bold"},{family:"Roboto",style:"Bold"}]);
await lf("sb",[{family:"Inter",style:"SemiBold"},{family:"Inter",style:"Medium"},{family:"Roboto",style:"Medium"}]);
await lf("r",[{family:"Inter",style:"Regular"},{family:"Roboto",style:"Regular"}]);
await lf("mono",[{family:"SF Mono",style:"Regular"},{family:"Roboto Mono",style:"Regular"},{family:"Courier New",style:"Regular"}]);
`;

// ── Micro JS helpers ────────────────────────────────────────────────────

function spacerJS(h: number, parent = "m"): string {
  return `(function(){var sp=figma.createFrame();sp.resize(4,${h});sp.fills=[];${parent}.appendChild(sp);sp.layoutSizingHorizontal="FILL";})();`;
}

function dividerJS(parent = "m"): string {
  return `(function(){var dv=figma.createRectangle();dv.resize(4,1);dv.fills=[{type:"SOLID",color:${C.border}}];${parent}.appendChild(dv);dv.layoutSizingHorizontal="FILL";})();`;
}

// ── Deep style extractor (runs inside execute) ──────────────────────────
// This function is injected into the Figma script once, then called
// for every variant instance to pull out fill colors, typography,
// padding, and corner-radius from the instance AND its children.

const EXTRACT_STYLE_FN = `
function extractStyle(node){
  var info={fills:[],texts:[],padding:null,radius:null,w:Math.round(node.width),h:Math.round(node.height)};
  // Root fills
  if(Array.isArray(node.fills)){
    for(var fi=0;fi<node.fills.length;fi++){
      var p=node.fills[fi];
      if(p.type==="SOLID"&&p.visible!==false&&p.color){
        var r=Math.round(p.color.r*255),g=Math.round(p.color.g*255),b=Math.round(p.color.b*255);
        info.fills.push("#"+[r,g,b].map(function(v){return v.toString(16).padStart(2,"0")}).join(""));
      }
    }
  }
  // Radius
  if(typeof node.cornerRadius==="number"&&node.cornerRadius>0)info.radius=node.cornerRadius;
  // Padding
  if("paddingTop" in node){
    var pt=node.paddingTop||0,pr=node.paddingRight||0,pb=node.paddingBottom||0,pl=node.paddingLeft||0;
    if(pt+pr+pb+pl>0)info.padding=pt+", "+pr+", "+pb+", "+pl;
  }
  // BFS for text + child fills
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
  // Deduplicate texts
  var seen={};info.texts=info.texts.filter(function(t){if(seen[t])return false;seen[t]=true;return true;});
  return info;
}
`;

// ── Build: header ───────────────────────────────────────────────────────

function buildHeaderJS(plan: SpecSheetPlan): string {
  // Exactly like the reference: just the variant property string, centered, bold
  const label = plan.variantLabel || plan.componentName;
  return `
// ── HEADER ──
(function(){
  var ht=figma.createText();ht.fontName=F.b;ht.fontSize=24;
  ht.lineHeight={unit:"PIXELS",value:32};
  ht.characters=${esc(label)};
  ht.fills=[{type:"SOLID",color:${C.textMain}}];
  ht.textAutoResize="HEIGHT";
  ht.textAlignHorizontal="CENTER";
  m.appendChild(ht);ht.layoutSizingHorizontal="FILL";
})();
${spacerJS(32)}
`;
}

// ── Build: anatomy ──────────────────────────────────────────────────────

function buildAnatomyJS(plan: SpecSheetPlan): string {
  if (plan.markers.length === 0) return "";

  const markersJSON = JSON.stringify(plan.markers);
  const MARKER_D = 20;
  const MARKER_MARGIN = 60;

  return `
// ── ANATOMY ──
(function(){
  var secTitle=figma.createText();secTitle.fontName=F.b;secTitle.fontSize=18;
  secTitle.characters="Anatomy";secTitle.fills=[{type:"SOLID",color:${C.textMain}}];
  secTitle.textAutoResize="HEIGHT";m.appendChild(secTitle);secTitle.layoutSizingHorizontal="FILL";
})();
${spacerJS(12)}
(function(){
  // Gray card: component on left, legend on right
  var card=figma.createFrame();card.name="Anatomy";
  card.layoutMode="HORIZONTAL";
  card.primaryAxisSizingMode="AUTO";card.counterAxisSizingMode="AUTO";
  card.paddingTop=32;card.paddingBottom=32;card.paddingLeft=32;card.paddingRight=32;
  card.itemSpacing=40;
  card.fills=[{type:"SOLID",color:${C.bgCard}}];card.cornerRadius=12;
  card.counterAxisAlignItems="CENTER";
  m.appendChild(card);card.layoutSizingHorizontal="FILL";

  // ── Left: component with external markers + leader lines ──
  var compWrap=figma.createFrame();compWrap.name="Component";
  compWrap.layoutMode="NONE";compWrap.fills=[];
  card.appendChild(compWrap);

  var src=sourceNode;
  if(src.type==="COMPONENT_SET"&&src.children.length>0)src=src.children[0];
  var clone=src.clone();
  clone.x=${MARKER_MARGIN};clone.y=${MARKER_MARGIN};
  ${plan.anatomyScale > 1 ? `clone.rescale(${plan.anatomyScale});` : ""}
  compWrap.appendChild(clone);
  compWrap.resize(clone.width+${MARKER_MARGIN * 2},clone.height+${MARKER_MARGIN * 2});

  // Place numbered dots OUTSIDE the component with connector lines
  var markers=${markersJSON};
  var MD=${MARKER_D};
  var MR=${MARKER_D / 2};
  for(var i=0;i<markers.length;i++){
    var mk=markers[i];

    // Connector line from marker to target element
    var connector=figma.createVector();
    var pathData="M "+mk.markerX+" "+mk.markerY+" L "+mk.targetX+" "+mk.targetY;
    connector.vectorPaths=[{windingRule:"NONZERO",data:pathData}];
    connector.strokes=[{type:"SOLID",color:${C.markerRed}}];
    connector.strokeWeight=1.5;connector.fills=[];
    connector.strokeCap="ROUND";connector.opacity=0.7;
    compWrap.appendChild(connector);

    // Marker dot at edge position (outside component)
    var dot=figma.createEllipse();dot.resize(MD,MD);
    dot.fills=[{type:"SOLID",color:${C.markerRed}}];
    dot.x=mk.markerX-MR;dot.y=mk.markerY-MR;
    dot.name="Marker "+(i+1);
    compWrap.appendChild(dot);

    var numTxt=figma.createText();numTxt.fontName=F.b;numTxt.fontSize=10;
    numTxt.characters=String(i+1);
    numTxt.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];
    numTxt.textAutoResize="WIDTH_AND_HEIGHT";
    compWrap.appendChild(numTxt);
    numTxt.x=mk.markerX-numTxt.width/2;
    numTxt.y=mk.markerY-numTxt.height/2;
  }

  // ── Right: legend list ──
  var legend=figma.createFrame();legend.name="Legend";
  legend.layoutMode="VERTICAL";
  legend.primaryAxisSizingMode="AUTO";legend.counterAxisSizingMode="AUTO";
  legend.itemSpacing=8;legend.fills=[];
  card.appendChild(legend);

  var roleLabels={"content-element":"Content","optional-slot":"Optional","fixed-sub-component":"Sub-component","structural":"Container","decorative":"Decorative"};

  for(var j=0;j<markers.length;j++){
    var row=figma.createFrame();row.name="Item "+(j+1);
    row.layoutMode="HORIZONTAL";
    row.primaryAxisSizingMode="AUTO";row.counterAxisSizingMode="AUTO";
    row.itemSpacing=10;row.fills=[];row.counterAxisAlignItems="CENTER";
    legend.appendChild(row);

    // Numbered dot
    var rDot=figma.createEllipse();rDot.resize(${MARKER_D},${MARKER_D});
    rDot.fills=[{type:"SOLID",color:${C.markerRed}}];
    var rWrap=figma.createFrame();rWrap.name="Num";rWrap.layoutMode="NONE";
    rWrap.resize(${MARKER_D},${MARKER_D});rWrap.fills=[];
    rWrap.appendChild(rDot);rDot.x=0;rDot.y=0;
    var rNum=figma.createText();rNum.fontName=F.b;rNum.fontSize=10;
    rNum.characters=String(j+1);
    rNum.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];
    rNum.textAutoResize="WIDTH_AND_HEIGHT";
    rWrap.appendChild(rNum);rNum.x=MR-rNum.width/2;rNum.y=MR-rNum.height/2;
    row.appendChild(rWrap);

    // Element name + role
    var roleTxt=roleLabels[markers[j].role]||markers[j].role;
    var eName=figma.createText();eName.fontName=F.r;eName.fontSize=13;
    eName.lineHeight={unit:"PIXELS",value:20};
    eName.characters=markers[j].name+" \\u2014 "+roleTxt;
    eName.fills=[{type:"SOLID",color:${C.textMain}}];
    eName.textAutoResize="WIDTH_AND_HEIGHT";
    row.appendChild(eName);
  }
})();
${spacerJS(32)}
`;
}

// ── Build: properties ───────────────────────────────────────────────────

function buildPropertiesJS(plan: SpecSheetPlan): string {
  if (plan.propertyAxes.length === 0 && plan.booleanToggles.length === 0) return "";

  let js = `
// ── PROPERTIES ──
(function(){
  var pTitle=figma.createText();pTitle.fontName=F.b;pTitle.fontSize=18;
  pTitle.characters="Properties";pTitle.fills=[{type:"SOLID",color:${C.textMain}}];
  pTitle.textAutoResize="HEIGHT";m.appendChild(pTitle);pTitle.layoutSizingHorizontal="FILL";
})();
${spacerJS(8)}
`;

  // Each variant axis
  for (const axis of plan.propertyAxes) {
    js += `
// ── ${axis.axisName} ──
(function(){
  var axTitle=figma.createText();axTitle.fontName=F.sb;axTitle.fontSize=15;
  axTitle.characters=${esc(axis.axisName)};axTitle.fills=[{type:"SOLID",color:${C.textMain}}];
  axTitle.textAutoResize="HEIGHT";m.appendChild(axTitle);axTitle.layoutSizingHorizontal="FILL";
})();
${spacerJS(8)}
(function(){
  var compSet=sourceNode.type==="COMPONENT_SET"?sourceNode:(sourceNode.parent&&sourceNode.parent.type==="COMPONENT_SET"?sourceNode.parent:null);
  if(!compSet)return;
  var samples=${JSON.stringify(axis.samples)};

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

    // Extract real style data from this instance
    var style=extractStyle(inst);

    // ── Row card: instance left, metadata right ──
    var row=figma.createFrame();row.name=s.label;
    row.layoutMode="HORIZONTAL";
    row.primaryAxisSizingMode="AUTO";row.counterAxisSizingMode="AUTO";
    row.itemSpacing=40;
    row.paddingTop=24;row.paddingBottom=24;row.paddingLeft=32;row.paddingRight=32;
    row.fills=[{type:"SOLID",color:${C.bgCard}}];row.cornerRadius=8;
    row.counterAxisAlignItems="CENTER";
    m.appendChild(row);row.layoutSizingHorizontal="FILL";

    // Instance in a fixed-width wrapper for consistent sizing
    var instWrap=figma.createFrame();instWrap.name="Preview";
    instWrap.layoutMode="HORIZONTAL";
    instWrap.primaryAxisSizingMode="FIXED";instWrap.counterAxisSizingMode="AUTO";
    instWrap.resize(160,10);instWrap.fills=[];
    instWrap.primaryAxisAlignItems="CENTER";
    instWrap.counterAxisAlignItems="CENTER";
    row.appendChild(instWrap);
    instWrap.appendChild(inst);

    // Metadata column
    var meta=figma.createFrame();meta.name="Meta";
    meta.layoutMode="VERTICAL";meta.primaryAxisSizingMode="AUTO";
    meta.counterAxisSizingMode="AUTO";meta.itemSpacing=4;meta.fills=[];
    row.appendChild(meta);

    // Value name (bold)
    var valName=figma.createText();valName.fontName=F.sb;valName.fontSize=14;
    valName.characters=s.label;valName.fills=[{type:"SOLID",color:${C.textMain}}];
    valName.textAutoResize="WIDTH_AND_HEIGHT";meta.appendChild(valName);

    // Component name (muted)
    var compName=figma.createText();compName.fontName=F.r;compName.fontSize=12;
    compName.characters="\\u2022  "+${esc(plan.componentName)};
    compName.fills=[{type:"SOLID",color:${C.textMuted}}];
    compName.textAutoResize="WIDTH_AND_HEIGHT";meta.appendChild(compName);

    // Style details — each on its own line
    var lines=[];
    for(var fi=0;fi<Math.min(style.fills.length,3);fi++){
      lines.push("\\u2022  fill: "+style.fills[fi]);
    }
    for(var ti=0;ti<Math.min(style.texts.length,2);ti++){
      lines.push("\\u2022  font: "+style.texts[ti]);
    }
    lines.push("\\u2022  size: "+style.w+" \\u00D7 "+style.h);
    if(style.radius)lines.push("\\u2022  radius: "+style.radius+"px");
    if(style.padding)lines.push("\\u2022  padding: "+style.padding);

    if(lines.length>0){
      // Spacer between component name and details
      var detSpacer=figma.createFrame();detSpacer.resize(4,4);detSpacer.fills=[];
      meta.appendChild(detSpacer);detSpacer.layoutSizingHorizontal="FILL";

      var detTxt=figma.createText();detTxt.fontName=F.r;detTxt.fontSize=11;
      detTxt.lineHeight={unit:"PIXELS",value:18};
      detTxt.characters=lines.join("\\n");
      detTxt.fills=[{type:"SOLID",color:${C.textMuted}}];
      detTxt.textAutoResize="WIDTH_AND_HEIGHT";
      meta.appendChild(detTxt);
    }
  }
  // Row gap spacer between this axis and the next
})();
${spacerJS(8)}
`;
  }

  // Boolean toggles
  for (const toggle of plan.booleanToggles) {
    js += `
// ── ${toggle.name} ──
(function(){
  var tTitle=figma.createText();tTitle.fontName=F.sb;tTitle.fontSize=15;
  tTitle.characters=${esc(toggle.name)};tTitle.fills=[{type:"SOLID",color:${C.textMain}}];
  tTitle.textAutoResize="HEIGHT";m.appendChild(tTitle);tTitle.layoutSizingHorizontal="FILL";
})();
${spacerJS(8)}
(function(){
  var compSet=sourceNode.type==="COMPONENT_SET"?sourceNode:null;
  if(!compSet||compSet.children.length===0)return;
  var base=compSet.children[0];
  var boolName=${esc(toggle.name)};

  // Find the component property key (may have #hash suffix)
  var propKey=null;
  if("componentProperties" in compSet&&compSet.componentProperties){
    for(var k in compSet.componentProperties){
      if(k.replace(/#.*$/,"").trim()===boolName){propKey=k;break;}
    }
  }

  // Create two instance cards (true/false)
  var vals=[true,false];
  for(var vi=0;vi<vals.length;vi++){
    var inst=base.createInstance();
    if(propKey){try{var pp={};pp[propKey]=vals[vi];inst.setProperties(pp);}catch(e){}}

    var row=figma.createFrame();row.name=boolName+"="+vals[vi];
    row.layoutMode="HORIZONTAL";row.primaryAxisSizingMode="AUTO";
    row.counterAxisSizingMode="AUTO";row.itemSpacing=40;
    row.paddingTop=24;row.paddingBottom=24;row.paddingLeft=32;row.paddingRight=32;
    row.fills=[{type:"SOLID",color:${C.bgCard}}];row.cornerRadius=8;
    row.counterAxisAlignItems="CENTER";
    m.appendChild(row);row.layoutSizingHorizontal="FILL";

    // Instance in fixed wrapper
    var instWrap=figma.createFrame();instWrap.name="Preview";
    instWrap.layoutMode="HORIZONTAL";
    instWrap.primaryAxisSizingMode="FIXED";instWrap.counterAxisSizingMode="AUTO";
    instWrap.resize(160,10);instWrap.fills=[];
    instWrap.primaryAxisAlignItems="CENTER";
    instWrap.counterAxisAlignItems="CENTER";
    row.appendChild(instWrap);
    instWrap.appendChild(inst);

    var meta=figma.createFrame();meta.name="Meta";
    meta.layoutMode="VERTICAL";meta.primaryAxisSizingMode="AUTO";
    meta.counterAxisSizingMode="AUTO";meta.itemSpacing=4;meta.fills=[];
    row.appendChild(meta);

    var vLbl=figma.createText();vLbl.fontName=F.sb;vLbl.fontSize=14;
    vLbl.characters=vals[vi]?"Visible":"Hidden";
    vLbl.fills=[{type:"SOLID",color:${C.textMain}}];
    vLbl.textAutoResize="WIDTH_AND_HEIGHT";meta.appendChild(vLbl);

    var vSub=figma.createText();vSub.fontName=F.r;vSub.fontSize=12;
    vSub.characters="\\u2022  "+boolName+" = "+vals[vi];
    vSub.fills=[{type:"SOLID",color:${C.textMuted}}];
    vSub.textAutoResize="WIDTH_AND_HEIGHT";meta.appendChild(vSub);
  }
})();
${spacerJS(8)}
`;
  }

  return js;
}

// ── Build: layout and spacing ───────────────────────────────────────────

function buildSpacingJS(plan: SpecSheetPlan): string {
  if (plan.spacingEntries.length === 0) return "";

  const root = plan.spacingEntries[0];
  const childrenData = JSON.stringify(root.children || []);

  // Margin around the component for dimension annotations
  const ANNOT_MARGIN = 100;
  const CAP_LEN = 6;    // perpendicular end cap length
  const LINE_W = 1.5;   // line stroke weight

  return `
// ── LAYOUT AND SPACING ──
${dividerJS()}
${spacerJS(24)}
(function(){
  var lsTitle=figma.createText();lsTitle.fontName=F.b;lsTitle.fontSize=18;
  lsTitle.characters="Layout and spacing";lsTitle.fills=[{type:"SOLID",color:${C.textMain}}];
  lsTitle.textAutoResize="HEIGHT";m.appendChild(lsTitle);lsTitle.layoutSizingHorizontal="FILL";
})();
${spacerJS(8)}
(function(){
  var snTitle=figma.createText();snTitle.fontName=F.sb;snTitle.fontSize=14;
  snTitle.characters="Selected node";snTitle.fills=[{type:"SOLID",color:${C.textMain}}];
  snTitle.textAutoResize="HEIGHT";m.appendChild(snTitle);snTitle.layoutSizingHorizontal="FILL";
})();
${spacerJS(8)}
(function(){
  var src=sourceNode;
  if(src.type==="COMPONENT_SET"&&src.children.length>0)src=src.children[0];
  var compClone=src.clone();
  var cW=compClone.width,cH=compClone.height;
  var AM=${ANNOT_MARGIN};

  // Canvas frame (absolute positioning for dimension markers)
  var canvas=figma.createFrame();canvas.name="Spacing";
  canvas.layoutMode="NONE";
  canvas.fills=[{type:"SOLID",color:${C.bgCard}}];canvas.cornerRadius=12;
  canvas.resize(cW+AM*2,cH+AM*2);
  m.appendChild(canvas);canvas.layoutSizingHorizontal="FILL";
  // Adjust height to fit content
  canvas.resize(Math.max(canvas.width,cW+AM*2),cH+AM*2);

  // Place the component clone centered in the canvas
  compClone.x=AM;compClone.y=AM;
  canvas.appendChild(compClone);

  // ── Dimension marker helper ──
  // Draws a line with end caps and a centered label
  function drawDim(parent,x1,y1,x2,y2,label,color){
    var isH=Math.abs(y2-y1)<Math.abs(x2-x1);
    // Main line
    var line=figma.createVector();
    var pth="M "+x1+" "+y1+" L "+x2+" "+y2;
    line.vectorPaths=[{windingRule:"NONZERO",data:pth}];
    line.strokes=[{type:"SOLID",color:color}];
    line.strokeWeight=${LINE_W};line.fills=[];
    line.strokeCap="ROUND";
    parent.appendChild(line);

    // End caps (perpendicular to main line)
    var capLen=${CAP_LEN};
    if(isH){
      // Vertical end caps
      var c1=figma.createVector();
      c1.vectorPaths=[{windingRule:"NONZERO",data:"M "+x1+" "+(y1-capLen)+" L "+x1+" "+(y1+capLen)}];
      c1.strokes=[{type:"SOLID",color:color}];c1.strokeWeight=${LINE_W};c1.fills=[];
      parent.appendChild(c1);
      var c2=figma.createVector();
      c2.vectorPaths=[{windingRule:"NONZERO",data:"M "+x2+" "+(y2-capLen)+" L "+x2+" "+(y2+capLen)}];
      c2.strokes=[{type:"SOLID",color:color}];c2.strokeWeight=${LINE_W};c2.fills=[];
      parent.appendChild(c2);
    }else{
      // Horizontal end caps
      var c1=figma.createVector();
      c1.vectorPaths=[{windingRule:"NONZERO",data:"M "+(x1-capLen)+" "+y1+" L "+(x1+capLen)+" "+y1}];
      c1.strokes=[{type:"SOLID",color:color}];c1.strokeWeight=${LINE_W};c1.fills=[];
      parent.appendChild(c1);
      var c2=figma.createVector();
      c2.vectorPaths=[{windingRule:"NONZERO",data:"M "+(x2-capLen)+" "+y2+" L "+(x2+capLen)+" "+y2}];
      c2.strokes=[{type:"SOLID",color:color}];c2.strokeWeight=${LINE_W};c2.fills=[];
      parent.appendChild(c2);
    }

    // Label
    var lbl=figma.createText();lbl.fontName=F.mono;lbl.fontSize=10;
    lbl.characters=label;
    lbl.fills=[{type:"SOLID",color:color}];
    lbl.textAutoResize="WIDTH_AND_HEIGHT";
    parent.appendChild(lbl);
    // Position label at midpoint of line
    var mx=(x1+x2)/2,my=(y1+y2)/2;
    if(isH){
      lbl.x=mx-lbl.width/2;lbl.y=my-lbl.height-4;
    }else{
      lbl.x=mx+4;lbl.y=my-lbl.height/2;
    }
  }

  var padColor=${C.padGreen};
  var gapColor=${C.gapBlue};
  var pt=${root.paddingTop},pr=${root.paddingRight},pb=${root.paddingBottom},pl=${root.paddingLeft};
  var compX=AM,compY=AM;

  // ── Padding dimension markers ──
  // paddingTop: vertical marker on the right side of component
  if(pt>0){
    var rx=compX+cW+20;
    drawDim(canvas,rx,compY,rx,compY+pt,pt+"px",padColor);
  }
  // paddingBottom: vertical marker on the right side
  if(pb>0){
    var rx=compX+cW+20;
    drawDim(canvas,rx,compY+cH-pb,rx,compY+cH,pb+"px",padColor);
  }
  // paddingLeft: horizontal marker above the component
  if(pl>0){
    var ry=compY-20;
    drawDim(canvas,compX,ry,compX+pl,ry,pl+"px",padColor);
  }
  // paddingRight: horizontal marker above, at right edge
  if(pr>0){
    var ry=compY-20;
    drawDim(canvas,compX+cW-pr,ry,compX+cW,ry,pr+"px",padColor);
  }

  // ── Semi-transparent padding overlays on the component ──
  if(pt>0){
    var ot=figma.createRectangle();ot.resize(cW,pt);ot.x=compX;ot.y=compY;
    ot.fills=[{type:"SOLID",color:padColor}];ot.opacity=0.15;canvas.appendChild(ot);
  }
  if(pb>0){
    var ob=figma.createRectangle();ob.resize(cW,pb);ob.x=compX;ob.y=compY+cH-pb;
    ob.fills=[{type:"SOLID",color:padColor}];ob.opacity=0.15;canvas.appendChild(ob);
  }
  if(pl>0){
    var ol=figma.createRectangle();ol.resize(pl,cH);ol.x=compX;ol.y=compY;
    ol.fills=[{type:"SOLID",color:padColor}];ol.opacity=0.15;canvas.appendChild(ol);
  }
  if(pr>0){
    var oR=figma.createRectangle();oR.resize(pr,cH);oR.x=compX+cW-pr;oR.y=compY;
    oR.fills=[{type:"SOLID",color:padColor}];oR.opacity=0.15;canvas.appendChild(oR);
  }

  // ── Item spacing markers between children ──
  var children=${childrenData};
  var layoutMode="${root.layoutMode}";
  var itemSpacing=${root.itemSpacing};
  if(children.length>1&&itemSpacing>0){
    for(var ci=0;ci<children.length-1;ci++){
      var c1=children[ci],c2=children[ci+1];
      if(layoutMode==="HORIZONTAL"){
        // Horizontal gap: vertical marker between children
        var gapX1=compX+c1.x+c1.w;
        var gapX2=compX+c2.x;
        var gapY=compY+cH+20;
        drawDim(canvas,gapX1,gapY,gapX2,gapY,itemSpacing+"px",gapColor);
      }else{
        // Vertical gap: horizontal marker between children
        var gapY1=compY+c1.y+c1.h;
        var gapY2=compY+c2.y;
        var gapX=compX+cW+20;
        drawDim(canvas,gapX,gapY1,gapX,gapY2,itemSpacing+"px",gapColor);
      }
    }
  }

  // ── Overall width/height dimension lines ──
  // Width line below component
  var dimY=compY+cH+50;
  drawDim(canvas,compX,dimY,compX+cW,dimY,cW+"px",${C.textMuted});
  // Height line left of component
  var dimX=compX-40;
  drawDim(canvas,dimX,compY,dimX,compY+cH,cH+"px",${C.textMuted});

  // Resize canvas to fit all annotations
  canvas.resize(Math.max(cW+AM*2+60,canvas.width),cH+AM*2+20);
})();
${spacerJS(16)}
`;
}

// ── Main script builder ─────────────────────────────────────────────────

export function buildSpecSheetScript(plan: SpecSheetPlan): string {
  const sections = plan.sections;
  const hasHeader = sections.includes("header");
  const hasAnatomy = sections.includes("anatomy");
  const hasProperties = sections.includes("properties");
  const hasSpacing = sections.includes("spacing");

  return `(async () => {
  await figma.loadAllPagesAsync();
  ${FL}

  // Resolve source node
  var sourceNode = await figma.getNodeByIdAsync(${esc(plan.sourceNodeId)});
  if (!sourceNode) throw new Error("Source node not found: ${plan.sourceNodeId}");

  // Deep style extraction helper (used by Properties section)
  ${hasProperties ? EXTRACT_STYLE_FN : ""}

  // ── Master frame ──
  var m = figma.createFrame();
  m.name = ${esc(plan.componentName + " — Spec Sheet")};
  m.layoutMode = "VERTICAL";
  m.primaryAxisSizingMode = "AUTO";
  m.counterAxisSizingMode = "FIXED";
  m.resize(${PAGE_W}, 100);
  m.paddingTop = ${PAD};
  m.paddingBottom = ${PAD};
  m.paddingLeft = ${PAD};
  m.paddingRight = ${PAD};
  m.itemSpacing = 0;
  m.fills = [{ type: "SOLID", color: ${C.white} }];
  m.clipsContent = false;
  m.x = ${plan.placement.x};
  m.y = ${plan.placement.y};
  figma.currentPage.appendChild(m);

  ${hasHeader ? buildHeaderJS(plan) : ""}
  ${hasAnatomy ? buildAnatomyJS(plan) : ""}
  ${hasProperties ? buildPropertiesJS(plan) : ""}
  ${hasSpacing ? buildSpacingJS(plan) : ""}

  figma.viewport.scrollAndZoomIntoView([m]);
  return { frameId: m.id };
})();`;
}
