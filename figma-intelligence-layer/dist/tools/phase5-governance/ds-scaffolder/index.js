"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// DS Scaffolder
// Generates a complete Design System foundation in Figma from brand colors:
// color palettes, semantic tokens, typography, spacing, dark mode support,
// component stubs, and W3C DTCG token export.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.dsScaffolderHandler = dsScaffolderHandler;
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
const token_utils_js_1 = require("../../../shared/token-utils.js");
const font_config_js_1 = require("../../../shared/font-config.js");
const semantic_token_catalog_js_1 = require("../../../shared/semantic-token-catalog.js");
const component_templates_js_1 = require("../../../shared/component-templates.js");
const component_script_builder_js_1 = require("../../../shared/component-script-builder.js");
// ─── Color palette generation ─────────────────────────────────────────────────
// Shade steps and their target lightness (0–1 in HSL)
const SHADE_STEPS = [
    { step: 50, lightness: 0.97 },
    { step: 100, lightness: 0.94 },
    { step: 200, lightness: 0.86 },
    { step: 300, lightness: 0.74 },
    { step: 400, lightness: 0.62 },
    { step: 500, lightness: 0.50 },
    { step: 600, lightness: 0.40 },
    { step: 700, lightness: 0.30 },
    { step: 800, lightness: 0.22 },
    { step: 900, lightness: 0.14 },
    { step: 950, lightness: 0.08 },
];
function rgbToHsl(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min)
        return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    switch (max) {
        case rn:
            h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
            break;
        case gn:
            h = ((bn - rn) / d + 2) / 6;
            break;
        case bn:
            h = ((rn - gn) / d + 4) / 6;
            break;
    }
    return { h: h * 360, s, l };
}
function hslToHex(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    }
    else {
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
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h / 360 + 1 / 3);
        g = hue2rgb(p, q, h / 360);
        b = hue2rgb(p, q, h / 360 - 1 / 3);
    }
    return (0, token_utils_js_1.rgbToHex)(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}
