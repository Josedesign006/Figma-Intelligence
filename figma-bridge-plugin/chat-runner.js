#!/usr/bin/env node
/**
 * chat-runner.js — Spawns a Claude CLI subprocess for chat messages.
 * Uses the user's existing Claude Code subscription — no API key required.
 */

const { spawn } = require("child_process");
const { writeFileSync, unlinkSync, readFileSync, mkdirSync, existsSync } = require("fs");
const { tmpdir, homedir } = require("os");
const { join, resolve } = require("path");

const REPO_DIR = resolve(__dirname, "..");
const MCP_CONFIG_PATH = join(tmpdir(), "figma-intelligence-chat-mcp.json");
const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

// Use the absolute claude binary path stored by setup.sh in launchd env.
// Falls back to "claude" when running interactively (it's on PATH then).
const CLAUDE_BIN = process.env.CLAUDE_BIN_PATH || "claude";

// Cache token and write config once at startup — not on every chat request
let _cachedToken = null;
let _cachedClaudeSettings = null;
function getFigmaToken() {
  if (_cachedToken !== null) return _cachedToken;
  try {
    if (existsSync(CLAUDE_SETTINGS_PATH)) {
      const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
      _cachedToken = settings?.mcpServers?.["figma-intelligence-layer"]?.env?.FIGMA_ACCESS_TOKEN || "";
      return _cachedToken;
    }
  } catch {}
  _cachedToken = "";
  return _cachedToken;
}

function getClaudeSettings() {
  if (_cachedClaudeSettings !== null) return _cachedClaudeSettings;
  try {
    if (existsSync(CLAUDE_SETTINGS_PATH)) {
      _cachedClaudeSettings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
      return _cachedClaudeSettings;
    }
  } catch {}
  _cachedClaudeSettings = {};
  return _cachedClaudeSettings;
}

