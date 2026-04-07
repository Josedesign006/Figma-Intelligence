#!/usr/bin/env node
/**
 * anthropic-chat-runner.js — Streams a chat response from the Anthropic Messages API.
 * Emits the same event shape as chat-runner.js / perplexity-runner.js so bridge-relay
 * can use any runner interchangeably.
 *
 * Used for Chat mode only — eliminates Claude CLI subprocess overhead for ~200ms first-token.
 * Code and Dual modes still use chat-runner.js (Claude CLI) for MCP tool execution.
 */

const https = require("https");
const { EventEmitter } = require("events");

// Valid Anthropic model IDs (same as chat-runner.js)
const VALID_MODELS = new Set([
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
]);
const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Convert the plugin's conversation array to Anthropic Messages API format.
 * Anthropic uses { role: "user"|"assistant", content: string } — system is separate.
 */
function buildMessages(conversation, userMessage) {
  const messages = [];

  if (Array.isArray(conversation)) {
    for (const entry of conversation) {
      if (!entry || !entry.text) continue;
      if (entry.role === "user" || entry.role === "assistant") {
        messages.push({ role: entry.role, content: entry.text });
      }
    }
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

/**
 * Stream a chat response from the Anthropic Messages API.
 * Returns an EventEmitter-like object with a .kill() method.
 */
function runAnthropicChat({ message, attachments, conversation, requestId, apiKey, model, systemPrompt, onEvent }) {
  const emitter = new EventEmitter();

  // Process text attachments inline (images not supported in text-only chat)
  let extraText = "";
  for (const att of (attachments || [])) {
    if (!att?.data) continue;
    if (att.isImage) {
      const label = att.name || "image";
      extraText += `\n\n[Image attached: ${label}]`;
    } else {
      const label = att.name ? `\n\n--- Attached: ${att.name} ---\n` : "\n\n--- Attached file ---\n";
      extraText += label + att.data;
    }
  }

  const userText = ((message || "").trim() || "Hello") + extraText;
  const resolvedModel = VALID_MODELS.has(model) ? model : DEFAULT_MODEL;
  const messages = buildMessages(conversation, userText);

  const bodyObj = {
    model: resolvedModel,
    max_tokens: 4096,
    stream: true,
    messages,
  };

  // Add system prompt if provided
  if (systemPrompt) {
    bodyObj.system = systemPrompt;
  }

  const body = JSON.stringify(bodyObj);

  let aborted = false;
  let req = null;

  // Emit phase indicator
  onEvent({ type: "phase_start", id: requestId, phase: `Chat · ${resolvedModel}` });

  function abort() {
    aborted = true;
    if (req) { try { req.destroy(); } catch {} }
    emitter.emit("close", null);
  }

  try {
    req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          let errBody = "";
          res.on("data", (d) => { errBody += d.toString(); });
          res.on("end", () => {
            let msg = errBody;
            try { msg = JSON.parse(errBody).error?.message || errBody; } catch {}
            onEvent({ type: "error", id: requestId, error: `Anthropic API: ${msg}` });
            onEvent({ type: "done", id: requestId, fullText: "" });
            emitter.emit("close", 1);
          });
          return;
        }

        let buffer = "";
        let fullText = "";

        res.on("data", (chunk) => {
          if (aborted) return;
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            // Anthropic SSE format: "event: <type>\ndata: <json>"
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              // Handle different Anthropic SSE event types
              if (parsed.type === "content_block_delta") {
                const text = parsed.delta?.text;
                if (text) {
                  fullText += text;
                  onEvent({ type: "text_delta", id: requestId, delta: text });
                }
              } else if (parsed.type === "message_stop") {
                // Stream complete — handled by res.on("end")
              } else if (parsed.type === "error") {
                const errMsg = parsed.error?.message || "Unknown streaming error";
                onEvent({ type: "error", id: requestId, error: `Anthropic: ${errMsg}` });
              }
            } catch {}
          }
        });

        res.on("end", () => {
          if (!aborted) {
            onEvent({ type: "done", id: requestId, fullText });
          }
          emitter.emit("close", 0);
        });

        res.on("error", (err) => {
          if (!aborted) {
            onEvent({ type: "error", id: requestId, error: `Anthropic stream error: ${err.message}` });
            onEvent({ type: "done", id: requestId, fullText: "" });
          }
          emitter.emit("close", 1);
        });
      }
    );

    req.on("error", (err) => {
      if (!aborted) {
        onEvent({ type: "error", id: requestId, error: `Anthropic connection error: ${err.message}` });
        onEvent({ type: "done", id: requestId, fullText: "" });
      }
      emitter.emit("close", 1);
    });

    req.write(body);
    req.end();

  } catch (err) {
    onEvent({ type: "error", id: requestId, error: `Anthropic error: ${err.message}` });
    onEvent({ type: "done", id: requestId, fullText: "" });
    emitter.emit("close", 1);
  }

  emitter.kill = abort;
  return emitter;
}

module.exports = { runAnthropicChat };
