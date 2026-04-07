/**
 * stitch-auth.js — Google OAuth2 flow for Stitch API access.
 *
 * Provides a seamless "Sign in with Google" experience:
 *   1. Opens browser to Google sign-in
 *   2. Captures OAuth callback on localhost
 *   3. Exchanges code for access + refresh tokens
 *   4. Auto-refreshes tokens before expiry
 *
 * Usage:
 *   const { getStitchAccessToken, startStitchAuth, hasStitchAuth } = require("./stitch-auth");
 *   // Trigger sign-in (opens browser):
 *   const token = await startStitchAuth();
 *   // Get current valid token (auto-refreshes):
 *   const token = await getStitchAccessToken();
 */

const http = require("http");
const https = require("https");
const { URL, URLSearchParams } = require("url");
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require("fs");
const { join } = require("path");
const { homedir } = require("os");
const { exec } = require("child_process");

// Google OAuth2 client credentials (public installed-app client from gcloud SDK)
const CLIENT_ID = "32555940559.apps.googleusercontent.com";
const CLIENT_SECRET = "ZmssLNjJy2998hD4CTg2ejr2";
const SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/cloud-platform",
].join(" ");

const AUTH_URL = "https://accounts.google.com/o/oauth2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// Token storage
const TOKEN_DIR = join(homedir(), ".claude", "stitch");
const TOKEN_FILE = join(TOKEN_DIR, "oauth-tokens.json");

// ── Token persistence ──────────────────────────────────────────────────────────

function loadTokens() {
  try {
    if (existsSync(TOKEN_FILE)) {
      return JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
    }
  } catch {}
  return null;
}

function saveTokens(tokens) {
  try {
    if (!existsSync(TOKEN_DIR)) mkdirSync(TOKEN_DIR, { recursive: true });
    writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  } catch (err) {
    console.error("  Could not save Stitch tokens:", err.message);
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function postForm(url, params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString();
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Token exchange failed: ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
    : "xdg-open";
  exec(`${cmd} "${url}"`);
}

// ── OAuth2 flow ─────────────────────────────────────────────────────────────

/**
 * Start the OAuth2 authorization flow.
 * Opens a browser for Google sign-in and returns the access token.
 *
 * @returns {Promise<string>} access token
 */
function startStitchAuth() {
  return new Promise((resolve, reject) => {
    // Find a free port for the callback server
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const redirectUri = `http://localhost:${port}/callback`;

      // Build Google OAuth URL
      const authParams = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
      });
      const authUrl = `${AUTH_URL}?${authParams}`;

      console.log(`  Stitch OAuth: listening on port ${port}`);
      console.log(`  Opening browser for Google sign-in...`);

      // Handle the OAuth callback
      server.on("request", async (req, res) => {
        if (!req.url.startsWith("/callback")) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const url = new URL(req.url, `http://localhost:${port}`);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(errorPage(error));
          server.close();
          reject(new Error(`Google auth denied: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(errorPage("No authorization code received"));
          server.close();
          reject(new Error("No authorization code"));
          return;
        }

        try {
          // Exchange code for tokens
          const tokenData = await postForm(TOKEN_URL, {
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          });

          if (tokenData.error) {
            throw new Error(`${tokenData.error}: ${tokenData.error_description}`);
          }

          // Save tokens (with expiry timestamp)
          const tokens = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
            email: null,
          };

          // Try to get user email from id_token
          if (tokenData.id_token) {
            try {
              const payload = JSON.parse(
                Buffer.from(tokenData.id_token.split(".")[1], "base64").toString()
              );
              tokens.email = payload.email;
            } catch {}
          }

          saveTokens(tokens);
          console.log(`  Stitch OAuth: authenticated${tokens.email ? ` as ${tokens.email}` : ""}`);

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(successPage(tokens.email));
          server.close();
          resolve(tokens.access_token);
        } catch (err) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(errorPage(err.message));
          server.close();
          reject(err);
        }
      });

      // Open browser
      openBrowser(authUrl);

      // Timeout after 2 minutes
      setTimeout(() => {
        server.close();
        reject(new Error("Stitch auth timed out (2 min). Try again."));
      }, 120_000);
    });
  });
}

/**
 * Refresh the access token using the stored refresh token.
 */
async function refreshAccessToken(tokens) {
  if (!tokens?.refresh_token) {
    throw new Error("No refresh token — sign in again.");
  }

  const tokenData = await postForm(TOKEN_URL, {
    refresh_token: tokens.refresh_token,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  if (tokenData.error) {
    throw new Error(`Refresh failed: ${tokenData.error_description || tokenData.error}`);
  }

  tokens.access_token = tokenData.access_token;
  tokens.expires_at = Date.now() + (tokenData.expires_in || 3600) * 1000;
  saveTokens(tokens);

  console.log("  Stitch OAuth: token refreshed");
  return tokens.access_token;
}

/**
 * Get a valid Stitch access token. Auto-refreshes if expired.
 * Returns null if not authenticated (call startStitchAuth first).
 *
 * @returns {Promise<string|null>}
 */
async function getStitchAccessToken() {
  const tokens = loadTokens();
  if (!tokens) return null;

  // Refresh if expiring within 5 minutes
  if (tokens.expires_at && Date.now() > tokens.expires_at - 5 * 60 * 1000) {
    try {
      return await refreshAccessToken(tokens);
    } catch (err) {
      console.error("  Stitch token refresh failed:", err.message);
      return null;
    }
  }

  return tokens.access_token || null;
}

/**
 * Check if we have stored Stitch auth (may need refresh).
 */
function hasStitchAuth() {
  const tokens = loadTokens();
  return !!(tokens?.refresh_token);
}

/**
 * Get the email of the authenticated Stitch user.
 */
function getStitchEmail() {
  const tokens = loadTokens();
  return tokens?.email || null;
}

/**
 * Clear stored Stitch auth.
 */
function clearStitchAuth() {
  try {
    if (existsSync(TOKEN_FILE)) {
      writeFileSync(TOKEN_FILE, "{}");
    }
  } catch {}
}

// ── HTML response pages ──────────────────────────────────────────────────────

function successPage(email) {
  return `<!DOCTYPE html><html><head><title>Stitch Connected</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0a0a0a;color:#fff}
.card{text-align:center;padding:48px;border-radius:16px;background:#1a1a2e;max-width:400px}
h1{color:#4ade80;margin:0 0 16px}p{color:#aaa;margin:8px 0}
.check{font-size:64px;margin-bottom:16px}</style></head>
<body><div class="card"><div class="check">&#10003;</div><h1>Connected to Stitch</h1>
<p>${email ? `Signed in as <strong>${email}</strong>` : "Authentication successful"}</p>
<p>You can close this tab and return to Figma.</p></div></body></html>`;
}

function errorPage(error) {
  return `<!DOCTYPE html><html><head><title>Stitch Auth Error</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0a0a0a;color:#fff}
.card{text-align:center;padding:48px;border-radius:16px;background:#2e1a1a;max-width:400px}
h1{color:#f87171;margin:0 0 16px}p{color:#aaa;margin:8px 0}</style></head>
<body><div class="card"><h1>Authentication Failed</h1>
<p>${error}</p><p>Close this tab and try again in the plugin.</p></div></body></html>`;
}

module.exports = {
  startStitchAuth,
  getStitchAccessToken,
  hasStitchAuth,
  getStitchEmail,
  clearStitchAuth,
};
