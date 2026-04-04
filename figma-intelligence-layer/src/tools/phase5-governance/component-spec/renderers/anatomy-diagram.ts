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
  markerX: number;    // dot placed ON the element
  markerY: number;    // dot placed ON the element
  targetX: number;    // kept for backward compat (same as markerX)
  targetY: number;    // kept for backward compat (same as markerY)
  name: string;
  role: string;
}

const MARKER_RADIUS = 10;
const DOT_D = MARKER_RADIUS * 2;
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
 * Compute marker positions ON each element (EightShapes-style).
 * Dots are placed at the top-left corner of each element.
 * Elements are sorted spatially (top-to-bottom, left-to-right).
 * Basic collision avoidance shifts overlapping dots to element center.
 */
export function computeMarkerPositions(
  compW: number,
  compH: number,
  cloneOffsetX: number,
  cloneOffsetY: number,
  elements: ClassifiedElement[],
): MarkerData[] {
  const diagramElements = getDiagramElements(elements);

  // Sort spatially: top-to-bottom, then left-to-right
  const sorted = [...diagramElements].sort((a, b) => {
    const ay = a.position.y, by = b.position.y;
    if (Math.abs(ay - by) > 10) return ay - by;
    return a.position.x - b.position.x;
  });

  const markers: MarkerData[] = [];

  for (let i = 0; i < Math.min(sorted.length, 26); i++) {
    const el = sorted[i];
    // Place dot at top-left corner of element
    let dotX = cloneOffsetX + el.position.x + MARKER_RADIUS;
    let dotY = cloneOffsetY + el.position.y + MARKER_RADIUS;

    // For very small elements, place at center
    if (el.position.w < DOT_D * 2 || el.position.h < DOT_D * 2) {
      dotX = cloneOffsetX + el.position.x + el.position.w / 2;
      dotY = cloneOffsetY + el.position.y + el.position.h / 2;
    }

    markers.push({
      letter: LETTERS[i],
      markerX: dotX,
      markerY: dotY,
      targetX: dotX,
      targetY: dotY,
      name: el.name,
      role: el.role,
    });
  }

  // Collision avoidance: if two dots overlap, shift the second to element center
  for (let i = 1; i < markers.length; i++) {
    for (let j = 0; j < i; j++) {
      const dx = markers[i].markerX - markers[j].markerX;
      const dy = markers[i].markerY - markers[j].markerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < DOT_D * 1.3) {
        const el = sorted[i];
        markers[i].markerX = cloneOffsetX + el.position.x + el.position.w / 2;
        markers[i].markerY = cloneOffsetY + el.position.y + el.position.h / 2;
        markers[i].targetX = markers[i].markerX;
        markers[i].targetY = markers[i].markerY;
        break;
      }
    }
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

        // Marker dot ON the element
        var circle = figma.createEllipse();
        circle.resize(MARKER_D, MARKER_D);
        circle.x = m.markerX - MARKER_D / 2;
        circle.y = m.markerY - MARKER_D / 2;
        circle.fills = [{ type: "SOLID", color: markerColor }];
        circle.name = "Marker " + m.letter;
        diagram.appendChild(circle);

        // Letter label centered on dot
        var label = figma.createText();
        label.fontName = resolvedFont("Bold");
        label.fontSize = 11;
        label.characters = m.letter;
        label.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        label.textAutoResize = "WIDTH_AND_HEIGHT";
        diagram.appendChild(label);
        label.x = m.markerX - label.width / 2;
        label.y = m.markerY - label.height / 2;
        label.name = "Label " + m.letter;

        // Thin leader line from dot to legend area
        var legendLeftX = ${cloneX + Math.round(displayW) + 40};
        var connector = figma.createVector();
        var pathData = "M " + (m.markerX + MARKER_D/2) + " " + m.markerY + " L " + legendLeftX + " " + m.markerY;
        connector.vectorPaths = [{ windingRule: "NONZERO", data: pathData }];
        connector.strokes = [{ type: "SOLID", color: markerColor }];
        connector.strokeWeight = 0.5;
        connector.fills = [];
        connector.dashPattern = [3, 3];
        connector.opacity = 0.4;
        diagram.appendChild(connector);
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
      legend.itemSpacing = 0;
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
        // Separator line between entries (not before first)
        if (j > 0) {
          var sep = figma.createFrame();
          sep.name = "Separator";
          sep.resize(4, 1);
          sep.fills = [{ type: "SOLID", color: { r: 0.898, g: 0.906, b: 0.922 } }];
          sep.opacity = 0.6;
          legend.appendChild(sep);
          sep.layoutSizingHorizontal = "FILL";
        }

        var row = figma.createFrame();
        row.name = "Legend " + markers[j].letter;
        row.layoutMode = "HORIZONTAL";
        row.primaryAxisSizingMode = "AUTO";
        row.counterAxisSizingMode = "AUTO";
        row.itemSpacing = 10;
        row.paddingTop = 8;
        row.paddingBottom = 8;
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

        // Element name (bold) + role (muted) as separate text nodes
        var nameCol = figma.createFrame();
        nameCol.name = "Name";
        nameCol.layoutMode = "VERTICAL";
        nameCol.primaryAxisSizingMode = "AUTO";
        nameCol.counterAxisSizingMode = "AUTO";
        nameCol.itemSpacing = 2;
        nameCol.fills = [];
        row.appendChild(nameCol);
        nameCol.layoutSizingHorizontal = "FILL";

        var entryName = figma.createText();
        entryName.fontName = resolvedFont("SemiBold");
        entryName.fontSize = 13;
        entryName.lineHeight = { unit: "PIXELS", value: 18 };
        entryName.characters = markers[j].name;
        entryName.fills = [{ type: "SOLID", color: { r: 0.067, g: 0.094, b: 0.153 } }];
        entryName.textAutoResize = "HEIGHT";
        nameCol.appendChild(entryName);
        entryName.layoutSizingHorizontal = "FILL";

        var roleTxt = roleLabels[markers[j].role] || markers[j].role;
        var entryRole = figma.createText();
        entryRole.fontName = resolvedFont("Regular");
        entryRole.fontSize = 11;
        entryRole.lineHeight = { unit: "PIXELS", value: 16 };
        entryRole.characters = roleTxt;
        entryRole.fills = [{ type: "SOLID", color: { r: 0.42, g: 0.42, b: 0.42 } }];
        entryRole.textAutoResize = "HEIGHT";
        nameCol.appendChild(entryRole);
        entryRole.layoutSizingHorizontal = "FILL";
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
