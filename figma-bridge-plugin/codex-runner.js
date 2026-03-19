#!/usr/bin/env node
/**
 * codex-runner.js — Spawns an OpenAI Codex CLI subprocess for chat messages.
 * Uses the user's existing Codex (ChatGPT Plus / OpenAI) subscription — no API key required.
 * Setup registers the Figma MCP server in ~/.codex/config.toml so provider
 * switching in the plugin keeps using the same bridge without a restart.
 * Install:  npm install -g @openai/codex
 * Auth:     codex login
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
// ChatGPT-backed Codex accounts reject older chat model IDs like gpt-4o/o3.
const MODEL_MAP = {
  opus:   "gpt-5",
  sonnet: "gpt-5",
  haiku:  "gpt-5",
  "gpt-5": "gpt-5",
  "gpt-5.4": "gpt-5.4",
  "gpt-5.4-mini": "gpt-5.4-mini",
  "gpt-5-codex": "gpt-5-codex",
};

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
 * Mirrors what writeMcpConfig() does for the Claude runner — runs at module load.
 * Re-registers if missing or if the stored path no longer matches MCP_BUILD_PATH.
 */
function ensureCodexMcpRegistered() {
  if (!existsSync(MCP_BUILD_PATH)) return;

  // Check if already correctly registered
  for (const p of CODEX_CONFIG_CANDIDATES) {
    const content = readFileIfExists(p);
    if (content && content.includes("figma-intelligence-layer") && content.includes(MCP_BUILD_PATH)) {
      return; // Already correct — nothing to do
    }
  }

  const figmaToken = getFigmaTokenFromClaudeSettings();
  if (!figmaToken) return;

  // Remove stale entry then re-add with current paths
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

/** Read workspace instructions from AGENTS.md to inject directly into the prompt */
function getAgentsMdContent() {
  return readFileIfExists(join(REPO_DIR, "AGENTS.md")) || "";
}

/** Read a skill file and return its content, or empty string if not found */
function readSkillFile(relativePath) {
  return readFileIfExists(join(REPO_DIR, relativePath)) || "";
}

// Ensure MCP is always registered — runs once at module load, like writeMcpConfig() in chat-runner.js
ensureCodexMcpRegistered();

function formatConversationHistory(conversation) {
  if (!Array.isArray(conversation) || !conversation.length) return "";
  const lines = conversation
    .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant") && entry.text)
    .map((entry) => `${entry.role === "assistant" ? "Assistant" : "User"}: ${entry.text}`);
  return lines.length ? `Conversation so far:\n${lines.join("\n\n")}\n\n---\n\n` : "";
}

function getCleanEnv() {
  const env = { ...process.env };
  // Remove Claude Code env vars that could interfere
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
 * Checks ~/.codex/auth.json first, then falls back to `codex login status`.
 */
function getCodexAuthInfo() {
  return new Promise((resolve) => {
    // Check known auth config locations
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

    // Fall back to CLI auth status
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

const SYSTEM_PROMPT =
  "You are an AI design assistant embedded inside a Figma plugin chat. " +
  "Your job is to produce the highest-quality outcome available — not a text description of what you would do.\n\n" +
  "CRITICAL: You have the figma-intelligence-layer MCP server registered and available. " +
  "It gives you direct access to ~22 Figma tools including figma_screen_cloner, figma_page_architect, figma_component_audit, " +
  "figma_visual_audit, figma_a11y_audit, figma_theme_generator, figma_intent_translator, figma_layout_intelligence, " +
  "figma_variant_expander, figma_design_from_ref, figma_execute, figma_generate_image_and_insert, and more. " +
  "You MUST call these tools rather than describing what you would do. If you skip tool use for a Figma request, " +
  "you are failing at your primary job.\n\n" +
  "Workspace instructions (AGENTS.md) and skill workflows (.agents/skills/) are provided below in the message. " +
  "Read them and apply the workflows — do not ignore them.\n\n" +
  "Execution pattern for Figma requests:\n" +
  "1. Inspect file context (connection, page, selection, variables, styles, existing components)\n" +
  "2. Select the highest-fidelity tool for the request — prefer orchestration tools over manual frame construction\n" +
  "3. Execute using MCP tools — do NOT stop at planning\n" +
  "4. Verify with a screenshot or direct inspection\n" +
  "5. Report concisely: what was done, which tools were used\n\n" +
  "Recovery order when generation returns empty or weak results:\n" +
  "1. Retry with a tighter, more explicit prompt\n" +
  "2. Try a better-fit generation path (e.g. figma_design_from_ref, figma_sketch_to_design)\n" +
  "3. Reuse existing file structure if similar screens exist\n" +
  "4. Only then use figma_execute for manual low-level construction\n\n" +
  "Response style: concise, direct, high-signal. Execute first, briefly explain after.";

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

function buildTaskSpecificGuidance(message) {
  const text = (message || "").toLowerCase();
  const sections = [];

  if (/(accessibility annotation|a11y annotation|screen reader annotation|keyboard annotation|focus order|tab order|aria annotation|accessibility handoff|generate a11y|accessible document)/.test(text)) {
    const skillContent = readSkillFile(".agents/skills/figma-a11y-annotator/SKILL.md");
    sections.push(
      "=== ACCESSIBILITY ANNOTATION SKILL ===\n" +
      "This is an accessibility annotation / handoff request.\n" +
      "Do NOT satisfy this with a plain text note or short canvas summary.\n" +
      "Generate a developer-handoff-grade artifact: resolve the target frame, inspect structure, run a11y checks, " +
      "create the markdown annotation file in the workspace root, and create a dedicated annotation page in Figma.\n" +
      (skillContent ? `\nFull skill workflow:\n${skillContent}` : "") +
      "\n=== END SKILL ==="
    );
  }

  if (/(accessible|accessibility|a11y|wcag|screen reader|keyboard navigation|focus state|focus states|aria)/.test(text)) {
    const skillContent = readSkillFile(".agents/skills/figma-accessibility/SKILL.md");
    sections.push(
      "=== ACCESSIBILITY SKILL ===\n" +
      "This request requires accessibility-first execution.\n" +
      "Run figma_a11y_audit before and after major changes.\n" +
      (skillContent ? `\nFull skill workflow:\n${skillContent}` : "") +
      "\n=== END SKILL ==="
    );
  }

  if (/(screen|flow|page|dashboard|app ui|landing page|checkout|cart|design|ui|ux|wireframe|prototype|component|button|form|modal|nav|header|footer)/.test(text)) {
    const skillContent = readSkillFile(".agents/skills/ui-ux-pro-max/SKILL.md");
    sections.push(
      "=== UI/UX DESIGN SKILL ===\n" +
      "For Figma UI generation: inspect file context first, prefer figma_page_architect and figma_intent_translator, verify the result.\n" +
      (skillContent ? `\nFull skill workflow:\n${skillContent}` : "") +
      "\n=== END SKILL ==="
    );
  }

  if (/(theme|color|style|brand|dark mode|light mode|palette)/.test(text)) {
    const skillContent = readSkillFile(".agents/skills/theme-factory/SKILL.md");
    if (skillContent) {
      sections.push(
        "=== THEME SKILL ===\n" +
        skillContent +
        "\n=== END SKILL ==="
      );
    }
  }

  return sections.length ? `\n\n${sections.join("\n\n")}` : "";
}

/**
 * Spawn a Codex CLI subprocess for a single chat message.
 * Streams text back via onEvent({ type: "text_delta", delta, id }).
 * Returns the ChildProcess so the caller can kill it for abort.
 */
function runCodex({ message, attachments, conversation, requestId, model, onEvent }) {
  const { imageArgs, extraText, tempFiles } = processAttachments(attachments);

  const userText = (message || "").trim() || "Please help with the Figma design.";
  const historyText = formatConversationHistory(conversation);
  const taskGuidance = buildTaskSpecificGuidance(userText);

  const agentsMd = getAgentsMdContent();
  const agentsMdSection = agentsMd
    ? `\n\n=== AGENTS.md (workspace instructions — follow these) ===\n${agentsMd}\n=== END AGENTS.md ===`
    : "";

  const fullMessage = `${SYSTEM_PROMPT}${agentsMdSection}${taskGuidance}\n\n---\n\n${historyText}${userText}${extraText}`;

  const openAIModel = MODEL_MAP[model] || "gpt-5.4";

  // Codex CLI non-interactive flags:
  //   exec                       — run a one-shot task
  //   --json                     — emit JSONL events we can parse reliably
  //   --skip-git-repo-check      — allow running from the bridge launch dir
  //   --color never              — suppress ANSI control codes in output
  //   --model <id>               — use a Codex-supported model
  const args = [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--color", "never",
    "--dangerously-bypass-approvals-and-sandbox",
    "--model", openAIModel,
    ...imageArgs,
    fullMessage,
  ];

  const proc = spawn(CODEX_BIN, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: getCleanEnv(),
    cwd: REPO_DIR,
  });

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
      // Codex may emit warnings/log lines before or between JSON events.
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

module.exports = { runCodex, isCodexAvailable, getCodexAuthInfo };
