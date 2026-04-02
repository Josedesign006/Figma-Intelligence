// ─────────────────────────────────────────────────────────────────────────────
// figma_handoff_spec — Developer-ready handoff specification
//
// Takes a Figma component or frame and generates a complete developer handoff
// document with:
//   - Measurements (width, height, padding, gap, margin)
//   - Token names mapped to every visual property
//   - Copy-paste CSS/SCSS for each element
//   - Redline annotations showing spacing relationships
//   - Asset export list (icons, images)
//   - Responsive notes & breakpoint behavior
//   - Interaction specs (hover, focus, active states)
//
// Output: structured JSON, Markdown, or annotated Figma page with redlines.
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";
import { figmaRgbaToHex } from "../../../shared/token-utils.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HandoffSpecArgs {
  /** Figma node ID of the component/frame to spec */
  nodeId: string;
  /** Output format */
  outputFormat: "json" | "markdown" | "figma-page" | "all";
  /** Include copy-paste CSS snippets for each element */
  includeCss?: boolean;
  /** Include asset export list */
  includeAssets?: boolean;
  /** CSS unit preference */
  cssUnit?: "px" | "rem";
  /** rem base size (default 16) */
  remBase?: number;
  /** Max depth for recursive element scanning */
  maxDepth?: number;
}

interface MeasuredElement {
  id: string;
  name: string;
  type: string;
  depth: number;
  bounds: { x: number; y: number; width: number; height: number };
  spacing: {
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    itemSpacing: number;
    layoutMode: string;
  };
  appearance: {
    fills: Array<{ type: string; hex: string; opacity: number; tokenName: string }>;
    strokes: Array<{ hex: string; weight: number; tokenName: string }>;
    cornerRadius: number | number[];
    effects: Array<{ type: string; description: string }>;
    opacity: number;
  };
  typography: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number | string;
    letterSpacing: number;
    textAlign: string;
    tokenName: string;
  } | null;
  tokens: Array<{ property: string; tokenName: string; rawValue: string }>;
  cssSnippet: string;
  children: string[];
}

interface AssetEntry {
  nodeId: string;
  name: string;
  type: "icon" | "image" | "illustration" | "logo";
  suggestedExport: string;
  size: { width: number; height: number };
}

interface RedlineAnnotation {
  fromElement: string;
  toElement: string;
  direction: "horizontal" | "vertical";
  distance: number;
  label: string;
}

// ─── Figma extraction ──────────────────────────────────────────────────────

