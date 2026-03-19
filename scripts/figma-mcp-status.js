#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const PORT = parseInt(process.argv[2] || process.env.BRIDGE_PORT || "9001", 10);
const BUILD_PATH = path.join(ROOT_DIR, "figma-intelligence-layer", "dist", "index.js");
const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");

const STATUS = {
  OK: "[OK]",
  WARN: "[WARN]",
  ERR: "[ERR]",
  INFO: "[INFO]",
};

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    ...options,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    error: result.error || null,
  };
}

function commandExists(cmd) {
  const result = run("sh", ["-lc", `command -v ${cmd}`]);
  return result.ok;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function maskToken(token) {
  if (!token) return "(missing)";
  if (token.length <= 8) return "***";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function parseLsof(port) {
  if (!commandExists("lsof")) {
    return { available: false, sockets: [] };
  }

  const output = run("lsof", ["-n", "-P", `-iTCP:${port}`, "-FpcnT"]);
  if (!output.ok && output.status !== 1) {
    return { available: true, sockets: [], error: output.stderr || "lsof failed" };
  }

  const lines = output.stdout ? output.stdout.split(/\r?\n/) : [];
  const sockets = [];
  let currentPid = "";
  let currentCmd = "";
  let currentName = "";

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("p")) {
      currentPid = line.slice(1).trim();
      continue;
    }
    if (line.startsWith("c")) {
      currentCmd = line.slice(1).trim();
      continue;
    }
    if (line.startsWith("n")) {
      currentName = line.slice(1).trim();
      continue;
    }
    if (line.startsWith("TST=")) {
      const state = line.slice(4).trim();
      if (currentPid && currentName) {
        sockets.push({
          pid: currentPid,
          command: currentCmd,
          name: currentName,
          state,
        });
      }
      currentName = "";
    }
  }

  return { available: true, sockets };
}

function getProcessCommand(pid) {
  const output = run("ps", ["-p", String(pid), "-o", "command="]);
  return output.ok ? output.stdout : "";
}

function isLoopbackTargetToRelay(name, port) {
  return name.includes("->") && name.endsWith(`:${port}`);
}

function classifyClientProcess(cmd, shortCommand) {
  const text = `${shortCommand || ""} ${cmd || ""}`;
  if (/figma/i.test(text)) return "plugin";
  if (/figma-intelligence-layer[\/\\]dist[\/\\]index\.js/i.test(text)) return "mcp";
  if (/figma-intelligence-layer[\/\\]src[\/\\]index\.ts/i.test(text)) return "mcp";
  return "other";
}

function checkRelaySockets(port) {
  const parsed = parseLsof(port);
  if (!parsed.available) {
    return {
      available: false,
      relayListening: false,
      pluginConnected: false,
      mcpConnected: false,
      relayPid: null,
      details: [],
      error: "lsof is not available on this system",
    };
  }

  const sockets = parsed.sockets;
  const listener = sockets.find(
    (s) =>
      s.state === "LISTEN" &&
      (s.name === `*:${port}` || s.name.endsWith(`:${port}`))
  );

  const relayPid = listener ? listener.pid : null;
  const establishedClients = sockets.filter(
    (s) => s.state === "ESTABLISHED" && isLoopbackTargetToRelay(s.name, port)
  );

  const clientDetails = [];
  for (const client of establishedClients) {
    const commandLine = getProcessCommand(client.pid);
    const kind = classifyClientProcess(commandLine, client.command);
    clientDetails.push({
      pid: client.pid,
      command: client.command,
      commandLine,
      kind,
      socket: client.name,
    });
  }

  return {
    available: true,
    relayListening: Boolean(listener),
    pluginConnected: clientDetails.some((c) => c.kind === "plugin"),
    mcpConnected: clientDetails.some((c) => c.kind === "mcp"),
    relayPid,
    details: clientDetails,
    error: parsed.error || null,
  };
}

function checkTokenAndProvider() {
  if (!fs.existsSync(CLAUDE_SETTINGS_PATH)) {
    return {
      settingsFound: false,
      tokenPresent: false,
      tokenMasked: "(missing)",
      provider: "unknown",
      claudeMcpRegistered: false,
    };
  }

  const settings = readJson(CLAUDE_SETTINGS_PATH) || {};
  const token =
    settings?.mcpServers?.["figma-intelligence-layer"]?.env?.FIGMA_ACCESS_TOKEN || "";
  const provider = settings?.figmaIntelligenceProvider?.provider || "claude";
  const claudeMcpRegistered = Boolean(settings?.mcpServers?.["figma-intelligence-layer"]);

  return {
    settingsFound: true,
    tokenPresent: Boolean(token),
    tokenMasked: maskToken(token),
    provider,
    claudeMcpRegistered,
  };
}

function checkCodexMcpRegistration() {
  if (!commandExists("codex")) {
    return { codexInstalled: false, codexMcpRegistered: false, raw: "" };
  }
  const list = run("codex", ["mcp", "list"]);
  const raw = [list.stdout, list.stderr].filter(Boolean).join("\n");
  const codexMcpRegistered = /figma-intelligence-layer/i.test(raw);
  return { codexInstalled: true, codexMcpRegistered, raw };
}

function checkMcpProcessRunning() {
  const result = run("pgrep", ["-fal", "figma-intelligence-layer/(dist/index.js|src/index.ts)"]);
  if (!result.ok) return { running: false, lines: [] };
  const lines = result.stdout ? result.stdout.split(/\r?\n/).filter(Boolean) : [];
  return { running: lines.length > 0, lines };
}

