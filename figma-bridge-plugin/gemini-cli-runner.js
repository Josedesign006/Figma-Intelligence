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
 */

const { spawn, spawnSync, execSync } = require("child_process");
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require("fs");
const { homedir, platform } = require("os");
const { join, resolve } = require("path");

const GEMINI_BIN = process.env.GEMINI_BIN_PATH || "gemini";
const REPO_DIR = resolve(__dirname, "..");
const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const MCP_BUILD_PATH = join(REPO_DIR, "figma-intelligence-layer", "dist", "index.js");
const GEMINI_SETTINGS_DIR = join(homedir(), ".gemini");
const GEMINI_SETTINGS_PATH = join(GEMINI_SETTINGS_DIR, "settings.json");

// Known locations where Gemini CLI stores OAuth credentials
const GEMINI_AUTH_CANDIDATES = [
  join(homedir(), ".gemini", "oauth_creds.json"),
  join(homedir(), ".gemini", "credentials.json"),
  join(homedir(), ".gemini", "auth.json"),
  join(homedir(), ".config", "google", "application_default_credentials.json"),
];

// Map plugin model tier names to Gemini model IDs
const MODEL_MAP = {
  opus:                 "gemini-2.5-pro",
  sonnet:               "gemini-2.0-flash",
  haiku:                "gemini-1.5-flash-8b",
  "gemini-2.5-pro":     "gemini-2.5-pro",
  "gemini-2.0-flash":   "gemini-2.0-flash",
  "gemini-1.5-flash-8b":"gemini-1.5-flash-8b",
};

const FIGMA_TOOL_CATEGORIES = {
  vision: [
    "figma_screen_cloner",
    "figma_visual_audit",
    "figma_a11y_audit",
    "figma_sketch_to_design",
    "figma_design_from_ref",
  ],
  accuracy: [
    "figma_intent_translator",
    "figma_layout_intelligence",
    "figma_variant_expander",
    "figma_theme_generator",
    "figma_lint_rules",
    "figma_component_audit",
    "figma_component_archaeologist",
  ],
  generation: [
    "figma_page_architect",
    "figma_generate_image_and_insert",
    "figma_unsplash_search",
    "figma_url_to_frame",
    "figma_system_drift",
    "figma_prototype_map",
    "figma_animated_build",
  ],
  sync: [
    "figma_animation_specifier",
    "figma_sync_from_code",
    "figma_webhook_listener",
  ],
  governance: [
    "figma_design_system_scaffolder",
    "figma_design_system_primitives",
    "figma_design_system_variables",
    "figma_token_naming_convention",
    "figma_decision_log",
    "figma_health_report",
    "figma_generate_spec",
    "figma_apg_doc",
    "figma_token_migrate",
  ],
  bridge: [
    "figma_execute",
    "figma_get_status",
    "figma_navigate",
    "figma_get_selection",
    "figma_take_screenshot",
    "figma_get_node",
    "figma_create_variable_collection",
    "figma_create_variable",
    "figma_update_variable",
    "figma_delete_variable",
    "figma_rename_variable",
    "figma_delete_variable_collection",
    "figma_add_mode",
    "figma_rename_mode",
    "figma_batch_create_variables",
    "figma_batch_update_variables",
    "figma_get_variables",
    "figma_clone_node",
    "figma_delete_node",
    "figma_move_node",
    "figma_resize_node",
    "figma_rename_node",
    "figma_set_fills",
    "figma_set_strokes",
    "figma_set_text",
    "figma_search_components",
    "figma_instantiate_component",
    "figma_set_description",
    "figma_get_styles",
    "figma_create_child",
    "figma_get_pages",
    "figma_create_page",
  ],
};

const ALL_FIGMA_TOOLS = Object.values(FIGMA_TOOL_CATEGORIES).flat();
const FIGMA_TOOL_SUMMARY = [
  `You have ${ALL_FIGMA_TOOLS.length} Figma MCP tools available.`,
  `Vision: ${FIGMA_TOOL_CATEGORIES.vision.join(", ")}`,
  `Accuracy: ${FIGMA_TOOL_CATEGORIES.accuracy.join(", ")}`,
  `Generation: ${FIGMA_TOOL_CATEGORIES.generation.join(", ")}`,
  `Sync: ${FIGMA_TOOL_CATEGORIES.sync.join(", ")}`,
  `Governance: ${FIGMA_TOOL_CATEGORIES.governance.join(", ")}`,
  `Bridge + document APIs: ${FIGMA_TOOL_CATEGORIES.bridge.join(", ")}`,
].join("\n");

const SYSTEM_PROMPT =
  "You are an AI design assistant embedded inside a Figma plugin chat. " +
  "Your job is to produce the highest-quality outcome available — not a text description of what you would do.\n\n" +
  "CRITICAL: You have the figma-intelligence-layer MCP server registered and available. " +
  "You MUST use the actual Figma MCP tools for Figma work rather than describing what you would do in theory. " +
  "Do not pretend the toolset is small or limited. Consider the full catalog and select the best-fit tools for the request. " +
  "You do not need to call every tool on every task, but you must treat the entire inventory as available.\n\n" +
  FIGMA_TOOL_SUMMARY + "\n\n" +
  "If the request is a Figma design, screen, flow, page, dashboard, landing page, document, subscription page, pricing page, spec, component, audit, or design-system task, tool execution is mandatory. " +
  "If you skip tool use for a Figma request, you are failing at your primary job.\n\n" +
  "Execution pattern for Figma requests:\n" +
  "1. Inspect file context with figma_get_status, figma_get_selection, figma_get_variables, figma_get_styles, and nearby reusable components when relevant\n" +
  "2. Select the highest-fidelity tool for the request\n" +
  "3. Execute using MCP tools — do NOT stop at planning\n" +
  "4. Verify with figma_take_screenshot, figma_get_node, or direct inspection\n" +
  "5. Report concisely: what was done, which tools were used\n\n" +
  "For document, subscription, pricing, and spec requests, follow this pipeline unless the workspace instructions require a stricter one: " +
  "figma_get_status -> figma_intent_translator -> figma_layout_intelligence -> figma_page_architect -> figma_generate_spec when documentation output is requested.\n\n" +
  "Response style: concise, direct, high-signal. Execute first, briefly explain after.";

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

