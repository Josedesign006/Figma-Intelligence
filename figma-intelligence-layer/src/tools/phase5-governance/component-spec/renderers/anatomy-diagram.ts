/**
 * Anatomy Diagram renderer — creates visual markers (A, B, C…)
 * around a cloned component instance with connector lines and a legend.
 *
 * Includes ALL visible elements (content, optional, sub-component, structural)
 * except truly decorative spacers. Deep-scanned elements are positioned using
 * absolute coordinates relative to the component bounds.
 */
import type { AnatomyExtraction, ClassifiedElement } from "../types.js";

// ── Marker positioning logic ───────────────────────────────────────────────

interface MarkerData {
  letter: string;
  markerX: number;
  markerY: number;
  targetX: number;
  targetY: number;
  name: string;
  role: string;
}

const MARKER_RADIUS = 14;
const MARKER_MARGIN = 60;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Filter elements for the diagram — include all visible elements except
 * truly invisible/decorative spacers. This is much more inclusive than before.
 */
function getDiagramElements(elements: ClassifiedElement[]): ClassifiedElement[] {
  return elements.filter(
    (el) =>
      el.visible &&
      el.role !== "decorative" &&
      el.position.w > 0 &&
      el.position.h > 0,
  );
}

/**
 * Compute marker positions around the component.
 * Uses the element's center to determine which edge to place the marker on.
 * Distributes markers evenly along each edge to avoid overlapping.
 */
export function computeMarkerPositions(
  compW: number,
  compH: number,
  cloneOffsetX: number,
  cloneOffsetY: number,
  elements: ClassifiedElement[],
): MarkerData[] {
  const diagramElements = getDiagramElements(elements);
  const markers: MarkerData[] = [];

  // Buckets for each edge
  const edges: {
    top: ClassifiedElement[];
    bottom: ClassifiedElement[];
    left: ClassifiedElement[];
    right: ClassifiedElement[];
  } = { top: [], bottom: [], left: [], right: [] };

  for (const el of diagramElements) {
    if (markers.length + edges.top.length + edges.bottom.length + edges.left.length + edges.right.length >= 26) break;

    const centerX = el.position.x + el.position.w / 2;
    const centerY = el.position.y + el.position.h / 2;
    const relX = compW > 0 ? centerX / compW : 0.5;
    const relY = compH > 0 ? centerY / compH : 0.5;

    // Determine nearest edge using distance to each edge
    const distTop = relY;
    const distBottom = 1 - relY;
    const distLeft = relX;
    const distRight = 1 - relX;
    const minDist = Math.min(distTop, distBottom, distLeft, distRight);

    if (minDist === distTop) {
      edges.top.push(el);
    } else if (minDist === distBottom) {
      edges.bottom.push(el);
    } else if (minDist === distLeft) {
      edges.left.push(el);
    } else {
      edges.right.push(el);
    }
  }

  let letterIdx = 0;

  // Sort each edge bucket by position for consistent ordering
  edges.top.sort((a, b) => a.position.x - b.position.x);
  edges.bottom.sort((a, b) => a.position.x - b.position.x);
  edges.left.sort((a, b) => a.position.y - b.position.y);
  edges.right.sort((a, b) => a.position.y - b.position.y);

  // Top edge markers
  for (let i = 0; i < edges.top.length && letterIdx < 26; i++) {
    const el = edges.top[i];
    const targetX = cloneOffsetX + el.position.x + el.position.w / 2;
    const targetY = cloneOffsetY + el.position.y;
    const spacing = compW / (edges.top.length + 1);
    markers.push({
      letter: LETTERS[letterIdx++],
      markerX: cloneOffsetX + spacing * (i + 1),
      markerY: cloneOffsetY - MARKER_MARGIN,
      targetX,
      targetY,
      name: el.name,
      role: el.role,
    });
  }

  // Left edge markers
  for (let i = 0; i < edges.left.length && letterIdx < 26; i++) {
    const el = edges.left[i];
    const targetX = cloneOffsetX + el.position.x;
    const targetY = cloneOffsetY + el.position.y + el.position.h / 2;
    const spacing = compH / (edges.left.length + 1);
    markers.push({
      letter: LETTERS[letterIdx++],
      markerX: cloneOffsetX - MARKER_MARGIN,
      markerY: cloneOffsetY + spacing * (i + 1),
      targetX,
      targetY,
      name: el.name,
      role: el.role,
    });
  }

  // Right edge markers
  for (let i = 0; i < edges.right.length && letterIdx < 26; i++) {
    const el = edges.right[i];
    const targetX = cloneOffsetX + el.position.x + el.position.w;
    const targetY = cloneOffsetY + el.position.y + el.position.h / 2;
    const spacing = compH / (edges.right.length + 1);
    markers.push({
      letter: LETTERS[letterIdx++],
      markerX: cloneOffsetX + compW + MARKER_MARGIN,
      markerY: cloneOffsetY + spacing * (i + 1),
      targetX,
      targetY,
      name: el.name,
      role: el.role,
    });
  }

  // Bottom edge markers
  for (let i = 0; i < edges.bottom.length && letterIdx < 26; i++) {
    const el = edges.bottom[i];
    const targetX = cloneOffsetX + el.position.x + el.position.w / 2;
    const targetY = cloneOffsetY + el.position.y + el.position.h;
    const spacing = compW / (edges.bottom.length + 1);
    markers.push({
      letter: LETTERS[letterIdx++],
      markerX: cloneOffsetX + spacing * (i + 1),
      markerY: cloneOffsetY + compH + MARKER_MARGIN,
      targetX,
      targetY,
      name: el.name,
      role: el.role,
    });
  }

  return markers;
}

