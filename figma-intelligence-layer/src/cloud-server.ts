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
  waitForTunnel,
} from "./cloud/session-manager.js";
import {
  extractToken,
  checkRateLimit,
  isValidToken,
} from "./cloud/auth.js";

// ─── Config ─────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3000", 10);

// ─── Transport & Session Management ─────────────────────────────────────────

// Primary map: session token → { transport, server }
// We key by session token (always known) rather than MCP session ID
// (which is only assigned after the first handleRequest call).
const sessionsByToken = new Map<string, {
  transport: StreamableHTTPServerTransport;
  server: Server;
}>();

// Reverse map: MCP session ID → session token (populated lazily after first request)
const mcpIdToToken = new Map<string, string>();

/**
 * Get or create an MCP server + transport for a session token.
 */
function getOrCreateMcpSession(sessionToken: string): {
  transport: StreamableHTTPServerTransport;
  server: Server;
} {
  const existing = sessionsByToken.get(sessionToken);
  if (existing) return existing;

  // Create new transport + server for this session
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createMcpServer();
  server.connect(transport);

  const entry = { transport, server };
  sessionsByToken.set(sessionToken, entry);

  // Clean up on close
  transport.onclose = () => {
    const mcpId = transport.sessionId;
    if (mcpId) mcpIdToToken.delete(mcpId);
    sessionsByToken.delete(sessionToken);
    process.stderr.write(`MCP session for token ${sessionToken.slice(0, 8)}… closed\n`);
  };

  process.stderr.write(
    `MCP session created for token ${sessionToken.slice(0, 8)}…\n`
  );

  return entry;
}

/**
 * Look up a session by MCP session ID (for subsequent requests that include Mcp-Session-Id header).
 * Falls back to null if not found.
 */
function getSessionByMcpId(mcpSessionId: string): {
  transport: StreamableHTTPServerTransport;
  server: Server;
  sessionToken: string;
} | null {
  const token = mcpIdToToken.get(mcpSessionId);
  if (!token) return null;
  const entry = sessionsByToken.get(token);
  if (!entry) return null;
  return { ...entry, sessionToken: token };
}

/**
 * Register the MCP session ID → token mapping (called after first handleRequest).
 */
function registerMcpId(sessionToken: string) {
  const entry = sessionsByToken.get(sessionToken);
  if (entry?.transport.sessionId) {
    mcpIdToToken.set(entry.transport.sessionId, sessionToken);
  }
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
      mcpSessions: sessionsByToken.size,
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
      res.end(JSON.stringify({
        error: "Missing session token. Ensure your MCP URL includes ?token=<your-session-token>. Re-run: npx figma-intelligence setup",
      }));
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
      // Existing session — look up by MCP session ID
      const session = getSessionByMcpId(mcpSessionId);
      if (!session) {
        // Fall back to session token lookup (MCP ID might not be registered yet)
        const fallback = sessionsByToken.get(sessionToken);
        if (fallback) {
          await runInSession(sessionToken, () =>
            fallback.transport.handleRequest(req, res)
          );
          return;
        }
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "MCP session not found" }));
        return;
      }

      await runInSession(session.sessionToken, () =>
        session.transport.handleRequest(req, res)
      );
      return;
    }

    // New session — wait for tunnel if not connected yet, then handle request
    if (!hasActiveSession(sessionToken)) {
      process.stderr.write(
        `Waiting for tunnel connection for token ${sessionToken.slice(0, 8)}…\n`
      );
      try {
        await waitForTunnel(sessionToken, 15000);
        process.stderr.write(
          `Tunnel connected for token ${sessionToken.slice(0, 8)}…, proceeding\n`
        );
      } catch {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: "Local relay not connected. Make sure the relay is running: npx figma-intelligence start",
        }));
        return;
      }
    }

    // New client (no Mcp-Session-Id header) — tear down any stale session
    // so the fresh initialize handshake succeeds instead of hitting
    // "Server already initialized".
    const stale = sessionsByToken.get(sessionToken);
    if (stale) {
      const oldMcpId = stale.transport.sessionId;
      if (oldMcpId) mcpIdToToken.delete(oldMcpId);
      sessionsByToken.delete(sessionToken);
      try { await stale.server.close(); } catch { /* already closed */ }
      process.stderr.write(
        `Replaced stale MCP session for token ${sessionToken.slice(0, 8)}…\n`
      );
    }

    const { transport } = getOrCreateMcpSession(sessionToken);
    await runInSession(sessionToken, async () => {
      await transport.handleRequest(req, res);
      // Now that handleRequest has run, the transport has a session ID — register it
      registerMcpId(sessionToken);
    });
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

// ─── Global Error Handlers (prevent crashes) ───────────────────────────────

process.on("uncaughtException", (err) => {
  process.stderr.write(`Uncaught exception (server continues): ${err.message}\n${err.stack}\n`);
});

process.on("unhandledRejection", (reason) => {
  process.stderr.write(`Unhandled rejection (server continues): ${reason}\n`);
});

// ─── Start ──────────────────────────────────────────────────────────────────

httpServer.listen(PORT, "0.0.0.0", () => {
  process.stderr.write(
    `figma-intelligence cloud server running on port ${PORT}\n` +
    `  MCP endpoint:  POST /mcp\n` +
    `  Tunnel:        WSS  /tunnel?token=<session-token>\n` +
    `  Health:        GET  /health\n`
  );
});
