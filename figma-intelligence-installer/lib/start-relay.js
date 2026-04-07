/**
 * start-relay.js — Start/stop the compiled relay binary as a background process.
 */

const { spawn, execSync } = require("child_process");
const { existsSync, readFileSync, writeFileSync } = require("fs");
const { join } = require("path");
const { homedir } = require("os");

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
    process.kill(pid, 0); // signal 0 = just check existence
    return true;
  } catch {
    return false;
  }
}

/**
 * Free port 9001 (or the relay port) by killing whatever is using it.
 * This prevents EADDRINUSE crashes when restarting the relay.
 */
function freePort(port) {
  port = port || 9001;
  try {
    // macOS/Linux: find PID using the port and kill it
    const result = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: "utf8" }).trim();
    if (result) {
      const pids = result.split("\n").filter(Boolean);
      for (const pid of pids) {
        try {
          process.kill(parseInt(pid, 10), "SIGKILL");
        } catch {}
      }
      console.log(`  Freed port ${port} (killed stale process)`);
      // Brief pause to let OS release the port
      execSync("sleep 1", { stdio: "ignore" });
    }
  } catch {
    // No process on port, or lsof not available — that's fine
  }
}

async function startRelay() {
  const config = loadConfig();

  // Check if already running
  if (existsSync(PID_PATH)) {
    const pid = parseInt(readFileSync(PID_PATH, "utf8").trim(), 10);
    if (pid && isProcessRunning(pid)) {
      console.log(`  Relay already running (PID ${pid})`);
      return;
    }
    // Stale PID file — clean up
    try { require("fs").unlinkSync(PID_PATH); } catch {}
  }

  // Kill any stale bridge-relay processes and free the port
  try {
    execSync("pkill -f bridge-relay 2>/dev/null", { stdio: "ignore" });
  } catch {}
  freePort(9001);

  // Resolve relay source — prefer installed bundle, then package bundle
  const installedBundle = join(homedir(), ".figma-intelligence", "bridge-relay.bundle.js");
  const packageBundle = join(__dirname, "bridge-relay.bundle.js");

  const sourceToUse = existsSync(installedBundle) ? installedBundle
    : existsSync(packageBundle) ? packageBundle : null;
  const hasSource = !!sourceToUse;

  console.log("  Starting Figma Intelligence relay…");

  // Set env vars for the relay to use
  const env = {
    ...process.env,
    FIGMA_INTELLIGENCE_CLOUD_URL: config.cloudUrl,
    FIGMA_INTELLIGENCE_SESSION_TOKEN: config.sessionToken,
    FIGMA_ACCESS_TOKEN: config.figmaAccessToken || "",
  };

  // Always use Node.js to run the relay source — avoids macOS binary signing issues
  if (!hasSource) {
    throw new Error("Relay source not found. Run: npx figma-intelligence setup");
  }

  const child = spawn(process.execPath, [sourceToUse], {
    env,
    stdio: "ignore",
    detached: true,
  });

  child.unref();
  writeFileSync(PID_PATH, String(child.pid));

  // Wait briefly and verify the relay didn't crash on startup
  await new Promise((r) => setTimeout(r, 2000));
  if (!isProcessRunning(child.pid)) {
    try { require("fs").unlinkSync(PID_PATH); } catch {}
    console.error("  ⚠  Relay crashed on startup. Try: npx figma-intelligence restart");
    console.error("  Or run manually to see the error: node ~/.figma-intelligence/bridge-relay.bundle.js");
    return;
  }

  console.log(`  Relay started (PID ${child.pid})`);
  console.log(`  Local relay: ws://localhost:9001`);
  console.log(`  Cloud tunnel: ${config.cloudUrl}/tunnel`);
  console.log("\n  Open Figma Desktop and load the Intelligence Bridge plugin.");
}

async function stopRelay() {
  // Always try to kill any bridge-relay processes, even without PID file
  try {
    execSync("pkill -f bridge-relay 2>/dev/null", { stdio: "ignore" });
  } catch {}

  // Free the port in case something else grabbed it
  freePort(9001);

  if (!existsSync(PID_PATH)) {
    console.log("  Relay stopped.");
    return;
  }

  const pid = parseInt(readFileSync(PID_PATH, "utf8").trim(), 10);
  if (pid) {
    try {
      process.kill(pid, "SIGTERM");
      console.log(`  Relay stopped (PID ${pid})`);
    } catch (err) {
      if (err.code === "ESRCH") {
        console.log("  Relay stopped (stale PID cleaned up).");
      }
    }
  }

  // Clean up PID file
  try {
    require("fs").unlinkSync(PID_PATH);
  } catch {}
}

module.exports = { startRelay, stopRelay };
