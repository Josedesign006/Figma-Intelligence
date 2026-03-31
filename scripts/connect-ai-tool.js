#!/usr/bin/env node
"use strict";

/**
 * connect-ai-tool.js
 * Interactive wizard to register the Figma Intelligence MCP server
 * with any supported AI coding tool.
 *
 * Usage:  npm run connect
 *         npm run connect -- --tool cursor
 *         npm run connect -- --tool vscode --tool cursor
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const MCP_SERVER_PATH = path.join(ROOT_DIR, "figma-intelligence-layer", "dist", "index.js");

// ─── MCP server entry used in every config ────────────────────────────────────
function mcpEntry(figmaToken) {
  return {
    command: "node",
    args: [MCP_SERVER_PATH],
    env: {
      FIGMA_ACCESS_TOKEN: figmaToken,
      FIGMA_BRIDGE_PORT: "9001",
      ENABLE_DECISION_LOG: "true",
    },
  };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
// Each tool has:
//   id          – machine name used with --tool flag
//   label       – display name
//   detect()    – returns true when the tool looks installed
//   install(token, dryRun) – writes config, returns { ok, message }
const TOOLS = [
  // ── Claude Code (Claude CLI) ──────────────────────────────────────────────
  {
    id: "claude",
    label: "Claude Code (Claude CLI)",
    detect() {
      return Boolean(which("claude"));
    },
    install(token) {
      const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
      return patchJsonFile(settingsPath, (cfg) => {
        if (!cfg.mcpServers) cfg.mcpServers = {};
        const existing = cfg.mcpServers["figma-intelligence-layer"] || {};
        cfg.mcpServers["figma-intelligence-layer"] = {
          ...mcpEntry(token),
          env: { ...(existing.env || {}), ...mcpEntry(token).env },
        };
        // Auto-allow MCP tools so users don't need manual approval
        if (!cfg.permissions) cfg.permissions = {};
        if (!Array.isArray(cfg.permissions.allow)) cfg.permissions.allow = [];
        for (const perm of ["mcp__figma-intelligence-layer__*", "mcp__design-bridge__*"]) {
          if (!cfg.permissions.allow.includes(perm)) cfg.permissions.allow.push(perm);
        }
        return cfg;
      }, `~/.claude/settings.json`);
    },
  },

  // ── VS Code (GitHub Copilot / Continue / any MCP-aware extension) ─────────
  {
    id: "vscode",
    label: "VS Code (GitHub Copilot / MCP extensions)",
    detect() {
      return Boolean(which("code")) || fs.existsSync(vscodeMcpPath());
    },
    install(token) {
      // Write both workspace .vscode/mcp.json and user-level settings
      const workspacePath = path.join(ROOT_DIR, ".vscode", "mcp.json");
      const r1 = writeJsonFile(workspacePath, buildVscodeMcp(token), ".vscode/mcp.json (workspace)");

      // Write .vscode/settings.json to auto-enable MCP in VS Code
      const vsSettingsPath = path.join(ROOT_DIR, ".vscode", "settings.json");
      patchJsonFile(vsSettingsPath, (cfg) => {
        cfg["chat.mcp.discovery.enabled"] = true;
        cfg["chat.mcp.autostart"] = true;
        cfg["github.copilot.chat.mcp.enabled"] = true;
        return cfg;
      }, ".vscode/settings.json (MCP auto-enable)");

      // User-level: Code/User/settings.json on each platform
      const userSettingsPath = vscodeUserSettingsPath();
      const r2 = userSettingsPath
        ? patchJsonFile(userSettingsPath, (cfg) => {
            if (!cfg["mcp.servers"]) cfg["mcp.servers"] = {};
            cfg["mcp.servers"]["figma-intelligence-layer"] = mcpEntry(token);
            return cfg;
          }, "VS Code user settings.json")
        : { ok: true, message: "User settings path not found — workspace config written only" };

      return r1.ok ? r2 : r1;
    },
  },

  // ── Cursor ────────────────────────────────────────────────────────────────
  {
    id: "cursor",
    label: "Cursor",
    detect() {
      return Boolean(which("cursor")) || fs.existsSync(path.join(os.homedir(), ".cursor"));
    },
    install(token) {
      const mcpPath = path.join(os.homedir(), ".cursor", "mcp.json");
      return patchJsonFile(mcpPath, (cfg) => {
        if (!cfg.mcpServers) cfg.mcpServers = {};
        cfg.mcpServers["figma-intelligence-layer"] = mcpEntry(token);
        return cfg;
      }, "~/.cursor/mcp.json");
    },
  },

  // ── Windsurf (Codeium) ────────────────────────────────────────────────────
  {
    id: "windsurf",
    label: "Windsurf (Codeium)",
    detect() {
      const p = path.join(os.homedir(), ".codeium", "windsurf");
      return fs.existsSync(p) || Boolean(which("windsurf"));
    },
    install(token) {
      const mcpPath = path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json");
      return patchJsonFile(mcpPath, (cfg) => {
        if (!cfg.mcpServers) cfg.mcpServers = {};
        cfg.mcpServers["figma-intelligence-layer"] = mcpEntry(token);
        return cfg;
      }, "~/.codeium/windsurf/mcp_config.json");
    },
  },

  // ── Zed ───────────────────────────────────────────────────────────────────
  {
    id: "zed",
    label: "Zed",
    detect() {
      return Boolean(which("zed")) || fs.existsSync(path.join(os.homedir(), ".config", "zed"));
    },
    install(token) {
      const settingsPath = path.join(os.homedir(), ".config", "zed", "settings.json");
      return patchJsonFile(settingsPath, (cfg) => {
        if (!cfg.context_servers) cfg.context_servers = {};
        cfg.context_servers["figma-intelligence-layer"] = {
          command: {
            path: "node",
            args: [MCP_SERVER_PATH],
            env: mcpEntry(token).env,
          },
        };
        return cfg;
      }, "~/.config/zed/settings.json");
    },
  },

  // ── Continue.dev ──────────────────────────────────────────────────────────
  {
    id: "continue",
    label: "Continue.dev",
    detect() {
      return fs.existsSync(path.join(os.homedir(), ".continue"));
    },
    install(token) {
      const configPath = path.join(os.homedir(), ".continue", "config.json");
      return patchJsonFile(configPath, (cfg) => {
        if (!cfg.mcpServers) cfg.mcpServers = [];
        // Remove existing entry (avoid duplicates)
        cfg.mcpServers = cfg.mcpServers.filter(
          (s) => s.name !== "figma-intelligence-layer"
        );
        cfg.mcpServers.push({
          name: "figma-intelligence-layer",
          ...mcpEntry(token),
        });
        return cfg;
      }, "~/.continue/config.json");
    },
  },

  // ── OpenAI Codex CLI ──────────────────────────────────────────────────────
  {
    id: "codex",
    label: "OpenAI Codex CLI",
    detect() {
      return (
        Boolean(which("codex")) ||
        fs.existsSync("/Applications/Codex.app/Contents/Resources/codex")
      );
    },
    install(token) {
      const codexBin =
        which("codex") || "/Applications/Codex.app/Contents/Resources/codex";
      if (!codexBin || !fs.existsSync(codexBin)) {
        return { ok: false, message: "Codex CLI binary not found" };
      }
      spawnSync(codexBin, ["mcp", "remove", "figma-intelligence-layer"], {
        stdio: "pipe",
      });
      const entry = mcpEntry(token);
      const result = spawnSync(
        codexBin,
        [
          "mcp", "add", "figma-intelligence-layer",
          "--env", `FIGMA_ACCESS_TOKEN=${entry.env.FIGMA_ACCESS_TOKEN}`,
          "--env", `FIGMA_BRIDGE_PORT=${entry.env.FIGMA_BRIDGE_PORT}`,
          "--env", `ENABLE_DECISION_LOG=${entry.env.ENABLE_DECISION_LOG}`,
          "--", "node", MCP_SERVER_PATH,
        ],
        { encoding: "utf8", stdio: "pipe" }
      );
      if (result.status === 0) {
        return { ok: true, message: "Registered in ~/.codex/config.toml" };
      }
      return {
        ok: false,
        message: `codex mcp add failed: ${(result.stderr || result.stdout || "unknown error").trim()}`,
      };
    },
  },

  // ── Kiro (AWS AI IDE) ─────────────────────────────────────────────────────
  {
    id: "kiro",
    label: "Kiro (AWS AI IDE)",
    detect() {
      return (
        Boolean(which("kiro")) ||
        fs.existsSync(path.join(os.homedir(), ".kiro"))
      );
    },
    install(token) {
      const mcpPath = path.join(os.homedir(), ".kiro", "mcp.json");
      return patchJsonFile(mcpPath, (cfg) => {
        if (!cfg.mcpServers) cfg.mcpServers = {};
        cfg.mcpServers["figma-intelligence-layer"] = mcpEntry(token);
        return cfg;
      }, "~/.kiro/mcp.json");
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function which(cmd) {
  const r = spawnSync("sh", ["-lc", `command -v ${cmd}`], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function vscodeMcpPath() {
  return path.join(ROOT_DIR, ".vscode", "mcp.json");
}

function vscodeUserSettingsPath() {
  const home = os.homedir();
  const candidates = [
    // macOS
    path.join(home, "Library", "Application Support", "Code", "User", "settings.json"),
    // Linux
    path.join(home, ".config", "Code", "User", "settings.json"),
    // Windows
    path.join(home, "AppData", "Roaming", "Code", "User", "settings.json"),
    // VS Code Insiders
    path.join(home, "Library", "Application Support", "Code - Insiders", "User", "settings.json"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0]; // default to first (macOS) if none exist
}

function buildVscodeMcp(token) {
  return {
    servers: {
      "figma-intelligence-layer": {
        type: "stdio",
        ...mcpEntry(token),
      },
    },
  };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function writeJsonFile(filePath, data, label) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return { ok: true, message: `Written to ${label}` };
  } catch (err) {
    return { ok: false, message: `Failed to write ${label}: ${err.message}` };
  }
}

function patchJsonFile(filePath, patchFn, label) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const existing = readJson(filePath);
    const patched = patchFn(existing);
    fs.writeFileSync(filePath, JSON.stringify(patched, null, 2));
    return { ok: true, message: `Updated ${label}` };
  } catch (err) {
    return { ok: false, message: `Failed to update ${label}: ${err.message}` };
  }
}

function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// ─── Token resolution ─────────────────────────────────────────────────────────

function readExistingToken() {
  // Try Claude settings first (most likely to have the token already)
  const claudeSettings = path.join(os.homedir(), ".claude", "settings.json");
  if (fs.existsSync(claudeSettings)) {
    const cfg = readJson(claudeSettings);
    const token = cfg?.mcpServers?.["figma-intelligence-layer"]?.env?.FIGMA_ACCESS_TOKEN;
    if (token && token !== "YOUR_FIGMA_TOKEN_HERE") return token;
  }
  // Try VS Code workspace config
  const vscodeConfig = path.join(ROOT_DIR, ".vscode", "mcp.json");
  if (fs.existsSync(vscodeConfig)) {
    const cfg = readJson(vscodeConfig);
    const token = cfg?.servers?.["figma-intelligence-layer"]?.env?.FIGMA_ACCESS_TOKEN;
    if (token && token !== "YOUR_FIGMA_TOKEN_HERE") return token;
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Parse --tool flags
  const requestedIds = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tool" && args[i + 1]) {
      requestedIds.push(args[++i]);
    }
  }

  console.log("");
  console.log("┌─────────────────────────────────────────────────────┐");
  console.log("│     Figma Intelligence Layer — Connect AI Tool      │");
  console.log("└─────────────────────────────────────────────────────┘");
  console.log("");

  // Verify build exists
  if (!fs.existsSync(MCP_SERVER_PATH)) {
    console.error(`❌ MCP server not built yet.`);
    console.error(`   Run:  npm run setup   (first-time) or`);
    console.error(`         cd figma-intelligence-layer && npm run build`);
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // ── Figma token ────────────────────────────────────────────────────────────
  const existingToken = readExistingToken();
  let figmaToken;
  if (existingToken) {
    console.log(`🔑 Figma token found: ${existingToken.slice(0, 12)}••••`);
    const answer = await prompt(rl, "   Press Enter to reuse it, or paste a new token: ");
    figmaToken = answer.trim() || existingToken;
  } else {
    console.log("🔑 Figma Personal Access Token required.");
    console.log("   Get one: Figma Desktop → Account Settings → Security → Personal access tokens");
    figmaToken = (await prompt(rl, "   Paste your token: ")).trim();
    if (!figmaToken) {
      figmaToken = "YOUR_FIGMA_TOKEN_HERE";
      console.log("   ⚠  No token provided — you can edit it in each tool's config file later.");
    }
  }
  console.log("");

  // ── Tool selection ─────────────────────────────────────────────────────────
  let selectedTools;

  if (requestedIds.length > 0) {
    // --tool flag(s) provided — use those directly
    selectedTools = requestedIds.map((id) => {
      const tool = TOOLS.find((t) => t.id === id);
      if (!tool) {
        console.error(`❌ Unknown tool id: "${id}"`);
        console.error(`   Valid ids: ${TOOLS.map((t) => t.id).join(", ")}`);
        process.exit(1);
      }
      return tool;
    });
  } else {
    // Interactive menu
    const detected = TOOLS.filter((t) => t.detect());
    const undetected = TOOLS.filter((t) => !t.detect());

    console.log("📋 Supported AI tools:");
    console.log("");

    const allTools = [...detected, ...undetected];
    allTools.forEach((tool, idx) => {
      const found = detected.includes(tool);
      console.log(`  ${idx + 1}. ${tool.label}${found ? "  ✔ detected" : ""}`);
    });

    console.log("");
    console.log("  a. All detected tools (recommended)");
    console.log("  e. Every tool in the list");
    console.log("  q. Quit");
    console.log("");

    const answer = (await prompt(rl, "Which tool(s) to connect? (enter numbers separated by commas, or a/e/q): ")).trim().toLowerCase();

    if (answer === "q" || answer === "") {
      console.log("Bye.");
      rl.close();
      return;
    }

    if (answer === "a") {
      selectedTools = detected;
      if (selectedTools.length === 0) {
        console.log("⚠  No tools detected automatically. Use 'e' to register all, or install a tool first.");
        rl.close();
        return;
      }
    } else if (answer === "e") {
      selectedTools = allTools;
    } else {
      const indices = answer.split(",").map((s) => parseInt(s.trim(), 10) - 1);
      selectedTools = indices
        .filter((i) => i >= 0 && i < allTools.length)
        .map((i) => allTools[i]);
      if (selectedTools.length === 0) {
        console.log("❌ No valid selection. Exiting.");
        rl.close();
        return;
      }
    }
  }

  rl.close();

  // ── Install ────────────────────────────────────────────────────────────────
  console.log("");
  console.log(`⚙️  Registering MCP server with ${selectedTools.length} tool(s)...`);
  console.log("");

  let successCount = 0;
  for (const tool of selectedTools) {
    process.stdout.write(`   ${tool.label} ... `);
    const result = tool.install(figmaToken);
    if (result.ok) {
      console.log(`✔  ${result.message}`);
      successCount++;
    } else {
      console.log(`✗  ${result.message}`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("");
  console.log("─────────────────────────────────────────────────────");
  if (successCount === selectedTools.length) {
    console.log(`✅ Connected ${successCount}/${selectedTools.length} tool(s) successfully.`);
  } else {
    console.log(`⚠  Connected ${successCount}/${selectedTools.length} tool(s). Check errors above.`);
  }
  console.log("");
  console.log("Next steps:");
  console.log("  1. Restart the AI tool (VS Code, Cursor, etc.) to pick up the new MCP server.");
  console.log("  2. Make sure the bridge relay is running:  npm start");
  console.log("  3. Open Figma Desktop and click ▶ Start in the plugin panel.");
  console.log("  4. Run  npm run status  to verify everything is healthy.");
  console.log("");
}

main().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});
