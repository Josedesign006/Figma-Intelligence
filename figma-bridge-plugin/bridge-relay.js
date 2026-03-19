#!/usr/bin/env node
/**
 * figma-bridge-relay — Local WebSocket relay server
 *
 * Architecture:
 *   MCP Server (figma-bridge.ts) → connects to ws://localhost:PORT as a client
 *   Figma Plugin UI (ui.html)    → connects to ws://localhost:PORT/plugin as a client
 *   Chat (plugin UI)             → sends { type:"chat" } → relay spawns claude subprocess
 *
 * Usage:
 *   node bridge-relay.js              # default port 9001
 *   node bridge-relay.js 9002         # custom port
 *   BRIDGE_PORT=9001 node bridge-relay.js
 */

const { WebSocketServer } = require("ws");
const { spawn } = require("child_process");
const { readFileSync, writeFileSync, existsSync } = require("fs");
const { homedir } = require("os");
const { join, resolve } = require("path");
const { runClaude, isClaudeAvailable, getClaudeAuthInfo } = require("./chat-runner");
const { runCodex, isCodexAvailable, getCodexAuthInfo } = require("./codex-runner");
const { runGemini } = require("./gemini-runner");
const { runGeminiCli, isGeminiCliAvailable, getGeminiCliAuthInfo } = require("./gemini-cli-runner");

const PORT = parseInt(process.argv[2] || process.env.BRIDGE_PORT || "9001", 10);
const MCP_SERVER_PATH = resolve(__dirname, "../figma-intelligence-layer/dist/index.js");
const DEFAULT_CODEX_APP_BIN = "/Applications/Codex.app/Contents/Resources/codex";

if (!process.env.CODEX_BIN_PATH && existsSync(DEFAULT_CODEX_APP_BIN)) {
  process.env.CODEX_BIN_PATH = DEFAULT_CODEX_APP_BIN;
}

function readFigmaToken() {
  try {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    if (existsSync(settingsPath)) {
      const s = JSON.parse(readFileSync(settingsPath, "utf8"));
      return s?.mcpServers?.["figma-intelligence-layer"]?.env?.FIGMA_ACCESS_TOKEN || "";
    }
  } catch {}
  return "";
}

let _mcpProc = null;
function startPersistentMcpServer() {
  if (!existsSync(MCP_SERVER_PATH)) {
    console.log("⚠  MCP server not built — run setup.sh");
    return;
  }
  _mcpProc = spawn("node", [MCP_SERVER_PATH], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      FIGMA_ACCESS_TOKEN: readFigmaToken(),
      FIGMA_BRIDGE_PORT: String(PORT),
      ENABLE_DECISION_LOG: "true",
    },
  });
  _mcpProc.stderr.on("data", (d) => {
    const t = d.toString().trim();
    if (t) console.log("[mcp]", t);
  });
  _mcpProc.on("close", (code) => {
    _mcpProc = null;
    if (code !== 0 && code !== null) {
      console.log("⚠  MCP server exited — restarting in 3s…");
      setTimeout(startPersistentMcpServer, 3000);
    }
  });
  _mcpProc.on("error", () => {
    _mcpProc = null;
    setTimeout(startPersistentMcpServer, 3000);
  });
}

let pluginSocket = null;
const mcpSockets = new Set();
const pendingRequests = new Map();
const activeChatProcesses = new Map();   // requestId → ChildProcess | EventEmitter

// Auth info populated on startup and sent to plugin on connect
let authInfo = { loggedIn: false, email: null };
let openaiAuthInfo = { loggedIn: false, email: null };
let geminiCliAuthInfo = { loggedIn: false, email: null };

// ── Provider config (persisted to ~/.claude/settings.json) ───────────────────
let providerConfig = { provider: "claude", apiKey: null };

function loadProviderConfig() {
  try {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    if (existsSync(settingsPath)) {
      const s = JSON.parse(readFileSync(settingsPath, "utf8"));
      const saved = s?.figmaIntelligenceProvider;
      if (saved?.provider) {
        providerConfig = { provider: saved.provider, apiKey: saved.apiKey || null };
        console.log(`  Provider loaded: ${providerConfig.provider}`);
      }
    }
  } catch {}
}

