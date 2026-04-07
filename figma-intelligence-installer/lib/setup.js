/**
 * setup.js — First-time setup for Figma Intelligence
 *
 * 1. Generate session token
 * 2. Download platform binary from GitHub Releases
 * 3. Detect installed AI tools
 * 4. Register cloud MCP server URL in each tool's config
 * 5. Prompt for Figma access token
 * 6. Save config
 */

const { randomUUID } = require("crypto");
const { mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, copyFileSync } = require("fs");
const { join } = require("path");
const { homedir, platform, arch } = require("os");
const { createInterface } = require("readline");
// Binary download no longer needed — relay runs via Node.js bundle

const CONFIG_DIR = join(homedir(), ".figma-intelligence");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const BIN_DIR = join(CONFIG_DIR, "bin");
// Plugin goes in a VISIBLE location so users can easily find it in Figma
const PLUGIN_DIR = join(homedir(), "Documents", "Figma Intelligence Plugin");

// ── UPDATE THIS after Railway deployment ──
const DEFAULT_CLOUD_URL = "https://figma-intelligence-server-production.up.railway.app";

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runSetup() {
  console.log("\n  Figma Intelligence — Setup\n");

  // 1. Create config directory
  mkdirSync(CONFIG_DIR, { recursive: true });
  mkdirSync(BIN_DIR, { recursive: true });

  // 2. Load existing config or create new
  let config = {};
  if (existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
      console.log("  Found existing config, updating…\n");
    } catch {}
  }

  // 3. Generate session token (or keep existing)
  if (!config.sessionToken) {
    config.sessionToken = randomUUID();
    console.log(`  Generated session token: ${config.sessionToken.slice(0, 8)}…`);
  } else {
    console.log(`  Using existing session token: ${config.sessionToken.slice(0, 8)}…`);
  }

  // 4. Cloud URL
  config.cloudUrl = config.cloudUrl || DEFAULT_CLOUD_URL;
  const customUrl = await ask(`  Cloud server URL [${config.cloudUrl}]: `);
  // Only accept valid URLs — ignore accidental input like "clear", "y", etc.
  if (customUrl && customUrl.startsWith("http")) config.cloudUrl = customUrl;
  // Always ensure cloudUrl is a valid URL
  if (!config.cloudUrl || !config.cloudUrl.startsWith("http")) {
    config.cloudUrl = DEFAULT_CLOUD_URL;
  }

  // 5. Figma access token
  if (!config.figmaAccessToken) {
    console.log("\n  You need a Figma Personal Access Token.");
    console.log("  Get one at: https://www.figma.com/developers/api#access-tokens\n");
    const token = await ask("  Figma Access Token: ");
    if (token) {
      config.figmaAccessToken = token;
    } else {
      console.log("  Skipping — you can add this later in ~/.figma-intelligence/config.json");
    }
  } else {
    console.log(`  Figma token: ${config.figmaAccessToken.slice(0, 8)}… (already set)`);
  }

  // 6. Install relay and all dependencies to persistent location (~/.figma-intelligence/)
  console.log("\n  Installing relay…");
  const relayFiles = [
    "bridge-relay.bundle.js",
    "chat-runner.js",
    "shared-prompt-config.js",
    "anthropic-chat-runner.js",
    "codex-runner.js",
    "gemini-runner.js",
    "gemini-cli-runner.js",
    "perplexity-runner.js",
    "stitch-runner.js",
    "stitch-auth.js",
    "claude-auth.js",
    "content-context.js",
    "component-schemas.js",
    "token-resolver.js",
    "html-to-figma.js",
    "create-button.js",
    "mcp-stdio-proxy.js",
    "mcp-server.bundle.js",
  ];
  for (const file of relayFiles) {
    const src = join(__dirname, file);
    const dest = join(CONFIG_DIR, file);
    if (existsSync(src)) {
      copyFileSync(src, dest);
    }
  }
  // Copy spec-helpers directory
  const specHelpersSrc = join(__dirname, "spec-helpers");
  const specHelpersDest = join(CONFIG_DIR, "spec-helpers");
  try {
    mkdirSync(specHelpersDest, { recursive: true });
    const { readdirSync } = require("fs");
    if (existsSync(specHelpersSrc)) {
      for (const f of readdirSync(specHelpersSrc)) {
        copyFileSync(join(specHelpersSrc, f), join(specHelpersDest, f));
      }
    }
  } catch {}
  console.log(`  Relay installed to: ${CONFIG_DIR}`);

  // 7. Install Figma plugin files
  console.log("\n  Installing Figma plugin…");
  try {
    mkdirSync(PLUGIN_DIR, { recursive: true });
    const pluginSrc = join(__dirname, "..", "plugin");
    const pluginFiles = ["manifest.json", "code.js", "ui.html"];
    for (const file of pluginFiles) {
      const src = join(pluginSrc, file);
      if (existsSync(src)) {
        copyFileSync(src, join(PLUGIN_DIR, file));
      }
    }
    console.log(`  Plugin installed to: ${PLUGIN_DIR}`);

    // Also copy to the old hidden location for backward compatibility
    const oldPluginDir = join(CONFIG_DIR, "plugin");
    try {
      mkdirSync(oldPluginDir, { recursive: true });
      for (const file of pluginFiles) {
        const src = join(pluginSrc, file);
        if (existsSync(src)) copyFileSync(src, join(oldPluginDir, file));
      }
    } catch {}

    // Also update any other known plugin locations on this machine
    // (the user may have imported from a different path)
    const { readdirSync, statSync } = require("fs");
    const searchDirs = [
      join(homedir(), "Downloads"),
      join(homedir(), "Documents"),
      join(homedir(), "Desktop"),
      join(homedir(), "Projects"),
      join(homedir(), "dev"),
      join(homedir(), "code"),
    ];
    for (const dir of searchDirs) {
      try {
        if (!existsSync(dir)) continue;
        // Look for figma-intelligence plugin directories (up to 3 levels deep)
        const findPlugins = (base, depth) => {
          if (depth > 3) return;
          try {
            const entries = readdirSync(base);
            for (const entry of entries) {
              if (entry === "node_modules" || entry === ".git" || entry.startsWith(".")) continue;
              const full = join(base, entry);
              try {
                const st = statSync(full);
                if (!st.isDirectory()) continue;
                // Check if this directory has our manifest.json
                const mf = join(full, "manifest.json");
                if (existsSync(mf)) {
                  try {
                    const manifest = JSON.parse(readFileSync(mf, "utf8"));
                    if (manifest.id === "figma-intelligence-bridge" || manifest.name === "Figma Intelligence Bridge") {
                      // Found a plugin copy — update it
                      let updated = 0;
                      for (const pf of pluginFiles) {
                        const src = join(__dirname, "..", "plugin", pf);
                        const dest = join(full, pf);
                        if (existsSync(src)) {
                          copyFileSync(src, dest);
                          updated++;
                        }
                      }
                      if (updated > 0) {
                        console.log(`  ✅ Also updated plugin at: ${full}`);
                      }
                    }
                  } catch {}
                }
                findPlugins(full, depth + 1);
              } catch {}
            }
          } catch {}
        };
        findPlugins(dir, 0);
      } catch {}
    }
  } catch (err) {
    console.log(`  Warning: Could not install plugin (${err.message})`);
  }

  // 7b. Kill any stale relay processes before starting fresh
  try {
    const { execSync } = require("child_process");
    if (platform() !== "win32") {
      execSync("pkill -f 'bridge-relay' 2>/dev/null || true", { stdio: "ignore", timeout: 5000 });
      // Small delay to let ports free up
      await new Promise(r => setTimeout(r, 500));
    }
  } catch {}

  // 8. Save config
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`\n  Config saved to: ${CONFIG_PATH}`);

  // 9. Register MCP server in AI tool configs
  console.log("\n  Registering MCP server with AI tools…\n");
  registerMcpServer(config);

  // 10. Auto-start the relay
  console.log("\n  Starting relay…");
  try {
    const { startRelay } = require("./start-relay");
    await startRelay();
  } catch (err) {
    console.log(`  Could not auto-start relay: ${err.message}`);
    console.log("  You can start it manually: npx figma-intelligence@latest start\n");
  }

  console.log("\n  ✓ Setup complete!\n");
  console.log("  ┌──────────────────────────────────────────────────────────────┐");
  console.log("  │  Next: Import the plugin in Figma                           │");
  console.log("  │                                                             │");
  console.log("  │  1. Open Figma Desktop                                      │");
  console.log("  │  2. Plugins → Development → Import plugin from manifest     │");
  console.log("  │  3. Go to Documents → Figma Intelligence Plugin folder      │");
  console.log("  │  4. Select manifest.json                                    │");
  console.log("  │                                                             │");
  console.log("  │  If you already imported it, RE-IMPORT to get the update.   │");
  console.log("  └──────────────────────────────────────────────────────────────┘");
  console.log(`\n  Plugin folder: ${PLUGIN_DIR}\n`);

  // Auto-open the plugin folder so the user can easily find it
  try {
    const { exec } = require("child_process");
    if (platform() === "darwin") {
      exec(`open "${PLUGIN_DIR}"`);
    } else if (platform() === "win32") {
      exec(`explorer "${PLUGIN_DIR}"`);
    } else {
      exec(`xdg-open "${PLUGIN_DIR}" 2>/dev/null`);
    }
  } catch {}
}