function generatePalette(name, baseHex) {
    const rgb = (0, token_utils_js_1.hexToRgb)(baseHex);
    if (!rgb) {
        return {
            name,
            base: baseHex,
            shades: SHADE_STEPS.map((s) => ({ step: s.step, hex: baseHex })),
        };
    }
    const { h, s } = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const shades = SHADE_STEPS.map(({ step, lightness }) => {
        // Adjust saturation: midtones keep full saturation, extremes reduce slightly
        const adjustedS = lightness < 0.15 || lightness > 0.92 ? s * 0.7 : s;
        const hex = hslToHex(h, adjustedS, lightness);
        return { step, hex };
    });
    return { name, base: baseHex, shades };
}
function generateStatusPalettes() {
    return [
        generatePalette("success", "#16a34a"),
        generatePalette("warning", "#d97706"),
        generatePalette("danger", "#dc2626"),
        generatePalette("info", "#2563eb"),
    ];
}
// ─── Token builders ───────────────────────────────────────────────────────────
function getShadeHex(palette, step) {
    return palette.shades.find((s) => s.step === step)?.hex ?? palette.base;
}
function buildColorTokens(palettes, generateDarkMode) {
    const tokens = [];
    // Raw palette tokens
    for (const palette of palettes) {
        for (const shade of palette.shades) {
            const darkHex = generateDarkMode
                ? getShadeHex(palette, 950 - shade.step === 950 ? 50 : Math.min(950, Math.max(50, 950 - shade.step)))
                : undefined;
            tokens.push({
                name: `color/${palette.name}/${shade.step}`,
                value: shade.hex,
                type: "COLOR",
                darkValue: darkHex,
            });
        }
    }
    return tokens;
}
function buildSemanticTokens(palettes, generateDarkMode) {
    const tokens = [];
    // Helper: resolve a primitive ref like "color/primitive/brand/500" to a hex
    // by looking up the palette name and shade step
    const resolveRef = (ref) => {
        // Parse: "color/primitive/{paletteName}/{step}"
        const parts = ref.split("/");
        const paletteName = parts[2] ?? "neutral"; // brand, secondary, neutral, etc.
        const step = parseInt(parts[3] ?? "500", 10);
        // Map palette names: "brand" → primary palette (first), others by name
        let palette;
        if (paletteName === "brand") {
            palette = palettes[0]; // primary is always first
        }
        else {
            palette = palettes.find((p) => p.name.toLowerCase() === paletteName.toLowerCase());
        }
        if (!palette)
            palette = palettes.find((p) => p.name === "neutral") ?? palettes[0];
        return getShadeHex(palette, step);
    };
    // Use the semantic token catalog for COLOR tokens
    const colorEntries = (0, semantic_token_catalog_js_1.getColorSemanticTokens)();
    for (const entry of colorEntries) {
        const lightHex = resolveRef(entry.lightRef);
        const darkHex = generateDarkMode ? resolveRef(entry.darkRef) : undefined;
        tokens.push({
            name: entry.name,
            value: lightHex,
            type: "COLOR",
            description: entry.description,
            darkValue: darkHex,
        });
    }
    // Legacy compat: also emit the old semantic names so existing bindings don't break
    const primaryPalette = palettes[0];
    const neutralPalette = palettes.find((p) => p.name === "neutral") ?? palettes[1];
    const legacyEntries = [
        { name: "color/semantic/primary", lightStep: 500, darkStep: 400, palette: primaryPalette, description: "Primary brand color" },
        { name: "color/semantic/primary-hover", lightStep: 600, darkStep: 300, palette: primaryPalette, description: "Primary hover state" },
        { name: "color/semantic/primary-subtle", lightStep: 100, darkStep: 900, palette: primaryPalette, description: "Subtle primary tint" },
        { name: "color/semantic/primary-on", lightStep: 50, darkStep: 950, palette: primaryPalette, description: "Text on primary background" },
        { name: "color/surface/default", lightStep: 50, darkStep: 950, palette: neutralPalette, description: "Default surface background" },
        { name: "color/surface/raised", lightStep: 50, darkStep: 900, palette: neutralPalette, description: "Raised/card surface" },
        { name: "color/surface/overlay", lightStep: 100, darkStep: 800, palette: neutralPalette, description: "Overlay surface" },
        { name: "color/border/default", lightStep: 200, darkStep: 700, palette: neutralPalette, description: "Default border color" },
        { name: "color/border/strong", lightStep: 400, darkStep: 500, palette: neutralPalette, description: "Strong/emphasis border" },
        { name: "color/text/primary", lightStep: 900, darkStep: 50, palette: neutralPalette, description: "Primary text color" },
        { name: "color/text/secondary", lightStep: 600, darkStep: 300, palette: neutralPalette, description: "Secondary text color" },
        { name: "color/text/disabled", lightStep: 400, darkStep: 600, palette: neutralPalette, description: "Disabled text color" },
        { name: "color/text/on-primary", lightStep: 50, darkStep: 950, palette: primaryPalette, description: "Text on primary background" },
    ];
    for (const entry of legacyEntries) {
        // Skip if already added by catalog (avoid duplicates)
        if (tokens.some((t) => t.name === entry.name))
            continue;
        const lightHex = getShadeHex(entry.palette, entry.lightStep);
        const darkHex = generateDarkMode && entry.darkStep !== undefined
            ? getShadeHex(entry.palette, entry.darkStep)
            : undefined;
        tokens.push({
            name: entry.name,
            value: lightHex,
            type: "COLOR",
            description: entry.description,
            darkValue: darkHex,
        });
    }
    return tokens;
}
function buildTypographyTokens() {
    const sizes = [
        ["xs", 12], ["sm", 14], ["base", 16], ["lg", 18], ["xl", 20],
        ["2xl", 24], ["3xl", 30], ["4xl", 36], ["5xl", 48],
    ];
    const lineHeights = [
        ["xs", 16], ["sm", 20], ["base", 24], ["lg", 28], ["xl", 28],
        ["2xl", 32], ["3xl", 36], ["4xl", 40], ["5xl", 52],
    ];
    const weights = [
        ["light", 300], ["regular", 400], ["medium", 500], ["semibold", 600], ["bold", 700],
    ];
    const tokens = [];
    for (const [name, value] of sizes) {
        tokens.push({ name: `typography/size/${name}`, value, type: "FLOAT", description: `Font size ${name}` });
    }
    for (const [name, value] of lineHeights) {
        tokens.push({ name: `typography/line-height/${name}`, value, type: "FLOAT", description: `Line height ${name}` });
    }
    for (const [name, value] of weights) {
        tokens.push({ name: `typography/weight/${name}`, value, type: "FLOAT", description: `Font weight ${name}` });
    }
    // Letter spacing
    tokens.push({ name: "typography/tracking/tight", value: -0.025, type: "FLOAT" });
    tokens.push({ name: "typography/tracking/normal", value: 0, type: "FLOAT" });
    tokens.push({ name: "typography/tracking/wide", value: 0.025, type: "FLOAT" });
    tokens.push({ name: "typography/tracking/wider", value: 0.05, type: "FLOAT" });
    return tokens;
}
function buildSpacingTokens() {
    const spacingScale = [
        ["0", 0], ["px", 1], ["0.5", 2], ["1", 4], ["1.5", 6],
        ["2", 8], ["2.5", 10], ["3", 12], ["4", 16], ["5", 20],
        ["6", 24], ["7", 28], ["8", 32], ["9", 36], ["10", 40],
        ["11", 44], ["12", 48], ["14", 56], ["16", 64], ["20", 80],
        ["24", 96], ["28", 112], ["32", 128],
    ];
    return spacingScale.map(([name, value]) => ({
        name: `spacing/${name}`,
        value,
        type: "FLOAT",
        description: `Spacing ${name} = ${value}px`,
    }));
}
function buildRadiusTokens() {
    const radii = [
        ["none", 0], ["sm", 2], ["base", 4], ["md", 6], ["lg", 8],
        ["xl", 12], ["2xl", 16], ["3xl", 24], ["full", 9999],
    ];
    return radii.map(([name, value]) => ({
        name: `radius/${name}`,
        value,
        type: "FLOAT",
        description: `Border radius ${name}`,
    }));
}
// ─── DTCG export ──────────────────────────────────────────────────────────────
function tokenToDtcg(token) {
    const dtcgType = token.type === "COLOR" ? "color"
        : token.type === "FLOAT" ? "dimension"
            : "string";
    return {
        $value: token.type === "FLOAT" ? `${token.value}px` : token.value,
        $type: dtcgType,
        ...(token.description ? { $description: token.description } : {}),
    };
}
function buildDtcgExport(tokens) {
    const root = {};
    for (const token of tokens) {
        const parts = token.name.split("/");
        let current = root;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current))
                current[part] = {};
            current = current[part];
        }
        const leafKey = parts[parts.length - 1];
        current[leafKey] = tokenToDtcg(token);
    }
    return root;
}
// ─── Figma script builders (split into small chunks to avoid timeouts) ─────
function buildCreatePageAndTokensScript(brandName, allTokens, generateDarkMode) {
    return `
(async () => {
  const foundationsPage = figma.createPage();
  foundationsPage.name = ${JSON.stringify(`${brandName} – Foundations`)};
  figma.currentPage = foundationsPage;

  const collection = figma.variables.createVariableCollection(${JSON.stringify(`${brandName} Tokens`)});
  const lightModeId = collection.defaultModeId;
  collection.renameMode(lightModeId, 'Light');
  ${generateDarkMode ? "const darkModeId = collection.addMode('Dark');" : ""}

  var created = 0;
  var allTokens = ${JSON.stringify(allTokens)};
  for (var i = 0; i < allTokens.length; i++) {
    var token = allTokens[i];
    var resolvedType = token.type === 'COLOR' ? 'COLOR' : token.type === 'FLOAT' ? 'FLOAT' : 'STRING';
    var variable;
    try {
      variable = figma.variables.createVariable(token.name, collection, resolvedType);
    } catch (e) { continue; }
    if (token.description) variable.description = token.description;
    var lightVal = token.value;
    if (resolvedType === 'COLOR') {
      var hex = String(token.value).replace('#', '');
      lightVal = { r: parseInt(hex.slice(0, 2), 16) / 255, g: parseInt(hex.slice(2, 4), 16) / 255, b: parseInt(hex.slice(4, 6), 16) / 255, a: 1 };
    }
    variable.setValueForMode(lightModeId, lightVal);
    ${generateDarkMode ? `
    if (token.darkValue !== undefined) {
      var darkVal = token.darkValue;
      if (resolvedType === 'COLOR') {
        var dhex = String(token.darkValue).replace('#', '');
        darkVal = { r: parseInt(dhex.slice(0, 2), 16) / 255, g: parseInt(dhex.slice(2, 4), 16) / 255, b: parseInt(dhex.slice(4, 6), 16) / 255, a: 1 };
      }
      variable.setValueForMode(darkModeId, darkVal);
    } else { variable.setValueForMode(darkModeId, lightVal); }
    ` : ""}
    created++;
  }

  return { pageId: foundationsPage.id, collectionId: collection.id, tokenCount: created };
})();
  `.trim();
}
function buildSwatchesScript(allTokens) {
    return `
(async () => {
  var swatchFrame = figma.createFrame();
  swatchFrame.name = "Color Swatches";
  swatchFrame.layoutMode = "VERTICAL";
  swatchFrame.primaryAxisSizingMode = "AUTO";
  swatchFrame.counterAxisSizingMode = "AUTO";
  swatchFrame.itemSpacing = 16;
  swatchFrame.paddingLeft = swatchFrame.paddingRight = 24;
  swatchFrame.paddingTop = swatchFrame.paddingBottom = 24;
  swatchFrame.x = 0; swatchFrame.y = 0;
  figma.currentPage.appendChild(swatchFrame);

  var allTokens = ${JSON.stringify(allTokens)};
  var colorTokensOnly = allTokens.filter(function(t) { return t.type === 'COLOR' && !t.name.startsWith('color/semantic'); });
  var groups = {};
  for (var i = 0; i < colorTokensOnly.length; i++) {
    var parts = colorTokensOnly[i].name.split('/');
    var pName = parts[1] || 'unknown';
    if (!groups[pName]) groups[pName] = [];
    groups[pName].push(colorTokensOnly[i]);
  }
  var keys = Object.keys(groups);
  for (var k = 0; k < keys.length; k++) {
    var row = figma.createFrame();
    row.name = keys[k];
    row.layoutMode = "HORIZONTAL";
    row.primaryAxisSizingMode = "AUTO";
    row.counterAxisSizingMode = "AUTO";
    row.itemSpacing = 4;
    swatchFrame.appendChild(row);
    var tokens = groups[keys[k]];
    for (var j = 0; j < tokens.length; j++) {
      var swatch = figma.createRectangle();
      swatch.resize(48, 48);
      swatch.name = tokens[j].name.split('/').pop() || tokens[j].name;
      var hex = String(tokens[j].value).replace('#', '');
      swatch.fills = [{ type: 'SOLID', color: { r: parseInt(hex.slice(0, 2), 16) / 255, g: parseInt(hex.slice(2, 4), 16) / 255, b: parseInt(hex.slice(4, 6), 16) / 255 } }];
      row.appendChild(swatch);
    }
  }
  return { swatches: keys.length };
})();
  `.trim();
}
function buildTypeAndSpacingScript(fontConfig) {
    const fontLoads = (0, font_config_js_1.generateFontLoadScript)(fontConfig);
    const bodyFont = (0, font_config_js_1.fontNameLiteral)("body", "Regular", fontConfig);
    return `
(async () => {
${fontLoads}

  var typeFrame = figma.createFrame();
  typeFrame.name = "Type Scale";
  typeFrame.layoutMode = "VERTICAL";
  typeFrame.primaryAxisSizingMode = "AUTO";
  typeFrame.counterAxisSizingMode = "AUTO";
  typeFrame.itemSpacing = 12;
  typeFrame.paddingLeft = typeFrame.paddingRight = 24;
  typeFrame.paddingTop = typeFrame.paddingBottom = 24;
  typeFrame.x = 700; typeFrame.y = 0;
  figma.currentPage.appendChild(typeFrame);

  var typeSizes = [['xs', 12], ['sm', 14], ['base', 16], ['lg', 18], ['xl', 20], ['2xl', 24], ['3xl', 30], ['4xl', 36], ['5xl', 48]];
  for (var i = 0; i < typeSizes.length; i++) {
    var textNode = figma.createText();
    textNode.fontName = ${bodyFont};
    textNode.fontSize = typeSizes[i][1];
    textNode.characters = typeSizes[i][0] + ' — The quick brown fox';
    typeFrame.appendChild(textNode);
  }

  var spacingFrame = figma.createFrame();
  spacingFrame.name = "Spacing Scale";
  spacingFrame.layoutMode = "HORIZONTAL";
  spacingFrame.primaryAxisSizingMode = "AUTO";
  spacingFrame.counterAxisSizingMode = "AUTO";
  spacingFrame.itemSpacing = 8;
  spacingFrame.paddingLeft = spacingFrame.paddingRight = 24;
  spacingFrame.paddingTop = spacingFrame.paddingBottom = 24;
  spacingFrame.x = 0; spacingFrame.y = 700;
  figma.currentPage.appendChild(spacingFrame);

  var spacingScaleDisplay = [4, 8, 12, 16, 24, 32, 40, 48, 64, 80];
  for (var j = 0; j < spacingScaleDisplay.length; j++) {
    var bar = figma.createRectangle();
    bar.resize(spacingScaleDisplay[j], spacingScaleDisplay[j]);
    bar.name = spacingScaleDisplay[j] + 'px';
    bar.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 1 } }];
    spacingFrame.appendChild(bar);
  }

  return { ok: true };
})();
  `.trim();
}
/**
 * Build the components page script using blueprint-driven generation.
 * Creates all 51 professional component stubs with auto-layout, typography
 * presets, and token bindings.
 */
