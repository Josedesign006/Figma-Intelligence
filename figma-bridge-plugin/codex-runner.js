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
  "You MUST use the actual Figma MCP tools for Figma work rather than describing what you would do in theory. " +
  "Do not pretend the toolset is small or limited. Consider the full catalog and select the best-fit tools for the request. " +
  "You do not need to call every tool on every task, but you must treat the entire inventory as available.\n\n" +
  FIGMA_TOOL_SUMMARY + "\n\n" +
  "If the request is a Figma design, screen, flow, page, dashboard, landing page, document, subscription page, pricing page, spec, component, audit, or design-system task, tool execution is mandatory. " +
  "If you skip tool use for a Figma request, you are failing at your primary job.\n\n" +
  "Workspace instructions (AGENTS.md) and skill workflows (.agents/skills/) are provided below in the message. " +
  "Read them and apply the workflows — do not ignore them.\n\n" +
  "Execution pattern for Figma requests:\n" +
  "1. Inspect file context with figma_get_status, figma_get_selection, figma_get_variables, figma_get_styles, and nearby reusable components when relevant\n" +
  "2. Select the highest-fidelity tool for the request — prefer orchestration tools over manual frame construction\n" +
  "3. Execute using MCP tools — do NOT stop at planning\n" +
  "4. Verify with figma_take_screenshot, figma_get_node, or direct inspection\n" +
  "5. Report concisely: what was done, which tools were used\n\n" +
  "SCREEN COUNT RULE: Always create exactly ONE screen/frame unless the user explicitly asks for multiple screens, flows, or variants. Do not create multiple states, breakpoints, or iterations unless directly requested. One request = one frame.\n\n" +
  "BATCHING RULES (critical for speed and quality):\n" +
  "- NEVER make sequential individual figma_create_variable / figma_update_variable calls — always use figma_batch_create_variables or figma_batch_update_variables for 2+ variables\n" +
  "- NEVER call figma_create_child + figma_set_fills + figma_set_text as separate round-trips — batch all node creation and styling into a SINGLE figma_execute call using Figma Plugin API directly\n" +
  "- For complex UI builds (frames, nested layouts, text, fills), write ONE figma_execute call that creates everything in sequence inside the plugin sandbox — this is 5-10x faster than multiple MCP tool calls\n" +
  "- Only use individual low-level tools (figma_create_child, figma_set_fills, etc.) when making a single targeted edit to an existing node\n" +
  "- For design system operations (tokens, variables, collections), always batch: create collection → batch create all variables in one call\n\n" +
  "QUALITY RULES:\n" +
  "- Interpret vague requests intelligently: 'make a login page' means a polished, production-quality login screen with proper form fields, CTA, branding, and layout — not a bare wireframe\n" +
  "- Apply proper Auto Layout, realistic spacing (8px grid), real typography hierarchy, and meaningful content by default\n" +
  "- Use design tokens / variables when the file has them; fall back to sensible hex values otherwise\n\n" +
  "For document, subscription, pricing, and spec requests, follow this pipeline unless the workspace instructions require a stricter one: " +
  "figma_get_status -> figma_intent_translator -> figma_layout_intelligence -> figma_page_architect -> figma_generate_spec when documentation output is requested.\n\n" +
  "Recovery order when generation returns empty or weak results:\n" +
  "1. Retry with a tighter, more explicit prompt\n" +
  "2. Try a better-fit generation path (e.g. figma_design_from_ref, figma_sketch_to_design)\n" +
  "3. Reuse existing file structure if similar screens exist\n" +
  "4. Only then use figma_execute for manual low-level construction\n\n" +
  "Response style: concise, direct, high-signal. Execute first, briefly explain after.";

/**
 * Expand short or vague prompts into a richer, actionable design request.
 * Mirrors expandShortPrompt() in chat-runner.js — runs locally, no AI call.
 */
