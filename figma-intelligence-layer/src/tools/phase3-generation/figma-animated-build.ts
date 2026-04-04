// ─────────────────────────────────────────────────────────────────────────────
// figma_animated_build
// Progressively builds UI elements on canvas with a single cursor that tracks
// each creation step. Cursor moves to the element being created and shows the
// operation label — no chat bubbles, no fake multi-agent dialogue.
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../shared/figma-bridge.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type BuildStep =
  | { type: "createFrame";  name: string; x: number; y: number; w: number; h: number; color?: string; radius?: number; parentId?: string }
  | { type: "createRect";   name: string; x: number; y: number; w: number; h: number; color?: string; parentId?: string }
  | { type: "createText";   name: string; x: number; y: number; text: string; size?: number; color?: string; parentId?: string }
  | { type: "createEllipse";name: string; x: number; y: number; w: number; h: number; color?: string; parentId?: string }
  | { type: "pause";        ms: number };

export interface AnimatedBuildArgs {
  steps?: BuildStep[];
  stepDelayMs?: number;
  cursorName?: string;
  cursorColor?: string;
  useDefaultIosTemplate?: boolean;
}

export interface AnimatedBuildResult {
  stepsCompleted: number;
  framesCreated: number;
}

// ─── Cursor init (single cursor, no chat bubble) ────────────────────────────

function buildCursorInitScript(name: string, color: string): string {
  return `
(async () => {
  // Remove any stale cursors from previous runs
  figma.currentPage.findAll(n => n.name && n.name.startsWith('__cursor_')).forEach(n => n.remove());

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    return { r, g, b };
  }

  const group = figma.createFrame();
  group.name = '__cursor_build';
  group.resize(120, 40);
  group.x = 0; group.y = 0;
  group.fills = [];
  group.clipsContent = false;
  group.locked = false;

  // Pointer arrow
  const ptr = figma.createRectangle();
  ptr.name = 'ptr';
  ptr.resize(14, 20);
  ptr.x = 0; ptr.y = 0;
  ptr.rotation = -15;
  const rgb = hexToRgb(${JSON.stringify(color)});
  ptr.fills = [{ type: 'SOLID', color: rgb }];
  ptr.cornerRadius = 2;
  group.appendChild(ptr);

  // Name badge with operation label
  const badge = figma.createFrame();
  badge.name = 'badge';
  badge.resize(80, 24);
  badge.x = 18; badge.y = 0;
  badge.cornerRadius = 4;
  badge.fills = [{ type: 'SOLID', color: rgb }];
  badge.layoutMode = 'HORIZONTAL';
  badge.primaryAxisSizingMode = 'AUTO';
  badge.counterAxisSizingMode = 'AUTO';
  badge.paddingLeft = 6; badge.paddingRight = 6;
  badge.paddingTop = 4; badge.paddingBottom = 4;
  badge.primaryAxisAlignItems = 'CENTER';
  badge.counterAxisAlignItems = 'CENTER';
  const badgeText = figma.createText();
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
  badgeText.fontName = { family: 'Inter', style: 'Medium' };
  badgeText.characters = ${JSON.stringify(name)};
  badgeText.fontSize = 11;
  badgeText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  badge.appendChild(badgeText);
  group.appendChild(badge);

  figma.currentPage.appendChild(group);
  return 'cursor_initialized';
})();
`;
}

// ─── Per-step script builders ─────────────────────────────────────────────────