function saveProviderConfig() {
  try {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    let settings = {};
    if (existsSync(settingsPath)) {
      try { settings = JSON.parse(readFileSync(settingsPath, "utf8")); } catch {}
    }
    settings.figmaIntelligenceProvider = {
      provider: providerConfig.provider,
      apiKey: providerConfig.apiKey || null,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error("  ⚠ Could not save provider config:", err.message);
  }
}

loadProviderConfig();

async function refreshAuthState({ log = false } = {}) {
  const claudeAvailable = await isClaudeAvailable();
  if (claudeAvailable) {
    authInfo = await getClaudeAuthInfo();
    if (log) {
      if (authInfo.loggedIn) {
        console.log(`✅ Claude: logged in${authInfo.email ? " as " + authInfo.email : ""}`);
      } else {
        console.log("⚠  Claude: not logged in — run 'claude login'");
      }
    }
  } else {
    authInfo = { loggedIn: false, email: null };
    if (log) console.log("⚠  Claude CLI not found — Claude chat unavailable");
  }

  const codexAvailable = await isCodexAvailable();
  if (codexAvailable) {
    openaiAuthInfo = await getCodexAuthInfo();
    if (log) {
      if (openaiAuthInfo.loggedIn) {
        console.log(`✅ OpenAI Codex: logged in${openaiAuthInfo.email ? " as " + openaiAuthInfo.email : ""}`);
      } else {
        console.log("⚠  OpenAI Codex: not logged in — run 'codex login'");
      }
    }
  } else {
    openaiAuthInfo = { loggedIn: false, email: null };
    if (log) console.log("⚠  OpenAI Codex CLI not found — run: npm install -g @openai/codex");
  }

  const geminiCliAvailable = await isGeminiCliAvailable();
  if (geminiCliAvailable) {
    geminiCliAuthInfo = await getGeminiCliAuthInfo();
    if (log) {
      if (geminiCliAuthInfo.loggedIn) {
        console.log(`✅ Gemini CLI: logged in${geminiCliAuthInfo.email ? " as " + geminiCliAuthInfo.email : ""}`);
      } else {
        console.log("⚠  Gemini CLI: not logged in — run 'gemini auth login'");
      }
    }
  } else {
    geminiCliAuthInfo = { loggedIn: false, email: null };
    if (log) console.log("ℹ  Gemini CLI not found — Gemini will use API key mode (install: npm install -g @google/gemini-cli)");
  }

  sendRelayStatus(pluginSocket, hasConnectedMcpSocket());
}

// ── Auth check on startup ───────────────────────────────────────────────────
(async () => {
  await refreshAuthState({ log: true });
})();

// ── Helpers ─────────────────────────────────────────────────────────────────
function sendRelayStatus(ws, mcpConnected) {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({
    type: "bridge-status",
    mcpConnected,
    claudeLoggedIn: authInfo.loggedIn,
    claudeEmail: authInfo.email,
    openaiLoggedIn: openaiAuthInfo.loggedIn,
    openaiEmail: openaiAuthInfo.email,
    provider: providerConfig.provider,
    hasApiKey: !!(providerConfig.apiKey),
    geminiLoggedIn: geminiCliAuthInfo.loggedIn,
    geminiEmail: geminiCliAuthInfo.email,
  }));
}

function hasConnectedMcpSocket() {
  for (const socket of mcpSockets) {
    if (socket.readyState === 1) return true;
  }
  return false;
}

function broadcastToMcpSockets(raw) {
  for (const socket of mcpSockets) {
    if (socket.readyState === 1) {
      socket.send(raw);
    }
  }
}

function sendToPlugin(payload) {
  if (pluginSocket && pluginSocket.readyState === 1) {
    pluginSocket.send(JSON.stringify(payload));
  }
}

// ── WebSocket Server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: PORT });

console.log(`\n🔌 Figma Intelligence Bridge Relay`);
console.log(`   Listening on ws://localhost:${PORT}`);
console.log(`   MCP server   → connects to ws://localhost:${PORT}`);
console.log(`   Figma plugin → connects to ws://localhost:${PORT}/plugin`);
console.log(`   Waiting for connections…\n`);

// Start the MCP server as a persistent child process so the plugin
// always shows "Connected" — not just during active chat requests.
wss.on("listening", () => startPersistentMcpServer());