function registerMcpServer(config) {
  // Embed session token directly in the URL as a query parameter.
  // This avoids relying on custom headers which may not be sent during
  // the MCP client's initial auth handshake, causing "SDK auth failed".
  const mcpUrl = `${config.cloudUrl}/mcp?token=${config.sessionToken}`;

  // ── Claude Desktop / Claude Code ──
  registerClaude(config, mcpUrl);

  // ── Cursor ──
  registerCursor(config, mcpUrl);

  // ── VS Code ──
  registerVSCode(config, mcpUrl);
}

function registerClaude(config, mcpUrl) {
  // Claude Code uses ~/.claude.json for MCP servers
  const claudeConfigPath = join(homedir(), ".claude.json");
  try {
    let claudeConfig = {};
    if (existsSync(claudeConfigPath)) {
      claudeConfig = JSON.parse(readFileSync(claudeConfigPath, "utf8"));
    }

    if (!claudeConfig.mcpServers) claudeConfig.mcpServers = {};

    // Remove old entries that may have used invalid schema (streamable-http, headers)
    delete claudeConfig.mcpServers["figma-intelligence"];
    delete claudeConfig.mcpServers["figma-intelligence-layer"];

    // Also clean up old entries from project-scoped configs
    if (claudeConfig.projects) {
      for (const [projectPath, projectConfig] of Object.entries(claudeConfig.projects)) {
        if (projectConfig && projectConfig.mcpServers) {
          let cleaned = false;
          if (projectConfig.mcpServers["figma-intelligence"]) {
            delete projectConfig.mcpServers["figma-intelligence"];
            cleaned = true;
          }
          if (projectConfig.mcpServers["figma-intelligence-layer"]) {
            delete projectConfig.mcpServers["figma-intelligence-layer"];
            cleaned = true;
          }
          if (cleaned) {
            console.log(`    Claude: cleaned old entry from project ${projectPath}`);
          }
        }
      }
    }

    // Use LOCAL MCP server bundle so tools connect to the local relay
    // (which has the Figma plugin connected). The cloud proxy can't reach
    // the local Figma plugin, causing "Figma is not connected" errors.
    const mcpServerBundle = join(homedir(), ".figma-intelligence", "mcp-server.bundle.js");
    claudeConfig.mcpServers["figma-intelligence"] = {
      command: "node",
      args: [mcpServerBundle],
      env: {
        FIGMA_BRIDGE_CLIENT_ONLY: "1",
      },
    };

    writeFileSync(claudeConfigPath, JSON.stringify(claudeConfig, null, 2));
    console.log("    Claude: registered (old entries cleaned up)");
  } catch (err) {
    console.log(`    Claude: skipped (${err.message})`);
  }

  // Also clean up ~/.claude/settings.json (user-scope MCP servers)
  const settingsPath = join(homedir(), ".claude", "settings.json");
  try {
    if (existsSync(settingsPath)) {
      const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
      if (settings.mcpServers) {
        let cleaned = false;
        if (settings.mcpServers["figma-intelligence"]) {
          delete settings.mcpServers["figma-intelligence"];
          cleaned = true;
        }
        if (settings.mcpServers["figma-intelligence-layer"]) {
          delete settings.mcpServers["figma-intelligence-layer"];
          cleaned = true;
        }
        if (cleaned) {
          writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
          console.log("    Claude: cleaned old entries from settings.json");
        }
      }
    }
  } catch {}
}