function buildStepScript(step: BuildStep, stepIndex: number, totalSteps: number): string {
  // Each creation step moves the cursor to the element position and updates the label
  const labelPrefix = `${stepIndex + 1}/${totalSteps}`;

  switch (step.type) {
    case "createFrame": {
      const color = step.color ?? "#FFFFFF";
      const radius = step.radius ?? 0;
      const label = `${labelPrefix} Creating: ${step.name}`;
      return `
(async () => {
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    return { r, g, b };
  }
  // Move cursor to element position
  const cursor = figma.currentPage.findOne(n => n.name === '__cursor_build');
  if (cursor) {
    cursor.x = ${step.x} - 20; cursor.y = ${step.y} - 6;
    const badge = cursor.findOne(n => n.name === 'badge');
    if (badge) {
      await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
      const txt = badge.findOne(n => n.type === 'TEXT');
      if (txt) txt.characters = ${JSON.stringify(label)};
    }
    // Bring cursor to front
    figma.currentPage.appendChild(cursor);
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
  // Keep cursor on top after element creation
  if (cursor) figma.currentPage.appendChild(cursor);
  return f.id;
})();
`;
    }

    case "createRect": {
      const color = step.color ?? "#E5E7EB";
      const label = `${labelPrefix} Creating: ${step.name}`;
      return `
(async () => {
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    return { r, g, b };
  }
  const cursor = figma.currentPage.findOne(n => n.name === '__cursor_build');
  if (cursor) {
    cursor.x = ${step.x} - 20; cursor.y = ${step.y} - 6;
    const badge = cursor.findOne(n => n.name === 'badge');
    if (badge) {
      await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
      const txt = badge.findOne(n => n.type === 'TEXT');
      if (txt) txt.characters = ${JSON.stringify(label)};
    }
    figma.currentPage.appendChild(cursor);
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
  if (cursor) figma.currentPage.appendChild(cursor);
  return r.id;
})();
`;
    }

    case "createText": {
      const size = step.size ?? 14;
      const color = step.color ?? "#111827";
      const label = `${labelPrefix} Adding text: ${step.name}`;
      return `
(async () => {
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    return { r, g, b };
  }
  const cursor = figma.currentPage.findOne(n => n.name === '__cursor_build');
  if (cursor) {
    cursor.x = ${step.x} - 20; cursor.y = ${step.y} - 6;
    const badge = cursor.findOne(n => n.name === 'badge');
    if (badge) {
      await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
      const txt = badge.findOne(n => n.type === 'TEXT');
      if (txt) txt.characters = ${JSON.stringify(label)};
    }
    figma.currentPage.appendChild(cursor);
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
  if (cursor) figma.currentPage.appendChild(cursor);
  return t.id;
})();
`;
    }

    case "createEllipse": {
      const color = step.color ?? "#E5E7EB";
      const label = `${labelPrefix} Creating: ${step.name}`;
      return `
(async () => {
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    return { r, g, b };
  }
  const cursor = figma.currentPage.findOne(n => n.name === '__cursor_build');
  if (cursor) {
    cursor.x = ${step.x} - 20; cursor.y = ${step.y} - 6;
    const badge = cursor.findOne(n => n.name === 'badge');
    if (badge) {
      await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
      const txt = badge.findOne(n => n.type === 'TEXT');
      if (txt) txt.characters = ${JSON.stringify(label)};
    }
    figma.currentPage.appendChild(cursor);
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
  if (cursor) figma.currentPage.appendChild(cursor);
  return e.id;
})();
`;
    }

    case "pause":
      return `(async () => { return 'pause'; })();`;

    default:
      return `(async () => { return 'unknown_step'; })();`;
  }
}

function buildRemoveCursorsScript(): string {
  return `
(async () => {
  const cursors = figma.currentPage.findAll(n => n.name && n.name.startsWith('__cursor_'));
  cursors.forEach(n => n.remove());
  return 'cursors_removed';
})();
`;
}

// ─── Default iOS screen template (creation steps only, no chat) ─────────────

