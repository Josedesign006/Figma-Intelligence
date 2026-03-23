#!/usr/bin/env node
/**
 * gemini-runner.js — Streams a chat response from the Google Gemini API.
 * Emits the same event shape as chat-runner.js so bridge-relay can use either.
 */

const https = require("https");
const { EventEmitter } = require("events");
const { buildSystemPrompt, buildChatPrompt } = require("./shared-prompt-config");

// Map the plugin's Opus/Sonnet/Haiku tier names to Gemini model IDs
const MODEL_MAP = {
  opus:   "gemini-2.0-flash",
  sonnet: "gemini-2.0-flash",
  haiku:  "gemini-1.5-flash-8b",
  "gemini-2.0-flash": "gemini-2.0-flash",
  "gemini-1.5-flash-8b": "gemini-1.5-flash-8b",
};

function formatConversationHistory(conversation) {
  if (!Array.isArray(conversation) || !conversation.length) return "";
  const lines = conversation
    .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant") && entry.text)
    .map((entry) => `${entry.role === "assistant" ? "Assistant" : "User"}: ${entry.text}`);
  return lines.length ? `Conversation so far:\n${lines.join("\n\n")}\n\n---\n\n` : "";
}

/**
 * Spawn a Gemini streaming generate request.
 * Returns an EventEmitter-like object with a .kill() method.
 */
function runGemini({ message, attachments, conversation, requestId, apiKey, model, designSystemId, mode, onEvent }) {
  const emitter = new EventEmitter();

  // Process text attachments inline
  let extraText = "";
  for (const att of (attachments || [])) {
    if (!att?.data) continue;
    if (att.isImage) {
      const label = att.name || "image";
      extraText += `\n\n[Image attached: ${label}] (image analysis not available in this mode)`;
    } else {
      const label = att.name ? `\n\n--- Attached: ${att.name} ---\n` : "\n\n--- Attached file ---\n";
      extraText += label + att.data;
    }
  }

  const userText = (message || "").trim() || "Please help with the Figma design.";
  const historyText = formatConversationHistory(conversation);
  const fullMessage = historyText + userText + extraText;

  const geminiModel = MODEL_MAP[model] || "gemini-2.0-flash";

  const bodyObj = {
    system_instruction: { parts: [{ text: (mode || "code") === "chat" ? buildChatPrompt() : buildSystemPrompt(designSystemId) }] },
    contents: [{ role: "user", parts: [{ text: fullMessage }] }],
    generationConfig: { maxOutputTokens: 4096 },
  };
  const body = JSON.stringify(bodyObj);

  const path =
    `/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

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
        hostname: "generativelanguage.googleapis.com",
        path,
        method: "POST",
        headers: {
          "Content-Type":   "application/json",
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
            onEvent({ type: "error", id: requestId, error: `Gemini: ${msg}` });
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
            try {
              const parsed = JSON.parse(data);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                fullText += text;
                onEvent({ type: "text_delta", id: requestId, delta: text });
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
            onEvent({ type: "error", id: requestId, error: `Gemini stream error: ${err.message}` });
            onEvent({ type: "done",  id: requestId, fullText: "" });
          }
          emitter.emit("close", 1);
        });
      }
    );

    req.on("error", (err) => {
      if (!aborted) {
        onEvent({ type: "error", id: requestId, error: `Gemini connection error: ${err.message}` });
        onEvent({ type: "done",  id: requestId, fullText: "" });
      }
      emitter.emit("close", 1);
    });

    req.write(body);
    req.end();

  } catch (err) {
    onEvent({ type: "error", id: requestId, error: `Gemini error: ${err.message}` });
    onEvent({ type: "done",  id: requestId, fullText: "" });
    emitter.emit("close", 1);
  }

  emitter.kill = abort;
  return emitter;
}

module.exports = { runGemini };
