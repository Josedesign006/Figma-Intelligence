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
const PORT_FILE = join(CONFIG_DIR, "relay.port");
const VERSION_FILE = join(CONFIG_DIR, "installed-version");
const CURRENT_VERSION = require("../package.json").version;

function installedVersionIsStale() {
  try {
    if (existsSync(VERSION_FILE)) {
      const installed = readFileSync(VERSION_FILE, "utf8").trim();
      return installed !== CURRENT_VERSION;
    }
  } catch {}
  return true; // No version file = stale
}

function getActivePort() {
  try {
    if (existsSync(PORT_FILE)) {
      return parseInt(readFileSync(PORT_FILE, "utf8").trim(), 10) || 9001;
    }
  } catch {}
  return 9001;
}

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

  // 2. Kill by process name (pgrep + filter so we never kill ourselves)
  try {
    const raw = execSync("pgrep -f 'bridge-relay' 2>/dev/null || true", { encoding: "utf8", timeout: 5000 }).trim();
    if (raw) {
      const pids = raw.split("\n").filter(p => p && parseInt(p) !== process.pid);
      for (const pid of pids) {
        try { process.kill(parseInt(pid, 10), "SIGKILL"); } catch {}
      }
    }
  } catch {}

  // 3. Kill by port (read actual port from relay.port file, fallback to 9001)
  try {
    const activePort = getActivePort();
    const result = execSync(`lsof -ti:${activePort} 2>/dev/null`, { encoding: "utf8", timeout: 5000 }).trim();
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

const PLIST_LABEL = "com.figma-intelligence.bridge-relay";
const PLIST_PATH = join(homedir(), "Library", "LaunchAgents", `${PLIST_LABEL}.plist`);

function hasLaunchdService() {
  return platform() === "darwin" && existsSync(PLIST_PATH);
}

async function startRelay({ forceRestart } = {}) {
  const config = loadConfig();

  // If installed bundles are stale (different version), force-copy fresh ones
  if (installedVersionIsStale()) {
    console.log(`  Installed bundles are stale — updating to v${CURRENT_VERSION}…`);
    const { copyFileSync, mkdirSync } = require("fs");
    mkdirSync(CONFIG_DIR, { recursive: true });
    const filesToUpdate = ["bridge-relay.bundle.js", "mcp-server.bundle.js", "mcp-stdio-proxy.js"];
    for (const file of filesToUpdate) {
      const src = join(__dirname, file);
      const dest = join(CONFIG_DIR, file);
      if (existsSync(src)) {
        try { copyFileSync(src, dest); } catch {}
      }
    }
    try { writeFileSync(VERSION_FILE, CURRENT_VERSION); } catch {}
    forceRestart = true; // Force restart with new bundles
  }

  // On macOS with launchd service installed, use launchctl
  if (hasLaunchdService()) {
    if (forceRestart) {
      try { execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`, { stdio: "ignore", timeout: 5000 }); } catch {}
      killAllRelays();
      try { execSync(`launchctl load "${PLIST_PATH}"`, { stdio: "ignore", timeout: 10000 }); } catch {}
    } else {
      // Check if already running via launchctl
      try {
        const listOutput = execSync(`launchctl list 2>/dev/null | grep "${PLIST_LABEL}" || true`, {
          encoding: "utf8", timeout: 5000
        }).trim();
        const pid = listOutput ? listOutput.split(/\s+/)[0] : "-";
        if (pid && pid !== "-" && pid !== "0") {
          console.log(`  Relay already running via launchd (PID ${pid})`);
          return;
        }
      } catch {}
      try { execSync(`launchctl load "${PLIST_PATH}"`, { stdio: "ignore", timeout: 10000 }); } catch {}
    }

    // Wait and verify
    await new Promise((r) => setTimeout(r, 2000));
    console.log(`  Relay started via launchd`);
    console.log(`  Local relay: ws://localhost:${getActivePort()}`);
    return;
  }

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
  console.log(`  Local relay: ws://localhost:${getActivePort()}`);
}

async function stopRelay() {
  // Stop launchd service if it exists
  if (hasLaunchdService()) {
    try { execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`, { stdio: "ignore", timeout: 5000 }); } catch {}
  }
  killAllRelays();
  console.log("  Relay stopped.");
}

module.exports = { startRelay, stopRelay };