function iosAppScreenSteps(): BuildStep[] {
  const FX = 100, FY = 100;

  return [
    { type: "createFrame",  name: "iPhone 14 Pro", x: FX, y: FY, w: 390, h: 844, color: "#FFFFFF", radius: 48 },
    { type: "createRect",   name: "Status Bar", x: FX, y: FY, w: 390, h: 44, color: "#111827" },
    { type: "createFrame",  name: "Nav Bar", x: FX, y: FY + 44, w: 390, h: 56, color: "#F9FAFB", radius: 0 },
    { type: "createText",   name: "Nav Title", x: FX + 145, y: FY + 60, text: "Home", size: 17, color: "#111827" },
    { type: "createRect",   name: "Hero Image", x: FX + 16, y: FY + 116, w: 358, h: 200, color: "#6366F1" },
    { type: "createFrame",  name: "Card 1", x: FX + 16, y: FY + 332, w: 358, h: 88, color: "#F3F4F6", radius: 12 },
    { type: "createText",   name: "Card 1 Title", x: FX + 28, y: FY + 348, text: "Recent Activity", size: 15, color: "#111827" },
    { type: "createText",   name: "Card 1 Sub", x: FX + 28, y: FY + 370, text: "3 new updates today", size: 13, color: "#6B7280" },
    { type: "createFrame",  name: "Card 2", x: FX + 16, y: FY + 432, w: 170, h: 100, color: "#EEF2FF", radius: 12 },
    { type: "createFrame",  name: "Card 3", x: FX + 204, y: FY + 432, w: 170, h: 100, color: "#FDF2F8", radius: 12 },
    { type: "createFrame",  name: "Tab Bar", x: FX, y: FY + 788, w: 390, h: 56, color: "#FFFFFF", radius: 0 },
    { type: "createEllipse",name: "Tab Home Dot", x: FX + 73, y: FY + 806, w: 20, h: 20, color: "#6366F1" },
    { type: "createEllipse",name: "Tab Search Dot", x: FX + 173, y: FY + 806, w: 20, h: 20, color: "#D1D5DB" },
    { type: "createEllipse",name: "Tab Profile Dot", x: FX + 273, y: FY + 806, w: 20, h: 20, color: "#D1D5DB" },
  ];
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function countCreationSteps(steps: BuildStep[]): number {
  return steps.filter(s =>
    s.type === "createFrame" ||
    s.type === "createRect" ||
    s.type === "createText" ||
    s.type === "createEllipse"
  ).length;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function animatedBuildHandler(args: AnimatedBuildArgs): Promise<AnimatedBuildResult> {
  const cursorName = args.cursorName ?? "MCP Power";
  const cursorColor = args.cursorColor ?? "#6E5FD8";
  const stepDelayMs = args.stepDelayMs ?? 600;

  // Resolve steps — either user-supplied or default iOS template
  const steps: BuildStep[] =
    args.steps && args.steps.length > 0
      ? args.steps
      : iosAppScreenSteps();

  // Count only creation steps for the progress label
  const totalCreationSteps = countCreationSteps(steps);

  const bridge = await getBridge();

  // 1. Send agentBuildStart event
  await bridge.execute(`
(async () => {
  figma.ui.postMessage({
    type: 'bridge-event',
    eventType: 'agentBuildStart',
    payload: { agents: [${JSON.stringify(cursorName)}] },
    timestamp: Date.now(),
  });
  return 'event_sent';
})();
`);

  // 2. Initialize single cursor
  const initResult = await bridge.execute(buildCursorInitScript(cursorName, cursorColor));
  if (!initResult.success) {
    throw new Error(`Cursor init failed: ${initResult.error}`);
  }

  // 3. Execute each step — cursor moves to each element as a side effect
  let stepsCompleted = 0;
  let creationIndex = 0;
  for (const step of steps) {
    if (step.type === "pause") {
      await sleep(step.ms);
      stepsCompleted++;
      continue;
    }
    await sleep(stepDelayMs);
    const result = await bridge.execute(buildStepScript(step, creationIndex, totalCreationSteps));
    if (!result.success) {
      console.error(`[animated-build] Step ${stepsCompleted} failed: ${result.error}`);
    }
    creationIndex++;
    stepsCompleted++;
  }

  // 4. Brief pause, then remove cursor
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
    framesCreated: totalCreationSteps,
  };
}