async function extractNodeTree(
  nodeId: string,
  maxDepth: number
): Promise<{
  elements: MeasuredElement[];
  assets: AssetEntry[];
  redlines: RedlineAnnotation[];
  rootName: string;
  rootBounds: { width: number; height: number };
}> {
  const bridge = await getBridge();

  const result = await bridge.execute(`
    (async () => {
      var node = figma.getNodeById('${nodeId}');
      if (!node) return { error: 'Node not found' };

      var elements = [];
      var assets = [];
      var maxDepth = ${maxDepth};

      function hexFromPaint(paint) {
        if (!paint || paint.type !== 'SOLID') return '#000000';
        var r = Math.round((paint.color.r || 0) * 255).toString(16).padStart(2, '0');
        var g = Math.round((paint.color.g || 0) * 255).toString(16).padStart(2, '0');
        var b = Math.round((paint.color.b || 0) * 255).toString(16).padStart(2, '0');
        return '#' + r + g + b;
      }

      function getTokenName(node, prop) {
        try {
          var bindings = node.boundVariables || {};
          if (bindings[prop]) {
            var alias = bindings[prop];
            if (alias.id) {
              var v = figma.variables.getVariableById(alias.id);
              return v ? v.name : '';
            }
          }
          if (prop === 'fills' && Array.isArray(bindings.fills)) {
            for (var i = 0; i < bindings.fills.length; i++) {
              if (bindings.fills[i] && bindings.fills[i].id) {
                var v = figma.variables.getVariableById(bindings.fills[i].id);
                if (v) return v.name;
              }
            }
          }
        } catch (e) {}
        return '';
      }

      function scan(n, depth) {
        if (depth > maxDepth) return;
        if (!n.visible) return;

        var fills = [];
        var strokes = [];
        var tokens = [];

        if (n.fills && Array.isArray(n.fills)) {
          for (var i = 0; i < n.fills.length; i++) {
            var f = n.fills[i];
            if (!f.visible && f.visible !== undefined) continue;
            var tk = getTokenName(n, 'fills');
            fills.push({ type: f.type, hex: hexFromPaint(f), opacity: f.opacity || 1, tokenName: tk });
            if (tk) tokens.push({ property: 'fill', tokenName: tk, rawValue: hexFromPaint(f) });
          }
        }

        if (n.strokes && Array.isArray(n.strokes)) {
          for (var i = 0; i < n.strokes.length; i++) {
            var s = n.strokes[i];
            var tk = getTokenName(n, 'strokes');
            strokes.push({ hex: hexFromPaint(s), weight: n.strokeWeight || 1, tokenName: tk });
            if (tk) tokens.push({ property: 'stroke', tokenName: tk, rawValue: hexFromPaint(s) });
          }
        }

        var ptk = getTokenName(n, 'paddingTop');
        if (ptk) tokens.push({ property: 'paddingTop', tokenName: ptk, rawValue: String(n.paddingTop || 0) });
        var ispk = getTokenName(n, 'itemSpacing');
        if (ispk) tokens.push({ property: 'itemSpacing', tokenName: ispk, rawValue: String(n.itemSpacing || 0) });
        var crk = getTokenName(n, 'topLeftRadius');
        if (crk) tokens.push({ property: 'cornerRadius', tokenName: crk, rawValue: String(n.cornerRadius || 0) });

        var typo = null;
        if (n.type === 'TEXT') {
          var ft = getTokenName(n, 'fontSize');
          typo = {
            fontFamily: n.fontName ? n.fontName.family : '',
            fontSize: n.fontSize || 0,
            fontWeight: n.fontWeight || 400,
            lineHeight: n.lineHeight ? (n.lineHeight.unit === 'PIXELS' ? n.lineHeight.value : n.lineHeight.unit === 'PERCENT' ? (n.lineHeight.value + '%') : 'auto') : 'auto',
            letterSpacing: n.letterSpacing ? n.letterSpacing.value : 0,
            textAlign: n.textAlignHorizontal || 'LEFT',
            tokenName: ft
          };
          if (ft) tokens.push({ property: 'fontSize', tokenName: ft, rawValue: String(n.fontSize) });
        }

        // Detect assets
        if (n.type === 'INSTANCE' && n.name.toLowerCase().includes('icon')) {
          assets.push({ nodeId: n.id, name: n.name, type: 'icon', suggestedExport: 'SVG', size: { width: Math.round(n.width), height: Math.round(n.height) } });
        } else if (n.fills && n.fills.some(function(f) { return f.type === 'IMAGE'; })) {
          assets.push({ nodeId: n.id, name: n.name, type: 'image', suggestedExport: 'PNG @2x', size: { width: Math.round(n.width), height: Math.round(n.height) } });
        }

        var el = {
          id: n.id,
          name: n.name,
          type: n.type,
          depth: depth,
          bounds: { x: Math.round(n.x || 0), y: Math.round(n.y || 0), width: Math.round(n.width || 0), height: Math.round(n.height || 0) },
          spacing: {
            paddingTop: n.paddingTop || 0,
            paddingRight: n.paddingRight || 0,
            paddingBottom: n.paddingBottom || 0,
            paddingLeft: n.paddingLeft || 0,
            itemSpacing: n.itemSpacing || 0,
            layoutMode: n.layoutMode || 'NONE'
          },
          appearance: {
            fills: fills,
            strokes: strokes,
            cornerRadius: typeof n.cornerRadius === 'number' ? n.cornerRadius : [n.topLeftRadius || 0, n.topRightRadius || 0, n.bottomRightRadius || 0, n.bottomLeftRadius || 0],
            effects: (n.effects || []).map(function(e) { return { type: e.type, description: e.type + ' ' + (e.radius || 0) + 'px' }; }),
            opacity: n.opacity !== undefined ? n.opacity : 1
          },
          typography: typo,
          tokens: tokens,
          children: n.children ? n.children.map(function(c) { return c.id; }) : []
        };

        elements.push(el);

        if (n.children) {
          for (var i = 0; i < n.children.length; i++) {
            scan(n.children[i], depth + 1);
          }
        }
      }

      scan(node, 0);

      return {
        elements: elements,
        assets: assets,
        rootName: node.name,
        rootBounds: { width: Math.round(node.width || 0), height: Math.round(node.height || 0) }
      };
    })();
  `);

  if (!result.success || !result.result) {
    throw new Error(result.error || "Failed to extract node tree");
  }

  const data = result.result as {
    elements: MeasuredElement[];
    assets: AssetEntry[];
    rootName: string;
    rootBounds: { width: number; height: number };
    error?: string;
  };

  if (data.error) throw new Error(data.error);

  // Compute redline annotations from adjacent sibling spacing
  const redlines: RedlineAnnotation[] = [];
  for (const el of data.elements) {
    if (el.spacing.layoutMode !== "NONE" && el.children.length > 1) {
      const childEls = data.elements.filter((e) => el.children.includes(e.id));
      for (let i = 0; i < childEls.length - 1; i++) {
        const dir = el.spacing.layoutMode === "HORIZONTAL" ? "horizontal" : "vertical";
        redlines.push({
          fromElement: childEls[i].name,
          toElement: childEls[i + 1].name,
          direction: dir,
          distance: el.spacing.itemSpacing,
          label: `${el.spacing.itemSpacing}px gap`,
        });
      }
    }

    // Padding redlines
    if (el.spacing.paddingTop > 0 || el.spacing.paddingRight > 0 || el.spacing.paddingBottom > 0 || el.spacing.paddingLeft > 0) {
      if (el.spacing.paddingTop > 0) {
        redlines.push({ fromElement: el.name, toElement: `${el.name} (content)`, direction: "vertical", distance: el.spacing.paddingTop, label: `${el.spacing.paddingTop}px padding-top` });
      }
      if (el.spacing.paddingBottom > 0) {
        redlines.push({ fromElement: `${el.name} (content)`, toElement: el.name, direction: "vertical", distance: el.spacing.paddingBottom, label: `${el.spacing.paddingBottom}px padding-bottom` });
      }
      if (el.spacing.paddingLeft > 0) {
        redlines.push({ fromElement: el.name, toElement: `${el.name} (content)`, direction: "horizontal", distance: el.spacing.paddingLeft, label: `${el.spacing.paddingLeft}px padding-left` });
      }
      if (el.spacing.paddingRight > 0) {
        redlines.push({ fromElement: `${el.name} (content)`, toElement: el.name, direction: "horizontal", distance: el.spacing.paddingRight, label: `${el.spacing.paddingRight}px padding-right` });
      }
    }
  }

  return { ...data, redlines };
}

