#!/usr/bin/env node
/**
 * stitch-runner.js — Uses the official @google/stitch-sdk to generate UI designs,
 * then converts the Tailwind HTML output to native Figma frames.
 *
 * SDK: @google/stitch-sdk (ESM-only, loaded via dynamic import)
 * MCP endpoint: https://stitch.googleapis.com/mcp
 * Auth: API key from Stitch Settings (stitch.withgoogle.com)
 *
 * Pipeline (mirrors actual Stitch environment):
 *   1. StitchToolClient.connect() → authenticate
 *   2. Stitch.createProject() → workspace (or reuse existing)
 *   3. Project.generate(prompt) → Screen with HTML + screenshot
 *   4. extract_design_context → Design DNA (colors, typography, spacing, components)
 *   5. Save as design.md → persist for future screen consistency
 *   6. Screen.getHtml() → download URL → fetch HTML
 *   7. htmlToFigmaCommands() → convert Tailwind HTML to Figma frames
 *
 * The design.md file is saved per-project so subsequent screen generations
 * in the same workspace reuse the same design DNA — maintaining visual
 * consistency across screens (same palette, fonts, spacing, patterns).
 *
 * Emits the same event shape as chat-runner.js / perplexity-runner.js
 * so bridge-relay can use it interchangeably.
 */

const http = require("http");
const https = require("https");
const { EventEmitter } = require("events");
const { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } = require("fs");
const { join } = require("path");
const { homedir } = require("os");
const { htmlToFigmaExecuteCode } = require("./html-to-figma");
const { getStitchAccessToken, hasStitchAuth } = require("./stitch-auth");
const STITCH_LOG = join(homedir(), ".claude", "stitch", "debug.log");
function stitchLog(msg, data) {
  try {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}${data !== undefined ? ": " + JSON.stringify(data, null, 2) : ""}\n`;
    if (!existsSync(join(homedir(), ".claude", "stitch"))) mkdirSync(join(homedir(), ".claude", "stitch"), { recursive: true });
    appendFileSync(STITCH_LOG, line);
  } catch {}
}

// ── Local preview server ──────────────────────────────────────────────────────

const PREVIEW_DIR = join(homedir(), ".claude", "stitch", "previews");
let _previewServer = null;
let _previewPort = null;
const _previewFiles = new Map(); // slug → { html, title, createdAt }

function ensurePreviewServer() {
  return new Promise((resolve, reject) => {
    if (_previewServer && _previewPort) {
      resolve(_previewPort);
      return;
    }

    if (!existsSync(PREVIEW_DIR)) mkdirSync(PREVIEW_DIR, { recursive: true });

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost`);
      const slug = url.pathname.slice(1) || "index";

      // Serve the index listing all previews
      if (slug === "index") {
        const items = Array.from(_previewFiles.entries())
          .sort((a, b) => b[1].createdAt - a[1].createdAt)
          .map(([s, f]) => `<li style="margin:8px 0"><a href="/${s}" style="color:#4ade80;font-size:18px">${f.title || s}</a> <span style="color:#666;font-size:13px">${new Date(f.createdAt).toLocaleTimeString()}</span></li>`)
          .join("");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!DOCTYPE html><html><head><title>Stitch Previews</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;padding:40px;max-width:600px;margin:0 auto}
a{text-decoration:none}a:hover{text-decoration:underline}h1{color:#4ade80}ul{list-style:none;padding:0}</style></head>
<body><h1>Stitch Previews</h1><ul>${items || "<li style='color:#666'>No previews yet</li>"}</ul></body></html>`);
        return;
      }

      const entry = _previewFiles.get(slug);
      if (!entry) {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("<h1>Preview not found</h1><p><a href='/'>View all previews</a></p>");
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/html",
        "Cache-Control": "no-cache",
      });
      res.end(entry.html);
    });

    server.listen(0, "127.0.0.1", () => {
      _previewPort = server.address().port;
      _previewServer = server;
      console.log(`  Stitch preview server running at http://localhost:${_previewPort}`);
      resolve(_previewPort);
    });

    server.on("error", (err) => {
      console.error("  Stitch preview server error:", err.message);
      reject(err);
    });
  });
}

function addPreview(html, title) {
  const slug = (title || "screen")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    + "-" + Date.now().toString(36);

  _previewFiles.set(slug, { html, title, createdAt: Date.now() });

  // Also save to disk for persistence
  try {
    writeFileSync(join(PREVIEW_DIR, slug + ".html"), html);
  } catch {}

  return slug;
}

// ── SDK loader (ESM → CJS bridge) ─────────────────────────────────────────────

let _sdkPromise = null;

function loadSdk() {
  if (!_sdkPromise) {
    _sdkPromise = import("@google/stitch-sdk");
  }
  return _sdkPromise;
}

// ── Design context (design.md) persistence ─────────────────────────────────────

/**
 * Directory where per-project design.md files are stored.
 * ~/.claude/stitch/<sanitized-project-name>/design.md
 */
const STITCH_DIR = join(homedir(), ".claude", "stitch");

function sanitizeName(name) {
  return (name || "default").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
}

function getDesignMdPath(projectName) {
  const dir = join(STITCH_DIR, sanitizeName(projectName));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "design.md");
}

/**
 * Load an existing design.md for a project. Returns null if not found.
 */
function loadDesignMd(projectName) {
  const filePath = getDesignMdPath(projectName);
  try {
    if (existsSync(filePath)) return readFileSync(filePath, "utf8");
  } catch {}
  return null;
}

/**
 * Save design.md for a project.
 */
function saveDesignMd(projectName, content) {
  const filePath = getDesignMdPath(projectName);
  try {
    writeFileSync(filePath, content, "utf8");
    return filePath;
  } catch (err) {
    console.error("  ⚠ Could not save design.md:", err.message);
    return null;
  }
}

/**
 * Build a design.md from the extract_design_context result.
 * The result is typically structured JSON with colors, typography, spacing, etc.
 */
