// ─────────────────────────────────────────────────────────────────────────────
// DS Scaffolder
// Generates a complete Design System foundation in Figma from brand colors:
// color palettes, semantic tokens, typography, spacing, dark mode support,
// component stubs, and W3C DTCG token export.
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import { hexToRgb, rgbToHex } from "../../../shared/token-utils.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DsScaffolderArgs {
  brandColors: {
    primary: string;
    secondary?: string;
    neutral?: string;
    accent?: string;
  };
  productType: "web-app" | "mobile-app" | "both" | "marketing";
  brandName: string;
  includeComponents: Array<"core" | "forms" | "navigation" | "data" | "feedback" | "overlay">;
  generateDarkMode: boolean;
  dtcgExport: boolean;
}

export interface ColorShade {
  step: number;
  hex: string;
  lightHex?: string;
  darkHex?: string;
}

export interface ColorPalette {
  name: string;
  base: string;
  shades: ColorShade[];
}

export interface TokenDefinition {
  name: string;
  value: string | number;
  type: "COLOR" | "FLOAT" | "STRING";
  description?: string;
  darkValue?: string | number;
}

export interface DsScaffolderResult {
  pageIds: {
    foundations?: string;
    components?: string;
    templates?: string;
  };
  tokenCounts: {
    colors: number;
    typography: number;
    spacing: number;
    semantic: number;
    total: number;
  };
  palettes: ColorPalette[];
  dtcgTokens?: Record<string, unknown>;
}

// ─── Color palette generation ─────────────────────────────────────────────────

// Shade steps and their target lightness (0–1 in HSL)
const SHADE_STEPS: Array<{ step: number; lightness: number }> = [
  { step: 50,  lightness: 0.97 },
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

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
    case gn: h = ((bn - rn) / d + 2) / 6; break;
    case bn: h = ((rn - gn) / d + 4) / 6; break;
  }
  return { h: h * 360, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h / 360 + 1 / 3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, h / 360 - 1 / 3);
  }
  return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}

function generatePalette(name: string, baseHex: string): ColorPalette {
  const rgb = hexToRgb(baseHex);
  if (!rgb) {
    return {
      name,
      base: baseHex,
      shades: SHADE_STEPS.map((s) => ({ step: s.step, hex: baseHex })),
    };
  }

  const { h, s } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const shades: ColorShade[] = SHADE_STEPS.map(({ step, lightness }) => {
    // Adjust saturation: midtones keep full saturation, extremes reduce slightly
    const adjustedS = lightness < 0.15 || lightness > 0.92 ? s * 0.7 : s;
    const hex = hslToHex(h, adjustedS, lightness);
    return { step, hex };
  });

  return { name, base: baseHex, shades };
}

function generateStatusPalettes(): ColorPalette[] {
  return [
    generatePalette("success", "#16a34a"),
    generatePalette("warning", "#d97706"),
    generatePalette("danger",  "#dc2626"),
    generatePalette("info",    "#2563eb"),
  ];
}

// ─── Token builders ───────────────────────────────────────────────────────────

function getShadeHex(palette: ColorPalette, step: number): string {
  return palette.shades.find((s) => s.step === step)?.hex ?? palette.base;
}

