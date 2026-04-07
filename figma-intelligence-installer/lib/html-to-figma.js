/**
 * html-to-figma.js — Converts HTML/CSS output from Google Stitch
 * into a single Figma Plugin API `execute` code string that creates
 * the entire frame tree with correct auto-layout properties.
 *
 * Uses htmlparser2 (already in node_modules) for robust HTML parsing.
 *
 * Key auto-layout rules enforced:
 *   - ONE root frame per task (FIXED/FIXED sizing)
 *   - Every frame has layoutSizingHorizontal + layoutSizingVertical
 *   - Children of VERTICAL parent: H=FILL, V=HUG
 *   - Children of HORIZONTAL parent: V=FILL, H=HUG (or FILL if flex-1)
 *   - Structural wrappers: fills=[] (transparent)
 *   - Property order: layoutMode → sizing → padding → spacing → fills
 *   - appendChild() BEFORE setting FILL on children
 */

const { parseDocument } = require("htmlparser2");

// ── Color helpers ──────────────────────────────────────────────────────────────

function parseColor(str) {
  if (!str || str === "transparent") return null;
  str = str.trim().toLowerCase();

  const named = {
    white: "ffffff", black: "000000", red: "ff0000", green: "008000",
    blue: "0000ff", gray: "808080", grey: "808080", yellow: "ffff00",
    orange: "ffa500", purple: "800080", pink: "ffc0cb", cyan: "00ffff",
    navy: "000080", teal: "008080", maroon: "800000", olive: "808000",
    silver: "c0c0c0", lime: "00ff00", aqua: "00ffff", fuchsia: "ff00ff",
    indigo: "4b0082", coral: "ff7f50", salmon: "fa8072", tomato: "ff6347",
    wheat: "f5deb3", ivory: "fffff0", linen: "faf0e6", beige: "f5f5dc",
    snow: "fffafa", honeydew: "f0fff0", azure: "f0ffff", ghostwhite: "f8f8ff",
    whitesmoke: "f5f5f5", aliceblue: "f0f8ff", lavender: "e6e6fa",
  };
  if (named[str]) str = "#" + named[str];

  const hexMatch = str.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    if (hex.length === 4) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
    const r = parseInt(hex.slice(0,2), 16) / 255;
    const g = parseInt(hex.slice(2,4), 16) / 255;
    const b = parseInt(hex.slice(4,6), 16) / 255;
    const a = hex.length === 8 ? parseInt(hex.slice(6,8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  const rgbMatch = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]) / 255,
      g: parseInt(rgbMatch[2]) / 255,
      b: parseInt(rgbMatch[3]) / 255,
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1,
    };
  }

  return null;
}

function colorToFigma(c) {
  if (!c) return "{r:1,g:1,b:1}";
  return `{r:${c.r.toFixed(3)},g:${c.g.toFixed(3)},b:${c.b.toFixed(3)}}`;
}

