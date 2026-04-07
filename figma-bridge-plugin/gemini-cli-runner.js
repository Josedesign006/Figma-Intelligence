#!/usr/bin/env node
/**
 * gemini-cli-runner.js — Spawns a Google Gemini CLI subprocess for chat messages.
 * Uses the user's existing Google One AI Premium / Gemini Advanced subscription.
 * No API key required — authenticates via Google OAuth (browser flow).
 *
 * Install:  npm install -g @google/gemini-cli
 * Auth:     gemini auth login   (or just run `gemini` — it prompts on first use)
 *
 * Emits the same event shape as chat-runner.js so bridge-relay can use either.
 *
 * OPTIMIZED: Prompt bloat removed (expandShortPrompt, conversation history, skill files).
 */

const { spawn, spawnSync, execSync } = require("child_process");
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require("fs");
const { homedir, platform } = require("os");
const { join, resolve } = require("path");

function getRelayPort() {
  try {
    const p = readFileSync(join(homedir(), ".figma-intelligence", "relay.port"), "utf8").trim();
    const n = parseInt(p, 10);
    if (n > 0 && n < 65536) return String(n);
  } catch {}
  return "9001";
}

const GEMINI_BIN = process.env.GEMINI_BIN_PATH || "gemini";
const REPO_DIR = resolve(__dirname, "..");
const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const MCP_BUILD_PATH = join(REPO_DIR, "figma-intelligence-layer", "dist", "index.js");
const GEMINI_SETTINGS_DIR = join(homedir(), ".gemini");
const GEMINI_SETTINGS_PATH = join(GEMINI_SETTINGS_DIR, "settings.json");

const GEMINI_AUTH_CANDIDATES = [
  join(homedir(), ".gemini", "oauth_creds.json"),
  join(homedir(), ".gemini", "credentials.json"),
  join(homedir(), ".gemini", "auth.json"),
  join(homedir(), ".config", "google", "application_default_credentials.json"),
];

// Map plugin model tier names to Gemini model IDs
const MODEL_MAP = {
  opus:                 "gemini-2.5-pro",
  sonnet:               "gemini-2.5-flash",
  haiku:                "gemini-1.5-flash-8b",
  "gemini-2.5-pro":     "gemini-2.5-pro",
  "gemini-2.5-flash":   "gemini-2.5-flash",
  "gemini-2.0-flash":   "gemini-2.0-flash",
  "gemini-1.5-flash-8b":"gemini-1.5-flash-8b",
};

const {
  SYSTEM_PROMPT,
  buildSystemPrompt,
  buildChatPrompt,
  buildSkillAddendum,
  detectActiveSkills,
} = require("./shared-prompt-config");

// ── Helpers ────────────────────────────────────────────────────────────────

function getCleanEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE")) delete env[key];
  }
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}

function getFigmaTokenFromClaudeSettings() {
  try {
    if (existsSync(CLAUDE_SETTINGS_PATH)) {
      const settings = JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
      return settings?.mcpServers?.["figma-intelligence-layer"]?.env?.FIGMA_ACCESS_TOKEN || "";
    }
  } catch {}
  return "";
}

// ── MCP Registration ────────────────────────────────────────────────────────

