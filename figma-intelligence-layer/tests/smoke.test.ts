/**
 * Smoke tests for figma-intelligence-layer MCP server.
 * Validates: server startup, tool count, tool listing, and tool call dispatch.
 *
 * Run: npx jest tests/smoke.test.ts
 */

import { execFileSync } from "child_process";
import { resolve } from "path";

const SERVER_PATH = resolve(__dirname, "../dist/index.js");

/** Send JSON-RPC messages via stdin and return parsed stdout lines */
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
    clientInfo: { name: "smoke-test", version: "0.1" },
  },
};

const INITIALIZED_NOTIFICATION = {
  jsonrpc: "2.0",
  method: "notifications/initialized",
};

const LIST_TOOLS_MSG = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {},
};

const EXPECTED_TOOL_NAMES = [
  "figma_screen_cloner",
  "figma_visual_audit",
  "figma_a11y_audit",
  "figma_sketch_to_design",
  "figma_design_from_ref",
  "figma_intent_translator",
  "figma_layout_intelligence",
  "figma_variant_expander",
  "figma_theme_generator",
  "figma_lint_rules",
  "figma_component_audit",
  "figma_component_archaeologist",
  "figma_page_architect",
  "figma_generate_image_and_insert",
  "figma_unsplash_search",
  "figma_url_to_frame",
  "figma_system_drift",
  "figma_prototype_map",
  "figma_animation_specifier",
  "figma_sync_from_code",
  "figma_webhook_listener",
  "figma_design_system_scaffolder",
  "figma_design_system_primitives",
  "figma_design_system_variables",
  "figma_token_naming_convention",
  "figma_token_migrate",
  "figma_decision_log",
  "figma_health_report",
  "figma_generate_spec",
  "figma_apg_doc",
  "figma_execute",
  "figma_get_status",
  "figma_navigate",
  "figma_get_selection",
  "figma_take_screenshot",
  "figma_get_node",
  "figma_create_variable_collection",
  "figma_create_variable",
  "figma_update_variable",
  "figma_delete_variable",
  "figma_rename_variable",
  "figma_delete_variable_collection",
  "figma_add_mode",
  "figma_rename_mode",
  "figma_batch_create_variables",
  "figma_batch_update_variables",
  "figma_get_variables",
  "figma_clone_node",
  "figma_delete_node",
  "figma_move_node",
  "figma_resize_node",
  "figma_rename_node",
  "figma_set_fills",
  "figma_set_strokes",
  "figma_set_text",
  "figma_search_components",
  "figma_instantiate_component",
  "figma_set_description",
  "figma_get_styles",
  "figma_create_child",
  "figma_get_pages",
  "figma_create_page",
];

describe("MCP Server Smoke Tests", () => {
  test("server initializes and returns correct protocol version", () => {
    const [initResp] = mcpCall(INIT_MSG);
    expect(initResp).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "figma-intelligence-layer",
          version: "1.0.0",
        },
        capabilities: { tools: {} },
      },
    });
  });

  test("lists the full current toolset", () => {
    const responses = mcpCall(INIT_MSG, INITIALIZED_NOTIFICATION, LIST_TOOLS_MSG);
    const toolsResp = responses.find((r: any) => r.id === 2) as any;
    expect(toolsResp.result.tools).toHaveLength(EXPECTED_TOOL_NAMES.length);
  });

  test("all expected tool names are present", () => {
    const responses = mcpCall(INIT_MSG, INITIALIZED_NOTIFICATION, LIST_TOOLS_MSG);
    const toolsResp = responses.find((r: any) => r.id === 2) as any;
    const names: string[] = toolsResp.result.tools.map((t: any) => t.name);

    expect(names).toHaveLength(EXPECTED_TOOL_NAMES.length);

    for (const tool of EXPECTED_TOOL_NAMES) {
      expect(names).toContain(tool);
    }
  });

  test("every tool has inputSchema with type=object", () => {
    const responses = mcpCall(INIT_MSG, INITIALIZED_NOTIFICATION, LIST_TOOLS_MSG);
    const toolsResp = responses.find((r: any) => r.id === 2) as any;

    for (const tool of toolsResp.result.tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  test("calling an unknown tool returns an error", () => {
    const callMsg = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "nonexistent_tool", arguments: {} },
    };
    const responses = mcpCall(INIT_MSG, INITIALIZED_NOTIFICATION, callMsg);
    const callResp = responses.find((r: any) => r.id === 3) as any;
    expect(callResp.result.isError).toBe(true);
    expect(callResp.result.content[0].text).toContain("Unknown tool");
  });
});
