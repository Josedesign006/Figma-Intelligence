#!/usr/bin/env node
/**
 * cloud-server.ts — Cloud entry point for figma-intelligence-layer
 *
 * Runs on Railway (or any cloud host). Exposes:
 *   POST /mcp         — StreamableHTTP MCP endpoint (AI tools connect here)
 *   GET  /mcp         — SSE stream for server-initiated messages
 *   DELETE /mcp       — Session termination
 *   WSS  /tunnel      — Tunnel endpoint (user's local relay connects here)
 *   GET  /health      — Health check for Railway
 *
 * Architecture:
 *   Claude Desktop / Cursor / VS Code
 *     ↓  MCP protocol (StreamableHTTP over HTTPS)
 *   This cloud server
 *     ↓  WebSocket tunnel
 *   User's local relay (compiled binary)
 *     ↓  WebSocket (localhost:9001)
 *   Figma Desktop Bridge Plugin
 *     ↓  Plugin API
 *   Figma Electron App
 */

import { randomUUID } from "node:crypto";
import http from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer, WebSocket } from "ws";
import { createMcpServer } from "./index.js";
import {
  registerTunnel,
  runInSession,
  getActiveSessionCount,
  cleanupStaleSessions,
  hasActiveSession,
} from "./cloud/session-manager.js";
import {
  extractToken,
  checkRateLimit,
  isValidToken,
} from "./cloud/auth.js";

// ─── Config ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3000", 10);

// ─── Transport & Session Management ─────────────────────────────────────────

// Map of MCP session IDs → { transport, sessionToken }
const mcpSessions = new Map<string, {
  transport: StreamableHTTPServerTransport;
  server: Server;
  sessionToken: string;
}>();

// Map session tokens → MCP session IDs (reverse lookup)
const tokenToMcpSession = new Map<string, string>();

/**
 * Get or create an MCP server + transport for a session token.
 */
function getOrCreateMcpSession(sessionToken: string): {
  transport: StreamableHTTPServerTransport;
  server: Server;
} {
  const existingMcpId = tokenToMcpSession.get(sessionToken);
  if (existingMcpId) {
    const existing = mcpSessions.get(existingMcpId);
    if (existing) return existing;
  }

  // Create new transport + server for this session
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createMcpServer();
  server.connect(transport);

  const mcpSessionId = transport.sessionId!;
  const entry = { transport, server, sessionToken };

  mcpSessions.set(mcpSessionId, entry);
  tokenToMcpSession.set(sessionToken, mcpSessionId);

  // Clean up on close
  transport.onclose = () => {
    mcpSessions.delete(mcpSessionId);
    tokenToMcpSession.delete(sessionToken);
    process.stderr.write(`MCP session ${mcpSessionId.slice(0, 8)}… closed\n`);
  };

  process.stderr.write(
    `MCP session ${mcpSessionId.slice(0, 8)}… created for token ${sessionToken.slice(0, 8)}…\n`
  );

  return entry;
}

// ─── HTTP Server ────────────────────────────────────────────────────────────

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Session-Token, Mcp-Session-Id");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── Health check ────────────────────────────────────────────────────────
  if (pathname === "/health") {
    const status = {
      status: "ok",
      activeSessions: getActiveSessionCount(),
      mcpSessions: mcpSessions.size,
      uptime: Math.floor(process.uptime()),
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(status));
    return;
  }

  // ── MCP endpoint ────────────────────────────────────────────────────────
  if (pathname === "/mcp") {
    // Extract and validate session token
    const sessionToken = extractToken(req);
    if (!sessionToken) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing or invalid X-Session-Token header" }));
      return;
    }

    // Rate limiting
    const rateCheck = checkRateLimit(sessionToken);
    if (!rateCheck.allowed) {
      res.writeHead(429, {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((rateCheck.retryAfterMs || 60000) / 1000)),
      });
      res.end(JSON.stringify({ error: "Rate limit exceeded" }));
      return;
    }

    // Check if this is a request with an existing MCP session ID
    const mcpSessionId = req.headers["mcp-session-id"] as string | undefined;

    if (mcpSessionId) {
      // Existing session — route to the right transport
      const session = mcpSessions.get(mcpSessionId);
      if (!session) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "MCP session not found" }));
        return;
      }

      // Run the handler within the session context so getBridge() works
      await runInSession(session.sessionToken, () =>
        session.transport.handleRequest(req, res)
      );
      return;
    }

    // New session — create transport and handle the initialization request
    if (!hasActiveSession(sessionToken)) {
      // Warn but don't block — tunnel might connect shortly after
      process.stderr.write(
        `Warning: MCP init for token ${sessionToken.slice(0, 8)}… but no tunnel connected yet\n`
      );
    }

    const { transport, server } = getOrCreateMcpSession(sessionToken);
    await runInSession(sessionToken, () =>
      transport.handleRequest(req, res)
    );
    return;
  }

  // ── 404 ─────────────────────────────────────────────────────────────────
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// ─── WebSocket Tunnel Server ────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname !== "/tunnel") {
    socket.destroy();
    return;
  }

  const token = url.searchParams.get("token");
  if (!token || !isValidToken(token)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    process.stderr.write(`Tunnel connection from token ${token.slice(0, 8)}…\n`);
    registerTunnel(token, ws);

    // Heartbeat to keep connection alive through proxies/load balancers
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);

    ws.on("close", () => {
      clearInterval(pingInterval);
    });
  });
});

// ─── Periodic Cleanup ───────────────────────────────────────────────────────

setInterval(() => {
  const cleaned = cleanupStaleSessions(30 * 60 * 1000); // 30 min idle
  if (cleaned > 0) {
    process.stderr.write(`Cleaned up ${cleaned} stale session(s)\n`);
  }
}, 5 * 60 * 1000).unref();

// ─── Start ──────────────────────────────────────────────────────────────────

httpServer.listen(PORT, "0.0.0.0", () => {
  process.stderr.write(
    `figma-intelligence cloud server running on port ${PORT}\n` +
    `  MCP endpoint:  POST /mcp\n` +
    `  Tunnel:        WSS  /tunnel?token=<session-token>\n` +
    `  Health:        GET  /health\n`
  );
});
