import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import { hexToRgb, rgbToHex } from "../../../shared/token-utils.js";
import { FontConfig, resolveFontConfig } from "../../../shared/font-config.js";

export interface DsPrimitivesArgs {
  brandName: string;
  primaryColor?: string;
  secondaryColor?: string;
  neutralColor?: string;
  accentColor?: string;
  createSemantics?: boolean;
  createDarkMode?: boolean;
  fonts?: Partial<FontConfig>;
}

interface PrimitiveTokenSpec {
  name: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  valuesByMode: Record<string, string | number | boolean>;
  description?: string;
}

export interface DsPrimitivesResult {
  ok: boolean;
  diagnostics: {
    variablesApi: boolean;
    localVariablesApi: boolean;
    styleApi: boolean;
    editorType?: string;
    fileName?: string;
    reason?: string;
  };
  collectionsCreated: Array<{ id: string; name: string; variableCount: number }>;
  tokenCounts: Record<string, number>;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

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

function hslToHex(h: number, s: number, l: number): string {
  let r: number;
  let g: number;
  let b: number;

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

function generateScale(name: string, baseHex: string, includeDark: boolean): PrimitiveTokenSpec[] {
  const rgb = hexToRgb(baseHex);
  if (!rgb) return [];

  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const lightness = [0.97, 0.94, 0.86, 0.74, 0.62, 0.5, 0.4, 0.3, 0.22, 0.14, 0.08];
  const { h, s } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Determine if this is a neutral/surface palette (low saturation or neutral name)
  const isNeutral = name.toLowerCase().includes("neutral") || s < 0.15;

  return steps.map((step, index) => {
    const value = hslToHex(h, s, lightness[index]);
    const darkIndex = Math.max(0, steps.length - 1 - index);

    // Role-aware dark mode: neutrals get more desaturation, brand/accent
    // colors keep vibrancy, surface-light steps stay truly dark
    let darkSatMult = 0.92;
    if (isNeutral) {
      darkSatMult = 0.60; // neutrals desaturate more for clean dark surfaces
    } else if (step <= 200 || step >= 800) {
      darkSatMult = 0.85; // extremes desaturate slightly
    } else {
      darkSatMult = 1.05; // midtones slightly boost for vibrancy
    }

    const darkValue = hslToHex(h, Math.min(1, s * darkSatMult), lightness[darkIndex]);
    const valuesByMode: Record<string, string> = { Light: value };
    if (includeDark) {
      valuesByMode.Dark = darkValue;
    }
    return {
      name: `${name}/${step}`,
      resolvedType: "COLOR" as const,
      valuesByMode,
      description: `${name} ${step}`,
    };
  });
}

function buildColorTokens(args: Required<Pick<DsPrimitivesArgs, "primaryColor" | "secondaryColor" | "neutralColor" | "accentColor" | "createDarkMode" | "createSemantics">>): PrimitiveTokenSpec[] {
  const tokens = [
    ...generateScale("color/primitive/brand", args.primaryColor, args.createDarkMode),
    ...generateScale("color/primitive/secondary", args.secondaryColor, args.createDarkMode),
    ...generateScale("color/primitive/neutral", args.neutralColor, args.createDarkMode),
    ...generateScale("color/primitive/accent", args.accentColor, args.createDarkMode),
    ...generateScale("color/primitive/success", "#16a34a", args.createDarkMode),
    ...generateScale("color/primitive/warning", "#d97706", args.createDarkMode),
    ...generateScale("color/primitive/danger", "#dc2626", args.createDarkMode),
    ...generateScale("color/primitive/info", "#2563eb", args.createDarkMode),
  ];

  if (!args.createSemantics) return tokens;

  tokens.push(
    {
      name: "color/semantic/actions/primary/background/default",
      resolvedType: "COLOR",
      valuesByMode: args.createDarkMode
        ? { Light: "#3B82F6", Dark: "#60A5FA" }
        : { Light: "#3B82F6" },
      description: "Primary action background",
    },
    {
      name: "color/semantic/actions/primary/text/default",
      resolvedType: "COLOR",
      valuesByMode: args.createDarkMode
        ? { Light: "#FFFFFF", Dark: "#0B1220" }
        : { Light: "#FFFFFF" },
      description: "Primary action text",
    },
    {
      name: "color/semantic/text/primary/default",
      resolvedType: "COLOR",
      valuesByMode: args.createDarkMode
        ? { Light: "#111827", Dark: "#F9FAFB" }
        : { Light: "#111827" },
      description: "Primary text",
    },
    {
      name: "color/semantic/surface/background/default",
      resolvedType: "COLOR",
      valuesByMode: args.createDarkMode
        ? { Light: "#FFFFFF", Dark: "#0F172A" }
        : { Light: "#FFFFFF" },
      description: "Default surface background",
    },
    {
      name: "color/semantic/field/border/default",
      resolvedType: "COLOR",
      valuesByMode: args.createDarkMode
        ? { Light: "#D1D5DB", Dark: "#475569" }
        : { Light: "#D1D5DB" },
      description: "Default field border",
    }
  );

  return tokens;
}

function buildSpacingTokens(): PrimitiveTokenSpec[] {
  const values: Array<[string, number]> = [
    ["0", 0], ["px", 1], ["0.5", 2], ["1", 4], ["1.5", 6], ["2", 8], ["3", 12], ["4", 16],
    ["5", 20], ["6", 24], ["8", 32], ["10", 40], ["12", 48], ["16", 64], ["20", 80], ["24", 96],
  ];
  return values.map(([name, value]) => ({
    name: `space/${name}`,
    resolvedType: "FLOAT",
    valuesByMode: { Base: value },
    description: `Spacing ${value}px`,
  }));
}

function buildRadiusTokens(): PrimitiveTokenSpec[] {
  const values: Array<[string, number]> = [
    ["none", 0], ["xs", 2], ["sm", 4], ["md", 6], ["lg", 8], ["xl", 12], ["2xl", 16], ["full", 9999],
  ];
  return values.map(([name, value]) => ({
    name: `radius/${name}`,
    resolvedType: "FLOAT",
    valuesByMode: { Base: value },
    description: `Radius ${name}`,
  }));
}

function buildBorderTokens(): PrimitiveTokenSpec[] {
  return [
    { name: "border/width/none", resolvedType: "FLOAT", valuesByMode: { Base: 0 } },
    { name: "border/width/thin", resolvedType: "FLOAT", valuesByMode: { Base: 1 } },
    { name: "border/width/default", resolvedType: "FLOAT", valuesByMode: { Base: 1.5 } },
    { name: "border/width/strong", resolvedType: "FLOAT", valuesByMode: { Base: 2 } },
    { name: "border/width/heavy", resolvedType: "FLOAT", valuesByMode: { Base: 3 } },
  ];
}

function buildOpacityTokens(): PrimitiveTokenSpec[] {
  return [
    { name: "opacity/disabled", resolvedType: "FLOAT", valuesByMode: { Base: 0.38 } },
    { name: "opacity/subtle", resolvedType: "FLOAT", valuesByMode: { Base: 0.64 } },
    { name: "opacity/overlay/scrim", resolvedType: "FLOAT", valuesByMode: { Base: 0.48 } },
    { name: "opacity/overlay/soft", resolvedType: "FLOAT", valuesByMode: { Base: 0.16 } },
  ];
}

function buildElevationTokens(): PrimitiveTokenSpec[] {
  return [
    { name: "elevation/level/0", resolvedType: "FLOAT", valuesByMode: { Base: 0 } },
    { name: "elevation/level/1", resolvedType: "FLOAT", valuesByMode: { Base: 1 } },
    { name: "elevation/level/2", resolvedType: "FLOAT", valuesByMode: { Base: 2 } },
    { name: "elevation/level/3", resolvedType: "FLOAT", valuesByMode: { Base: 3 } },
    { name: "elevation/level/4", resolvedType: "FLOAT", valuesByMode: { Base: 4 } },
  ];
}

function buildTypographyTokens(fontConfig: FontConfig): PrimitiveTokenSpec[] {
  const specs: PrimitiveTokenSpec[] = [];
  const sizes: Array<[string, number]> = [["xs", 12], ["sm", 14], ["md", 16], ["lg", 18], ["xl", 20], ["2xl", 24], ["3xl", 30], ["4xl", 36]];
  const lineHeights: Array<[string, number]> = [["xs", 16], ["sm", 20], ["md", 24], ["lg", 28], ["xl", 30], ["2xl", 32], ["3xl", 36], ["4xl", 40]];
  const weights: Array<[string, number]> = [["regular", 400], ["medium", 500], ["semibold", 600], ["bold", 700]];

  specs.push(
    { name: "typography/family/base", resolvedType: "STRING", valuesByMode: { Base: fontConfig.body.family } },
    { name: "typography/family/heading", resolvedType: "STRING", valuesByMode: { Base: fontConfig.heading.family } },
    { name: "typography/family/mono", resolvedType: "STRING", valuesByMode: { Base: fontConfig.mono.family } },
    { name: "typography/family/ui", resolvedType: "STRING", valuesByMode: { Base: fontConfig.ui.family } }
  );

  for (const [name, value] of sizes) {
    specs.push({ name: `typography/size/${name}`, resolvedType: "FLOAT", valuesByMode: { Base: value } });
  }
  for (const [name, value] of lineHeights) {
    specs.push({ name: `typography/line-height/${name}`, resolvedType: "FLOAT", valuesByMode: { Base: value } });
  }
  for (const [name, value] of weights) {
    specs.push({ name: `typography/weight/${name}`, resolvedType: "FLOAT", valuesByMode: { Base: value } });
  }
  specs.push(
    { name: "typography/tracking/tight", resolvedType: "FLOAT", valuesByMode: { Base: -0.02 } },
    { name: "typography/tracking/normal", resolvedType: "FLOAT", valuesByMode: { Base: 0 } },
    { name: "typography/tracking/wide", resolvedType: "FLOAT", valuesByMode: { Base: 0.02 } }
  );

  return specs;
}

async function ensureModes(
  bridge: Awaited<ReturnType<typeof getBridge>>,
  collectionId: string,
  modeNames: string[]
): Promise<Record<string, string>> {
  const collections = await bridge.getVariables(collectionId, "summary") as Array<{
    id: string;
    modes: Array<{ modeId: string; name: string }>;
  }>;
  const target = collections[0];
  if (!target) throw new Error(`Collection not found after creation: ${collectionId}`);

  const modes = Object.fromEntries(target.modes.map((mode) => [mode.name, mode.modeId]));

  for (const modeName of modeNames) {
    if (!modes[modeName]) {
      const created = await bridge.addMode(collectionId, modeName) as { modeId: string; modeName: string };
      modes[created.modeName] = created.modeId;
    }
  }

  return modes;
}

async function createCollectionWithTokens(
  bridge: Awaited<ReturnType<typeof getBridge>>,
  name: string,
  initialModeName: string,
  tokens: PrimitiveTokenSpec[],
  extraModes: string[] = []
): Promise<{ id: string; name: string; variableCount: number }> {
  const collection = await bridge.createVariableCollection(name, initialModeName) as { id: string; name: string };
  const modes = await ensureModes(bridge, collection.id, [initialModeName, ...extraModes]);

  await bridge.batchCreateVariables(
    tokens.map((token) => ({
      name: token.name,
      collectionId: collection.id,
      resolvedType: token.resolvedType,
      description: token.description,
      valuesByMode: Object.fromEntries(
        Object.entries(token.valuesByMode)
          .filter(([modeName]) => modes[modeName])
          .map(([modeName, value]) => [modes[modeName], value])
      ),
    }))
  );

  return {
    id: collection.id,
    name: collection.name,
    variableCount: tokens.length,
  };
}

export async function dsPrimitivesHandler(args: DsPrimitivesArgs): Promise<DsPrimitivesResult> {
  const bridge = await getBridge();
  const diagnostics = await bridge.getCapabilities() as DsPrimitivesResult["diagnostics"];

  if (!diagnostics.variablesApi || !diagnostics.localVariablesApi) {
    return {
      ok: false,
      diagnostics: {
        ...diagnostics,
        reason: "Figma Variables API is unavailable in the current plugin runtime. Update or rerun the bridge plugin in a Variables-capable Figma editor context.",
      },
      collectionsCreated: [],
      tokenCounts: {},
    };
  }

  const createDarkMode = args.createDarkMode ?? true;
  const createSemantics = args.createSemantics ?? true;
  const primaryColor = args.primaryColor ?? "#2563EB";
  const secondaryColor = args.secondaryColor ?? "#0EA5E9";
  const neutralColor = args.neutralColor ?? "#64748B";
  const accentColor = args.accentColor ?? "#F59E0B";

  const fontConfig = resolveFontConfig(args.fonts);

  const colorTokens = buildColorTokens({
    primaryColor,
    secondaryColor,
    neutralColor,
    accentColor,
    createDarkMode,
    createSemantics,
  });
  const typographyTokens = buildTypographyTokens(fontConfig);
  const spacingTokens = buildSpacingTokens();
  const radiusTokens = buildRadiusTokens();
  const borderTokens = buildBorderTokens();
  const opacityTokens = buildOpacityTokens();
  const elevationTokens = buildElevationTokens();

  const collectionsCreated = [
    await createCollectionWithTokens(
      bridge,
      `${args.brandName} Primitive Colors`,
      "Light",
      colorTokens,
      createDarkMode ? ["Dark"] : []
    ),
    await createCollectionWithTokens(bridge, `${args.brandName} Primitive Typography`, "Base", typographyTokens),
    await createCollectionWithTokens(bridge, `${args.brandName} Primitive Space`, "Base", spacingTokens),
    await createCollectionWithTokens(bridge, `${args.brandName} Primitive Radius`, "Base", radiusTokens),
    await createCollectionWithTokens(bridge, `${args.brandName} Primitive Border`, "Base", borderTokens),
    await createCollectionWithTokens(bridge, `${args.brandName} Primitive Opacity`, "Base", opacityTokens),
    await createCollectionWithTokens(bridge, `${args.brandName} Primitive Elevation`, "Base", elevationTokens),
  ];

  await decisionLog.log({
    tool: "figma_design_system_primitives",
    nodeIds: [],
    rationale: `Created primitive variable collections for ${args.brandName} with color, typography, spacing, radius, border, opacity, and elevation foundations.`,
    reversible: false,
    metadata: {
      createDarkMode,
      createSemantics,
      collections: collectionsCreated.map((collection) => collection.name),
    },
  });

  return {
    ok: true,
    diagnostics,
    collectionsCreated,
    tokenCounts: {
      colors: colorTokens.length,
      typography: typographyTokens.length,
      spacing: spacingTokens.length,
      radius: radiusTokens.length,
      border: borderTokens.length,
      opacity: opacityTokens.length,
      elevation: elevationTokens.length,
    },
  };
}
