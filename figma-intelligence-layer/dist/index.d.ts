#!/usr/bin/env node
/**
 * figma-intelligence-layer — MCP Server
 * 28 tools across 5 phases for pixel-accurate, bidirectional, context-aware AI ↔ Design collaboration.
 *
 * Architecture:
 *   Claude Desktop / Claude Code
 *     ↓  MCP protocol (stdio)
 *   This MCP server (figma-intelligence-layer)
 *     ↓  WebSocket
 *   Figma Desktop Bridge Plugin
 *     ↓  Plugin API
 *   Figma Electron App
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
export declare function createMcpServer(): Server<{
    method: string;
    params?: {
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
            progressToken?: string | number | undefined;
            "io.modelcontextprotocol/related-task"?: {
                taskId: string;
            } | undefined;
        } | undefined;
    } | undefined;
}, {
    method: string;
    params?: {
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
            progressToken?: string | number | undefined;
            "io.modelcontextprotocol/related-task"?: {
                taskId: string;
            } | undefined;
        } | undefined;
    } | undefined;
}, {
    [x: string]: unknown;
    _meta?: {
        [x: string]: unknown;
        progressToken?: string | number | undefined;
        "io.modelcontextprotocol/related-task"?: {
            taskId: string;
        } | undefined;
    } | undefined;
}>;
//# sourceMappingURL=index.d.ts.map