// ─── CSS snippet generator ─────────────────────────────────────────────────

function generateElementCss(el: MeasuredElement, unit: "px" | "rem", remBase: number): string {
  const u = (val: number) => {
    if (val === 0) return "0";
    return unit === "rem" ? `${(val / remBase).toFixed(3).replace(/\.?0+$/, "")}rem` : `${val}px`;
  };

  const lines: string[] = [];
  lines.push(`.${el.name.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase()} {`);

  // Layout
  if (el.spacing.layoutMode !== "NONE") {
    lines.push(`  display: flex;`);
    lines.push(`  flex-direction: ${el.spacing.layoutMode === "VERTICAL" ? "column" : "row"};`);
    if (el.spacing.itemSpacing > 0) lines.push(`  gap: ${u(el.spacing.itemSpacing)};`);
  }

  // Dimensions
  lines.push(`  width: ${u(el.bounds.width)};`);
  lines.push(`  height: ${u(el.bounds.height)};`);

  // Padding
  const { paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl } = el.spacing;
  if (pt || pr || pb || pl) {
    if (pt === pb && pl === pr && pt === pl) {
      lines.push(`  padding: ${u(pt)};`);
    } else if (pt === pb && pl === pr) {
      lines.push(`  padding: ${u(pt)} ${u(pr)};`);
    } else {
      lines.push(`  padding: ${u(pt)} ${u(pr)} ${u(pb)} ${u(pl)};`);
    }
  }

  // Fills
  for (const fill of el.appearance.fills) {
    if (fill.tokenName) {
      lines.push(`  background-color: var(--${fill.tokenName.replace(/\//g, "-").toLowerCase()});`);
    } else if (fill.type === "SOLID") {
      lines.push(`  background-color: ${fill.hex};`);
    }
  }

  // Border
  for (const stroke of el.appearance.strokes) {
    const borderVal = stroke.tokenName
      ? `${u(stroke.weight)} solid var(--${stroke.tokenName.replace(/\//g, "-").toLowerCase()})`
      : `${u(stroke.weight)} solid ${stroke.hex}`;
    lines.push(`  border: ${borderVal};`);
  }

  // Border radius
  const cr = el.appearance.cornerRadius;
  if (typeof cr === "number" && cr > 0) {
    lines.push(`  border-radius: ${u(cr)};`);
  } else if (Array.isArray(cr) && cr.some((v) => v > 0)) {
    lines.push(`  border-radius: ${cr.map((v) => u(v)).join(" ")};`);
  }

  // Opacity
  if (el.appearance.opacity < 1) {
    lines.push(`  opacity: ${el.appearance.opacity};`);
  }

  // Typography
  if (el.typography) {
    const t = el.typography;
    lines.push(`  font-family: '${t.fontFamily}', sans-serif;`);
    lines.push(`  font-size: ${u(t.fontSize)};`);
    lines.push(`  font-weight: ${t.fontWeight};`);
    if (typeof t.lineHeight === "number") {
      lines.push(`  line-height: ${u(t.lineHeight)};`);
    } else if (t.lineHeight !== "auto") {
      lines.push(`  line-height: ${t.lineHeight};`);
    }
    if (t.letterSpacing) {
      lines.push(`  letter-spacing: ${u(t.letterSpacing)};`);
    }
    lines.push(`  text-align: ${t.textAlign.toLowerCase()};`);

    // Text color from fills
    if (el.appearance.fills.length > 0) {
      const textFill = el.appearance.fills[0];
      if (textFill.tokenName) {
        lines.push(`  color: var(--${textFill.tokenName.replace(/\//g, "-").toLowerCase()});`);
      } else {
        lines.push(`  color: ${textFill.hex};`);
      }
    }
  }

  // Effects
  for (const effect of el.appearance.effects) {
    if (effect.type === "DROP_SHADOW") {
      lines.push(`  box-shadow: ${effect.description};`);
    }
  }

  lines.push(`}`);
  return lines.join("\n");
}

