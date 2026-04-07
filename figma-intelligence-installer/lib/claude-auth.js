/**
 * claude-auth.js — Anthropic OAuth2 flow for Claude authentication.
 *
 * Same pattern as stitch-auth.js:
 *   1. Opens browser to Claude sign-in
 *   2. Captures OAuth callback on localhost
 *   3. Exchanges code for access token (using PKCE)
 *   4. Saves token so `claude auth status` recognizes the login
 *
 * This allows the Figma plugin to trigger Claude auth via browser,
 * without needing the user to open a terminal.
 */

const http = require("http");
const https = require("https");
const crypto = require("crypto");
const { URL, URLSearchParams } = require("url");
const { exec } = require("child_process");
const { homedir } = require("os");
const { join } = require("path");
const { existsSync, mkdirSync, writeFileSync, readFileSync } = require("fs");

// ── Token persistence ──────────────────────────────────────────────────────
const TOKEN_DIR = join(homedir(), ".claude");
const TOKEN_FILE = join(TOKEN_DIR, "claude-oauth-token.json");

function saveClaudeToken(tokenData) {
  try {
    if (!existsSync(TOKEN_DIR)) mkdirSync(TOKEN_DIR, { recursive: true });
    writeFileSync(TOKEN_FILE, JSON.stringify({
      access_token: tokenData.access_token,
      expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
      saved_at: Date.now(),
    }, null, 2));
  } catch (err) {
    console.error("  Could not save Claude token:", err.message);
  }
}

function hasClaudeToken() {
  try {
    if (!existsSync(TOKEN_FILE)) return false;
    const data = JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
    if (!data.access_token) return false;
    if (data.expires_at && Date.now() > data.expires_at) return false;
    return true;
  } catch {
    return false;
  }
}

// Claude OAuth2 parameters (from `claude auth login` flow)
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const AUTH_URL = "https://claude.com/cai/oauth/authorize";
const TOKEN_URL = "https://claude.com/cai/oauth/token";
const SCOPES = [
  "org:create_api_key",
  "user:profile",
  "user:inference",
  "user:sessions:claude_code",
  "user:mcp_servers",
  "user:file_upload",
].join(" ");

// ── PKCE helpers ──────────────────────────────────────────────────────────

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function generateState() {
  return crypto.randomBytes(32).toString("base64url");
}

