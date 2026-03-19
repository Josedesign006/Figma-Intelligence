# Figma Intelligence Bridge Plugin

WebSocket bridge that connects the **figma-intelligence-layer** MCP server to the **Figma Desktop App**.

## Architecture

```
┌────────────────────────┐      ┌──────────────────┐      ┌─────────────────────┐
│  MCP Server            │      │  Bridge Relay     │      │  Figma Desktop      │
│  (figma-bridge.ts)     │◄────►│  (bridge-relay.js)│◄────►│  Plugin (code.js)   │
│  WS client :9001       │      │  WS server :9001  │      │  via ui.html        │
└────────────────────────┘      └──────────────────┘      └─────────────────────┘
```

## Setup (3 steps)

### Step 1: Start the relay server

```bash
cd figma-bridge-plugin
node bridge-relay.js
```

You'll see:
```
🔌 Figma Intelligence Bridge Relay
   Listening on ws://localhost:9001
   Waiting for connections…
```

### Step 2: Install the Figma plugin

1. Open **Figma Desktop** app
2. Right-click on the canvas → **Plugins** → **Development** → **Import plugin from manifest…**
3. Browse to this folder and select `manifest.json`
4. The plugin appears under **Plugins → Development → Figma Intelligence Bridge**

### Step 3: Run the plugin and connect

1. In Figma: **Plugins → Development → Figma Intelligence Bridge**
2. The plugin UI shows a **Start** button — click it
3. The relay terminal should show:
   ```
   ✅ Figma plugin connected
   ```

Now start the MCP server (in another terminal):

```bash
cd ../figma-intelligence-layer
npm run build && npm run start
```

The relay should also show:
```
✅ MCP server connected
```

## Testing the Connection

### Quick ping test

In a separate terminal:
```bash
echo '{"id":"test1","method":"ping","params":{}}' | websocat ws://localhost:9001
```

Expected response:
```json
{"id":"test1","result":{"status":"ok","fileName":"Your File Name","pageCount":3,"timestamp":...}}
```

### Via MCP protocol (full integration)

```bash
cd ../figma-intelligence-layer
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"figma_decision_log","arguments":{"action":"export","exportFormat":"json"}}}
' | node dist/index.js
```

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Figma plugin manifest |
| `code.js` | Plugin sandbox — runs Figma API commands |
| `ui.html` | Plugin UI — WebSocket client + status display |
| `bridge-relay.js` | Local Node.js WebSocket relay server |

## Custom Port

```bash
node bridge-relay.js 9002
# Then set FIGMA_BRIDGE_PORT=9002 when starting the MCP server
```