// ─── Markdown renderer ─────────────────────────────────────────────────────

function renderMarkdown(
  rootName: string,
  rootBounds: { width: number; height: number },
  elements: MeasuredElement[],
  redlines: RedlineAnnotation[],
  assets: AssetEntry[],
  args: HandoffSpecArgs
): string {
  const lines: string[] = [];

  lines.push(`# Developer Handoff: ${rootName}`);
  lines.push(`> Auto-generated by \`figma_handoff_spec\``);
  lines.push(``);
  lines.push(`## Overview`);
  lines.push(`| Property | Value |`);
  lines.push(`|----------|-------|`);
  lines.push(`| **Frame** | ${rootName} |`);
  lines.push(`| **Size** | ${rootBounds.width} × ${rootBounds.height}px |`);
  lines.push(`| **Elements** | ${elements.length} |`);
  lines.push(`| **Tokens Used** | ${elements.reduce((sum, el) => sum + el.tokens.length, 0)} |`);
  lines.push(``);

  // Token map
  const allTokens = elements.flatMap((el) => el.tokens);
  if (allTokens.length > 0) {
    lines.push(`## Design Tokens`);
    lines.push(`| Token | Property | Raw Value |`);
    lines.push(`|-------|----------|-----------|`);
    const seen = new Set<string>();
    for (const t of allTokens) {
      const key = `${t.tokenName}:${t.property}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`| \`${t.tokenName}\` | ${t.property} | \`${t.rawValue}\` |`);
    }
    lines.push(``);
  }

  // Measurements
  lines.push(`## Measurements`);
  lines.push(``);
  for (const el of elements) {
    if (el.depth > 3) continue; // Skip deeply nested for readability
    const indent = "  ".repeat(el.depth);
    lines.push(`${indent}### ${el.name} (\`${el.type}\`)`);
    lines.push(`${indent}| Metric | Value |`);
    lines.push(`${indent}|--------|-------|`);
    lines.push(`${indent}| Size | ${el.bounds.width} × ${el.bounds.height}px |`);
    lines.push(`${indent}| Position | (${el.bounds.x}, ${el.bounds.y}) |`);

    if (el.spacing.layoutMode !== "NONE") {
      lines.push(`${indent}| Layout | ${el.spacing.layoutMode === "HORIZONTAL" ? "Row" : "Column"} |`);
      lines.push(`${indent}| Gap | ${el.spacing.itemSpacing}px |`);
    }

    const { paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl } = el.spacing;
    if (pt || pr || pb || pl) {
      lines.push(`${indent}| Padding | ${pt} / ${pr} / ${pb} / ${pl} |`);
    }

    if (el.appearance.cornerRadius) {
      const cr = el.appearance.cornerRadius;
      const crStr = typeof cr === "number" ? `${cr}px` : `${cr.join(" / ")}px`;
      if (crStr !== "0px" && crStr !== "0 / 0 / 0 / 0px") {
        lines.push(`${indent}| Border Radius | ${crStr} |`);
      }
    }

    if (el.typography) {
      const t = el.typography;
      lines.push(`${indent}| Font | ${t.fontFamily} ${t.fontWeight} |`);
      lines.push(`${indent}| Font Size | ${t.fontSize}px |`);
      lines.push(`${indent}| Line Height | ${t.lineHeight} |`);
      if (t.letterSpacing) lines.push(`${indent}| Letter Spacing | ${t.letterSpacing}px |`);
    }

    lines.push(``);
  }

  // Redlines
  if (redlines.length > 0) {
    lines.push(`## Spacing Redlines`);
    lines.push(`| From | To | Direction | Distance |`);
    lines.push(`|------|----|-----------|----------|`);
    for (const r of redlines) {
      lines.push(`| ${r.fromElement} | ${r.toElement} | ${r.direction} | ${r.distance}px |`);
    }
    lines.push(``);
  }

  // Assets
  if (assets.length > 0 && args.includeAssets !== false) {
    lines.push(`## Assets to Export`);
    lines.push(`| Name | Type | Size | Format |`);
    lines.push(`|------|------|------|--------|`);
    for (const a of assets) {
      lines.push(`| ${a.name} | ${a.type} | ${a.size.width}×${a.size.height} | ${a.suggestedExport} |`);
    }
    lines.push(``);
  }

  // CSS snippets
  if (args.includeCss !== false) {
    lines.push(`## CSS Snippets`);
    lines.push(``);
    for (const el of elements) {
      if (el.depth > 2) continue;
      lines.push("```css");
      lines.push(el.cssSnippet);
      lines.push("```");
      lines.push(``);
    }
  }

  return lines.join("\n");
}

