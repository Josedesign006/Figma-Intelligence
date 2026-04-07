/**
 * start-relay.js — Start/stop the compiled relay as a background process.
 *
 * Designed for zero-friction: always kills stale processes, frees ports,
 * and starts fresh. Users never need to run kill commands manually.
 */

const { spawn, execSync } = require("child_process");
const { existsSync, readFileSync, writeFileSync, unlinkSync } = require("fs");
const { join } = require("path");
const { homedir, platform } = require("os");

const CONFIG_DIR = join(homedir(), ".figma-intelligence");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const PID_PATH = join(CONFIG_DIR, "relay.pid");

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error("Not set up yet. Run: figma-intelligence setup");
  }
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Kill ALL stale relay processes and free the port.
 * This is aggressive by design — we always want a clean start.
 */
function killAllRelays() {
  if (platform() === "win32") return;

  // 1. Kill by PID file
  try {
    if (existsSync(PID_PATH)) {
      const pid = parseInt(readFileSync(PID_PATH, "utf8").trim(), 10);
      if (pid && isProcessRunning(pid)) {
        try { process.kill(pid, "SIGKILL"); } catch {}
      }
      try { unlinkSync(PID_PATH); } catch {}
    }
  } catch {}

  // 2. Kill by process name (catches orphans)
  try {
    execSync("pkill -9 -f 'bridge-relay' 2>/dev/null || true", { stdio: "ignore", timeout: 5000 });
  } catch {}

  // 3. Kill by port (catches anything else holding 9001)
  try {
    const result = execSync("lsof -ti:9001 2>/dev/null", { encoding: "utf8", timeout: 5000 }).trim();
    if (result) {
      const pids = result.split("\n").filter(Boolean);
      for (const pid of pids) {
        try { process.kill(parseInt(pid, 10), "SIGKILL"); } catch {}
      }
    }
  } catch {}

  // Brief pause to let OS release the port
  try { execSync("sleep 0.5", { stdio: "ignore" }); } catch {}
}

async function startRelay({ forceRestart } = {}) {
  const config = loadConfig();

  // Check if already running with current version
  if (!forceRestart && existsSync(PID_PATH)) {
    const pid = parseInt(readFileSync(PID_PATH, "utf8").trim(), 10);
    if (pid && isProcessRunning(pid)) {
      console.log(`  Relay already running (PID ${pid})`);
      return;
    }
  }

  // Kill everything — clean slate
  killAllRelays();

  // Resolve relay source
  const installedBundle = join(CONFIG_DIR, "bridge-relay.bundle.js");
  const packageBundle = join(__dirname, "bridge-relay.bundle.js");
  const sourceToUse = existsSync(installedBundle) ? installedBundle
    : existsSync(packageBundle) ? packageBundle : null;

  if (!sourceToUse) {
    throw new Error("Relay source not found. Run: npx figma-intelligence setup");
  }

  console.log("  Starting Figma Intelligence relay…");

  const env = {
    ...process.env,
    FIGMA_INTELLIGENCE_CLOUD_URL: config.cloudUrl,
    FIGMA_INTELLIGENCE_SESSION_TOKEN: config.sessionToken,
    FIGMA_ACCESS_TOKEN: config.figmaAccessToken || "",
  };

  const child = spawn(process.execPath, [sourceToUse], {
    env,
    stdio: "ignore",
    detached: true,
  });

  child.unref();
  writeFileSync(PID_PATH, String(child.pid));

  // Wait and verify it didn't crash
  await new Promise((r) => setTimeout(r, 2000));
  if (!isProcessRunning(child.pid)) {
    try { unlinkSync(PID_PATH); } catch {}
    console.error("  ⚠  Relay crashed on startup.");
    console.error("  Run manually to see the error: node ~/.figma-intelligence/bridge-relay.bundle.js");
    return;
  }

  console.log(`  Relay started (PID ${child.pid})`);
  console.log(`  Local relay: ws://localhost:9001`);
}

async function stopRelay() {
  killAllRelays();
  console.log("  Relay stopped.");
}

module.exports = { startRelay, stopRelay };