function ensureGeminiCliMcpRegistered() {
  if (!existsSync(MCP_BUILD_PATH)) return;

  const figmaToken = getFigmaTokenFromClaudeSettings();
  if (!figmaToken) return;

  try {
    mkdirSync(GEMINI_SETTINGS_DIR, { recursive: true });

    let settings = {};
    if (existsSync(GEMINI_SETTINGS_PATH)) {
      try { settings = JSON.parse(readFileSync(GEMINI_SETTINGS_PATH, "utf8")); } catch {}
    }

    const existing = settings?.mcpServers?.["figma-intelligence-layer"];
    if (
      existing &&
      existing.command === "node" &&
      Array.isArray(existing.args) &&
      existing.args[0] === MCP_BUILD_PATH &&
      existing.env?.FIGMA_ACCESS_TOKEN === figmaToken
    ) {
      return;
    }

    if (!settings.mcpServers) settings.mcpServers = {};
    settings.mcpServers["figma-intelligence-layer"] = {
      command: "node",
      args: [MCP_BUILD_PATH],
      env: {
        FIGMA_ACCESS_TOKEN: figmaToken,
        FIGMA_BRIDGE_PORT: getRelayPort(),
        ENABLE_DECISION_LOG: "true",
      },
    };

    writeFileSync(GEMINI_SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.log("[gemini-cli-runner] Registered figma-intelligence-layer MCP in ~/.gemini/settings.json");
  } catch (err) {
    console.error("[gemini-cli-runner] Could not update ~/.gemini/settings.json:", err.message);
  }
}

ensureGeminiCliMcpRegistered();

// ── Auth Detection ──────────────────────────────────────────────────────────

function isGeminiCliAvailable() {
  return new Promise((resolve) => {
    const proc = spawn(GEMINI_BIN, ["--version"], { stdio: "pipe", env: getCleanEnv() });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

async function getGeminiCliAuthInfo() {
  if (platform() === "darwin") {
    try {
      execSync(
        'security find-generic-password -s "gemini-cli-oauth" -a "main-account" 2>/dev/null',
        { stdio: "pipe" }
      );
      let email = null;
      try {
        const raw = execSync(
          'security find-generic-password -s "gemini-cli-oauth" -a "main-account" -w 2>/dev/null',
          { stdio: "pipe" }
        ).toString().trim();
        const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8") || raw);
        email = parsed?.email || parsed?.client_email || parsed?.user?.email || null;
      } catch {}
      return { loggedIn: true, email };
    } catch {}
  }

  const oauthCredsPath = join(homedir(), ".gemini", "oauth_creds.json");
  if (existsSync(oauthCredsPath)) {
    try {
      const data = JSON.parse(readFileSync(oauthCredsPath, "utf8"));
      const email = data.email || data.client_email || data.user?.email || null;
      if (data.access_token || data.refresh_token || data.client_email || email || data.token) {
        return { loggedIn: true, email };
      }
    } catch {}
  }

  for (const p of GEMINI_AUTH_CANDIDATES) {
    if (existsSync(p)) {
      try {
        const data = JSON.parse(readFileSync(p, "utf8"));
        const email = data.email || data.client_email || data.user?.email || null;
        if (data.access_token || data.refresh_token || data.client_email || email || data.token) {
          return { loggedIn: true, email };
        }
      } catch {}
    }
  }

  return { loggedIn: false, email: null };
}

// ── Chat Runner ─────────────────────────────────────────────────────────────

function runGeminiCli({ message, attachments, conversation, requestId, model, designSystemId, mode, onEvent }) {
  const rawText = (message || "").trim() || "Please help with the Figma design.";
  const userText = rawText; // No more expandShortPrompt

  // Process text attachments
  let extraText = "";
  for (const att of (attachments || [])) {
    if (!att?.data) continue;
    if (att.isImage) {
      extraText += `\n\n[Image attached: ${att.name || "image"} — visual context noted]`;
    } else {
      const label = att.name ? `\n\n--- Attached: ${att.name} ---\n` : "\n\n--- Attached file ---\n";
      extraText += label + att.data;
    }
  }

  // Slimmed prompt: system prompt + user message (no task guidance, no history, no AGENTS.md)
  const sessionMode = mode || "code";
  const basePrompt = sessionMode === "chat" ? buildChatPrompt() : buildSystemPrompt(designSystemId);
  const skills = detectActiveSkills(userText);
  const systemPrompt = sessionMode === "code" ? basePrompt + buildSkillAddendum(skills) : basePrompt;
  const fullMessage = `${systemPrompt}\n\n---\n\n${userText}${extraText}`;
  const geminiModel = MODEL_MAP[model] || "gemini-2.5-flash";

  // In chat mode, skip MCP server loading for faster startup (~10s saved)
  const isChatOnly = sessionMode === "chat";
  const args = [
    "--model", geminiModel,
    "--yolo",
    ...(isChatOnly ? ["--sandbox", "--allowed-mcp-server-names", ""] : []),
    "-p", fullMessage,
  ];

  const proc = spawn(GEMINI_BIN, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: getCleanEnv(),
    cwd: REPO_DIR,
  });

  let fullText = "";
  let stderrOutput = "";
  let lastActivity = Date.now();
  let killed = false;
  const TIMEOUT_MS = 45_000;

  const timeoutCheck = setInterval(() => {
    if (Date.now() - lastActivity > TIMEOUT_MS) {
      clearInterval(timeoutCheck);
      killed = true;
      try { proc.kill("SIGTERM"); } catch {}
      onEvent({ type: "error", id: requestId, error: "Gemini CLI timed out (45s with no response). Your authentication may have expired — run 'gemini auth login' to re-authenticate." });
      onEvent({ type: "done", id: requestId, fullText: "" });
    }
  }, 5_000);

  proc.stdout.on("data", (chunk) => {
    lastActivity = Date.now();
    const text = chunk.toString();
    fullText += text;
    onEvent({ type: "text_delta", id: requestId, delta: text });
  });

  proc.stderr.on("data", (chunk) => {
    lastActivity = Date.now();
    const text = chunk.toString().trim();
    if (text) {
      stderrOutput += text + "\n";
      console.error("[gemini-cli chat]", text);

      // Detect fatal errors from Gemini API and fail fast instead of retrying
      if (!killed && /MODEL_CAPACITY_EXHAUSTED|exhausted your capacity|ModelNotFoundError|Requested entity was not found/i.test(text)) {
        killed = true;
        clearInterval(timeoutCheck);
        try { proc.kill("SIGTERM"); } catch {}
        const isCapacity = /capacity/i.test(text);
        const errMsg = isCapacity
          ? `Gemini model "${geminiModel}" is at capacity. Try switching to a different model (e.g. Gemini 2.5 Flash or Gemini 2.0 Flash).`
          : `Gemini model "${geminiModel}" is not available. Try switching to Gemini 2.5 Flash.`;
        onEvent({ type: "error", id: requestId, error: errMsg });
        onEvent({ type: "done", id: requestId, fullText: "" });
      }
    }
  });

  proc.on("close", (code) => {
    clearInterval(timeoutCheck);
    if (killed) return; // Already reported error
    if (code !== 0 && code !== null && fullText === "") {
      const detail = stderrOutput.trim().split("\n").pop() || `exit code ${code}`;
      onEvent({
        type: "error",
        id: requestId,
        error: `Gemini CLI error: ${detail}`,
      });
    }
    onEvent({ type: "done", id: requestId, fullText });
  });

  proc.on("error", (err) => {
    clearInterval(timeoutCheck);
    if (killed) return;
    onEvent({
      type: "error",
      id: requestId,
      error: `Failed to start gemini CLI: ${err.message}. Install with: npm install -g @google/gemini-cli`,
    });
    onEvent({ type: "done", id: requestId, fullText: "" });
  });

  return proc;
}

module.exports = { runGeminiCli, isGeminiCliAvailable, getGeminiCliAuthInfo, ensureGeminiCliMcpRegistered };
