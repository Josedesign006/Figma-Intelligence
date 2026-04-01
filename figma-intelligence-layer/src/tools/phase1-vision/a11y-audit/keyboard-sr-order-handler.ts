/**
 * Keyboard & Screen Reader Order — Handler
 * Orchestrates the analyzer and Figma page renderer to produce a complete
 * accessibility annotation page from a target Figma frame.
 */

import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import { FigmaNode } from "../../../shared/types.js";
import { analyzeKeyboardAndScreenReaderOrder } from "./keyboard-sr-order-analyzer.js";
import { renderKeyboardSrOrderPage } from "./keyboard-sr-order-figma-page.js";

export interface KeyboardSrOrderArgs {
  nodeId: string;
  pageName?: string;
}

export interface KeyboardSrOrderResult {
  pageId: string;
  tabOrderCount: number;
  readingOrderCount: number;
  warningCount: number;
  auditSummary: string;
}

export async function keyboardSrOrderHandler(
  args: KeyboardSrOrderArgs,
): Promise<KeyboardSrOrderResult> {
  const { nodeId, pageName } = args;
  const bridge = await getBridge();

  // 1. Retrieve full node tree (enhanced depth for page-level analysis)
  const treeScript = `
    function serialize(n, depth) {
      if (depth > 12) return null;
      var fills = [];
      try {
        var rawFills = n.fills || [];
        for (var i = 0; i < rawFills.length; i++) {
          var f = rawFills[i];
          fills.push({
            type: f.type,
            color: f.color ? { r: f.color.r, g: f.color.g, b: f.color.b, a: f.color.a } : null,
            opacity: f.opacity || 1,
          });
        }
      } catch(e) {}
      var kids = [];
      var rawChildren = n.children || [];
      for (var j = 0; j < rawChildren.length; j++) {
        var child = serialize(rawChildren[j], depth + 1);
        if (child) kids.push(child);
      }
      var strokes = [];
      try {
        var rawStrokes = n.strokes || [];
        for (var s = 0; s < rawStrokes.length; s++) {
          var st = rawStrokes[s];
          strokes.push({
            type: st.type,
            color: st.color ? { r: st.color.r, g: st.color.g, b: st.color.b, a: st.color.a } : null,
            opacity: st.opacity || 1,
          });
        }
      } catch(e) {}
      var effects = [];
      try {
        var rawEffects = n.effects || [];
        for (var ef = 0; ef < rawEffects.length; ef++) {
          var eff = rawEffects[ef];
          effects.push({
            type: eff.type,
            color: eff.color ? { r: eff.color.r, g: eff.color.g, b: eff.color.b, a: eff.color.a } : null,
            visible: eff.visible !== false,
          });
        }
      } catch(e) {}
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        width: n.width || null,
        height: n.height || null,
        layoutMode: n.layoutMode || null,
        primaryAxisSizingMode: n.primaryAxisSizingMode || null,
        counterAxisSizingMode: n.counterAxisSizingMode || null,
        variantProperties: n.variantProperties || null,
        absoluteBoundingBox: n.absoluteBoundingBox || null,
        characters: n.characters || null,
        description: n.description || null,
        style: n.style || null,
        fills: fills,
        strokes: strokes,
        effects: effects,
        children: kids,
      };
    }
    var root = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
    if (!root) throw new Error("Node not found: " + ${JSON.stringify(nodeId)});
    return serialize(root, 0);
  `;

  const treeResult = await bridge.execute(treeScript);
  if (!treeResult.success) {
    throw new Error(
      `keyboardSrOrderHandler: could not retrieve node tree — ${treeResult.error}`,
    );
  }

  const rootNode = treeResult.result as FigmaNode;

  // 2. Run analysis
  const analysis = analyzeKeyboardAndScreenReaderOrder(rootNode, nodeId);

  // 3. Render Figma page
  const { pageId } = await renderKeyboardSrOrderPage(
    bridge,
    analysis,
    pageName,
  );

  // 4. Log action
  await decisionLog.log({
    tool: "figma_a11y_keyboard_screenreader_order",
    nodeIds: [nodeId],
    rationale: `Generated keyboard & screen reader order annotation for "${rootNode.name}". Tab order: ${analysis.keyboardTabOrder.length} elements. Warnings: ${analysis.warnings.length}.`,
    reversible: false,
    metadata: {
      tabOrderCount: analysis.keyboardTabOrder.length,
      readingOrderCount: analysis.screenReaderReadingOrder.length,
      warningCount: analysis.warnings.length,
      pageId,
    },
  });

  // 5. Build summary string
  const summaryLines = analysis.auditSummary
    .map((r) => `${r.severity}: ${r.count} ${r.category}`)
    .join("\n");

  return {
    pageId,
    tabOrderCount: analysis.keyboardTabOrder.length,
    readingOrderCount: analysis.screenReaderReadingOrder.length,
    warningCount: analysis.warnings.length,
    auditSummary: summaryLines,
  };
}