function rgbaToHex(c) {
  if (!c) return "#FFFFFF";
  const r = Math.round(c.r * 255).toString(16).padStart(2, "0");
  const g = Math.round(c.g * 255).toString(16).padStart(2, "0");
  const b = Math.round(c.b * 255).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`.toUpperCase();
}

// ── CSS parsing helpers ────────────────────────────────────────────────────────

function parseInlineStyle(styleStr) {
  const styles = {};
  if (!styleStr) return styles;
  for (const decl of styleStr.split(";")) {
    const colon = decl.indexOf(":");
    if (colon < 0) continue;
    const prop = decl.slice(0, colon).trim().toLowerCase();
    const val = decl.slice(colon + 1).trim();
    if (prop && val) styles[prop] = val;
  }
  return styles;
}

function parseStyleBlock(css) {
  const rules = new Map();
  if (!css) return rules;
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const ruleRegex = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = ruleRegex.exec(css)) !== null) {
    const selectors = m[1].trim().split(",").map(s => s.trim());
    const styles = parseInlineStyle(m[2]);
    for (const sel of selectors) {
      const existing = rules.get(sel) || {};
      rules.set(sel, { ...existing, ...styles });
    }
  }
  return rules;
}

// ── Tailwind CSS class → inline style resolver ────────────────────────────────

const TW_COLORS = {
  "slate-50":"#f8fafc","slate-100":"#f1f5f9","slate-200":"#e2e8f0","slate-300":"#cbd5e1","slate-400":"#94a3b8","slate-500":"#64748b","slate-600":"#475569","slate-700":"#334155","slate-800":"#1e293b","slate-900":"#0f172a","slate-950":"#020617",
  "gray-50":"#f9fafb","gray-100":"#f3f4f6","gray-200":"#e5e7eb","gray-300":"#d1d5db","gray-400":"#9ca3af","gray-500":"#6b7280","gray-600":"#4b5563","gray-700":"#374151","gray-800":"#1f2937","gray-900":"#111827","gray-950":"#030712",
  "zinc-50":"#fafafa","zinc-100":"#f4f4f5","zinc-200":"#e4e4e7","zinc-300":"#d4d4d8","zinc-400":"#a1a1aa","zinc-500":"#71717a","zinc-600":"#52525b","zinc-700":"#3f3f46","zinc-800":"#27272a","zinc-900":"#18181b","zinc-950":"#09090b",
  "neutral-50":"#fafafa","neutral-100":"#f5f5f5","neutral-200":"#e5e5e5","neutral-300":"#d4d4d4","neutral-400":"#a3a3a3","neutral-500":"#737373","neutral-600":"#525252","neutral-700":"#404040","neutral-800":"#262626","neutral-900":"#171717","neutral-950":"#0a0a0a",
  "stone-50":"#fafaf9","stone-100":"#f5f5f4","stone-200":"#e7e5e4","stone-300":"#d6d3d1","stone-400":"#a8a29e","stone-500":"#78716c","stone-600":"#57534e","stone-700":"#44403c","stone-800":"#292524","stone-900":"#1c1917","stone-950":"#0c0a09",
  "red-50":"#fef2f2","red-100":"#fee2e2","red-200":"#fecaca","red-300":"#fca5a5","red-400":"#f87171","red-500":"#ef4444","red-600":"#dc2626","red-700":"#b91c1c","red-800":"#991b1b","red-900":"#7f1d1d","red-950":"#450a0a",
  "orange-50":"#fff7ed","orange-100":"#ffedd5","orange-200":"#fed7aa","orange-300":"#fdba74","orange-400":"#fb923c","orange-500":"#f97316","orange-600":"#ea580c","orange-700":"#c2410c","orange-800":"#9a3412","orange-900":"#7c2d12",
  "amber-50":"#fffbeb","amber-100":"#fef3c7","amber-200":"#fde68a","amber-300":"#fcd34d","amber-400":"#fbbf24","amber-500":"#f59e0b","amber-600":"#d97706","amber-700":"#b45309","amber-800":"#92400e","amber-900":"#78350f",
  "yellow-50":"#fefce8","yellow-100":"#fef9c3","yellow-200":"#fef08a","yellow-300":"#fde047","yellow-400":"#facc15","yellow-500":"#eab308","yellow-600":"#ca8a04","yellow-700":"#a16207","yellow-800":"#854d0e","yellow-900":"#713f12",
  "lime-50":"#f7fee7","lime-100":"#ecfccb","lime-200":"#d9f99d","lime-300":"#bef264","lime-400":"#a3e635","lime-500":"#84cc16","lime-600":"#65a30d","lime-700":"#4d7c0f","lime-800":"#3f6212","lime-900":"#365314",
  "green-50":"#f0fdf4","green-100":"#dcfce7","green-200":"#bbf7d0","green-300":"#86efac","green-400":"#4ade80","green-500":"#22c55e","green-600":"#16a34a","green-700":"#15803d","green-800":"#166534","green-900":"#14532d",
  "emerald-50":"#ecfdf5","emerald-100":"#d1fae5","emerald-200":"#a7f3d0","emerald-300":"#6ee7b7","emerald-400":"#34d399","emerald-500":"#10b981","emerald-600":"#059669","emerald-700":"#047857","emerald-800":"#065f46","emerald-900":"#064e3b",
  "teal-50":"#f0fdfa","teal-100":"#ccfbf1","teal-200":"#99f6e4","teal-300":"#5eead4","teal-400":"#2dd4bf","teal-500":"#14b8a6","teal-600":"#0d9488","teal-700":"#0f766e","teal-800":"#115e59","teal-900":"#134e4a",
  "cyan-50":"#ecfeff","cyan-100":"#cffafe","cyan-200":"#a5f3fc","cyan-300":"#67e8f9","cyan-400":"#22d3ee","cyan-500":"#06b6d4","cyan-600":"#0891b2","cyan-700":"#0e7490","cyan-800":"#155e75","cyan-900":"#164e63",
  "sky-50":"#f0f9ff","sky-100":"#e0f2fe","sky-200":"#bae6fd","sky-300":"#7dd3fc","sky-400":"#38bdf8","sky-500":"#0ea5e9","sky-600":"#0284c7","sky-700":"#0369a1","sky-800":"#075985","sky-900":"#0c4a6e",
  "blue-50":"#eff6ff","blue-100":"#dbeafe","blue-200":"#bfdbfe","blue-300":"#93c5fd","blue-400":"#60a5fa","blue-500":"#3b82f6","blue-600":"#2563eb","blue-700":"#1d4ed8","blue-800":"#1e40af","blue-900":"#1e3a8a","blue-950":"#172554",
  "indigo-50":"#eef2ff","indigo-100":"#e0e7ff","indigo-200":"#c7d2fe","indigo-300":"#a5b4fc","indigo-400":"#818cf8","indigo-500":"#6366f1","indigo-600":"#4f46e5","indigo-700":"#4338ca","indigo-800":"#3730a3","indigo-900":"#312e81",
  "violet-50":"#f5f3ff","violet-100":"#ede9fe","violet-200":"#ddd6fe","violet-300":"#c4b5fd","violet-400":"#a78bfa","violet-500":"#8b5cf6","violet-600":"#7c3aed","violet-700":"#6d28d9","violet-800":"#5b21b6","violet-900":"#4c1d95",
  "purple-50":"#faf5ff","purple-100":"#f3e8ff","purple-200":"#e9d5ff","purple-300":"#d8b4fe","purple-400":"#c084fc","purple-500":"#a855f7","purple-600":"#9333ea","purple-700":"#7e22ce","purple-800":"#6b21a8","purple-900":"#581c87",
  "fuchsia-50":"#fdf4ff","fuchsia-100":"#fae8ff","fuchsia-200":"#f5d0fe","fuchsia-300":"#f0abfc","fuchsia-400":"#e879f9","fuchsia-500":"#d946ef","fuchsia-600":"#c026d3","fuchsia-700":"#a21caf","fuchsia-800":"#86198f","fuchsia-900":"#701a75",
  "pink-50":"#fdf2f8","pink-100":"#fce7f3","pink-200":"#fbcfe8","pink-300":"#f9a8d4","pink-400":"#f472b6","pink-500":"#ec4899","pink-600":"#db2777","pink-700":"#be185d","pink-800":"#9d174d","pink-900":"#831843",
  "rose-50":"#fff1f2","rose-100":"#ffe4e6","rose-200":"#fecdd3","rose-300":"#fda4af","rose-400":"#fb7185","rose-500":"#f43f5e","rose-600":"#e11d48","rose-700":"#be123c","rose-800":"#9f1239","rose-900":"#881337",
  "white":"#ffffff","black":"#000000","transparent":"transparent",
};

const TW_SPACING = {
  "0":0,"0.5":2,"1":4,"1.5":6,"2":8,"2.5":10,"3":12,"3.5":14,"4":16,"5":20,"6":24,"7":28,"8":32,"9":36,"10":40,"11":44,"12":48,"14":56,"16":64,"20":80,"24":96,"28":112,"32":128,"36":144,"40":160,"44":176,"48":192,"52":208,"56":224,"60":240,"64":256,"72":288,"80":320,"96":384,
  "px":1,"full":"100%","screen":"100vh",
};

const TW_RADIUS = { "none":0,"sm":2,"":4,"md":6,"lg":8,"xl":12,"2xl":16,"3xl":24,"full":9999 };

const TW_FONT_SIZE = {
  "xs":[12,16],"sm":[14,20],"base":[16,24],"lg":[18,28],"xl":[20,28],"2xl":[24,32],"3xl":[30,36],"4xl":[36,40],"5xl":[48,1],"6xl":[60,1],"7xl":[72,1],"8xl":[96,1],"9xl":[128,1],
};

const TW_FONT_WEIGHT = {
  "thin":100,"extralight":200,"light":300,"normal":400,"medium":500,"semibold":600,"bold":700,"extrabold":800,"black":900,
};

function tailwindToStyles(classes) {
  const styles = {};
  if (!classes) return styles;
  const list = classes.split(/\s+/).filter(Boolean);

  for (const cls of list) {
    const base = cls.includes(":") ? cls.split(":").pop() : cls;

    if (base === "flex") { styles.display = "flex"; continue; }
    if (base === "inline-flex") { styles.display = "inline-flex"; continue; }
    if (base === "grid") { styles.display = "grid"; continue; }
    if (base === "block") { styles.display = "block"; continue; }
    if (base === "inline-block") { styles.display = "inline-block"; continue; }
    if (base === "hidden") { styles.display = "none"; continue; }

    if (base === "flex-row") { styles["flex-direction"] = "row"; continue; }
    if (base === "flex-col") { styles["flex-direction"] = "column"; continue; }
    if (base === "flex-row-reverse") { styles["flex-direction"] = "row-reverse"; continue; }
    if (base === "flex-col-reverse") { styles["flex-direction"] = "column-reverse"; continue; }
    if (base === "flex-wrap") { styles["flex-wrap"] = "wrap"; continue; }
    if (base === "flex-1") { styles.flex = "1 1 0%"; continue; }
    if (base === "flex-auto") { styles.flex = "1 1 auto"; continue; }
    if (base === "flex-none") { styles.flex = "none"; continue; }
    if (base === "flex-grow" || base === "grow") { styles["flex-grow"] = "1"; continue; }
    if (base === "flex-shrink-0" || base === "shrink-0") { styles["flex-shrink"] = "0"; continue; }

    if (base === "justify-center") { styles["justify-content"] = "center"; continue; }
    if (base === "justify-between") { styles["justify-content"] = "space-between"; continue; }
    if (base === "justify-around") { styles["justify-content"] = "space-around"; continue; }
    if (base === "justify-evenly") { styles["justify-content"] = "space-evenly"; continue; }
    if (base === "justify-start") { styles["justify-content"] = "flex-start"; continue; }
    if (base === "justify-end") { styles["justify-content"] = "flex-end"; continue; }
    if (base === "items-center") { styles["align-items"] = "center"; continue; }
    if (base === "items-start") { styles["align-items"] = "flex-start"; continue; }
    if (base === "items-end") { styles["align-items"] = "flex-end"; continue; }
    if (base === "items-stretch") { styles["align-items"] = "stretch"; continue; }
    if (base === "items-baseline") { styles["align-items"] = "baseline"; continue; }
    if (base === "self-center") { styles["align-self"] = "center"; continue; }
    if (base === "self-start") { styles["align-self"] = "flex-start"; continue; }
    if (base === "self-end") { styles["align-self"] = "flex-end"; continue; }

    let gapMatch = base.match(/^gap-(\[.*?\]|[\w.]+)$/);
    if (gapMatch) { styles.gap = resolveTwSpacing(gapMatch[1]); continue; }
    gapMatch = base.match(/^gap-x-([\w.]+)$/);
    if (gapMatch) { styles["column-gap"] = resolveTwSpacing(gapMatch[1]); continue; }
    gapMatch = base.match(/^gap-y-([\w.]+)$/);
    if (gapMatch) { styles["row-gap"] = resolveTwSpacing(gapMatch[1]); continue; }

    let whMatch = base.match(/^w-(\[.*?\]|[\w./]+)$/);
    if (whMatch) { styles.width = resolveTwDimension(whMatch[1]); continue; }
    whMatch = base.match(/^h-(\[.*?\]|[\w./]+)$/);
    if (whMatch) { styles.height = resolveTwDimension(whMatch[1]); continue; }
    whMatch = base.match(/^min-h-(\[.*?\]|[\w./]+)$/);
    if (whMatch) { styles["min-height"] = resolveTwDimension(whMatch[1]); continue; }
    whMatch = base.match(/^max-w-(\[.*?\]|[\w]+)$/);
    if (whMatch) { styles["max-width"] = resolveTwMaxWidth(whMatch[1]); continue; }
    if (base === "w-full") { styles.width = "100%"; continue; }
    if (base === "h-full") { styles.height = "100%"; continue; }
    if (base === "min-h-screen") { styles["min-height"] = "100vh"; continue; }
    if (base === "h-screen") { styles.height = "100vh"; continue; }
    if (base === "w-screen") { styles.width = "100vw"; continue; }

    let padMatch = base.match(/^p-(\[.*?\]|[\w.]+)$/);
    if (padMatch) { const v = resolveTwSpacing(padMatch[1]); styles.padding = v; continue; }
    padMatch = base.match(/^px-(\[.*?\]|[\w.]+)$/);
    if (padMatch) { const v = resolveTwSpacing(padMatch[1]); styles["padding-left"] = v; styles["padding-right"] = v; continue; }
    padMatch = base.match(/^py-(\[.*?\]|[\w.]+)$/);
    if (padMatch) { const v = resolveTwSpacing(padMatch[1]); styles["padding-top"] = v; styles["padding-bottom"] = v; continue; }
    padMatch = base.match(/^pt-(\[.*?\]|[\w.]+)$/);
    if (padMatch) { styles["padding-top"] = resolveTwSpacing(padMatch[1]); continue; }
    padMatch = base.match(/^pr-(\[.*?\]|[\w.]+)$/);
    if (padMatch) { styles["padding-right"] = resolveTwSpacing(padMatch[1]); continue; }
    padMatch = base.match(/^pb-(\[.*?\]|[\w.]+)$/);
    if (padMatch) { styles["padding-bottom"] = resolveTwSpacing(padMatch[1]); continue; }
    padMatch = base.match(/^pl-(\[.*?\]|[\w.]+)$/);
    if (padMatch) { styles["padding-left"] = resolveTwSpacing(padMatch[1]); continue; }

    let mrgMatch = base.match(/^m([trblxy]?)-(\[.*?\]|[\w.]+)$/);
    if (mrgMatch) {
      const v = resolveTwSpacing(mrgMatch[2]);
      const side = mrgMatch[1];
      if (!side) styles.margin = v;
      else if (side === "t") styles["margin-top"] = v;
      else if (side === "r") styles["margin-right"] = v;
      else if (side === "b") styles["margin-bottom"] = v;
      else if (side === "l") styles["margin-left"] = v;
      else if (side === "x") { styles["margin-left"] = v; styles["margin-right"] = v; }
      else if (side === "y") { styles["margin-top"] = v; styles["margin-bottom"] = v; }
      continue;
    }
    if (base === "mx-auto") { styles["margin-left"] = "auto"; styles["margin-right"] = "auto"; continue; }

    let bgMatch = base.match(/^bg-([\w]+-\d+|white|black|transparent)$/);
    if (bgMatch) { const hex = TW_COLORS[bgMatch[1]]; if (hex) styles["background-color"] = hex; continue; }
    bgMatch = base.match(/^bg-\[(#[0-9a-fA-F]{3,8})\]$/);
    if (bgMatch) { styles["background-color"] = bgMatch[1]; continue; }

    let tcMatch = base.match(/^text-([\w]+-\d+|white|black)$/);
    if (tcMatch) { const hex = TW_COLORS[tcMatch[1]]; if (hex) styles.color = hex; continue; }
    tcMatch = base.match(/^text-\[(#[0-9a-fA-F]{3,8})\]$/);
    if (tcMatch) { styles.color = tcMatch[1]; continue; }

    let fsMatch = base.match(/^text-(xs|sm|base|lg|xl|[2-9]xl)$/);
    if (fsMatch) { const pair = TW_FONT_SIZE[fsMatch[1]]; if (pair) { styles["font-size"] = pair[0] + "px"; styles["line-height"] = pair[1] + "px"; } continue; }
    fsMatch = base.match(/^text-\[(\d+(?:px|rem))\]$/);
    if (fsMatch) { styles["font-size"] = fsMatch[1]; continue; }

    let fwMatch = base.match(/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/);
    if (fwMatch) { styles["font-weight"] = String(TW_FONT_WEIGHT[fwMatch[1]]); continue; }

    if (base === "text-center") { styles["text-align"] = "center"; continue; }
    if (base === "text-right") { styles["text-align"] = "right"; continue; }
    if (base === "text-left") { styles["text-align"] = "left"; continue; }

    let brMatch = base.match(/^rounded(?:-(none|sm|md|lg|xl|2xl|3xl|full))?$/);
    if (brMatch) { styles["border-radius"] = (TW_RADIUS[brMatch[1] || ""] || 4) + "px"; continue; }
    brMatch = base.match(/^rounded-\[(\d+(?:px|rem))\]$/);
    if (brMatch) { styles["border-radius"] = brMatch[1]; continue; }

    if (base === "border") { styles.border = "1px solid #e5e7eb"; continue; }
    let borderMatch = base.match(/^border-(\d+)$/);
    if (borderMatch) { styles.border = borderMatch[1] + "px solid #e5e7eb"; continue; }
    borderMatch = base.match(/^border-([\w]+-\d+)$/);
    if (borderMatch) { const hex = TW_COLORS[borderMatch[1]]; if (hex) styles["border-color"] = hex; continue; }

    if (base === "shadow") { styles["box-shadow"] = "0 1px 3px rgba(0,0,0,0.1)"; continue; }
    if (base === "shadow-sm") { styles["box-shadow"] = "0 1px 2px rgba(0,0,0,0.05)"; continue; }
    if (base === "shadow-md") { styles["box-shadow"] = "0 4px 6px rgba(0,0,0,0.1)"; continue; }
    if (base === "shadow-lg") { styles["box-shadow"] = "0 10px 15px rgba(0,0,0,0.1)"; continue; }
    if (base === "shadow-xl") { styles["box-shadow"] = "0 20px 25px rgba(0,0,0,0.1)"; continue; }
    if (base === "shadow-none") { styles["box-shadow"] = "none"; continue; }

    let opMatch = base.match(/^opacity-(\d+)$/);
    if (opMatch) { styles.opacity = String(parseInt(opMatch[1]) / 100); continue; }

    if (base === "overflow-hidden") { styles.overflow = "hidden"; continue; }
    if (base === "overflow-auto") { styles.overflow = "auto"; continue; }

    if (base === "relative") { styles.position = "relative"; continue; }
    if (base === "absolute") { styles.position = "absolute"; continue; }

    let lhMatch = base.match(/^leading-(tight|snug|normal|relaxed|loose|\d+)$/);
    if (lhMatch) { const lhMap = { tight: "1.25", snug: "1.375", normal: "1.5", relaxed: "1.625", loose: "2" }; styles["line-height"] = lhMap[lhMatch[1]] || lhMatch[1]; continue; }

    if (base === "tracking-tight") { styles["letter-spacing"] = "-0.025em"; continue; }
    if (base === "tracking-wide") { styles["letter-spacing"] = "0.025em"; continue; }

    if (base === "uppercase") { styles["text-transform"] = "uppercase"; continue; }
    if (base === "lowercase") { styles["text-transform"] = "lowercase"; continue; }
    if (base === "capitalize") { styles["text-transform"] = "capitalize"; continue; }
    if (base === "truncate") { styles.overflow = "hidden"; styles["text-overflow"] = "ellipsis"; styles["white-space"] = "nowrap"; continue; }
  }

  return styles;
}

function resolveTwSpacing(val) {
  if (val.startsWith("[") && val.endsWith("]")) return val.slice(1, -1);
  const px = TW_SPACING[val];
  if (typeof px === "number") return px + "px";
  if (typeof px === "string") return px;
  const num = parseFloat(val);
  if (!isNaN(num)) return (num * 4) + "px";
  return "0px";
}

function resolveTwDimension(val) {
  if (val.startsWith("[") && val.endsWith("]")) return val.slice(1, -1);
  if (val === "full") return "100%";
  if (val === "screen") return "100vh";
  if (val === "auto") return "auto";
  const fracMatch = val.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) return ((parseInt(fracMatch[1]) / parseInt(fracMatch[2])) * 100).toFixed(4) + "%";
  return resolveTwSpacing(val);
}

function resolveTwMaxWidth(val) {
  const map = { sm:"384px", md:"448px", lg:"512px", xl:"576px", "2xl":"672px", "3xl":"768px", "4xl":"896px", "5xl":"1024px", "6xl":"1152px", "7xl":"1280px", full:"100%", screen:"100vw" };
  return map[val] || resolveTwSpacing(val);
}

function parseDimension(val) {
  if (!val || val === "auto" || val === "none") return null;
  const num = parseFloat(val);
  if (isNaN(num)) return null;
  if (val.includes("rem")) return num * 16;
  if (val.includes("em")) return num * 16;
  if (val.includes("%")) return null; // percentage not a fixed px
  return num;
}

function parseBoxShorthand(val) {
  if (!val) return { top: 0, right: 0, bottom: 0, left: 0 };
  const parts = val.split(/\s+/).map(parseDimension).map(v => v || 0);
  if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
}

function parseBorder(val) {
  if (!val || val === "none" || val === "0") return null;
  const parts = val.split(/\s+/);
  const width = parseDimension(parts[0]) || 1;
  const color = parseColor(parts[2] || parts[1]) || { r: 0, g: 0, b: 0, a: 1 };
  return { width, color };
}

// ── DOM helpers ─────────────────────────────────────────────────────────────────

const TEXT_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "span", "label", "a", "strong", "em", "b", "i", "li", "td", "th", "caption", "figcaption", "small", "code", "pre"]);
const FRAME_TAGS = new Set(["div", "section", "article", "main", "header", "footer", "nav", "aside", "form", "ul", "ol", "table", "tr", "thead", "tbody", "fieldset", "details", "summary"]);
const SKIP_TAGS = new Set(["script", "style", "link", "meta", "head", "noscript", "template"]);
const HEADING_SIZES = { h1: 32, h2: 28, h3: 24, h4: 20, h5: 18, h6: 16 };

function getTextContent(node) {
  if (node.type === "text") return node.data || "";
  if (!node.children) return "";
  return node.children.map(getTextContent).join("").trim();
}

function resolveStyles(node, cssRules) {
  let merged = {};
  if (node.name && cssRules.has(node.name)) merged = { ...merged, ...cssRules.get(node.name) };
  const classStr = node.attribs?.class || "";
  merged = { ...merged, ...tailwindToStyles(classStr) };
  const classes = classStr.split(/\s+/).filter(Boolean);
  for (const cls of classes) {
    if (cssRules.has(`.${cls}`)) merged = { ...merged, ...cssRules.get(`.${cls}`) };
  }
  const id = node.attribs?.id;
  if (id && cssRules.has(`#${id}`)) merged = { ...merged, ...cssRules.get(`#${id}`) };
  merged = { ...merged, ...parseInlineStyle(node.attribs?.style) };
  return merged;
}

