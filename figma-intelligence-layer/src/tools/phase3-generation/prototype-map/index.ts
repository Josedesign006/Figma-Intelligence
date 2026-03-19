// ─────────────────────────────────────────────────────────────────────────────
// Prototype Map
// Extracts all prototype transitions from a Figma file and builds a state-
// machine model.  Supports BFS reachability filtering from a start frame,
// detailed animation-spec extraction, and output as structured JSON,
// Mermaid stateDiagram-v2 syntax, or both.
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import { PrototypeTransition } from "../../../shared/types.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PrototypeMapArgs {
  fileKey?: string;
  startFrameId?: string;
  includeAnimationSpecs?: boolean;
  outputFormat: "json" | "mermaid" | "both";
}

export interface StateNode {
  id: string;
  name: string;
  isStart: boolean;
  outgoingCount: number;
  incomingCount: number;
}

export interface StateMachine {
  states: StateNode[];
  transitions: PrototypeTransition[];
}

export interface PrototypeMapResult {
  stateMachine: StateMachine;
  mermaidDiagram: string | null;
  totalStates: number;
  totalTransitions: number;
  reachableStates: number;
  logEntryId: string;
}

// ─── Raw connection type from bridge ─────────────────────────────────────────

interface RawConnection {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  trigger: Record<string, unknown>;
  action: Record<string, unknown>;
}

// ─── Trigger normalisation ────────────────────────────────────────────────────

function normaliseTrigger(trigger: Record<string, unknown>): PrototypeTransition["trigger"] {
  const type = typeof trigger["type"] === "string" ? trigger["type"] : "ON_CLICK";
  const delay = typeof trigger["delay"] === "number" ? trigger["delay"] : undefined;

  const nodeName =
    type === "AFTER_DELAY" && delay !== undefined
      ? `${delay}ms`
      : typeof trigger["name"] === "string"
      ? trigger["name"]
      : undefined;

  return { type, nodeName };
}

// ─── Animation extraction ─────────────────────────────────────────────────────

