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
const { runClaude, resetSession, isClaudeAvailable, getClaudeAuthInfo, writeMcpConfig } = require("./chat-runner");
const { runCodex, isCodexAvailable, getCodexAuthInfo, resetCodexSession } = require("./codex-runner");
const { runGemini } = require("./gemini-runner");
const { runGeminiCli, isGeminiCliAvailable, getGeminiCliAuthInfo } = require("./gemini-cli-runner");
const { runPerplexity } = require("./perplexity-runner");
const { parsePdfBuffer, parseDocxBuffer, fetchUrlContent, createContentSource, buildGroundingContext, scanKnowledgeHub, loadHubFile, searchHub } = require("./content-context");

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

// ── Knowledge sources grounding context ─────────────────────────────────────
const activeContentSources = new Map(); // sourceId → { id, title, sources, meta, extractedAt }

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
    knowledgeSources: Array.from(activeContentSources.values()).map(s => ({
      id: s.id, title: s.title, sourceCount: s.sources.length, meta: s.meta || {}, extractedAt: s.extractedAt,
    })),
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

// Rewrite MCP config with the actual port (chat-runner wrote initial config with default port)
writeMcpConfig(PORT);

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

      // ── Knowledge source management ──────────────────────────────────
      if (msg.type === "add-content-file") {
        const fileName = msg.name || "file";
        const dataUrl = msg.data || "";
        console.log(`  📄 Adding file: ${fileName}`);

        (async () => {
          try {
            // Decode base64 DataURL to buffer
            const b64Match = dataUrl.match(/^data:[^;]*;base64,(.+)$/);
            if (!b64Match) throw new Error("Invalid file data");
            const buffer = Buffer.from(b64Match[1], "base64");

            const ext = (fileName.match(/\.(\w+)$/)?.[1] || "").toLowerCase();
            let title, text, meta = { fileName, fileType: ext };

            if (ext === "pdf") {
              const result = await parsePdfBuffer(buffer);
              title = result.title || fileName.replace(/\.\w+$/, "");
              text = result.text;
              meta.pages = result.pages;
            } else if (ext === "docx" || ext === "doc") {
              const result = await parseDocxBuffer(buffer);
              title = result.title || fileName.replace(/\.\w+$/, "");
              text = result.text;
            } else {
              // Plain text formats (txt, md, csv, json, etc.)
              title = fileName.replace(/\.\w+$/, "");
              text = buffer.toString("utf-8");
            }

            if (!text || text.trim().length === 0) {
              throw new Error("No text content could be extracted from this file");
            }

            const source = createContentSource(title, text, meta);
            activeContentSources.set(source.id, source);
            console.log(`  ✅ File added: "${title}" (${text.length} chars${meta.pages ? `, ${meta.pages} pages` : ""})`);
            sendToPlugin({
              type: "content-added",
              source: {
                id: source.id, title: source.title, sourceCount: source.sources.length,
                meta: source.meta, extractedAt: source.extractedAt,
                charCount: text.length,
                preview: text.slice(0, 500).replace(/\s+/g, " ").trim(),
              },
            });
            sendRelayStatus(pluginSocket, hasConnectedMcpSocket());
          } catch (err) {
            console.log(`  ⚠ File error: ${err.message}`);
            sendToPlugin({ type: "content-error", error: err.message, fileName });
          }
        })();
        return;
      }

      if (msg.type === "add-content-url") {
        const url = (msg.url || "").trim();
        console.log(`  🔗 Fetching URL: ${url.slice(0, 60)}…`);

        (async () => {
          try {
            if (!url || !/^https?:\/\//i.test(url)) throw new Error("Invalid URL");
            const result = await fetchUrlContent(url);
            if (!result.text || result.text.trim().length < 20) {
              throw new Error("Could not extract meaningful content from this URL");
            }
            const source = createContentSource(
              result.title || url,
              result.text,
              { url, fileType: "url" }
            );
            activeContentSources.set(source.id, source);
            console.log(`  ✅ URL added: "${source.title}" (${result.text.length} chars)`);
            sendToPlugin({
              type: "content-added",
              source: {
                id: source.id, title: source.title, sourceCount: source.sources.length,
                meta: source.meta, extractedAt: source.extractedAt,
                charCount: result.text.length,
                preview: result.text.slice(0, 500).replace(/\s+/g, " ").trim(),
              },
            });
            sendRelayStatus(pluginSocket, hasConnectedMcpSocket());
          } catch (err) {
            console.log(`  ⚠ URL error: ${err.message}`);
            sendToPlugin({ type: "content-error", error: err.message, url });
          }
        })();
        return;
      }

      if (msg.type === "add-content-text") {
        const title = msg.title || "Pasted Content";
        const content = msg.content || "";
        if (!content.trim()) {
          sendToPlugin({ type: "content-error", error: "No content provided" });
          return;
        }
        const source = createContentSource(title, content, { fileType: "text" });
        activeContentSources.set(source.id, source);
        console.log(`  ✅ Text pasted: "${title}" (${content.length} chars)`);
        sendToPlugin({
          type: "content-added",
          source: {
            id: source.id, title: source.title, sourceCount: source.sources.length,
            meta: source.meta, extractedAt: source.extractedAt,
            charCount: content.length,
            preview: content.slice(0, 500).replace(/\s+/g, " ").trim(),
          },
        });
        sendRelayStatus(pluginSocket, hasConnectedMcpSocket());
        return;
      }

      if (msg.type === "remove-content") {
        const id = msg.sourceId;
        if (activeContentSources.has(id)) {
          const title = activeContentSources.get(id).title;
          activeContentSources.delete(id);
          console.log(`  📄 Source removed: "${title}"`);
          sendToPlugin({ type: "content-removed", sourceId: id });
          sendRelayStatus(pluginSocket, hasConnectedMcpSocket());
        }
        return;
      }

      if (msg.type === "list-content") {
        sendToPlugin({
          type: "content-list",
          sources: Array.from(activeContentSources.values()).map(s => ({
            id: s.id, title: s.title, sourceCount: s.sources.length, meta: s.meta || {}, extractedAt: s.extractedAt,
          })),
        });
        return;
      }

      // ── Knowledge Hub ────────────────────────────────────────────────
      if (msg.type === "hub-scan") {
        const catalog = scanKnowledgeHub();
        console.log(`  📚 Knowledge Hub: ${catalog.length} file(s) found`);
        sendToPlugin({ type: "hub-catalog", files: catalog });
        return;
      }

      if (msg.type === "hub-load") {
        const fileName = msg.fileName;
        console.log(`  📚 Loading hub file: ${fileName}`);
        (async () => {
          try {
            const source = await loadHubFile(fileName);
            activeContentSources.set(source.id, source);
            const text = source.sources[0]?.content || "";
            console.log(`  ✅ Hub file loaded: "${source.title}" (${text.length} chars)`);
            sendToPlugin({
              type: "content-added",
              source: {
                id: source.id, title: source.title, sourceCount: source.sources.length,
                meta: source.meta, extractedAt: source.extractedAt,
                charCount: text.length,
                preview: text.slice(0, 500).replace(/\s+/g, " ").trim(),
              },
            });
            sendRelayStatus(pluginSocket, hasConnectedMcpSocket());
          } catch (err) {
            console.log(`  ⚠ Hub error: ${err.message}`);
            sendToPlugin({ type: "content-error", error: err.message, fileName });
          }
        })();
        return;
      }

      if (msg.type === "hub-search") {
        const results = searchHub(msg.query || "");
        sendToPlugin({ type: "hub-search-results", files: results, query: msg.query });
        return;
      }

      // Chat message → route to the configured AI runner
      if (msg.type === "chat") {
        const requestId = msg.id;
        const prov = providerConfig.provider || "claude";
        const chatMode = msg.mode || "code";
        let chatMessage = msg.message || "";

        // /knowledge command — intercept and handle via knowledge hub
        if (/^\s*\/knowledge\b/i.test(chatMessage)) {
          const query = chatMessage.replace(/^\s*\/knowledge\s*/i, "").trim();
          const catalog = scanKnowledgeHub();
          console.log(`  📚 /knowledge command: ${catalog.length} files in hub${query ? `, searching: "${query}"` : ""}`);

          if (query) {
            // Auto-search and load matching hub files
            const matches = searchHub(query);
            if (matches.length > 0) {
              (async () => {
                try {
                  const source = await loadHubFile(matches[0].fileName);
                  activeContentSources.set(source.id, source);
                  const text = source.sources[0]?.content || "";
                  sendToPlugin({
                    type: "content-added",
                    source: {
                      id: source.id, title: source.title, sourceCount: source.sources.length,
                      meta: source.meta, extractedAt: source.extractedAt,
                      charCount: text.length,
                      preview: text.slice(0, 500).replace(/\s+/g, " ").trim(),
                    },
                  });
                  // Send a visible chat response
                  const otherNames = matches.slice(1, 4).map(m => `"${m.title}"`).join(", ");
                  let responseText = `📚 **Loaded "${source.title}"** from Knowledge Hub (${text.length.toLocaleString()} chars).\n\nYou can now ask me questions about this source — I'll ground my answers in its content.`;
                  if (matches.length > 1) responseText += `\n\n_${matches.length - 1} other match(es): ${otherNames}_`;
                  sendToPlugin({ type: "text_delta", id: requestId, delta: responseText });
                  sendToPlugin({ type: "done", id: requestId, fullText: responseText });
                  sendRelayStatus(pluginSocket, hasConnectedMcpSocket());
                } catch (err) {
                  sendToPlugin({ type: "text_delta", id: requestId, delta: `⚠️ Could not load: ${err.message}` });
                  sendToPlugin({ type: "done", id: requestId, fullText: err.message });
                }
              })();
            } else {
              // No matches — show what's available
              const fileList = catalog.map(f => `• ${f.title} (${f.fileType.toUpperCase()})`).join("\n");
              const responseText = `📚 No files matching "${query}" found in the Knowledge Hub.\n\n**Available files (${catalog.length}):**\n${fileList || "(empty)"}\n\n_Try: \`/knowledge <keyword>\` to search, or click the 📖 icon to browse._`;
              sendToPlugin({ type: "text_delta", id: requestId, delta: responseText });
              sendToPlugin({ type: "done", id: requestId, fullText: responseText });
              sendToPlugin({ type: "hub-catalog", files: catalog, query });
            }
          } else {
            // Just "/knowledge" — show catalog as chat response + open panel
            const fileList = catalog.map(f => `• **${f.title}** (${f.fileType.toUpperCase()}, ${(f.sizeBytes / 1024).toFixed(0)} KB)`).join("\n");
            const activeList = Array.from(activeContentSources.values()).map(s => `• ✅ ${s.title}`).join("\n");
            let responseText = `📚 **Knowledge Hub** — ${catalog.length} file(s) available\n\n`;
            if (catalog.length > 0) {
              responseText += `**Library:**\n${fileList}\n\n`;
              responseText += `_Use \`/knowledge <keyword>\` to load a specific file, or click the 📖 icon to browse and activate._`;
            } else {
              responseText += `No files yet. Add PDFs, DOCX, or TXT files to:\n\`figma-bridge-plugin/knowledge-hub/\``;
            }
            if (activeList) responseText += `\n\n**Currently active sources:**\n${activeList}`;
            sendToPlugin({ type: "text_delta", id: requestId, delta: responseText });
            sendToPlugin({ type: "done", id: requestId, fullText: responseText });
            sendToPlugin({ type: "hub-catalog", files: catalog });
          }
          return;
        }

        // Inject knowledge source grounding context if sources are active
        if (activeContentSources.size > 0) {
          const groundingCtx = buildGroundingContext(activeContentSources);
          if (groundingCtx) {
            chatMessage = groundingCtx + "\n---\n\nUser question: " + chatMessage;
            console.log(`  📄 Injected ${activeContentSources.size} knowledge source(s) as grounding context`);
          }
        }

        console.log(`  💬 chat [${prov}/${chatMode}] (id: ${requestId}): ${(chatMessage).slice(0, 60)}…`);

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
            message: chatMessage,
            attachments: msg.attachments,
            conversation: msg.conversation,
            requestId,
            model: msg.model,
            designSystemId: activeDesignSystemId,
            mode: chatMode,
            onEvent,
          });
        } else if (prov === "gemini") {
          if (geminiCliAuthInfo.loggedIn) {
            // Subscription mode — use Gemini CLI (Google One AI Premium / Gemini Advanced)
            proc = runGeminiCli({
              message: chatMessage,
              attachments: msg.attachments,
              conversation: msg.conversation,
              requestId,
              model: msg.model,
              designSystemId: activeDesignSystemId,
              mode: chatMode,
              onEvent,
            });
          } else {
            // API key mode — fallback for users without subscription CLI auth
            proc = runGemini({
              message: chatMessage,
              attachments: msg.attachments,
              conversation: msg.conversation,
              requestId,
              apiKey: providerConfig.apiKey,
              model: msg.model,
              designSystemId: activeDesignSystemId,
              mode: chatMode,
              onEvent,
            });
          }
        } else if (prov === "perplexity") {
          proc = runPerplexity({
            message: chatMessage,
            attachments: msg.attachments,
            conversation: msg.conversation,
            requestId,
            apiKey: providerConfig.apiKey,
            model: msg.model,
            mode: "chat",
            onEvent,
          });
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
            message: chatMessage,
            attachments: msg.attachments,
            conversation: msg.conversation,
            requestId,
            model: msg.model,
            designSystemId: activeDesignSystemId,
            mode: chatMode,
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
        const resetMode = msg.mode || null; // null = reset all modes
        resetSession(resetMode);
        resetCodexSession(resetMode);
        console.log(`  🔄 conversation session reset${resetMode ? ` (${resetMode})` : " (all)"}`);
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
