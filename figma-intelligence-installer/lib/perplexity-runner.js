#!/usr/bin/env node
/**
 * perplexity-runner.js — Streams a chat response from the Perplexity API.
 * Emits the same event shape as chat-runner.js so bridge-relay can use either.
 *
 * Perplexity is a research-only provider (chat mode only, no Figma tool execution).
 */

const https = require("https");
const { EventEmitter } = require("events");

// Perplexity model IDs — all are search-grounded
const MODEL_MAP = {
  "sonar":               "sonar",
  "sonar-pro":           "sonar-pro",
  "sonar-reasoning":     "sonar-reasoning",
  "sonar-reasoning-pro": "sonar-reasoning-pro",
};

const SYSTEM_PROMPT = `You are a research assistant embedded in a Figma design plugin. Help users research design patterns, UI/UX best practices, accessibility guidelines, competitive analysis, typography, color theory, design systems, and any other topics. Provide thorough, well-sourced answers. Be concise but comprehensive.`;

/**
 * Convert the plugin's conversation array to OpenAI-format messages.
 */
function buildMessages(systemPrompt, conversation, userMessage) {
  const messages = [{ role: "system", content: systemPrompt }];

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
 * Spawn a Perplexity streaming chat request.
 * Returns an EventEmitter-like object with a .kill() method.
 */
function runPerplexity({ message, attachments, conversation, requestId, apiKey, model, onEvent }) {
  const emitter = new EventEmitter();

  // Process text attachments inline
  let extraText = "";
  for (const att of (attachments || [])) {
    if (!att?.data) continue;
    if (att.isImage) {
      const label = att.name || "image";
      extraText += `\n\n[Image attached: ${label}] (image analysis not available with Perplexity)`;
    } else {
      const label = att.name ? `\n\n--- Attached: ${att.name} ---\n` : "\n\n--- Attached file ---\n";
      extraText += label + att.data;
    }
  }

  const userText = ((message || "").trim() || "Help me with my research.") + extraText;
  const resolvedModel = MODEL_MAP[model] || "sonar-pro";
  const messages = buildMessages(SYSTEM_PROMPT, conversation, userText);

  const bodyObj = {
    model: resolvedModel,
    stream: true,
    messages,
  };
  const body = JSON.stringify(bodyObj);

  let aborted = false;
  let req = null;

  // Emit phase indicator
  onEvent({ type: "phase_start", id: requestId, phase: `Researching · ${resolvedModel}` });

  function abort() {
    aborted = true;
    if (req) { try { req.destroy(); } catch {} }
    emitter.emit("close", null);
  }

  try {
    req = https.request(
      {
        hostname: "api.perplexity.ai",
        path: "/chat/completions",
        method: "POST",
        headers: {
          "Content-Type":   "application/json",
          "Authorization":  `Bearer ${apiKey}`,
          "Content-Length":  Buffer.byteLength(body),
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          let errBody = "";
          res.on("data", (d) => { errBody += d.toString(); });
          res.on("end", () => {
            let msg = errBody;
            try { msg = JSON.parse(errBody).error?.message || errBody; } catch {}
            onEvent({ type: "error", id: requestId, error: `Perplexity: ${msg}` });
            onEvent({ type: "done",  id: requestId, fullText: "" });
            emitter.emit("close", 1);
          });
          return;
        }

        let buffer = "";
        let fullText = "";
        let previousText = "";
        let citations = null;

        res.on("data", (chunk) => {
          if (aborted) return;
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();

            // OpenAI-compatible sentinel
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              // Extract citations if present (usually in the final chunk)
              if (parsed.citations && Array.isArray(parsed.citations)) {
                citations = parsed.citations;
              }

              // Perplexity sends cumulative content — diff to get delta
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                onEvent({ type: "text_delta", id: requestId, delta: content });
              }
            } catch {}
          }
        });

        res.on("end", () => {
          if (!aborted) {
            // Emit citations if present
            if (citations && citations.length > 0) {
              onEvent({ type: "citations", id: requestId, urls: citations });
            }
            onEvent({ type: "done", id: requestId, fullText });
          }
          emitter.emit("close", 0);
        });

        res.on("error", (err) => {
          if (!aborted) {
            onEvent({ type: "error", id: requestId, error: `Perplexity stream error: ${err.message}` });
            onEvent({ type: "done",  id: requestId, fullText: "" });
          }
          emitter.emit("close", 1);
        });
      }
    );

    req.on("error", (err) => {
      if (!aborted) {
        onEvent({ type: "error", id: requestId, error: `Perplexity connection error: ${err.message}` });
        onEvent({ type: "done",  id: requestId, fullText: "" });
      }
      emitter.emit("close", 1);
    });

    req.write(body);
    req.end();

  } catch (err) {
    onEvent({ type: "error", id: requestId, error: `Perplexity error: ${err.message}` });
    onEvent({ type: "done",  id: requestId, fullText: "" });
    emitter.emit("close", 1);
  }

  emitter.kill = abort;
  return emitter;
}

module.exports = { runPerplexity };