function buildComponentsScriptFromBlueprints(brandName, includeComponents, fontConfig, collectionId) {
    const blueprints = (0, component_templates_js_1.getBlueprintsByCategory)(includeComponents);
    return (0, component_script_builder_js_1.buildAllComponentsScript)(blueprints, brandName, fontConfig, collectionId);
}
function buildTemplatesScript(brandName, fontConfig) {
    const fontLoads = (0, font_config_js_1.generateFontLoadScript)(fontConfig);
    return `
(async () => {
${fontLoads}

  const page = figma.createPage();
  page.name = ${JSON.stringify(`${brandName} – Templates`)};
  figma.currentPage = page;

  // ── Login template ───────────────────────────────────────────────────────
  const loginFrame = figma.createFrame();
  loginFrame.name = 'Login Screen';
  loginFrame.resize(1440, 900);
  loginFrame.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.98 } }];
  loginFrame.x = 0; loginFrame.y = 0;
  page.appendChild(loginFrame);

  const loginCard = figma.createFrame();
  loginCard.name = 'Login Card';
  loginCard.resize(400, 480);
  loginCard.layoutMode = 'VERTICAL';
  loginCard.primaryAxisAlignItems = 'MIN';
  loginCard.paddingLeft = loginCard.paddingRight = 32;
  loginCard.paddingTop = loginCard.paddingBottom = 32;
  loginCard.itemSpacing = 20;
  loginCard.cornerRadius = 12;
  loginCard.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  loginCard.x = 520; loginCard.y = 210;
  loginFrame.appendChild(loginCard);

  // ── Dashboard template ────────────────────────────────────────────────────
  const dashFrame = figma.createFrame();
  dashFrame.name = 'Dashboard';
  dashFrame.resize(1440, 900);
  dashFrame.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.98 } }];
  dashFrame.x = 1500; dashFrame.y = 0;
  page.appendChild(dashFrame);

  const sidebar = figma.createFrame();
  sidebar.name = 'Sidebar';
  sidebar.resize(240, 900);
  sidebar.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  dashFrame.appendChild(sidebar);

  const content = figma.createFrame();
  content.name = 'Content';
  content.resize(1200, 900);
  content.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.98 } }];
  content.x = 240;
  dashFrame.appendChild(content);

  // ── Settings template ─────────────────────────────────────────────────────
  const settingsFrame = figma.createFrame();
  settingsFrame.name = 'Settings';
  settingsFrame.resize(1440, 900);
  settingsFrame.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.98 } }];
  settingsFrame.x = 3000; settingsFrame.y = 0;
  page.appendChild(settingsFrame);

  return {
    pageId: page.id,
    templateIds: [loginFrame.id, dashFrame.id, settingsFrame.id],
  };
})();
  `.trim();
}
// ─── Main handler ─────────────────────────────────────────────────────────────
async function dsScaffolderHandler(args) {
    const { brandColors, brandName, includeComponents, generateDarkMode, dtcgExport } = args;
    const fontConfig = (0, font_config_js_1.resolveFontConfig)(args.fonts);
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    // 1. Generate color palettes
    const primaryPalette = generatePalette("primary", brandColors.primary);
    const neutralBase = brandColors.neutral ?? "#6b7280";
    const neutralPalette = generatePalette("neutral", neutralBase);
    const palettes = [primaryPalette, neutralPalette];
    if (brandColors.secondary) {
        palettes.push(generatePalette("secondary", brandColors.secondary));
    }
    if (brandColors.accent) {
        palettes.push(generatePalette("accent", brandColors.accent));
    }
    palettes.push(...generateStatusPalettes());
    // 2. Build all token sets
    const colorTokens = buildColorTokens(palettes, generateDarkMode);
    const semanticTokens = buildSemanticTokens(palettes, generateDarkMode);
    const typographyTokens = buildTypographyTokens();
    const spacingTokens = buildSpacingTokens();
    const radiusTokens = buildRadiusTokens();
    // 3. Create Foundations page + tokens (split into 3 smaller calls)
    const allTokens = [...colorTokens, ...semanticTokens, ...typographyTokens, ...spacingTokens, ...radiusTokens];
    const pageAndTokensScript = buildCreatePageAndTokensScript(brandName, allTokens, generateDarkMode);
    const pageResult = await bridge.execute(pageAndTokensScript);
    const pageResultData = pageResult.success
        ? pageResult.result
        : undefined;
    const foundationsPageId = pageResultData
        ? String(pageResultData["pageId"] ?? "")
        : undefined;
    const collectionId = pageResultData
        ? String(pageResultData["collectionId"] ?? "")
        : undefined;
    // 3b. Build color swatches (on the same page — already set as currentPage)
    if (foundationsPageId) {
        await bridge.execute(buildSwatchesScript(allTokens));
    }
    // 3c. Build type scale + spacing frames
    if (foundationsPageId) {
        await bridge.execute(buildTypeAndSpacingScript(fontConfig));
    }
    // 4. Create Components page (pass collectionId so stubs get variable bindings)
    const componentsScript = buildComponentsScriptFromBlueprints(brandName, includeComponents, fontConfig, collectionId);
    const componentsResult = await bridge.execute(componentsScript);
    const componentsPageId = componentsResult.success
        ? String(componentsResult.result["pageId"] ?? "")
        : undefined;
    // 5. Create Templates page
    const templatesScript = buildTemplatesScript(brandName, fontConfig);
    const templatesResult = await bridge.execute(templatesScript);
    const templatesPageId = templatesResult.success
        ? String(templatesResult.result["pageId"] ?? "")
        : undefined;
    // 6. DTCG export if requested
    const dtcgTokens = dtcgExport ? buildDtcgExport(allTokens) : undefined;
    // 7. Log the action
    await decision_log_js_1.decisionLog.log({
        tool: "ds-scaffolder",
        nodeIds: [foundationsPageId, componentsPageId, templatesPageId].filter(Boolean),
        rationale: `Scaffolded design system "${brandName}" with ${allTokens.length} tokens (${colorTokens.length + semanticTokens.length} color, ${typographyTokens.length} typography, ${spacingTokens.length} spacing). Components: ${includeComponents.join(", ")}. Dark mode: ${generateDarkMode}. DTCG: ${dtcgExport}.`,
        tokens: allTokens.slice(0, 20).map((t) => t.name),
        reversible: false,
        metadata: {
            brandName,
            productType: args.productType,
            generateDarkMode,
            dtcgExport,
            includeComponents,
            totalTokens: allTokens.length,
        },
    });
    return {
        pageIds: {
            foundations: foundationsPageId,
            components: componentsPageId,
            templates: templatesPageId,
        },
        tokenCounts: {
            colors: colorTokens.length + semanticTokens.length,
            typography: typographyTokens.length,
            spacing: spacingTokens.length + radiusTokens.length,
            semantic: semanticTokens.length,
            total: allTokens.length,
        },
        palettes,
        dtcgTokens,
    };
}
//# sourceMappingURL=index.js.map