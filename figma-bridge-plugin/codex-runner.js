#!/usr/bin/env node
/**
 * codex-runner.js — Spawns an OpenAI Codex CLI subprocess for chat messages.
 * Uses the user's existing Codex (ChatGPT Plus / OpenAI) subscription — no API key required.
 * Setup registers the Figma MCP server in ~/.codex/config.toml so provider
 * switching in the plugin keeps using the same bridge without a restart.
 * Install:  npm install -g @openai/codex
 * Auth:     codex login
 *
 * OPTIMIZED: Prompt bloat removed (expandShortPrompt, AGENTS.md, skill files).
 * Conversation history removed (Codex handles context natively).
 */

const { spawn, spawnSync } = require("child_process");
const { readFileSync, writeFileSync, unlinkSync, existsSync } = require("fs");
const { homedir, tmpdir } = require("os");
const { join, resolve } = require("path");

// Codex CLI binary — respects CODEX_BIN_PATH env override
const DEFAULT_CODEX_APP_BIN = "/Applications/Codex.app/Contents/Resources/codex";
const CODEX_BIN = process.env.CODEX_BIN_PATH || (existsSync(DEFAULT_CODEX_APP_BIN) ? DEFAULT_CODEX_APP_BIN : "codex");
const REPO_DIR = resolve(__dirname, "..");
const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const MCP_BUILD_PATH = join(REPO_DIR, "figma-intelligence-layer", "dist", "index.js");
const CODEX_CONFIG_CANDIDATES = [
  join(homedir(), ".codex", "config.toml"),
  join(homedir(), ".config", "codex", "config.toml"),
  join(homedir(), "Library", "Application Support", "codex", "config.toml"),
];

// Map plugin model tiers to Codex-supported model IDs.
const MODEL_MAP = {
  opus:   "gpt-5",
  sonnet: "gpt-5",
  haiku:  "gpt-5",
  "gpt-5": "gpt-5",
  "gpt-5.4": "gpt-5.4",
  "gpt-5.4-mini": "gpt-5.4-mini",
  "gpt-5-codex": "gpt-5-codex",
};

const {
  SYSTEM_PROMPT,
  buildSystemPrompt,
  buildChatPrompt,
  detectActiveSkills,
} = require("./shared-prompt-config");

// Session persistence — reuse across messages (like Claude runner's --session-id / --resume)
let activeSessionIds = { code: null, chat: null };

function resetCodexSession(mode) {
  if (mode) {
    activeSessionIds[mode] = null;
  } else {
    activeSessionIds = { code: null, chat: null };
  }
}

function readFileIfExists(filePath) {
  try {
    if (existsSync(filePath)) return readFileSync(filePath, "utf8");
  } catch {}
  return null;
}

function getFigmaTokenFromClaudeSettings() {
  try {
    const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
    return settings?.mcpServers?.["figma-intelligence-layer"]?.env?.FIGMA_ACCESS_TOKEN || "";
  } catch {
    return "";
  }
}

/**
 * Ensures figma-intelligence-layer MCP is registered in Codex config.toml.
 */
function ensureCodexMcpRegistered() {
  if (!existsSync(MCP_BUILD_PATH)) return;

  for (const p of CODEX_CONFIG_CANDIDATES) {
    const content = readFileIfExists(p);
    if (content && content.includes("figma-intelligence-layer") && content.includes(MCP_BUILD_PATH)) {
      return;
    }
  }

  const figmaToken = getFigmaTokenFromClaudeSettings();
  if (!figmaToken) return;

  spawnSync(CODEX_BIN, ["mcp", "remove", "figma-intelligence-layer"], {
    stdio: "pipe",
    env: getCleanEnv(),
  });
  const result = spawnSync(
    CODEX_BIN,
    [
      "mcp", "add", "figma-intelligence-layer",
      "--env", `FIGMA_ACCESS_TOKEN=${figmaToken}`,
      "--env", "FIGMA_BRIDGE_PORT=9001",
      "--env", "ENABLE_DECISION_LOG=true",
      "--", "node", MCP_BUILD_PATH,
    ],
    { stdio: "pipe", env: getCleanEnv() }
  );
  if (result.status === 0) {
    console.log("[codex-runner] Registered figma-intelligence-layer MCP in Codex config.");
  } else {
    console.error("[codex-runner] Failed to register MCP in Codex config:", (result.stderr || "").toString().trim());
  }
}