function buildColorTokens(
  palettes: ColorPalette[],
  generateDarkMode: boolean
): TokenDefinition[] {
  const tokens: TokenDefinition[] = [];

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

function buildSemanticTokens(
  primaryPalette: ColorPalette,
  neutralPalette: ColorPalette,
  generateDarkMode: boolean
): TokenDefinition[] {
  const tokens: TokenDefinition[] = [];

  const semanticEntries: Array<{
    name: string;
    lightStep: number;
    darkStep?: number;
    palette: ColorPalette;
    description: string;
  }> = [
    { name: "color/semantic/primary",           lightStep: 500, darkStep: 400, palette: primaryPalette, description: "Primary brand color" },
    { name: "color/semantic/primary-hover",     lightStep: 600, darkStep: 300, palette: primaryPalette, description: "Primary hover state" },
    { name: "color/semantic/primary-subtle",    lightStep: 100, darkStep: 900, palette: primaryPalette, description: "Subtle primary tint" },
    { name: "color/semantic/primary-on",        lightStep: 50,  darkStep: 950, palette: primaryPalette, description: "Text on primary background" },

    { name: "color/surface/default",            lightStep: 50,  darkStep: 950, palette: neutralPalette, description: "Default surface background" },
    { name: "color/surface/raised",             lightStep: 50,  darkStep: 900, palette: neutralPalette, description: "Raised/card surface" },
    { name: "color/surface/overlay",            lightStep: 100, darkStep: 800, palette: neutralPalette, description: "Overlay surface" },

    { name: "color/border/default",             lightStep: 200, darkStep: 700, palette: neutralPalette, description: "Default border color" },
    { name: "color/border/strong",              lightStep: 400, darkStep: 500, palette: neutralPalette, description: "Strong/emphasis border" },

    { name: "color/text/primary",               lightStep: 900, darkStep: 50,  palette: neutralPalette, description: "Primary text color" },
    { name: "color/text/secondary",             lightStep: 600, darkStep: 300, palette: neutralPalette, description: "Secondary text color" },
    { name: "color/text/disabled",              lightStep: 400, darkStep: 600, palette: neutralPalette, description: "Disabled text color" },
    { name: "color/text/on-primary",            lightStep: 50,  darkStep: 950, palette: primaryPalette, description: "Text on primary background" },
  ];

  for (const entry of semanticEntries) {
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

function buildTypographyTokens(): TokenDefinition[] {
  const sizes: Array<[string, number]> = [
    ["xs",  12], ["sm",  14], ["base", 16], ["lg",  18], ["xl",  20],
    ["2xl", 24], ["3xl", 30], ["4xl",  36], ["5xl",  48],
  ];

  const lineHeights: Array<[string, number]> = [
    ["xs", 16], ["sm", 20], ["base", 24], ["lg", 28], ["xl", 28],
    ["2xl", 32], ["3xl", 36], ["4xl", 40], ["5xl", 52],
  ];

  const weights: Array<[string, number]> = [
    ["light", 300], ["regular", 400], ["medium", 500], ["semibold", 600], ["bold", 700],
  ];

  const tokens: TokenDefinition[] = [];

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
  tokens.push({ name: "typography/tracking/tight",   value: -0.025, type: "FLOAT" });
  tokens.push({ name: "typography/tracking/normal",  value: 0,      type: "FLOAT" });
  tokens.push({ name: "typography/tracking/wide",    value: 0.025,  type: "FLOAT" });
  tokens.push({ name: "typography/tracking/wider",   value: 0.05,   type: "FLOAT" });

  return tokens;
}

function buildSpacingTokens(): TokenDefinition[] {
  const spacingScale: Array<[string, number]> = [
    ["0",  0],  ["px", 1], ["0.5", 2], ["1",  4],  ["1.5", 6],
    ["2",  8],  ["2.5", 10], ["3", 12], ["4",  16], ["5",   20],
    ["6",  24], ["7",  28], ["8",  32], ["9",  36], ["10",  40],
    ["11", 44], ["12", 48], ["14", 56], ["16", 64], ["20",  80],
    ["24", 96], ["28", 112], ["32", 128],
  ];

  return spacingScale.map(([name, value]) => ({
    name: `spacing/${name}`,
    value,
    type: "FLOAT" as const,
    description: `Spacing ${name} = ${value}px`,
  }));
}

function buildRadiusTokens(): TokenDefinition[] {
  const radii: Array<[string, number]> = [
    ["none", 0], ["sm", 2], ["base", 4], ["md", 6], ["lg", 8],
    ["xl", 12], ["2xl", 16], ["3xl", 24], ["full", 9999],
  ];
  return radii.map(([name, value]) => ({
    name: `radius/${name}`,
    value,
    type: "FLOAT" as const,
    description: `Border radius ${name}`,
  }));
}

// ─── DTCG export ──────────────────────────────────────────────────────────────

function tokenToDtcg(token: TokenDefinition): Record<string, unknown> {
  const dtcgType = token.type === "COLOR" ? "color"
    : token.type === "FLOAT" ? "dimension"
    : "string";

  return {
    $value: token.type === "FLOAT" ? `${token.value}px` : token.value,
    $type: dtcgType,
    ...(token.description ? { $description: token.description } : {}),
  };
}

function buildDtcgExport(tokens: TokenDefinition[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};

  for (const token of tokens) {
    const parts = token.name.split("/");
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) current[part] = {};
      current = current[part] as Record<string, unknown>;
    }

    const leafKey = parts[parts.length - 1];
    current[leafKey] = tokenToDtcg(token);
  }

  return root;
}

// ─── Figma script builders (split into small chunks to avoid timeouts) ─────

function buildCreatePageAndTokensScript(
  brandName: string,
  allTokens: TokenDefinition[],
  generateDarkMode: boolean
): string {
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

function buildSwatchesScript(allTokens: TokenDefinition[]): string {
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

function buildTypeAndSpacingScript(): string {
  return `
(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

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
    textNode.fontName = { family: "Inter", style: "Regular" };
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

const COMPONENT_TEMPLATES: Record<string, string> = {
  core: `
    // Button
    const btn = figma.createComponent();
    btn.name = 'Button';
    btn.resize(120, 40);
    btn.layoutMode = 'HORIZONTAL';
    btn.primaryAxisAlignItems = 'CENTER';
    btn.counterAxisAlignItems = 'CENTER';
    btn.paddingLeft = btn.paddingRight = 16;
    btn.cornerRadius = 6;
    btn.fills = [{ type: 'SOLID', color: { r: 0.15, g: 0.4, b: 0.96 } }];
    const btnText = figma.createText();
    btnText.characters = 'Button';
    btnText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    btn.appendChild(btnText);
    page.appendChild(btn);
    btn.x = 32; btn.y = 32;
  `,
  forms: `
    // Input field
    const input = figma.createComponent();
    input.name = 'Input';
    input.resize(240, 40);
    input.layoutMode = 'HORIZONTAL';
    input.primaryAxisAlignItems = 'CENTER';
    input.paddingLeft = input.paddingRight = 12;
    input.cornerRadius = 4;
    input.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    input.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.85 } }];
    input.strokeWeight = 1;
    const inputPlaceholder = figma.createText();
    inputPlaceholder.characters = 'Placeholder text';
    inputPlaceholder.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.65 } }];
    input.appendChild(inputPlaceholder);
    page.appendChild(input);
    input.x = 32; input.y = 100;
  `,
  navigation: `
    // Nav bar
    const nav = figma.createComponent();
    nav.name = 'NavBar';
    nav.resize(1440, 64);
    nav.layoutMode = 'HORIZONTAL';
    nav.primaryAxisAlignItems = 'CENTER';
    nav.counterAxisAlignItems = 'CENTER';
    nav.paddingLeft = nav.paddingRight = 32;
    nav.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    nav.strokes = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.92 } }];
    nav.strokeAlign = 'OUTSIDE';
    page.appendChild(nav);
    nav.x = 32; nav.y = 168;
  `,
  data: `
    // Table
    const table = figma.createComponent();
    table.name = 'Table';
    table.resize(800, 200);
    table.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    table.strokes = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.92 } }];
    table.strokeWeight = 1;
    page.appendChild(table);
    table.x = 32; table.y = 260;
  `,
  feedback: `
    // Toast
    const toast = figma.createComponent();
    toast.name = 'Toast';
    toast.resize(320, 56);
    toast.layoutMode = 'HORIZONTAL';
    toast.primaryAxisAlignItems = 'CENTER';
    toast.paddingLeft = toast.paddingRight = 16;
    toast.cornerRadius = 8;
    toast.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.7, b: 0.3 } }];
    const toastText = figma.createText();
    toastText.characters = 'Success message';
    toastText.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    toast.appendChild(toastText);
    page.appendChild(toast);
    toast.x = 32; toast.y = 500;
  `,
  overlay: `
    // Modal
    const modal = figma.createComponent();
    modal.name = 'Modal';
    modal.resize(480, 320);
    modal.layoutMode = 'VERTICAL';
    modal.primaryAxisAlignItems = 'MIN';
    modal.paddingLeft = modal.paddingRight = 24;
    modal.paddingTop = modal.paddingBottom = 24;
    modal.itemSpacing = 16;
    modal.cornerRadius = 12;
    modal.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    modal.effects = [{
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.12 },
      offset: { x: 0, y: 8 },
      radius: 24,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL',
    }];
    page.appendChild(modal);
    modal.x = 32; modal.y = 580;
  `,
};

function buildComponentsScript(
  brandName: string,
  includeComponents: DsScaffolderArgs["includeComponents"]
): string {
  const componentCode = includeComponents
    .map((cat) => COMPONENT_TEMPLATES[cat] ?? "")
    .join("\n");

  return `