function expandShortPrompt(message) {
  const text = (message || "").trim();
  if (text.length > 60) return text;

  const lower = text.toLowerCase();

  const expansions = [
    [/^(create|make|build|design|add)?\s*(a\s+)?login\s*(page|screen|form)?$/i,
      "Create a polished, production-quality login screen. Include: email and password input fields with labels and placeholder text, a primary 'Log In' CTA button, a 'Forgot password?' link, a divider with 'or continue with', social login buttons (Google, Apple), and a 'Don't have an account? Sign up' footer link. Use proper Auto Layout, 8px grid spacing, and a clean modern aesthetic."],
    [/^(create|make|build|design|add)?\s*(a\s+)?dashboard\s*(page|screen)?$/i,
      "Create a modern analytics dashboard. Include: a top navigation bar with logo and user avatar, 4 KPI stat cards (total users, revenue, active sessions, conversion rate) with trend indicators, a line chart area, a recent activity table with status badges, and a sidebar navigation. Use proper Auto Layout and realistic placeholder data."],
    [/^(create|make|build|design|add)?\s*(a\s+)?home\s*(page|screen)?$/i,
      "Create a polished product home page. Include: a sticky navigation bar with logo, nav links, and a CTA button, a hero section with headline, subheadline, and primary/secondary CTAs, a features section with 3 icon+text cards, a social proof / testimonials row, and a footer. Use proper Auto Layout and compelling placeholder copy."],
    [/^(create|make|build|design|add)?\s*(a\s+)?signup\s*(page|screen|form)?$/i,
      "Create a clean signup / registration screen. Include: full name, email, and password fields with strength indicator, a 'Create Account' CTA, terms of service checkbox, and a social signup option. Use proper Auto Layout, label hierarchy, and error-state-ready field styling."],
    [/^(create|make|build|design|add)?\s*(a\s+)?(profile|account)\s*(page|screen)?$/i,
      "Create a user profile page with: avatar, display name, bio, stats row (followers, following, posts), tab bar (Posts, Likes, Saved), and a content grid. Use proper Auto Layout and realistic placeholder content."],
    [/^(create|make|build|design|add)?\s*(a\s+)?(card|product card|item card)s?\s*$/i,
      "Create a polished product card component with: product image placeholder, category tag, product name, price, rating with stars, and an 'Add to cart' button. Use proper Auto Layout, shadows, rounded corners, and realistic placeholder content."],
    [/^(create|make|build|design|add)?\s*(a\s+)?(navbar|nav bar|navigation bar|header)\s*$/i,
      "Create a responsive navigation bar with: logo on the left, navigation links in the center (Home, About, Features, Pricing), and a CTA button + user avatar on the right. Use proper Auto Layout and 8px grid spacing."],
    [/^(create|make|build|design|add)?\s*(a\s+)?onboarding\s*(flow|screen|page)?\s*$/i,
      "Create a single onboarding welcome screen with: a large illustration area, bold headline, supporting subtext, a 'Get Started' primary CTA, a 'Log in' secondary link, and a step indicator. Use proper Auto Layout and a friendly, approachable visual style."],
    [/^(create|make|build|design|add)?\s*(a\s+)?checkout\s*(page|screen|flow)?\s*$/i,
      "Create a checkout screen with: order summary section (item, qty, price), shipping address form, payment method selector (card/PayPal), order total breakdown, and a 'Place Order' CTA. Use proper Auto Layout and realistic placeholder content."],
    [/^(create|make|build|design|add)?\s*(a\s+)?settings\s*(page|screen)?\s*$/i,
      "Create a settings page with: a sidebar navigation (Account, Security, Notifications, Billing, Appearance), and a main content area showing Account settings with: profile photo upload, display name, email, phone fields, a language/timezone selector, and Save/Cancel buttons. Use proper Auto Layout."],
  ];

  for (const [pattern, expanded] of expansions) {
    if (pattern.test(lower)) {
      console.log(`[codex-runner] Expanded short prompt: "${text}" → enriched`);
      return expanded;
    }
  }

  if (text.length < 30 && text.length > 3) {
    return `${text}. Design this as a polished, production-quality Figma screen with proper Auto Layout, an 8px spacing grid, realistic content, and a clean modern visual style.`;
  }

  return text;
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

  const rawText = (message || "").trim() || "Please help with the Figma design.";
  const userText = expandShortPrompt(rawText);
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