function buildDesignMd(context, projectName, screenPrompt, theme) {
  const lines = [];
  lines.push(`# Design System — ${projectName}`);
  lines.push("");
  lines.push(`> Extracted by Google Stitch from: "${screenPrompt}"`);
  lines.push(`> Generated: ${new Date().toISOString().split("T")[0]}`);
  lines.push("");

  if (typeof context === "string") {
    // If Stitch returned plain text/markdown, use it directly
    lines.push(context);

    // Append structured Figma Variables section from the theme's namedColors
    // so the .md parser can create proper variable collections
    if (theme?.namedColors && typeof theme.namedColors === "object") {
      lines.push("");
      lines.push("---");
      lines.push("");
      lines.push("## Primitives");
      lines.push("");
      lines.push("### Colors");
      lines.push("");
      for (const [name, hex] of Object.entries(theme.namedColors)) {
        lines.push(`- **color/${name.replace(/_/g, "/")}**: \`${hex}\``);
      }
      lines.push("");

      // Add fonts
      if (theme.font || theme.bodyFont || theme.headlineFont) {
        lines.push("### Strings");
        lines.push("");
        if (theme.font) lines.push(`- **fontFamily/primary**: \`${theme.font}\``);
        if (theme.bodyFont && theme.bodyFont !== theme.font) lines.push(`- **fontFamily/body**: \`${theme.bodyFont}\``);
        if (theme.headlineFont && theme.headlineFont !== theme.font) lines.push(`- **fontFamily/headline**: \`${theme.headlineFont}\``);
        lines.push("");
      }

      // Add spacing scale
      if (theme.spacingScale) {
        lines.push("### spacing");
        lines.push("");
        const base = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48];
        const names = ["0", "0.5", "1", "1.5", "2", "2.5", "3", "4", "5", "6", "8", "10", "12"];
        base.forEach((val, i) => {
          const scaled = Math.round(val * (theme.spacingScale || 1));
          lines.push(`- **spacing/${names[i]}**: \`${scaled}px\``);
        });
        lines.push("");
      }

      // Semantic aliases for common roles
      lines.push("## Semantic");
      lines.push("");
      lines.push("### Colors");
      lines.push("");
      const semanticMap = {
        "color/action/primary": "color/primary",
        "color/action/primary/hover": "color/primary/container",
        "color/text/primary": "color/on/surface",
        "color/text/secondary": "color/on/surface/variant",
        "color/text/onAction": "color/on/primary",
        "color/surface/default": "color/surface",
        "color/surface/muted": "color/surface/container",
        "color/border/default": "color/outline",
        "color/border/muted": "color/outline/variant",
        "color/action/danger": "color/error",
        "color/action/success": "color/tertiary",
      };
      for (const [sem, prim] of Object.entries(semanticMap)) {
        // Only add if the target primitive exists in namedColors
        const primKey = prim.replace("color/", "").replace(/\//g, "_");
        if (theme.namedColors[primKey]) {
          lines.push(`- **${sem}**: → \`${prim}\``);
        }
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  // Structured context — format as readable markdown
  if (context.colors || context.colorPalette || context.palette) {
    lines.push("## Colors");
    lines.push("");
    const colors = context.colors || context.colorPalette || context.palette;
    if (Array.isArray(colors)) {
      for (const c of colors) {
        const name = c.name || c.role || c.label || "Color";
        const value = c.value || c.hex || c.color || "";
        lines.push(`- **${name}**: \`${value}\``);
      }
    } else if (typeof colors === "object") {
      for (const [key, val] of Object.entries(colors)) {
        lines.push(`- **${key}**: \`${typeof val === "object" ? val.hex || val.value || JSON.stringify(val) : val}\``);
      }
    }
    lines.push("");
  }

  if (context.typography || context.fonts || context.textStyles) {
    lines.push("## Typography");
    lines.push("");
    const typo = context.typography || context.fonts || context.textStyles;
    if (Array.isArray(typo)) {
      for (const t of typo) {
        const name = t.name || t.role || "Text";
        const family = t.fontFamily || t.family || "";
        const size = t.fontSize || t.size || "";
        const weight = t.fontWeight || t.weight || "";
        lines.push(`- **${name}**: ${family} ${size}${size ? "px" : ""} / ${weight}`);
      }
    } else if (typeof typo === "object") {
      for (const [key, val] of Object.entries(typo)) {
        lines.push(`- **${key}**: ${typeof val === "object" ? JSON.stringify(val) : val}`);
      }
    }
    lines.push("");
  }

  if (context.spacing || context.layout) {
    lines.push("## Spacing & Layout");
    lines.push("");
    const sp = context.spacing || context.layout;
    if (typeof sp === "object") {
      for (const [key, val] of Object.entries(sp)) {
        lines.push(`- **${key}**: ${typeof val === "object" ? JSON.stringify(val) : val}`);
      }
    }
    lines.push("");
  }

  if (context.components || context.patterns || context.componentPatterns) {
    lines.push("## Component Patterns");
    lines.push("");
    const comps = context.components || context.patterns || context.componentPatterns;
    if (Array.isArray(comps)) {
      for (const c of comps) {
        const name = c.name || c.type || "Component";
        const desc = c.description || c.style || "";
        lines.push(`- **${name}**: ${desc}`);
      }
    } else if (typeof comps === "object") {
      for (const [key, val] of Object.entries(comps)) {
        lines.push(`- **${key}**: ${typeof val === "object" ? JSON.stringify(val) : val}`);
      }
    }
    lines.push("");
  }

  if (context.borderRadius || context.radius || context.radii) {
    lines.push("## Border Radius");
    lines.push("");
    const radii = context.borderRadius || context.radius || context.radii;
    if (typeof radii === "object") {
      for (const [key, val] of Object.entries(radii)) {
        lines.push(`- **${key}**: ${val}`);
      }
    }
    lines.push("");
  }

  if (context.shadows || context.effects) {
    lines.push("## Shadows & Effects");
    lines.push("");
    const effects = context.shadows || context.effects;
    if (typeof effects === "object") {
      for (const [key, val] of Object.entries(effects)) {
        lines.push(`- **${key}**: ${typeof val === "object" ? JSON.stringify(val) : val}`);
      }
    }
    lines.push("");
  }

  // Dump any remaining top-level keys we didn't handle
  const handled = new Set(["colors","colorPalette","palette","typography","fonts","textStyles","spacing","layout","components","patterns","componentPatterns","borderRadius","radius","radii","shadows","effects"]);
  const remaining = Object.keys(context).filter(k => !handled.has(k));
  if (remaining.length > 0) {
    lines.push("## Additional Properties");
    lines.push("");
    for (const key of remaining) {
      const val = context[key];
      if (val !== null && val !== undefined) {
        lines.push(`- **${key}**: ${typeof val === "object" ? JSON.stringify(val) : val}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── GCP project auto-detection ──────────────────────────────────────────────

/**
 * Auto-detect the user's Google Cloud project ID from their account.
 * Queries the Cloud Resource Manager API and returns the first active project.
 */
function detectGcpProject(accessToken) {
  return new Promise((resolve) => {
    https.get("https://cloudresourcemanager.googleapis.com/v1/projects?pageSize=5", {
      headers: { "Authorization": `Bearer ${accessToken}` },
    }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const active = (json.projects || []).find(p => p.lifecycleState === "ACTIVE");
          if (active) {
            console.log(`  Stitch: auto-detected GCP project: ${active.projectId}`);
            resolve(active.projectId);
          } else {
            resolve("figma-plugin");
          }
        } catch {
          resolve("figma-plugin");
        }
      });
    }).on("error", () => resolve("figma-plugin"));
  });
}

// ── Intent detection ────────────────────────────────────────────────────────────

function detectStitchIntent(message) {
  const m = message.toLowerCase();

  // List projects — broad patterns
  if (/list\s+(all\s+)?(my\s+)?(stitch\s+)?projects|show\s+(all\s+)?(me\s+)?(my\s+)?(stitch\s+)?projects|stitch\s+projects|what\s+projects|my\s+projects/.test(m))
    return { type: "list_projects" };

  // Use/convert an existing screen to something (React, webpage, Figma, interactive, etc.)
  // Key signal: user mentions "screen" + an action/conversion word
  // Catches: "use my stitch screen", "create interactive web with the selected screen",
  // "convert stitch to react", "make the screen interactive", "web app from my screen", etc.
  if (/use\s+(my|the|this|that|selected|current|latest)?\s*(stitch\s+)?screen/.test(m) ||
      /from\s+(my\s+)?stitch.*(?:create|build|make|convert|generate)/.test(m) ||
      /(?:create|build|make|convert|generate)\b.*\b(?:from|using|with)\s+(?:my\s+)?(?:the\s+)?(?:stitch\s+)?(?:selected\s+)?screen/.test(m) ||
      /(?:with|from|using)\s+(?:the\s+)?(?:my\s+)?(?:selected\s+|current\s+|latest\s+)?(?:stitch\s+)?screen/.test(m) ||
      /stitch\s+(?:screen\s+)?(?:to|into)\s+(?:react|figma|webpage|html|code|web|interactive)/.test(m) ||
      /(?:screen|design)\s+(?:i|I)\s+(?:selected|created|made|have)/.test(m) ||
      /take\s+(?:the|my|this)?\s*(?:stitch\s+)?screen/.test(m) ||
      /(?:selected|current|latest)\s+screen\b/.test(m) ||
      /\bscreen\b.*(?:interactive|react|web\s*app|webpage|website|convert|code)/.test(m) ||
      /(?:interactive|react|web\s*app|webpage|website|convert)\b.*\bscreen\b/.test(m))
    return { type: "get_screen", screenHint: extractScreenHint(m), projectHint: extractProjectHint(m), wantsCode: detectCodeIntent(m) };

  // Get screen HTML / fetch specific screen by name
  if (/get\s+(the\s+)?html|screen\s+code|fetch\s+screen|download\s+screen|html\s+from\s+screen/.test(m))
    return { type: "get_screen", screenHint: extractScreenHint(m), projectHint: extractProjectHint(m), wantsCode: detectCodeIntent(m) };

  // Show screenshot / preview — check BEFORE list_screens
  if (/show\s+screenshot|preview\s+screen|screen\s+image|screenshot\s+of/.test(m))
    return { type: "get_screen_image", screenHint: extractScreenHint(m), projectHint: extractProjectHint(m) };

  // List screens in a project
  if (/list\s+(all\s+)?screens|show\s+(all\s+)?screens|screens?\s+(in|of|from)\s+/.test(m))
    return { type: "list_screens", projectHint: extractProjectHint(m) };

  // Default: generation
  return { type: "generate" };
}

/**
 * Detect if the user wants code output (React, HTML, etc.) vs Figma frames.
 */
function detectCodeIntent(message) {
  if (/react|component|webpage|web\s*page|web\s*app|website|html\s+code|code|next\.?js|typescript|jsx|tsx|interactive\s+web|interactive\s+page|interactive\s+app|live\s+preview|preview\s+link|run\s+locally|localhost|interactive\b.*\b(?:using|with|from|create|build|make|generate)/.test(message))
    return "react";
  return null; // default: Figma frames
}

function extractProjectHint(message) {
  // Match: "in project X", "from project X", "project named X", "in X project"
  let match = message.match(/(?:in|from|of)\s+(?:project\s+)?["']?([^"',\n]+?)["']?\s*(?:project)?(?:\s*$|\s+(?:to|and|screen|create|get|show|list))/i);
  if (match) { const h = stripArticles(match[1].trim()); if (h) return h; }
  match = message.match(/project\s+(?:named?\s+)?["']?([^"',\n]+?)["']?(?:\s*$|\s+(?:to|and|screen|create|get|show))/i);
  if (match) { const h = stripArticles(match[1].trim()); if (h) return h; }
  return null;
}

/**
 * Strip leading articles (the, my, this, that, a, an) from hints.
 */
function stripArticles(s) {
  // Remove leading articles and also filter out "stitch" (provider name, not a project)
  return s.replace(/^(the|my|this|that|a|an)\s+/i, "").replace(/^stitch\s*/i, "").trim();
}

/**
 * Get a human-readable label for a screen.
 * The API often only returns a `name` like "projects/123/screens/abc" with no displayName.
 */
function getScreenLabel(screen, index) {
  const d = screen.data || {};
  if (d.displayName) return d.displayName;
  if (d.title) return d.title;
  // Extract short ID from name like "projects/123/screens/abc..."
  const id = screen.id || screen.screenId || "";
  return `Screen ${typeof index === "number" ? index : 1}` + (id ? ` (${id.slice(0, 8)}...)` : "");
}

function extractScreenHint(message) {
  // Match: "screen X", "the X screen", "screen named X", "use X"
  let match = message.match(/(?:screen\s+(?:named?\s+)?|use\s+(?:the\s+)?)["']?([^"',\n]+?)["']?\s*(?:screen)?(?:\s*$|\s+(?:to|from|in|and|create))/i);
  if (match) return match[1].trim();
  return null;
}

async function findProject(stitchApi, hint) {
  const projects = await stitchApi.projects();
  if (!hint) return { projects, matched: null };

  const lower = stripArticles(hint).toLowerCase();
  const matched = projects.find(p => {
    const title = (p.data?.title || p.data?.displayName || "").toLowerCase();
    // Bidirectional: "beehive" matches "Beehive Project" and vice versa
    return title === lower || title.includes(lower) || lower.includes(title) || p.id === hint || p.projectId === hint;
  });

  return { projects, matched };
}

/**
 * List screens for a project — bypasses SDK's project.screens() to handle
 * the raw MCP response directly and avoid crashes on unexpected formats.
 */
async function listScreensDirect(client, projectId) {
  try {
    const raw = await client.callTool("list_screens", { projectId });
    console.log("  Stitch list_screens raw:", JSON.stringify(raw)?.slice(0, 300));
    if (!raw) return [];
    const arr = raw.screens || raw.items || (Array.isArray(raw) ? raw : []);
    return arr;
  } catch (err) {
    console.error("  Stitch: list_screens failed:", err.message);
    return [];
  }
}

async function findScreen(client, projectId, hint) {
  const screenDataList = await listScreensDirect(client, projectId);

  // Wrap raw screen data into objects with a consistent shape
  const screens = screenDataList.map(s => ({
    data: s,
    id: s.id || (s.name ? s.name.split("/screens/").pop() : undefined),
    screenId: s.id || (s.name ? s.name.split("/screens/").pop() : undefined),
    projectId,
    // Keep raw data for getHtml/getImage later
    _raw: s,
  }));

  if (!hint) return { screens, matched: null };

  const lower = stripArticles(hint).toLowerCase();
  const matched = screens.find(s => {
    const name = (s.data?.displayName || s.data?.name || s.data?.title || "").toLowerCase();
    return name === lower || name.includes(lower) || lower.includes(name) || s.id === hint || s.screenId === hint;
  });

  return { screens, matched };
}

// ── Query handlers ──────────────────────────────────────────────────────────────

async function handleListProjects(stitchApi, requestId, onEvent) {
  onEvent({ type: "phase_start", id: requestId, phase: "Listing Stitch projects..." });
  onEvent({ type: "tool_start", id: requestId, tool: "list_projects" });

  const projects = await stitchApi.projects();

  onEvent({ type: "tool_done", id: requestId, tool: "list_projects", isError: false });

  if (projects.length === 0) {
    const msg = "You don't have any Stitch projects yet. Ask me to create a screen and I'll set one up!\n";
    onEvent({ type: "text_delta", id: requestId, delta: msg });
    onEvent({ type: "done", id: requestId, fullText: msg });
    return;
  }

  const lines = [`Your Stitch Projects (${projects.length}):\n\n`];
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const title = p.data?.title || p.data?.displayName || `Project ${i + 1}`;
    const id = p.id || p.projectId || "unknown";
    const created = p.data?.createTime ? new Date(p.data.createTime).toLocaleDateString() : "";
    lines.push(`${i + 1}. **${title}** (ID: ${id})${created ? `\n   Created: ${created}` : ""}\n`);
  }
  lines.push(`\nSay "list screens in [project name]" to see screens in a project.\n`);

  const msg = lines.join("");
  onEvent({ type: "text_delta", id: requestId, delta: msg });
  onEvent({ type: "done", id: requestId, fullText: msg });
}

async function handleListScreens(stitchApi, client, projectHint, requestId, onEvent) {
  onEvent({ type: "phase_start", id: requestId, phase: "Finding project..." });

  const { projects, matched } = await findProject(stitchApi, projectHint);

  if (!matched) {
    if (!projectHint) {
      const names = projects.map(p => p.data?.title || p.data?.displayName || p.id).join(", ");
      const msg = `Which project? Your projects: ${names}\n\nSay "list screens in [project name]"\n`;
      onEvent({ type: "text_delta", id: requestId, delta: msg });
      onEvent({ type: "done", id: requestId, fullText: msg });
      return;
    }
    const msg = `Could not find project "${projectHint}". Your projects:\n` +
      projects.map(p => `- ${p.data?.title || p.data?.displayName || p.id}`).join("\n") + "\n";
    onEvent({ type: "text_delta", id: requestId, delta: msg });
    onEvent({ type: "done", id: requestId, fullText: msg });
    return;
  }

  const projectTitle = matched.data?.title || matched.data?.displayName || matched.id;
  onEvent({ type: "phase_start", id: requestId, phase: `Listing screens in "${projectTitle}"...` });
  onEvent({ type: "tool_start", id: requestId, tool: "list_screens" });

  const { screens } = await findScreen(client, matched.projectId || matched.id, null);

  onEvent({ type: "tool_done", id: requestId, tool: "list_screens", isError: false });

  if (screens.length === 0) {
    const msg = `No screens in "${projectTitle}" yet. Ask me to generate one!\n`;
    onEvent({ type: "text_delta", id: requestId, delta: msg });
    onEvent({ type: "done", id: requestId, fullText: msg });
    return;
  }

  const lines = [`Screens in "${projectTitle}" (${screens.length}):\n\n`];
  for (let i = 0; i < screens.length; i++) {
    const s = screens[i];
    const name = getScreenLabel(s, i + 1);
    const id = s.id || s.screenId || "unknown";
    lines.push(`${i + 1}. **${name}** (ID: ${id.slice(0, 12)})\n`);
  }
  lines.push(`\nSay "use screen [name] from ${projectTitle}" to create a Figma frame from it.\n`);
  lines.push(`Or "get HTML from screen [name] in ${projectTitle}" to get the raw code.\n`);

  const msg = lines.join("");
  onEvent({ type: "text_delta", id: requestId, delta: msg });
  onEvent({ type: "done", id: requestId, fullText: msg });
}

async function handleGetScreen(stitchApi, client, projectHint, screenHint, requestId, onEvent, deviceType, wantsCode) {
  onEvent({ type: "phase_start", id: requestId, phase: "Finding project and screen..." });

  const { projects, matched: matchedProject } = await findProject(stitchApi, projectHint);

  if (projects.length === 0) {
    const msg = "No Stitch projects found. Create a screen first!\n";
    onEvent({ type: "text_delta", id: requestId, delta: msg });
    onEvent({ type: "done", id: requestId, fullText: msg });
    return;
  }

  if (matchedProject) {
    return handleGetScreenFromProject(matchedProject, stitchApi, client, screenHint, requestId, onEvent, deviceType, wantsCode);
  }

  // No exact project match — search ALL projects for the screen
  // The user might have said the screen name (e.g. "Beehive Management Dashboard")
  // which could be in any project, or the project hint itself might be the screen name
  const combinedHint = screenHint || projectHint;
  onEvent({ type: "phase_start", id: requestId, phase: "Searching all projects for screen..." });

  for (const proj of projects) {
    const projId = proj.projectId || proj.id;
    try {
      const { screens, matched: matchedScreen } = await findScreen(client, projId, combinedHint);
      if (matchedScreen) {
        const projectTitle = proj.data?.title || proj.data?.displayName || proj.id;
        onEvent({ type: "text_delta", id: requestId, delta: `Found screen in "${projectTitle}"\n\n` });
        return fetchAndProcessScreen(client, matchedScreen, projectTitle, requestId, onEvent, deviceType, wantsCode);
      }
      // If no hint but project has screens, use the latest
      if (!combinedHint && screens.length > 0) {
        const latest = screens[screens.length - 1];
        const projectTitle = proj.data?.title || proj.data?.displayName || proj.id;
        const latestName = getScreenLabel(latest, screens.length);
        onEvent({ type: "text_delta", id: requestId, delta: `Auto-selecting latest screen: "${latestName}" from "${projectTitle}"\n\n` });
        return fetchAndProcessScreen(client, latest, projectTitle, requestId, onEvent, deviceType, wantsCode);
      }
    } catch {}
  }

  // Nothing found — try the first project with any screens as fallback
  for (const proj of projects) {
    const projId = proj.projectId || proj.id;
    try {
      const { screens } = await findScreen(client, projId, null);
      if (screens.length > 0) {
        return handleGetScreenFromProject(proj, stitchApi, client, screenHint, requestId, onEvent, deviceType, wantsCode);
      }
    } catch {}
  }

  const names = projects.map(p => p.data?.title || p.data?.displayName || p.id).join(", ");
  const msg = `No screens found in any project. Your projects: ${names}\nGenerate a screen first!\n`;
  onEvent({ type: "text_delta", id: requestId, delta: msg });
  onEvent({ type: "done", id: requestId, fullText: msg });
}

async function handleGetScreenFromProject(project, stitchApi, client, screenHint, requestId, onEvent, deviceType, wantsCode) {
  const projectTitle = project.data?.title || project.data?.displayName || project.id;
  const projId = project.projectId || project.id;

  onEvent({ type: "phase_start", id: requestId, phase: `Looking up screens in "${projectTitle}"...` });
  onEvent({ type: "tool_start", id: requestId, tool: "list_screens" });

  const { screens, matched: matchedScreen } = await findScreen(client, projId, screenHint);

  onEvent({ type: "tool_done", id: requestId, tool: "list_screens", isError: false });

  if (!matchedScreen) {
    if (screens.length === 0) {
      const msg = `No screens in "${projectTitle}". Generate one first!\n`;
      onEvent({ type: "text_delta", id: requestId, delta: msg });
      onEvent({ type: "done", id: requestId, fullText: msg });
      return;
    }
    // Auto-pick the latest (last) screen — user said "selected/the/my screen"
    // or hint didn't match any screen name, so just use the most recent one
    const latest = screens[screens.length - 1];
    const latestName = getScreenLabel(latest, screens.length);
    onEvent({ type: "text_delta", id: requestId, delta: `Auto-selecting latest screen: "${latestName}"\n\n` });
    return fetchAndProcessScreen(client, latest, projectTitle, requestId, onEvent, deviceType, wantsCode);
  }

  return fetchAndProcessScreen(client, matchedScreen, projectTitle, requestId, onEvent, deviceType, wantsCode);
}

async function fetchAndProcessScreen(client, screen, projectTitle, requestId, onEvent, deviceType, wantsCode) {
  const screenName = getScreenLabel(screen, 1);
  const projId = screen.projectId;
  const scrId = screen.screenId || screen.id;

  onEvent({ type: "phase_start", id: requestId, phase: `Fetching HTML for "${screenName}"...` });
  onEvent({ type: "tool_start", id: requestId, tool: "get_screen" });

  // Fetch screen details directly via MCP tool (bypass SDK wrapper)
  let htmlUrl = null;
  let imageUrl = null;

  // Check if cached data already has URLs
  if (screen.data?.htmlCode?.downloadUrl) {
    htmlUrl = screen.data.htmlCode.downloadUrl;
  }
  if (screen.data?.screenshot?.downloadUrl) {
    imageUrl = screen.data.screenshot.downloadUrl;
  }

  // If no cached URLs, fetch via get_screen tool
  if (!htmlUrl) {
    try {
      const raw = await client.callTool("get_screen", {
        projectId: projId,
        screenId: scrId,
        name: `projects/${projId}/screens/${scrId}`,
      });
      console.log("  Stitch get_screen raw:", JSON.stringify(raw)?.slice(0, 400));
      if (raw) {
        htmlUrl = raw.htmlCode?.downloadUrl || raw.html?.downloadUrl || null;
        imageUrl = imageUrl || raw.screenshot?.downloadUrl || null;
      }
    } catch (err) {
      console.error("  Stitch: get_screen failed:", err.message);
    }
  }

  onEvent({ type: "tool_done", id: requestId, tool: "get_screen", isError: false });

  if (!htmlUrl) {
    const msg = `Screen "${screenName}" has no HTML available. Raw screen data logged to console.\n`;
    onEvent({ type: "text_delta", id: requestId, delta: msg });
    onEvent({ type: "done", id: requestId, fullText: msg });
    return;
  }

  const html = await fetchUrl(htmlUrl);

  if (!html || html.length < 20) {
    const msg = `Screen "${screenName}" returned empty HTML.\n`;
    onEvent({ type: "text_delta", id: requestId, delta: msg });
    onEvent({ type: "done", id: requestId, fullText: msg });
    return;
  }

  if (wantsCode === "react") {
    // ── Code + live preview mode ──
    onEvent({
      type: "phase_start",
      id: requestId,
      phase: "Starting live preview...",
    });

    try {
      const port = await ensurePreviewServer();
      const slug = addPreview(html, screenName);
      const previewUrl = `http://localhost:${port}/${slug}`;

      const reactCode = htmlToReactComponent(html, screenName);
      const componentName = pascalCase(screenName) || "StitchScreen";

      onEvent({
        type: "text_delta",
        id: requestId,
        delta: `Fetched "${screenName}" from "${projectTitle}"\n` +
               (imageUrl ? `Screenshot: ${imageUrl}\n\n` : "\n") +
               `**Live Preview:** [${previewUrl}](${previewUrl})\n` +
               `Open in your browser to see the interactive page.\n\n` +
               `React component available for download:\n\n` +
               "```download:" + componentName + ".tsx\n" + reactCode + "\n```\n\n",
      });
      onEvent({ type: "done", id: requestId, fullText: `Live preview at ${previewUrl}` });
    } catch (err) {
      const reactCode = htmlToReactComponent(html, screenName);
      const componentName = pascalCase(screenName) || "StitchScreen";
      onEvent({
        type: "text_delta",
        id: requestId,
        delta: `Fetched "${screenName}" from "${projectTitle}"\n\n` +
               "```download:" + componentName + ".tsx\n" + reactCode + "\n```\n",
      });
      onEvent({ type: "done", id: requestId, fullText: `React component — ${reactCode.length} chars` });
    }
  } else {
    // ── Figma output mode: convert to native frames ──
    onEvent({
      type: "text_delta",
      id: requestId,
      delta: `Fetched "${screenName}" from "${projectTitle}" (${html.length} chars)\n` +
             (imageUrl ? `Screenshot: ${imageUrl}\n\n` : "\n") +
             `Converting to Figma frame...\n\n`,
    });
    processStitchHtml(html, "", requestId, screenName, deviceType, onEvent);
  }
}

async function handleGetScreenImage(stitchApi, client, projectHint, screenHint, requestId, onEvent) {
  onEvent({ type: "phase_start", id: requestId, phase: "Finding screen..." });

  const { projects, matched: matchedProject } = await findProject(stitchApi, projectHint);
  const project = matchedProject || (projects.length === 1 ? projects[0] : null);

  if (!project) {
    const names = projects.map(p => p.data?.title || p.data?.displayName || p.id).join(", ");
    const msg = `Which project? Your projects: ${names}\n`;
    onEvent({ type: "text_delta", id: requestId, delta: msg });
    onEvent({ type: "done", id: requestId, fullText: msg });
    return;
  }

  const projId = project.projectId || project.id;
  const { screens, matched: matchedScreen } = await findScreen(client, projId, screenHint);
  const screen = matchedScreen || (screens.length === 1 ? screens[0] : null);

  if (!screen) {
    const names = screens.map((s, i) => getScreenLabel(s, i + 1)).join(", ");
    const msg = `Which screen? Available: ${names}\n`;
    onEvent({ type: "text_delta", id: requestId, delta: msg });
    onEvent({ type: "done", id: requestId, fullText: msg });
    return;
  }

  const scrId = screen.screenId || screen.id;
  onEvent({ type: "tool_start", id: requestId, tool: "get_screen" });

  let imageUrl = screen.data?.screenshot?.downloadUrl || null;
  if (!imageUrl) {
    try {
      const raw = await client.callTool("get_screen", { projectId: projId, screenId: scrId, name: `projects/${projId}/screens/${scrId}` });
      imageUrl = raw?.screenshot?.downloadUrl || null;
    } catch {}
  }

  onEvent({ type: "tool_done", id: requestId, tool: "get_screen", isError: false });

  const screenName = getScreenLabel(screen, 1);
  const msg = imageUrl
    ? `Screenshot of "${screenName}":\n${imageUrl}\n`
    : `No screenshot available for "${screenName}".\n`;

  onEvent({ type: "text_delta", id: requestId, delta: msg });
  onEvent({ type: "done", id: requestId, fullText: msg });
}

// ── HTML → React conversion ─────────────────────────────────────────────────────

function pascalCase(str) {
  return (str || "Screen")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

/**
 * Convert Stitch-generated Tailwind HTML into a React functional component.
 * Handles: class→className, for→htmlFor, style strings→objects,
 * self-closing tags, inline event handlers, etc.
 */
function htmlToReactComponent(html, screenName) {
  const componentName = pascalCase(screenName) || "StitchScreen";

  // Extract just the <body> content if it's a full HTML document
  let body = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) body = bodyMatch[1].trim();

  // Extract <style> or <link> tags for reference
  const styles = [];
  html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => { styles.push(css.trim()); });

  // Convert HTML attributes to JSX
  let jsx = body
    // class → className
    .replace(/\bclass="/g, 'className="')
    .replace(/\bclass='/g, "className='")
    // for → htmlFor
    .replace(/\bfor="/g, 'htmlFor="')
    // Self-close void elements: <img ...>, <input ...>, <br>, <hr>, etc.
    .replace(/<(img|input|br|hr|meta|link|source|area|embed|col|wbr)(\s[^>]*?)?\s*\/?>/gi,
      (_, tag, attrs) => `<${tag}${attrs || ""} />`)
    // tabindex → tabIndex
    .replace(/\btabindex=/g, "tabIndex=")
    // autocomplete → autoComplete
    .replace(/\bautocomplete=/g, "autoComplete=")
    // maxlength → maxLength
    .replace(/\bmaxlength=/g, "maxLength=")
    // Convert inline style="..." strings to style objects
    .replace(/\bstyle="([^"]*)"/g, (_, styleStr) => {
      const obj = styleStr.split(";").filter(Boolean).map(s => {
        const [prop, ...valParts] = s.split(":");
        if (!prop || !valParts.length) return null;
        const camelProp = prop.trim().replace(/-([a-z])/g, (__, c) => c.toUpperCase());
        const val = valParts.join(":").trim();
        // Numbers without units
        const numVal = /^-?\d+(\.\d+)?$/.test(val) ? val : `"${val}"`;
        return `${camelProp}: ${numVal}`;
      }).filter(Boolean).join(", ");
      return `style={{${obj}}}`;
    })
    // Remove onclick/onchange etc. (can't convert inline JS reliably)
    .replace(/\bon\w+="[^"]*"/g, "");

  // Build the component
  const lines = [];
  lines.push(`import React from "react";`);
  lines.push(``);

  // If there were inline styles, include them as a <style> in the component
  if (styles.length > 0) {
    lines.push(`const inlineStyles = \`${styles.join("\n")}\`;`);
    lines.push(``);
  }

  lines.push(`export default function ${componentName}() {`);
  lines.push(`  return (`);

  if (styles.length > 0) {
    lines.push(`    <>`);
    lines.push(`      <style dangerouslySetInnerHTML={{ __html: inlineStyles }} />`);
    lines.push(`      ${jsx}`);
    lines.push(`    </>`);
  } else {
    // Wrap in a fragment if multiple root elements
    const rootTags = (jsx.match(/^<[a-zA-Z]/gm) || []).length;
    if (rootTags > 1) {
      lines.push(`    <>`);
      lines.push(`      ${jsx}`);
      lines.push(`    </>`);
    } else {
      lines.push(`    ${jsx}`);
    }
  }

  lines.push(`  );`);
  lines.push(`}`);

  return lines.join("\n");
}

// ── Main runner ────────────────────────────────────────────────────────────────

function runStitch({ message, requestId, apiKey, projectId, model, designContext, onEvent }) {
  const emitter = new EventEmitter();
  let aborted = false;

  // Auto-get access token from OAuth if not provided directly
  if (!apiKey && hasStitchAuth()) {
    // Will be fetched async inside the main flow
  } else if (!apiKey) {
    onEvent({
      type: "error",
      id: requestId,
      error: 'Not signed in to Stitch. Click "Sign in with Google" on the login screen to connect your Google account.',
    });
    onEvent({ type: "done", id: requestId, fullText: "" });
    setTimeout(() => emitter.emit("close", 1), 0);
    emitter.kill = () => {};
    return emitter;
  }

  const prompt = (message || "").trim() || "Create a simple landing page";
  const workspaceName = projectId || "Figma Intelligence";

  const deviceType = /mobile|ios|android|phone|app\s+screen/i.test(prompt)
    ? "MOBILE"
    : "DESKTOP";

  function abort() {
    aborted = true;
    emitter.emit("close", null);
  }

  (async () => {
    let client = null;

    try {
      // ── Step 1: Load SDK & connect ─────────────────────────────────────
      onEvent({
        type: "phase_start",
        id: requestId,
        phase: "Connecting to Stitch...",
      });

      const { Stitch, StitchToolClient } = await loadSdk();

      // Get access token: from direct input or OAuth refresh
      let accessToken = apiKey;
      if (!accessToken) {
        accessToken = await getStitchAccessToken();
      }
      if (!accessToken) {
        onEvent({ type: "error", id: requestId, error: 'Stitch session expired. Click "Sign in with Google" to reconnect.' });
        onEvent({ type: "done", id: requestId, fullText: "" });
        return;
      }

      // SDK requires accessToken + projectId for OAuth auth.
      // projectId is Google Cloud project ID (for X-Goog-User-Project header).
      // Auto-detect from user's GCP projects if not provided.
      let gcpProjectId = projectId || process.env.GOOGLE_CLOUD_PROJECT;
      if (!gcpProjectId) {
        gcpProjectId = await detectGcpProject(accessToken);
      }
      client = new StitchToolClient({ accessToken, projectId: gcpProjectId });
      await client.connect();

      if (aborted) return;

      const stitchApi = new Stitch(client);

      // ── Step 2: Detect intent ──────────────────────────────────────────
      const intent = detectStitchIntent(prompt);

      switch (intent.type) {
        case "list_projects":
          await handleListProjects(stitchApi, requestId, onEvent);
          return;

        case "list_screens":
          await handleListScreens(stitchApi, client, intent.projectHint, requestId, onEvent);
          return;

        case "get_screen":
          await handleGetScreen(stitchApi, client, intent.projectHint, intent.screenHint, requestId, onEvent, deviceType, intent.wantsCode);
          return;

        case "get_screen_image":
          await handleGetScreenImage(stitchApi, client, intent.projectHint, intent.screenHint, requestId, onEvent);
          return;

        // default: fall through to generation pipeline below
      }

      if (aborted) return;

      // ── Generation pipeline (existing flow) ────────────────────────────

      // Find or create project
      onEvent({
        type: "phase_start",
        id: requestId,
        phase: "Setting up project...",
      });

      let project;
      try {
        const projects = await stitchApi.projects();
        const existing = projects.find(p =>
          p.data?.title === workspaceName || p.data?.displayName === workspaceName
        );
        project = existing || await stitchApi.createProject(workspaceName);
      } catch {
        project = await stitchApi.createProject(workspaceName);
      }

      if (aborted) return;

      // Check for design context: attached .md file takes priority over saved one
      const existingDesignMd = designContext || loadDesignMd(workspaceName);
      let generationPrompt = prompt;

      if (existingDesignMd) {
        onEvent({
          type: "phase_start",
          id: requestId,
          phase: designContext ? "Loading attached design context..." : "Loading design context (design.md)...",
        });
        generationPrompt =
          `Use the following design system for visual consistency:\n\n` +
          `${existingDesignMd}\n\n---\n\n` +
          `Now generate: ${prompt}`;

        onEvent({
          type: "text_delta",
          id: requestId,
          delta: designContext ? "Using attached .md design context.\n\n" : "Loaded existing design.md for visual consistency.\n\n",
        });
      }

      // Generate the screen
      onEvent({
        type: "phase_start",
        id: requestId,
        phase: `Generating UI with Stitch (${deviceType.toLowerCase()})...`,
      });
      onEvent({ type: "tool_start", id: requestId, tool: "generate_screen_from_text" });

      // Bypass SDK's project.generate() — it crashes when the API response
      // structure doesn't match: raw.outputComponents[0].design.screens[0]
      // throws "Cannot read properties of undefined (reading 'screens')".
      // Instead, call the tool directly and handle the raw response safely.
      const genRaw = await client.callTool("generate_screen_from_text", {
        projectId: project.id,
        prompt: generationPrompt,
        deviceType,
      });
      stitchLog("generate raw", genRaw);

      // Extract screen data from whichever response structure the API returns.
      // outputComponents is an array where some entries are design systems
      // (have `designSystem` key) and others contain actual screens
      // (have `design.screens` key). We need the screen, not the design system.
      let screenData = null;
      if (genRaw?.outputComponents) {
        for (const comp of genRaw.outputComponents) {
          if (comp?.design?.screens?.[0]) {
            screenData = comp.design.screens[0];
            break;
          }
        }
      }
      if (!screenData && genRaw?.screens?.[0]) {
        screenData = genRaw.screens[0];
      }
      if (!screenData && (genRaw?.id || genRaw?.htmlCode)) {
        screenData = genRaw;
      }
      stitchLog("screenData extracted", screenData);

      if (!screenData) {
        onEvent({ type: "tool_done", id: requestId, tool: "generate_screen_from_text", isError: true });
        const msg = "Stitch generation returned an unexpected response. Try again or use a different prompt.\n";
        onEvent({ type: "text_delta", id: requestId, delta: msg });
        onEvent({ type: "done", id: requestId, fullText: msg });
        return;
      }

      // Build a screen-like object with the same interface we use downstream
      const screen = {
        id: screenData.id || (screenData.name ? screenData.name.split("/screens/").pop() : null),
        screenId: screenData.id || (screenData.name ? screenData.name.split("/screens/").pop() : null),
        data: screenData,
        getHtml: async () => {
          if (screenData.htmlCode?.downloadUrl) return screenData.htmlCode.downloadUrl;
          const scrId = screenData.id || (screenData.name ? screenData.name.split("/screens/").pop() : null);
          stitchLog("getHtml: no cached URL, fetching screen " + scrId);

          // Try fetching, with one retry after a short delay (HTML may not be ready immediately)
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              if (attempt > 0) await new Promise(r => setTimeout(r, 3000));
              const raw = await client.callTool("get_screen", {
                projectId: project.id,
                screenId: scrId,
                name: `projects/${project.id}/screens/${scrId}`,
              });
              stitchLog("get_screen raw (attempt " + attempt + ")", raw);
              const url = raw?.htmlCode?.downloadUrl || raw?.html?.downloadUrl || null;
              if (url) return url;
            } catch (err) {
              stitchLog("getHtml attempt " + attempt + " failed: " + err.message);
            }
          }

          // Last resort: list screens and find ours
          try {
            const listRaw = await client.callTool("list_screens", { projectId: project.id });
            const allScreens = listRaw?.screens || listRaw?.items || (Array.isArray(listRaw) ? listRaw : []);
            const ours = allScreens.find(s => s.id === scrId || (s.name && s.name.includes(scrId)));
            if (ours?.htmlCode?.downloadUrl) return ours.htmlCode.downloadUrl;
            stitchLog("screen found in list but no htmlCode", ours);
          } catch {}

          return null;
        },
      };

      onEvent({ type: "tool_done", id: requestId, tool: "generate_screen_from_text", isError: false });

      if (aborted) return;

      // Extract Design DNA & save design.md (first generation only)
      if (!existingDesignMd) {
        onEvent({
          type: "phase_start",
          id: requestId,
          phase: "Extracting design context (Design DNA)...",
        });
        onEvent({ type: "tool_start", id: requestId, tool: "extract_design_context" });

        try {
          const designContext = await client.callTool("extract_design_context", {
            projectId: project.id,
            screenId: screen.id,
          });

          onEvent({ type: "tool_done", id: requestId, tool: "extract_design_context", isError: false });

          const designMdContent = buildDesignMd(designContext, workspaceName, prompt, screen.data?.theme);
          const savedPath = saveDesignMd(workspaceName, designMdContent);

          if (savedPath) {
            onEvent({
              type: "text_delta",
              id: requestId,
              delta: `Design context saved to design.md\n` +
                     `   Path: ${savedPath}\n` +
                     `   Future screens in "${workspaceName}" will use this design system.\n\n`,
            });
          }
        } catch (err) {
          onEvent({ type: "tool_done", id: requestId, tool: "extract_design_context", isError: true });
          console.log(`  Warning: extract_design_context failed: ${err.message}`);
          onEvent({
            type: "text_delta",
            id: requestId,
            delta: `Could not extract design context: ${err.message}\n\n`,
          });
        }
      }

      if (aborted) return;

      // Get HTML download URL & fetch it
      onEvent({
        type: "phase_start",
        id: requestId,
        phase: "Fetching generated code...",
      });
      onEvent({ type: "tool_start", id: requestId, tool: "fetch_screen_code" });

      const htmlUrl = await screen.getHtml();

      onEvent({ type: "tool_done", id: requestId, tool: "fetch_screen_code", isError: false });

      if (!htmlUrl) {
        onEvent({
          type: "text_delta",
          id: requestId,
          delta: "Stitch generated a screen but returned no HTML URL. Try a different prompt.",
        });
        onEvent({ type: "done", id: requestId, fullText: "" });
        return;
      }

      const html = await fetchUrl(htmlUrl);

      if (aborted) return;

      if (!html || html.length < 20) {
        onEvent({
          type: "text_delta",
          id: requestId,
          delta: "Stitch HTML download returned empty content.",
        });
        onEvent({ type: "done", id: requestId, fullText: "" });
        return;
      }

      // Check if user wants code output (React/HTML/web) vs Figma frames
      const codeIntent = detectCodeIntent(prompt.toLowerCase());

      if (codeIntent === "react") {
        // ── Code + live preview mode ──
        const screenName = screen.data?.title || screen.data?.displayName || "Generated Screen";

        // Start preview server and serve the HTML
        onEvent({
          type: "phase_start",
          id: requestId,
          phase: "Starting live preview...",
        });

        try {
          const port = await ensurePreviewServer();
          const slug = addPreview(html, screenName);
          const previewUrl = `http://localhost:${port}/${slug}`;

          // Convert to React component for download
          const reactCode = htmlToReactComponent(html, screenName);
          const componentName = pascalCase(screenName) || "StitchScreen";

          onEvent({
            type: "text_delta",
            id: requestId,
            delta: `**Live Preview:** [${previewUrl}](${previewUrl})\n` +
                   `Open in your browser to see the interactive page.\n\n` +
                   `React component available for download:\n\n` +
                   "```download:" + componentName + ".tsx\n" + reactCode + "\n```\n\n" +
                   `**To run locally as a React app:**\n` +
                   `1. Install Tailwind CSS: \`npm install tailwindcss @tailwindcss/vite\`\n` +
                   `2. Save as \`${componentName}.tsx\`\n` +
                   `3. Import: \`import ${componentName} from './${componentName}'\`\n`,
          });
          onEvent({ type: "done", id: requestId, fullText: `Live preview at ${previewUrl}` });
        } catch (err) {
          // Fallback: just show the code if preview server fails
          const reactCode = htmlToReactComponent(html, screenName);
          const componentName = pascalCase(screenName) || "StitchScreen";
          onEvent({
            type: "text_delta",
            id: requestId,
            delta: `React component (preview server unavailable):\n\n` +
                   "```download:" + componentName + ".tsx\n" + reactCode + "\n```\n",
          });
          onEvent({ type: "done", id: requestId, fullText: `React component — ${reactCode.length} chars` });
        }
      } else {
        // ── Figma output mode: convert to native frames ──
        processStitchHtml(html, "", requestId, prompt, deviceType, onEvent);
      }

    } catch (err) {
      if (!aborted) {
        let errMsg = err.message || String(err);

        if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("PERMISSION") || errMsg.includes("API keys are not supported")) {
          errMsg = `Stitch auth failed. This API requires an OAuth2 access token, not an API key. Get one at stitch.withgoogle.com → Settings, or run: gcloud auth print-access-token`;
        } else if (errMsg.includes("429") || errMsg.includes("RATE_LIMITED")) {
          errMsg = "Stitch rate limit exceeded. Free tier: 350 generations/month. Please wait and try again.";
        } else if (errMsg.includes("ENOTFOUND") || errMsg.includes("ECONNREFUSED")) {
          errMsg = "Cannot reach Stitch servers. Check your internet connection.";
        }

        onEvent({ type: "error", id: requestId, error: `Stitch: ${errMsg}` });
        onEvent({ type: "done", id: requestId, fullText: "" });
      }
    } finally {
      if (client) {
        try { await client.close(); } catch {}
      }
      emitter.emit("close", 0);
    }
  })();

  emitter.kill = abort;
  return emitter;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : require("http");
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }
      let data = "";
      res.on("data", (chunk) => { data += chunk.toString(); });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function processStitchHtml(html, css, requestId, prompt, deviceType, onEvent) {
  onEvent({
    type: "phase_start",
    id: requestId,
    phase: "Converting to Figma frames…",
  });

  let result;
  try {
    result = htmlToFigmaExecuteCode(html, css, prompt, deviceType || "DESKTOP");
  } catch (err) {
    onEvent({
      type: "error",
      id: requestId,
      error: `HTML-to-Figma conversion failed: ${err.message}`,
    });
    onEvent({ type: "done", id: requestId, fullText: "" });
    return;
  }

  if (!result || !result.code) {
    onEvent({
      type: "text_delta",
      id: requestId,
      delta: "Could not convert Stitch output to Figma frames. The generated HTML may be too complex.",
    });
    onEvent({ type: "done", id: requestId, fullText: "" });
    return;
  }

  // Emit a single execute command with the full Figma Plugin API code
  onEvent({ type: "tool_start", id: requestId, tool: "figma_execute" });
  onEvent({
    type: "figma_command",
    id: requestId,
    method: "execute",
    params: { code: result.code },
  });
  onEvent({ type: "tool_done", id: requestId, tool: "figma_execute", isError: false });

  const summary = `Generated ${result.commandCount} Figma element(s) from Stitch for: "${prompt}"`;
  onEvent({ type: "text_delta", id: requestId, delta: summary });
  onEvent({ type: "done", id: requestId, fullText: summary });
}

module.exports = { runStitch };
