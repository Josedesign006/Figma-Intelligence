#!/bin/bash
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
LOG_FILE="$HOME/.figma-bridge-relay.log"  # must have no spaces — launchd StandardOutPath fails silently with spaces
DEFAULT_CODEX_APP_BIN="/Applications/Codex.app/Contents/Resources/codex"

# Known locations where Gemini CLI stores OAuth credentials
GEMINI_AUTH_CANDIDATES=(
  "$HOME/.gemini/oauth_creds.json"
  "$HOME/.gemini/credentials.json"
  "$HOME/.gemini/auth.json"
  "$HOME/.config/google/application_default_credentials.json"
)

extract_email() {
  printf "%s" "$1" | grep -E -o "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" | head -n 1 || true
}

refresh_claude_status() {
  if [ -z "$CLAUDE_BIN" ]; then
    CLAUDE_AUTH_EMAIL=""
    CLAUDE_LOGGED_IN=false
    return
  fi

  CLAUDE_STATUS_OUTPUT="$("$CLAUDE_BIN" auth status 2>&1 || true)"
  if "$CLAUDE_BIN" auth status &>/dev/null; then
    CLAUDE_AUTH_EMAIL="$(extract_email "$CLAUDE_STATUS_OUTPUT")"
    CLAUDE_LOGGED_IN=true
  else
    CLAUDE_AUTH_EMAIL=""
    CLAUDE_LOGGED_IN=false
  fi
}

refresh_codex_status() {
  if [ -z "$CODEX_BIN" ]; then
    CODEX_AUTH_EMAIL=""
    CODEX_LOGGED_IN=false
    return
  fi

  CODEX_STATUS_OUTPUT="$("$CODEX_BIN" login status 2>&1 || true)"
  if "$CODEX_BIN" login status &>/dev/null; then
    CODEX_AUTH_EMAIL="$(extract_email "$CODEX_STATUS_OUTPUT")"
    CODEX_LOGGED_IN=true
  else
    CODEX_AUTH_EMAIL=""
    CODEX_LOGGED_IN=false
  fi
}