function writeMcpConfig() {
  const figmaToken = getFigmaToken();
  const settings = getClaudeSettings();
  const existingServers =
    settings?.mcpServers && typeof settings.mcpServers === "object"
      ? settings.mcpServers
      : {};

  const config = {
    mcpServers: {
      ...existingServers,
      "figma-intelligence-layer": {
        type: "stdio",
        command: "node",
        args: [join(REPO_DIR, "figma-intelligence-layer", "dist", "index.js")],
        env: {
          FIGMA_ACCESS_TOKEN: figmaToken,
          FIGMA_BRIDGE_PORT: "9001",
          ENABLE_DECISION_LOG: "true",
        },
      },
    },
  };
  mkdirSync(tmpdir(), { recursive: true });
  writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Write config once at startup
writeMcpConfig();

const SYSTEM_PROMPT = `You are an AI design assistant embedded directly inside a Figma plugin. \
You help users create, modify, and improve their Figma designs through natural conversation, and you should favor high-quality execution over generic explanation.

You are running inside the repository that contains the plugin, AGENTS.md instructions, and local skills. \
Follow repository instructions, inspect and use relevant SKILL.md workflows when the request matches them, and use available tools proactively.

You have access to all MCP servers configured for the user in this environment, including \
figma-intelligence-layer. Do not assume only one MCP server exists. Prefer the most specific, highest-fidelity \
tool available for the request.

For Figma work:
- inspect the current file context before generating when relevant
- prefer higher-level quality-oriented tools before low-level frame construction
- use figma-intelligence-layer tools to perform actual Figma operations
- never just describe what you would do when you can execute it
- if generation is empty or weak, retry with a tighter prompt, then use a better-fit generation path, then reuse existing structure, and only then build manually
- verify results with direct inspection or screenshot before finishing

When designing, follow this pattern:
1. Understand what the user wants
2. Inspect available context, tools, and reusable assets
3. Use tools to execute changes in Figma
4. Take a screenshot to verify the result
5. Report back concisely what was done

Be direct and action-oriented. Execute first, explain briefly after.`;


function getCleanEnv() {
  const env = { ...process.env };
  // Remove ALL Claude Code vars that block nested invocations
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
 * Images are written to temp files and passed via --image flags.
 * Text/code files are appended inline to the message.
 * Returns { imageArgs, extraText, tempFiles } for cleanup after the process exits.
 */
function processAttachments(attachments) {
  const tempFiles = [];
  let extraText = "";

  for (const att of (attachments || [])) {
    if (!att || !att.data) continue;

    if (att.isImage) {
      // data is a data URI: "data:image/png;base64,XXXX..."
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
      // Text / code / doc attachment — include inline
      const label = att.name ? `\n\n--- Attached: ${att.name} ---\n` : "\n\n--- Attached file ---\n";
      extraText += label + att.data;
    }
  }

  return { imageArgs: [], extraText, tempFiles };
}

function formatConversationHistory(conversation) {
  if (!Array.isArray(conversation) || !conversation.length) return "";
  const lines = conversation
    .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant") && entry.text)
    .map((entry) => `${entry.role === "assistant" ? "Assistant" : "User"}: ${entry.text}`);
  return lines.length ? `Conversation so far:\n${lines.join("\n\n")}\n\n---\n\n` : "";
}

function buildTaskSpecificGuidance(message) {
  var text = (message || "").toLowerCase();
  var guidance = [];

  if (/(accessibility annotation|a11y annotation|screen reader annotation|keyboard annotation|focus order|tab order|aria annotation|accessibility handoff|generate a11y|accessible document)/.test(text)) {
    guidance.push(
      "This is an accessibility annotation / handoff request. Use the local skill workflow in .agents/skills/figma-a11y-annotator/SKILL.md.",
      "Do not satisfy this with a plain text note or a short summary on canvas.",
      "Generate a developer-handoff-grade artifact: resolve the target frame, inspect structure, run a11y checks, create the markdown annotation file in the workspace root, and create a dedicated annotation page in Figma."
    );
  }

  if (/(accessible|accessibility|a11y|wcag|screen reader|keyboard navigation|focus state|focus states|aria)/.test(text)) {
    guidance.push(
      "This request requires accessibility-first execution. Use the local workflow in .agents/skills/figma-accessibility/SKILL.md.",
      "Run figma_a11y_audit before and after major changes when the request is accessibility-related."
    );
  }

  if (/(screen|flow|page|dashboard|app ui|landing page|checkout|cart)/.test(text)) {
    guidance.push(
      "For Figma UI generation, follow the repository Figma workflow in AGENTS.md: inspect file context first, prefer higher-level generation tools, and verify the result."
    );
  }

  return guidance.length ? `\n\nTask-specific workflow requirements:\n- ${guidance.join("\n- ")}` : "";
}

/**
 * Spawn a claude CLI subprocess for a single chat message.
 * Streams events back via onEvent callback.
 * Returns the ChildProcess so the caller can kill it for abort.
 */
function runClaude({ message, attachments, conversation, requestId, onEvent }) {
  const { imageArgs, extraText, tempFiles } = processAttachments(attachments);

  const userText = (message || "").trim() || (extraText ? "Please analyse the attached image(s) and help me create a Figma design based on them." : "");
  const historyText = formatConversationHistory(conversation);
  const taskGuidance = buildTaskSpecificGuidance(userText);
  const fullMessage = `${SYSTEM_PROMPT}${taskGuidance}\n\n---\n\n${historyText}${userText}${extraText}`;

  const args = [
    "--print", fullMessage,
    "--output-format", "stream-json",
    "--verbose",
    "--mcp-config", MCP_CONFIG_PATH,
    "--dangerously-skip-permissions",
  ];

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

  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        handleStreamEvent(parsed, requestId, onEvent, (t) => { fullText += t; });
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
        handleStreamEvent(parsed, requestId, onEvent, (t) => { fullText += t; });
      } catch {}
    }
    if (code !== 0 && code !== null && fullText === "") {
      const detail = stderrOutput.trim() || `exit code ${code}`;
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

function handleStreamEvent(parsed, requestId, onEvent, appendText) {
  switch (parsed.type) {
    case "assistant": {
      if (parsed.message?.content) {
        for (const block of parsed.message.content) {
          if (block.type === "text") {
            appendText(block.text);
            onEvent({ type: "text_delta", id: requestId, delta: block.text });
          }
        }
      }
      break;
    }
    case "content_block_delta": {
      if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
        appendText(parsed.delta.text);
        onEvent({ type: "text_delta", id: requestId, delta: parsed.delta.text });
      }
      break;
    }
    case "tool_use": {
      onEvent({ type: "tool_start", id: requestId, tool: parsed.name || "unknown" });
      break;
    }
    case "tool_result": {
      onEvent({
        type: "tool_done",
        id: requestId,
        tool: parsed.tool || parsed.name || "unknown",
        isError: !!parsed.is_error,
      });
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

module.exports = { runClaude, isClaudeAvailable, getClaudeAuthInfo };
