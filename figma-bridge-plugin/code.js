/**
 * Figma Intelligence Bridge Plugin — Plugin Sandbox (code.js)
 *
 * This runs inside Figma's plugin sandbox. It cannot do network I/O directly.
 * It communicates with the UI iframe (ui.html) via figma.ui.postMessage / onmessage.
 *
 * Flow:
 *   MCP Server → WebSocket → ui.html → postMessage → this code → Figma Plugin API
 *   result  ←   WebSocket ← ui.html ← postMessage ← this code
 */

var UI_WIDTH = 320;
var UI_HEIGHT = 480;
var UI_MIN_HEIGHT = 480;
var UI_MAX_HEIGHT = 960;

figma.showUI(__html__, { visible: true, width: UI_WIDTH, height: UI_HEIGHT });

function normalizeExecuteCode(code) {
  var trimmed = typeof code === "string" ? code.trim() : "";
  if (!trimmed) return "";

  // Many callers already pass an async IIFE. Preserve compatibility by
  // returning its resolved value instead of letting the outer wrapper finish
  // early with `undefined`.
  if (/^\(async\s*\(\)\s*=>\s*\{[\s\S]*\}\)\(\);?$/.test(trimmed)) {
    return "return await " + trimmed;
  }

  return code;
}

function getSelectionSummary() {
  return figma.currentPage.selection.map(function(node) {
    return { id: node.id, name: node.name, type: node.type };
  });
}

function getCurrentPageSummary() {
  return {
    id: figma.currentPage.id,
    name: figma.currentPage.name,
  };
}

function summarizeDocumentChange(change) {
  var summary = { type: change.type || "UNKNOWN" };

  if (change.id) summary.id = change.id;
  if (change.node && change.node.id) {
    summary.nodeId = change.node.id;
    summary.nodeType = change.node.type;
  } else if (change.nodeId) {
    summary.nodeId = change.nodeId;
  }

  return summary;
}

function postBridgeEvent(eventType, payload) {
  figma.ui.postMessage({
    type: "bridge-event",
    eventType: eventType,
    payload: payload,
    timestamp: Date.now(),
  });
}

function emitReadyEvent() {
  postBridgeEvent("bridge.ready", {
    fileName: figma.root.name,
    currentPage: getCurrentPageSummary(),
    pageCount: figma.root.children.length,
    selection: getSelectionSummary(),
    capabilities: getBridgeCapabilities(),
  });
}

function getBridgeCapabilities() {
  return {
    editorType: figma.editorType,
    mode: figma.mode || null,
    variablesApi: !!figma.variables,
    localVariablesApi: !!(figma.variables && figma.variables.getLocalVariableCollectionsAsync),
    localPaintStylesApi: !!figma.getLocalPaintStylesAsync,
    localTextStylesApi: !!figma.getLocalTextStylesAsync,
    localEffectStylesApi: !!figma.getLocalEffectStylesAsync,
    fileName: figma.root.name,
  };
}

function emitSelectionChange() {
  postBridgeEvent("selectionchange", {
    selection: getSelectionSummary(),
  });
}

function emitCurrentPageChange() {
  postBridgeEvent("currentpagechange", {
    currentPage: getCurrentPageSummary(),
    selection: getSelectionSummary(),
  });
}

var documentChangeFlushTimer = null;
var pendingDocumentChanges = [];

function flushDocumentChanges() {
  if (!pendingDocumentChanges.length) return;
  var batch = pendingDocumentChanges.splice(0, 50).map(summarizeDocumentChange);
  postBridgeEvent("documentchange", {
    documentChanges: batch,
  });
}

function scheduleDocumentChangeFlush() {
  if (documentChangeFlushTimer) return;
  // Coalesce noisy document changes so the UI bridge socket stays stable.
  documentChangeFlushTimer = setTimeout(function() {
    documentChangeFlushTimer = null;
    flushDocumentChanges();
  }, 120);
}

function emitDocumentChange(event) {
  var changes = Array.isArray(event && event.documentChanges) ? event.documentChanges : [];
  if (!changes.length) return;
  pendingDocumentChanges = pendingDocumentChanges.concat(changes);
  if (pendingDocumentChanges.length > 200) {
    pendingDocumentChanges = pendingDocumentChanges.slice(-200);
  }
  scheduleDocumentChangeFlush();
}

figma.on("selectionchange", emitSelectionChange);
figma.on("currentpagechange", emitCurrentPageChange);

async function initializeBridgeEvents() {
  try {
    await figma.loadAllPagesAsync();
    figma.on("documentchange", emitDocumentChange);
  } catch (error) {
    console.warn("Failed to enable documentchange events:", error);
  } finally {
    emitReadyEvent();
  }
}

initializeBridgeEvents();

// ─── Agent Cursor Theatre System v3 ───────────────────────────────────────────
// Event-driven, phase-based cursor theatre. Six agents with distinct roles.
// Cursors spawn lazily on first relevant operation, animate purposefully, and
// fade out gracefully when a quiet pause triggers the REVIEWING phase.

// Pre-load fonts for agent cursors
figma.loadFontAsync({ family: "Inter", style: "Bold" }).catch(function() {
  figma.loadFontAsync({ family: "Inter", style: "Semi Bold" }).catch(function() {
    figma.loadFontAsync({ family: "Inter", style: "Regular" }).catch(function() {});
  });
});

// ── Phase State Machine ────────────────────────────────────────────────────────
var PHASE = {
  IDLE: "IDLE", PLANNING: "PLANNING", SCAFFOLDING: "SCAFFOLDING",
  BUILDING: "BUILDING", STYLING: "STYLING",
  REVIEWING: "REVIEWING", FINISHING: "FINISHING", DONE: "DONE"
};
var sessionPhase = PHASE.IDLE;
var agentSpawned = {};        // { Planner: false, Onyx: false, ... }
var agentSpawnOrder = [];     // tracks spawn order for eviction
var lastActiveAgent = null;
var operationCount = 0;
var workFrame = null;         // { id, x, y, width, height }
var reviewingTimer = null;
var finishingTimer = null;

// ── Agent Configuration (6 agents) ────────────────────────────────────────────
var AGENTS = {
  Planner:  { color: {r:0.54,g:0.54,b:0.60}, hexColor: "#8A8A9A", textColor: {r:1,g:1,b:1}, role: "Planning" },
  Onyx:     { color: {r:0.43,g:0.37,b:0.85}, hexColor: "#6E5FD8", textColor: {r:1,g:1,b:1}, role: "Structure" },
  Cosmo:    { color: {r:0.23,g:0.48,b:0.84}, hexColor: "#3A7BD5", textColor: {r:1,g:1,b:1}, role: "Header / Top" },
  Mirage:   { color: {r:0.83,g:0.52,b:0.29}, hexColor: "#D4854A", textColor: {r:1,g:1,b:1}, role: "Content / Lists" },
  Iris:     { color: {r:0.18,g:0.70,b:0.63}, hexColor: "#2EB3A0", textColor: {r:1,g:1,b:1}, role: "Styling" },
  Reviewer: { color: {r:0.83,g:0.29,b:0.29}, hexColor: "#D44A4A", textColor: {r:1,g:1,b:1}, role: "QA Review" },
};

