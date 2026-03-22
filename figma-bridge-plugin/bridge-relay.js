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
const { runClaude, resetSession, isClaudeAvailable, getClaudeAuthInfo } = require("./chat-runner");
const { runCodex, isCodexAvailable, getCodexAuthInfo, resetCodexSession } = require("./codex-runner");
const { runGemini } = require("./gemini-runner");
const { runGeminiCli, isGeminiCliAvailable, getGeminiCliAuthInfo } = require("./gemini-cli-runner");

// P3: Port fallback — try PORT, then PORT+1 through PORT+9
const BASE_PORT = parseInt(process.argv[2] || process.env.BRIDGE_PORT || "9001", 10);
let PORT = BASE_PORT;
const MCP_SERVER_PATH = resolve(__dirname, "../figma-intelligence-layer/dist/index.js");
const DEFAULT_CODEX_APP_BIN = "/Applications/Codex.app/Contents/Resources/codex";

if (!process.env.CODEX_BIN_PATH && existsSync(DEFAULT_CODEX_APP_BIN)) {
  process.env.CODEX_BIN_PATH = DEFAULT_CODEX_APP_BIN;
}

function readMcpEnv() {
  try {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    if (existsSync(settingsPath)) {
      const s = JSON.parse(readFileSync(settingsPath, "utf8"));
      const figmaEnv = s?.mcpServers?.["figma-intelligence-layer"]?.env || {};
      const bridgeEnv = s?.mcpServers?.["design-bridge"]?.env || {};
      return {
        // Merge figma-intelligence-layer env (has UNSPLASH, GEMINI, ANTHROPIC keys etc.)
        ...figmaEnv,
        // Pull Stitch/Unsplash/Pexels from design-bridge as a fallback
        ...(bridgeEnv.UNSPLASH_ACCESS_KEY && !figmaEnv.UNSPLASH_ACCESS_KEY
          ? { UNSPLASH_ACCESS_KEY: bridgeEnv.UNSPLASH_ACCESS_KEY } : {}),
        ...(bridgeEnv.PEXELS_API_KEY && !figmaEnv.PEXELS_API_KEY
          ? { PEXELS_API_KEY: bridgeEnv.PEXELS_API_KEY } : {}),
        ...(bridgeEnv.STITCH_API_KEY && !figmaEnv.STITCH_API_KEY
          ? { STITCH_API_KEY: bridgeEnv.STITCH_API_KEY } : {}),
        ...(bridgeEnv.GOOGLE_CLOUD_PROJECT && !figmaEnv.GOOGLE_CLOUD_PROJECT
          ? { GOOGLE_CLOUD_PROJECT: bridgeEnv.GOOGLE_CLOUD_PROJECT } : {}),
      };
    }
  } catch {}
  return {};
}