function normaliseAnimation(
  action: Record<string, unknown>,
  includeSpecs: boolean
): PrototypeTransition["animation"] {
  const transition = (action["transition"] as Record<string, unknown> | undefined) ?? {};
  const rawType = transition["type"];

  let type = "INSTANT";
  if (typeof rawType === "string" && rawType.length > 0) {
    type = rawType;
  }

  const direction =
    typeof transition["direction"] === "string" ? transition["direction"] : undefined;

  // Figma stores duration in seconds; convert to milliseconds
  const rawDuration = transition["duration"];
  const duration =
    typeof rawDuration === "number"
      ? Math.round(rawDuration * 1000)
      : 300;

  let easing: number[] | undefined;
  if (includeSpecs) {
    const rawEasing = transition["easing"] as Record<string, unknown> | undefined;
    if (rawEasing) {
      const easingType = rawEasing["type"] as string | undefined;
      switch (easingType) {
        case "LINEAR":
          easing = [0, 0, 1, 1];
          break;
        case "EASE_IN":
          easing = [0.4, 0, 1, 1];
          break;
        case "EASE_OUT":
          easing = [0, 0, 0.2, 1];
          break;
        case "EASE_IN_AND_OUT":
          easing = [0.4, 0, 0.2, 1];
          break;
        case "CUSTOM_CUBIC_BEZIER": {
          const cb = rawEasing["easingFunctionCubicBezier"] as Record<string, number> | undefined;
          if (cb) {
            easing = [
              cb["x1"] ?? 0.4,
              cb["y1"] ?? 0,
              cb["x2"] ?? 0.2,
              cb["y2"] ?? 1,
            ];
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return { type, direction, duration, easing };
}

// ─── Raw connections → typed transitions ──────────────────────────────────────

function rawToTransition(
  raw: RawConnection,
  includeAnimationSpecs: boolean
): PrototypeTransition {
  return {
    from: raw.fromId,
    fromName: raw.fromName,
    to: raw.toId,
    toName: raw.toName,
    trigger: normaliseTrigger(raw.trigger),
    animation: normaliseAnimation(raw.action, includeAnimationSpecs),
  };
}

// ─── BFS reachability ─────────────────────────────────────────────────────────

function bfsReachable(startId: string, transitions: PrototypeTransition[]): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);

    for (const t of transitions) {
      if (t.from === current && !reachable.has(t.to)) {
        queue.push(t.to);
      }
    }
  }

  return reachable;
}

// ─── State machine builder ────────────────────────────────────────────────────

function buildStateMachine(
  transitions: PrototypeTransition[],
  startFrameId: string | undefined
): StateMachine {
  const frameMap = new Map<string, string>();
  for (const t of transitions) {
    frameMap.set(t.from, t.fromName);
    frameMap.set(t.to, t.toName);
  }

  const states: StateNode[] = [];
  for (const [id, name] of frameMap) {
    states.push({
      id,
      name,
      isStart: id === startFrameId,
      outgoingCount: transitions.filter((t) => t.from === id).length,
      incomingCount: transitions.filter((t) => t.to === id).length,
    });
  }

  return { states, transitions };
}

// ─── Mermaid generation ───────────────────────────────────────────────────────

function sanitiseMermaidId(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/__+/g, "_")
    .slice(0, 40) || "State";
}

function buildTransitionLabel(
  transition: PrototypeTransition,
  includeAnimSpecs: boolean
): string {
  const triggerLabel = transition.trigger.type
    .replace(/^ON_/, "")
    .toLowerCase()
    .replace(/_/g, " ");

  const nodePart = transition.trigger.nodeName
    ? ` "${transition.trigger.nodeName}"`
    : "";

  if (!includeAnimSpecs) return `${triggerLabel}${nodePart}`;

  const anim = transition.animation;
  const typePart = anim.type.toLowerCase().replace(/_/g, "-");
  const dirPart = anim.direction ? `-${anim.direction.toLowerCase()}` : "";
  const animLabel = `${typePart}${dirPart} ${anim.duration}ms`;

  return `${triggerLabel}${nodePart} [${animLabel}]`;
}

function generateMermaid(
  stateMachine: StateMachine,
  startFrameId: string | undefined,
  includeAnimationSpecs: boolean
): string {
  const lines: string[] = ["stateDiagram-v2"];

  // Build stable ID map, deduplicating collisions
  const idToMermaid = new Map<string, string>();
  const usedIds = new Set<string>();

  for (const state of stateMachine.states) {
    let safe = sanitiseMermaidId(state.name);
    let candidate = safe;
    let counter = 1;
    while (usedIds.has(candidate)) {
      candidate = `${safe}_${counter++}`;
    }
    idToMermaid.set(state.id, candidate);
    usedIds.add(candidate);
  }

  // State declarations with display names
  for (const state of stateMachine.states) {
    const mid = idToMermaid.get(state.id)!;
    const displayName = state.name.replace(/"/g, "'");
    lines.push(`  ${mid} : ${displayName}`);
  }

  lines.push("");

  // Initial state arrow
  if (startFrameId && idToMermaid.has(startFrameId)) {
    lines.push(`  [*] --> ${idToMermaid.get(startFrameId)}`);
  } else {
    const noIncoming = stateMachine.states.find((s) => s.incomingCount === 0);
    if (noIncoming) {
      lines.push(`  [*] --> ${idToMermaid.get(noIncoming.id)}`);
    }
  }

  // Transition edges — deduplicate identical edges
  const seen = new Set<string>();
  for (const t of stateMachine.transitions) {
    const from = idToMermaid.get(t.from);
    const to = idToMermaid.get(t.to);
    if (!from || !to) continue;

    const label = buildTransitionLabel(t, includeAnimationSpecs);
    const key = `${from}|${to}|${label}`;
    if (!seen.has(key)) {
      seen.add(key);
      lines.push(`  ${from} --> ${to} : ${label}`);
    }
  }

  return lines.join("\n");
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function prototypeMapHandler(
  args: PrototypeMapArgs
): Promise<PrototypeMapResult> {
  const {
    startFrameId,
    includeAnimationSpecs = false,
    outputFormat,
  } = args;

  const bridge = await getBridge();

  // 1. Fetch all prototype connections from Figma
  const rawConnections = await bridge.getPrototypeConnections();

  if (rawConnections.length === 0) {
    const emptyMachine: StateMachine = { states: [], transitions: [] };
    const logEntry = await decisionLog.log({
      tool: "prototype-map",
      nodeIds: [],
      rationale: "No prototype connections found in the current Figma file.",
      reversible: false,
    });

    return {
      stateMachine: emptyMachine,
      mermaidDiagram:
        outputFormat !== "json"
          ? "stateDiagram-v2\n  %% No prototype connections found"
          : null,
      totalStates: 0,
      totalTransitions: 0,
      reachableStates: 0,
      logEntryId: logEntry.id,
    };
  }

  // 2. Convert raw connections to typed PrototypeTransition objects
  let allTransitions: PrototypeTransition[] = rawConnections.map((c) =>
    rawToTransition(c, includeAnimationSpecs)
  );

  // 3. BFS filter if startFrameId provided
  let reachableCount = 0;

  if (startFrameId) {
    const reachable = bfsReachable(startFrameId, allTransitions);
    reachableCount = reachable.size;
    allTransitions = allTransitions.filter(
      (t) => reachable.has(t.from) && reachable.has(t.to)
    );
  }

  // 4. Build typed state machine
  const stateMachine = buildStateMachine(allTransitions, startFrameId);

  if (!startFrameId) {
    reachableCount = stateMachine.states.length;
  }

  // 5. Generate Mermaid diagram when requested
  let mermaidDiagram: string | null = null;
  if (outputFormat === "mermaid" || outputFormat === "both") {
    mermaidDiagram = generateMermaid(stateMachine, startFrameId, includeAnimationSpecs);
  }

  // 6. Log the decision
  const logEntry = await decisionLog.log({
    tool: "prototype-map",
    nodeIds: stateMachine.states.map((s) => s.id),
    rationale: `Extracted prototype map: ${stateMachine.states.length} states, ${stateMachine.transitions.length} transitions. Start frame: ${startFrameId ?? "all (no filter)"}. Reachable: ${reachableCount}. Output: ${outputFormat}. Animation specs: ${includeAnimationSpecs}.`,
    tokens: [],
    reversible: false,
    metadata: {
      startFrameId,
      includeAnimationSpecs,
      outputFormat,
      totalStates: stateMachine.states.length,
      totalTransitions: stateMachine.transitions.length,
      reachableStates: reachableCount,
    },
  });

  return {
    stateMachine,
    mermaidDiagram,
    totalStates: stateMachine.states.length,
    totalTransitions: stateMachine.transitions.length,
    reachableStates: reachableCount,
    logEntryId: logEntry.id,
  };
}
