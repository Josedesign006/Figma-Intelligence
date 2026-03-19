"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateImageAndInsertHandler = generateImageAndInsertHandler;
const promises_1 = __importDefault(require("fs/promises"));
const child_process_1 = require("child_process");
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";
const DEFAULT_AUTOMATIC1111_BASE_URL = process.env.AUTOMATIC1111_BASE_URL?.trim() || "http://127.0.0.1:7860";
const DEFAULT_COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL?.trim() || "http://127.0.0.1:8188";
const DEFAULT_COMFYUI_TIMEOUT_MS = Number(process.env.COMFYUI_TIMEOUT_MS || "180000");
const DEFAULT_COMFYUI_STARTUP_TIMEOUT_MS = Number(process.env.COMFYUI_STARTUP_TIMEOUT_MS || "90000");
const DEFAULT_COMFYUI_AUTO_START = (process.env.COMFYUI_AUTO_START || "true").toLowerCase() !== "false";
function getGeminiApiKey() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set. Add a Gemini API key to enable image generation.");
    }
    return apiKey;
}
function getComfyUiWorkflowPath() {
    const workflowPath = process.env.COMFYUI_WORKFLOW_PATH?.trim();
    if (!workflowPath) {
        throw new Error("COMFYUI_WORKFLOW_PATH is not set. Export a ComfyUI workflow in API format and point this env var to that JSON file.");
    }
    return workflowPath;
}
function getComfyUiLaunchCommand() {
    return process.env.COMFYUI_LAUNCH_CMD?.trim() || "";
}
function normalizePrompt(prompt, style) {
    const cleanPrompt = prompt.trim();
    const cleanStyle = style?.trim();
    if (!cleanPrompt) {
        throw new Error("generateImageAndInsert: prompt is required");
    }
    if (!cleanStyle)
        return cleanPrompt;
    return `${cleanPrompt}\n\nVisual style: ${cleanStyle}`;
}
function extractImagePart(payload) {
    const candidates = payload
        ?.candidates;
    const parts = candidates?.[0]?.content?.parts ?? [];
    const textParts = [];
    for (const part of parts) {
        if (typeof part?.text === "string" && part.text.trim()) {
            textParts.push(part.text.trim());
        }
        const inlineData = part?.inlineData ?? part?.inline_data;
        if (inlineData?.data) {
            const normalizedMimeType = "mimeType" in inlineData
                ? inlineData.mimeType
                : "mime_type" in inlineData
                    ? inlineData.mime_type
                    : undefined;
            return {
                mimeType: normalizedMimeType || "image/png",
                data: inlineData.data,
                textParts,
            };
        }
    }
    throw new Error("Gemini image generation returned no image data.");
}
async function generateGeminiImage(prompt, style) {
    const apiKey = getGeminiApiKey();
    const fullPrompt = normalizePrompt(prompt, style);
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(DEFAULT_MODEL)}:generateContent`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [{ text: fullPrompt }],
                },
            ],
            generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
            },
        }),
    });
    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Gemini image generation failed (${response.status}): ${body || response.statusText}`);
    }
    const payload = await response.json();
    const { mimeType, data, textParts } = extractImagePart(payload);
    return {
        mimeType,
        dataUri: `data:${mimeType};base64,${data}`,
        model: DEFAULT_MODEL,
        providerNotes: textParts.join("\n").trim() || undefined,
    };
}
async function generateAutomatic1111Image(prompt, style, width, height) {
    const fullPrompt = normalizePrompt(prompt, style);
    const targetWidth = sanitizeDimension(width, 1024);
    const targetHeight = sanitizeDimension(height, 1024);
    const url = `${DEFAULT_AUTOMATIC1111_BASE_URL.replace(/\/$/, "")}/sdapi/v1/txt2img`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            prompt: fullPrompt,
            width: targetWidth,
            height: targetHeight,
            steps: 20,
            cfg_scale: 7,
            sampler_name: "Euler a",
        }),
    });
    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`AUTOMATIC1111 image generation failed (${response.status}): ${body || response.statusText}`);
    }
    const payload = (await response.json());
    const base64 = Array.isArray(payload.images) ? payload.images[0] : undefined;
    if (!base64) {
        throw new Error("AUTOMATIC1111 returned no image data.");
    }
    const normalizedBase64 = base64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    return {
        mimeType: "image/png",
        dataUri: `data:image/png;base64,${normalizedBase64}`,
        model: "automatic1111-local",
        providerNotes: typeof payload.info === "string" ? payload.info : undefined,
    };
}
function replacePlaceholders(value, replacements) {
    if (Array.isArray(value)) {
        return value.map((entry) => replacePlaceholders(entry, replacements));
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replacePlaceholders(entry, replacements)]));
    }
    if (typeof value !== "string") {
        return value;
    }
    if (Object.prototype.hasOwnProperty.call(replacements, value)) {
        return replacements[value];
    }
    let replaced = value;
    for (const [token, tokenValue] of Object.entries(replacements)) {
        replaced = replaced.split(token).join(String(tokenValue));
    }
    return replaced;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function isComfyUiReachable(baseUrl) {
    try {
        const response = await fetch(`${baseUrl}/history`);
        return response.ok || response.status === 404;
    }
    catch {
        return false;
    }
}
function startComfyUiDetached(launchCommand) {
    const child = (0, child_process_1.spawn)(launchCommand, {
        shell: true,
        detached: true,
        stdio: "ignore",
        env: process.env,
    });
    child.unref();
}
async function ensureComfyUiAvailable(baseUrl) {
    if (await isComfyUiReachable(baseUrl)) {
        return;
    }
    if (!DEFAULT_COMFYUI_AUTO_START) {
        throw new Error(`ComfyUI is not reachable at ${baseUrl}. Start it locally or enable COMFYUI_AUTO_START.`);
    }
    const launchCommand = getComfyUiLaunchCommand();
    if (!launchCommand) {
        throw new Error(`ComfyUI is not reachable at ${baseUrl}, and COMFYUI_LAUNCH_CMD is not configured for auto-start.`);
    }
    startComfyUiDetached(launchCommand);
    const deadline = Date.now() + DEFAULT_COMFYUI_STARTUP_TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (await isComfyUiReachable(baseUrl)) {
            return;
        }
        await sleep(1500);
    }
    throw new Error(`ComfyUI did not become ready within ${DEFAULT_COMFYUI_STARTUP_TIMEOUT_MS}ms after auto-start.`);
}
async function generateComfyUiImage(prompt, style, width, height) {
    const workflowPath = getComfyUiWorkflowPath();
    const workflowRaw = await promises_1.default.readFile(workflowPath, "utf8");
    const workflowJson = JSON.parse(workflowRaw);
    const graph = (workflowJson.prompt && typeof workflowJson.prompt === "object"
        ? workflowJson.prompt
        : workflowJson);
    const fullPrompt = normalizePrompt(prompt, style);
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const targetWidth = sanitizeDimension(width, 1024);
    const targetHeight = sanitizeDimension(height, 1024);
    const baseUrl = DEFAULT_COMFYUI_BASE_URL.replace(/\/$/, "");
    const clientId = `figma-intelligence-layer-${Date.now()}`;
    await ensureComfyUiAvailable(baseUrl);
    const hydratedGraph = replacePlaceholders(graph, {
        "__PROMPT__": fullPrompt,
        "__STYLE__": style?.trim() || "",
        "__NEGATIVE_PROMPT__": "",
        "__WIDTH__": targetWidth,
        "__HEIGHT__": targetHeight,
        "__SEED__": seed,
    });
    const queueResponse = await fetch(`${baseUrl}/prompt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            prompt: hydratedGraph,
            client_id: clientId,
        }),
    });
    if (!queueResponse.ok) {
        const body = await queueResponse.text().catch(() => "");
        throw new Error(`ComfyUI prompt submission failed (${queueResponse.status}): ${body || queueResponse.statusText}`);
    }
    const queuePayload = (await queueResponse.json());
    const promptId = queuePayload.prompt_id;
    if (!promptId) {
        throw new Error("ComfyUI did not return a prompt_id.");
    }
    const deadline = Date.now() + DEFAULT_COMFYUI_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const historyResponse = await fetch(`${baseUrl}/history/${encodeURIComponent(promptId)}`);
        if (!historyResponse.ok) {
            const body = await historyResponse.text().catch(() => "");
            throw new Error(`ComfyUI history lookup failed (${historyResponse.status}): ${body || historyResponse.statusText}`);
        }
        const historyPayload = (await historyResponse.json());
        const promptHistory = historyPayload[promptId];
        const outputs = promptHistory?.outputs ? Object.values(promptHistory.outputs) : [];
        for (const output of outputs) {
            const image = output.images?.[0];
            if (!image?.filename)
                continue;
            const imageUrl = new URL(`${baseUrl}/view`);
            imageUrl.searchParams.set("filename", image.filename);
            imageUrl.searchParams.set("subfolder", image.subfolder || "");
            imageUrl.searchParams.set("type", image.type || "output");
            const imageResponse = await fetch(imageUrl.toString());
            if (!imageResponse.ok) {
                const body = await imageResponse.text().catch(() => "");
                throw new Error(`ComfyUI image fetch failed (${imageResponse.status}): ${body || imageResponse.statusText}`);
            }
            const mimeType = imageResponse.headers.get("content-type") || "image/png";
            const buffer = Buffer.from(await imageResponse.arrayBuffer());
            return {
                mimeType,
                dataUri: `data:${mimeType};base64,${buffer.toString("base64")}`,
                model: "comfyui-local",
                providerNotes: `prompt_id=${promptId}; workflow=${workflowPath}; seed=${seed}`,
            };
        }
        await sleep(1000);
    }
    throw new Error(`ComfyUI timed out after ${DEFAULT_COMFYUI_TIMEOUT_MS}ms waiting for generated images.`);
}
function sanitizeDimension(value, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return fallback;
    }
    return Math.round(value);
}
async function placeImageInFigma(args) {
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    const width = sanitizeDimension(args.width, 1024);
    const height = sanitizeDimension(args.height, 1024);
    const execution = await bridge.execute(`
    const targetNodeId = ${JSON.stringify(args.targetNodeId ?? "")};
    const imageHash = ${JSON.stringify(args.imageHash)};
    const prompt = ${JSON.stringify(args.prompt)};
    const mimeType = ${JSON.stringify(args.mimeType)};
    const model = ${JSON.stringify(args.model)};
    const width = ${width};
    const height = ${height};

    async function resolvePlacementTarget() {
      if (targetNodeId) {
        const target = await figma.getNodeByIdAsync(targetNodeId);
        if (target) return { target, mode: "target-node" };
      }
      return { target: figma.currentPage, mode: "current-page" };
    }

    const targetInfo = await resolvePlacementTarget();
    let node = targetInfo.target;
    let placementMode = "created-rectangle";

    if ("fills" in node) {
      placementMode = targetInfo.mode === "target-node" ? "filled-target-node" : "filled-current-page";
    } else if ("appendChild" in node) {
      const rect = figma.createRectangle();
      rect.resize(width, height);
      rect.name = "AI Generated Image";
      rect.x = 0;
      rect.y = 0;
      node.appendChild(rect);
      node = rect;
    } else {
      const rect = figma.createRectangle();
      rect.resize(width, height);
      rect.name = "AI Generated Image";
      figma.currentPage.appendChild(rect);
      node = rect;
    }

    if ("resize" in node && targetInfo.mode !== "target-node") {
      node.resize(width, height);
    }

    if (!("fills" in node)) {
      throw new Error("Resolved placement node does not support image fills.");
    }

    node.fills = [{
      type: "IMAGE",
      imageHash,
      scaleMode: "FILL",
    }];

    if ("name" in node && (!node.name || node.name === "Rectangle")) {
      node.name = "AI Generated Image";
    }

    if ("setPluginData" in node) {
      node.setPluginData("aiImagePrompt", prompt);
      node.setPluginData("aiImageMimeType", mimeType);
      node.setPluginData("aiImageModel", model);
      node.setPluginData("aiImageCreatedAt", String(Date.now()));
    }

    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);

    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      placementMode,
      width: "width" in node ? node.width : width,
      height: "height" in node ? node.height : height,
      pageId: figma.currentPage.id,
      pageName: figma.currentPage.name,
    };
  `);
    if (!execution.success) {
        throw new Error(execution.error);
    }
    return execution.result;
}
async function generateImageAndInsertHandler(rawArgs) {
    const prompt = rawArgs.prompt?.trim();
    if (!prompt) {
        throw new Error("generateImageAndInsert: prompt is required");
    }
    const provider = rawArgs.provider ?? "gemini";
    let generated;
    if (provider === "gemini") {
        generated = await generateGeminiImage(prompt, rawArgs.style);
    }
    else if (provider === "automatic1111") {
        generated = await generateAutomatic1111Image(prompt, rawArgs.style, rawArgs.width, rawArgs.height);
    }
    else if (provider === "comfyui") {
        generated = await generateComfyUiImage(prompt, rawArgs.style, rawArgs.width, rawArgs.height);
    }
    else {
        throw new Error(`Unsupported provider: ${provider}`);
    }
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    const imported = await bridge.importImage(generated.dataUri);
    const placement = await placeImageInFigma({
        imageHash: imported.imageHash,
        prompt,
        mimeType: generated.mimeType,
        model: generated.model,
        width: rawArgs.width,
        height: rawArgs.height,
        targetNodeId: rawArgs.targetNodeId,
    });
    return {
        provider,
        model: generated.model,
        prompt,
        style: rawArgs.style?.trim() || undefined,
        mimeType: generated.mimeType,
        byteLength: imported.byteLength,
        imageHash: imported.imageHash,
        placement,
        providerNotes: generated.providerNotes,
    };
}
//# sourceMappingURL=index.js.map