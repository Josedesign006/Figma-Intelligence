#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const BUILD_PATH = path.join(ROOT_DIR, "figma-intelligence-layer", "dist", "index.js");
const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const MCP_NAME = "figma-intelligence-layer";

function getRelayPort() {
  try {
    const p = fs.readFileSync(path.join(os.homedir(), ".figma-intelligence", "relay.port"), "utf8").trim();
    const n = parseInt(p, 10);
    if (n > 0 && n < 65536) return String(n);
  } catch {}
  return "9001";
}

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
  return run("sh", ["-lc", `command -v ${cmd}`]).ok;
}

function readTokenFromClaudeSettings() {
  if (!fs.existsSync(CLAUDE_SETTINGS_PATH)) return "";
  try {
    const settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, "utf8"));
    return settings?.mcpServers?.[MCP_NAME]?.env?.FIGMA_ACCESS_TOKEN || "";
  } catch {
    return "";
  }
}

function main() {
  if (!commandExists("codex")) {
    console.error("[ERR] Codex CLI not found. Install with: npm install -g @openai/codex");
    process.exit(1);
  }

  if (!fs.existsSync(BUILD_PATH)) {
    console.error(`[ERR] MCP build is missing at ${BUILD_PATH}`);
    console.error("Run: cd figma-intelligence-layer && npm run build");
    process.exit(1);
  }

  const token = readTokenFromClaudeSettings();
  if (!token) {
    console.error("[ERR] FIGMA_ACCESS_TOKEN not found in ~/.claude/settings.json");
    console.error("Run: npm run setup");
    process.exit(1);
  }

  run("codex", ["mcp", "remove", MCP_NAME]);

  const add = run("codex", [
    "mcp",
    "add",
    MCP_NAME,
    "--env",
    `FIGMA_ACCESS_TOKEN=${token}`,
    "--env",
    `FIGMA_BRIDGE_PORT=${getRelayPort()}`,
    "--env",
    "ENABLE_DECISION_LOG=true",
    "--",
    "node",
    BUILD_PATH,
  ]);

  if (!add.ok) {
    console.error("[ERR] Failed to register MCP server in Codex.");
    if (add.stderr) console.error(add.stderr);
    if (add.stdout) console.error(add.stdout);
    process.exit(1);
  }

  const list = run("codex", ["mcp", "list"]);
  const registered = /figma-intelligence-layer/i.test(`${list.stdout}\n${list.stderr}`);
  if (!registered) {
    console.error("[ERR] Codex command completed, but MCP server is still not listed.");
    process.exit(1);
  }

  console.log("[OK] Registered figma-intelligence-layer in Codex MCP config.");
  console.log("Next: run `npm run status` to confirm full connectivity.");
}

main();
