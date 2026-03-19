"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// figma_animated_build
// Simulates multi-agent collaborative design by animating colored cursor
// overlays that move around the canvas, show chat bubbles, and progressively
// build UI elements — one step at a time — via sequential execute() calls.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.animatedBuildHandler = animatedBuildHandler;
const figma_bridge_js_1 = require("../../shared/figma-bridge.js");
// ─── Cursor overlay helpers (injected as a single init script) ───────────────
function buildCursorInitScript(agents) {
    return `
(async () => {
  // Remove any stale cursors from previous runs
  figma.currentPage.findAll(n => n.name && n.name.startsWith('__cursor_')).forEach(n => n.remove());

  for (const agent of ${JSON.stringify(agents)}) {
    const group = figma.createFrame();
    group.name = '__cursor_' + agent.id;
    group.resize(120, 80);
    group.x = 0; group.y = 0;
    group.fills = [];
    group.clipsContent = false;
    group.locked = false;

    // Pointer arrow (colored rectangle rotated 15° to mimic arrow)
    const ptr = figma.createRectangle();
    ptr.name = 'ptr';
    ptr.resize(14, 20);
    ptr.x = 0; ptr.y = 0;
    ptr.rotation = -15;
    const rgb = hexToRgb(agent.color);
    ptr.fills = [{ type: 'SOLID', color: rgb }];
    ptr.cornerRadius = 2;
    group.appendChild(ptr);

    // Name badge
    const badge = figma.createFrame();
    badge.name = 'badge';
    badge.resize(80, 24);
    badge.x = 18; badge.y = 0;
    badge.cornerRadius = 4;
    badge.fills = [{ type: 'SOLID', color: rgb }];
    badge.layoutMode = 'HORIZONTAL';
    badge.paddingLeft = 6; badge.paddingRight = 6;
    badge.paddingTop = 4; badge.paddingBottom = 4;
    badge.primaryAxisAlignItems = 'CENTER';
    badge.counterAxisAlignItems = 'CENTER';
    const badgeText = figma.createText();
    await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
    badgeText.fontName = { family: 'Inter', style: 'Medium' };
    badgeText.characters = agent.name;
    badgeText.fontSize = 11;
    badgeText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    badge.appendChild(badgeText);
    badge.resize(badgeText.width + 12, 24);
    group.appendChild(badge);

    // Chat bubble (hidden initially)
    const bubble = figma.createFrame();
    bubble.name = 'bubble';
    bubble.resize(180, 36);
    bubble.x = 0; bubble.y = 30;
    bubble.cornerRadius = 8;
    bubble.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    bubble.strokes = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
    bubble.strokeWeight = 1;
    bubble.paddingLeft = 8; bubble.paddingRight = 8;
    bubble.paddingTop = 6; bubble.paddingBottom = 6;
    bubble.layoutMode = 'HORIZONTAL';
    bubble.primaryAxisAlignItems = 'CENTER';
    bubble.counterAxisAlignItems = 'CENTER';
    bubble.visible = false;
    const bubbleText = figma.createText();
    bubbleText.fontName = { family: 'Inter', style: 'Regular' };
    bubbleText.characters = '';
    bubbleText.fontSize = 11;
    bubbleText.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
    bubble.appendChild(bubbleText);
    group.appendChild(bubble);

    figma.currentPage.appendChild(group);
  }

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    return { r, g, b };
  }

  return 'cursors_initialized';
})();
`;
}
// ─── Per-step script builders ─────────────────────────────────────────────────
function buildStepScript(step) {
    switch (step.type) {
        case "moveCursor":
            return `
(async () => {
  const cursor = figma.currentPage.findOne(n => n.name === '__cursor_${step.agentId}');
  if (cursor) { cursor.x = ${step.x}; cursor.y = ${step.y}; }
  return 'moved';
})();
`;
        case "showChat":
            return `
(async () => {
  const cursor = figma.currentPage.findOne(n => n.name === '__cursor_${step.agentId}');
  if (!cursor) return 'no_cursor';
  const bubble = cursor.findOne(n => n.name === 'bubble');
  if (!bubble) return 'no_bubble';
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  const txt = bubble.findOne(n => n.type === 'TEXT');
  if (txt) { txt.characters = ${JSON.stringify(step.text)}; }
  bubble.visible = true;
  bubble.resize(Math.min(${JSON.stringify(step.text)}.length * 7 + 20, 240), 36);
  return 'chat_shown';
})();
`;
        case "hideChat":
            return `
(async () => {
  const cursor = figma.currentPage.findOne(n => n.name === '__cursor_${step.agentId}');
  if (!cursor) return 'no_cursor';
  const bubble = cursor.findOne(n => n.name === 'bubble');
  if (bubble) bubble.visible = false;
  return 'chat_hidden';
})();
`;
        case "createFrame": {
            const color = step.color ?? "#FFFFFF";
            const radius = step.radius ?? 0;
            return `
(async () => {
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    return { r, g, b };
  }
  const f = figma.createFrame();
  f.name = ${JSON.stringify(step.name)};
  f.resize(${step.w}, ${step.h});
  f.x = ${step.x}; f.y = ${step.y};
  f.cornerRadius = ${radius};
  f.fills = [{ type: 'SOLID', color: hexToRgb(${JSON.stringify(color)}) }];
  ${step.parentId ? `
  const parent = await figma.getNodeByIdAsync(${JSON.stringify(step.parentId)});
  if (parent && 'appendChild' in parent) { parent.appendChild(f); }
  ` : ""}
  return f.id;
})();
`;
        }
        case "createRect": {
            const color = step.color ?? "#E5E7EB";
            return `
(async () => {
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    return { r, g, b };
  }
  const r = figma.createRectangle();
  r.name = ${JSON.stringify(step.name)};
  r.resize(${step.w}, ${step.h});
  r.x = ${step.x}; r.y = ${step.y};
  r.fills = [{ type: 'SOLID', color: hexToRgb(${JSON.stringify(color)}) }];
  ${step.parentId ? `
  const parent = await figma.getNodeByIdAsync(${JSON.stringify(step.parentId)});
  if (parent && 'appendChild' in parent) { parent.appendChild(r); }
  ` : ""}
  return r.id;
})();
`;
        }
        case "createText": {
            const size = step.size ?? 14;
            const color = step.color ?? "#111827";
            return `
(async () => {
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    return { r, g, b };
  }
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  const t = figma.createText();
  t.name = ${JSON.stringify(step.name)};
  t.x = ${step.x}; t.y = ${step.y};
  t.fontName = { family: 'Inter', style: 'Regular' };
  t.fontSize = ${size};
  t.characters = ${JSON.stringify(step.text)};
  t.fills = [{ type: 'SOLID', color: hexToRgb(${JSON.stringify(color)}) }];
  ${step.parentId ? `
  const parent = await figma.getNodeByIdAsync(${JSON.stringify(step.parentId)});
  if (parent && 'appendChild' in parent) { parent.appendChild(t); }
  ` : ""}
  return t.id;
})();
`;
        }
        case "createEllipse": {
            const color = step.color ?? "#E5E7EB";
            return `
(async () => {
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    return { r, g, b };
  }
  const e = figma.createEllipse();
  e.name = ${JSON.stringify(step.name)};
  e.resize(${step.w}, ${step.h});
  e.x = ${step.x}; e.y = ${step.y};
  e.fills = [{ type: 'SOLID', color: hexToRgb(${JSON.stringify(color)}) }];
  ${step.parentId ? `
  const parent = await figma.getNodeByIdAsync(${JSON.stringify(step.parentId)});
  if (parent && 'appendChild' in parent) { parent.appendChild(e); }
  ` : ""}
  return e.id;
})();
`;
        }
        case "pause":
            // Pauses are handled by the MCP tool's sleep(), not by the plugin
            return `(async () => { return 'pause'; })();`;
        default:
            return `(async () => { return 'unknown_step'; })();`;
    }
}
function buildRemoveCursorsScript() {
    return `
(async () => {
  const cursors = figma.currentPage.findAll(n => n.name && n.name.startsWith('__cursor_'));
  cursors.forEach(n => n.remove());
  return 'cursors_removed';
})();
`;
}
// ─── Default iOS screen template ─────────────────────────────────────────────
function iosAppScreenSteps() {
    // Canvas origin for the iPhone frame
    const FX = 100, FY = 100;
    return [
        // Step 1: Claude arrives at canvas center
        { type: "moveCursor", agentId: "claude", x: FX + 195, y: FY + 422 },
        { type: "showChat", agentId: "claude", text: "Starting iOS screen..." },
        // Step 2: Codex arrives top-left
        { type: "moveCursor", agentId: "codex", x: FX - 60, y: FY - 40 },
        // Step 3: Claude creates the iPhone frame
        { type: "hideChat", agentId: "claude" },
        { type: "moveCursor", agentId: "claude", x: FX, y: FY },
        { type: "createFrame", name: "iPhone 14 Pro", x: FX, y: FY, w: 390, h: 844, color: "#FFFFFF", radius: 48 },
        // Step 4: Codex announces status bar
        { type: "showChat", agentId: "codex", text: "I'll handle the status bar" },
        { type: "moveCursor", agentId: "codex", x: FX + 5, y: FY + 5 },
        // Step 5: Codex creates status bar
        { type: "hideChat", agentId: "codex" },
        { type: "createRect", name: "Status Bar", x: FX, y: FY, w: 390, h: 44, color: "#111827" },
        // Step 6: Claude announces nav bar
        { type: "showChat", agentId: "claude", text: "Navigation bar next" },
        { type: "moveCursor", agentId: "claude", x: FX, y: FY + 44 },
        // Step 7: Claude creates nav bar
        { type: "hideChat", agentId: "claude" },
        { type: "createFrame", name: "Nav Bar", x: FX, y: FY + 44, w: 390, h: 56, color: "#F9FAFB", radius: 0 },
        { type: "createText", name: "Nav Title", x: FX + 145, y: FY + 60, text: "Home", size: 17, color: "#111827" },
        // Step 8: Codex announces content cards
        { type: "showChat", agentId: "codex", text: "Adding content cards" },
        { type: "moveCursor", agentId: "codex", x: FX + 16, y: FY + 116 },
        // Step 9: Codex creates hero + cards
        { type: "hideChat", agentId: "codex" },
        { type: "createRect", name: "Hero Image", x: FX + 16, y: FY + 116, w: 358, h: 200, color: "#6366F1", },
        { type: "moveCursor", agentId: "codex", x: FX + 16, y: FY + 332 },
        { type: "createFrame", name: "Card 1", x: FX + 16, y: FY + 332, w: 358, h: 88, color: "#F3F4F6", radius: 12 },
        { type: "createText", name: "Card 1 Title", x: FX + 28, y: FY + 348, text: "Recent Activity", size: 15, color: "#111827" },
        { type: "createText", name: "Card 1 Sub", x: FX + 28, y: FY + 370, text: "3 new updates today", size: 13, color: "#6B7280" },
        { type: "moveCursor", agentId: "codex", x: FX + 16, y: FY + 432 },
        { type: "createFrame", name: "Card 2", x: FX + 16, y: FY + 432, w: 170, h: 100, color: "#EEF2FF", radius: 12 },
        { type: "createFrame", name: "Card 3", x: FX + 204, y: FY + 432, w: 170, h: 100, color: "#FDF2F8", radius: 12 },
        // Step 10: Claude creates bottom tab bar
        { type: "moveCursor", agentId: "claude", x: FX, y: FY + 788 },
        { type: "showChat", agentId: "claude", text: "Adding tab bar" },
        { type: "hideChat", agentId: "claude" },
        { type: "createFrame", name: "Tab Bar", x: FX, y: FY + 788, w: 390, h: 56, color: "#FFFFFF", radius: 0 },
        { type: "createEllipse", name: "Tab Home Dot", x: FX + 73, y: FY + 806, w: 20, h: 20, color: "#6366F1" },
        { type: "createEllipse", name: "Tab Search Dot", x: FX + 173, y: FY + 806, w: 20, h: 20, color: "#D1D5DB" },
        { type: "createEllipse", name: "Tab Profile Dot", x: FX + 273, y: FY + 806, w: 20, h: 20, color: "#D1D5DB" },
        // Step 11: Codex done
        { type: "showChat", agentId: "codex", text: "Tabs done ✓" },
        { type: "pause", ms: 1000 },
        { type: "hideChat", agentId: "codex" },
        // Step 12: Claude done
        { type: "showChat", agentId: "claude", text: "Screen complete!" },
        { type: "pause", ms: 1200 },
        { type: "hideChat", agentId: "claude" },
    ];
}
// ─── Utility ──────────────────────────────────────────────────────────────────
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function countCreationSteps(steps) {
    return steps.filter(s => s.type === "createFrame" ||
        s.type === "createRect" ||
        s.type === "createText" ||
        s.type === "createEllipse").length;
}
// ─── Main handler ─────────────────────────────────────────────────────────────
async function animatedBuildHandler(args) {
    const DEFAULT_AGENTS = [
        { id: "claude", name: "Claude", color: "#7C3AED" },
        { id: "codex", name: "Codex", color: "#0EA5E9" },
    ];
    const agents = args.agents ?? DEFAULT_AGENTS;
    const stepDelayMs = args.stepDelayMs ?? 600;
    // Resolve steps — either user-supplied or default iOS template
    const steps = args.steps && args.steps.length > 0
        ? args.steps
        : iosAppScreenSteps();
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    // 1. Send agentBuildStart event so ui.html can switch label mode
    await bridge.execute(`
(async () => {
  figma.ui.postMessage({
    type: 'bridge-event',
    eventType: 'agentBuildStart',
    payload: { agents: ${JSON.stringify(agents.map(a => a.name))} },
    timestamp: Date.now(),
  });
  return 'event_sent';
})();
`);
    // 2. Initialize cursor overlays for all agents
    const initResult = await bridge.execute(buildCursorInitScript(agents));
    if (!initResult.success) {
        throw new Error(`Cursor init failed: ${initResult.error}`);
    }
    // 3. Execute each step with delay
    let stepsCompleted = 0;
    for (const step of steps) {
        if (step.type === "pause") {
            await sleep(step.ms);
            stepsCompleted++;
            continue;
        }
        await sleep(stepDelayMs);
        const result = await bridge.execute(buildStepScript(step));
        if (!result.success) {
            // Non-fatal: log and continue so one bad step doesn't abort the animation
            console.error(`[animated-build] Step ${stepsCompleted} failed: ${result.error}`);
        }
        stepsCompleted++;
    }
    // 4. Brief pause, then remove cursors
    await sleep(800);
    await bridge.execute(buildRemoveCursorsScript());
    // 5. Send agentBuildEnd event
    await bridge.execute(`
(async () => {
  figma.ui.postMessage({
    type: 'bridge-event',
    eventType: 'agentBuildEnd',
    payload: {},
    timestamp: Date.now(),
  });
  return 'event_sent';
})();
`);
    return {
        stepsCompleted,
        framesCreated: countCreationSteps(steps),
        agentNames: agents.map(a => a.name),
    };
}
//# sourceMappingURL=figma-animated-build.js.map