// ── HTTP helpers ─────────────────────────────────────────────────────────

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
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Token exchange failed: ${data}`)); }
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

// ── OAuth2 flow ──────────────────────────────────────────────────────────

/**
 * Start the Claude OAuth2 authorization flow.
 * Opens browser for sign-in and returns when complete.
 *
 * @returns {Promise<{email: string|null}>}
 */
function startClaudeAuth() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const redirectUri = `http://localhost:${port}/callback`;

      // PKCE
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      const state = generateState();

      const authParams = new URLSearchParams({
        code: "true",
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: redirectUri,
        scope: SCOPES,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state: state,
      });
      const authUrl = `${AUTH_URL}?${authParams}`;

      console.log(`  Claude OAuth: listening on port ${port}`);
      console.log(`  Opening browser for Claude sign-in...`);

      server.on("request", async (req, res) => {
        if (!req.url.startsWith("/callback")) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const url = new URL(req.url, `http://localhost:${port}`);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        const returnedState = url.searchParams.get("state");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(errorPage(error));
          server.close();
          reject(new Error(`Claude auth denied: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(errorPage("No authorization code received"));
          server.close();
          reject(new Error("No authorization code"));
          return;
        }

        if (returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(errorPage("State mismatch — possible CSRF"));
          server.close();
          reject(new Error("State mismatch"));
          return;
        }

        try {
          // Exchange code for token using PKCE
          const tokenData = await postForm(TOKEN_URL, {
            code,
            client_id: CLIENT_ID,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            code_verifier: codeVerifier,
          });

          if (tokenData.error) {
            throw new Error(`${tokenData.error}: ${tokenData.error_description || ""}`);
          }

          console.log(`  Claude OAuth: token received`);

          // Persist token so auth state is detectable without CLI
          saveClaudeToken(tokenData);

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(successPage());
          server.close();
          resolve({ email: null, tokenData });
        } catch (err) {
          // Token exchange might fail if Claude's token endpoint expects
          // a different flow. Fall back to just opening the auth page
          // and letting the claude CLI handle the callback.
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
        reject(new Error("Claude auth timed out (2 min). Try again."));
      }, 120_000);
    });
  });
}

/**
 * Fallback: spawn `claude auth login` and capture + open the OAuth URL.
 * This delegates to the CLI's own OAuth flow (which stores tokens properly).
 *
 * @returns {Promise<void>}
 */
function startClaudeAuthViaCLI() {
  return new Promise((resolve, reject) => {
    const { spawn, execSync } = require("child_process");
    const { writeFileSync, readFileSync, unlinkSync } = require("fs");
    const { join } = require("path");
    const os = require("os");

    // Find claude binary
    let cliBin = "claude";
    try {
      cliBin = execSync("which claude", {
        encoding: "utf8", timeout: 5000, stdio: ["pipe","pipe","pipe"]
      }).trim();
    } catch {}

    // Capture script — writes the URL to a temp file
    const urlFile = join(os.tmpdir(), "figma-claude-oauth-url.txt");
    const captureScript = join(os.tmpdir(), "figma-browser-capture.sh");
    try { unlinkSync(urlFile); } catch {}
    writeFileSync(captureScript, `#!/bin/bash\necho "$1" > "${urlFile}"\n`, { mode: 0o755 });

    // Spawn claude auth login with our BROWSER override
    const proc = spawn(cliBin, ["auth", "login"], {
      env: { ...process.env, BROWSER: captureScript },
      stdio: "pipe",
    });

    let resolved = false;

    // Poll for the captured URL
    const urlPoll = setInterval(() => {
      try {
        const url = readFileSync(urlFile, "utf8").trim();
        if (url && url.startsWith("http")) {
          clearInterval(urlPoll);
          console.log(`  Claude OAuth: URL captured, opening browser`);
          openBrowser(url);
          if (!resolved) { resolved = true; resolve(); }
        }
      } catch {}
    }, 500);

    // Timeout
    setTimeout(() => {
      clearInterval(urlPoll);
      if (!resolved) {
        resolved = true;
        proc.kill();
        reject(new Error("Claude auth: could not capture OAuth URL"));
      }
    }, 15000);

    proc.on("error", (err) => {
      clearInterval(urlPoll);
      if (!resolved) { resolved = true; reject(err); }
    });
  });
}

// ── HTML response pages ──────────────────────────────────────────────────

function successPage() {
  return `<!DOCTYPE html><html><head><title>Claude Connected</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0a0a0a;color:#fff}
.card{text-align:center;padding:48px;border-radius:16px;background:#1a1a2e;max-width:400px}
h1{color:#da7756;margin:0 0 16px}p{color:#aaa;margin:8px 0}
.check{font-size:64px;margin-bottom:16px}</style></head>
<body><div class="card"><div class="check">&#10003;</div><h1>Connected to Claude</h1>
<p>Authentication successful</p>
<p>You can close this tab and return to Figma.</p></div></body></html>`;
}

function errorPage(error) {
  return `<!DOCTYPE html><html><head><title>Claude Auth Error</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0a0a0a;color:#fff}
.card{text-align:center;padding:48px;border-radius:16px;background:#2e1a1a;max-width:400px}
h1{color:#f87171;margin:0 0 16px}p{color:#aaa;margin:8px 0}</style></head>
<body><div class="card"><h1>Authentication Failed</h1>
<p>${error}</p><p>Close this tab and try again in the plugin.</p></div></body></html>`;
}

module.exports = {
  startClaudeAuth,
  startClaudeAuthViaCLI,
  hasClaudeToken,
};