function registerCursor(config, mcpUrl) {
  const cursorConfigPath = join(homedir(), ".cursor", "mcp.json");
  try {
    let cursorConfig = {};
    if (existsSync(cursorConfigPath)) {
      cursorConfig = JSON.parse(readFileSync(cursorConfigPath, "utf8"));
    }

    if (!cursorConfig.mcpServers) cursorConfig.mcpServers = {};

    // Remove old entries
    delete cursorConfig.mcpServers["figma-intelligence"];
    delete cursorConfig.mcpServers["figma-intelligence-layer"];

    cursorConfig.mcpServers["figma-intelligence"] = {
      url: mcpUrl,
    };

    mkdirSync(join(homedir(), ".cursor"), { recursive: true });
    writeFileSync(cursorConfigPath, JSON.stringify(cursorConfig, null, 2));
    console.log("    Cursor: registered");
  } catch (err) {
    console.log(`    Cursor: skipped (${err.message})`);
  }
}

function registerVSCode(config, mcpUrl) {
  // VS Code MCP config location varies; use the common pattern
  const vscodeConfigDir = join(homedir(), ".vscode");
  const vscodeConfigPath = join(vscodeConfigDir, "mcp.json");
  try {
    let vscodeConfig = {};
    if (existsSync(vscodeConfigPath)) {
      vscodeConfig = JSON.parse(readFileSync(vscodeConfigPath, "utf8"));
    }

    if (!vscodeConfig.servers) vscodeConfig.servers = {};

    // Remove old entries
    delete vscodeConfig.servers["figma-intelligence"];
    delete vscodeConfig.servers["figma-intelligence-layer"];

    vscodeConfig.servers["figma-intelligence"] = {
      type: "http",
      url: mcpUrl,
    };

    mkdirSync(vscodeConfigDir, { recursive: true });
    writeFileSync(vscodeConfigPath, JSON.stringify(vscodeConfig, null, 2));
    console.log("    VS Code: registered");
  } catch (err) {
    console.log(`    VS Code: skipped (${err.message})`);
  }
}

module.exports = { runSetup };