(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });

  const page = figma.createPage();
  page.name = ${JSON.stringify(`${brandName} – Components`)};
  figma.currentPage = page;

  ${componentCode}

  return { pageId: page.id };
})();
  `.trim();
}

function buildTemplatesScript(brandName: string): string {
  return `
(async () => {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

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

export async function dsScaffolderHandler(
  args: DsScaffolderArgs
): Promise<DsScaffolderResult> {
  const { brandColors, brandName, includeComponents, generateDarkMode, dtcgExport } = args;

  const bridge = await getBridge();

  // 1. Generate color palettes
  const primaryPalette = generatePalette("primary", brandColors.primary);

  const neutralBase = brandColors.neutral ?? "#6b7280";
  const neutralPalette = generatePalette("neutral", neutralBase);

  const palettes: ColorPalette[] = [primaryPalette, neutralPalette];

  if (brandColors.secondary) {
    palettes.push(generatePalette("secondary", brandColors.secondary));
  }
  if (brandColors.accent) {
    palettes.push(generatePalette("accent", brandColors.accent));
  }

  palettes.push(...generateStatusPalettes());

  // 2. Build all token sets
  const colorTokens = buildColorTokens(palettes, generateDarkMode);
  const semanticTokens = buildSemanticTokens(primaryPalette, neutralPalette, generateDarkMode);
  const typographyTokens = buildTypographyTokens();
  const spacingTokens = buildSpacingTokens();
  const radiusTokens = buildRadiusTokens();

  // 3. Create Foundations page + tokens (split into 3 smaller calls)
  const allTokens = [...colorTokens, ...semanticTokens, ...typographyTokens, ...spacingTokens, ...radiusTokens];

  const pageAndTokensScript = buildCreatePageAndTokensScript(brandName, allTokens, generateDarkMode);
  const pageResult = await bridge.execute(pageAndTokensScript);
  const foundationsPageId = pageResult.success
    ? String((pageResult.result as Record<string, unknown>)["pageId"] ?? "")
    : undefined;

  // 3b. Build color swatches (on the same page — already set as currentPage)
  if (foundationsPageId) {
    await bridge.execute(buildSwatchesScript(allTokens));
  }

  // 3c. Build type scale + spacing frames
  if (foundationsPageId) {
    await bridge.execute(buildTypeAndSpacingScript());
  }

  // 4. Create Components page
  const componentsScript = buildComponentsScript(brandName, includeComponents);
  const componentsResult = await bridge.execute(componentsScript);
  const componentsPageId = componentsResult.success
    ? String((componentsResult.result as Record<string, unknown>)["pageId"] ?? "")
    : undefined;

  // 5. Create Templates page
  const templatesScript = buildTemplatesScript(brandName);
  const templatesResult = await bridge.execute(templatesScript);
  const templatesPageId = templatesResult.success
    ? String((templatesResult.result as Record<string, unknown>)["pageId"] ?? "")
    : undefined;

  // 6. DTCG export if requested
  const dtcgTokens = dtcgExport ? buildDtcgExport(allTokens) : undefined;

  // 7. Log the action
  await decisionLog.log({
    tool: "ds-scaffolder",
    nodeIds: [foundationsPageId, componentsPageId, templatesPageId].filter(Boolean) as string[],
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