// ── Timing Constants ───────────────────────────────────────────────────────────
var CURSOR_ANIM_DURATION  = 350;   // ms standard travel
var PRE_BUILD_DELAY       = 200;   // wait before op
var POST_BUILD_DELAY      = 100;   // micro-hover after result
var SESSION_IDLE_TIMEOUT  = 20000;
var READ_OP_DELAY         = 60;
var QUIET_PAUSE_FOR_REVIEW = 3000;

// ── Shared State ──────────────────────────────────────────────────────────────
var agentCursors = {};
var generatingHeaders = {};
var cursorCleanupTimer = null;

// ── Operation Sets ─────────────────────────────────────────────────────────────
var STYLING_OPERATIONS = {
  setFills:1, setStrokes:1, createVariable:1, createVariableCollection:1,
  batchCreateVariables:1, batchUpdateVariables:1, updateVariable:1, deleteVariable:1
};
var BUILDING_OPERATIONS = {
  createChild:1, setText:1, moveNode:1, resizeNode:1,
  cloneNode:1, deleteNode:1, instantiateComponent:1, renameNode:1, setDescription:1, execute:1
};
var READ_OPERATIONS = {
  getNode:1, getSelection:1, getStatus:1, getPages:1,
  getStyles:1, getVariables:1, getComponentSets:1,
  searchComponents:1, screenshot:1, getCapabilities:1, ping:1,
};

var METHOD_STATUS_MAP = {
  createChild: "Creating element", createPage: "Creating page",
  moveNode: "Positioning", resizeNode: "Resizing",
  cloneNode: "Duplicating", deleteNode: "Removing",
  setFills: "Applying colors", setStrokes: "Setting strokes",
  getStyles: "Reading styles", getVariables: "Loading tokens",
  createVariable: "Creating token", updateVariable: "Updating token",
  createVariableCollection: "New collection",
  batchCreateVariables: "Creating tokens", batchUpdateVariables: "Updating tokens",
  deleteVariable: "Removing token",
  setText: "Writing text", renameNode: "Naming",
  setDescription: "Documenting",
  searchComponents: "Searching components", instantiateComponent: "Placing component",
  getComponentSets: "Browsing components",
  screenshot: "Capturing", getSelection: "Inspecting",
  getNode: "Reading node", execute: "Building",
  getStatus: "Checking status", getPages: "Scanning pages",
};

// ── Utility ───────────────────────────────────────────────────────────────────
function theatreDelay(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function getViewportCenter() {
  try {
    var vc = figma.viewport.center;
    return { x: vc.x, y: vc.y };
  } catch (e) {
    return { x: 400, y: 300 };
  }
}

// ── Phase Transition ──────────────────────────────────────────────────────────
function transitionPhase(newPhase) {
  if (sessionPhase === newPhase) return;
  sessionPhase = newPhase;
  figma.ui.postMessage({ type: "phase-change", phase: newPhase });
  onPhaseEnter(newPhase);
}

function onPhaseEnter(phase) {
  if (phase === PHASE.PLANNING) {
    runPlannerSequence();
  } else if (phase === PHASE.SCAFFOLDING) {
    (async function() {
      await fadeOutSingleCursor("Planner", 400);
    })();
  } else if (phase === PHASE.REVIEWING) {
    runReviewerSequence();
  } else if (phase === PHASE.FINISHING) {
    runFinishingSequence();
  } else if (phase === PHASE.DONE) {
    removeAllAgentCursorNodes();
  }
}

function resetReviewTimer() {
  if (reviewingTimer) clearTimeout(reviewingTimer);
  reviewingTimer = setTimeout(function() {
    if (sessionPhase === PHASE.BUILDING || sessionPhase === PHASE.STYLING) {
      transitionPhase(PHASE.REVIEWING);
    }
  }, QUIET_PAUSE_FOR_REVIEW);
}

function isRootFrameCreation(method, params) {
  if (method !== "createChild") return false;
  if (params.childType !== "FRAME") return false;
  if (params.parentId && params.parentId !== figma.currentPage.id) return false;
  var w = params.width || 375;
  var h = params.height || 812;
  return w >= 300 && h >= 600;
}

function advancePhaseForOperation(method, params) {
  if (sessionPhase === PHASE.IDLE) {
    transitionPhase(PHASE.PLANNING);
  } else if (sessionPhase === PHASE.PLANNING) {
    if (method === "createPage" || isRootFrameCreation(method, params)) {
      transitionPhase(PHASE.SCAFFOLDING);
    }
  } else if (sessionPhase === PHASE.SCAFFOLDING) {
    if (!isRootFrameCreation(method, params) && method !== "createPage") {
      transitionPhase(PHASE.BUILDING);
    }
  } else if (sessionPhase === PHASE.BUILDING) {
    if (STYLING_OPERATIONS[method]) {
      transitionPhase(PHASE.STYLING);
    } else {
      resetReviewTimer();
    }
  } else if (sessionPhase === PHASE.STYLING) {
    resetReviewTimer();
  }
}

// ── Cursor Creation ─────────────────────────────────────────────────────────
async function createAgentCursorNode(agentName, x, y) {
  var agentInfo = AGENTS[agentName] || AGENTS.Mirage;
  var color = agentInfo.color;
  var textColor = agentInfo.textColor;

  var POINTER_W = 14;
  var POINTER_H = 21;

  var pointer;
  try {
    pointer = figma.createVector();
    pointer.vectorPaths = [{
      windingRule: "NONZERO",
      data: "M 0 0 L 0 18 L 5 13 L 9 21 L 12 19.5 L 8 11 L 14 11 Z"
    }];
    pointer.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    pointer.strokes = [{ type: "SOLID", color: color }];
    pointer.strokeWeight = 1.5;
    pointer.resize(POINTER_W, POINTER_H);
  } catch (e) {
    pointer = figma.createRectangle();
    pointer.resize(10, 14);
    pointer.cornerRadius = 1;
    pointer.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    pointer.strokes = [{ type: "SOLID", color: color }];
    pointer.strokeWeight = 1;
  }
  pointer.name = "__agent_ptr_" + agentName;
  pointer.locked = true;
  pointer.x = x;
  pointer.y = y;
  figma.currentPage.appendChild(pointer);

  var label = figma.createFrame();
  label.name = "__agent_label_" + agentName;
  label.locked = true;
  label.fills = [{ type: "SOLID", color: color }];
  label.cornerRadius = 4;
  label.layoutMode = "HORIZONTAL";
  label.primaryAxisSizingMode = "AUTO";
  label.counterAxisSizingMode = "AUTO";
  label.paddingLeft = 6;
  label.paddingRight = 6;
  label.paddingTop = 2;
  label.paddingBottom = 2;
  label.effects = [{
    type: "DROP_SHADOW",
    color: { r: 0, g: 0, b: 0, a: 0.3 },
    offset: { x: 0, y: 2 },
    radius: 4,
    visible: true,
    blendMode: "NORMAL",
    spread: 0,
  }];
  label.x = x + POINTER_W + 2;
  label.y = y + POINTER_H - 4;
  figma.currentPage.appendChild(label);

  var fontStyle = "Regular";
  var textNode = null;
  try {
    try {
      await figma.loadFontAsync({ family: "Inter", style: "Bold" });
      fontStyle = "Bold";
    } catch (e) {
      try {
        await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
        fontStyle = "Semi Bold";
      } catch (e2) {
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      }
    }
    textNode = figma.createText();
    textNode.fontName = { family: "Inter", style: fontStyle };
    textNode.characters = agentName;
    textNode.fontSize = 10;
    textNode.fills = [{ type: "SOLID", color: textColor }];
    textNode.locked = true;
    label.appendChild(textNode);
  } catch (fontErr) {
    label.resize(50, 18);
  }

  agentCursors[agentName] = {
    pointer: pointer, label: label, text: textNode,
    x: x, y: y, fontStyle: fontStyle,
    busy: false,
  };
}

// ── Cursor Label Update ────────────────────────────────────────────────────────
function updateCursorLabel(agentName, text) {
  var cursor = agentCursors[agentName];
  if (!cursor || !cursor.text) return;
  try { cursor.text.characters = text; } catch (e) {}
}

// ── Cursor Movement (instant) ──────────────────────────────────────────────────
function moveAgentCursorTo(agentName, x, y) {
  var cursor = agentCursors[agentName];
  if (!cursor) return;
  try {
    cursor.pointer.x = x;
    cursor.pointer.y = y;
    cursor.label.x = x + 16;
    cursor.label.y = y + 17;
    cursor.x = x;
    cursor.y = y;
  } catch (e) {}
}

// ── Animated Cursor Movement ───────────────────────────────────────────────────
async function animateCursorTo(agentName, targetX, targetY, durationMs) {
  var cursor = agentCursors[agentName];
  if (!cursor) return;

  var dur = (typeof durationMs === "number") ? durationMs : CURSOR_ANIM_DURATION;
  var startX = cursor.x;
  var startY = cursor.y;
  var dx = targetX - startX;
  var dy = targetY - startY;
  var dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 15) {
    moveAgentCursorTo(agentName, targetX, targetY);
    return;
  }

  var steps = Math.max(6, Math.min(18, Math.floor(dist / 18)));
  var stepDelay = Math.floor(dur / steps);

  for (var i = 1; i <= steps; i++) {
    var t = i / steps;
    var ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    moveAgentCursorTo(agentName, startX + dx * ease, startY + dy * ease);
    if (i < steps) await theatreDelay(stepDelay);
  }
}