function escStr(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "");
}

// ── Code generator ──────────────────────────────────────────────────────────────

/**
 * State object passed through the recursive code generation.
 */
function createCodeGenState() {
  return {
    frameCounter: 0,
    textCounter: 0,
    lines: [],
    fontsNeeded: new Set(),
  };
}

/**
 * Determine the Figma font style name from CSS font-weight.
 */
function fontStyleFromWeight(weight) {
  const w = parseInt(weight) || 400;
  if (w >= 800) return "Bold";
  if (w >= 600) return "Semi Bold";
  if (w >= 500) return "Medium";
  return "Regular";
}

/**
 * Compute layoutSizing for a child based on parent's layoutMode.
 */
function computeSizing(styles, parentLayoutMode, tag) {
  let hSizing = "HUG";
  let vSizing = "HUG";

  if (parentLayoutMode === "VERTICAL") {
    hSizing = "FILL";
    vSizing = "HUG";
  } else if (parentLayoutMode === "HORIZONTAL") {
    hSizing = "HUG";
    vSizing = "FILL";
    // flex-1 / flex-grow → FILL horizontally too
    if (styles.flex === "1 1 0%" || styles["flex-grow"] === "1") {
      hSizing = "FILL";
    }
  }

  // w-full in any parent → FILL
  if (styles.width === "100%") hSizing = "FILL";
  if (styles.height === "100%") vSizing = "FILL";

  // Explicit fixed dimensions → FIXED
  const w = parseDimension(styles.width);
  const h = parseDimension(styles.height);
  if (w && styles.width !== "100%") hSizing = "FIXED";
  if (h && styles.height !== "100%" && styles.height !== "100vh") vSizing = "FIXED";

  return { hSizing, vSizing, fixedW: w, fixedH: h };
}