# Check Gemini auth. Gemini CLI v0.34+ stores tokens in the macOS Keychain
# under service "gemini-cli-oauth" / account "main-account". Falls back to
# legacy credential files.
refresh_gemini_status() {
  GEMINI_AUTH_EMAIL=""
  GEMINI_LOGGED_IN=false

  if [ -z "$GEMINI_BIN" ]; then
    return
  fi

  # Fast path 1: macOS Keychain (primary store for Gemini CLI v0.34+)
  if command -v security &>/dev/null; then
    if security find-generic-password -s "gemini-cli-oauth" -a "main-account" &>/dev/null 2>&1; then
      GEMINI_LOGGED_IN=true
      # Try to extract email from stored JSON payload
      local raw_pw
      raw_pw="$(security find-generic-password -s "gemini-cli-oauth" -a "main-account" -w 2>/dev/null || true)"
      if [ -n "$raw_pw" ]; then
        GEMINI_AUTH_EMAIL=$(node -e "
          try {
            const raw = '$raw_pw';
            const parsed = JSON.parse(Buffer.from(raw,'base64').toString('utf8'));
            process.stdout.write(parsed.email || parsed.client_email || '');
          } catch {
            try { const p=JSON.parse('$raw_pw'); process.stdout.write(p.email||p.client_email||''); } catch {}
          }
        " 2>/dev/null || true)
      fi
      return
    fi
  fi

  # Fast path 2: oauth_creds.json (legacy Gemini CLI file storage)
  local oauth_creds="$HOME/.gemini/oauth_creds.json"
  if [ -f "$oauth_creds" ]; then
    local email
    email=$(node -e "
      try {
        const d = JSON.parse(require('fs').readFileSync('$oauth_creds','utf8'));
        const e = d.email || d.client_email || (d.user && d.user.email) || '';
        if (d.access_token || d.refresh_token || d.client_email || d.token || e) {
          process.stdout.write(e || '');
        }
      } catch {}
    " 2>/dev/null || true)
    GEMINI_LOGGED_IN=true
    GEMINI_AUTH_EMAIL="$email"
    return
  fi

  # Fast path 3: other known credential file locations
  for cred_path in "${GEMINI_AUTH_CANDIDATES[@]}"; do
    if [ -f "$cred_path" ]; then
      local email
      email=$(node -e "
        try {
          const d = JSON.parse(require('fs').readFileSync('$cred_path','utf8'));
          const e = d.email || d.client_email || (d.user && d.user.email) || '';
          if (d.access_token || d.refresh_token || d.client_email || d.token || e) {
            process.stdout.write(e || '');
          }
        } catch {}
      " 2>/dev/null || true)
      GEMINI_LOGGED_IN=true
      GEMINI_AUTH_EMAIL="$email"
      return
    fi
  done
}

# ─── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo "┌─────────────────────────────────────────────────────┐"
echo "│        Figma Intelligence Layer — Setup             │"
echo "└─────────────────────────────────────────────────────┘"
echo ""

# ─── Check Node.js ────────────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed."
  echo "   Install it from https://nodejs.org (LTS version recommended)"
  exit 1
fi
echo "✔ Node.js $(node -v) found"

# ─── Check AI provider CLIs + Login ───────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────────────"
echo "🔐 Checking AI provider authentication..."
echo "   Setup will prepare every installed provider so switching in the plugin does not require restarting the relay."

CLAUDE_BIN="$(command -v claude 2>/dev/null || true)"
CODEX_BIN="$(command -v codex 2>/dev/null || true)"
GEMINI_BIN="$(command -v gemini 2>/dev/null || true)"
if [ -z "$CODEX_BIN" ] && [ -x "$DEFAULT_CODEX_APP_BIN" ]; then
  CODEX_BIN="$DEFAULT_CODEX_APP_BIN"
fi
CLAUDE_BIN_DIR=""
CODEX_BIN_DIR=""
GEMINI_BIN_DIR=""
CLAUDE_AUTH_EMAIL=""
CODEX_AUTH_EMAIL=""
GEMINI_AUTH_EMAIL=""
CLAUDE_LOGGED_IN=false
CODEX_LOGGED_IN=false
GEMINI_LOGGED_IN=false

if [ -n "$CLAUDE_BIN" ]; then
  CLAUDE_BIN_DIR="$(dirname "$CLAUDE_BIN")"
  echo "   ✔ Claude CLI found: $CLAUDE_BIN"
  refresh_claude_status
  if [ "$CLAUDE_LOGGED_IN" = true ]; then
    echo "   ✔ Claude logged in${CLAUDE_AUTH_EMAIL:+ as $CLAUDE_AUTH_EMAIL}"
  else
    echo "   ⚠  Claude CLI is installed but not logged in."
    echo "      Run 'claude login' later if you want to use Claude in the plugin."
  fi
else
  echo "   ⚠  Claude CLI not found."
  echo "      Install from: https://claude.ai/download"
fi

if [ -n "$CODEX_BIN" ]; then
  CODEX_BIN_DIR="$(dirname "$CODEX_BIN")"
  echo "   ✔ OpenAI Codex CLI found: $CODEX_BIN"
  refresh_codex_status
  if [ "$CODEX_LOGGED_IN" = true ]; then
    echo "   ✔ Codex logged in${CODEX_AUTH_EMAIL:+ as $CODEX_AUTH_EMAIL}"
  else
    echo "   ⚠  Codex CLI is installed but not logged in."
    echo "      Run 'codex login' later if you want to use OpenAI in the plugin."
  fi
else
  echo "   ⚠  OpenAI Codex CLI not found."
  echo "      Install with: npm install -g @openai/codex"
fi

if [ -n "$GEMINI_BIN" ]; then
  GEMINI_BIN_DIR="$(dirname "$GEMINI_BIN")"
  echo "   ✔ Google Gemini CLI found: $GEMINI_BIN"
  refresh_gemini_status
  if [ "$GEMINI_LOGGED_IN" = true ]; then
    echo "   ✔ Gemini logged in${GEMINI_AUTH_EMAIL:+ as $GEMINI_AUTH_EMAIL} (Google One AI Premium / Gemini Advanced)"
  else
    echo "   ⚠  Gemini CLI is installed but not logged in."
    echo "      Run 'gemini' in a terminal to authenticate via Google browser OAuth."
  fi
else
  echo "   ℹ  Google Gemini CLI not found."
  echo "      Install with: npm install -g @google/gemini-cli"
  echo "      Then run 'gemini' to authenticate with your Google account."
fi

if [ -z "$CLAUDE_BIN" ] && [ -z "$CODEX_BIN" ] && [ -z "$GEMINI_BIN" ]; then
  echo ""
  echo "   ❌ No supported AI CLI was found."
  echo "   Install at least one of these, then re-run setup:"
  echo "     Claude:       https://claude.ai/download"
  echo "     OpenAI Codex: npm install -g @openai/codex"
  echo "     Gemini CLI:   npm install -g @google/gemini-cli"
  exit 1
fi

if [ -n "$CODEX_BIN" ] && [ "$CODEX_LOGGED_IN" != true ]; then
  echo ""
  echo "   Opening Codex login so OpenAI is ready when you switch providers..."
  "$CODEX_BIN" login || true
  refresh_codex_status
  if [ "$CODEX_LOGGED_IN" = true ]; then
    echo "   ✔ Codex login successful${CODEX_AUTH_EMAIL:+ as $CODEX_AUTH_EMAIL}"
  else
    echo "   ⚠  Codex login was skipped or did not complete."
  fi
fi

if [ -n "$GEMINI_BIN" ] && [ "$GEMINI_LOGGED_IN" != true ]; then
  echo ""
  echo "   ⚠  Gemini CLI is not authenticated yet."
  echo "      To authenticate, run this in a new terminal and follow the prompts:"
  echo ""
  echo "        gemini"
  echo ""
  echo "      It will open a browser to sign in with your Google account."
  echo "      Once done, re-run ./setup.sh — Gemini subscription mode will activate."
  echo "      (The plugin will use API key mode as a fallback until then.)"
fi

if [ "$CLAUDE_LOGGED_IN" != true ] && [ "$CODEX_LOGGED_IN" != true ] && [ "$GEMINI_LOGGED_IN" != true ]; then
  echo ""
  echo "   ⚠  No AI provider is authenticated yet."
fi

if [ -n "$CLAUDE_BIN" ] && [ "$CLAUDE_LOGGED_IN" != true ]; then
  echo ""
  echo "   Opening Claude login so Claude is ready when you switch providers..."
  "$CLAUDE_BIN" login || true
  refresh_claude_status
  if [ "$CLAUDE_LOGGED_IN" = true ]; then
    echo "   ✔ Claude login successful${CLAUDE_AUTH_EMAIL:+ as $CLAUDE_AUTH_EMAIL}"
  else
    echo "   ⚠  Claude login was skipped or did not complete."
  fi
fi

if [ "$CLAUDE_LOGGED_IN" != true ] && [ "$CODEX_LOGGED_IN" != true ] && [ "$GEMINI_LOGGED_IN" != true ]; then
  echo ""
  echo "   ❌ Setup needs at least one logged-in AI provider."
  echo "   Run one of these, then re-run setup:"
  echo "     claude login"
  echo "     codex login"
  echo "     gemini   (follow prompts to sign in with Google)"
  exit 1
fi

# ─── Step 1: Install bridge relay deps ────────────────────────────────────────
echo ""
echo "📦 Installing bridge relay dependencies..."
cd "$REPO_DIR/figma-bridge-plugin"
npm install
echo "   ✔ Done"

# ─── Step 2: Install MCP server deps + build ──────────────────────────────────
echo ""
echo "📦 Installing MCP server dependencies..."
cd "$REPO_DIR/figma-intelligence-layer"
npm install
echo "   ✔ Done"

# ─── Step 2b: Install design bridge deps ──────────────────────────────────────
echo ""
echo "📦 Installing design bridge dependencies..."
cd "$REPO_DIR/design-bridge"
npm install
echo "   ✔ Done"

# ─── Step 2c: Install VS Code bridge extension deps + build ──────────────────
echo ""
echo "📦 Building VS Code bridge extension (Design + Code mode)..."
cd "$REPO_DIR/vscode-chat-extension"
npm install
npm run build --silent
echo "   ✔ Done"

# Verify sharp native binary loaded correctly (it can silently fail on fresh installs)
echo ""
echo "🔍 Verifying sharp image module..."
if ! node -e "require('sharp')" 2>/dev/null; then
  echo "   ⚠  sharp binary missing — clearing cache and reinstalling..."
  npm cache clean --force 2>/dev/null
  npm install sharp
  if ! node -e "require('sharp')" 2>/dev/null; then
    echo "   ❌ sharp still failing. Try: cd figma-intelligence-layer && npm install sharp"
    exit 1
  fi
fi
echo "   ✔ sharp OK"

echo ""
echo "🔨 Building MCP server..."
cd "$REPO_DIR/figma-intelligence-layer"
npm run build --silent
echo "   ✔ Built successfully"

# ─── Step 3: Figma Access Token ───────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────────────"
echo "🔑 Figma Personal Access Token"
echo "   Required to read your Figma files."
echo "   Get one: Figma Desktop → Account Settings → Security → Personal access tokens"
echo ""

# Check if token already set in settings
EXISTING_TOKEN=""
if [ -f "$CLAUDE_SETTINGS" ]; then
  EXISTING_TOKEN=$(node -e "
    try {
      const s = require('fs').readFileSync('$CLAUDE_SETTINGS', 'utf8');
      const j = JSON.parse(s);
      const t = j?.mcpServers?.['figma-intelligence-layer']?.env?.FIGMA_ACCESS_TOKEN || '';
      if (t && t !== 'YOUR_FIGMA_TOKEN_HERE') process.stdout.write(t);
    } catch {}
  " 2>/dev/null || true)
fi

if [ -n "$EXISTING_TOKEN" ]; then
  echo "   Found existing token: ${EXISTING_TOKEN:0:12}••••"
  echo -n "   Press Enter to keep it, or paste a new token: "
  read -r INPUT_TOKEN
  FIGMA_TOKEN="${INPUT_TOKEN:-$EXISTING_TOKEN}"
else
  echo -n "   Paste your token: "
  read -r FIGMA_TOKEN
  if [ -z "$FIGMA_TOKEN" ]; then
    FIGMA_TOKEN="YOUR_FIGMA_TOKEN_HERE"
    echo ""
    echo "   ⚠ No token provided. You can set it later:"
    echo "     Edit FIGMA_ACCESS_TOKEN in ~/.claude/settings.json"
  fi
fi
echo ""

# ─── Step 3b: Design Bridge API keys ─────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────────────"
echo "🎨 Design Bridge — API Keys"
echo "   These power real photos, icons, palettes, and AI layout generation."
echo "   Every key is FREE. Press Enter to skip any — fallbacks are built-in."
echo ""

DESIGN_ENV_FILE="$REPO_DIR/design-bridge/.env"

# Load existing values as defaults
_db_stitch_key=""
_db_project_id=""
_db_unsplash_key=""
_db_pexels_key=""
_db_fonts_key=""
_db_stitch_mode="experimental"
_db_theme="auto"
_db_dark_mode="false"

if [ -f "$DESIGN_ENV_FILE" ]; then
  _db_stitch_key=$(grep "^STITCH_API_KEY=" "$DESIGN_ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || true)
  _db_project_id=$(grep "^GOOGLE_CLOUD_PROJECT=" "$DESIGN_ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || true)
  _db_unsplash_key=$(grep "^UNSPLASH_ACCESS_KEY=" "$DESIGN_ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || true)
  _db_pexels_key=$(grep "^PEXELS_API_KEY=" "$DESIGN_ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || true)
  _db_fonts_key=$(grep "^GOOGLE_FONTS_API_KEY=" "$DESIGN_ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || true)
  _db_stitch_mode=$(grep "^STITCH_MODE=" "$DESIGN_ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || echo "experimental")
  _db_theme=$(grep "^DEFAULT_THEME=" "$DESIGN_ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || echo "auto")
  _db_dark_mode=$(grep "^DEFAULT_DARK_MODE=" "$DESIGN_ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || echo "false")
fi

mask_key() {
  local k="$1"
  if [ -z "$k" ]; then echo "(not set)"; return; fi
  if [ ${#k} -lt 8 ]; then echo "$k"; return; fi
  echo "${k:0:4}••••${k: -4}"
}

# ── Stitch API ────────────────────────────────────────────
echo "   [1] Google Stitch (AI UI layout generation)"
echo "       Get free key → https://stitch.withgoogle.com → Profile → Settings → API Keys"
if [ -n "$_db_stitch_key" ]; then
  echo "       Current key : $(mask_key "$_db_stitch_key")"
  echo "       Current GCP : $_db_project_id"
  echo -n "       Press Enter to keep, or paste a new Stitch API key: "
else
  echo "       Enable API  → gcloud services enable stitch.googleapis.com --project=<your-project>"
  echo -n "       Stitch API key (Enter to skip): "
fi
read -r _input_stitch_key
STITCH_API_KEY="${_input_stitch_key:-$_db_stitch_key}"

if [ -n "$STITCH_API_KEY" ]; then
  if [ -n "$_db_project_id" ] && [ -z "$_input_stitch_key" ]; then
    # Keeping existing key — keep existing project too
    GOOGLE_CLOUD_PROJECT="$_db_project_id"
    echo "       ✔ Keeping existing Stitch configuration"
  else
    if [ -n "$_db_project_id" ]; then
      echo -n "       GCP Project ID (Enter to keep '$_db_project_id'): "
    else
      echo -n "       GCP Project ID (e.g. my-project-123456): "
    fi
    read -r _input_project
    GOOGLE_CLOUD_PROJECT="${_input_project:-$_db_project_id}"
    if [ -n "$GOOGLE_CLOUD_PROJECT" ]; then
      echo "       ✔ Stitch: API key + project saved"
      echo "       ℹ  If generation fails, enable API: gcloud services enable stitch.googleapis.com --project=$GOOGLE_CLOUD_PROJECT"
    fi
  fi
else
  GOOGLE_CLOUD_PROJECT="$_db_project_id"
  echo "       ○  Skipped — Claude generates UI directly (still great quality)"
fi
echo ""

# ── Unsplash ──────────────────────────────────────────────
echo "   [2] Unsplash (3M+ pro photos — makes UIs look agency-built)"
echo "       Free key (50 req/hr) → https://unsplash.com/developers → New Application"
if [ -n "$_db_unsplash_key" ]; then
  echo -n "       Current: $(mask_key "$_db_unsplash_key") — Enter to keep, or paste new: "
else
  echo -n "       Unsplash Access Key (Enter to skip): "
fi
read -r _input_unsplash
UNSPLASH_ACCESS_KEY="${_input_unsplash:-$_db_unsplash_key}"
if [ -n "$UNSPLASH_ACCESS_KEY" ]; then
  echo "       ✔ Unsplash key saved"
else
  echo "       ○  Skipped — using Pixabay fallback (free, no key needed)"
fi
echo ""

# ── Pexels ────────────────────────────────────────────────
echo "   [3] Pexels (1M+ curated photos — free, instant key)"
echo "       Free key → https://www.pexels.com/api → Get Started"
if [ -n "$_db_pexels_key" ]; then
  echo -n "       Current: $(mask_key "$_db_pexels_key") — Enter to keep, or paste new: "
else
  echo -n "       Pexels API Key (Enter to skip): "
fi
read -r _input_pexels
PEXELS_API_KEY="${_input_pexels:-$_db_pexels_key}"
if [ -n "$PEXELS_API_KEY" ]; then
  echo "       ✔ Pexels key saved"
else
  echo "       ○  Skipped — using Pixabay fallback"
fi
echo ""

# ── Google Fonts key (optional) ───────────────────────────
echo "   [4] Google Fonts API Key (optional — smarter font pairing)"
echo "       Free → https://console.cloud.google.com → Enable Web Fonts API"
if [ -n "$_db_fonts_key" ]; then
  echo -n "       Current: $(mask_key "$_db_fonts_key") — Enter to keep, or paste new: "
else
  echo -n "       Google Fonts API Key (Enter to skip): "
fi
read -r _input_fonts
GOOGLE_FONTS_API_KEY="${_input_fonts:-$_db_fonts_key}"
if [ -n "$GOOGLE_FONTS_API_KEY" ]; then
  echo "       ✔ Google Fonts key saved"
else
  echo "       ○  Skipped — CDN fallback works great"
fi
echo ""

# ── Write design-bridge .env ──────────────────────────────
cat > "$DESIGN_ENV_FILE" << ENVEOF
# ═══════════════════════════════════════════════════════
# Design Bridge — written by setup.sh
# Re-run ./setup.sh anytime to update keys
# ═══════════════════════════════════════════════════════

# ── Google Stitch (AI UI Generation) ──────────────────
STITCH_API_KEY=${STITCH_API_KEY}
GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT}
STITCH_MODE=${_db_stitch_mode}

# ── Photography APIs ───────────────────────────────────
UNSPLASH_ACCESS_KEY=${UNSPLASH_ACCESS_KEY}
PEXELS_API_KEY=${PEXELS_API_KEY}

# ── Free APIs (auto-enabled, no keys needed) ──────────
USE_COLOR_API=true
USE_ICONIFY=true
USE_DICEBEAR=true
USE_JSON_PLACEHOLDER=true
USE_GOOGLE_FONTS=true
USE_PIXABAY=true

# ── Google Fonts (optional key for smarter selection) ──
GOOGLE_FONTS_API_KEY=${GOOGLE_FONTS_API_KEY}

# ── Design Preferences ─────────────────────────────────
DEFAULT_THEME=${_db_theme}
DEFAULT_DARK_MODE=${_db_dark_mode}
ENVEOF

echo "   ✔ Design Bridge config written to design-bridge/.env"
echo ""

# ─── Step 4: Patch Claude Code MCP config ─────────────────────────────────────
echo "⚙️  Registering MCP server settings..."

node - "$REPO_DIR" "$FIGMA_TOKEN" "$CLAUDE_SETTINGS" \
  "$STITCH_API_KEY" "$GOOGLE_CLOUD_PROJECT" \
  "$UNSPLASH_ACCESS_KEY" "$PEXELS_API_KEY" "$GOOGLE_FONTS_API_KEY" << 'JSEOF'
const fs = require('fs');
const path = require('path');
const [,, repoDir, figmaToken, settingsPath,
  stitchKey, gcpProject, unsplashKey, pexelsKey, fontsKey] = process.argv;

let settings = {};
if (fs.existsSync(settingsPath)) {
  try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch (e) {
    console.error('   ⚠ Could not parse existing settings.json — creating fresh config');
  }
}

if (!settings.mcpServers) settings.mcpServers = {};

// Preserve any extra env vars that were already set (e.g. GEMINI_API_KEY)
const existingEnv = settings.mcpServers['figma-intelligence-layer']?.env || {};

// Read design-bridge .env before registering either MCP server
const dbEnvPath = path.join(repoDir, 'design-bridge', '.env');
let dbEnv = {};
if (fs.existsSync(dbEnvPath)) {
  fs.readFileSync(dbEnvPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const idx = t.indexOf('=');
    if (idx !== -1) dbEnv[t.slice(0, idx)] = t.slice(idx + 1);
  });
}

settings.mcpServers['figma-intelligence-layer'] = {
  command: 'node',
  args: [path.join(repoDir, 'figma-intelligence-layer', 'dist', 'index.js')],
  env: {
    ...existingEnv,
    FIGMA_ACCESS_TOKEN: figmaToken,
    FIGMA_BRIDGE_PORT: '9001',
    ENABLE_DECISION_LOG: 'true',
    ...(dbEnv.UNSPLASH_ACCESS_KEY ? { UNSPLASH_ACCESS_KEY: dbEnv.UNSPLASH_ACCESS_KEY } : {}),
    ...(dbEnv.PEXELS_API_KEY ? { PEXELS_API_KEY: dbEnv.PEXELS_API_KEY } : {}),
  }
};

// Register design-bridge MCP server
settings.mcpServers['design-bridge'] = {
  command: 'node',
  args: [path.join(repoDir, 'design-bridge', 'bridge.js')],
  env: {
    STITCH_API_KEY:       dbEnv.STITCH_API_KEY || '',
    GOOGLE_CLOUD_PROJECT: dbEnv.GOOGLE_CLOUD_PROJECT || '',
    STITCH_MODE:          dbEnv.STITCH_MODE || 'experimental',
    UNSPLASH_ACCESS_KEY:  dbEnv.UNSPLASH_ACCESS_KEY || '',
    PEXELS_API_KEY:       dbEnv.PEXELS_API_KEY || '',
    GOOGLE_FONTS_API_KEY: dbEnv.GOOGLE_FONTS_API_KEY || '',
    DEFAULT_THEME:        dbEnv.DEFAULT_THEME || 'auto',
    DEFAULT_DARK_MODE:    dbEnv.DEFAULT_DARK_MODE || 'false',
    USE_COLOR_API:        'true',
    USE_ICONIFY:          'true',
    USE_DICEBEAR:         'true',
    USE_JSON_PLACEHOLDER: 'true',
    USE_GOOGLE_FONTS:     'true',
    USE_PIXABAY:          'true',
  }
};

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log('   ✔ figma-intelligence-layer registered in ~/.claude/settings.json');
console.log('   ✔ design-bridge registered in ~/.claude/settings.json');
JSEOF

# ─── Step 5: Register Codex MCP config ───────────────────────────────────────
echo "⚙️  Registering MCP server settings for Codex..."

if [ -n "$CODEX_BIN" ]; then
  "$CODEX_BIN" mcp remove figma-intelligence-layer >/dev/null 2>&1 || true
  if "$CODEX_BIN" mcp add figma-intelligence-layer \
    --env FIGMA_ACCESS_TOKEN="$FIGMA_TOKEN" \
    --env FIGMA_BRIDGE_PORT=9001 \
    --env ENABLE_DECISION_LOG=true \
    -- node "$REPO_DIR/figma-intelligence-layer/dist/index.js" >/dev/null; then
    echo "   ✔ figma-intelligence-layer registered in ~/.codex/config.toml"
  else
    echo "   ⚠ Could not register figma-intelligence-layer in Codex."
  fi

  # Also register design-bridge in Codex
  "$CODEX_BIN" mcp remove design-bridge >/dev/null 2>&1 || true
  _db_env_args=""
  [ -n "$STITCH_API_KEY" ]       && _db_env_args="$_db_env_args --env STITCH_API_KEY=$STITCH_API_KEY"
  [ -n "$GOOGLE_CLOUD_PROJECT" ] && _db_env_args="$_db_env_args --env GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT"
  [ -n "$UNSPLASH_ACCESS_KEY" ]  && _db_env_args="$_db_env_args --env UNSPLASH_ACCESS_KEY=$UNSPLASH_ACCESS_KEY"
  [ -n "$PEXELS_API_KEY" ]       && _db_env_args="$_db_env_args --env PEXELS_API_KEY=$PEXELS_API_KEY"
  [ -n "$GOOGLE_FONTS_API_KEY" ] && _db_env_args="$_db_env_args --env GOOGLE_FONTS_API_KEY=$GOOGLE_FONTS_API_KEY"
  if "$CODEX_BIN" mcp add design-bridge \
    --env STITCH_MODE=experimental \
    --env USE_COLOR_API=true --env USE_ICONIFY=true \
    --env USE_DICEBEAR=true --env USE_JSON_PLACEHOLDER=true \
    --env USE_GOOGLE_FONTS=true --env USE_PIXABAY=true \
    $( [ -n "$STITCH_API_KEY" ]       && echo "--env STITCH_API_KEY=$STITCH_API_KEY" ) \
    $( [ -n "$GOOGLE_CLOUD_PROJECT" ] && echo "--env GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT" ) \
    $( [ -n "$UNSPLASH_ACCESS_KEY" ]  && echo "--env UNSPLASH_ACCESS_KEY=$UNSPLASH_ACCESS_KEY" ) \
    $( [ -n "$PEXELS_API_KEY" ]       && echo "--env PEXELS_API_KEY=$PEXELS_API_KEY" ) \
    $( [ -n "$GOOGLE_FONTS_API_KEY" ] && echo "--env GOOGLE_FONTS_API_KEY=$GOOGLE_FONTS_API_KEY" ) \
    -- node "$REPO_DIR/design-bridge/bridge.js" >/dev/null 2>&1; then
    echo "   ✔ design-bridge registered in ~/.codex/config.toml"
  else
    echo "   ⚠ Could not register design-bridge in Codex (non-critical)."
  fi
else
  echo "   ⚠ Codex CLI not found — skipping Codex MCP registration"
fi

# ─── Step 5b: Register Gemini CLI MCP config ─────────────────────────────────
echo "⚙️  Registering MCP server settings for Gemini CLI..."

if [ -n "$GEMINI_BIN" ]; then
  GEMINI_SETTINGS_DIR="$HOME/.gemini"
  GEMINI_SETTINGS_PATH="$GEMINI_SETTINGS_DIR/settings.json"
  mkdir -p "$GEMINI_SETTINGS_DIR"

  node - "$REPO_DIR" "$FIGMA_TOKEN" "$GEMINI_SETTINGS_PATH" << 'GEMINIEOF'
const fs = require('fs');
const path = require('path');
const [,, repoDir, figmaToken, settingsPath] = process.argv;
const mcpBuildPath = path.join(repoDir, 'figma-intelligence-layer', 'dist', 'index.js');

if (!fs.existsSync(mcpBuildPath)) {
  console.log('   ⚠ MCP build not found — skipping Gemini settings write');
  process.exit(0);
}

let settings = {};
if (fs.existsSync(settingsPath)) {
  try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
}
if (!settings.mcpServers) settings.mcpServers = {};

// Read design-bridge .env before registering either MCP server
const dbEnvPath = path.join(repoDir, 'design-bridge', '.env');
let dbEnv = {};
if (fs.existsSync(dbEnvPath)) {
  fs.readFileSync(dbEnvPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const idx = t.indexOf('=');
    if (idx !== -1) dbEnv[t.slice(0, idx)] = t.slice(idx + 1);
  });
}

settings.mcpServers['figma-intelligence-layer'] = {
  command: 'node',
  args: [mcpBuildPath],
  env: {
    FIGMA_ACCESS_TOKEN: figmaToken,
    FIGMA_BRIDGE_PORT: '9001',
    ENABLE_DECISION_LOG: 'true',
    ...(dbEnv.UNSPLASH_ACCESS_KEY ? { UNSPLASH_ACCESS_KEY: dbEnv.UNSPLASH_ACCESS_KEY } : {}),
    ...(dbEnv.PEXELS_API_KEY ? { PEXELS_API_KEY: dbEnv.PEXELS_API_KEY } : {}),
  },
};

// Also register design-bridge
settings.mcpServers['design-bridge'] = {
  command: 'node',
  args: [path.join(repoDir, 'design-bridge', 'bridge.js')],
  env: {
    STITCH_API_KEY:       dbEnv.STITCH_API_KEY || '',
    GOOGLE_CLOUD_PROJECT: dbEnv.GOOGLE_CLOUD_PROJECT || '',
    STITCH_MODE:          dbEnv.STITCH_MODE || 'experimental',
    UNSPLASH_ACCESS_KEY:  dbEnv.UNSPLASH_ACCESS_KEY || '',
    PEXELS_API_KEY:       dbEnv.PEXELS_API_KEY || '',
    GOOGLE_FONTS_API_KEY: dbEnv.GOOGLE_FONTS_API_KEY || '',
    DEFAULT_THEME:        dbEnv.DEFAULT_THEME || 'auto',
    DEFAULT_DARK_MODE:    dbEnv.DEFAULT_DARK_MODE || 'false',
    USE_COLOR_API: 'true', USE_ICONIFY: 'true', USE_DICEBEAR: 'true',
    USE_JSON_PLACEHOLDER: 'true', USE_GOOGLE_FONTS: 'true', USE_PIXABAY: 'true',
  },
};

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log('   ✔ figma-intelligence-layer registered in ~/.gemini/settings.json');
console.log('   ✔ design-bridge registered in ~/.gemini/settings.json');
GEMINIEOF
else
  echo "   ⚠ Gemini CLI not found — skipping Gemini MCP registration"
fi

# ─── Step 6: Patch VS Code MCP config ────────────────────────────────────────
VSCODE_MCP="$REPO_DIR/.vscode/mcp.json"
echo "⚙️  Updating .vscode/mcp.json for VS Code..."

node - "$REPO_DIR" "$FIGMA_TOKEN" "$VSCODE_MCP" << 'JSEOF2'
const fs = require('fs');
const path = require('path');
const [,, repoDir, figmaToken, mcpPath] = process.argv;

// Load design-bridge .env
const dbEnvPath = path.join(repoDir, 'design-bridge', '.env');
let dbEnv = {};
if (fs.existsSync(dbEnvPath)) {
  fs.readFileSync(dbEnvPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const idx = t.indexOf('=');
    if (idx !== -1) dbEnv[t.slice(0, idx)] = t.slice(idx + 1);
  });
}

const config = {
  servers: {
    "figma-intelligence-layer": {
      type: "stdio",
      command: "node",
      args: [path.join(repoDir, "figma-intelligence-layer", "dist", "index.js")],
      env: {
        FIGMA_ACCESS_TOKEN: figmaToken,
        FIGMA_BRIDGE_PORT: "9001",
        ENABLE_DECISION_LOG: "true",
        ...(dbEnv.UNSPLASH_ACCESS_KEY ? { UNSPLASH_ACCESS_KEY: dbEnv.UNSPLASH_ACCESS_KEY } : {}),
        ...(dbEnv.PEXELS_API_KEY ? { PEXELS_API_KEY: dbEnv.PEXELS_API_KEY } : {}),
      }
    },
    "design-bridge": {
      type: "stdio",
      command: "node",
      args: [path.join(repoDir, "design-bridge", "bridge.js")],
      env: {
        STITCH_API_KEY:       dbEnv.STITCH_API_KEY || '',
        GOOGLE_CLOUD_PROJECT: dbEnv.GOOGLE_CLOUD_PROJECT || '',
        STITCH_MODE:          dbEnv.STITCH_MODE || 'experimental',
        UNSPLASH_ACCESS_KEY:  dbEnv.UNSPLASH_ACCESS_KEY || '',
        PEXELS_API_KEY:       dbEnv.PEXELS_API_KEY || '',
        GOOGLE_FONTS_API_KEY: dbEnv.GOOGLE_FONTS_API_KEY || '',
        DEFAULT_THEME:        dbEnv.DEFAULT_THEME || 'auto',
        DEFAULT_DARK_MODE:    dbEnv.DEFAULT_DARK_MODE || 'false',
        USE_COLOR_API: 'true', USE_ICONIFY: 'true', USE_DICEBEAR: 'true',
        USE_JSON_PLACEHOLDER: 'true', USE_GOOGLE_FONTS: 'true', USE_PIXABAY: 'true',
      }
    }
  }
};

fs.mkdirSync(path.dirname(mcpPath), { recursive: true });
fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2));
console.log('   ✔ figma-intelligence-layer registered in .vscode/mcp.json');
console.log('   ✔ design-bridge registered in .vscode/mcp.json');
JSEOF2

# ─── Step 7: Install bridge relay as a macOS launch service ───────────────────
echo ""
echo "🔧 Installing bridge relay as a background service..."

PLIST_LABEL="com.figma-intelligence.bridge-relay"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/${PLIST_LABEL}.plist"
NODE_PATH="$(which node)"
LAUNCHD_PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
if [ -n "$CLAUDE_BIN_DIR" ]; then
  LAUNCHD_PATH="$CLAUDE_BIN_DIR:$LAUNCHD_PATH"
fi
if [ -n "$CODEX_BIN_DIR" ] && [ "$CODEX_BIN_DIR" != "$CLAUDE_BIN_DIR" ]; then
  LAUNCHD_PATH="$CODEX_BIN_DIR:$LAUNCHD_PATH"
fi
if [ -n "$GEMINI_BIN_DIR" ] && [ "$GEMINI_BIN_DIR" != "$CLAUDE_BIN_DIR" ] && [ "$GEMINI_BIN_DIR" != "$CODEX_BIN_DIR" ]; then
  LAUNCHD_PATH="$GEMINI_BIN_DIR:$LAUNCHD_PATH"
fi

mkdir -p "$PLIST_DIR"

# Stop any existing instance cleanly
launchctl unload "$PLIST_PATH" 2>/dev/null || true
pkill -f "bridge-relay.js" 2>/dev/null || true
lsof -ti :9001 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 0.5

# Write the LaunchAgent plist
# Store absolute CLI paths so the relay can refresh the currently logged-in
# Claude/Codex account even under launchd's minimal PATH.
cat > "$PLIST_PATH" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}</string>
        <string>${REPO_DIR}/figma-bridge-plugin/bridge-relay.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${REPO_DIR}/figma-bridge-plugin</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PATH</key>
        <string>${LAUNCHD_PATH}</string>
        <key>CLAUDE_BIN_PATH</key>
        <string>${CLAUDE_BIN}</string>
        <key>CODEX_BIN_PATH</key>
        <string>${CODEX_BIN}</string>
        <key>GEMINI_BIN_PATH</key>
        <string>${GEMINI_BIN}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOG_FILE}</string>
    <key>StandardErrorPath</key>
    <string>${LOG_FILE}</string>
</dict>
</plist>
PLISTEOF

launchctl load "$PLIST_PATH"
sleep 2

# Check if the process is actually running (PID column != "-")
RELAY_PID=$(launchctl list | awk "/$PLIST_LABEL/ {print \$1}")
if [ -n "$RELAY_PID" ] && [ "$RELAY_PID" != "-" ]; then
  echo "   ✔ Bridge relay service running (PID: $RELAY_PID)"
  echo "   ✔ Auto-starts on every login — no manual steps needed"
  echo "   📋 Logs: $LOG_FILE"
else
  echo "   ⚠ launchd service registered but not running — starting directly..."
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  cd "$REPO_DIR/figma-bridge-plugin"
  nohup env HOME="$HOME" PATH="$LAUNCHD_PATH" CLAUDE_BIN_PATH="$CLAUDE_BIN" CODEX_BIN_PATH="$CODEX_BIN" GEMINI_BIN_PATH="$GEMINI_BIN" node bridge-relay.js > "$LOG_FILE" 2>&1 &
  RELAY_PID=$!
  sleep 1
  if kill -0 "$RELAY_PID" 2>/dev/null; then
    echo "   ✔ Relay running in background (PID: $RELAY_PID)"
    echo "   📋 Logs: $LOG_FILE"
    echo "   ⚠  Note: relay will not auto-start after reboot — re-run setup.sh if needed"
  else
    echo "   ❌ Relay failed to start. Check: $LOG_FILE"
    exit 1
  fi
fi

# ─── Step 8: Install VS Code bridge extension ────────────────────────────────
echo ""
echo "🔧 Installing VS Code bridge extension (Design + Code dual output)..."

VSCODE_EXT_SRC="$REPO_DIR/vscode-chat-extension"
VSCODE_EXT_DEST="$HOME/.vscode/extensions/figma-intelligence-bridge-0.1.0"

if [ -d "$VSCODE_EXT_SRC/dist" ]; then
  rm -rf "$VSCODE_EXT_DEST"
  mkdir -p "$VSCODE_EXT_DEST"
  cp "$VSCODE_EXT_SRC/package.json" "$VSCODE_EXT_DEST/"
  cp -r "$VSCODE_EXT_SRC/dist" "$VSCODE_EXT_DEST/"
  cp -r "$VSCODE_EXT_SRC/media" "$VSCODE_EXT_DEST/"
  cp -r "$VSCODE_EXT_SRC/node_modules" "$VSCODE_EXT_DEST/"
  echo "   ✔ Extension installed to ~/.vscode/extensions/"
  echo "   ℹ  Restart VS Code to activate — then use 'Design + Code' mode in the Figma plugin"
else
  echo "   ⚠ VS Code extension build not found — skipping"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────────────"
echo "✅ Setup complete!"
echo ""
echo "One last step — load the plugin in Figma Desktop:"
echo ""
echo "  1. Open Figma Desktop"
echo "  2. Right-click on the canvas"
echo "     → Plugins → Development → Import plugin from manifest…"
echo "  3. Select this file:"
echo "     $REPO_DIR/figma-bridge-plugin/manifest.json"
echo "  4. Run the plugin:"
echo "     Plugins → Development → Figma Intelligence Bridge"
echo "  5. Click  ▶ Start  — you should see  ✅ Connected"
echo ""
echo "  Then restart VS Code, Claude Code, or Codex if you use MCP tools there."
echo ""
echo "Components registered:"
echo "   ✔ figma-intelligence-layer — reads/writes Figma files (MCP server)"
echo "   ✔ design-bridge — real photos, icons, palettes, Stitch AI layout${STITCH_API_KEY:+ (Stitch active)}"
echo "   ✔ VS Code bridge extension — receives generated code in 'Design + Code' mode"
echo ""
echo "AI provider setup summary:"
if [ "$CLAUDE_LOGGED_IN" = true ]; then
  echo "   ✔ Claude available${CLAUDE_AUTH_EMAIL:+ as $CLAUDE_AUTH_EMAIL}"
else
  echo "   - Claude not ready (run 'claude login')"
fi
if [ "$CODEX_LOGGED_IN" = true ]; then
  echo "   ✔ OpenAI Codex available${CODEX_AUTH_EMAIL:+ as $CODEX_AUTH_EMAIL}"
  echo "     Switching to OpenAI in the plugin reuses the running relay automatically."
else
  echo "   - OpenAI Codex not ready (run 'codex login')"
fi
if [ "$GEMINI_LOGGED_IN" = true ]; then
  echo "   ✔ Google Gemini available${GEMINI_AUTH_EMAIL:+ as $GEMINI_AUTH_EMAIL} (Google One AI Premium / subscription mode)"
  echo "     Switching to Gemini in the plugin reuses the running relay automatically — no API key needed."
elif [ -n "$GEMINI_BIN" ]; then
  echo "   - Gemini CLI installed but not logged in (run 'gemini' and sign in with Google)"
else
  echo "   - Gemini CLI not installed (npm install -g @google/gemini-cli)"
fi
echo "─────────────────────────────────────────────────────"
echo ""
echo "💡 The bridge relay runs automatically — no manual restarts needed."
echo "   To stop it:  launchctl unload ~/Library/LaunchAgents/com.figma-intelligence.bridge-relay.plist"
echo "   To restart:  launchctl unload ~/Library/LaunchAgents/com.figma-intelligence.bridge-relay.plist && launchctl load ~/Library/LaunchAgents/com.figma-intelligence.bridge-relay.plist"
echo ""