let _mcpProc = null;
function startPersistentMcpServer() {
  if (!existsSync(MCP_SERVER_PATH)) {
    console.log("⚠  MCP server not built — run setup.sh");
    return;
  }
  const savedEnv = readMcpEnv();
  _mcpProc = spawn("node", [MCP_SERVER_PATH], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...savedEnv,
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

// TTL cache for auth refresh — avoid spawning auth subprocesses on every plugin connect
const AUTH_REFRESH_TTL_MS = 5 * 60 * 1000; // 5 minutes
let _lastAuthRefresh = 0;
let _authRefreshInFlight = null;

// ── Active design system ─────────────────────────────────────────────────────
let activeDesignSystemId = null;

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

async function refreshAuthState({ log = false, force = false } = {}) {
  // Return cached auth if within TTL (unless forced or startup log)
  const now = Date.now();
  if (!force && !log && (now - _lastAuthRefresh) < AUTH_REFRESH_TTL_MS) {
    sendRelayStatus(pluginSocket, hasConnectedMcpSocket());
    return;
  }
  // Deduplicate concurrent refresh calls
  if (_authRefreshInFlight) {
    await _authRefreshInFlight;
    sendRelayStatus(pluginSocket, hasConnectedMcpSocket());
    return;
  }
  _authRefreshInFlight = _doRefreshAuthState({ log });
  try {
    await _authRefreshInFlight;
    _lastAuthRefresh = Date.now();
  } finally {
    _authRefreshInFlight = null;
  }
}

async function _doRefreshAuthState({ log = false } = {}) {
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
  await refreshAuthState({ log: true, force: true });
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
    activeDesignSystemId,
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

// ── P3: Grace period — retain plugin state briefly on disconnect ──────────────
const PLUGIN_GRACE_PERIOD_MS = 5000;
let pluginGraceTimer = null;
let pluginGraceState = null; // stashed state during grace period

// ── P3: Heartbeat — detect dead connections ──────────────────────────────────
const HEARTBEAT_INTERVAL_MS = 30000;

function setupHeartbeat(wss) {
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws._isAlive === false) {
        console.log("  ⚠ Terminating unresponsive connection");
        return ws.terminate();
      }
      ws._isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);
  wss.on("close", () => clearInterval(interval));
}

// ── P3: Port fallback — try ports 9001-9010 ──────────────────────────────────
function createServerWithFallback(basePort, maxRetries = 9) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    function tryPort(port) {
      const server = new WebSocketServer({ port });
      server.on("listening", () => {
        PORT = port;
        resolve(server);
      });
      server.on("error", (err) => {
        if (err.code === "EADDRINUSE" && attempt < maxRetries) {
          attempt++;
          console.log(`  ⚠ Port ${port} in use, trying ${port + 1}…`);
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
    }
    tryPort(basePort);
  });
}

// ── WebSocket Server ─────────────────────────────────────────────────────────
(async () => {
  let wss;
  try {
    wss = await createServerWithFallback(BASE_PORT);
  } catch (err) {
    console.error(`Fatal: could not bind to any port in range ${BASE_PORT}-${BASE_PORT + 9}:`, err.message);
    process.exit(1);
  }

console.log(`\n🔌 Figma Intelligence Bridge Relay`);
console.log(`   Listening on ws://localhost:${PORT}`);
console.log(`   MCP server   → connects to ws://localhost:${PORT}`);
console.log(`   Figma plugin → connects to ws://localhost:${PORT}/plugin`);
console.log(`   Waiting for connections…\n`);

// Start heartbeat monitoring
setupHeartbeat(wss);

// Start the MCP server as a persistent child process so the plugin
// always shows "Connected" — not just during active chat requests.
startPersistentMcpServer();

wss.on("connection", (ws, req) => {
  const path = req.url || "/";
  const isPlugin = path.includes("/plugin");

  // P3: Heartbeat — mark connection alive on pong
  ws._isAlive = true;
  ws.on("pong", () => { ws._isAlive = true; });

  if (isPlugin) {
    // P3: Cancel grace timer if plugin reconnects within grace period
    if (pluginGraceTimer) {
      clearTimeout(pluginGraceTimer);
      pluginGraceTimer = null;
      pluginGraceState = null;
      console.log("  ↺ Plugin reconnected within grace period");
    }
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

      // Set active design system
      if (msg.type === "set-design-system") {
        const newId = msg.designSystemId || null;
        if (newId !== activeDesignSystemId) {
          activeDesignSystemId = newId;
          resetSession();
          resetCodexSession();
          console.log(`  🎨 design system: ${newId || "none"} (sessions reset)`);
        }
        sendToPlugin({ type: "design-system-stored", designSystemId: activeDesignSystemId });
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
            console.log(`  🔧 tool_start: ${event.tool}`);
          } else if (event.type === "tool_done") {
            console.log(`  ✅ tool_done:  ${event.tool}${event.isError ? " [ERROR]" : ""}`);
          } else if (event.type === "phase_start") {
            console.log(`  📋 phase: ${event.phase}`);
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
            designSystemId: activeDesignSystemId,
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
              designSystemId: activeDesignSystemId,
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
              designSystemId: activeDesignSystemId,
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
            model: msg.model,
            designSystemId: activeDesignSystemId,
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

      // Reset conversation session (user clicked "New Chat" in plugin UI)
      if (msg.type === "new-conversation" || msg.type === "clear-history") {
        resetSession();
        resetCodexSession();
        console.log(`  🔄 conversation session reset`);
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
      // P3: Grace period — wait before fully disconnecting plugin
      console.log(`⚠  Figma plugin disconnected — ${PLUGIN_GRACE_PERIOD_MS / 1000}s grace period`);
      pluginGraceState = { activeDesignSystemId };
      pluginGraceTimer = setTimeout(() => {
        pluginSocket = null;
        pluginGraceTimer = null;
        pluginGraceState = null;
        console.log("⚠  Plugin grace period expired — fully disconnected");
        sendRelayStatus(null, hasConnectedMcpSocket());
      }, PLUGIN_GRACE_PERIOD_MS);
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
  if (pluginGraceTimer) clearTimeout(pluginGraceTimer);
  wss.close();
  process.exit(0);
});

})(); // end async IIFE for port fallback