// ── Fade Out Single Cursor ────────────────────────────────────────────────────
async function fadeOutSingleCursor(agentName, durationMs) {
  var cursor = agentCursors[agentName];
  if (!cursor) return;
  var stepDelay = Math.floor((durationMs || 400) / 5);
  for (var step = 4; step >= 0; step--) {
    var opacity = step / 4;
    try { cursor.pointer.opacity = opacity; } catch (e) {}
    try { cursor.label.opacity = opacity; } catch (e) {}
    if (step > 0) await theatreDelay(stepDelay);
  }
  removeAgentCursorNode(agentName);
  figma.ui.postMessage({ type: "agent-despawned", agent: agentName, timestamp: Date.now() });
}

// ── Fade Out All Cursors ───────────────────────────────────────────────────────
async function fadeOutCursors(durationMs) {
  var names = Object.keys(agentCursors);
  if (names.length === 0) return;
  var dur = (typeof durationMs === "number") ? durationMs : 600;
  var stepDelay = Math.floor(dur / 5);

  for (var step = 4; step >= 0; step--) {
    var opacity = step / 4;
    for (var i = 0; i < names.length; i++) {
      var c = agentCursors[names[i]];
      if (!c) continue;
      try { c.pointer.opacity = opacity; } catch (e) {}
      try { c.label.opacity = opacity; } catch (e) {}
    }
    await theatreDelay(stepDelay);
  }

  for (var j = 0; j < names.length; j++) {
    removeAgentCursorNode(names[j]);
  }
}

// ── Absolute Position Helper ───────────────────────────────────────────────────
function getAbsolutePosition(node) {
  try {
    if (node.absoluteTransform) {
      return {
        x: node.absoluteTransform[0][2],
        y: node.absoluteTransform[1][2],
        width: node.width || 0,
        height: node.height || 0,
      };
    }
  } catch (e) {}
  return { x: node.x || 0, y: node.y || 0, width: node.width || 0, height: node.height || 0 };
}

// ── Position Info for Operation ────────────────────────────────────────────────
async function getPositionInfoForOperation(method, params) {
  var vc = getViewportCenter();
  var fallback = { x: vc.x, y: vc.y, relY: 0.5 };

  try {
    var targetNode = null;
    if (params.nodeId) targetNode = await figma.getNodeByIdAsync(params.nodeId);
    if (!targetNode && params.parentId) targetNode = await figma.getNodeByIdAsync(params.parentId);

    if (targetNode && targetNode.absoluteTransform) {
      var abs = getAbsolutePosition(targetNode);

      // Track work frame on first large root frame creation
      if (!workFrame && isRootFrameCreation(method, params)) {
        var w = params.width || 375;
        var h = params.height || 812;
        workFrame = {
          id: null,
          x: typeof params.x === "number" ? params.x : abs.x,
          y: typeof params.y === "number" ? params.y : abs.y,
          width: w, height: h,
        };
      }

      var posX, posY;
      if (params.parentId && targetNode) {
        var childCount = ("children" in targetNode) ? targetNode.children.length : 0;
        var offsetY = Math.min(childCount * 20, abs.height * 0.8);
        posX = abs.x + abs.width * 0.3;
        posY = abs.y + offsetY + 10;
      } else {
        posX = abs.x + abs.width + 6;
        posY = abs.y + Math.random() * Math.max(5, abs.height * 0.3);
      }

      var relY = workFrame
        ? Math.max(0, Math.min(1, (posY - workFrame.y) / (workFrame.height || 812)))
        : 0.5;
      return { x: posX, y: posY, relY: relY };
    }

    if (typeof params.x === "number" && typeof params.y === "number") {
      var relY2 = workFrame
        ? Math.max(0, Math.min(1, (params.y - workFrame.y) / (workFrame.height || 812)))
        : 0.5;
      return { x: params.x, y: params.y, relY: relY2 };
    }
  } catch (e) {}

  return fallback;
}

// ── Agent Resolver ─────────────────────────────────────────────────────────────
function resolveAgentForOperation(method, params, posInfo) {
  if (READ_OPERATIONS[method]) return null;
  if (sessionPhase === PHASE.PLANNING) return "Planner";
  if (sessionPhase === PHASE.REVIEWING) return "Reviewer";
  if (sessionPhase === PHASE.FINISHING || sessionPhase === PHASE.DONE) return null;

  if (STYLING_OPERATIONS[method]) return "Iris";
  if (method === "createPage") return "Onyx";
  if (isRootFrameCreation(method, params)) return "Onyx";
  if (sessionPhase === PHASE.SCAFFOLDING) return "Onyx";

  var relY = posInfo ? posInfo.relY : 0.5;
  if (sessionPhase === PHASE.BUILDING) {
    if (relY > 0.75) return "Onyx";
    if (relY < 0.20) return "Cosmo";
  }
  if (method === "setText" && relY < 0.40) return "Cosmo";

  return "Mirage";
}