ensureCodexMcpRegistered();

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

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Buffer.from(normalized + padding, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function extractEmailFromAuthData(data) {
  if (!data || typeof data !== "object") return null;
  const directEmail =
    data.email ||
    data.user?.email ||
    data.account?.email ||
    data.profile?.email ||
    data.tokens?.email ||
    null;
  if (directEmail) return directEmail;

  const tokenCandidates = [
    data.token,
    data.access_token,
    data.id_token,
    data.tokens?.access_token,
    data.tokens?.id_token,
  ];

  for (const token of tokenCandidates) {
    const payload = decodeJwtPayload(token);
    const email =
      payload?.email ||
      payload?.["https://api.openai.com/profile"]?.email ||
      null;
    if (email) return email;
  }

  return null;
}

/** Check if the codex CLI binary is available */
function isCodexAvailable() {
  return new Promise((resolve) => {
    const proc = spawn(CODEX_BIN, ["--version"], { stdio: "pipe", env: getCleanEnv() });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

/**
 * Returns { loggedIn: boolean, email: string|null }
 */
function getCodexAuthInfo() {
  return new Promise((resolve) => {
    const configCandidates = [
      join(homedir(), ".codex", "auth.json"),
      join(homedir(), ".config", "codex", "auth.json"),
      join(homedir(), "Library", "Application Support", "codex", "auth.json"),
    ];

    for (const p of configCandidates) {
      if (existsSync(p)) {
        try {
          const data = JSON.parse(readFileSync(p, "utf8"));
          const email = extractEmailFromAuthData(data);
          const hasToken = Boolean(
            email ||
            data.token ||
            data.access_token ||
            data.id_token ||
            data.api_key ||
            data.tokens?.access_token ||
            data.tokens?.id_token ||
            data.tokens?.refresh_token
          );
          if (hasToken) {
            return resolve({ loggedIn: true, email });
          }
        } catch {}
      }
    }

    const proc = spawn(CODEX_BIN, ["login", "status"], {
      stdio: "pipe",
      env: getCleanEnv(),
    });
    let output = "";
    const timer = setTimeout(() => {
      try { proc.kill(); } catch {}
      resolve({ loggedIn: false, email: null });
    }, 5000);

    proc.stdout?.on("data", (d) => { output += d.toString(); });
    proc.stderr?.on("data", (d) => { output += d.toString(); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      const loggedIn =
        code === 0 ||
        output.toLowerCase().includes("logged in") ||
        output.toLowerCase().includes("authenticated") ||
        output.toLowerCase().includes("signed in");
      const emailMatch = output.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      resolve({ loggedIn, email: emailMatch ? emailMatch[0] : null });
    });
    proc.on("error", () => {
      clearTimeout(timer);
      resolve({ loggedIn: false, email: null });
    });
  });
}

function processAttachments(attachments) {
  const tempFiles = [];
  const imageArgs = [];
  let extraText = "";

  for (const att of (attachments || [])) {
    if (!att || !att.data) continue;

    if (att.isImage) {
      const match = att.data.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) continue;

      const mime = match[1];
      const b64 = match[2];
      const ext = mime.split("/")[1]?.split("+")[0] || "png";
      const tmpPath = join(
        tmpdir(),
        `figma-codex-img-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      );

      writeFileSync(tmpPath, Buffer.from(b64, "base64"));
      tempFiles.push(tmpPath);
      imageArgs.push("--image", tmpPath);

      const label = att.name ? att.name : `image.${ext}`;
      extraText += `\n\n[Image attached: ${label}]`;
    } else {
      const label = att.name
        ? `\n\n--- Attached: ${att.name} ---\n`
        : "\n\n--- Attached file ---\n";
      extraText += label + att.data;
    }
  }

  return { imageArgs, extraText, tempFiles };
}

/**
 * Spawn a Codex CLI subprocess for a single chat message.
 * Streams text back via onEvent({ type: "text_delta", delta, id }).
 * Returns the ChildProcess so the caller can kill it for abort.
 */
function runCodex({ message, attachments, conversation, requestId, model, designSystemId, mode, onEvent }) {
  const { imageArgs, extraText, tempFiles } = processAttachments(attachments);
  const sessionMode = mode || "code";

  const rawText = (message || "").trim() || "Please help with the Figma design.";
  const userMessage = `${rawText}${extraText}`;

  const openAIModel = MODEL_MAP[model] || "gpt-5";

  // Emit phase_start events (parity with Claude runner)
  if (sessionMode === "code") {
    const skills = detectActiveSkills(rawText);
    if (skills.length > 0) {
      onEvent({ type: "phase_start", id: requestId, phase: `Skills: ${skills.join(" · ")}` });
    }
    onEvent({ type: "phase_start", id: requestId, phase: `Model: ${openAIModel} · MCP: figma-intelligence-layer` });
  } else {
    onEvent({ type: "phase_start", id: requestId, phase: `Chat · ${openAIModel}` });
  }

  const activeSessionId = activeSessionIds[sessionMode];
  const systemPrompt = sessionMode === "chat" ? buildChatPrompt() : buildSystemPrompt(designSystemId);

  let args;
  if (!activeSessionId) {
    // First message — new session
    args = [
      "exec",
      "--json",
      "--skip-git-repo-check",
      "--color", "never",
      "--model", openAIModel,
      "-c", `instructions=${JSON.stringify(systemPrompt)}`,
      ...imageArgs,
    ];
    // Only enable full agent mode (sandbox bypass) in code mode
    // Chat mode stays restricted — no tool execution, no MCP calls
    if (sessionMode === "code") {
      args.push("--dangerously-bypass-approvals-and-sandbox");
    }
  } else {
    // Subsequent messages — resume existing session
    // Note: resume subcommand has fewer valid flags (no --color, no -C)
    console.log(`[codex-runner] Resuming ${sessionMode} session: ${activeSessionId}`);
    args = [
      "exec", "resume",
      activeSessionId,
      "--json",
      "--skip-git-repo-check",
      "--model", openAIModel,
      ...imageArgs,
    ];
    if (sessionMode === "code") {
      args.push("--dangerously-bypass-approvals-and-sandbox");
    }
  }

  const proc = spawn(CODEX_BIN, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: getCleanEnv(),
    cwd: REPO_DIR,
  });

  try {
    proc.stdin.write(userMessage);
    proc.stdin.end();
  } catch (e) {
    console.error("[codex-runner] Failed to write to stdin:", e.message);
  }

  proc.on("close", () => {
    for (const f of tempFiles) {
      try { unlinkSync(f); } catch {}
    }
  });

  let fullText = "";
  let stderrOutput = "";
  let stdoutBuffer = "";

  function recordCodexIssue(text) {
    if (!text) return;
    stderrOutput += text + "\n";
    console.error("[codex chat]", text);
  }

  function handleStdoutLine(line) {
    const text = line.trim();
    if (!text) return;

    try {
      const event = JSON.parse(text);

      // Capture session ID from thread.started event
      if (event.type === "thread.started" && event.thread_id) {
        if (!activeSessionIds[sessionMode]) {
          activeSessionIds[sessionMode] = event.thread_id;
          console.log(`[codex-runner] ${sessionMode} session started: ${event.thread_id}`);
        }
        return;
      }

      // Reasoning events — log but don't emit as text_delta (too noisy)
      if (event.type === "item.completed" && event.item?.type === "reasoning" && event.item.text) {
        console.log(`[codex-runner] reasoning: ${event.item.text.slice(0, 100)}...`);
        return;
      }

      // Turn completed — log token usage
      if (event.type === "turn.completed" && event.usage) {
        console.log(`[codex-runner] tokens: ${event.usage.input_tokens} in, ${event.usage.output_tokens} out`);
        return;
      }

      if (event.type === "item.completed" && event.item?.type === "agent_message" && event.item.text) {
        fullText += event.item.text;
        onEvent({ type: "text_delta", id: requestId, delta: event.item.text });
        return;
      }

      if (event.type === "item.started" && event.item?.type === "command_execution") {
        onEvent({ type: "tool_start", id: requestId, tool: "exec_command" });
        return;
      }

      if (event.type === "item.completed" && event.item?.type === "command_execution") {
        onEvent({
          type: "tool_done",
          id: requestId,
          tool: "exec_command",
          isError: event.item.exit_code !== 0,
        });
        return;
      }

      if (event.type === "item.started" && event.item?.type === "mcp_tool_call") {
        onEvent({
          type: "tool_start",
          id: requestId,
          tool: event.item.tool_name || event.item.name || "mcp_tool",
        });
        return;
      }

      if (event.type === "item.completed" && event.item?.type === "mcp_tool_call") {
        onEvent({
          type: "tool_done",
          id: requestId,
          tool: event.item.tool_name || event.item.name || "mcp_tool",
          isError: !!event.item.is_error,
        });
        return;
      }

      if (event.type === "item.completed" && event.item?.type === "error" && event.item.message) {
        recordCodexIssue(event.item.message);
        return;
      }

      if (event.type === "error" && event.message) {
        recordCodexIssue(event.message);
        return;
      }

      if (event.type === "turn.failed" && event.error?.message) {
        recordCodexIssue(event.error.message);
      }
      return;
    } catch {
      recordCodexIssue(text);
    }
  }

  proc.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || "";
    for (const line of lines) {
      handleStdoutLine(line);
    }
  });

  proc.stderr.on("data", (chunk) => {
    const lines = chunk.toString().split(/\r?\n/);
    for (const line of lines) {
      recordCodexIssue(line.trim());
    }
  });

  proc.on("close", (code) => {
    if (stdoutBuffer.trim()) {
      handleStdoutLine(stdoutBuffer);
      stdoutBuffer = "";
    }
    if (code !== 0 && code !== null && fullText === "") {
      const detail = stderrOutput.trim() || `exit code ${code}`;
      onEvent({
        type: "error",
        id: requestId,
        error: `OpenAI Codex error: ${detail}`,
      });
    }
    onEvent({ type: "done", id: requestId, fullText });
  });

  proc.on("error", (err) => {
    onEvent({
      type: "error",
      id: requestId,
      error: `Failed to start codex: ${err.message}. Install with: npm install -g @openai/codex`,
    });
    onEvent({ type: "done", id: requestId, fullText: "" });
  });

  return proc;
}

module.exports = { runCodex, isCodexAvailable, getCodexAuthInfo, resetCodexSession };
