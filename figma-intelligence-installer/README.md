# Figma Intelligence

AI-powered design tools for Figma. 88 MCP tools that give your AI assistant (Claude, Cursor, VS Code) the ability to read, create, audit, and modify Figma designs.

---

## Quick Start

### Prerequisites

- **Node.js 18+** — [download here](https://nodejs.org/)
- **Figma Desktop** — [download here](https://www.figma.com/downloads/)
- **Figma Personal Access Token** — [generate here](https://www.figma.com/developers/api#access-tokens)

### Install

```bash
npx figma-intelligence@latest setup
```

This installs everything and registers MCP tools with Claude, Cursor, and VS Code automatically.

### Start

```bash
npx figma-intelligence@latest start
```

### Load the Figma plugin

1. Open **Figma Desktop** and open any design file
2. Go to **Plugins > Development > Import plugin from manifest**
3. Select `~/.figma-intelligence/plugin/manifest.json`
4. Run the plugin — you should see **Connected**

### Use it

Open your AI tool and try:

> "Audit this Figma page for accessibility issues"

> "Clone this screenshot into Figma using the design system"

> "Generate a React component from the selected Figma component"

---

## Commands

| Command | Description |
|---------|-------------|
| `npx figma-intelligence@latest setup` | Install and configure |
| `npx figma-intelligence@latest start` | Start the relay |
| `npx figma-intelligence@latest stop` | Stop the relay |
| `npx figma-intelligence@latest restart` | Stop, free ports, and restart |
| `npx figma-intelligence@latest status` | Check connection |

---

## How It Works

```
Your Machine                              Cloud
+-------------------+                    +------------------+
|  Figma Desktop    |                    |  88 MCP Tools    |
|  (plugin inside)  |                    |  (AI intelligence|
|        |          |                    |   runs here)     |
|        v          |    encrypted       |        ^         |
|  Local Relay  ----+----- tunnel -------+-> Tool Router    |
+-------------------+                    +------------------+
        ^
        |
  Claude / Cursor / VS Code
```

Your design files stay in Figma. No design data is stored on the server.

---

## Troubleshooting

**MCP shows "failed" in Claude Code / Cursor**
```bash
npx figma-intelligence@latest restart
```
Then reconnect the MCP in your AI tool (Claude Code: run `/mcp` → Reconnect).

**Relay won't start / "EADDRINUSE" error**

Port 9001 is stuck from a previous session. Fix it:
```bash
# Kill whatever is using port 9001 and restart
lsof -ti:9001 | xargs kill -9 2>/dev/null
npx figma-intelligence@latest restart
```

**Plugin shows "Bridge offline"**
- Click the **Reconnect** button in the plugin
- Or restart the relay: `npx figma-intelligence@latest restart`

**Plugin shows "Not logged in"**
- If you have Claude CLI installed, just run `claude login` in your terminal — the plugin will auto-detect it
- No need to click "Sign in" in the plugin

**MCP tools not showing in your AI tool**
- Restart Claude / Cursor / VS Code after running setup
- Check: `npx figma-intelligence@latest status`

**Nuclear reset (fixes everything)**
```bash
pkill -f bridge-relay 2>/dev/null
lsof -ti:9001 | xargs kill -9 2>/dev/null
rm -f ~/.figma-intelligence/relay.pid
npx figma-intelligence@latest setup
```

**Updating to latest version**
```bash
npx figma-intelligence@latest setup
```
Setup preserves your existing config and tokens.

---

## License

CC-BY-NC-ND-4.0