function printSummaryLine(level, label, value) {
  console.log(`${level} ${label}: ${value}`);
}

function main() {
  console.log("Figma MCP Status");
  console.log(`Workspace: ${ROOT_DIR}`);
  console.log(`Port: ${PORT}`);
  console.log("");

  const sockets = checkRelaySockets(PORT);
  const tokenInfo = checkTokenAndProvider();
  const codexInfo = checkCodexMcpRegistration();
  const mcpProcess = checkMcpProcessRunning();
  const buildExists = fs.existsSync(BUILD_PATH);

  printSummaryLine(
    sockets.relayListening ? STATUS.OK : STATUS.ERR,
    "Bridge relay",
    sockets.relayListening
      ? `UP on ws://localhost:${PORT}${sockets.relayPid ? ` (pid ${sockets.relayPid})` : ""}`
      : `DOWN on ws://localhost:${PORT}`
  );

  printSummaryLine(
    sockets.pluginConnected ? STATUS.OK : STATUS.WARN,
    "Figma plugin socket",
    sockets.pluginConnected ? "CONNECTED" : "NOT CONNECTED"
  );

  printSummaryLine(
    sockets.mcpConnected ? STATUS.OK : STATUS.WARN,
    "MCP socket",
    sockets.mcpConnected ? "CONNECTED" : "NOT CONNECTED"
  );

  printSummaryLine(
    buildExists ? STATUS.OK : STATUS.ERR,
    "MCP build",
    buildExists ? `FOUND (${BUILD_PATH})` : `MISSING (${BUILD_PATH})`
  );

  printSummaryLine(
    tokenInfo.tokenPresent ? STATUS.OK : STATUS.WARN,
    "FIGMA_ACCESS_TOKEN",
    tokenInfo.tokenPresent ? `SET (${tokenInfo.tokenMasked})` : "NOT SET"
  );

  printSummaryLine(
    tokenInfo.settingsFound ? STATUS.OK : STATUS.WARN,
    "Claude settings",
    tokenInfo.settingsFound
      ? `${CLAUDE_SETTINGS_PATH}`
      : `Not found at ${CLAUDE_SETTINGS_PATH}`
  );

  printSummaryLine(STATUS.INFO, "Plugin provider", tokenInfo.provider);
  printSummaryLine(
    tokenInfo.claudeMcpRegistered ? STATUS.OK : STATUS.WARN,
    "Claude MCP registration",
    tokenInfo.claudeMcpRegistered ? "figma-intelligence-layer present" : "missing"
  );

  if (!codexInfo.codexInstalled) {
    printSummaryLine(STATUS.WARN, "Codex CLI", "not installed");
  } else {
    printSummaryLine(
      codexInfo.codexMcpRegistered ? STATUS.OK : STATUS.WARN,
      "Codex MCP registration",
      codexInfo.codexMcpRegistered ? "figma-intelligence-layer present" : "missing"
    );
  }

  printSummaryLine(
    mcpProcess.running ? STATUS.OK : STATUS.WARN,
    "MCP process",
    mcpProcess.running ? "running" : "not detected"
  );

  if (sockets.details.length > 0) {
    console.log("");
    console.log("Active clients to relay:");
    for (const d of sockets.details) {
      console.log(`- pid ${d.pid} (${d.command}) [${d.kind}] ${d.socket}`);
    }
  }

  if (sockets.error) {
    console.log("");
    printSummaryLine(STATUS.WARN, "Socket inspection", sockets.error);
  }

  const providerNeedsCodex = tokenInfo.provider === "openai";
  const providerNeedsClaude = tokenInfo.provider === "claude";
  const providerConfigReady =
    (!providerNeedsCodex || codexInfo.codexMcpRegistered) &&
    (!providerNeedsClaude || tokenInfo.claudeMcpRegistered);

  const coreReady =
    sockets.relayListening &&
    sockets.pluginConnected &&
    buildExists &&
    tokenInfo.tokenPresent;

  const isReady = coreReady && providerConfigReady;

  console.log("");
  if (isReady) {
    console.log(`${STATUS.OK} Ready: relay, plugin, token, and provider configuration are healthy.`);
    if (!sockets.mcpConnected) {
      console.log(`${STATUS.INFO} MCP socket is currently idle. This is normal unless an MCP request is active.`);
    }
    process.exit(0);
  }

  console.log(`${STATUS.WARN} Not fully ready. Next actions:`);
  if (!buildExists) {
    console.log("- Build MCP server: `cd figma-intelligence-layer && npm run build`");
  }
  if (!sockets.relayListening) {
    console.log("- Start relay: `npm start`");
  }
  if (!tokenInfo.tokenPresent) {
    console.log("- Configure token: `npm run setup` and paste a fresh Figma Personal Access Token");
  }
  if (sockets.relayListening && !sockets.pluginConnected) {
    console.log("- In Figma Desktop: Plugins > Development > Figma Intelligence Bridge > Start");
  }
  if (!coreReady && sockets.relayListening && !sockets.mcpConnected) {
    console.log("- Keep relay in foreground (`npm start`) and check for `[mcp]` errors in logs");
  }
  if (tokenInfo.provider === "openai" && codexInfo.codexInstalled && !codexInfo.codexMcpRegistered) {
    console.log("- Register Codex MCP: `npm run register:codex-mcp`");
  }

  process.exit(1);
}

main();
