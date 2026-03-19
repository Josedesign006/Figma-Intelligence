"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Prototype Map
// Extracts all prototype transitions from a Figma file and builds a state-
// machine model.  Supports BFS reachability filtering from a start frame,
// detailed animation-spec extraction, and output as structured JSON,
// Mermaid stateDiagram-v2 syntax, or both.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.prototypeMapHandler = prototypeMapHandler;
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
// ─── Trigger normalisation ────────────────────────────────────────────────────
function normaliseTrigger(trigger) {
    const type = typeof trigger["type"] === "string" ? trigger["type"] : "ON_CLICK";
    const delay = typeof trigger["delay"] === "number" ? trigger["delay"] : undefined;
    const nodeName = type === "AFTER_DELAY" && delay !== undefined
        ? `${delay}ms`
        : typeof trigger["name"] === "string"
            ? trigger["name"]
            : undefined;
    return { type, nodeName };
}
// ─── Animation extraction ─────────────────────────────────────────────────────
function normaliseAnimation(action, includeSpecs) {
    const transition = action["transition"] ?? {};
    const rawType = transition["type"];
    let type = "INSTANT";
    if (typeof rawType === "string" && rawType.length > 0) {
        type = rawType;
    }
    const direction = typeof transition["direction"] === "string" ? transition["direction"] : undefined;
    // Figma stores duration in seconds; convert to milliseconds
    const rawDuration = transition["duration"];
    const duration = typeof rawDuration === "number"
        ? Math.round(rawDuration * 1000)
        : 300;
    let easing;
    if (includeSpecs) {
        const rawEasing = transition["easing"];
        if (rawEasing) {
            const easingType = rawEasing["type"];
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
                    const cb = rawEasing["easingFunctionCubicBezier"];
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
function rawToTransition(raw, includeAnimationSpecs) {
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
function bfsReachable(startId, transitions) {
    const reachable = new Set();
    const queue = [startId];
    while (queue.length > 0) {
        const current = queue.shift();
        if (reachable.has(current))
            continue;
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
function buildStateMachine(transitions, startFrameId) {
    const frameMap = new Map();
    for (const t of transitions) {
        frameMap.set(t.from, t.fromName);
        frameMap.set(t.to, t.toName);
    }
    const states = [];
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
function sanitiseMermaidId(name) {
    return name
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/__+/g, "_")
        .slice(0, 40) || "State";
}
function buildTransitionLabel(transition, includeAnimSpecs) {
    const triggerLabel = transition.trigger.type
        .replace(/^ON_/, "")
        .toLowerCase()
        .replace(/_/g, " ");
    const nodePart = transition.trigger.nodeName
        ? ` "${transition.trigger.nodeName}"`
        : "";
    if (!includeAnimSpecs)
        return `${triggerLabel}${nodePart}`;
    const anim = transition.animation;
    const typePart = anim.type.toLowerCase().replace(/_/g, "-");
    const dirPart = anim.direction ? `-${anim.direction.toLowerCase()}` : "";
    const animLabel = `${typePart}${dirPart} ${anim.duration}ms`;
    return `${triggerLabel}${nodePart} [${animLabel}]`;
}
function generateMermaid(stateMachine, startFrameId, includeAnimationSpecs) {
    const lines = ["stateDiagram-v2"];
    // Build stable ID map, deduplicating collisions
    const idToMermaid = new Map();
    const usedIds = new Set();
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
        const mid = idToMermaid.get(state.id);
        const displayName = state.name.replace(/"/g, "'");
        lines.push(`  ${mid} : ${displayName}`);
    }
    lines.push("");
    // Initial state arrow
    if (startFrameId && idToMermaid.has(startFrameId)) {
        lines.push(`  [*] --> ${idToMermaid.get(startFrameId)}`);
    }
    else {
        const noIncoming = stateMachine.states.find((s) => s.incomingCount === 0);
        if (noIncoming) {
            lines.push(`  [*] --> ${idToMermaid.get(noIncoming.id)}`);
        }
    }
    // Transition edges — deduplicate identical edges
    const seen = new Set();
    for (const t of stateMachine.transitions) {
        const from = idToMermaid.get(t.from);
        const to = idToMermaid.get(t.to);
        if (!from || !to)
            continue;
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
async function prototypeMapHandler(args) {
    const { startFrameId, includeAnimationSpecs = false, outputFormat, } = args;
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    // 1. Fetch all prototype connections from Figma
    const rawConnections = await bridge.getPrototypeConnections();
    if (rawConnections.length === 0) {
        const emptyMachine = { states: [], transitions: [] };
        const logEntry = await decision_log_js_1.decisionLog.log({
            tool: "prototype-map",
            nodeIds: [],
            rationale: "No prototype connections found in the current Figma file.",
            reversible: false,
        });
        return {
            stateMachine: emptyMachine,
            mermaidDiagram: outputFormat !== "json"
                ? "stateDiagram-v2\n  %% No prototype connections found"
                : null,
            totalStates: 0,
            totalTransitions: 0,
            reachableStates: 0,
            logEntryId: logEntry.id,
        };
    }
    // 2. Convert raw connections to typed PrototypeTransition objects
    let allTransitions = rawConnections.map((c) => rawToTransition(c, includeAnimationSpecs));
    // 3. BFS filter if startFrameId provided
    let reachableCount = 0;
    if (startFrameId) {
        const reachable = bfsReachable(startFrameId, allTransitions);
        reachableCount = reachable.size;
        allTransitions = allTransitions.filter((t) => reachable.has(t.from) && reachable.has(t.to));
    }
    // 4. Build typed state machine
    const stateMachine = buildStateMachine(allTransitions, startFrameId);
    if (!startFrameId) {
        reachableCount = stateMachine.states.length;
    }
    // 5. Generate Mermaid diagram when requested
    let mermaidDiagram = null;
    if (outputFormat === "mermaid" || outputFormat === "both") {
        mermaidDiagram = generateMermaid(stateMachine, startFrameId, includeAnimationSpecs);
    }
    // 6. Log the decision
    const logEntry = await decision_log_js_1.decisionLog.log({
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
//# sourceMappingURL=index.js.map