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

  // Preserve ALL env vars that setup.sh wrote (UNSPLASH_ACCESS_KEY, PEXELS_API_KEY,
  // GEMINI_API_KEY, ANTHROPIC_API_KEY, VISION_PROVIDER, etc.) — only override the
  // connection-critical vars so live tokens are never lost on config rebuild.
  const existingFigmaEnv =
    existingServers["figma-intelligence-layer"]?.env &&
    typeof existingServers["figma-intelligence-layer"].env === "object"
      ? existingServers["figma-intelligence-layer"].env
      : {};

  // Also pull UNSPLASH/PEXELS from the design-bridge env as a fallback so stock
  // photos work even if the figma-intelligence-layer entry is missing those keys.
  const designBridgeEnv =
    existingServers["design-bridge"]?.env &&
    typeof existingServers["design-bridge"].env === "object"
      ? existingServers["design-bridge"].env
      : {};

  const config = {
    mcpServers: {
      ...existingServers,
      "figma-intelligence-layer": {
        type: "stdio",
        command: "node",
        args: [join(REPO_DIR, "figma-intelligence-layer", "dist", "index.js")],
        env: {
          // Pull image-service keys from design-bridge as fallback
          ...(designBridgeEnv.UNSPLASH_ACCESS_KEY ? { UNSPLASH_ACCESS_KEY: designBridgeEnv.UNSPLASH_ACCESS_KEY } : {}),
          ...(designBridgeEnv.PEXELS_API_KEY ? { PEXELS_API_KEY: designBridgeEnv.PEXELS_API_KEY } : {}),
          ...(designBridgeEnv.STITCH_API_KEY ? { STITCH_API_KEY: designBridgeEnv.STITCH_API_KEY } : {}),
          ...(designBridgeEnv.GOOGLE_CLOUD_PROJECT ? { GOOGLE_CLOUD_PROJECT: designBridgeEnv.GOOGLE_CLOUD_PROJECT } : {}),
          // Restore everything setup.sh originally wrote for this server
          ...existingFigmaEnv,
          // Override the connection-critical vars with fresh runtime values
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

const FIGMA_TOOL_CATEGORIES = {
  vision: ["figma_screen_cloner","figma_visual_audit","figma_a11y_audit","figma_sketch_to_design","figma_design_from_ref"],
  accuracy: ["figma_intent_translator","figma_layout_intelligence","figma_variant_expander","figma_theme_generator","figma_lint_rules","figma_component_audit","figma_component_archaeologist"],
  generation: ["figma_page_architect","figma_generate_image_and_insert","figma_unsplash_search","figma_url_to_frame","figma_system_drift","figma_prototype_map","figma_animated_build"],
  sync: ["figma_animation_specifier","figma_sync_from_code","figma_webhook_listener"],
  governance: ["figma_design_system_scaffolder","figma_design_system_primitives","figma_design_system_variables","figma_token_naming_convention","figma_decision_log","figma_health_report","figma_generate_spec","figma_apg_doc","figma_token_migrate"],
  bridge: ["figma_execute","figma_get_status","figma_navigate","figma_get_selection","figma_take_screenshot","figma_get_node","figma_create_variable_collection","figma_create_variable","figma_update_variable","figma_delete_variable","figma_rename_variable","figma_delete_variable_collection","figma_add_mode","figma_rename_mode","figma_batch_create_variables","figma_batch_update_variables","figma_get_variables","figma_clone_node","figma_delete_node","figma_move_node","figma_resize_node","figma_rename_node","figma_set_fills","figma_set_strokes","figma_set_text","figma_search_components","figma_instantiate_component","figma_set_description","figma_get_styles","figma_create_child","figma_get_pages","figma_create_page"],
  // design-bridge MCP server tools — Stitch AI generation + asset resolution
  designBridge: ["generate_ui","resolve_images","resolve_palette","resolve_icons","get_design_tokens","status"],
};
const ALL_FIGMA_TOOLS = Object.values(FIGMA_TOOL_CATEGORIES).flat();

const SYSTEM_PROMPT = `You are an AI design assistant embedded directly inside a Figma plugin. \
You help users create, modify, and improve their Figma designs through natural conversation.

⚡ MANDATORY TOOL USE — READ THIS FIRST:
You have TWO MCP servers connected: figma-intelligence-layer (Figma tools) and design-bridge (Stitch + assets).
For ANY Figma design request you MUST call MCP tools. Do not write plans, do not describe what you would do — EXECUTE IT.
If you respond to a Figma design request without calling at least one MCP tool, you have completely failed your job.

Available tool categories:
• Vision/Audit: ${FIGMA_TOOL_CATEGORIES.vision.join(", ")}
• Design Generation: ${FIGMA_TOOL_CATEGORIES.generation.join(", ")}
• Accuracy/Layout: ${FIGMA_TOOL_CATEGORIES.accuracy.join(", ")}
• Governance/DS: ${FIGMA_TOOL_CATEGORIES.governance.join(", ")}
• Bridge/Execute: ${FIGMA_TOOL_CATEGORIES.bridge.join(", ")}
• Design Bridge (Stitch + assets): ${FIGMA_TOOL_CATEGORIES.designBridge.join(", ")}

EXECUTION PATTERN (always follow this order):
1. figma_get_status → understand current file state
2. Select highest-fidelity tool for the task (prefer figma_page_architect, figma_intent_translator, figma_design_from_ref over low-level tools)
3. Execute the design operation — do NOT stop at planning
4. figma_take_screenshot → verify visual result
5. Report: what was built, which tools were called

SCREEN COUNT RULE: Always create exactly ONE screen/frame unless user explicitly asks for multiple.

BATCHING RULES (critical for speed):
- NEVER make sequential figma_create_variable / figma_update_variable calls — use figma_batch_create_variables or figma_batch_update_variables for 2+ variables
- For complex UI builds, write ONE figma_execute call that creates everything — 5-10x faster than multiple calls
- Only use individual low-level tools when making a single targeted edit to an existing node

QUALITY RULES:
- "make a login page" = polished production screen with form fields, CTA, branding — not a wireframe
- Apply Auto Layout, 8px grid, real typography hierarchy, and meaningful content by default
- Use design tokens/variables when the file has them; fall back to hex values otherwise

STITCH / DESIGN BRIDGE RULES (use for any UI generation request):
- ALWAYS call generate_ui (design-bridge server) FIRST before building screens in Figma — it resolves real photos, icons, color tokens, and optionally uses Google Stitch AI for layout intelligence
- Use the returned systemPrompt, tokens, and resolvedAssets from generate_ui to inform every figma_execute / figma_page_architect call — embed the real image URLs as IMAGE fills and apply the exact color/typography tokens
- Call resolve_images when you need additional photos for a specific element (hero, product card, avatar)
- Call resolve_icons to get real SVG icon strings for navigation, buttons, and UI chrome — never draw fake icon rectangles
- Call resolve_palette when the user specifies a brand color or theme and you need a full palette
- Only skip generate_ui for purely structural edits (resizing, renaming, moving nodes) with no visual content

IMAGE RULES (mandatory — never use placeholder rectangles when images are available):
- When calling figma_page_architect: ALWAYS pass contentMode="realistic" and useStockImages=true
- When calling figma_execute to build screens: replace every image/hero/banner/product/avatar placeholder with a real image URL from generate_ui or resolve_images, then set it as an IMAGE fill — never leave a grey rectangle where a real image belongs
- If generate_ui / resolve_images returns no images, use figma_unsplash_search, then figma_generate_image_and_insert with provider="gemini" as last resort
- Only use placeholder-colored rectangles for form inputs, navigation bars, and non-image UI chrome

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

/**
 * Expand short or vague prompts into a richer, actionable design request.
 * This runs locally (no AI call) — simple heuristic enrichment.
 */
function expandShortPrompt(message) {
  const text = (message || "").trim();
  // If the prompt is substantial (>60 chars), leave it alone
  if (text.length > 60) return text;

  const lower = text.toLowerCase();

  // Map common short prompts to richer versions
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
      console.log(`[chat-runner] Expanded short prompt: "${text}" → enriched`);
      return expanded;
    }
  }

  // Generic expansion: if very short (< 30 chars), wrap with quality expectation
  if (text.length < 30 && text.length > 3) {
    return `${text}. Design this as a polished, production-quality Figma screen with proper Auto Layout, an 8px spacing grid, realistic content, and a clean modern visual style.`;
  }

  return text;
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

  if (/(screen|flow|page|dashboard|app ui|landing page|checkout|cart|design|ui|ux|wireframe|component|button|form|modal|nav|header|footer)/.test(text)) {
    guidance.push(
      "MANDATORY TOOL SEQUENCE for this UI request:",
      "  1. Call figma_get_status immediately — do not skip this",
      "  2. Call generate_ui (design-bridge) to resolve real assets + Stitch layout — use returned tokens and image URLs in all subsequent Figma calls",
      "  3. Call figma_intent_translator to resolve design intent",
      "  4. Call figma_page_architect OR figma_design_from_ref OR figma_execute for generation — embed the resolved assets",
      "  5. Call figma_take_screenshot to verify the result",
      "Skipping any of these calls is a failure. Execute them now."
    );
  }

  return guidance.length ? `\n\nTask-specific workflow requirements:\n- ${guidance.join("\n- ")}` : "";
}

/**
 * Spawn a claude CLI subprocess for a single chat message.
 * Streams events back via onEvent callback.
 * Returns the ChildProcess so the caller can kill it for abort.
 */
const CLAUDE_DEFAULT_MODEL = "claude-opus-4-6";
const CLAUDE_VALID_MODELS = new Set(["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"]);

function detectActiveSkills(text) {
  const lower = (text || "").toLowerCase();
  const skills = [];
  if (/(accessibility annotation|a11y annotation|focus order|aria annotation|accessible document)/.test(lower)) skills.push("A11y Annotator");
  if (/(accessible|accessibility|a11y|wcag|screen reader|keyboard navigation|aria)/.test(lower)) skills.push("Accessibility");
  if (/(screen|flow|page|dashboard|app ui|landing page|checkout|cart|design|ui|ux|wireframe|component|button|form|modal|nav|header|footer)/.test(lower)) skills.push("UI/UX Pro Max");
  if (/(theme|color|style|brand|dark mode|light mode|palette)/.test(lower)) skills.push("Theme Factory");
  return skills;
}

function runClaude({ message, attachments, conversation, requestId, model, onEvent }) {
  const { imageArgs, extraText, tempFiles } = processAttachments(attachments);

  // Resolve model: use what the UI sent only if it's a real Claude model ID
  const resolvedModel = CLAUDE_VALID_MODELS.has(model) ? model : CLAUDE_DEFAULT_MODEL;

  const rawText = (message || "").trim() || (extraText ? "Please analyse the attached image(s) and help me create a Figma design based on them." : "");
  // Expand short/vague prompts before sending to Claude
  const userText = expandShortPrompt(rawText);
  const historyText = formatConversationHistory(conversation);
  const taskGuidance = buildTaskSpecificGuidance(userText);
  const fullMessage = `${SYSTEM_PROMPT}${taskGuidance}\n\n---\n\n${historyText}${userText}${extraText}`;

  // Emit pre-flight progress so user sees immediate feedback
  const skills = detectActiveSkills(userText);
  if (skills.length > 0) {
    onEvent({ type: "phase_start", id: requestId, phase: `Skills: ${skills.join(" · ")}` });
  }
  onEvent({ type: "phase_start", id: requestId, phase: `Model: ${resolvedModel} · MCP: figma-intelligence-layer` });

  const args = [
    "--model", resolvedModel,
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

  // Stateful tracking for tool calls across streaming events
  // pendingToolsByIndex: Map<blockIndex, {id, name}> — for streaming content_block_start/stop
  // toolCallIdToName: Map<toolUseId, name> — for resolving tool_result by id
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
    // Flush any remaining pending tools as done
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
 *
 * Claude CLI --output-format stream-json --verbose emits several event shapes:
 *   content_block_start  → { type, index, content_block: { type:"tool_use"|"text", id?, name? } }
 *   content_block_delta  → { type, index, delta: { type:"text_delta"|"input_json_delta", text? } }
 *   content_block_stop   → { type, index }
 *   assistant            → { type, message: { content: [...blocks] } }  (complete non-streaming msgs)
 *   user                 → { type, message: { content: [{ type:"tool_result", tool_use_id, is_error }] } }
 *   tool_use / tool_result → legacy/direct forms
 *
 * eventState tracks in-flight tool calls so tool_done fires with the correct name.
 */
function handleStreamEvent(parsed, requestId, onEvent, appendText, eventState) {
  const { pendingToolsByIndex, toolCallIdToName } = eventState;

  switch (parsed.type) {
    // ── Complete assistant message (non-streaming or summary) ────────────
    case "assistant": {
      if (parsed.message?.content) {
        for (const block of parsed.message.content) {
          if (block.type === "text" && block.text) {
            // Any previously fired tool_starts that haven't resolved yet → resolve now
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

    // ── Streaming: new content block starts ─────────────────────────────
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

    // ── Streaming: content block delta ───────────────────────────────────
    case "content_block_delta": {
      if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
        // Text arriving means any pending tool calls have completed
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

    // ── User message (contains tool_result blocks) ───────────────────────
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

    // ── Direct tool_use event (some CLI versions) ────────────────────────
    case "tool_use": {
      if (parsed.name) {
        if (parsed.id) toolCallIdToName.set(parsed.id, parsed.name);
        onEvent({ type: "tool_start", id: requestId, tool: parsed.name });
      }
      break;
    }

    // ── Direct tool_result event ─────────────────────────────────────────
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

module.exports = { runClaude, isClaudeAvailable, getClaudeAuthInfo };
