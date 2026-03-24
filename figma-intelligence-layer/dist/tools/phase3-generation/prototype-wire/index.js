"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Prototype Wire — Scan & Wire
//
// figma_prototype_scan  — Discover interactive elements across frames
// figma_prototype_wire  — Create prototype connections with full trigger/
//                         animation variety
//
// Designed as a two-step flow: scan first (understand the screens), then
// wire (create connections).  The AI reasons between the two steps to map
// a user-journey description onto concrete element→frame connections.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.prototypeScanHandler = prototypeScanHandler;
exports.prototypeWireHandler = prototypeWireHandler;
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
const prototype_script_builder_js_1 = require("../../../shared/prototype-script-builder.js");
// ─── Scan script generation ──────────────────────────────────────────────────
const INTERACTIVE_NAME_PATTERNS = [
    "button", "btn", "cta", "link", "nav", "tab", "menu", "toggle",
    "switch", "checkbox", "radio", "select", "dropdown", "input",
    "search", "icon-button", "iconbutton", "fab", "chip", "tag",
    "breadcrumb", "pagination", "stepper", "close", "back", "arrow",
    "hamburger", "sidebar", "drawer", "modal", "dialog", "popover",
    "tooltip", "accordion", "carousel", "slider", "card", "clickable",
];
const ACTION_WORD_PATTERNS = [
    "login", "log in", "sign in", "sign up", "signup", "register",
    "submit", "next", "back", "continue", "cancel", "save", "delete",
    "remove", "edit", "add", "create", "send", "share", "settings",
    "profile", "home", "search", "filter", "sort", "view", "open",
    "close", "menu", "more", "go", "start", "finish", "confirm",
    "retry", "skip", "done", "ok", "yes", "no", "accept", "decline",
    "upgrade", "subscribe", "buy", "checkout", "pay", "download",
    "upload", "explore", "discover", "browse", "see all", "view all",
    "learn more", "get started", "try", "join", "connect", "follow",
    "like", "comment", "post", "reply", "refresh", "reload", "undo",
    "redo", "apply", "reset", "update", "install", "launch",
];
function buildScanScript(frameIds, maxDepth, maxFrames, maxNodes) {
    const namePatterns = JSON.stringify(INTERACTIVE_NAME_PATTERNS);
    const actionPatterns = JSON.stringify(ACTION_WORD_PATTERNS);
    return `
(async () => {
  const NAME_PATTERNS = ${namePatterns};
  const ACTION_PATTERNS = ${actionPatterns};
  const MAX_DEPTH = ${maxDepth};
  const MAX_FRAMES = ${maxFrames};
  const MAX_NODES = ${maxNodes};

  // Resolve target frames
  let frames;
  ${frameIds
        ? `frames = [];
  for (const id of ${JSON.stringify(frameIds)}) {
    const n = await figma.getNodeByIdAsync(id);
    if (n && (n.type === "FRAME" || n.type === "COMPONENT" || n.type === "COMPONENT_SET" || n.type === "SECTION")) {
      frames.push(n);
    }
  }`
        : `frames = figma.currentPage.children.filter(
    n => n.type === "FRAME" || n.type === "COMPONENT" || n.type === "SECTION"
  );`}

  frames = frames.slice(0, MAX_FRAMES);
  let truncated = false;

  // Count existing prototype connections
  let existingConnections = 0;
  for (const f of frames) {
    const reactions = f.reactions || [];
    existingConnections += reactions.filter(r => r.action && r.action.type === "NODE").length;
  }

  const results = [];

  for (const frame of frames) {
    const elements = [];
    let nodesScanned = 0;

    function getTextContent(node, depth) {
      if (depth > 2) return "";
      if (node.type === "TEXT") return node.characters || "";
      let text = "";
      if ("children" in node) {
        for (const child of node.children) {
          text += " " + getTextContent(child, depth + 1);
          if (text.length > 200) break;
        }
      }
      return text.trim();
    }

    function scoreNode(node, depth) {
      if (depth > MAX_DEPTH) return;
      nodesScanned++;
      if (nodesScanned > MAX_NODES) { truncated = true; return; }

      // Skip the frame itself and very large container nodes at depth 1
      if (depth === 0) {
        if ("children" in node) {
          for (const child of node.children) scoreNode(child, depth + 1);
        }
        return;
      }

      const name = (node.name || "").toLowerCase();
      const type = node.type;
      let score = 0;
      const signals = [];

      // Name-based signals
      for (const pat of NAME_PATTERNS) {
        if (name.includes(pat)) {
          score += 0.35;
          signals.push("name:" + pat);
          break;
        }
      }

      // Type-based signals
      if (type === "INSTANCE") {
        score += 0.3;
        signals.push("type:INSTANCE");
      } else if (type === "COMPONENT") {
        score += 0.25;
        signals.push("type:COMPONENT");
      }

      // Text content signals (action words)
      const textContent = getTextContent(node, 0);
      if (textContent) {
        const lowerText = textContent.toLowerCase();
        for (const action of ACTION_PATTERNS) {
          if (lowerText.includes(action)) {
            score += 0.25;
            signals.push("text:" + action);
            break;
          }
        }
      }

      // Structural signals: small node with corner radius (button-like)
      if ("cornerRadius" in node && node.cornerRadius > 0) {
        const w = node.width || 0;
        const h = node.height || 0;
        if (w > 20 && w < 400 && h > 20 && h < 100) {
          score += 0.15;
          signals.push("shape:rounded-small");
        }
      }

      // If this node has exactly 1 text child with an action word, boost
      if ("children" in node && node.children) {
        const textChildren = node.children.filter(c => c.type === "TEXT");
        if (textChildren.length === 1) {
          const tc = (textChildren[0].characters || "").toLowerCase();
          for (const action of ACTION_PATTERNS) {
            if (tc.includes(action)) {
              score += 0.1;
              signals.push("single-text-action");
              break;
            }
          }
        }
      }

      if (score >= 0.3) {
        const el = {
          nodeId: node.id,
          nodeName: node.name,
          nodeType: type,
          interactivityScore: Math.min(score, 1),
          signals: signals,
          parentFrameId: frame.id,
          parentFrameName: frame.name,
          depth: depth,
        };
        if (textContent && textContent.length > 0 && textContent.length < 200) {
          el.textContent = textContent;
        }
        if (type === "INSTANCE" && node.mainComponent) {
          el.componentName = node.mainComponent.name;
        }
        if ("absoluteBoundingBox" in node && node.absoluteBoundingBox) {
          el.boundingBox = {
            x: node.absoluteBoundingBox.x,
            y: node.absoluteBoundingBox.y,
            width: node.absoluteBoundingBox.width,
            height: node.absoluteBoundingBox.height,
          };
        } else if ("width" in node) {
          el.boundingBox = { x: node.x || 0, y: node.y || 0, width: node.width, height: node.height };
        }
        elements.push(el);
      }

      // Recurse into children
      if ("children" in node && node.children) {
        for (const child of node.children) {
          scoreNode(child, depth + 1);
        }
      }
    }

    scoreNode(frame, 0);

    // Sort by score descending
    elements.sort((a, b) => b.interactivityScore - a.interactivityScore);

    results.push({
      frameId: frame.id,
      frameName: frame.name,
      interactiveElements: elements,
      totalNodesScanned: nodesScanned,
    });
  }

  return {
    frames: results,
    existingConnections: existingConnections,
    truncated: truncated,
  };
})();
`.trim();
}
// ─── Scan handler ────────────────────────────────────────────────────────────
async function prototypeScanHandler(args) {
    const { frameIds, journeyDescription, maxDepth = 5, } = args;
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    const script = buildScanScript(frameIds && frameIds.length > 0 ? frameIds : null, Math.min(maxDepth, 8), 20, 5000);
    const result = await bridge.execute(script);
    if (!result.success) {
        throw new Error(`Scan failed: ${result.error}`);
    }
    const data = result.result;
    const totalInteractiveElements = data.frames.reduce((sum, f) => sum + f.interactiveElements.length, 0);
    const logEntry = await decision_log_js_1.decisionLog.log({
        tool: "prototype-scan",
        nodeIds: data.frames.map((f) => f.frameId),
        rationale: `Scanned ${data.frames.length} frames, found ${totalInteractiveElements} interactive elements. Existing connections: ${data.existingConnections}. Truncated: ${data.truncated}.${journeyDescription ? ` Journey: "${journeyDescription}"` : ""}`,
        reversible: false,
    });
    return {
        frames: data.frames,
        totalFrames: data.frames.length,
        totalInteractiveElements,
        existingConnections: data.existingConnections,
        truncated: data.truncated,
        journeyDescription,
        logEntryId: logEntry.id,
    };
}
// ─── Wire handler ────────────────────────────────────────────────────────────
async function prototypeWireHandler(args) {
    const { connections, journeyDescription, frameIds, defaultTrigger = "ON_CLICK", defaultAnimation, clearExisting = false, dryRun = false, } = args;
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    // Journey-only mode: run scan and return data for AI to reason over
    if (!connections || connections.length === 0) {
        if (journeyDescription) {
            const scanResult = await prototypeScanHandler({
                frameIds,
                journeyDescription,
                maxDepth: 5,
            });
            const logEntry = await decision_log_js_1.decisionLog.log({
                tool: "prototype-wire",
                nodeIds: scanResult.frames.map((f) => f.frameId),
                rationale: `Journey-driven scan mode. Returning interactive element inventory for AI to plan wiring. Journey: "${journeyDescription}"`,
                reversible: false,
            });
            return {
                mode: "scan-for-journey",
                scanData: scanResult,
                logEntryId: logEntry.id,
            };
        }
        throw new Error("Either 'connections' array or 'journeyDescription' must be provided.");
    }
    // Resolve node names for logging/results
    const nodeNameScript = `
(async () => {
  const ids = ${JSON.stringify([
        ...connections.map((c) => c.fromElementId),
        ...connections.map((c) => c.toFrameId),
    ])};
  const names = {};
  for (const id of ids) {
    const n = await figma.getNodeByIdAsync(id);
    names[id] = n ? n.name : "Unknown";
  }
  return names;
})();
`.trim();
    const nameResult = await bridge.execute(nodeNameScript);
    const nodeNames = nameResult.success && nameResult.result
        ? nameResult.result
        : {};
    // Build WireSpec array
    const defAnim = defaultAnimation || {};
    const wireSpecs = connections.map((c) => ({
        fromNodeId: c.fromElementId,
        toNodeId: c.toFrameId,
        trigger: {
            type: c.trigger || defaultTrigger,
        },
        animation: {
            type: c.animation?.type || defAnim.type || "SMART_ANIMATE",
            direction: c.animation?.direction || defAnim.direction,
            duration: c.animation?.duration ?? defAnim.duration ?? 0.3,
            easing: c.animation?.easing || defAnim.easing || "EASE_IN_AND_OUT",
        },
        navigation: c.navigation || "NAVIGATE",
    }));
    // Build planned connections for dry-run or result reporting
    const planned = wireSpecs.map((spec, i) => ({
        fromElementId: spec.fromNodeId,
        fromElementName: nodeNames[spec.fromNodeId] || "Unknown",
        toFrameId: spec.toNodeId,
        toFrameName: nodeNames[spec.toNodeId] || "Unknown",
        trigger: spec.trigger.type,
        animation: spec.animation.type,
    }));
    // Dry-run: return plan without executing
    if (dryRun) {
        const logEntry = await decision_log_js_1.decisionLog.log({
            tool: "prototype-wire",
            nodeIds: wireSpecs.map((s) => s.fromNodeId),
            rationale: `Dry-run: planned ${wireSpecs.length} connections. Not executed.`,
            reversible: false,
        });
        return {
            mode: "dry-run",
            plannedConnections: planned,
            totalAttempted: wireSpecs.length,
            logEntryId: logEntry.id,
        };
    }
    // Clear existing reactions if requested
    if (clearExisting) {
        const uniqueFromIds = [...new Set(wireSpecs.map((s) => s.fromNodeId))];
        const clearScript = (0, prototype_script_builder_js_1.buildClearReactionsScript)(uniqueFromIds);
        await bridge.execute(clearScript);
    }
    // Execute wiring
    const wireScript = (0, prototype_script_builder_js_1.buildWireScript)(wireSpecs);
    const wireResult = await bridge.execute(wireScript);
    if (!wireResult.success) {
        throw new Error(`Wire execution failed: ${wireResult.error}`);
    }
    const scriptResults = wireResult.result;
    // Build result entries
    const wiredConnections = scriptResults.map((r, i) => ({
        fromElementId: r.fromNodeId,
        fromElementName: nodeNames[r.fromNodeId] || "Unknown",
        toFrameId: wireSpecs[i].toNodeId,
        toFrameName: nodeNames[wireSpecs[i].toNodeId] || "Unknown",
        trigger: wireSpecs[i].trigger.type,
        animation: wireSpecs[i].animation.type,
        success: r.success,
        error: r.error,
    }));
    const succeeded = wiredConnections.filter((w) => w.success).length;
    const failed = wiredConnections.filter((w) => !w.success).length;
    const logEntry = await decision_log_js_1.decisionLog.log({
        tool: "prototype-wire",
        nodeIds: wireSpecs.map((s) => s.fromNodeId),
        rationale: `Wired ${succeeded}/${wireSpecs.length} connections (${failed} failed). Clear existing: ${clearExisting}.`,
        reversible: true,
        metadata: {
            connections: planned,
            clearExisting,
        },
    });
    return {
        mode: "executed",
        wiredConnections,
        totalAttempted: wireSpecs.length,
        totalSucceeded: succeeded,
        totalFailed: failed,
        logEntryId: logEntry.id,
    };
}
//# sourceMappingURL=index.js.map