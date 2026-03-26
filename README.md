# Figma Intelligence Layer

Connect **Claude**, **OpenAI Codex**, or **Google Gemini CLI** to **Figma Desktop** so you can chat directly inside Figma and have the AI actually build, edit, and modify your designs in real time.

```
You (chat in Figma plugin) ◄──► Bridge Relay ◄──► Claude / OpenAI Codex / Gemini CLI
```

---

## What does this do?

Think of it as having an AI design assistant living inside Figma. You can type something like *"Make a login screen with a blue button"* and the selected provider will actually create the components and layers in your Figma file, not just describe how to do it.

The bundled Figma MCP server exposes 64 tools, including high-level generation tools like `figma_page_architect`, `figma_intent_translator`, `figma_layout_intelligence`, `figma_design_from_ref`, `figma_generate_spec`, and direct editing and inspection tools.

---

## Before you start — what you need

You need Node.js, Figma Desktop, and at least one supported AI CLI on your computer. If you already have them, skip to Step 1.

### 1. Node.js (a programming tool that runs behind the scenes)

- Go to [nodejs.org](https://nodejs.org) and download the **LTS** version (the one labelled "Recommended for most users")
- Install it like any normal app (open the downloaded file, click Next/Install)
- To check it worked: open Terminal (Mac) or Command Prompt (Windows), type `node -v`, and press Enter — you should see a version number like `v20.0.0`

### 2. Figma Desktop app

- Download from [figma.com/downloads](https://www.figma.com/downloads/)
- This must be the **desktop app** — the browser version won't work

### 3. An AI tool

Install at least one of these — the setup will detect whichever you have:

| Tool | How to install |
|---|---|
| **Claude Code** | Download from claude.ai/download, sign in with `claude login` |
| **VS Code** (GitHub Copilot) | Download from code.visualstudio.com |
| **Cursor** | Download from cursor.com |
| **Windsurf** | Download from codeium.com/windsurf |
| **Zed** | Download from zed.dev |
| **Continue.dev** | Install the VS Code extension from continue.dev |
| **OpenAI Codex CLI** | `npm install -g @openai/codex`, then `codex login` |
| **Google Gemini CLI** | `npm install -g @google/gemini-cli`, then run `gemini` and complete Google sign-in |
| **Kiro** (AWS) | Download from kiro.dev |

If you install Claude, Codex, and Gemini CLI, `npm run setup` prepares all of them so provider switching does not require restarting the bridge.

### 4. A Figma Personal Access Token

This is like a password that lets the plugin read and edit your Figma files.

1. Open Figma Desktop
2. Click your profile photo (top-left)
3. Go to **Settings → Security**
4. Scroll down to **Personal access tokens** → click **Generate new token**
5. Give it any name (e.g. "Claude Plugin")
6. **Copy the token and save it somewhere** — you'll need it in Step 2 below and Figma only shows it once

---

## Setup (one-time, takes about 2 minutes)

### Step 1 — Open Terminal in the project folder

**On Mac:**
1. Open the **Terminal** app (search for it in Spotlight with Cmd+Space)
2. Type `cd ` (with a space after), then drag the project folder onto the Terminal window — this fills in the path automatically
3. Press Enter

**On Windows:**
1. Open the project folder in File Explorer
2. Click the address bar at the top, type `cmd`, press Enter

### Step 2 — Run the setup command

```bash
npm run setup
```

Type exactly that and press Enter. The setup will:
- Install everything needed (you'll see a lot of text scroll by — that's normal)
- Detect your Claude, Codex, and Gemini logins
- Prompt you to sign in to any installed provider that is not ready yet, so both subscriptions can be prepared in one pass
- Register the Figma MCP server for Claude, Codex, Gemini CLI, and VS Code
- If you choose OpenAI in the plugin later, it will use the account currently logged into `codex` without restarting `npm start`
- If you choose Gemini in the plugin later and Gemini CLI is authenticated, it will use Gemini CLI subscription mode with the same Figma MCP server
- Ask you to **paste your Figma token** — paste it and press Enter
- Start the background bridge that lets the plugin talk to Figma

> If it says "npm: command not found" — Node.js is not installed correctly. Go back and reinstall it from [nodejs.org](https://nodejs.org).

### Step 3 — Load the plugin into Figma

1. Open **Figma Desktop**
2. Open any file (or create a new one)
3. **Right-click** anywhere on the canvas (the blank white area)
4. In the menu that appears, go to: **Plugins → Development → Import plugin from manifest…**
5. A file picker opens — navigate to the project folder, then into the `figma-bridge-plugin` folder, and select **manifest.json**
6. Click **Open**

### Step 4 — Start the plugin

1. **Right-click** the canvas again
2. Go to **Plugins → Development → Figma Intelligence Bridge**
3. A panel will open — click **▶ Start**
4. You should see **✅ Connected** — you're all set!

### Step 5 — Connect any other AI tools (optional)

Already using Cursor, Windsurf, Zed, Continue.dev, or Kiro? Run:

```bash
npm run connect
```

It auto-detects which tools you have installed and registers the Figma MCP server with all of them in one go. You can also target a specific tool:

```bash
npm run connect -- --tool cursor
npm run connect -- --tool windsurf
npm run connect -- --tool zed
npm run connect -- --tool continue
npm run connect -- --tool vscode
npm run connect -- --tool kiro
npm run connect -- --tool codex
```

### Step 6 — Restart your AI tool

Restart VS Code, Cursor, Windsurf, Zed, or whichever tool you connected, so it picks up the new MCP server.

### Step 7 — Quick health check (recommended)

Run:

```bash
npm run status
```

This verifies relay socket state, plugin connection, MCP connection, build output, and token setup in one command.

If you use OpenAI provider and it reports missing Codex MCP registration, run:

```bash
npm run register:codex-mcp
```

If you plan to use Gemini subscription mode, verify that `gemini --version` works and that running `gemini` completes Google sign-in before you open the plugin.

---

## Using the chat

Once connected, the plugin panel has a chat box at the bottom. Just type what you want:

- *"Create a login screen with email and password fields"*
- *"Add a navigation bar with 4 menu items"*
- *"Design a card component with a photo, title, and a blue button"*
- *(Attach a screenshot)* *"Recreate this layout in Figma"*

To attach an image: click the **paperclip icon** next to the chat box.

### Three modes

The plugin has three tabs at the top:

| Tab | What it does |
|---|---|
| **Chat** | Ask questions — the AI answers but does not change your Figma file |
| **Code** | The AI builds and edits your Figma design directly using MCP tools |
| **Design + Code** | Same as Code, but also generates component source code (React/Vue/Svelte) and writes it to your VS Code workspace |

### Design + Code mode (dual output)

This is the most powerful mode. From a single prompt in Figma, the AI:

1. **Creates the component in Figma** — with proper auto layout, variants, properties, and design tokens
2. **Generates matching code** — component file, CSS module, and Storybook story
3. **Writes the code to your VS Code workspace** — files appear in `src/components/` automatically

The VS Code bridge extension (installed automatically by `npm run setup`) connects in the background. You'll see a status indicator in the Figma plugin showing whether VS Code is connected. If VS Code is not running, code output still appears in the Figma chat as text.

### Switching providers

Use the provider badge in the plugin header to switch between Claude, OpenAI, and Gemini.

- **Claude** uses the account logged into the Claude CLI
- **OpenAI** uses the account logged into `codex` at the time you switch
- **Gemini** uses the authenticated Gemini CLI account when available, otherwise it falls back to API key mode

Setup registers the same Figma MCP server for Claude, Codex, and Gemini CLI, so switching providers reuses the running bridge and MCP connection automatically.

The active provider will show its signed-in email in the auth strip when available.

## Gemini CLI workflow

If you want Gemini to use the real Figma MCP tools instead of API-key text mode, use Gemini CLI.

### 1. Install Gemini CLI

```bash
npm install -g @google/gemini-cli
```

### 2. Sign in with your Google account

Run either of these:

```bash
gemini
```

```bash
gemini auth login
```

That opens the Google browser OAuth flow. After it completes, re-run:

```bash
npm run setup
```

Setup writes the Figma MCP registration into `~/.gemini/settings.json`, so the Gemini CLI subprocess can call the same 64 Figma tools as Claude and Codex.

### 3. Use Gemini inside the plugin

1. Start the bridge with `npm start`
2. Open the Figma plugin
3. Choose the **Gemini** provider
4. Send a design request

When Gemini CLI auth is present, the relay uses Gemini CLI subscription mode. If Gemini CLI is not authenticated, the plugin falls back to Gemini API-key mode, which is lower fidelity and does not provide the same MCP-driven tool execution.

---

## Every time you restart your computer

If setup completed successfully on macOS, the bridge relay is installed as a background service and should start automatically after login.

If you ever need to start it manually:

1. Open Terminal in the project folder (same as Step 1 above)
2. Run:

```bash
npm start
```

3. Open Figma and click **▶ Start** in the plugin panel

4. Run:

```bash
npm run status
```

That's it — you're connected again.

---

## Troubleshooting

| What went wrong | How to fix it |
|---|---|
| **"npm: command not found"** | Node.js is not installed — download it from [nodejs.org](https://nodejs.org) |
| **Plugin shows "Disconnected"** | Run `npm start` in Terminal first, then click Start in the plugin |
| **Not sure what is broken** | Run `npm run status` for a one-command diagnostic and follow the printed next actions |
| **OpenAI provider can chat but cannot use Figma tools** | Run `npm run register:codex-mcp`, then `npm run status` |
| **Gemini appears to answer but does not build in Figma** | Install Gemini CLI with `npm install -g @google/gemini-cli`, run `gemini` to sign in, then re-run `npm run setup` |
| **Chat does nothing / no response** | Open Terminal and run `claude login` for Claude, `codex login` for OpenAI, or `gemini` for Gemini. Then switch providers once in the plugin or reconnect it — no `npm start` restart needed |
| **`unexpected argument '--approval-mode'` in plugin chat** | Your plugin is using an older Codex CLI invocation. Update to the latest repo version or patch `figma-bridge-plugin/codex-runner.js` to use `codex exec --json` instead of `--approval-mode` / `--quiet` |
| **"dist/index.js not found"** | Run `cd figma-intelligence-layer && npm run build` in Terminal |
| **Wrong Figma token / token expired** | Re-run `npm run setup` and paste your new token when asked |
| **MCP tools missing in VS Code / Cursor / Zed etc.** | Run `npm run connect` then restart the tool |
| **"Design + Code" shows "VS Code not connected"** | Restart VS Code after running `npm run setup` — the bridge extension loads on startup |
| **Port 9001 already in use** | `npm run setup` now handles this automatically — just run it again |

---

## Folder structure (for the curious)

```
setup.sh                         ← the one-command setup script (does everything)
figma-bridge-plugin/
  manifest.json                  ← import this file into Figma
  bridge-relay.js                ← background bridge (npm start runs this)
  chat-runner.js                 ← connects Claude to the plugin chat
  codex-runner.js                ← connects OpenAI Codex to the plugin chat
  gemini-cli-runner.js           ← connects Gemini CLI to the plugin chat
  shared-prompt-config.js        ← system prompts, design systems, dual output prompt
  ui.html / code.js              ← the plugin's visual panel (Chat / Code / Design+Code)
figma-intelligence-layer/
  src/                           ← source code for the AI tools
  dist/index.js                  ← built/compiled version (created by setup)
vscode-chat-extension/           ← VS Code bridge extension (auto-installed by setup)
  src/extension.ts               ← background service that writes code files
  src/dual-output.ts             ← parses code output from AI responses
  src/code-generator.ts          ← writes component files to workspace
  src/preview-server.ts          ← Storybook live preview manager
```
