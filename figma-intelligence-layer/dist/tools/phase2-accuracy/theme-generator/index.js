"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Theme Generator
// Derives a new Figma variable mode from an existing source mode by applying
// one of four transformation strategies (dark, high-contrast, brand-shift,
// custom).  All generated colors are checked against a configurable WCAG
// target before being written back to Figma.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.themeGeneratorHandler = themeGeneratorHandler;
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
const token_utils_js_1 = require("../../../shared/token-utils.js");
const font_config_js_1 = require("../../../shared/font-config.js");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function tokenValueToHex(value) {
    if (typeof value === "string") {
        // Handle "#rrggbb" or "rgb(r,g,b)" or Figma RGBA object strings
        if (value.startsWith("#"))
            return value;
        const rgbMatch = value.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            const [, r, g, b] = rgbMatch.map(Number);
            return (0, token_utils_js_1.figmaRgbaToHex)(r / 255, g / 255, b / 255);
        }
    }
    if (typeof value === "object" && value !== null) {
        // Figma RGBA object: { r: 0-1, g: 0-1, b: 0-1, a: 0-1 }
        const v = value;
        if ("r" in v && "g" in v && "b" in v) {
            return (0, token_utils_js_1.figmaRgbaToHex)(v.r, v.g, v.b);
        }
    }
    return null;
}
function generateBrandShiftColor(sourceHex, _tokenName, brandDirection) {
    const rgb = (0, token_utils_js_1.hexToRgb)(sourceHex);
    if (!rgb)
        return sourceHex;
    // Convert RGB to HSL
    const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max - min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }
    // Apply brand direction heuristics
    const dir = brandDirection.toLowerCase();
    let newH = h, newS = s, newL = l;
    if (dir.includes("warm") || dir.includes("approachable"))
        newH = (h + 0.04) % 1;
    else if (dir.includes("cool") || dir.includes("professional"))
        newH = (h - 0.04 + 1) % 1;
    if (dir.includes("bold") || dir.includes("vibrant"))
        newS = Math.min(1, s * 1.25);
    if (dir.includes("muted") || dir.includes("soft"))
        newS = s * 0.75;
    if (dir.includes("light") || dir.includes("bright"))
        newL = Math.min(0.95, l * 1.15);
    if (dir.includes("dark") || dir.includes("deep"))
        newL = Math.max(0.05, l * 0.85);
    // HSL → RGB → Hex
    const hue2rgb = (p, q, t) => {
        if (t < 0)
            t += 1;
        if (t > 1)
            t -= 1;
        if (t < 1 / 6)
            return p + (q - p) * 6 * t;
        if (t < 1 / 2)
            return q;
        if (t < 2 / 3)
            return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    let nr, ng, nb;
    if (newS === 0) {
        nr = ng = nb = newL;
    }
    else {
        const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
        const p = 2 * newL - q;
        nr = hue2rgb(p, q, newH + 1 / 3);
        ng = hue2rgb(p, q, newH);
        nb = hue2rgb(p, q, newH - 1 / 3);
    }
    const toHex = (c) => Math.round(c * 255).toString(16).padStart(2, "0");
    return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}
