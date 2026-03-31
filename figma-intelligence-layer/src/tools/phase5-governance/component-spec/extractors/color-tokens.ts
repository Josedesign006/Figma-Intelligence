/**
 * Color token extraction — maps fills/strokes to bound variable tokens
 */
import { getBridge } from "../../../../shared/figma-bridge.js";
import type { ColorTokenEntry } from "../types.js";

export async function extractColorTokens(nodeId: string): Promise<ColorTokenEntry[]> {
  const bridge = await getBridge();
  const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found");

      function rgbToHex(c) {
        var r = Math.round((c.r || 0) * 255);
        var g = Math.round((c.g || 0) * 255);
        var b = Math.round((c.b || 0) * 255);
        return "#" + [r, g, b].map(function(v) { return v.toString(16).padStart(2, "0"); }).join("");
      }

      const entries = [];
      const queue = [node];
      const varCache = {};

      while (queue.length > 0 && entries.length < 120) {
        const current = queue.shift();
        if (!current) break;

        async function processPaints(paints, boundVars, prop) {
          if (!Array.isArray(paints)) return;
          for (var i = 0; i < paints.length; i++) {
            var paint = paints[i];
            if (!paint || paint.type !== "SOLID") continue;
            var hex = paint.color ? rgbToHex(paint.color) : "#000000";
            var tokenName = "";
            var tokenId = "";
            if (boundVars && boundVars[prop]) {
              var binding = Array.isArray(boundVars[prop]) ? boundVars[prop][i] : boundVars[prop];
              if (binding && binding.id) {
                tokenId = binding.id;
                if (!varCache[tokenId]) {
                  try {
                    var v = await figma.variables.getVariableByIdAsync(tokenId);
                    varCache[tokenId] = v ? v.name : "";
                  } catch(e) { varCache[tokenId] = ""; }
                }
                tokenName = varCache[tokenId] || "";
              }
            }
            entries.push({
              element: current.name || "Unnamed",
              property: prop === "fills" ? "fill" : "stroke",
              colorHex: hex,
              tokenName: tokenName,
              tokenId: tokenId,
            });
          }
        }

        var bv = current.boundVariables || {};
        await processPaints(current.fills, bv, "fills");
        await processPaints(current.strokes, bv, "strokes");

        if ("children" in current && current.children.length > 0) {
          for (const child of current.children.slice(0, 20)) {
            queue.push(child);
          }
        }
      }
      return entries;
    })();
  `);

  if (!result.success) return [];
  return (result.result as ColorTokenEntry[]) || [];
}