wss.on("connection", (ws, req) => {
  const path = req.url || "/";
  const isPlugin = path.includes("/plugin");

  if (isPlugin) {
    pluginSocket = ws;
    console.log("✅ Figma plugin connected");
    sendRelayStatus(ws, hasConnectedMcpSocket());
    refreshAuthState().catch(() => {});
  } else {
    mcpSockets.add(ws);
    console.log("✅ MCP server connected");
    sendRelayStatus(pluginSocket, true);
  }

  ws.on("message", (data) => {
    const raw = data.toString();
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ── Messages from the Figma plugin ──────────────────────────────────────
    if (isPlugin) {

      // Set AI provider / API key
      if (msg.type === "set-provider") {
        providerConfig = {
          provider: msg.provider || "claude",
          apiKey: msg.apiKey || null,
        };
        saveProviderConfig();
        console.log(`  🔑 provider set: ${providerConfig.provider}`);
        sendToPlugin({ type: "provider-stored", provider: providerConfig.provider });
        refreshAuthState().catch(() => {});
        return;
      }

      // Chat message → route to the configured AI runner
      if (msg.type === "chat") {
        const requestId = msg.id;
        const prov = providerConfig.provider || "claude";
        console.log(`  💬 chat [${prov}] (id: ${requestId}): ${(msg.message || "").slice(0, 60)}…`);

        const onEvent = (event) => {
          sendToPlugin(event);
          if (event.type === "tool_start") {
            console.log(`  🔧 tool: ${event.tool}`);
          }
        };

        let proc;
        if (prov === "openai") {
          // Use Codex CLI (subscription-based) — no API key needed
          proc = runCodex({
            message: msg.message,
            attachments: msg.attachments,
            conversation: msg.conversation,
            requestId,
            model: msg.model,
            onEvent,
          });
        } else if (prov === "gemini") {
          if (geminiCliAuthInfo.loggedIn) {
            // Subscription mode — use Gemini CLI (Google One AI Premium / Gemini Advanced)
            proc = runGeminiCli({
              message: msg.message,
              attachments: msg.attachments,
              conversation: msg.conversation,
              requestId,
              model: msg.model,
              onEvent,
            });
          } else {
            // API key mode — fallback for users without subscription CLI auth
            proc = runGemini({
              message: msg.message,
              attachments: msg.attachments,
              conversation: msg.conversation,
              requestId,
              apiKey: providerConfig.apiKey,
              model: msg.model,
              onEvent,
            });
          }
        } else if (prov === "bridge") {
          // Bridge-only mode: no built-in AI — tell the plugin immediately
          sendToPlugin({
            type: "error",
            id: requestId,
            error: "Bridge mode is active. Chat is handled by your external AI tool (VS Code, Cursor, etc.) via MCP — not by the plugin itself.",
          });
          sendToPlugin({ type: "done", id: requestId, fullText: "" });
          return;
        } else {
          // Default: Claude
          proc = runClaude({
            message: msg.message,
            attachments: msg.attachments,
            conversation: msg.conversation,
            requestId,
            onEvent,
          });
        }

        activeChatProcesses.set(requestId, proc);
        proc.on("close", () => activeChatProcesses.delete(requestId));
        return;
      }

      // Abort a running chat
      if (msg.type === "abort-chat") {
        const proc = activeChatProcesses.get(msg.id);
        if (proc) {
          proc.kill("SIGTERM");
          activeChatProcesses.delete(msg.id);
          console.log(`  ⛔ chat aborted (id: ${msg.id})`);
        }
        return;
      }

      // Bridge events (selection change, doc change etc.) → forward to MCP
      if (msg.type === "bridge-event") {
        broadcastToMcpSockets(raw);
        console.log(`  ↺ plugin event: ${msg.eventType || "unknown"}`);
        return;
      }

      // Plugin hello
      if (msg.type === "plugin-hello") {
        console.log(`  Plugin identified: ${msg.fileName || "unknown"}`);
        return;
      }

      // MCP tool response from plugin → route back to the requesting MCP socket
      if (msg.id && !msg.method) {
        const targetSocket = pendingRequests.get(msg.id);
        if (targetSocket && targetSocket.readyState === 1) {
          targetSocket.send(raw);
          console.log(`  ← plugin response (id: ${msg.id})`);
        } else {
          broadcastToMcpSockets(raw);
        }
        pendingRequests.delete(msg.id);
      }
      return;
    }

    // ── Messages from an MCP server ─────────────────────────────────────────
    if (msg.id && msg.method) {
      if (pluginSocket && pluginSocket.readyState === 1) {
        pendingRequests.set(msg.id, ws);
        pluginSocket.send(JSON.stringify({
          type: "bridge-request",
          id: msg.id,
          method: msg.method,
          params: msg.params || {},
        }));
        console.log(`  → mcp request: ${msg.method} (id: ${msg.id})`);
      } else {
        ws.send(JSON.stringify({
          id: msg.id,
          error: "Figma plugin is not connected. Open Figma and run the Intelligence Bridge plugin.",
        }));
        console.log(`  ✗ No plugin connected for: ${msg.method}`);
      }
    }
  });

  ws.on("close", () => {
    if (isPlugin) {
      pluginSocket = null;
      console.log("⚠  Figma plugin disconnected");
    } else {
      mcpSockets.delete(ws);
      for (const [requestId, requestSocket] of pendingRequests.entries()) {
        if (requestSocket === ws) pendingRequests.delete(requestId);
      }
      console.log("⚠  MCP server disconnected");
      sendRelayStatus(pluginSocket, hasConnectedMcpSocket());
    }
  });

  ws.on("error", (err) => {
    console.error(`WebSocket error (${isPlugin ? "plugin" : "mcp"}):`, err.message);
  });
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
process.on("SIGINT", () => {
  console.log("\nShutting down relay…");
  for (const proc of activeChatProcesses.values()) proc.kill();
  if (_mcpProc) _mcpProc.kill();
  wss.close();
  process.exit(0);
});