// ── Bring Cursors to Front ─────────────────────────────────────────────────────
function bringCursorsToFront() {
  try {
    var names = Object.keys(agentCursors);
    for (var i = 0; i < names.length; i++) {
      var c = agentCursors[names[i]];
      if (c && c.pointer && c.pointer.parent === figma.currentPage) {
        figma.currentPage.appendChild(c.pointer);
      }
      if (c && c.label && c.label.parent === figma.currentPage) {
        figma.currentPage.appendChild(c.label);
      }
    }
  } catch (e) {}
}

// ── Evict Oldest Non-Protected Cursor ──────────────────────────────────────────
function evictOldestIdleCursor(protectedNames) {
  var protected_ = protectedNames || [];
  for (var i = 0; i < agentSpawnOrder.length; i++) {
    var name = agentSpawnOrder[i];
    if (protected_.indexOf(name) >= 0) continue;
    var cursor = agentCursors[name];
    if (cursor && !cursor.busy) {
      removeAgentCursorNode(name);
      agentSpawned[name] = false;
      figma.ui.postMessage({ type: "agent-despawned", agent: name, timestamp: Date.now() });
      return;
    }
  }
}

// ── Ensure Agent Cursor Spawned ────────────────────────────────────────────────
async function ensureAgentCursor(agentName, entryX, entryY) {
  if (agentSpawned[agentName] && agentCursors[agentName]) return;

  // Max 3 cursors active at once
  var activeCount = Object.keys(agentCursors).length;
  if (activeCount >= 3) {
    evictOldestIdleCursor(["Planner", "Reviewer"]);
  }

  await createAgentCursorNode(agentName, entryX, entryY);
  agentSpawnOrder.push(agentName);
  agentSpawned[agentName] = true;

  figma.ui.postMessage({
    type: "agent-spawned",
    agent: agentName,
    phase: sessionPhase,
    timestamp: Date.now(),
  });

  await theatreDelay(100);
}

// ── Cleanup ────────────────────────────────────────────────────────────────────
function removeAgentCursorNode(agentName) {
  var cursor = agentCursors[agentName];
  if (!cursor) return;
  try { cursor.pointer.remove(); } catch (e) {}
  try { cursor.label.remove(); } catch (e) {}
  delete agentCursors[agentName];
  var idx = agentSpawnOrder.indexOf(agentName);
  if (idx >= 0) agentSpawnOrder.splice(idx, 1);
}

function removeAllAgentCursorNodes() {
  if (reviewingTimer) { clearTimeout(reviewingTimer); reviewingTimer = null; }
  if (finishingTimer) { clearTimeout(finishingTimer); finishingTimer = null; }
  var names = Object.keys(agentCursors);
  for (var i = 0; i < names.length; i++) {
    var cursor = agentCursors[names[i]];
    if (!cursor) continue;
    try { cursor.pointer.remove(); } catch (e) {}
    try { cursor.label.remove(); } catch (e) {}
  }
  agentCursors = {};
  var headerNames = Object.keys(generatingHeaders);
  for (var j = 0; j < headerNames.length; j++) {
    try { generatingHeaders[headerNames[j]].remove(); } catch (e) {}
  }
  generatingHeaders = {};
  sessionPhase = PHASE.IDLE;
  agentSpawned = {};
  agentSpawnOrder = [];
  lastActiveAgent = null;
  operationCount = 0;
  workFrame = null;
}

function cleanupOrphanedCursors() {
  try {
    var orphans = figma.currentPage.findAll(function(n) {
      return n.name && (
        n.name.indexOf("__agent_ptr_") === 0 ||
        n.name.indexOf("__agent_label_") === 0 ||
        n.name.indexOf("__agent_cursor_") === 0 ||
        n.name.indexOf("__generating_") === 0
      );
    });
    for (var i = 0; i < orphans.length; i++) {
      try { orphans[i].remove(); } catch (e) {}
    }
  } catch (e) {}
}

// ── Generating Headers ─────────────────────────────────────────────────────────
async function addGeneratingHeader(frameName, x, y) {
  if (generatingHeaders[frameName]) return;
  try {
    var fontStyle = "Regular";
    try {
      await figma.loadFontAsync({ family: "Inter", style: "Bold" });
      fontStyle = "Bold";
    } catch (e) {
      try {
        await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
        fontStyle = "Semi Bold";
      } catch (e2) {
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      }
    }
    var header = figma.createText();
    header.name = "__generating_" + frameName;
    header.locked = true;
    header.fontName = { family: "Inter", style: fontStyle };
    header.characters = "\u2728 Generating: " + frameName;
    header.fontSize = 20;
    header.fills = [{ type: "SOLID", color: { r: 0.47, g: 0.32, b: 0.90 } }];
    header.x = x;
    figma.currentPage.appendChild(header);
    header.y = y - 40;
    generatingHeaders[frameName] = header;
  } catch (headerErr) {}
}

// ── Planner Sequence ───────────────────────────────────────────────────────────
async function runPlannerSequence() {
  try {
    var vc = getViewportCenter();
    var spawnX = vc.x + 200;
    var spawnY = vc.y - 80;
    await ensureAgentCursor("Planner", spawnX, spawnY);
    updateCursorLabel("Planner", "Understanding prompt");
    figma.ui.postMessage({
      type: "agent-activity", agent: "Planner",
      method: "plan", status: "Understanding prompt", timestamp: Date.now(),
    });
    await theatreDelay(800);
    await animateCursorTo("Planner", spawnX - 60, spawnY + 30, 400);
    await theatreDelay(1000);
    updateCursorLabel("Planner", "Breaking into sections");
    figma.ui.postMessage({
      type: "agent-activity", agent: "Planner",
      method: "plan", status: "Breaking into sections", timestamp: Date.now(),
    });
    await theatreDelay(600);
    await animateCursorTo("Planner", spawnX - 80, spawnY + 50, 400);
  } catch (e) {}
}

// ── Reviewer Sequence ──────────────────────────────────────────────────────────
async function runReviewerSequence() {
  try {
    var fx = workFrame ? workFrame.x : getViewportCenter().x - 187;
    var fy = workFrame ? workFrame.y : getViewportCenter().y - 406;
    var fw = workFrame ? (workFrame.width || 375) : 375;
    var fh = workFrame ? (workFrame.height || 812) : 812;

    await ensureAgentCursor("Reviewer", fx + fw * 0.1, fy + 10);
    updateCursorLabel("Reviewer", "Reviewing...");
    figma.ui.postMessage({
      type: "agent-activity", agent: "Reviewer",
      method: "review", status: "Scanning header", timestamp: Date.now(),
    });
    await animateCursorTo("Reviewer", fx + fw * 0.8, fy + fh * 0.12, 600);
    await theatreDelay(600);

    figma.ui.postMessage({
      type: "agent-activity", agent: "Reviewer",
      method: "review", status: "Checking content", timestamp: Date.now(),
    });
    await animateCursorTo("Reviewer", fx + fw * 0.5, fy + fh * 0.50, 700);
    await theatreDelay(600);

    updateCursorLabel("Reviewer", "Checking consistency");
    figma.ui.postMessage({
      type: "agent-activity", agent: "Reviewer",
      method: "review", status: "Checking consistency", timestamp: Date.now(),
    });
    await animateCursorTo("Reviewer", fx + fw * 0.3, fy + fh * 0.88, 700);
    await theatreDelay(600);

    transitionPhase(PHASE.FINISHING);
  } catch (e) {}
}