/**
 * Generate Figma Plugin API code for a text node.
 */
function genTextCode(state, text, styles, parentVar, parentLayoutMode, tag) {
  if (!text) return;

  const varName = `t${state.textCounter++}`;
  const fontSize = parseDimension(styles["font-size"]) || HEADING_SIZES[tag] || 14;
  const fontWeight = styles["font-weight"];
  const isHeading = tag && tag.startsWith("h") && HEADING_SIZES[tag];
  const isBold = fontWeight === "bold" || parseInt(fontWeight) >= 600 || isHeading || tag === "strong" || tag === "b";
  const color = parseColor(styles.color) || { r: 0, g: 0, b: 0, a: 1 };
  const textAlign = styles["text-align"] || "left";

  const fontStyle = isBold ? "Bold" : (parseInt(fontWeight) >= 500 ? "Medium" : "Regular");
  state.fontsNeeded.add(fontStyle);

  const textTransform = styles["text-transform"];
  let displayText = text;
  if (textTransform === "uppercase") displayText = text.toUpperCase();
  else if (textTransform === "lowercase") displayText = text.toLowerCase();

  // Sizing: text in vertical parent → FILL/HUG, in horizontal → HUG/HUG
  let hSizing = parentLayoutMode === "VERTICAL" ? "FILL" : "HUG";
  let vSizing = "HUG";

  state.lines.push(`const ${varName} = figma.createText();`);
  state.lines.push(`${parentVar}.appendChild(${varName});`);
  state.lines.push(`${varName}.fontName = {family:"Inter",style:"${fontStyle}"};`);
  state.lines.push(`${varName}.characters = "${escStr(displayText)}";`);
  state.lines.push(`${varName}.fontSize = ${fontSize};`);
  state.lines.push(`${varName}.fills = [{type:"SOLID",color:${colorToFigma(color)}}];`);

  const alignMap = { center: "CENTER", right: "RIGHT", left: "LEFT" };
  if (textAlign !== "left") {
    state.lines.push(`${varName}.textAlignHorizontal = "${alignMap[textAlign] || "LEFT"}";`);
  }

  state.lines.push(`${varName}.layoutSizingHorizontal = "${hSizing}";`);
  state.lines.push(`${varName}.layoutSizingVertical = "${vSizing}";`);
}

