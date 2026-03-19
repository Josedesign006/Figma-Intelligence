#!/usr/bin/env node
/**
 * openai-runner.js — Streams a chat response from the OpenAI API.
 * Emits the same event shape as chat-runner.js so bridge-relay can use either.
 */

const https = require("https");
const { EventEmitter } = require("events");

const SYSTEM_PROMPT =
  "You are an AI design assistant embedded inside a Figma plugin. " +
  "You help users create, modify, and improve their Figma designs through natural conversation. " +
  "Be direct and concise. Describe design decisions clearly so users can implement them in Figma.";

// Map the plugin's Opus/Sonnet/Haiku tier names to OpenAI model IDs
const MODEL_MAP = {
  opus:   "gpt-4o",
  sonnet: "gpt-4o-mini",
  haiku:  "gpt-4o-mini",
};

/**
 * Spawn an OpenAI streaming chat completion.
 * Returns an EventEmitter-like object (with a .kill() method) so the relay
 * can store it and abort it with the same interface it uses for child processes.
 */
function runOpenAI({ message, attachments, requestId, apiKey, model, onEvent }) {
  const emitter = new EventEmitter();

  // Process text attachments inline; note images (no vision in this tier)
  let extraText = "";
  for (const att of (attachments || [])) {
    if (!att?.data) continue;
    if (att.isImage) {
      const label = att.name || "image";
      extraText += `\n\n[Image attached: ${label}] (image analysis not available with OpenAI in this mode)`;
    } else {
      const label = att.name ? `\n\n--- Attached: ${att.name} ---\n` : "\n\n--- Attached file ---\n";
      extraText += label + att.data;
    }
  }

  const userText = (message || "").trim() || "Please help with the Figma design.";
  const fullMessage = userText + extraText;

  const openAIModel = MODEL_MAP[model] || "gpt-4o";

  const bodyObj = {
    model: openAIModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: fullMessage },
    ],
    stream: true,
    max_tokens: 4096,
  };
  const body = JSON.stringify(bodyObj);

  let aborted = false;
  let req = null;

  function abort() {
    aborted = true;
    if (req) { try { req.destroy(); } catch {} }
    emitter.emit("close", null);
  }

  try {
    req = https.request(
      {
        hostname: "api.openai.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        // Non-200: collect error body and report
        if (res.statusCode !== 200) {
          let errBody = "";
          res.on("data", (d) => { errBody += d.toString(); });
          res.on("end", () => {
            let msg = errBody;
            try { msg = JSON.parse(errBody).error?.message || errBody; } catch {}
            onEvent({ type: "error", id: requestId, error: `OpenAI: ${msg}` });
            onEvent({ type: "done",  id: requestId, fullText: "" });
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
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                onEvent({ type: "text_delta", id: requestId, delta });
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
            onEvent({ type: "error", id: requestId, error: `OpenAI stream error: ${err.message}` });
            onEvent({ type: "done",  id: requestId, fullText: "" });
          }
          emitter.emit("close", 1);
        });
      }
    );

    req.on("error", (err) => {
      if (!aborted) {
        onEvent({ type: "error", id: requestId, error: `OpenAI connection error: ${err.message}` });
        onEvent({ type: "done",  id: requestId, fullText: "" });
      }
      emitter.emit("close", 1);
    });

    req.write(body);
    req.end();

  } catch (err) {
    onEvent({ type: "error", id: requestId, error: `OpenAI error: ${err.message}` });
    onEvent({ type: "done",  id: requestId, fullText: "" });
    emitter.emit("close", 1);
  }

  emitter.kill = abort;
  return emitter;
}

module.exports = { runOpenAI };
