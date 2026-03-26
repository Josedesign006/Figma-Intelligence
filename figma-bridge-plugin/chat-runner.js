#!/usr/bin/env node
/**
 * chat-runner.js — Spawns a Claude CLI subprocess for chat messages.
 * Uses the user's existing Claude Code subscription — no API key required.
 *
 * OPTIMIZED: Session persistence via --session-id / --resume.
 * Second+ messages skip system prompt, MCP config, and conversation history.
 * Per-request disk I/O eliminated (MCP config written once at startup).
 * Prompt bloat removed (expandShortPrompt, AGENTS.md injection, skill files).
 */

const { spawn } = require("child_process");
const { writeFileSync, unlinkSync, readFileSync, mkdirSync, existsSync } = require("fs");
const { tmpdir, homedir } = require("os");
const { join, resolve } = require("path");
const crypto = require("crypto");

const {
  SYSTEM_PROMPT,
  buildSystemPrompt,
  buildChatPrompt,
  buildDualOutputPrompt,
  buildSkillAddendum,
  detectActiveSkills,
  REPO_DIR,
} = require("./shared-prompt-config");

const MCP_CONFIG_PATH = join(tmpdir(), "figma-intelligence-chat-mcp.json");
const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

// Use the absolute claude binary path stored by setup.sh in launchd env.
// Falls back to "claude" when running interactively (it's on PATH then).
const CLAUDE_BIN = process.env.CLAUDE_BIN_PATH || "claude";

// ── Session Persistence ──────────────────────────────────────────────────────
// First message uses --session-id <uuid> (creates a new session).
// Subsequent messages use --resume <uuid> (reloads full conversation context).
// No need to re-send system prompt, MCP config, or conversation history on resume.
let activeSessionIds = { code: null, chat: null, dual: null };

function resetSession(mode) {
  if (mode) {
    activeSessionIds[mode] = null;
    console.log(`[chat-runner] ${mode} session reset — next message starts a new session.`);
  } else {
    activeSessionIds = { code: null, chat: null };
    console.log("[chat-runner] All sessions reset — next message starts a new session.");
  }
}

// ── MCP Config (written once at startup) ─────────────────────────────────────

function getFigmaToken() {
  try {
    if (existsSync(CLAUDE_SETTINGS_PATH)) {
      const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
      return settings?.mcpServers?.["figma-intelligence-layer"]?.env?.FIGMA_ACCESS_TOKEN || "";
    }
  } catch {}
  return "";
}

function getClaudeSettings() {
  try {
    if (existsSync(CLAUDE_SETTINGS_PATH)) {
      return JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
    }
  } catch {}
  return {};
}

function writeMcpConfig(bridgePort) {
  const port = String(bridgePort || process.env.BRIDGE_PORT || "9001");
  const figmaToken = getFigmaToken();
  const settings = getClaudeSettings();
  const existingServers =
    settings?.mcpServers && typeof settings.mcpServers === "object"
      ? settings.mcpServers
      : {};

  const existingFigmaEnv =
    existingServers["figma-intelligence-layer"]?.env &&
    typeof existingServers["figma-intelligence-layer"].env === "object"
      ? existingServers["figma-intelligence-layer"].env
      : {};

  const designBridgeEnv =
    existingServers["design-bridge"]?.env &&
    typeof existingServers["design-bridge"].env === "object"
      ? existingServers["design-bridge"].env
      : {};

  const config = {
    mcpServers: {
      "figma-intelligence-layer": {
        type: "stdio",
        command: "node",
        args: [join(REPO_DIR, "figma-intelligence-layer", "dist", "index.js")],
        env: {
          ...(designBridgeEnv.UNSPLASH_ACCESS_KEY ? { UNSPLASH_ACCESS_KEY: designBridgeEnv.UNSPLASH_ACCESS_KEY } : {}),
          ...(designBridgeEnv.PEXELS_API_KEY ? { PEXELS_API_KEY: designBridgeEnv.PEXELS_API_KEY } : {}),
          ...(designBridgeEnv.STITCH_API_KEY ? { STITCH_API_KEY: designBridgeEnv.STITCH_API_KEY } : {}),
          ...(designBridgeEnv.GOOGLE_CLOUD_PROJECT ? { GOOGLE_CLOUD_PROJECT: designBridgeEnv.GOOGLE_CLOUD_PROJECT } : {}),
          ...(process.env.GEMINI_API_KEY ? { GEMINI_API_KEY: process.env.GEMINI_API_KEY } : {}),
          ...(process.env.UNSPLASH_ACCESS_KEY ? { UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY } : {}),
          ...existingFigmaEnv,
          FIGMA_ACCESS_TOKEN: figmaToken,
          FIGMA_BRIDGE_PORT: port,
          ENABLE_DECISION_LOG: "true",
        },
      },
    },
  };
  mkdirSync(tmpdir(), { recursive: true });
  writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`[chat-runner] MCP config written with FIGMA_BRIDGE_PORT=${port}`);
}

