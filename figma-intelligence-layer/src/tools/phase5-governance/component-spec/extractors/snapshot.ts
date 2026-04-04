import { getBridge } from "../../../../shared/figma-bridge.js";
import type { NodeSnapshot, SnapshotNode } from "../types.js";

export async function resolveTargetNodeId(args: { nodeId?: string }): Promise<string> {
  if (args.nodeId) return args.nodeId;
  const bridge = await getBridge();
  const selection = await bridge.getSelection();
  if (selection.length === 0) {
    throw new Error("figma_component_spec: Provide a nodeId or select a node in Figma before running this tool.");
  }
  return selection[0].id;
}

export async function captureSnapshot(nodeId: string): Promise<NodeSnapshot> {
  const bridge = await getBridge();
  const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      var node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found: " + ${JSON.stringify(nodeId)});

      // ── Block 1: base metadata ──
      function describePaint(paint) {
        if (!paint) return null;
        if (paint.type === "SOLID" && paint.color) {
          var r = Math.round((paint.color.r || 0) * 255);
          var g = Math.round((paint.color.g || 0) * 255);
          var b = Math.round((paint.color.b || 0) * 255);
          return { type: "SOLID", label: "rgb(" + r + ", " + g + ", " + b + ")" };
        }
        if (paint.type === "VARIABLE_ALIAS") {
          return { type: "VARIABLE_ALIAS", label: paint.boundVariableId || paint.variableId || "Variable alias" };
        }
        return { type: paint.type || "UNKNOWN", label: paint.type || "UNKNOWN" };
      }

      var base = {
        id: node.id,
        name: node.name,
        type: node.type,
        description: node.description || "",
        width: "width" in node ? node.width || 0 : 0,
        height: "height" in node ? node.height || 0 : 0,
        layoutMode: "layoutMode" in node ? String(node.layoutMode || "NONE") : "NONE",
        itemSpacing: "itemSpacing" in node ? Number(node.itemSpacing || 0) : 0,
        paddingTop: "paddingTop" in node ? Number(node.paddingTop || 0) : 0,
        paddingRight: "paddingRight" in node ? Number(node.paddingRight || 0) : 0,
        paddingBottom: "paddingBottom" in node ? Number(node.paddingBottom || 0) : 0,
        paddingLeft: "paddingLeft" in node ? Number(node.paddingLeft || 0) : 0,
        childCount: "children" in node ? node.children.length : 0,
        childNames: "children" in node ? node.children.slice(0, 12).map(function(child) { return child.name; }) : [],
        fills: Array.isArray(node.fills) ? node.fills.map(describePaint).filter(Boolean) : [],
        strokes: Array.isArray(node.strokes) ? node.strokes.map(describePaint).filter(Boolean) : [],
        effects: Array.isArray(node.effects) ? node.effects.map(function(effect) {
          return { type: effect.type, radius: effect.radius, visible: effect.visible };
        }) : [],
        variantProperties: "variantProperties" in node && node.variantProperties ? node.variantProperties : {},
      };

      // ── Block 2: text layers ──
      var textScanNodes = [];
      if ("children" in node) {
        var textQueue = [node];
        while (textQueue.length > 0 && textScanNodes.length < 60) {
          var curr = textQueue.shift();
          if (!curr) break;
          textScanNodes.push(curr);
          if ("children" in curr && curr.children.length > 0) {
            for (var ti = 0; ti < Math.min(curr.children.length, 8); ti++) {
              textQueue.push(curr.children[ti]);
            }
          }
        }
      } else {
        textScanNodes = [node];
      }

      var textLayers = [];
      for (var tli = 0; tli < textScanNodes.length; tli++) {
        var tNode = textScanNodes[tli];
        if (tNode.type !== "TEXT") continue;
        textLayers.push({
          name: tNode.name,
          characters: tNode.characters || "",
          fontFamily: tNode.fontName === figma.mixed ? "Mixed" : tNode.fontName.family,
          fontStyle: tNode.fontName === figma.mixed ? "Mixed" : tNode.fontName.style,
          fontSize: typeof tNode.fontSize === "number" ? tNode.fontSize : 0,
          lineHeightPx: tNode.lineHeight && typeof tNode.lineHeight.value === "number"
            ? tNode.lineHeight.unit === "PIXELS" ? tNode.lineHeight.value : null
            : null,
        });
        if (textLayers.length >= 12) break;
      }

      if (node.type === "TEXT" && textLayers.length === 0) {
        textLayers.push({
          name: node.name,
          characters: node.characters || "",
          fontFamily: node.fontName === figma.mixed ? "Mixed" : node.fontName.family,
          fontStyle: node.fontName === figma.mixed ? "Mixed" : node.fontName.style,
          fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
          lineHeightPx: node.lineHeight && typeof node.lineHeight.value === "number"
            ? node.lineHeight.unit === "PIXELS" ? node.lineHeight.value : null
            : null,
        });
      }

      // ── Block 3: token aliases ──
      function collectAliasesFromPaints(paints, sink) {
        if (!Array.isArray(paints)) return;
        for (var pi = 0; pi < paints.length; pi++) {
          var paint = paints[pi];
          if (paint && paint.type === "VARIABLE_ALIAS") {
            sink.push(String(paint.boundVariableId || paint.variableId || "variable-alias"));
          }
        }
      }

      var tokenScanNodes = [];
      if ("children" in node) {
        var tokenQueue = [node];
        while (tokenQueue.length > 0 && tokenScanNodes.length < 60) {
          var tCurr = tokenQueue.shift();
          if (!tCurr) break;
          tokenScanNodes.push(tCurr);
          if ("children" in tCurr && tCurr.children.length > 0) {
            for (var tki = 0; tki < Math.min(tCurr.children.length, 8); tki++) {
              tokenQueue.push(tCurr.children[tki]);
            }
          }
        }
      } else {
        tokenScanNodes = [node];
      }

      var tokenAliasSet = {};
      for (var tai = 0; tai < tokenScanNodes.length; tai++) {
        var aliases = [];
        collectAliasesFromPaints(tokenScanNodes[tai].fills, aliases);
        collectAliasesFromPaints(tokenScanNodes[tai].strokes, aliases);
        for (var ai = 0; ai < aliases.length; ai++) {
          tokenAliasSet[aliases[ai]] = true;
        }
      }
      var tokenAliases = Object.keys(tokenAliasSet);

      // ── Block 4: component metadata ──
      // Check the node itself first, then fall back to parent ComponentSet for properties
      var componentProperties = [];
      var cpSource = ("componentProperties" in node && node.componentProperties) ? node
        : (node.type === "COMPONENT" && node.parent && node.parent.type === "COMPONENT_SET" && "componentProperties" in node.parent && node.parent.componentProperties) ? node.parent
        : null;
      if (cpSource && cpSource.componentProperties) {
        for (var cpEntry of Object.entries(cpSource.componentProperties)) {
          var cpName = cpEntry[0];
          var cpProp = cpEntry[1];
          componentProperties.push({
            name: cpName,
            type: String(cpProp.type || ""),
            value: cpProp.value === undefined ? "" : String(cpProp.value),
            options: Array.isArray(cpProp.variantOptions) ? cpProp.variantOptions.map(String) : [],
          });
        }
      }

      var variantGroupProperties = {};
      var variants = [];
      // Resolve ComponentSet: either the node itself or its parent (when a variant Component is selected)
      var compSetNode = node.type === "COMPONENT_SET" ? node
        : (node.type === "COMPONENT" && node.parent && node.parent.type === "COMPONENT_SET") ? node.parent
        : null;
      if (compSetNode) {
        for (var vgEntry of Object.entries(compSetNode.variantGroupProperties || {})) {
          var vgName = vgEntry[0];
          var vgProp = vgEntry[1];
          variantGroupProperties[vgName] = Array.isArray(vgProp.values) ? vgProp.values.map(String) : [];
        }
        for (var vi = 0; vi < Math.min(compSetNode.children.length, 40); vi++) {
          var vChild = compSetNode.children[vi];
          variants.push({
            id: vChild.id,
            name: vChild.name,
            description: vChild.description || "",
            properties: vChild.variantProperties || {},
          });
        }
      }

      // ── Block 5: interaction tree ──
      function collectTextContent(target) {
        if (target.type === "TEXT") {
          return (target.characters || "").trim();
        }
        if (!("children" in target)) return "";
        var parts = [];
        var cQueue = target.children.slice(0, 8);
        while (cQueue.length > 0 && parts.length < 3) {
          var c = cQueue.shift();
          if (!c) break;
          if (c.type === "TEXT" && c.characters && c.characters.trim()) {
            parts.push(c.characters.trim());
          }
          if ("children" in c && c.children.length > 0) {
            for (var ci = 0; ci < Math.min(c.children.length, 6); ci++) {
              cQueue.push(c.children[ci]);
            }
          }
        }
        return parts.join(" ").slice(0, 140);
      }

      var scanNodes = [];
      var scanQueue = [{ current: node, depth: 0, parentId: null, parentName: null }];
      while (scanQueue.length > 0 && scanNodes.length < 160) {
        var item = scanQueue.shift();
        if (!item) break;
        var sNode = item.current;
        scanNodes.push({
          id: sNode.id,
          parentId: item.parentId,
          parentName: item.parentName,
          name: sNode.name || "",
          type: sNode.type,
          depth: item.depth,
          visible: sNode.visible !== false,
          childCount: "children" in sNode ? sNode.children.length : 0,
          layoutMode: "layoutMode" in sNode ? String(sNode.layoutMode || "NONE") : "NONE",
          text: collectTextContent(sNode),
          componentPropertyNames: "componentProperties" in sNode && sNode.componentProperties
            ? Object.keys(sNode.componentProperties)
            : [],
          variantPropertyKeys: "variantProperties" in sNode && sNode.variantProperties
            ? Object.keys(sNode.variantProperties)
            : [],
          variantPropertyValues: "variantProperties" in sNode && sNode.variantProperties
            ? Object.values(sNode.variantProperties).map(String)
            : [],
        });

        if ("children" in sNode && sNode.children.length > 0 && item.depth < 7) {
          for (var si = 0; si < Math.min(sNode.children.length, 20); si++) {
            scanQueue.push({
              current: sNode.children[si],
              depth: item.depth + 1,
              parentId: sNode.id,
              parentName: sNode.name || "",
            });
          }
        }
      }

      // ── Combine all results ──
      return {
        id: base.id,
        name: base.name,
        type: base.type,
        description: base.description,
        width: base.width,
        height: base.height,
        layoutMode: base.layoutMode,
        itemSpacing: base.itemSpacing,
        paddingTop: base.paddingTop,
        paddingRight: base.paddingRight,
        paddingBottom: base.paddingBottom,
        paddingLeft: base.paddingLeft,
        childCount: base.childCount,
        childNames: base.childNames,
        fills: base.fills,
        strokes: base.strokes,
        effects: base.effects,
        variantProperties: base.variantProperties,
        textLayers: textLayers,
        tokenAliases: tokenAliases,
        componentProperties: componentProperties,
        variantGroupProperties: variantGroupProperties,
        variants: variants,
        scanNodes: scanNodes,
      };
    })();
  `);

  if (!result.success) {
    throw new Error(`figma_component_spec: failed to inspect node ${nodeId}: ${result.error}`);
  }

  return result.result as NodeSnapshot;
}
