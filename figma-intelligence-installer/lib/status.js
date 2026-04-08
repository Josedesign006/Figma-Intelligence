/**
 * status.js — Per-layer health check for Figma Intelligence
 *
 * Reports separate status for each layer:
 *   1. Relay process
 *   2. Relay endpoint (/health + /status)
 *   3. Figma plugin connection
 *   4. Cloud server
 *   5. Session/token configuration
 */

const https = require("https");
const http = require("http");
const { existsSync, readFileSync } = require("fs");
const { join } = require("path");
const { homedir } = require("os");

const CONFIG_DIR = join(homedir(), ".figma-intelligence");
const PID_PATH = join(CONFIG_DIR, "relay.pid");
const PORT_FILE = join(CONFIG_DIR, "relay.port");

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getActivePort() {
  try {
    if (existsSync(PORT_FILE)) {
      return parseInt(readFileSync(PORT_FILE, "utf8").trim(), 10) || 9001;
    }
  } catch {}
  return 9001;
}

function fetchJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Invalid JSON")); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

/**
 * Scan ports 9001-9010 for a live relay
 */
async function findRelayPort() {
  const preferredPort = getActivePort();
  // Try preferred port first
  try {
    const health = await fetchJson(`http://localhost:${preferredPort}/health`, 2000);
    if (health && health.ok) return preferredPort;
  } catch {}

  // Scan fallback range
  for (let port = 9001; port <= 9010; port++) {
    if (port === preferredPort) continue;
    try {
      const health = await fetchJson(`http://localhost:${port}/health`, 1000);
      if (health && health.ok) return port;
    } catch {}
  }
  return null;
}

async function checkStatus(config) {
  console.log("\n  Figma Intelligence — Status\n");

  // 1. Relay process (PID file)
  let relayPidRunning = false;
  let relayPid = null;
  if (existsSync(PID_PATH)) {
    relayPid = parseInt(readFileSync(PID_PATH, "utf8").trim(), 10);
    relayPidRunning = relayPid && isProcessRunning(relayPid);
  }

  // 2. Relay endpoint (find active relay via /health + /status)
  const relayPort = await findRelayPort();
  let relayStatus = null;
  if (relayPort) {
    try {
      relayStatus = await fetchJson(`http://localhost:${relayPort}/status`, 3000);
    } catch {}
  }

  // Display relay process
  if (relayPidRunning) {
    console.log(`  Relay process:  running (PID ${relayPid})`);
  } else if (relayPort) {
    console.log(`  Relay process:  running (discovered on port ${relayPort})`);
  } else {
    console.log("  Relay process:  not running");
  }

  // Display relay endpoint
  if (relayStatus) {
    const uptime = relayStatus.uptime ? `${Math.floor(relayStatus.uptime / 60)}m ${relayStatus.uptime % 60}s` : "unknown";
    console.log(`  Relay endpoint: healthy on port ${relayPort} (uptime: ${uptime})`);
  } else if (relayPort) {
    console.log(`  Relay endpoint: reachable on port ${relayPort} (status unavailable)`);
  } else {
    console.log("  Relay endpoint: unreachable");
  }

  // 3. Plugin connection
  if (relayStatus) {
    if (relayStatus.pluginConnected) {
      const fileName = relayStatus.pluginFileName ? ` — "${relayStatus.pluginFileName}"` : "";
      console.log(`  Plugin:         connected${fileName}`);
    } else {
      console.log("  Plugin:         not connected");
    }
    console.log(`  MCP clients:    ${relayStatus.mcpClientCount || 0}`);
  } else {
    console.log("  Plugin:         unknown (relay not reachable)");
  }

  // 4. Cloud server
  if (config.cloudUrl) {
    try {
      const health = await fetchJson(`${config.cloudUrl}/health`);
      console.log(`  Cloud server:   online (${health.activeSessions || 0} active sessions, uptime ${health.uptime || 0}s)`);
    } catch (err) {
      console.log(`  Cloud server:   unreachable (${err.message})`);
    }
  } else {
    console.log("  Cloud server:   not configured");
  }

  // 5. Configuration
  console.log(`  Session token:  ${config.sessionToken ? config.sessionToken.slice(0, 8) + "…" : "not set"}`);
  console.log(`  Figma token:    ${config.figmaAccessToken ? config.figmaAccessToken.slice(0, 8) + "…" : "not set"}`);

  // 6. Actionable next steps
  console.log();
  if (!relayPort) {
    console.log("  Action: Start the relay — npx figma-intelligence start");
  } else if (relayStatus && !relayStatus.pluginConnected) {
    console.log("  Action: Open Figma Desktop → Plugins → Development → Figma Intelligence Bridge");
  } else if (relayStatus && relayStatus.pluginConnected && (relayStatus.mcpClientCount || 0) === 0) {
    console.log("  Ready: Relay and plugin connected. MCP tools will connect on first use.");
  } else if (relayStatus && relayStatus.pluginConnected) {
    console.log("  Ready: All layers connected and healthy.");
  }

  console.log();
}

module.exports = { checkStatus };