// ── Helper: format role as a readable label ───────────────────────────────

function roleLabel(role: string): string {
  switch (role) {
    case "content-element": return "Content";
    case "optional-slot": return "Optional";
    case "fixed-sub-component": return "Sub-component";
    case "structural": return "Container";
    case "decorative": return "Decorative";
    default: return role;
  }
}

// ── Bridge rendering ───────────────────────────────────────────────────────

interface FigmaBridge {
  execute(code: string): Promise<{ success: boolean; result?: unknown; error?: string }>;
}

export async function renderAnatomyDiagram(
  bridge: FigmaBridge,
  pageId: string,
  nodeId: string,
  anatomy: AnatomyExtraction,
  yPosition: number,
): Promise<void> {
  const diagramElements = getDiagramElements(anatomy.elements);
  if (diagramElements.length === 0) return;

  const compW = anatomy.componentBounds?.w || 300;
  const compH = anatomy.componentBounds?.h || 100;

  // Scale up component display for small components
  const MIN_DISPLAY = 200;
  const scale = Math.max(1, MIN_DISPLAY / Math.min(compW, compH));
  const displayW = compW * scale;
  const displayH = compH * scale;

  // Layout: component centered with generous margin for markers + legend below
  const PADDING = 120;
  const LEGEND_W = 320;
  const LEGEND_GAP = 60;
  const cloneX = PADDING;
  const cloneY = PADDING;
  const legendEntryH = 30;
  const legendH = 48 + diagramElements.length * legendEntryH;
  const diagramContentW = PADDING + displayW + PADDING + LEGEND_GAP + LEGEND_W + 40;
  const diagramW = Math.max(diagramContentW, 900);
  const diagramH = Math.max(PADDING + displayH + PADDING, legendH + 80, 400);

  const markers = computeMarkerPositions(displayW, displayH, cloneX, cloneY, anatomy.elements.map(el => ({
    ...el,
    position: {
      x: Math.round(el.position.x * scale),
      y: Math.round(el.position.y * scale),
      w: Math.round(el.position.w * scale),
      h: Math.round(el.position.h * scale),
    },
  })));

  // Use a more professional color scheme
  const markerColorStr = "{ r: 0.29, g: 0.20, b: 0.70 }";  // Deep purple #4A33B3
  const markerBgStr = "{ r: 0.29, g: 0.20, b: 0.70 }";

  const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();

      // Font loading with fallback
      var _loadedFonts = {};
      async function loadFontSafe(family, style) {
        var key = family + "-" + style;
        if (_loadedFonts[key]) return _loadedFonts[key];
        try {
          await figma.loadFontAsync({ family: family, style: style });
          _loadedFonts[key] = { family: family, style: style };
        } catch (e) {
          var fallbacks = [
            { family: "Roboto", style: style },
            { family: "Arial", style: style },
            { family: family, style: "Regular" },
            { family: "Roboto", style: "Regular" },
            { family: "Arial", style: "Regular" },
          ];
          for (var fi = 0; fi < fallbacks.length; fi++) {
            try {
              await figma.loadFontAsync(fallbacks[fi]);
              _loadedFonts[key] = fallbacks[fi];
              return _loadedFonts[key];
            } catch (e2) { /* try next */ }
          }
          _loadedFonts[key] = { family: "Inter", style: "Regular" };
        }
        return _loadedFonts[key];
      }
      function resolvedFont(style) {
        var key = "Inter-" + style;
        return _loadedFonts[key] || { family: "Inter", style: "Regular" };
      }

      await loadFontSafe("Inter", "Bold");
      await loadFontSafe("Inter", "SemiBold");
      await loadFontSafe("Inter", "Regular");

      var page = await figma.getNodeByIdAsync(${JSON.stringify(pageId)});
      if (!page || page.type !== "PAGE") return { error: "Page not found" };

      var sourceNode = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!sourceNode) return { error: "Source node not found" };

      // === DIAGRAM CONTAINER ===
      var diagram = figma.createFrame();
      diagram.name = "Anatomy Diagram";
      diagram.layoutMode = "NONE";
      diagram.resize(${diagramW}, ${diagramH});
      diagram.fills = [{ type: "SOLID", color: { r: 0.976, g: 0.976, b: 0.984 } }];
      diagram.cornerRadius = 12;
      diagram.strokes = [{ type: "SOLID", color: { r: 0.898, g: 0.906, b: 0.922 } }];
      diagram.strokeWeight = 1;
      diagram.x = 0;
      diagram.y = ${yPosition};

      // === SECTION TITLE ===
      var title = figma.createText();
      title.fontName = resolvedFont("Bold");
      title.fontSize = 20;
      title.characters = "Anatomy";
      title.fills = [{ type: "SOLID", color: { r: 0.067, g: 0.094, b: 0.153 } }];
      title.textAutoResize = "WIDTH_AND_HEIGHT";
      title.x = 24;
      title.y = 20;
      diagram.appendChild(title);

      // === CLONE THE COMPONENT ===
      var cloneTarget = sourceNode;
      if (sourceNode.type === "COMPONENT_SET" && sourceNode.children.length > 0) {
        cloneTarget = sourceNode.children[0];
      }
      var clone = cloneTarget.clone();
      clone.x = ${cloneX};
      clone.y = ${cloneY};
      ${scale > 1 ? `clone.rescale(${scale});` : ""}
      diagram.appendChild(clone);

      // === MARKERS ===
      var markers = ${JSON.stringify(markers)};
      var MARKER_D = ${MARKER_RADIUS * 2};
      var markerColor = ${markerColorStr};

      for (var i = 0; i < markers.length; i++) {
        var m = markers[i];

        // Connector line
        var connector = figma.createVector();
        var pathData = "M " + m.markerX + " " + m.markerY + " L " + m.targetX + " " + m.targetY;
        connector.vectorPaths = [{ windingRule: "NONZERO", data: pathData }];
        connector.strokes = [{ type: "SOLID", color: markerColor }];
        connector.strokeWeight = 1.5;
        connector.fills = [];
        connector.strokeCap = "ROUND";
        connector.opacity = 0.7;
        diagram.appendChild(connector);

        // Marker circle
        var circle = figma.createEllipse();
        circle.resize(MARKER_D, MARKER_D);
        circle.x = m.markerX - MARKER_D / 2;
        circle.y = m.markerY - MARKER_D / 2;
        circle.fills = [{ type: "SOLID", color: markerColor }];
        circle.name = "Marker " + m.letter;
        diagram.appendChild(circle);

        // Letter label
        var label = figma.createText();
        label.fontName = resolvedFont("Bold");
        label.fontSize = 12;
        label.characters = m.letter;
        label.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        label.textAutoResize = "WIDTH_AND_HEIGHT";
        diagram.appendChild(label);
        label.x = m.markerX - label.width / 2;
        label.y = m.markerY - label.height / 2;
        label.name = "Label " + m.letter;
      }

      // === LEGEND ===
      var legendX = ${cloneX + Math.round(displayW) + PADDING + LEGEND_GAP};
      var legendY = ${cloneY};

      var legend = figma.createFrame();
      legend.name = "Anatomy Key";
      legend.layoutMode = "VERTICAL";
      legend.primaryAxisSizingMode = "AUTO";
      legend.counterAxisSizingMode = "FIXED";
      legend.resize(${LEGEND_W}, 10);
      legend.itemSpacing = 4;
      legend.paddingTop = 20;
      legend.paddingBottom = 20;
      legend.paddingLeft = 20;
      legend.paddingRight = 20;
      legend.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      legend.cornerRadius = 8;
      legend.strokes = [{ type: "SOLID", color: { r: 0.898, g: 0.906, b: 0.922 } }];
      legend.strokeWeight = 1;
      legend.x = legendX;
      legend.y = legendY;

      // Legend title
      var legendTitle = figma.createText();
      legendTitle.fontName = resolvedFont("SemiBold");
      legendTitle.fontSize = 15;
      legendTitle.characters = "Anatomy Key";
      legendTitle.fills = [{ type: "SOLID", color: { r: 0.067, g: 0.094, b: 0.153 } }];
      legendTitle.textAutoResize = "WIDTH_AND_HEIGHT";
      legend.appendChild(legendTitle);

      // Spacer after title
      var lsp = figma.createFrame();
      lsp.resize(4, 8); lsp.fills = [];
      legend.appendChild(lsp);
      lsp.layoutSizingHorizontal = "FILL";

      // Legend entries
      var roleLabels = ${JSON.stringify(Object.fromEntries(
        ["content-element", "optional-slot", "fixed-sub-component", "structural", "decorative"]
          .map(r => [r, roleLabel(r)])
      ))};

      for (var j = 0; j < markers.length; j++) {
        var row = figma.createFrame();
        row.name = "Legend " + markers[j].letter;
        row.layoutMode = "HORIZONTAL";
        row.primaryAxisSizingMode = "AUTO";
        row.counterAxisSizingMode = "AUTO";
        row.itemSpacing = 10;
        row.fills = [];
        row.counterAxisAlignItems = "CENTER";
        legend.appendChild(row);
        row.layoutSizingHorizontal = "FILL";

        // Small marker circle
        var dot = figma.createEllipse();
        dot.resize(20, 20);
        dot.fills = [{ type: "SOLID", color: markerColor }];

        var dotLabel = figma.createText();
        dotLabel.fontName = resolvedFont("Bold");
        dotLabel.fontSize = 11;
        dotLabel.characters = markers[j].letter;
        dotLabel.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        dotLabel.textAutoResize = "WIDTH_AND_HEIGHT";

        // Wrap dot + label for centering
        var dotWrap = figma.createFrame();
        dotWrap.name = "Dot";
        dotWrap.layoutMode = "NONE";
        dotWrap.resize(20, 20);
        dotWrap.fills = [];
        dotWrap.appendChild(dot);
        dot.x = 0; dot.y = 0;
        dotWrap.appendChild(dotLabel);
        dotLabel.x = 10 - dotLabel.width / 2;
        dotLabel.y = 10 - dotLabel.height / 2;
        row.appendChild(dotWrap);

        // Element name + role
        var roleTxt = roleLabels[markers[j].role] || markers[j].role;
        var entryText = figma.createText();
        entryText.fontName = resolvedFont("Regular");
        entryText.fontSize = 13;
        entryText.lineHeight = { unit: "PIXELS", value: 20 };
        entryText.characters = markers[j].name + "  \\u2014  " + roleTxt;
        entryText.fills = [{ type: "SOLID", color: { r: 0.20, g: 0.20, b: 0.25 } }];
        entryText.textAutoResize = "HEIGHT";
        row.appendChild(entryText);
        entryText.layoutSizingHorizontal = "FILL";
      }

      diagram.appendChild(legend);
      page.appendChild(diagram);

      return { diagramId: diagram.id };
    })();
  `);

  if (!result.success) {
    console.error(`Anatomy diagram rendering failed: ${result.error}`);
  }
}