// ── Finishing Sequence ─────────────────────────────────────────────────────────
async function runFinishingSequence() {
  try {
    await fadeOutSingleCursor("Reviewer", 400);

    var remaining = Object.keys(agentCursors);
    for (var i = 0; i < remaining.length; i++) {
      var name = remaining[i];
      var cursor = agentCursors[name];
      if (!cursor) continue;
      updateCursorLabel(name, "Done");
      var driftX = cursor.x + (Math.random() > 0.5 ? 20 : -20);
      var driftY = cursor.y + (Math.random() > 0.5 ? 15 : -15);
      await animateCursorTo(name, driftX, driftY, 800);
      figma.ui.postMessage({
        type: "agent-activity", agent: name,
        method: "done", status: "Done", timestamp: Date.now(),
      });
    }

    await theatreDelay(500);
    await fadeOutCursors(1500);
    transitionPhase(PHASE.DONE);

    var headerNames = Object.keys(generatingHeaders);
    for (var j = 0; j < headerNames.length; j++) {
      try { generatingHeaders[headerNames[j]].remove(); } catch (e) {}
    }
    generatingHeaders = {};
    figma.ui.postMessage({ type: "agent-session-end", timestamp: Date.now() });
  } catch (e) {}
}

// ── Session Start ──────────────────────────────────────────────────────────────
function ensureSessionStarted() {
  if (sessionPhase !== PHASE.IDLE) return;
  operationCount = 0;
  agentSpawned = {};
  agentSpawnOrder = [];
  lastActiveAgent = null;
  workFrame = null;
  cleanupOrphanedCursors();
}

// ── Cleanup Timer ──────────────────────────────────────────────────────────────
function resetCursorCleanupTimer() {
  if (cursorCleanupTimer) clearTimeout(cursorCleanupTimer);
  cursorCleanupTimer = setTimeout(function() {
    if (sessionPhase !== PHASE.REVIEWING && sessionPhase !== PHASE.FINISHING && sessionPhase !== PHASE.DONE) {
      transitionPhase(PHASE.FINISHING);
    }
  }, SESSION_IDLE_TIMEOUT);
}

// ── Main Theatre Orchestrator ──────────────────────────────────────────────────
async function activateAgentForOperation(method, params) {
  if (READ_OPERATIONS[method]) {
    await theatreDelay(READ_OP_DELAY);
    return;
  }

  ensureSessionStarted();
  advancePhaseForOperation(method, params || {});

  var posInfo = await getPositionInfoForOperation(method, params || {});
  var agentName = resolveAgentForOperation(method, params || {}, posInfo);
  if (!agentName) return;

  lastActiveAgent = agentName;
  operationCount++;

  await ensureAgentCursor(agentName, posInfo.x - 40, posInfo.y);

  if (agentCursors[agentName]) {
    agentCursors[agentName].busy = true;
  }

  await animateCursorTo(agentName, posInfo.x, posInfo.y);
  bringCursorsToFront();

  if (method === "createChild" && params && params.name &&
      (params.childType === "FRAME" || params.childType === "SECTION")) {
    var hx = typeof params.x === "number" ? params.x : posInfo.x;
    var hy = typeof params.y === "number" ? params.y : posInfo.y;
    await addGeneratingHeader(params.name, hx, hy);
  }

  var status = METHOD_STATUS_MAP[method] || method;
  figma.ui.postMessage({
    type: "agent-activity",
    agent: agentName,
    method: method,
    status: status,
    phase: sessionPhase,
    timestamp: Date.now(),
  });

  await theatreDelay(PRE_BUILD_DELAY);
  resetCursorCleanupTimer();
}

// ── Post-Operation Effect ──────────────────────────────────────────────────────
async function postOperationEffect(method, params, result) {
  if (READ_OPERATIONS[method]) return;
  if (!lastActiveAgent || !agentCursors[lastActiveAgent]) return;

  var agentName = lastActiveAgent;

  if (result && result.id) {
    try {
      var newNode = await figma.getNodeByIdAsync(result.id);
      if (newNode && newNode.absoluteTransform) {
        var absNode = getAbsolutePosition(newNode);

        if (workFrame && !workFrame.id && method === "createChild" &&
            params && params.childType === "FRAME" && absNode.width >= 300 && absNode.height >= 600) {
          workFrame.id = result.id;
          workFrame.x = absNode.x;
          workFrame.y = absNode.y;
          workFrame.width = absNode.width;
          workFrame.height = absNode.height;
        }

        var resultX = absNode.x + 6;
        var resultY = absNode.y + 10;
        await animateCursorTo(agentName, resultX, resultY, 100);
      }
    } catch (e) {}
  }

  if (agentCursors[agentName]) {
    agentCursors[agentName].busy = false;
  }
  await theatreDelay(POST_BUILD_DELAY);
}

// ─── End Agent Cursor System v3 ───────────────────────────────────────────────

async function normalizeVariableValue(resolvedType, value) {
  if (value === undefined || value === null) return value;

  if (
    typeof value === "object" &&
    value &&
    value.type === "VARIABLE_ALIAS" &&
    typeof value.variableId === "string"
  ) {
    if (!figma.variables || !figma.variables.getVariableByIdAsync || !figma.variables.createVariableAlias) {
      throw new Error("Variable aliasing is unavailable in this plugin runtime");
    }
    const aliasTarget = await figma.variables.getVariableByIdAsync(value.variableId);
    if (!aliasTarget) {
      throw new Error("Alias target variable not found: " + value.variableId);
    }
    return figma.variables.createVariableAlias(aliasTarget);
  }

  if (resolvedType === "COLOR") {
    if (typeof value === "string") {
      var hex = value.trim().replace(/^#/, "");
      if (hex.length === 6 || hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16) / 255,
          g: parseInt(hex.slice(2, 4), 16) / 255,
          b: parseInt(hex.slice(4, 6), 16) / 255,
          a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
        };
      }
    }
    if (
      typeof value === "object" &&
      typeof value.r === "number" &&
      typeof value.g === "number" &&
      typeof value.b === "number"
    ) {
      return {
        r: value.r,
        g: value.g,
        b: value.b,
        a: typeof value.a === "number" ? value.a : 1,
      };
    }
    throw new Error("Invalid COLOR value: expected #RRGGBB, #RRGGBBAA, or {r,g,b,a}");
  }

  if (resolvedType === "FLOAT") {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") {
      var parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
    throw new Error("Invalid FLOAT value: expected number");
  }

  if (resolvedType === "BOOLEAN") {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error("Invalid BOOLEAN value: expected true/false");
  }

  if (resolvedType === "STRING") {
    return String(value);
  }

  return value;
}

// ─── Handle messages from the UI (which receives them from the WebSocket) ────