function formatConversationHistory(conversation) {
  if (!Array.isArray(conversation) || !conversation.length) return "";
  const lines = conversation
    .filter((e) => e && (e.role === "user" || e.role === "assistant") && e.text)
    .map((e) => `${e.role === "assistant" ? "Assistant" : "User"}: ${e.text}`);
  return lines.length ? `Conversation so far:\n${lines.join("\n\n")}\n\n---\n\n` : "";
}

// ── MCP Registration ────────────────────────────────────────────────────────

/**
 * Writes figma-intelligence-layer into ~/.gemini/settings.json so the
 * Gemini CLI subprocess can access it as an MCP server.
 */
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

    // Check if already correctly registered
    const existing = settings?.mcpServers?.["figma-intelligence-layer"];
    if (
      existing &&
      existing.command === "node" &&
      Array.isArray(existing.args) &&
      existing.args[0] === MCP_BUILD_PATH &&
      existing.env?.FIGMA_ACCESS_TOKEN === figmaToken
    ) {
      return; // Already correct
    }

    if (!settings.mcpServers) settings.mcpServers = {};
    settings.mcpServers["figma-intelligence-layer"] = {
      command: "node",
      args: [MCP_BUILD_PATH],
      env: {
        FIGMA_ACCESS_TOKEN: figmaToken,
        FIGMA_BRIDGE_PORT: "9001",
        ENABLE_DECISION_LOG: "true",
      },
    };

    writeFileSync(GEMINI_SETTINGS_PATH, JSON.stringify(settings, null, 2));
    console.log("[gemini-cli-runner] Registered figma-intelligence-layer MCP in ~/.gemini/settings.json");
  } catch (err) {
    console.error("[gemini-cli-runner] Could not update ~/.gemini/settings.json:", err.message);
  }
}

// Register MCP at module load, like the other runners
ensureGeminiCliMcpRegistered();

// ── Auth Detection ──────────────────────────────────────────────────────────

/** Check if the gemini CLI binary is installed and executable */
function isGeminiCliAvailable() {
  return new Promise((resolve) => {
    const proc = spawn(GEMINI_BIN, ["--version"], { stdio: "pipe", env: getCleanEnv() });
    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

/**
 * Returns { loggedIn: boolean, email: string|null }
 *
 * Gemini CLI v0.34+ stores OAuth tokens in the macOS Keychain under the
 * service name "gemini-cli-oauth" (account "main-account"), using
 * HybridTokenStorage. Falls back to:
 *   1. oauth_creds.json file (legacy Gemini CLI file-based storage)
 *   2. Other known OAuth credential file locations
 */
async function getGeminiCliAuthInfo() {
  // ── 1. macOS Keychain (primary store for Gemini CLI v0.34+) ─────────────
  if (platform() === "darwin") {
    try {
      execSync(
        'security find-generic-password -s "gemini-cli-oauth" -a "main-account" 2>/dev/null',
        { stdio: "pipe" }
      );
      // Entry found — try to extract email from the keychain data
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
    } catch {
      // Not in Keychain — fall through to file checks
    }
  }

  // ── 2. oauth_creds.json (Gemini CLI legacy file storage) ─────────────────
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

  // ── 3. Other known OAuth credential file locations ────────────────────────
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

/**
 * Spawn a Gemini CLI subprocess for a single chat message.
 * Streams text back via onEvent({ type: "text_delta", delta, id }).
 * Returns the ChildProcess so the caller can kill it for abort.
 */
function runGeminiCli({ message, attachments, conversation, requestId, model, onEvent }) {
  const userText = (message || "").trim() || "Please help with the Figma design.";
  const historyText = formatConversationHistory(conversation);

  // Process text attachments (images noted but can't be passed as files currently)
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

  const fullMessage = `${SYSTEM_PROMPT}\n\n---\n\n${historyText}${userText}${extraText}`;
  const geminiModel = MODEL_MAP[model] || "gemini-2.0-flash";

  // gemini CLI non-interactive flags:
  //   -p / --prompt  — one-shot prompt (exits after responding)
  //   --model        — model ID to use
  //   --yolo         — auto-approve tool calls (like --dangerously-skip-permissions in Claude)
  const args = [
    "--model", geminiModel,
    "--yolo",
    "-p", fullMessage,
  ];

  const proc = spawn(GEMINI_BIN, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: getCleanEnv(),
    cwd: REPO_DIR,
  });

  let fullText = "";
  let stderrOutput = "";

  proc.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    fullText += text;
    onEvent({ type: "text_delta", id: requestId, delta: text });
  });

  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString().trim();
    if (text) {
      stderrOutput += text + "\n";
      console.error("[gemini-cli chat]", text);
    }
  });

  proc.on("close", (code) => {
    if (code !== 0 && code !== null && fullText === "") {
      const detail = stderrOutput.trim() || `exit code ${code}`;
      onEvent({
        type: "error",
        id: requestId,
        error: `Gemini CLI error: ${detail}`,
      });
    }
    onEvent({ type: "done", id: requestId, fullText });
  });

  proc.on("error", (err) => {
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
