"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Prototype Script Builder
// Generates Figma Plugin API code strings for setting prototype reactions
// with full trigger, animation, and navigation variety.  Used by both
// figma_prototype_wire and figma_page_architect.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWireScript = buildWireScript;
exports.buildClearReactionsScript = buildClearReactionsScript;
/**
 * Generate a single Figma Plugin API script that sets prototype reactions
 * for all provided wire specs in one batch.  Preserves existing reactions.
 */
function buildWireScript(specs) {
    const serialized = JSON.stringify(specs);
    return `
(async () => {
  const specs = ${serialized};
  const results = [];

  for (const spec of specs) {
    try {
      const fromNode = await figma.getNodeByIdAsync(spec.fromNodeId);
      const toNode = await figma.getNodeByIdAsync(spec.toNodeId);
      if (!fromNode) {
        results.push({ fromNodeId: spec.fromNodeId, success: false, error: "Source node not found" });
        continue;
      }
      if (!toNode) {
        results.push({ fromNodeId: spec.fromNodeId, success: false, error: "Destination node not found" });
        continue;
      }
      if (!("reactions" in fromNode)) {
        results.push({ fromNodeId: spec.fromNodeId, success: false, error: "Node does not support reactions" });
        continue;
      }

      const trigger = { type: spec.trigger.type };
      if (spec.trigger.type === "AFTER_DELAY" && spec.trigger.delay != null) {
        trigger.delay = spec.trigger.delay;
      }

      const transition = {
        type: spec.animation.type,
        duration: spec.animation.duration != null ? spec.animation.duration : 0.3,
        easing: { type: spec.animation.easing || "EASE_IN_AND_OUT" },
      };
      if (spec.animation.direction) {
        transition.direction = spec.animation.direction;
      }

      const action = {
        type: "NODE",
        destinationId: spec.toNodeId,
        navigation: spec.navigation || "NAVIGATE",
        transition: transition,
        preserveScrollPosition: !!spec.preserveScrollPosition,
      };

      const existing = fromNode.reactions || [];
      fromNode.reactions = [...existing, { trigger, action }];

      results.push({ fromNodeId: spec.fromNodeId, success: true });
    } catch (e) {
      results.push({ fromNodeId: spec.fromNodeId, success: false, error: e.message || String(e) });
    }
  }

  return results;
})();
`.trim();
}
/**
 * Generate a script that clears all reactions from the specified nodes.
 */
function buildClearReactionsScript(nodeIds) {
    const serialized = JSON.stringify(nodeIds);
    return `
(async () => {
  const nodeIds = ${serialized};
  const results = [];

  for (const id of nodeIds) {
    try {
      const node = await figma.getNodeByIdAsync(id);
      if (!node) {
        results.push({ nodeId: id, success: false, error: "Node not found" });
        continue;
      }
      if (!("reactions" in node)) {
        results.push({ nodeId: id, success: false, error: "Node does not support reactions" });
        continue;
      }
      node.reactions = [];
      results.push({ nodeId: id, success: true });
    } catch (e) {
      results.push({ nodeId: id, success: false, error: e.message || String(e) });
    }
  }

  return results;
})();
`.trim();
}
//# sourceMappingURL=prototype-script-builder.js.map