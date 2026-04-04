/**
 * Deterministic anatomy extraction — deep scan of component children
 * to classify ALL meaningful elements (icons, labels, helper text, containers, etc.)
 *
 * Performs a BFS scan up to depth 3 to find leaf elements and
 * meaningful intermediate nodes (not just direct children).
 */
import { getBridge } from "../../../../shared/figma-bridge.js";
import type { AnatomyExtraction, ClassifiedElement, ElementRole } from "../types.js";

export async function extractAnatomy(nodeId: string): Promise<AnatomyExtraction> {
  const bridge = await getBridge();
  const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      var node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found");

      // For COMPONENT_SET, use the first (default) variant's children
      var target = node;
      if (node.type === "COMPONENT_SET" && node.children.length > 0) {
        target = node.children[0];
      }

      if (!("children" in target)) return { elements: [], componentBounds: null };

      // Component bounds (absolute)
      var absBounds = target.absoluteBoundingBox;
      var componentBounds = absBounds ? {
        x: Math.round(absBounds.x),
        y: Math.round(absBounds.y),
        w: Math.round(absBounds.width),
        h: Math.round(absBounds.height),
      } : null;

      // Collect boolean properties that control visibility
      var booleanControls = {};
      if ("componentProperties" in node && node.componentProperties) {
        for (var entry of Object.entries(node.componentProperties)) {
          var bName = entry[0];
          var bProp = entry[1];
          if (bProp.type === "BOOLEAN") {
            booleanControls[bName] = bProp;
          }
        }
      }

      // Hex fill extractor
      function extractHexFills(n) {
        if (!n.fills || !Array.isArray(n.fills)) return [];
        var out = [];
        for (var fi = 0; fi < n.fills.length; fi++) {
          var p = n.fills[fi];
          if (p.type === "SOLID" && p.visible !== false && p.color) {
            var r = Math.round(p.color.r * 255);
            var g = Math.round(p.color.g * 255);
            var b = Math.round(p.color.b * 255);
            out.push("#" + [r,g,b].map(function(v){ return v.toString(16).padStart(2,"0"); }).join(""));
          }
        }
        return out;
      }
      // Hex stroke extractor
      function extractHexStrokes(n) {
        if (!n.strokes || !Array.isArray(n.strokes)) return [];
        var out = [];
        for (var si = 0; si < n.strokes.length; si++) {
          var p = n.strokes[si];
          if (p.type === "SOLID" && p.visible !== false && p.color) {
            var r = Math.round(p.color.r * 255);
            var g = Math.round(p.color.g * 255);
            var b = Math.round(p.color.b * 255);
            out.push("#" + [r,g,b].map(function(v){ return v.toString(16).padStart(2,"0"); }).join(""));
          }
        }
        return out;
      }

      // Deep BFS scan up to depth 3, collect all meaningful elements
      var elements = [];
      var queue = [];
      for (var ci = 0; ci < target.children.length && ci < 30; ci++) {
        queue.push({ node: target.children[ci], depth: 1, parentName: target.name });
      }

      var idx = 0;
      while (queue.length > 0 && elements.length < 40) {
        var item = queue.shift();
        var child = item.node;
        var depth = item.depth;

        // Determine if this child is a leaf or a meaningful intermediate node
        var hasChildren = "children" in child && child.children && child.children.length > 0;
        var isLeaf = !hasChildren;
        var childType = child.type;

        // Classify whether to show this node or dig deeper
        var nameLower = (child.name || "").toLowerCase();
        var isGenericWrapper = /^(frame|group|container|wrapper|content|row|column|stack|layout|auto\s*layout)/i.test(nameLower)
          || /^frame\s*\d*$/i.test(nameLower);

        // Include this element if:
        // 1. It's a leaf (TEXT, VECTOR, ELLIPSE, RECTANGLE, LINE, INSTANCE, etc.)
        // 2. It's a named non-generic frame/group (like "Leading icon", "Label container")
        // 3. It's a direct child (depth 1) even if it's a wrapper
        var shouldInclude = isLeaf
          || (hasChildren && !isGenericWrapper)
          || (depth === 1 && !isGenericWrapper);

        // Also include INSTANCE nodes (sub-components) even if they have children
        if (childType === "INSTANCE") shouldInclude = true;

        // Skip invisible zero-size elements
        if (child.width === 0 && child.height === 0) shouldInclude = false;

        if (shouldInclude) {
          // Check boolean control
          var controlledBy = null;
          for (var bEntry of Object.entries(booleanControls)) {
            var cleanBoolName = bEntry[0].replace(/#.*$/, "").trim().toLowerCase();
            var childNameLower = child.name.toLowerCase();
            if (cleanBoolName.includes(childNameLower) || childNameLower.includes(cleanBoolName) ||
                cleanBoolName.replace(/^(show|has|is|with)\s*/i, "") === childNameLower) {
              controlledBy = bEntry[0].replace(/#.*$/, "").trim();
              break;
            }
          }

          // Position relative to the component (use relative position within parent chain)
          var relX = 0, relY = 0;
          if (child.absoluteBoundingBox && componentBounds) {
            relX = Math.round(child.absoluteBoundingBox.x - componentBounds.x);
            relY = Math.round(child.absoluteBoundingBox.y - componentBounds.y);
          } else {
            relX = Math.round(child.x || 0);
            relY = Math.round(child.y || 0);
          }

          var absPos = child.absoluteBoundingBox ? {
            x: Math.round(child.absoluteBoundingBox.x),
            y: Math.round(child.absoluteBoundingBox.y),
            w: Math.round(child.absoluteBoundingBox.width),
            h: Math.round(child.absoluteBoundingBox.height),
          } : null;

          // Rich metadata extraction per node type
          var richData = {};
          if (childType === "TEXT") {
            var fn = (child.fontName && child.fontName !== figma.mixed) ? child.fontName : null;
            var fs = (typeof child.fontSize === "number") ? child.fontSize : 0;
            var lh = (child.lineHeight && child.lineHeight !== figma.mixed && child.lineHeight.unit === "PIXELS") ? child.lineHeight.value : null;
            var ts = null;
            if (child.textStyleId && child.textStyleId !== figma.mixed) {
              try { var sty = figma.getStyleById(child.textStyleId); if (sty) ts = sty.name; } catch(e) {}
            }
            richData.fontFamily = fn ? fn.family : null;
            richData.fontStyle = fn ? fn.style : null;
            richData.fontSize = fs || null;
            richData.lineHeightPx = lh;
            richData.tokenName = ts;
            richData.characters = (child.characters || "").slice(0, 60);
            richData.fills = extractHexFills(child);
          } else if (childType === "INSTANCE") {
            var mainComp = child.mainComponent;
            var compSet = (mainComp && mainComp.parent && mainComp.parent.type === "COMPONENT_SET") ? mainComp.parent : null;
            richData.componentName = compSet ? compSet.name : (mainComp ? mainComp.name : child.name);
            richData.instanceOf = mainComp ? mainComp.name : null;
            richData.variantProperties = child.variantProperties ? JSON.parse(JSON.stringify(child.variantProperties)) : null;
            richData.fills = extractHexFills(child);
          } else if (childType === "FRAME" || childType === "COMPONENT") {
            richData.layoutMode = child.layoutMode || "NONE";
            richData.itemSpacing = child.itemSpacing || 0;
            richData.paddingTop = child.paddingTop || 0;
            richData.paddingRight = child.paddingRight || 0;
            richData.paddingBottom = child.paddingBottom || 0;
            richData.paddingLeft = child.paddingLeft || 0;
            richData.layoutSizingH = child.layoutSizingHorizontal || null;
            richData.layoutSizingV = child.layoutSizingVertical || null;
            richData.fills = extractHexFills(child);
            richData.strokes = extractHexStrokes(child);
            richData.cornerRadius = (typeof child.cornerRadius === "number") ? child.cornerRadius : null;
          } else {
            richData.fills = extractHexFills(child);
            richData.strokes = extractHexStrokes(child);
          }

          elements.push({
            index: idx++,
            name: child.name,
            nodeType: childType,
            visible: child.visible !== false,
            controlledByBoolean: controlledBy,
            depth: depth,
            position: {
              x: relX,
              y: relY,
              w: Math.round(child.width || 0),
              h: Math.round(child.height || 0),
            },
            absolutePosition: absPos,
            fontFamily: richData.fontFamily || null,
            fontStyle: richData.fontStyle || null,
            fontSize: richData.fontSize || null,
            lineHeightPx: richData.lineHeightPx || null,
            tokenName: richData.tokenName || null,
            characters: richData.characters || null,
            componentName: richData.componentName || null,
            instanceOf: richData.instanceOf || null,
            variantProperties: richData.variantProperties || null,
            layoutMode: richData.layoutMode || null,
            itemSpacing: richData.itemSpacing != null ? richData.itemSpacing : null,
            paddingTop: richData.paddingTop != null ? richData.paddingTop : null,
            paddingRight: richData.paddingRight != null ? richData.paddingRight : null,
            paddingBottom: richData.paddingBottom != null ? richData.paddingBottom : null,
            paddingLeft: richData.paddingLeft != null ? richData.paddingLeft : null,
            layoutSizingH: richData.layoutSizingH || null,
            layoutSizingV: richData.layoutSizingV || null,
            fills: richData.fills || [],
            strokes: richData.strokes || [],
            cornerRadius: richData.cornerRadius != null ? richData.cornerRadius : null,
          });
        }

        // If this is a generic wrapper or a frame with children, queue its children
        // for deeper scanning (up to depth 3)
        if (hasChildren && depth < 3) {
          for (var sci = 0; sci < child.children.length && sci < 20; sci++) {
            queue.push({ node: child.children[sci], depth: depth + 1, parentName: child.name });
          }
        }
      }

      return { elements: elements, componentBounds: componentBounds };
    })();
  `);

  if (!result.success) return { elements: [] };

  const raw = result.result as {
    elements: Array<{
      index: number;
      name: string;
      nodeType: string;
      visible: boolean;
      controlledByBoolean: string | null;
      depth: number;
      position: { x: number; y: number; w: number; h: number };
      absolutePosition: { x: number; y: number; w: number; h: number } | null;
      fontFamily: string | null;
      fontStyle: string | null;
      fontSize: number | null;
      lineHeightPx: number | null;
      tokenName: string | null;
      characters: string | null;
      componentName: string | null;
      instanceOf: string | null;
      variantProperties: Record<string, string> | null;
      layoutMode: string | null;
      itemSpacing: number | null;
      paddingTop: number | null;
      paddingRight: number | null;
      paddingBottom: number | null;
      paddingLeft: number | null;
      layoutSizingH: string | null;
      layoutSizingV: string | null;
      fills: string[];
      strokes: string[];
      cornerRadius: number | null;
    }>;
    componentBounds: { x: number; y: number; w: number; h: number } | null;
  };

  const elements: ClassifiedElement[] = (raw.elements || []).map((el) => ({
    index: el.index,
    name: el.name,
    nodeType: el.nodeType,
    role: classifyRole(el.name, el.nodeType, el.visible, !!el.controlledByBoolean),
    visible: el.visible,
    controlledByBoolean: el.controlledByBoolean || undefined,
    depth: el.depth,
    position: el.position,
    absolutePosition: el.absolutePosition || undefined,
    fontFamily: el.fontFamily || undefined,
    fontStyle: el.fontStyle || undefined,
    fontSize: el.fontSize || undefined,
    lineHeightPx: el.lineHeightPx || undefined,
    tokenName: el.tokenName || undefined,
    characters: el.characters || undefined,
    componentName: el.componentName || undefined,
    instanceOf: el.instanceOf || undefined,
    variantProperties: el.variantProperties || undefined,
    layoutMode: el.layoutMode || undefined,
    itemSpacing: el.itemSpacing ?? undefined,
    paddingTop: el.paddingTop ?? undefined,
    paddingRight: el.paddingRight ?? undefined,
    paddingBottom: el.paddingBottom ?? undefined,
    paddingLeft: el.paddingLeft ?? undefined,
    layoutSizingH: el.layoutSizingH || undefined,
    layoutSizingV: el.layoutSizingV || undefined,
    fills: el.fills?.length ? el.fills : undefined,
    strokes: el.strokes?.length ? el.strokes : undefined,
    cornerRadius: el.cornerRadius ?? undefined,
  }));

  return {
    elements,
    componentBounds: raw.componentBounds || undefined,
  };
}

function classifyRole(name: string, nodeType: string, visible: boolean, hasBoolean: boolean): ElementRole {
  const n = name.toLowerCase();

  // Decorative elements — only truly decorative spacers/dividers
  if (/^(spacer|divider|separator|line|rule|bg|background)$/i.test(n)) return "decorative";
  if (nodeType === "LINE" && /separator|divider/i.test(n)) return "decorative";

  // Structural containers — only generic unnamed wrappers
  if (/^(frame|group)\s*\d*$/i.test(n)) return "structural";
  if (/^(container|wrapper)$/i.test(n)) return "structural";

  // Optional slots (controlled by boolean or typically optional)
  if (hasBoolean) return "optional-slot";
  if (/^(leading|trailing|prefix|suffix)/i.test(n)) return "optional-slot";

  // Sub-components (instances)
  if (nodeType === "INSTANCE") return "fixed-sub-component";

  // Default: content element (labels, icons, text, named frames, etc.)
  return "content-element";
}
