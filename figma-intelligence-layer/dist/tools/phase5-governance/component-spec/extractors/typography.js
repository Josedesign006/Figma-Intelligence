"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTypography = extractTypography;
/**
 * Typography extraction — font families, sizes, weights, line heights, style tokens
 */
const figma_bridge_js_1 = require("../../../../shared/figma-bridge.js");
async function extractTypography(nodeId) {
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found");

      const entries = [];
      const queue = [node];

      while (queue.length > 0 && entries.length < 40) {
        const current = queue.shift();
        if (!current) break;

        if (current.type === "TEXT") {
          var fontFamily = current.fontName === figma.mixed ? "Mixed" : current.fontName.family;
          var fontStyle = current.fontName === figma.mixed ? "Mixed" : current.fontName.style;
          var fontSize = typeof current.fontSize === "number" ? current.fontSize : 0;
          var lineHeightPx = null;
          if (current.lineHeight && typeof current.lineHeight === "object" && current.lineHeight.unit === "PIXELS") {
            lineHeightPx = current.lineHeight.value;
          }
          var letterSpacing = 0;
          if (current.letterSpacing && typeof current.letterSpacing === "object" && current.letterSpacing.unit === "PIXELS") {
            letterSpacing = current.letterSpacing.value;
          }

          var tokenName = "";
          var bv = current.boundVariables || {};
          if (bv.fontFamily || bv.fontSize) {
            try {
              var varId = (bv.fontSize && bv.fontSize.id) || (bv.fontFamily && bv.fontFamily.id) || "";
              if (varId) {
                var v = await figma.variables.getVariableByIdAsync(varId);
                tokenName = v ? v.name : "";
              }
            } catch(e) {}
          }

          entries.push({
            element: current.name || "Text",
            characters: (current.characters || "").slice(0, 80),
            fontFamily: fontFamily,
            fontStyle: fontStyle,
            fontSize: fontSize,
            lineHeightPx: lineHeightPx,
            letterSpacing: letterSpacing,
            tokenName: tokenName,
          });
        }

        if ("children" in current && current.children.length > 0) {
          for (const child of current.children.slice(0, 20)) {
            queue.push(child);
          }
        }
      }
      return entries;
    })();
  `);
    if (!result.success)
        return [];
    return result.result || [];
}
//# sourceMappingURL=typography.js.map