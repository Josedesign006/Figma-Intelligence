import { execFileSync } from "child_process";
import { resolve } from "path";

const SERVER_PATH = resolve(__dirname, "../dist/index.js");

function mcpCall(...messages: object[]): object[] {
  const input = messages.map((m) => JSON.stringify(m)).join("\n") + "\n";
  const raw = execFileSync("node", [SERVER_PATH], {
    input,
    timeout: 10_000,
    encoding: "utf-8",
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
  });
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const INIT_MSG = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "tool-test", version: "0.1" },
  },
};

const INITIALIZED_NOTIFICATION = {
  jsonrpc: "2.0",
  method: "notifications/initialized",
};

describe("figma_generate_image_and_insert tool metadata", () => {
  test("appears in the MCP tool list with expected schema", () => {
    const responses = mcpCall(
      INIT_MSG,
      INITIALIZED_NOTIFICATION,
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }
    );

    const toolList = responses.find((response: any) => response.id === 2) as any;
    const tool = toolList.result.tools.find((entry: any) => entry.name === "figma_generate_image_and_insert");

    expect(tool).toBeDefined();
    expect(tool.inputSchema.required).toContain("prompt");
    expect(tool.inputSchema.properties.provider.enum).toEqual(["gemini", "automatic1111", "comfyui"]);
  });
});
