/**
 * Auth & Rate Limiting — validates session tokens and prevents abuse.
 *
 * For launch: simple token validation (UUID format) + per-token rate limiting.
 * No OAuth, no login, no user accounts. Just a random token per install.
 */

import type { IncomingMessage } from "node:http";

// ─── Token Validation ───────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate that a token is a well-formed UUID v4.
 */
export function isValidToken(token: string): boolean {
  return UUID_REGEX.test(token);
}

/**
 * Extract session token from an HTTP request.
 * Checks: X-Session-Token header, then ?token= query param.
 */
export function extractToken(req: IncomingMessage): string | null {
  // Header first
  const headerToken = req.headers["x-session-token"];
  if (typeof headerToken === "string" && isValidToken(headerToken)) {
    return headerToken;
  }

  // Query param fallback (used by WebSocket tunnel connections)
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const paramToken = url.searchParams.get("token");
    if (paramToken && isValidToken(paramToken)) {
      return paramToken;
    }
  } catch {
    // malformed URL
  }

  return null;
}

// ─── Rate Limiting ──────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || "120", 10);

/**
 * Check if a token has exceeded its rate limit.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export function checkRateLimit(token: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const entry = rateLimits.get(token);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimits.set(token, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count++;
  return { allowed: true };
}

/**
 * Clean up old rate limit entries (call periodically).
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [token, entry] of rateLimits.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimits.delete(token);
    }
  }
}

// Clean up rate limits every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000).unref();