/**
 * Recursively generate Figma code for a DOM node.
 */
function domToCode(node, cssRules, state, parentVar, parentLayoutMode) {
  if (!node) return;
  if (node.type === "text") {
    const txt = (node.data || "").trim();
    if (txt) genTextCode(state, txt, {}, parentVar, parentLayoutMode, "span");
    return;
  }
  if (SKIP_TAGS.has(node.name)) return;

  const tag = (node.name || "").toLowerCase();
  const styles = resolveStyles(node, cssRules);
  const children = (node.children || []).filter(c =>
    c.type === "tag" || (c.type === "text" && (c.data || "").trim())
  );

  // Skip hidden elements
  if (styles.display === "none") return;

  // ── IMG / SVG → rectangle placeholder ──
  if (tag === "img" || tag === "svg" || tag === "video") {
    const varName = `f${state.frameCounter++}`;
    const w = parseDimension(styles.width) || parseDimension(node.attribs?.width) || 200;
    const h = parseDimension(styles.height) || parseDimension(node.attribs?.height) || 150;
    const bg = parseColor(styles["background-color"]) || { r: 0.9, g: 0.9, b: 0.9, a: 1 };
    const radius = parseDimension(styles["border-radius"]) || 0;
    const alt = node.attribs?.alt || "image";

    state.lines.push(`const ${varName} = figma.createFrame();`);
    state.lines.push(`${parentVar}.appendChild(${varName});`);
    state.lines.push(`${varName}.name = "${escStr(alt.slice(0, 40))}";`);
    state.lines.push(`${varName}.resize(${w}, ${h});`);
    state.lines.push(`${varName}.fills = [{type:"SOLID",color:${colorToFigma(bg)}}];`);
    if (radius) state.lines.push(`${varName}.cornerRadius = ${radius};`);

    // Sizing based on parent
    if (parentLayoutMode === "VERTICAL") {
      state.lines.push(`${varName}.layoutSizingHorizontal = "FILL";`);
      state.lines.push(`${varName}.layoutSizingVertical = "FIXED";`);
    } else {
      state.lines.push(`${varName}.layoutSizingHorizontal = "FIXED";`);
      state.lines.push(`${varName}.layoutSizingVertical = "FIXED";`);
    }
    return;
  }

  // ── INPUT / TEXTAREA / SELECT ──
  if (tag === "input" || tag === "textarea" || tag === "select") {
    const varName = `f${state.frameCounter++}`;
    const placeholder = node.attribs?.placeholder || node.attribs?.value || tag;
    const h = tag === "textarea" ? (parseDimension(styles.height) || 80) : 48;
    const bg = parseColor(styles["background-color"]) || { r: 1, g: 1, b: 1, a: 1 };
    const border = parseBorder(styles.border);
    const radius = parseDimension(styles["border-radius"]) || 8;

    state.lines.push(`const ${varName} = figma.createFrame();`);
    state.lines.push(`${parentVar}.appendChild(${varName});`);
    state.lines.push(`${varName}.name = "${escStr(node.attribs?.name || tag)}";`);
    state.lines.push(`${varName}.layoutMode = "HORIZONTAL";`);
    state.lines.push(`${varName}.layoutSizingHorizontal = "FILL";`);
    state.lines.push(`${varName}.layoutSizingVertical = "FIXED";`);
    state.lines.push(`${varName}.resize(200, ${h});`);
    state.lines.push(`${varName}.counterAxisAlignItems = "CENTER";`);
    state.lines.push(`${varName}.paddingLeft = 16; ${varName}.paddingRight = 16;`);
    state.lines.push(`${varName}.paddingTop = 8; ${varName}.paddingBottom = 8;`);
    state.lines.push(`${varName}.cornerRadius = ${radius};`);
    state.lines.push(`${varName}.fills = [{type:"SOLID",color:${colorToFigma(bg)}}];`);
    if (border) {
      state.lines.push(`${varName}.strokes = [{type:"SOLID",color:${colorToFigma(border.color)}}];`);
      state.lines.push(`${varName}.strokeWeight = ${border.width};`);
    } else {
      state.lines.push(`${varName}.strokes = [{type:"SOLID",color:{r:0.82,g:0.82,b:0.82}}];`);
      state.lines.push(`${varName}.strokeWeight = 1;`);
    }

    // Placeholder text
    state.fontsNeeded.add("Regular");
    genTextCode(state, placeholder, { color: "#9CA3AF", "font-size": "16px" }, varName, "HORIZONTAL", "span");
    return;
  }

  // ── BUTTON ──
  if (tag === "button" || (tag === "a" && (styles.display === "inline-block" || styles.display === "inline-flex"))) {
    const varName = `f${state.frameCounter++}`;
    const text = getTextContent(node) || "Button";
    const bg = parseColor(styles["background-color"]) || { r: 0.2, g: 0.4, b: 1, a: 1 };
    const color = parseColor(styles.color) || { r: 1, g: 1, b: 1, a: 1 };
    const radius = parseDimension(styles["border-radius"]) || 8;
    const padding = parseBoxShorthand(styles.padding);
    const fontSize = parseDimension(styles["font-size"]) || 16;
    const border = parseBorder(styles.border);

    // Determine if full-width button
    const isFullWidth = styles.width === "100%" || (parentLayoutMode === "VERTICAL" && styles.width === "100%");
    const hSizing = isFullWidth ? "FILL" : "HUG";

    state.lines.push(`const ${varName} = figma.createFrame();`);
    state.lines.push(`${parentVar}.appendChild(${varName});`);
    state.lines.push(`${varName}.name = "${escStr(text.slice(0, 30))}";`);
    state.lines.push(`${varName}.layoutMode = "HORIZONTAL";`);
    state.lines.push(`${varName}.layoutSizingHorizontal = "${hSizing}";`);
    state.lines.push(`${varName}.layoutSizingVertical = "HUG";`);
    state.lines.push(`${varName}.primaryAxisAlignItems = "CENTER";`);
    state.lines.push(`${varName}.counterAxisAlignItems = "CENTER";`);
    state.lines.push(`${varName}.paddingLeft = ${padding.left || 24}; ${varName}.paddingRight = ${padding.right || 24};`);
    state.lines.push(`${varName}.paddingTop = ${padding.top || 12}; ${varName}.paddingBottom = ${padding.bottom || 12};`);
    state.lines.push(`${varName}.cornerRadius = ${radius};`);
    state.lines.push(`${varName}.fills = [{type:"SOLID",color:${colorToFigma(bg)}}];`);
    if (border) {
      state.lines.push(`${varName}.strokes = [{type:"SOLID",color:${colorToFigma(border.color)}}];`);
      state.lines.push(`${varName}.strokeWeight = ${border.width};`);
    }

    const fontWeight = styles["font-weight"];
    const isBold = fontWeight === "bold" || parseInt(fontWeight) >= 600;
    genTextCode(state, text, {
      color: rgbaToHex(color),
      "font-size": fontSize + "px",
      "font-weight": isBold ? "600" : "500",
    }, varName, "HORIZONTAL", "span");
    return;
  }

  // ── HR → divider line ──
  if (tag === "hr") {
    const varName = `f${state.frameCounter++}`;
    const divColor = parseColor(styles["border-color"]) || { r: 0.9, g: 0.9, b: 0.9, a: 1 };
    state.lines.push(`const ${varName} = figma.createFrame();`);
    state.lines.push(`${parentVar}.appendChild(${varName});`);
    state.lines.push(`${varName}.name = "Divider";`);
    state.lines.push(`${varName}.resize(100, 1);`);
    state.lines.push(`${varName}.layoutSizingHorizontal = "FILL";`);
    state.lines.push(`${varName}.layoutSizingVertical = "FIXED";`);
    state.lines.push(`${varName}.fills = [{type:"SOLID",color:${colorToFigma(divColor)}}];`);
    return;
  }

  // ── Pure text leaf ──
  if (TEXT_TAGS.has(tag) && !children.some(c => c.type === "tag" && FRAME_TAGS.has(c.name))) {
    const text = getTextContent(node);
    if (text) genTextCode(state, text, styles, parentVar, parentLayoutMode, tag);
    return;
  }

  // ── Container frame (div, section, nav, etc.) ──
  if (FRAME_TAGS.has(tag) || (tag && children.length > 0)) {
    const varName = `f${state.frameCounter++}`;

    const display = styles.display || "";
    const flexDir = styles["flex-direction"] || "";
    const isRow = display.includes("flex") && (flexDir === "row" || flexDir === "row-reverse" || !flexDir);
    const isCol = display.includes("flex") && (flexDir === "column" || flexDir === "column-reverse");

    let layoutMode = "VERTICAL";
    if (isRow) layoutMode = "HORIZONTAL";
    if (isCol) layoutMode = "VERTICAL";

    const gap = parseDimension(styles.gap) || parseDimension(styles["row-gap"]) || 0;
    const padding = parseBoxShorthand(styles.padding);
    // Merge individual padding properties (from Tailwind px-*, py-*, etc.)
    if (styles["padding-top"]) padding.top = parseDimension(styles["padding-top"]) || padding.top;
    if (styles["padding-bottom"]) padding.bottom = parseDimension(styles["padding-bottom"]) || padding.bottom;
    if (styles["padding-left"]) padding.left = parseDimension(styles["padding-left"]) || padding.left;
    if (styles["padding-right"]) padding.right = parseDimension(styles["padding-right"]) || padding.right;

    const bg = parseColor(styles["background-color"]);
    const border = parseBorder(styles.border);
    const radius = parseDimension(styles["border-radius"]) || 0;
    const overflow = styles.overflow;

    // Alignment
    const justifyContent = styles["justify-content"] || "";
    const alignItems = styles["align-items"] || "";

    let primaryAlign = "MIN";
    if (justifyContent === "center") primaryAlign = "CENTER";
    if (justifyContent === "flex-end" || justifyContent === "end") primaryAlign = "MAX";
    if (justifyContent === "space-between") primaryAlign = "SPACE_BETWEEN";

    let counterAlign = "MIN";
    if (alignItems === "center") counterAlign = "CENTER";
    if (alignItems === "flex-end" || alignItems === "end") counterAlign = "MAX";
    if (alignItems === "stretch") counterAlign = "MIN"; // stretch is default in Figma when children are FILL

    // Sizing based on parent layout
    const { hSizing, vSizing, fixedW, fixedH } = computeSizing(styles, parentLayoutMode, tag);

    // Name
    const name = node.attribs?.["aria-label"]
      || node.attribs?.id
      || (node.attribs?.class || "").split(/\s+/).filter(c => !c.includes(":") && c.length > 1)[0]
      || tag;

    // Generate code
    state.lines.push(`const ${varName} = figma.createFrame();`);
    state.lines.push(`${parentVar}.appendChild(${varName});`);
    state.lines.push(`${varName}.name = "${escStr(name.slice(0, 40))}";`);

    // layoutMode FIRST (before padding/spacing)
    state.lines.push(`${varName}.layoutMode = "${layoutMode}";`);

    // Sizing — AFTER appendChild
    state.lines.push(`${varName}.layoutSizingHorizontal = "${hSizing}";`);
    state.lines.push(`${varName}.layoutSizingVertical = "${vSizing}";`);

    // For FIXED sizing, set explicit dimensions
    if (hSizing === "FIXED" && fixedW) {
      state.lines.push(`${varName}.resize(${fixedW}, ${fixedH || 100});`);
    } else if (vSizing === "FIXED" && fixedH) {
      state.lines.push(`${varName}.resize(${fixedW || 100}, ${fixedH});`);
    }

    // Padding
    if (padding.top || padding.bottom || padding.left || padding.right) {
      state.lines.push(`${varName}.paddingTop = ${padding.top}; ${varName}.paddingBottom = ${padding.bottom};`);
      state.lines.push(`${varName}.paddingLeft = ${padding.left}; ${varName}.paddingRight = ${padding.right};`);
    }

    // Spacing
    if (gap) state.lines.push(`${varName}.itemSpacing = ${gap};`);

    // Alignment
    if (primaryAlign !== "MIN") state.lines.push(`${varName}.primaryAxisAlignItems = "${primaryAlign}";`);
    if (counterAlign !== "MIN") state.lines.push(`${varName}.counterAxisAlignItems = "${counterAlign}";`);

    // Visual properties
    if (bg) {
      state.lines.push(`${varName}.fills = [{type:"SOLID",color:${colorToFigma(bg)}}];`);
    } else {
      // Structural wrapper — transparent (no white fill)
      state.lines.push(`${varName}.fills = [];`);
    }

    if (radius) state.lines.push(`${varName}.cornerRadius = ${radius};`);

    if (border) {
      state.lines.push(`${varName}.strokes = [{type:"SOLID",color:${colorToFigma(border.color)}}];`);
      state.lines.push(`${varName}.strokeWeight = ${border.width};`);
    }

    if (overflow === "hidden") state.lines.push(`${varName}.clipsContent = true;`);

    // Shadow
    if (styles["box-shadow"] && styles["box-shadow"] !== "none") {
      const shadowMatch = styles["box-shadow"].match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rgba?\(([^)]+)\)/);
      if (shadowMatch) {
        const sx = parseFloat(shadowMatch[1]) || 0;
        const sy = parseFloat(shadowMatch[2]) || 0;
        const sr = parseFloat(shadowMatch[3]) || 4;
        const parts = shadowMatch[4].split(",").map(s => s.trim());
        const a = parts.length >= 4 ? parseFloat(parts[3]) : 0.1;
        state.lines.push(`${varName}.effects = [{type:"DROP_SHADOW",color:{r:0,g:0,b:0,a:${a}},offset:{x:${sx},y:${sy}},radius:${sr},spread:0,visible:true}];`);
      }
    }

    // Recurse into children
    for (const child of children) {
      if (child.type === "text") {
        const txt = (child.data || "").trim();
        if (txt) genTextCode(state, txt, {}, varName, layoutMode, "span");
      } else if (child.type === "tag") {
        domToCode(child, cssRules, state, varName, layoutMode);
      }
    }
    return;
  }

  // Fallback: text content
  const fallbackText = getTextContent(node);
  if (fallbackText) genTextCode(state, fallbackText, styles, parentVar, parentLayoutMode, tag);
}

