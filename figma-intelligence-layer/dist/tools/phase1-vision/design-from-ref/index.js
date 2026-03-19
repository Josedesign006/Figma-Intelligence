"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.designFromRefHandler = designFromRefHandler;
const promises_1 = __importDefault(require("fs/promises"));
const vision_client_js_1 = require("../../../shared/vision-client.js");
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
const token_utils_js_1 = require("../../../shared/token-utils.js");
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function resolveReference(ref) {
    if (ref.startsWith("data:image") || ref.startsWith("http"))
        return ref;
    const buf = await promises_1.default.readFile(ref);
    return `data:image/png;base64,${buf.toString("base64")}`;
}
function parseDesignLanguage(raw) {
    const layout = raw.layout ?? {};
    const spacing = raw.spacing ?? {};
    const colorPalette = Array.isArray(raw.colorPalette)
        ? raw.colorPalette
        : [];
    const typography = raw.typography ?? {};
    return {
        layout: {
            gridStructure: String(layout.gridStructure ?? "12-column"),
            zoneProportions: String(layout.zoneProportions ?? "balanced"),
            hierarchy: String(layout.hierarchy ?? "standard"),
        },
        spacing: {
            density: spacing.density === "compact" ||
                spacing.density === "comfortable" ||
                spacing.density === "spacious"
                ? spacing.density
                : "comfortable",
            paddingPattern: String(spacing.paddingPattern ?? "16px"),
            dominantGap: typeof spacing.dominantGap === "number" ? spacing.dominantGap : 16,
        },
        colorPalette: colorPalette.map((c) => ({
            role: String(c.role ?? "accent"),
            hex: String(c.hex ?? "#000000"),
            frequency: String(c.frequency ?? "minimal"),
        })),
        typography: {
            scalePattern: String(typography.scalePattern ?? "modular"),
            dominantWeights: Array.isArray(typography.dominantWeights)
                ? typography.dominantWeights
                : [400, 600],
            hierarchyLevels: typeof typography.hierarchyLevels === "number" ? typography.hierarchyLevels : 3,
        },
    };
}
function mapDesignLanguageToTokens(lang, dsTokens) {
    const applied = [];
    // Map spacing
    const gapToken = (0, token_utils_js_1.snapToSpacingToken)(lang.spacing.dominantGap);
    applied.push({
        pattern: "dominantGap",
        rawValue: lang.spacing.dominantGap,
        mappedToken: gapToken.tokenName,
        tokenValue: gapToken.tokenValue,
    });
    // Infer padding from density
    const densityPaddingMap = {
        compact: 8,
        comfortable: 16,
        spacious: 32,
    };
    const inferredPadding = densityPaddingMap[lang.spacing.density];
    const paddingToken = (0, token_utils_js_1.snapToSpacingToken)(inferredPadding);
    applied.push({
        pattern: "framePadding",
        rawValue: inferredPadding,
        mappedToken: paddingToken.tokenName,
        tokenValue: paddingToken.tokenValue,
    });
    // Map colors from palette to DS tokens
    if (dsTokens.length > 0) {
        for (const color of lang.colorPalette) {
            const matched = (0, token_utils_js_1.snapToColorToken)(color.hex, dsTokens);
            applied.push({
                pattern: `color.${color.role}`,
                rawValue: color.hex,
                mappedToken: matched.tokenName,
                tokenValue: String(matched.tokenValue),
            });
        }
    }
    else {
        for (const color of lang.colorPalette) {
            applied.push({
                pattern: `color.${color.role}`,
                rawValue: color.hex,
                mappedToken: `--color-${color.role}`,
                tokenValue: color.hex,
            });
        }
    }
    return applied;
}
function buildFrameScript(lang, appliedTokens, frameName, prompt) {
    // Extract resolved token values for use in the script
    const gapToken = appliedTokens.find((t) => t.pattern === "dominantGap");
    const paddingToken = appliedTokens.find((t) => t.pattern === "framePadding");
    const primaryColorToken = appliedTokens.find((t) => t.pattern === "color.primary");
    const surfaceColorToken = appliedTokens.find((t) => t.pattern === "color.surface");
    const gap = typeof gapToken?.tokenValue === "number" ? gapToken.tokenValue : 16;
    const padding = typeof paddingToken?.tokenValue === "number" ? paddingToken.tokenValue : 16;
    // Parse primary color (hex → Figma 0-1 range)
    const primaryHex = String(primaryColorToken?.rawValue ?? "#2563EB").replace("#", "");
    const surfaceHex = String(surfaceColorToken?.rawValue ?? "#FFFFFF").replace("#", "");
    function hexToFigmaRgb(hex) {
        const full = hex.length === 3
            ? hex.split("").map((c) => c + c).join("")
            : hex.padEnd(6, "0").slice(0, 6);
        const n = parseInt(full, 16);
        return {
            r: ((n >> 16) & 255) / 255,
            g: ((n >> 8) & 255) / 255,
            b: (n & 255) / 255,
        };
    }
    const primaryRgb = hexToFigmaRgb(primaryHex);
    const surfaceRgb = hexToFigmaRgb(surfaceHex);
    const hierarchyLevels = lang.typography.hierarchyLevels;
    return `
(async () => {
  const frameName = ${JSON.stringify(frameName)};
  const prompt = ${JSON.stringify(prompt)};
  const gap = ${gap};
  const padding = ${padding};
  const primaryColor = ${JSON.stringify(primaryRgb)};
  const surfaceColor = ${JSON.stringify(surfaceRgb)};
  const hierarchyLevels = ${hierarchyLevels};
  const gridStructure = ${JSON.stringify(lang.layout.gridStructure)};
  const density = ${JSON.stringify(lang.spacing.density)};

  // Create root frame re-interpreting the reference design language
  const outerFrame = figma.createFrame();
  outerFrame.name = frameName;
  outerFrame.resize(1440, 900);
  outerFrame.layoutMode = "VERTICAL";
  outerFrame.primaryAxisSizingMode = "AUTO";
  outerFrame.counterAxisSizingMode = "FIXED";
  outerFrame.itemSpacing = gap;
  outerFrame.paddingLeft = padding;
  outerFrame.paddingRight = padding;
  outerFrame.paddingTop = padding;
  outerFrame.paddingBottom = padding;
  outerFrame.fills = [{ type: "SOLID", color: surfaceColor }];
  figma.currentPage.appendChild(outerFrame);

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  await figma.loadFontAsync({ family: "Inter", style: "SemiBold" });

  // Header zone — reflects the extracted hierarchy
  const headerFrame = figma.createFrame();
  headerFrame.name = "Header";
  headerFrame.resize(1440 - padding * 2, 72);
  headerFrame.layoutMode = "HORIZONTAL";
  headerFrame.primaryAxisSizingMode = "FIXED";
  headerFrame.counterAxisSizingMode = "AUTO";
  headerFrame.counterAxisAlignItems = "CENTER";
  headerFrame.paddingLeft = 0;
  headerFrame.paddingRight = 0;
  headerFrame.itemSpacing = gap;
  headerFrame.fills = [];
  headerFrame.layoutSizingHorizontal = "FILL";
  outerFrame.appendChild(headerFrame);

  // Page title text
  const titleText = figma.createText();
  titleText.characters = prompt.slice(0, 60);
  titleText.fontName = { family: "Inter", style: "Bold" };
  titleText.fontSize = hierarchyLevels >= 3 ? 32 : 24;
  titleText.fills = [{ type: "SOLID", color: { r: 0.07, g: 0.07, b: 0.07 } }];
  titleText.layoutSizingHorizontal = "FILL";
  headerFrame.appendChild(titleText);

  // Primary action button placeholder
  const actionBtn = figma.createFrame();
  actionBtn.name = "Primary Action";
  actionBtn.resize(140, 44);
  actionBtn.cornerRadius = 8;
  actionBtn.fills = [{ type: "SOLID", color: primaryColor }];
  actionBtn.layoutMode = "HORIZONTAL";
  actionBtn.primaryAxisAlignItems = "CENTER";
  actionBtn.counterAxisAlignItems = "CENTER";
  headerFrame.appendChild(actionBtn);

  const btnLabel = figma.createText();
  btnLabel.characters = "Primary Action";
  btnLabel.fontName = { family: "Inter", style: "SemiBold" };
  btnLabel.fontSize = 14;
  btnLabel.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  actionBtn.appendChild(btnLabel);

  // Content zone — grid based on extracted grid structure
  const contentRow = figma.createFrame();
  contentRow.name = "Content Grid";
  contentRow.resize(1440 - padding * 2, 500);
  contentRow.layoutMode = "HORIZONTAL";
  contentRow.primaryAxisSizingMode = "FIXED";
  contentRow.counterAxisSizingMode = "AUTO";
  contentRow.itemSpacing = gap;
  contentRow.fills = [];
  contentRow.layoutSizingHorizontal = "FILL";
  outerFrame.appendChild(contentRow);

  // Determine column count from grid structure
  const colCount = gridStructure.includes("12") ? 3 : gridStructure.includes("8") ? 2 : 3;
  const colWidth = Math.floor((1440 - padding * 2 - gap * (colCount - 1)) / colCount);

  for (let col = 0; col < colCount; col++) {
    const card = figma.createFrame();
    card.name = "Content Card " + (col + 1);
    card.resize(colWidth, 240);
    card.cornerRadius = 12;
    card.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.97, b: 0.97 } }];
    card.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
    card.strokeWeight = 1;
    card.layoutMode = "VERTICAL";
    card.primaryAxisSizingMode = "FIXED";
    card.paddingLeft = padding;
    card.paddingRight = padding;
    card.paddingTop = padding;
    card.paddingBottom = padding;
    card.itemSpacing = gap / 2;

    const cardTitle = figma.createText();
    cardTitle.characters = "Section " + (col + 1);
    cardTitle.fontName = { family: "Inter", style: "SemiBold" };
    cardTitle.fontSize = 16;
    cardTitle.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }];
    card.appendChild(cardTitle);

    const cardBody = figma.createText();
    cardBody.characters = "Content re-interpreted from reference design using design system tokens.";
    cardBody.fontName = { family: "Inter", style: "Regular" };
    cardBody.fontSize = 14;
    cardBody.fills = [{ type: "SOLID", color: { r: 0.45, g: 0.45, b: 0.45 } }];
    cardBody.layoutSizingHorizontal = "FILL";
    card.appendChild(cardBody);

    contentRow.appendChild(card);
  }

  // Attach description note about the design language extraction
  const noteSticky = figma.createSticky();
  noteSticky.text.characters =
    "Generated from reference design language\\n" +
    "Grid: " + gridStructure + " | Density: " + density + "\\n" +
    "Prompt: " + prompt.slice(0, 120);
  noteSticky.x = outerFrame.x + 1440 + 32;
  noteSticky.y = outerFrame.y;
  figma.currentPage.appendChild(noteSticky);

  figma.viewport.scrollAndZoomIntoView([outerFrame]);
  return { frameId: outerFrame.id, nodeId: outerFrame.id };
})();
`;
}
// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
async function designFromRefHandler(args) {
    const { references, prompt, extractOnly, designSystemContext = "", } = args;
    if (references.length === 0) {
        throw new Error("designFromRefHandler: at least one reference image is required");
    }
    // 1. Resolve all references to base64 / URLs
    const resolvedRefs = await Promise.all(references.map(resolveReference));
    // 2. Determine what to extract
    const defaultExtractTypes = ["layout", "spacing", "colorPalette", "typography"];
    const extractTypes = extractOnly && extractOnly.length > 0 ? extractOnly : defaultExtractTypes;
    // 3. Extract design language from all references
    const vision = new vision_client_js_1.VisionClient();
    const rawLang = await vision.extractDesignLanguage(resolvedRefs, extractTypes);
    // 4. Parse and normalise the extracted design language
    const lang = parseDesignLanguage(rawLang);
    // 5. Load DS tokens to map extracted patterns onto real tokens
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    const dsTokens = await bridge.getTokens();
    // 6. Map extracted design language to DS tokens
    const appliedTokens = mapDesignLanguageToTokens(lang, dsTokens);
    // 7. Build and execute Figma frame script
    const contextSuffix = designSystemContext ? ` — ${designSystemContext.slice(0, 30)}` : "";
    const frameName = `[Design from Ref] ${new Date().toLocaleDateString("en-US")}${contextSuffix}`;
    const script = buildFrameScript(lang, appliedTokens, frameName, prompt);
    const execResult = await bridge.execute(script);
    if (!execResult.success) {
        throw new Error(`designFromRefHandler: Figma execution failed — ${execResult.error}`);
    }
    const execData = execResult.result;
    // 8. Log action
    await decision_log_js_1.decisionLog.log({
        tool: "figma_design_from_ref",
        nodeIds: [execData.frameId],
        rationale: `Created design frame from ${references.length} reference image(s). Extracted ${extractTypes.join(", ")}. Mapped ${appliedTokens.length} design patterns to DS tokens. Prompt: "${prompt.slice(0, 100)}".`,
        tokens: appliedTokens.map((t) => t.mappedToken),
        reversible: true,
        metadata: {
            referenceCount: references.length,
            extractTypes,
            designSystemContext,
            appliedTokenCount: appliedTokens.length,
            colorPaletteSize: lang.colorPalette.length,
            spacingDensity: lang.spacing.density,
        },
    });
    return {
        frameId: execData.frameId,
        extractedPatterns: lang,
        appliedTokens,
        generatedFrame: { nodeId: execData.nodeId },
        prompt,
    };
}
//# sourceMappingURL=index.js.map