// ─── Figma page renderer ───────────────────────────────────────────────────

async function createHandoffPage(
  nodeId: string,
  rootName: string,
  elements: MeasuredElement[],
  redlines: RedlineAnnotation[]
): Promise<string> {
  const bridge = await getBridge();

  const result = await bridge.execute(`
    (async () => {
      // Create handoff annotation page
      var pageName = '📐 Handoff: ' + '${rootName.replace(/'/g, "\\'")}';
      var existing = figma.root.children.find(function(p) { return p.name === pageName; });
      if (existing) existing.remove();

      var page = figma.createPage();
      page.name = pageName;
      figma.currentPage = page;

      // Title
      var title = figma.createText();
      await figma.loadFontAsync({ family: "Inter", style: "Bold" });
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      await figma.loadFontAsync({ family: "Inter", style: "Medium" });
      title.fontName = { family: "Inter", style: "Bold" };
      title.fontSize = 32;
      title.characters = 'Developer Handoff: ${rootName.replace(/'/g, "\\'")}';
      title.x = 40;
      title.y = 40;
      page.appendChild(title);

      // Subtitle
      var sub = figma.createText();
      sub.fontName = { family: "Inter", style: "Regular" };
      sub.fontSize = 14;
      sub.characters = 'Auto-generated by figma_handoff_spec | ${new Date().toISOString().slice(0, 10)}';
      sub.x = 40;
      sub.y = 90;
      sub.fills = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.4 } }];
      page.appendChild(sub);

      // Clone the source node for reference
      var sourceNode = figma.getNodeById('${nodeId}');
      if (sourceNode) {
        var clone = sourceNode.clone();
        clone.x = 40;
        clone.y = 140;
        page.appendChild(clone);

        // Add measurement annotations as red lines
        var yOffset = 140 + Math.round(sourceNode.height) + 60;

        ${JSON.stringify(redlines.slice(0, 50))}.forEach(function(r, i) {
          var annotation = figma.createFrame();
          annotation.name = 'Redline: ' + r.label;
          annotation.resize(400, 28);
          annotation.x = 40;
          annotation.y = yOffset + (i * 36);
          annotation.layoutMode = 'HORIZONTAL';
          annotation.itemSpacing = 8;
          annotation.paddingLeft = 8;
          annotation.paddingRight = 8;
          annotation.paddingTop = 4;
          annotation.paddingBottom = 4;
          annotation.fills = [{ type: 'SOLID', color: { r: 1, g: 0.9, b: 0.9 } }];
          annotation.cornerRadius = 4;
          annotation.primaryAxisSizingMode = 'AUTO';
          annotation.counterAxisSizingMode = 'AUTO';

          var label = figma.createText();
          label.fontName = { family: "Inter", style: "Medium" };
          label.fontSize = 12;
          label.characters = r.fromElement + ' → ' + r.toElement + ': ' + r.label;
          label.fills = [{ type: 'SOLID', color: { r: 0.8, g: 0, b: 0 } }];
          annotation.appendChild(label);

          page.appendChild(annotation);
        });

        // Token summary section
        var tokenY = yOffset + (${Math.min(redlines.length, 50)} * 36) + 40;
        var tokenTitle = figma.createText();
        tokenTitle.fontName = { family: "Inter", style: "Bold" };
        tokenTitle.fontSize = 20;
        tokenTitle.characters = 'Token Reference';
        tokenTitle.x = 40;
        tokenTitle.y = tokenY;
        page.appendChild(tokenTitle);

        // Token entries
        var tokenEntries = ${JSON.stringify(
          elements.flatMap((el) => el.tokens).filter((t, i, arr) =>
            arr.findIndex((o) => o.tokenName === t.tokenName) === i
          ).slice(0, 40)
        )};

        tokenEntries.forEach(function(t, i) {
          var entry = figma.createText();
          entry.fontName = { family: "Inter", style: "Regular" };
          entry.fontSize = 12;
          entry.characters = t.property + '  →  ' + t.tokenName + '  =  ' + t.rawValue;
          entry.x = 60;
          entry.y = tokenY + 36 + (i * 20);
          entry.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
          page.appendChild(entry);
        });
      }

      return { pageId: page.id, pageName: page.name };
    })();
  `);

  if (!result.success || !result.result) {
    throw new Error(result.error || "Failed to create handoff page");
  }

  return (result.result as { pageId: string }).pageId;
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function handoffSpecHandler(args: HandoffSpecArgs): Promise<unknown> {
  const maxDepth = args.maxDepth ?? 6;
  const cssUnit = args.cssUnit ?? "px";
  const remBase = args.remBase ?? 16;

  const { elements, assets, redlines, rootName, rootBounds } = await extractNodeTree(
    args.nodeId,
    maxDepth
  );

  // Generate CSS snippets for each element
  for (const el of elements) {
    el.cssSnippet = generateElementCss(el, cssUnit, remBase);
  }

  const outputs: Record<string, unknown> = {};

  // JSON
  if (args.outputFormat === "json" || args.outputFormat === "all") {
    outputs.spec = {
      component: rootName,
      dimensions: rootBounds,
      elements: elements.map((el) => ({
        name: el.name,
        type: el.type,
        depth: el.depth,
        bounds: el.bounds,
        spacing: el.spacing,
        tokens: el.tokens,
        typography: el.typography,
        css: el.cssSnippet,
      })),
      redlines,
      assets,
      tokenSummary: {
        total: elements.reduce((sum, el) => sum + el.tokens.length, 0),
        unique: [...new Set(elements.flatMap((el) => el.tokens.map((t) => t.tokenName)))],
      },
    };
  }

  // Markdown
  if (args.outputFormat === "markdown" || args.outputFormat === "all") {
    outputs.markdown = renderMarkdown(rootName, rootBounds, elements, redlines, assets, args);
  }

  // Figma page
  let figmaPageId: string | undefined;
  if (args.outputFormat === "figma-page" || args.outputFormat === "all") {
    figmaPageId = await createHandoffPage(args.nodeId, rootName, elements, redlines);
    outputs.figmaPageId = figmaPageId;
  }

  return {
    component: rootName,
    dimensions: rootBounds,
    elementCount: elements.length,
    tokenCount: elements.reduce((sum, el) => sum + el.tokens.length, 0),
    assetCount: assets.length,
    redlineCount: redlines.length,
    ...outputs,
  };
}