// ── Main entry point ───────────────────────────────────────────────────────────

/**
 * Convert HTML + CSS strings into a single Figma Plugin API execute code string.
 *
 * @param {string} html — HTML output from Stitch
 * @param {string} css — Optional external CSS
 * @param {string} screenName — Name for the root frame
 * @param {string} deviceType — "MOBILE" or "DESKTOP"
 * @returns {{ code: string, commandCount: number }}
 */
function htmlToFigmaExecuteCode(html, css, screenName, deviceType) {
  // Parse embedded <style> blocks
  const styleBlocks = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(html)) !== null) {
    styleBlocks.push(styleMatch[1]);
  }

  const allCss = [css, ...styleBlocks].filter(Boolean).join("\n");
  const cssRules = parseStyleBlock(allCss);

  // Parse HTML DOM
  const doc = parseDocument(html);

  // Find <body> or first meaningful container
  let root = null;
  function findBody(node) {
    if (node.name === "body") { root = node; return; }
    if (node.children) node.children.forEach(findBody);
  }
  findBody(doc);

  if (!root) {
    root = { type: "tag", name: "div", attribs: {}, children: doc.children || [] };
  }

  // Get body children (skip script/style/meta)
  const bodyChildren = (root.children || []).filter(c =>
    (c.type === "tag" && !SKIP_TAGS.has(c.name)) || (c.type === "text" && (c.data || "").trim())
  );

  // Screen dimensions
  const isMobile = deviceType === "MOBILE";
  const screenW = isMobile ? 390 : 1440;
  const screenH = isMobile ? 844 : 900;

  // Root frame styles (from <body> or its single child)
  const rootStyles = resolveStyles(root, cssRules);
  let rootBg = parseColor(rootStyles["background-color"]) || { r: 1, g: 1, b: 1, a: 1 };

  // Single-child optimization: if body has one container child, merge its styles into root
  let effectiveChildren = bodyChildren;
  let rootLayoutMode = "VERTICAL";
  let rootGap = 0;
  let rootPadding = { top: 0, right: 0, bottom: 0, left: 0 };
  let rootPrimaryAlign = "MIN";
  let rootCounterAlign = "MIN";

  if (bodyChildren.length === 1 && bodyChildren[0].type === "tag" && FRAME_TAGS.has(bodyChildren[0].name)) {
    const singleChild = bodyChildren[0];
    const childStyles = resolveStyles(singleChild, cssRules);

    // Merge child's layout properties into root
    const display = childStyles.display || "";
    const flexDir = childStyles["flex-direction"] || "";
    if (display.includes("flex") && (flexDir === "row" || flexDir === "row-reverse")) {
      rootLayoutMode = "HORIZONTAL";
    }

    rootGap = parseDimension(childStyles.gap) || 0;
    rootPadding = parseBoxShorthand(childStyles.padding);
    if (childStyles["padding-top"]) rootPadding.top = parseDimension(childStyles["padding-top"]) || rootPadding.top;
    if (childStyles["padding-bottom"]) rootPadding.bottom = parseDimension(childStyles["padding-bottom"]) || rootPadding.bottom;
    if (childStyles["padding-left"]) rootPadding.left = parseDimension(childStyles["padding-left"]) || rootPadding.left;
    if (childStyles["padding-right"]) rootPadding.right = parseDimension(childStyles["padding-right"]) || rootPadding.right;

    const childBg = parseColor(childStyles["background-color"]);
    if (childBg) rootBg = childBg;

    const jc = childStyles["justify-content"] || "";
    if (jc === "center") rootPrimaryAlign = "CENTER";
    if (jc === "space-between") rootPrimaryAlign = "SPACE_BETWEEN";
    if (jc === "flex-end") rootPrimaryAlign = "MAX";

    const ai = childStyles["align-items"] || "";
    if (ai === "center") rootCounterAlign = "CENTER";
    if (ai === "flex-end") rootCounterAlign = "MAX";

    // Use the single child's children as effective children
    effectiveChildren = (singleChild.children || []).filter(c =>
      (c.type === "tag" && !SKIP_TAGS.has(c.name)) || (c.type === "text" && (c.data || "").trim())
    );
  }

  // Initialize code generation state
  const state = createCodeGenState();
  const rootVar = `f${state.frameCounter++}`;

  // Root frame code
  state.lines.push(`// Root screen frame`);
  state.lines.push(`const ${rootVar} = figma.createFrame();`);
  state.lines.push(`${rootVar}.name = "${escStr((screenName || "Stitch Screen").slice(0, 50))}";`);
  state.lines.push(`${rootVar}.resize(${screenW}, ${screenH});`);
  state.lines.push(`${rootVar}.layoutMode = "${rootLayoutMode}";`);
  state.lines.push(`${rootVar}.layoutSizingHorizontal = "FIXED";`);
  state.lines.push(`${rootVar}.layoutSizingVertical = "FIXED";`);
  state.lines.push(`${rootVar}.primaryAxisSizingMode = "FIXED";`);
  state.lines.push(`${rootVar}.counterAxisSizingMode = "FIXED";`);

  if (rootPadding.top || rootPadding.bottom || rootPadding.left || rootPadding.right) {
    state.lines.push(`${rootVar}.paddingTop = ${rootPadding.top}; ${rootVar}.paddingBottom = ${rootPadding.bottom};`);
    state.lines.push(`${rootVar}.paddingLeft = ${rootPadding.left}; ${rootVar}.paddingRight = ${rootPadding.right};`);
  }

  if (rootGap) state.lines.push(`${rootVar}.itemSpacing = ${rootGap};`);
  if (rootPrimaryAlign !== "MIN") state.lines.push(`${rootVar}.primaryAxisAlignItems = "${rootPrimaryAlign}";`);
  if (rootCounterAlign !== "MIN") state.lines.push(`${rootVar}.counterAxisAlignItems = "${rootCounterAlign}";`);

  state.lines.push(`${rootVar}.fills = [{type:"SOLID",color:${colorToFigma(rootBg)}}];`);

  // Generate code for all children
  for (const child of effectiveChildren) {
    if (child.type === "text") {
      const txt = (child.data || "").trim();
      if (txt) genTextCode(state, txt, {}, rootVar, rootLayoutMode, "span");
    } else if (child.type === "tag") {
      domToCode(child, cssRules, state, rootVar, rootLayoutMode);
    }
  }

  // Build final code with font loading at top
  const fontLines = [];
  if (state.fontsNeeded.size > 0) {
    const fontLoads = [...state.fontsNeeded].map(style =>
      `figma.loadFontAsync({family:"Inter",style:"${style}"})`
    );
    fontLines.push(`await Promise.all([${fontLoads.join(",")}]);`);
    fontLines.push("");
  }

  // Navigate to the created frame
  state.lines.push("");
  state.lines.push(`figma.currentPage.selection = [${rootVar}];`);
  state.lines.push(`figma.viewport.scrollAndZoomIntoView([${rootVar}]);`);
  state.lines.push(`return {id: ${rootVar}.id, name: ${rootVar}.name};`);

  const code = [...fontLines, ...state.lines].join("\n");

  return {
    code,
    commandCount: state.frameCounter + state.textCounter,
  };
}

// Legacy export for backward compatibility
function htmlToFigmaCommands(html, css, screenName) {
  const result = htmlToFigmaExecuteCode(html, css, screenName, "DESKTOP");
  return [{ method: "execute", params: { code: result.code } }];
}

module.exports = { htmlToFigmaCommands, htmlToFigmaExecuteCode, parseColor, rgbaToHex, parseInlineStyle, parseDimension };