figma.ui.onmessage = async (msg) => {
  if (msg.type === "resize-ui") {
    var width = typeof msg.width === "number" ? Math.max(280, Math.round(msg.width)) : UI_WIDTH;
    var height = typeof msg.height === "number"
      ? Math.max(UI_MIN_HEIGHT, Math.min(UI_MAX_HEIGHT, Math.round(msg.height)))
      : UI_HEIGHT;
    UI_WIDTH = width;
    UI_HEIGHT = height;
    figma.ui.resize(UI_WIDTH, UI_HEIGHT);
    return;
  }

  // Handle agent cursor commands from UI
  if (msg.type === "agent-command") {
    if (msg.command === "cleanup") {
      removeAllAgentCursorNodes();
      cleanupOrphanedCursors();
    }
    return;
  }

  // msg: { type: "bridge-request", id: string, method: string, params: object }
  if (msg.type !== "bridge-request") return;

  const { id, method, params } = msg;

  // Activate agent cursor for this operation (errors must not block the real work)
  try { await activateAgentForOperation(method, params); } catch (e) {}

  try {
    let result;

    switch (method) {

      // ── Core: execute arbitrary plugin code ────────────────────────────
      case "execute": {
        // params.code is a string of Figma Plugin API code
        // We wrap it in an async function so `return` works
        const normalizedCode = normalizeExecuteCode(params.code);
        const fn = new Function("figma", `return (async () => { ${normalizedCode} })();`);
        result = await fn(figma);
        break;
      }

      // ── Convenience: get node by ID ────────────────────────────────────
      case "getNode": {
        const node = await figma.getNodeByIdAsync(params.nodeId);
        if (!node) throw new Error("Node not found: " + params.nodeId);
        result = serializeNode(node);
        break;
      }

      // ── Convenience: take screenshot ───────────────────────────────────
      case "screenshot": {
        const node = await figma.getNodeByIdAsync(params.nodeId);
        if (!node) throw new Error("Node not found: " + params.nodeId);
        if (!('exportAsync' in node)) throw new Error('Node does not support export');
        const bytes = await node.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: params.scale || 2 },
        });
        // Send bytes as Uint8Array; UI layer will convert to base64
        figma.ui.postMessage({
          type: "bridge-response",
          id,
          resultBytes: Array.from(bytes),
        });
        return; // early return — we sent the response directly
      }

      // ── Convenience: import image from a data URI and return image hash ──
      case "importImage": {
        if (typeof params.imageDataUri !== "string" || !params.imageDataUri.startsWith("data:image")) {
          throw new Error("importImage requires imageDataUri");
        }
        const response = await fetch(params.imageDataUri);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const image = figma.createImage(bytes);
        result = {
          imageHash: image.hash,
          byteLength: bytes.length,
        };
        break;
      }

      // ── Convenience: list pages ────────────────────────────────────────
      case "getPages": {
        result = figma.root.children.map((p) => ({
          id: p.id,
          name: p.name,
        }));
        break;
      }

      // ── Convenience: list component sets ───────────────────────────────
      case "getComponentSets": {
        var sets = figma.currentPage.findAll(function(n) { return n.type === "COMPONENT_SET"; });
        result = sets.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description || "",
          children: s.children.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
          })),
        }));
        break;
      }

      // ── Convenience: get tokens / variables ────────────────────────────
      case "getTokens": {
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const filtered = params.collectionId
          ? collections.filter((c) => c.id === params.collectionId)
          : collections;
        const tokens = [];
        for (const col of filtered) {
          for (const varId of col.variableIds) {
            const v = await figma.variables.getVariableByIdAsync(varId);
            if (!v) continue;
            const modeValues = {};
            for (const [modeId, val] of Object.entries(v.valuesByMode)) {
              const mode = col.modes.find((m) => m.modeId === modeId);
              modeValues[mode ? mode.name : modeId] = val;
            }
            var firstVal = Object.values(modeValues)[0];
            tokens.push({
              id: v.id,
              name: v.name,
              type: v.resolvedType,
              value: firstVal !== undefined ? firstVal : null,
              collectionId: col.id,
              modeValues,
              description: v.description || "",
            });
          }
        }
        result = tokens;
        break;
      }

      // ── Ping / health check ────────────────────────────────────────────
      case "ping": {
        result = {
          status: "ok",
          fileName: figma.root.name,
          pageCount: figma.root.children.length,
          timestamp: Date.now(),
        };
        break;
      }

      // ── Navigation & Status ─────────────────────────────────────────────
      case "getStatus": {
        var connStatus = "connected";
        var currentPage = figma.currentPage;
        result = {
          status: connStatus,
          fileName: figma.root.name,
          currentPage: { id: currentPage.id, name: currentPage.name },
          pageCount: figma.root.children.length,
          timestamp: Date.now(),
        };
        break;
      }

      case "getCapabilities": {
        result = getBridgeCapabilities();
        break;
      }

      case "navigate": {
        if (params.nodeId) {
          var navNode = await figma.getNodeByIdAsync(params.nodeId);
          if (navNode) figma.viewport.scrollAndZoomIntoView([navNode]);
          result = { navigated: true, nodeId: params.nodeId };
        } else {
          result = { navigated: false, error: "No nodeId provided" };
        }
        break;
      }

      case "getSelection": {
        var sel = figma.currentPage.selection;
        result = sel.map(function(n) {
          return { id: n.id, name: n.name, type: n.type };
        });
        break;
      }

      // ── Variable CRUD ──────────────────────────────────────────────────
      case "createVariableCollection": {
        var col = figma.variables.createVariableCollection(params.name);
        if (params.initialModeName && col.modes.length > 0) {
          col.renameMode(col.modes[0].modeId, params.initialModeName);
        }
        result = {
          id: col.id,
          name: col.name,
          modes: col.modes.map(function(m) { return { modeId: m.modeId, name: m.name }; }),
        };
        break;
      }

      case "createVariable": {
        var targetCollection = await figma.variables.getVariableCollectionByIdAsync(params.collectionId);
        if (!targetCollection) throw new Error("Collection not found: " + params.collectionId);
        var newVar = figma.variables.createVariable(
          params.name,
          targetCollection,
          params.resolvedType
        );
        if (params.description) newVar.description = params.description;
        if (params.valuesByMode) {
          var entries = Object.entries(params.valuesByMode);
          for (var vi = 0; vi < entries.length; vi++) {
            newVar.setValueForMode(entries[vi][0], await normalizeVariableValue(params.resolvedType, entries[vi][1]));
          }
        }
        result = { id: newVar.id, name: newVar.name, resolvedType: newVar.resolvedType };
        break;
      }

      case "updateVariable": {
        var updVar = await figma.variables.getVariableByIdAsync(params.variableId);
        if (!updVar) throw new Error("Variable not found: " + params.variableId);
        updVar.setValueForMode(params.modeId, await normalizeVariableValue(updVar.resolvedType, params.value));
        result = { id: updVar.id, name: updVar.name, updated: true };
        break;
      }

      case "deleteVariable": {
        var delVar = await figma.variables.getVariableByIdAsync(params.variableId);
        if (!delVar) throw new Error("Variable not found: " + params.variableId);
        delVar.remove();
        result = { deleted: true, variableId: params.variableId };
        break;
      }

      case "renameVariable": {
        var renVar = await figma.variables.getVariableByIdAsync(params.variableId);
        if (!renVar) throw new Error("Variable not found: " + params.variableId);
        renVar.name = params.newName;
        result = { id: renVar.id, name: renVar.name, renamed: true };
        break;
      }

      case "deleteVariableCollection": {
        var delCol = await figma.variables.getVariableCollectionByIdAsync(params.collectionId);
        if (!delCol) throw new Error("Collection not found: " + params.collectionId);
        delCol.remove();
        result = { deleted: true, collectionId: params.collectionId };
        break;
      }

      case "addMode": {
        var modeCol = await figma.variables.getVariableCollectionByIdAsync(params.collectionId);
        if (!modeCol) throw new Error("Collection not found: " + params.collectionId);
        var newMode = modeCol.addMode(params.modeName);
        result = { collectionId: params.collectionId, modeId: newMode, modeName: params.modeName };
        break;
      }

      case "renameMode": {
        var rmCol = await figma.variables.getVariableCollectionByIdAsync(params.collectionId);
        if (!rmCol) throw new Error("Collection not found: " + params.collectionId);
        rmCol.renameMode(params.modeId, params.newName);
        result = { collectionId: params.collectionId, modeId: params.modeId, newName: params.newName };
        break;
      }

      case "batchCreateVariables": {
        var batchResults = [];
        for (var bi = 0; bi < params.variables.length; bi++) {
          var spec = params.variables[bi];
          var batchCollection = await figma.variables.getVariableCollectionByIdAsync(spec.collectionId);
          if (!batchCollection) throw new Error("Collection not found: " + spec.collectionId);
          var bVar = figma.variables.createVariable(spec.name, batchCollection, spec.resolvedType);
          if (spec.description) bVar.description = spec.description;
          if (spec.valuesByMode) {
            var bEntries = Object.entries(spec.valuesByMode);
            for (var bj = 0; bj < bEntries.length; bj++) {
              bVar.setValueForMode(bEntries[bj][0], await normalizeVariableValue(spec.resolvedType, bEntries[bj][1]));
            }
          }
          batchResults.push({ id: bVar.id, name: bVar.name, resolvedType: bVar.resolvedType });
        }
        result = { created: batchResults.length, variables: batchResults };
        break;
      }

      case "batchUpdateVariables": {
        var batchUpdated = 0;
        for (var ui = 0; ui < params.updates.length; ui++) {
          var upd = params.updates[ui];
          var buVar = await figma.variables.getVariableByIdAsync(upd.variableId);
          if (buVar) {
            buVar.setValueForMode(upd.modeId, await normalizeVariableValue(buVar.resolvedType, upd.value));
            batchUpdated++;
          }
        }
        result = { updated: batchUpdated, total: params.updates.length };
        break;
      }

      // ── Node Operations ────────────────────────────────────────────────
      case "cloneNode": {
        var srcNode = await figma.getNodeByIdAsync(params.nodeId);
        if (!srcNode) throw new Error("Node not found: " + params.nodeId);
        var cloned = srcNode.clone();
        if (params.x !== undefined) cloned.x = params.x;
        if (params.y !== undefined) cloned.y = params.y;
        result = { id: cloned.id, name: cloned.name, type: cloned.type };
        break;
      }

      case "deleteNode": {
        var delNode = await figma.getNodeByIdAsync(params.nodeId);
        if (!delNode) throw new Error("Node not found: " + params.nodeId);
        delNode.remove();
        result = { deleted: true, nodeId: params.nodeId };
        break;
      }

      case "moveNode": {
        var mvNode = await figma.getNodeByIdAsync(params.nodeId);
        if (!mvNode) throw new Error("Node not found: " + params.nodeId);
        if (params.x !== undefined) mvNode.x = params.x;
        if (params.y !== undefined) mvNode.y = params.y;
        if (params.parentId) {
          var newParent = await figma.getNodeByIdAsync(params.parentId);
          if (newParent && "appendChild" in newParent) {
            newParent.appendChild(mvNode);
          }
        }
        result = { id: mvNode.id, x: mvNode.x, y: mvNode.y };
        break;
      }

      case "resizeNode": {
        var rsNode = await figma.getNodeByIdAsync(params.nodeId);
        if (!rsNode) throw new Error("Node not found: " + params.nodeId);
        if ("resize" in rsNode) {
          rsNode.resize(params.width, params.height);
        }
        result = { id: rsNode.id, width: params.width, height: params.height };
        break;
      }

      case "renameNode": {
        var rnNode = await figma.getNodeByIdAsync(params.nodeId);
        if (!rnNode) throw new Error("Node not found: " + params.nodeId);
        rnNode.name = params.newName;
        result = { id: rnNode.id, name: rnNode.name };
        break;
      }

      case "setFills": {
        var fillNode = await figma.getNodeByIdAsync(params.nodeId);
        if (!fillNode) throw new Error("Node not found: " + params.nodeId);
        if ("fills" in fillNode) {
          fillNode.fills = params.fills;
        }
        result = { id: fillNode.id, fills: params.fills };
        break;
      }

      case "setStrokes": {
        var strokeNode = await figma.getNodeByIdAsync(params.nodeId);
        if (!strokeNode) throw new Error("Node not found: " + params.nodeId);
        if ("strokes" in strokeNode) {
          strokeNode.strokes = params.strokes;
          if (params.strokeWeight !== undefined) strokeNode.strokeWeight = params.strokeWeight;
        }
        result = { id: strokeNode.id, strokes: params.strokes };
        break;
      }

      case "setText": {
        var textNode = await figma.getNodeByIdAsync(params.nodeId);
        if (!textNode) throw new Error("Node not found: " + params.nodeId);
        if (textNode.type !== "TEXT") throw new Error("Node is not a text node");
        await figma.loadFontAsync(textNode.fontName);
        textNode.characters = params.characters;
        if (params.fontSize) textNode.fontSize = params.fontSize;
        result = { id: textNode.id, characters: textNode.characters };
        break;
      }

      // ── Component Operations ───────────────────────────────────────────
      case "searchComponents": {
        var query = (params.query || "").toLowerCase();
        var limit = params.limit || 20;
        var allComponents = figma.currentPage.findAll(function(n) {
          return n.type === "COMPONENT" || n.type === "COMPONENT_SET";
        });
        var matched = [];
        for (var ci = 0; ci < allComponents.length; ci++) {
          if (allComponents[ci].name.toLowerCase().indexOf(query) !== -1) {
            matched.push({
              id: allComponents[ci].id,
              name: allComponents[ci].name,
              type: allComponents[ci].type,
              description: allComponents[ci].description || "",
            });
          }
          if (matched.length >= limit) break;
        }
        result = matched;
        break;
      }

      case "instantiateComponent": {
        var comp = null;
        if (params.nodeId) {
          comp = await figma.getNodeByIdAsync(params.nodeId);
        }
        if (!comp) throw new Error("Component not found");
        if (comp.type === "COMPONENT_SET") {
          // Find matching variant
          var targetVariant = null;
          if (params.variant) {
            var variantStr = Object.entries(params.variant).map(function(e) {
              return e[0] + "=" + e[1];
            }).join(", ");
            for (var vi2 = 0; vi2 < comp.children.length; vi2++) {
              if (comp.children[vi2].name === variantStr) {
                targetVariant = comp.children[vi2];
                break;
              }
            }
          }
          if (!targetVariant) targetVariant = comp.children[0];
          comp = targetVariant;
        }
        if (comp.type !== "COMPONENT") throw new Error("Node is not a component: " + comp.type);
        var instance = comp.createInstance();
        if (params.x !== undefined) instance.x = params.x;
        if (params.y !== undefined) instance.y = params.y;
        if (params.parentId) {
          var instParent = await figma.getNodeByIdAsync(params.parentId);
          if (instParent && "appendChild" in instParent) {
            instParent.appendChild(instance);
          }
        }
        result = { id: instance.id, name: instance.name, type: instance.type, componentId: comp.id };
        break;
      }

      case "setDescription": {
        var descNode = await figma.getNodeByIdAsync(params.nodeId);
        if (!descNode) throw new Error("Node not found: " + params.nodeId);
        if ("description" in descNode) {
          descNode.description = params.description;
        }
        result = { id: descNode.id, description: params.description };
        break;
      }

      case "getVariables": {
        if (!figma.variables || !figma.variables.getLocalVariableCollectionsAsync) {
          throw new Error("Variables API unavailable in this plugin runtime");
        }
        var verbosity = params.verbosity || "summary";
        var gvCollections = await figma.variables.getLocalVariableCollectionsAsync();
        if (params.collectionId) {
          gvCollections = gvCollections.filter(function(c) { return c.id === params.collectionId; });
        }
        var gvResult = [];
        for (var gci = 0; gci < gvCollections.length; gci++) {
          var gCol = gvCollections[gci];
          var gVars = [];
          for (var gvi = 0; gvi < gCol.variableIds.length; gvi++) {
            var gv = await figma.variables.getVariableByIdAsync(gCol.variableIds[gvi]);
            if (!gv) continue;
            var gvEntry = { id: gv.id, name: gv.name, type: gv.resolvedType };
            if (verbosity !== "inventory") {
              var gvModes = {};
              var gvModeEntries = Object.entries(gv.valuesByMode);
              for (var gmi = 0; gmi < gvModeEntries.length; gmi++) {
                var mode = gCol.modes.find(function(m) { return m.modeId === gvModeEntries[gmi][0]; });
                gvModes[mode ? mode.name : gvModeEntries[gmi][0]] = gvModeEntries[gmi][1];
              }
              gvEntry.valuesByMode = gvModes;
              if (verbosity === "full") {
                gvEntry.description = gv.description || "";
                gvEntry.collectionId = gCol.id;
                gvEntry.collectionName = gCol.name;
              }
            }
            gVars.push(gvEntry);
          }
          gvResult.push({
            id: gCol.id,
            name: gCol.name,
            modes: gCol.modes.map(function(m) { return { modeId: m.modeId, name: m.name }; }),
            variables: gVars,
          });
        }
        result = gvResult;
        break;
      }

      case "getStyles": {
        if (!figma.getLocalPaintStylesAsync || !figma.getLocalTextStylesAsync || !figma.getLocalEffectStylesAsync) {
          throw new Error("Local styles APIs unavailable in this plugin runtime");
        }
        var paintStyles = await figma.getLocalPaintStylesAsync();
        var textStyles = await figma.getLocalTextStylesAsync();
        var effectStyles = await figma.getLocalEffectStylesAsync();
        result = {
          paint: paintStyles.map(function(s) {
            return { id: s.id, name: s.name, paints: s.paints, description: s.description || "" };
          }),
          text: textStyles.map(function(s) {
            return {
              id: s.id, name: s.name,
              fontName: s.fontName, fontSize: s.fontSize,
              lineHeight: s.lineHeight, letterSpacing: s.letterSpacing,
              description: s.description || "",
            };
          }),
          effect: effectStyles.map(function(s) {
            return { id: s.id, name: s.name, effects: s.effects, description: s.description || "" };
          }),
        };
        break;
      }

      case "createChild": {
        var parentNode = params.parentId
          ? await figma.getNodeByIdAsync(params.parentId)
          : figma.currentPage;
        if (!parentNode || !("appendChild" in parentNode))
          throw new Error("Invalid parent node");
        var child;
        switch (params.childType) {
          case "FRAME":
            child = figma.createFrame();
            break;
          case "TEXT":
            child = figma.createText();
            await figma.loadFontAsync({ family: "Inter", style: "Regular" });
            if (params.characters) child.characters = params.characters;
            break;
          case "RECTANGLE":
            child = figma.createRectangle();
            break;
          case "ELLIPSE":
            child = figma.createEllipse();
            break;
          case "LINE":
            child = figma.createLine();
            break;
          case "COMPONENT":
            child = figma.createComponent();
            break;
          case "SECTION":
            child = figma.createSection();
            break;
          default:
            child = figma.createFrame();
        }
        if (params.name) child.name = params.name;
        if (params.width && params.height && "resize" in child) child.resize(params.width, params.height);
        if (params.x !== undefined) child.x = params.x;
        if (params.y !== undefined) child.y = params.y;
        parentNode.appendChild(child);
        result = { id: child.id, name: child.name, type: child.type };
        break;
      }

      case "cleanupAgentCursors": {
        removeAllAgentCursorNodes();
        cleanupOrphanedCursors();
        result = { cleaned: true };
        break;
      }

      default:
        throw new Error(`Unknown bridge method: ${method}`);
    }

    // Post-operation: cursor inspects the result (visual operations only)
    try { await postOperationEffect(method, params, result); } catch (e) {}

    figma.ui.postMessage({ type: "bridge-response", id, result });
  } catch (err) {
    figma.ui.postMessage({
      type: "bridge-response",
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serializeNode(node) {
  const base = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
  };

  if ("x" in node) {
    Object.assign(base, {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    });
  }
  if ("fills" in node) base.fills = node.fills;
  if ("strokes" in node) base.strokes = node.strokes;
  if ("effects" in node) base.effects = node.effects;
  if ("opacity" in node) base.opacity = node.opacity;
  if ("cornerRadius" in node) base.cornerRadius = node.cornerRadius;
  if ("layoutMode" in node) {
    Object.assign(base, {
      layoutMode: node.layoutMode,
      primaryAxisSizingMode: node.primaryAxisSizingMode,
      counterAxisSizingMode: node.counterAxisSizingMode,
      paddingTop: node.paddingTop,
      paddingBottom: node.paddingBottom,
      paddingLeft: node.paddingLeft,
      paddingRight: node.paddingRight,
      itemSpacing: node.itemSpacing,
    });
  }
  if ("characters" in node) {
    Object.assign(base, {
      characters: node.characters,
      fontSize: node.fontSize,
      fontName: node.fontName,
      lineHeight: node.lineHeight,
      letterSpacing: node.letterSpacing,
      textAlignHorizontal: node.textAlignHorizontal,
      textAlignVertical: node.textAlignVertical,
    });
  }
  if ("children" in node) {
    base.childCount = node.children.length;
    base.children = node.children.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    }));
  }
  if ("mainComponent" in node) {
    base.mainComponentId = node.mainComponent ? node.mainComponent.id : undefined;
    base.mainComponentName = node.mainComponent ? node.mainComponent.name : undefined;
  }

  return base;
}

// Keep plugin running
figma.on("close", () => {
  removeAllAgentCursorNodes();
  cleanupOrphanedCursors();
});

console.log("✅ Figma Intelligence Bridge Plugin loaded");