function getSourceModeValue(token, sourceMode) {
    if (token.modeValues && token.modeValues[sourceMode] !== undefined) {
        return token.modeValues[sourceMode];
    }
    // Fallback to default value
    return token.value;
}
function buildCreateModeScript(collectionId, modeName) {
    return `
    (async () => {
      const collection = figma.variables.getVariableCollectionById(${JSON.stringify(collectionId)});
      if (!collection) throw new Error('Collection not found: ${collectionId}');
      const modeId = collection.addMode(${JSON.stringify(modeName)});
      return { modeId, collectionId: collection.id };
    })()
  `.trim();
}
function buildSetVariableValueScript(variableId, modeId, hexColor) {
    const rgb = (0, token_utils_js_1.hexToRgb)(hexColor);
    const r = rgb ? rgb.r / 255 : 0;
    const g = rgb ? rgb.g / 255 : 0;
    const b = rgb ? rgb.b / 255 : 0;
    return `
    (async () => {
      const variable = await figma.variables.getVariableByIdAsync(${JSON.stringify(variableId)});
      if (!variable) throw new Error('Variable not found: ${variableId}');
      variable.setValueForMode(${JSON.stringify(modeId)}, { r: ${r}, g: ${g}, b: ${b}, a: 1 });
      return { success: true };
    })()
  `.trim();
}
function buildPreviewFrameScript(newModeName, colorDeltas, fontConfig) {
    const swatchEntries = colorDeltas.slice(0, 12).map((d) => ({
        name: d.tokenName,
        before: d.sourceModeValue,
        after: d.generatedValue,
    }));
    return `
    (async () => {
      const page = figma.currentPage;
      const frame = figma.createFrame();
      frame.name = 'Theme Preview — ${newModeName}';
      frame.layoutMode = 'VERTICAL';
      frame.primaryAxisSizingMode = 'AUTO';
      frame.counterAxisSizingMode = 'AUTO';
      frame.paddingLeft = 24;
      frame.paddingRight = 24;
      frame.paddingTop = 24;
      frame.paddingBottom = 24;
      frame.itemSpacing = 8;
      frame.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.96 } }];

      const swatches = ${JSON.stringify(swatchEntries)};
      for (const s of swatches) {
        const row = figma.createFrame();
        row.layoutMode = 'HORIZONTAL';
        row.primaryAxisSizingMode = 'AUTO';
        row.counterAxisSizingMode = 'AUTO';
        row.itemSpacing = 12;
        row.fills = [];

        const hexToRgb = (hex) => {
          const r = parseInt(hex.slice(1,3),16)/255;
          const g = parseInt(hex.slice(3,5),16)/255;
          const b = parseInt(hex.slice(5,7),16)/255;
          return { r, g, b };
        };

        const beforeSwatch = figma.createRectangle();
        beforeSwatch.resize(40, 40);
        beforeSwatch.fills = [{ type: 'SOLID', color: hexToRgb(s.before.replace(/^#?/, '#')) }];
        beforeSwatch.name = 'before:' + s.name;

        const afterSwatch = figma.createRectangle();
        afterSwatch.resize(40, 40);
        afterSwatch.fills = [{ type: 'SOLID', color: hexToRgb(s.after.replace(/^#?/, '#')) }];
        afterSwatch.name = 'after:' + s.name;

        const label = figma.createText();
        await figma.loadFontAsync(${(0, font_config_js_1.fontNameLiteral)("ui", "Regular", fontConfig)});
        label.fontName = ${(0, font_config_js_1.fontNameLiteral)("ui", "Regular", fontConfig)};
        label.characters = s.name;
        label.fontSize = 11;

        row.appendChild(beforeSwatch);
        row.appendChild(afterSwatch);
        row.appendChild(label);
        frame.appendChild(row);
      }

      frame.x = 100;
      frame.y = 100;
      page.appendChild(frame);
      return frame.id;
    })()
  `.trim();
}
// ─── WCAG pair checker ────────────────────────────────────────────────────────
function buildWcagReport(colorDeltas, wcagTarget) {
    const report = [];
    const textRoles = ["text", "label", "heading", "caption", "link", "icon"];
    const surfaceRoles = ["background", "surface", "fill", "bg", "container"];
    const textTokens = colorDeltas.filter((d) => textRoles.some((r) => d.tokenName.toLowerCase().includes(r)));
    const surfaceTokens = colorDeltas.filter((d) => surfaceRoles.some((r) => d.tokenName.toLowerCase().includes(r)));
    for (const fg of textTokens) {
        for (const bg of surfaceTokens) {
            const ratio = (0, token_utils_js_1.computeContrastRatio)(fg.generatedValue, bg.generatedValue);
            const passes = (0, token_utils_js_1.meetsWCAG)(ratio, wcagTarget, false);
            report.push({
                foregroundToken: fg.tokenName,
                backgroundToken: bg.tokenName,
                contrastRatio: Math.round(ratio * 100) / 100,
                passes,
                level: wcagTarget,
            });
        }
    }
    return report;
}
// ─── Main handler ─────────────────────────────────────────────────────────────
async function themeGeneratorHandler(args) {
    const { sourceMode, newModeName, strategy, brandDirection, wcagTarget, previewBeforeApply, } = args;
    if (!sourceMode)
        throw new Error("themeGenerator: `sourceMode` is required.");
    if (!newModeName)
        throw new Error("themeGenerator: `newModeName` is required.");
    if (strategy === "brand-shift" && !brandDirection) {
        throw new Error("themeGenerator: `brandDirection` is required when strategy is 'brand-shift'.");
    }
    const fontConfig = (0, font_config_js_1.resolveFontConfig)(args.fonts);
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    // 1. Fetch all tokens
    const allTokens = await bridge.getTokens();
    const colorTokens = allTokens.filter((t) => t.type === "COLOR");
    if (colorTokens.length === 0) {
        throw new Error("themeGenerator: No color tokens found in the active file.");
    }
    // 2. Generate new color values for each token
    const colorDeltas = [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < colorTokens.length; i += BATCH_SIZE) {
        const batch = colorTokens.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (token) => {
            const sourceModeRaw = getSourceModeValue(token, sourceMode);
            const sourceHex = tokenValueToHex(sourceModeRaw ?? token.value);
            if (!sourceHex)
                return; // Skip non-color tokens
            let generatedHex;
            switch (strategy) {
                case "dark":
                    generatedHex = (0, token_utils_js_1.generateDarkModeColor)(sourceHex);
                    break;
                case "high-contrast": {
                    // For high-contrast we adjust against white/black depending on lightness
                    const bgHex = sourceHex < "#888888" ? "#FFFFFF" : "#000000";
                    generatedHex = (0, token_utils_js_1.generateHighContrastColor)(sourceHex, bgHex, wcagTarget);
                    break;
                }
                case "brand-shift":
                    generatedHex = generateBrandShiftColor(sourceHex, token.name, brandDirection);
                    break;
                case "custom":
                    // Custom: apply dark transformation as a sane default; caller
                    // overrides individual tokens separately after preview.
                    generatedHex = (0, token_utils_js_1.generateDarkModeColor)(sourceHex);
                    break;
                default:
                    generatedHex = sourceHex;
            }
            // Quick WCAG self-check (fg vs its complementary)
            const ratio = (0, token_utils_js_1.computeContrastRatio)(generatedHex, sourceHex);
            const wcagPass = (0, token_utils_js_1.meetsWCAG)(ratio, wcagTarget, false);
            colorDeltas.push({
                tokenName: token.name,
                tokenId: token.id,
                sourceModeValue: sourceHex,
                generatedValue: generatedHex,
                wcagPass,
                contrastRatio: Math.round(ratio * 100) / 100,
            });
        }));
    }
    // 3. Build WCAG pair report
    const wcagReport = buildWcagReport(colorDeltas, wcagTarget);
    // 4. Preview frame (before apply)
    let previewFrameId = null;
    if (previewBeforeApply) {
        try {
            const previewScript = buildPreviewFrameScript(newModeName, colorDeltas, fontConfig);
            const previewResult = await bridge.execute(previewScript);
            if (previewResult.success) {
                previewFrameId = previewResult.result;
            }
        }
        catch (err) {
            console.error("themeGenerator: Preview frame creation failed:", err);
        }
    }
    // 5. Apply: create mode + write all values
    let newModeId = null;
    let applied = false;
    // Find the collection that owns these color tokens (use first token's collectionId)
    const primaryCollectionId = colorTokens[0]?.collectionId;
    if (primaryCollectionId) {
        try {
            const createResult = await bridge.execute(buildCreateModeScript(primaryCollectionId, newModeName));
            if (createResult.success && createResult.result) {
                const { modeId } = createResult.result;
                newModeId = modeId;
                // Write each color delta to the new mode
                const writeErrors = [];
                for (const delta of colorDeltas) {
                    const writeResult = await bridge.execute(buildSetVariableValueScript(delta.tokenId, modeId, delta.generatedValue));
                    if (!writeResult.success) {
                        writeErrors.push(`${delta.tokenName}: ${writeResult.error}`);
                    }
                }
                if (writeErrors.length === 0) {
                    applied = true;
                }
                else {
                    console.error(`themeGenerator: ${writeErrors.length} variable write(s) failed.`);
                }
            }
        }
        catch (err) {
            console.error("themeGenerator: Mode creation failed:", err);
        }
    }
    // 6. Log the decision
    const failingWcag = wcagReport.filter((p) => !p.passes).length;
    const logEntry = await decision_log_js_1.decisionLog.log({
        tool: "theme-generator",
        nodeIds: previewFrameId ? [previewFrameId] : [],
        rationale: `Generated theme "${newModeName}" using strategy "${strategy}" from source mode "${sourceMode}". Processed ${colorDeltas.length} color tokens. WCAG ${wcagTarget} failures: ${failingWcag}. Applied: ${applied}.`,
        tokens: colorDeltas.map((d) => d.tokenName),
        reversible: true,
        metadata: {
            sourceMode,
            newModeName,
            strategy,
            wcagTarget,
            colorDeltaCount: colorDeltas.length,
            wcagFailures: failingWcag,
            newModeId,
            primaryCollectionId,
        },
    });
    return {
        newModeId,
        newModeName,
        strategy,
        colorDeltas,
        wcagReport,
        previewFrameId,
        applied,
        logEntryId: logEntry.id,
    };
}
//# sourceMappingURL=index.js.map