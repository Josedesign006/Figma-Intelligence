/**
 * Spacing structure extraction — padding, gaps, dimensions, layout mode
 */
import { getBridge } from "../../../../shared/figma-bridge.js";
import type { SpacingEntry } from "../types.js";

export async function extractSpacing(nodeId: string): Promise<SpacingEntry[]> {
  const bridge = await getBridge();
  const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found");

      const entries = [];
      const queue = [node];
      while (queue.length > 0 && entries.length < 80) {
        const current = queue.shift();
        if (!current) break;
        if ("layoutMode" in current && current.layoutMode && current.layoutMode !== "NONE") {
          var childPositions = [];
          if ("children" in current && current.children) {
            var parentBounds = current.absoluteBoundingBox;
            for (var ci = 0; ci < Math.min(current.children.length, 8); ci++) {
              var ch = current.children[ci];
              if (ch.visible === false || ch.width === 0) continue;
              var chX = 0, chY = 0;
              if (ch.absoluteBoundingBox && parentBounds) {
                chX = Math.round(ch.absoluteBoundingBox.x - parentBounds.x);
                chY = Math.round(ch.absoluteBoundingBox.y - parentBounds.y);
              } else {
                chX = Math.round(ch.x || 0);
                chY = Math.round(ch.y || 0);
              }
              childPositions.push({
                name: ch.name || "Child",
                x: chX,
                y: chY,
                w: Math.round(ch.width || 0),
                h: Math.round(ch.height || 0),
              });
            }
          }
          entries.push({
            element: current.name || "Unnamed",
            paddingTop: current.paddingTop || 0,
            paddingRight: current.paddingRight || 0,
            paddingBottom: current.paddingBottom || 0,
            paddingLeft: current.paddingLeft || 0,
            itemSpacing: current.itemSpacing || 0,
            width: Math.round(current.width || 0),
            height: Math.round(current.height || 0),
            layoutMode: String(current.layoutMode),
            layoutSizingH: "layoutSizingHorizontal" in current ? String(current.layoutSizingHorizontal || "FIXED") : "FIXED",
            layoutSizingV: "layoutSizingVertical" in current ? String(current.layoutSizingVertical || "FIXED") : "FIXED",
            children: childPositions,
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

  if (!result.success) return [];
  return (result.result as SpacingEntry[]) || [];
}
