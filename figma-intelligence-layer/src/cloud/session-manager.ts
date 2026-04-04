/**
 * Session Manager — maps session tokens to tunnel WebSockets and FigmaBridge instances.
 *
 * Each user install generates a unique session token (UUID).
 * When the user's local relay connects to the cloud tunnel, we map:
 *   sessionToken → tunnelWebSocket → FigmaBridge
 *
 * Uses AsyncLocalStorage so tool handlers can call getBridge() without
 * knowing which session they belong to — the context is threaded automatically.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import WebSocket from "ws";
import { FigmaBridge } from "../shared/figma-bridge.js";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Session {
  token: string;
  tunnelSocket: WebSocket;
  bridge: FigmaBridge;
  connectedAt: number;
  lastActivity: number;
}

// ─── AsyncLocalStorage for session context ──────────────────────────────────

const sessionStorage = new AsyncLocalStorage<string>();

/**
 * Run a function within a session context.
 * Tool handlers inside will get the correct FigmaBridge via getBridge().
 */
export function runInSession<T>(token: string, fn: () => T | Promise<T>): T | Promise<T> {
  return sessionStorage.run(token, fn);
}

/**
 * Get the current session token from the async context.
 * Returns undefined when running in local (non-cloud) mode.
 */
export function getCurrentSessionToken(): string | undefined {
  return sessionStorage.getStore();
}

// ─── Session registry ───────────────────────────────────────────────────────

const sessions = new Map<string, Session>();

/**
 * Register a tunnel WebSocket for a session token.
 * Creates a FigmaBridge instance that routes through this tunnel.
 */
export function registerTunnel(token: string, tunnelSocket: WebSocket): void {
  // Clean up existing session if reconnecting
  const existing = sessions.get(token);
  if (existing) {
    existing.bridge.disconnect().catch(() => {});
    if (existing.tunnelSocket.readyState === WebSocket.OPEN) {
      existing.tunnelSocket.close(1000, "Replaced by new connection");
    }
  }

  const bridge = new FigmaBridge();
  bridge.attachTunnel(tunnelSocket);

  const session: Session = {
    token,
    tunnelSocket,
    bridge,
    connectedAt: Date.now(),
    lastActivity: Date.now(),
  };

  sessions.set(token, session);

  tunnelSocket.on("close", () => {
    const current = sessions.get(token);
    if (current && current.tunnelSocket === tunnelSocket) {
      current.bridge.disconnect().catch(() => {});
      sessions.delete(token);
      process.stderr.write(`Session ${token.slice(0, 8)}… tunnel disconnected\n`);
    }
  });

  process.stderr.write(`Session ${token.slice(0, 8)}… tunnel registered\n`);
}

/**
 * Get the FigmaBridge for a session token.
 * Returns null if no tunnel is connected for this token.
 */
export function getSessionBridge(token: string): FigmaBridge | null {
  const session = sessions.get(token);
  if (!session) return null;
  session.lastActivity = Date.now();
  return session.bridge;
}

/**
 * Check if a session has an active tunnel connection.
 */
export function hasActiveSession(token: string): boolean {
  const session = sessions.get(token);
  return !!session && session.tunnelSocket.readyState === WebSocket.OPEN;
}

/**
 * Get count of active sessions (for monitoring).
 */
export function getActiveSessionCount(): number {
  let count = 0;
  for (const session of sessions.values()) {
    if (session.tunnelSocket.readyState === WebSocket.OPEN) count++;
  }
  return count;
}

/**
 * Remove a session (e.g. when token is revoked).
 */
export function removeSession(token: string): void {
  const session = sessions.get(token);
  if (session) {
    session.bridge.disconnect().catch(() => {});
    if (session.tunnelSocket.readyState === WebSocket.OPEN) {
      session.tunnelSocket.close(1000, "Session removed");
    }
    sessions.delete(token);
  }
}

/**
 * Clean up stale sessions (no activity for given duration).
 */
export function cleanupStaleSessions(maxIdleMs: number = 30 * 60 * 1000): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [token, session] of sessions.entries()) {
    if (now - session.lastActivity > maxIdleMs) {
      removeSession(token);
      cleaned++;
    }
  }
  return cleaned;
}