// Write initial config (will be rewritten with actual port once relay starts)
writeMcpConfig();

function getCleanEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE")) {
      delete env[key];
    }
  }
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

/**
 * Process file attachments from the plugin chat UI.
 * Images are written to temp files and referenced inline.
 * Text/code files are appended inline to the message.
 */
function processAttachments(attachments) {
  const tempFiles = [];
  let extraText = "";

  for (const att of (attachments || [])) {
    if (!att || !att.data) continue;

    if (att.isImage) {
      const match = att.data.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const b64 = match[2];
        const ext = mime.split("/")[1]?.split("+")[0] || "png";
        const tmpPath = join(
          tmpdir(),
          `figma-chat-img-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        );
        writeFileSync(tmpPath, Buffer.from(b64, "base64"));
        tempFiles.push(tmpPath);
        const label = att.name ? att.name : `image.${ext}`;
        extraText += `\n\n[Image attached: ${label}]\nFile path: ${tmpPath}\nPlease read and analyze this image file to understand the design.`;
      }
    } else {
      const label = att.name ? `\n\n--- Attached: ${att.name} ---\n` : "\n\n--- Attached file ---\n";
      extraText += label + att.data;
    }
  }

  return { imageArgs: [], extraText, tempFiles };
}

/**
 * Spawn a claude CLI subprocess for a single chat message.
 * Uses session persistence: first message creates session, subsequent messages resume it.
 * Streams events back via onEvent callback.
 * Returns the ChildProcess so the caller can kill it for abort.
 */
const CLAUDE_DEFAULT_MODEL = "claude-opus-4-6";
const CLAUDE_VALID_MODELS = new Set(["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"]);

function runClaude({ message, attachments, conversation, requestId, model, designSystemId, mode, frameworkConfig, onEvent }) {
  const { imageArgs, extraText, tempFiles } = processAttachments(attachments);

  const resolvedModel = CLAUDE_VALID_MODELS.has(model) ? model : CLAUDE_DEFAULT_MODEL;
  const sessionMode = mode || "code";

  const rawText = (message || "").trim() || (extraText ? "Please analyse the attached image(s) and help me create a Figma design based on them." : "");
  const userText = rawText; // No more expandShortPrompt — Claude handles short prompts natively

  const isFirstMessage = !activeSessionIds[sessionMode];

  // Generate session ID on first message
  if (isFirstMessage) {
    activeSessionIds[sessionMode] = crypto.randomUUID();
    console.log(`[chat-runner] New ${sessionMode} session: ${activeSessionIds[sessionMode]}`);
  }

  const currentSessionId = activeSessionIds[sessionMode];

  // Build user message — no more conversation history, task guidance, or AGENTS.md injection
  // Session persistence handles conversation context natively
  const userMessage = `${userText}${extraText}`;

  // Detect active skills (hoisted so it's available for system prompt injection)
  const skills = (sessionMode === "code" || sessionMode === "dual") ? detectActiveSkills(userText) : [];

  // Emit pre-flight progress
  if (sessionMode === "code" || sessionMode === "dual") {
    if (skills.length > 0) {
      onEvent({ type: "phase_start", id: requestId, phase: `Skills: ${skills.join(" · ")}` });
    }
    const modeLabel = sessionMode === "dual" ? "Dual (Design + Code)" : "Code";
    onEvent({ type: "phase_start", id: requestId, phase: `${modeLabel} · ${resolvedModel} · MCP: figma-intelligence-layer` });
  } else {
    onEvent({ type: "phase_start", id: requestId, phase: `Chat · ${resolvedModel}` });
  }

  let args;
  if (isFirstMessage) {
    // First message: create session with full config
    let baseSystemPrompt;
    if (sessionMode === "chat") {
      baseSystemPrompt = buildChatPrompt();
    } else if (sessionMode === "dual") {
      baseSystemPrompt = buildDualOutputPrompt(designSystemId, frameworkConfig);
    } else {
      baseSystemPrompt = buildSystemPrompt(designSystemId);
    }
    const fullSystemPrompt = (sessionMode === "code" || sessionMode === "dual") ? baseSystemPrompt + buildSkillAddendum(skills) : baseSystemPrompt;
    args = [
      "--model", resolvedModel,
      "--system-prompt", fullSystemPrompt,
      "--print", userMessage,
      "--output-format", "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
      "--session-id", currentSessionId,
    ];
    // In code mode, load ONLY the figma-intelligence-layer MCP server.
    // --strict-mcp-config ensures ONLY servers from --mcp-config are used,
    // ignoring Pencil, design-bridge, and any other MCP servers from
    // ~/.claude/settings.json or .vscode/mcp.json.
    if (sessionMode === "code" || sessionMode === "dual") {
      args.push("--mcp-config", MCP_CONFIG_PATH, "--strict-mcp-config");
    }
  } else {
    // Subsequent messages: resume session — context already loaded.
    // MUST re-pass --mcp-config and --strict-mcp-config on resume too,
    // otherwise Claude re-discovers Pencil and other MCP servers.
    args = [
      "--print", userMessage,
      "--output-format", "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
      "--resume", currentSessionId,
    ];
    if (sessionMode === "code" || sessionMode === "dual") {
      args.push("--mcp-config", MCP_CONFIG_PATH, "--strict-mcp-config");
    }
    console.log(`[chat-runner] Resuming ${sessionMode} session: ${currentSessionId}`);
  }

  const proc = spawn(CLAUDE_BIN, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: getCleanEnv(),
    cwd: REPO_DIR,
  });

  // Clean up temp image files once the process exits
  proc.on("close", () => {
    for (const f of tempFiles) {
      try { unlinkSync(f); } catch {}
    }
  });

  let fullText = "";
  let buffer = "";
  let stderrOutput = "";

  const eventState = {
    pendingToolsByIndex: new Map(),
    toolCallIdToName: new Map(),
  };

  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        handleStreamEvent(parsed, requestId, onEvent, (t) => { fullText += t; }, eventState);
      } catch {}
    }
  });

  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString().trim();
    stderrOutput += text + "\n";
    console.error("[claude chat]", text);
  });

  proc.on("close", (code) => {
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        handleStreamEvent(parsed, requestId, onEvent, (t) => { fullText += t; }, eventState);
      } catch {}
    }
    for (const [, { name }] of eventState.pendingToolsByIndex) {
      onEvent({ type: "tool_done", id: requestId, tool: name, isError: false });
    }
    eventState.pendingToolsByIndex.clear();
    for (const [, name] of eventState.toolCallIdToName) {
      onEvent({ type: "tool_done", id: requestId, tool: name, isError: false });
    }
    eventState.toolCallIdToName.clear();

    if (code !== 0 && code !== null && fullText === "") {
      const detail = stderrOutput.trim() || `exit code ${code}`;
      // If session resume failed, reset and let next message start fresh
      if (detail.includes("session") || detail.includes("resume")) {
        console.error(`[chat-runner] Session resume failed, resetting ${sessionMode} session.`);
        resetSession(sessionMode);
      }
      onEvent({
        type: "error",
        id: requestId,
        error: `Claude error: ${detail}`,
      });
    }
    onEvent({ type: "done", id: requestId, fullText });
  });

  proc.on("error", (err) => {
    onEvent({ type: "error", id: requestId, error: `Failed to start claude: ${err.message}` });
    onEvent({ type: "done", id: requestId, fullText: "" });
  });

  return proc;
}

/**
 * Parse a single JSONL event from Claude CLI stream-json output.
 */
function handleStreamEvent(parsed, requestId, onEvent, appendText, eventState) {
  const { pendingToolsByIndex, toolCallIdToName } = eventState;

  switch (parsed.type) {
    case "assistant": {
      if (parsed.message?.content) {
        for (const block of parsed.message.content) {
          if (block.type === "text" && block.text) {
            for (const [, name] of toolCallIdToName) {
              onEvent({ type: "tool_done", id: requestId, tool: name, isError: false });
            }
            toolCallIdToName.clear();
            appendText(block.text);
            onEvent({ type: "text_delta", id: requestId, delta: block.text });
          } else if (block.type === "tool_use" && block.name) {
            if (block.id) toolCallIdToName.set(block.id, block.name);
            onEvent({ type: "tool_start", id: requestId, tool: block.name });
          }
        }
      }
      break;
    }

    case "content_block_start": {
      const block = parsed.content_block;
      if (!block) break;
      if (block.type === "tool_use" && block.name) {
        pendingToolsByIndex.set(parsed.index, { id: block.id || null, name: block.name });
        if (block.id) toolCallIdToName.set(block.id, block.name);
        onEvent({ type: "tool_start", id: requestId, tool: block.name });
      }
      break;
    }

    case "content_block_delta": {
      if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
        if (pendingToolsByIndex.size > 0) {
          for (const [, { name }] of pendingToolsByIndex) {
            onEvent({ type: "tool_done", id: requestId, tool: name, isError: false });
          }
          pendingToolsByIndex.clear();
        }
        appendText(parsed.delta.text);
        onEvent({ type: "text_delta", id: requestId, delta: parsed.delta.text });
      }
      break;
    }

    case "user": {
      if (parsed.message?.content) {
        for (const block of parsed.message.content) {
          if (block.type === "tool_result") {
            const name = toolCallIdToName.get(block.tool_use_id) || block.tool_use_id || "tool";
            onEvent({ type: "tool_done", id: requestId, tool: name, isError: !!block.is_error });
            if (block.tool_use_id) toolCallIdToName.delete(block.tool_use_id);
          }
        }
      }
      break;
    }

    case "tool_use": {
      if (parsed.name) {
        if (parsed.id) toolCallIdToName.set(parsed.id, parsed.name);
        onEvent({ type: "tool_start", id: requestId, tool: parsed.name });
      }
      break;
    }

    case "tool_result": {
      const toolName = toolCallIdToName.get(parsed.tool_use_id) || parsed.tool || parsed.name || "tool";
      onEvent({ type: "tool_done", id: requestId, tool: toolName, isError: !!parsed.is_error });
      if (parsed.tool_use_id) toolCallIdToName.delete(parsed.tool_use_id);
      break;
    }
  }
}

/** Check if the claude CLI binary is available */
function isClaudeAvailable() {
  return new Promise((resolve) => {
    const proc = spawn(CLAUDE_BIN, ["--version"], { stdio: "pipe", env: getCleanEnv() });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

/** Returns { loggedIn: boolean, email: string|null } */
function getClaudeAuthInfo() {
  return new Promise((resolve) => {
    const proc = spawn(CLAUDE_BIN, ["auth", "status"], { stdio: "pipe", env: getCleanEnv() });
    let output = "";
    const timer = setTimeout(() => { proc.kill(); resolve({ loggedIn: false, email: null }); }, 5000);
    proc.stdout?.on("data", (d) => { output += d.toString(); });
    proc.stderr?.on("data", (d) => { output += d.toString(); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      const loggedIn = code === 0 || output.toLowerCase().includes("logged in");
      const emailMatch = output.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      resolve({ loggedIn, email: emailMatch ? emailMatch[0] : null });
    });
    proc.on("error", () => { clearTimeout(timer); resolve({ loggedIn: false, email: null }); });
  });
}

module.exports = { runClaude, resetSession, isClaudeAvailable, getClaudeAuthInfo, writeMcpConfig };
