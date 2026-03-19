// ─────────────────────────────────────────────────────────────────────────────
// Sync From Code
// Compares Storybook component prop definitions against Figma component
// properties and generates a mismatch report, optionally patching Figma or
// creating TypeScript interface stubs.
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import { ComponentSet } from "../../../shared/types.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SyncFromCodeArgs {
  storybookUrl: string;
  figmaLibraryFileKey: string;
  components?: string[];
  syncDirection: "report" | "update-figma" | "update-code-stub";
}

export type MismatchKind =
  | "missing-in-figma"
  | "missing-in-code"
  | "value-mismatch"
  | "match";

export interface PropMismatch {
  propName: string;
  kind: MismatchKind;
  storybookValues?: string[];
  figmaValues?: string[];
  message: string;
}

export interface ComponentComparison {
  componentName: string;
  storybookProps: number;
  figmaProps: number;
  matchCount: number;
  mismatches: PropMismatch[];
  codeStub?: string;
}

export interface SyncFromCodeResult {
  storybookUrl: string;
  figmaLibraryFileKey: string;
  totalComponents: number;
  fullyAligned: number;
  hasMismatches: number;
  comparisons: ComponentComparison[];
  figmaUpdates: string[];
  codeStubs: string[];
}

// ─── Storybook types ──────────────────────────────────────────────────────────

interface StorybookArgType {
  name?: string;
  description?: string;
  type?: { name?: string; required?: boolean };
  control?: { type?: string; options?: string[] };
  options?: string[];
  defaultValue?: unknown;
  table?: { type?: { summary?: string }; category?: string };
}

interface StorybookStory {
  id: string;
  title: string;
  name: string;
  importPath?: string;
  argTypes?: Record<string, StorybookArgType>;
}

interface StorybookStoriesJson {
  v?: number;
  stories?: Record<string, StorybookStory>;
}

// ─── Storybook fetcher ────────────────────────────────────────────────────────

async function fetchStoriesJson(baseUrl: string): Promise<StorybookStoriesJson> {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const url = `${cleanBase}/stories.json`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(
      `syncFromCode: failed to fetch Storybook stories.json from ${url} — HTTP ${response.status}`
    );
  }

  return (await response.json()) as StorybookStoriesJson;
}

// ─── Prop extraction ──────────────────────────────────────────────────────────

interface NormalizedProp {
  name: string;
  values: string[];
  type: string;
}

function extractStorybookProps(story: StorybookStory): NormalizedProp[] {
  if (!story.argTypes) return [];

  const props: NormalizedProp[] = [];

  for (const [propName, argType] of Object.entries(story.argTypes)) {
    // Skip internal / action props
    if (propName.startsWith("on") && propName[2] === propName[2]?.toUpperCase()) continue;
    if (propName === "ref" || propName === "key" || propName === "children") continue;

    const values: string[] = [];

    if (argType.options && Array.isArray(argType.options)) {
      values.push(...argType.options.map(String));
    } else if (argType.control?.options && Array.isArray(argType.control.options)) {
      values.push(...argType.control.options.map(String));
    }

    const typeName =
      argType.type?.name ??
      argType.table?.type?.summary ??
      argType.control?.type ??
      "unknown";

    props.push({ name: propName, values, type: typeName });
  }

  return props;
}

function extractFigmaProps(cs: ComponentSet): NormalizedProp[] {
  const props: NormalizedProp[] = [];

  for (const [propName, propData] of Object.entries(cs.variantGroupProperties)) {
    props.push({
      name: propName,
      values: propData.values,
      type: "variant",
    });
  }

  // Also extract component properties from the first child if available
  const firstChild = cs.children[0];
  if (firstChild?.componentProperties) {
    for (const [propName, propData] of Object.entries(firstChild.componentProperties)) {
      if (propData.type === "VARIANT") continue; // already covered above
      const existing = props.find((p) => p.name === propName);
      if (!existing) {
        const values: string[] =
          propData.variantOptions ? propData.variantOptions : [];
        props.push({ name: propName, values, type: propData.type.toLowerCase() });
      }
    }
  }

  return props;
}

// ─── Comparison logic ─────────────────────────────────────────────────────────

function normalizePropName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_\s]+/g, "")
    .replace(/variant|state|size|type/i, (m) => m.toLowerCase());
}

function compareProps(
  storybookProps: NormalizedProp[],
  figmaProps: NormalizedProp[]
): PropMismatch[] {
  const mismatches: PropMismatch[] = [];
  const figmaMap = new Map<string, NormalizedProp>(
    figmaProps.map((p) => [normalizePropName(p.name), p])
  );
  const sbMap = new Map<string, NormalizedProp>(
    storybookProps.map((p) => [normalizePropName(p.name), p])
  );

  // Check each Storybook prop against Figma
  for (const sbProp of storybookProps) {
    const key = normalizePropName(sbProp.name);
    const figmaProp = figmaMap.get(key);

    if (!figmaProp) {
      mismatches.push({
        propName: sbProp.name,
        kind: "missing-in-figma",
        storybookValues: sbProp.values,
        message: `Prop "${sbProp.name}" exists in Storybook but not in Figma component properties.`,
      });
      continue;
    }

    // Compare allowed values if both sides have them
    if (sbProp.values.length > 0 && figmaProp.values.length > 0) {
      const sbSet = new Set(sbProp.values.map((v) => v.toLowerCase()));
      const figmaSet = new Set(figmaProp.values.map((v) => v.toLowerCase()));
      const hasMismatch =
        sbProp.values.some((v) => !figmaSet.has(v.toLowerCase())) ||
        figmaProp.values.some((v) => !sbSet.has(v.toLowerCase()));

      if (hasMismatch) {
        mismatches.push({
          propName: sbProp.name,
          kind: "value-mismatch",
          storybookValues: sbProp.values,
          figmaValues: figmaProp.values,
          message: `Prop "${sbProp.name}" has different allowed values between Storybook and Figma.`,
        });
      }
    }
  }

  // Check each Figma prop for absence in Storybook
  for (const figmaProp of figmaProps) {
    const key = normalizePropName(figmaProp.name);
    if (!sbMap.has(key)) {
      mismatches.push({
        propName: figmaProp.name,
        kind: "missing-in-code",
        figmaValues: figmaProp.values,
        message: `Figma property "${figmaProp.name}" has no matching Storybook argType.`,
      });
    }
  }

  return mismatches;
}

// ─── TypeScript stub generator ────────────────────────────────────────────────

function generateTsStub(componentName: string, missingProps: PropMismatch[]): string {
  const missingInCode = missingProps.filter((m) => m.kind === "missing-in-code");
  if (missingInCode.length === 0) return "";

  const lines: string[] = [
    `// Auto-generated TypeScript stub for ${componentName}`,
    `// Add these props to your component's Props interface`,
    ``,
    `interface ${componentName}MissingProps {`,
  ];

  for (const prop of missingInCode) {
    const comment = prop.figmaValues && prop.figmaValues.length > 0
      ? `  /** Figma values: ${prop.figmaValues.join(" | ")} */`
      : null;

    if (comment) lines.push(comment);

    const tsType =
      prop.figmaValues && prop.figmaValues.length > 0
        ? prop.figmaValues.map((v) => `"${v}"`).join(" | ")
        : "string";

    lines.push(`  ${prop.propName}?: ${tsType};`);
  }

  lines.push(`}`);
  lines.push(``);

  return lines.join("\n");
}

// ─── Figma updater ────────────────────────────────────────────────────────────

async function addMissingVariantDimension(
  bridge: Awaited<ReturnType<typeof getBridge>>,
  cs: ComponentSet,
  missingProps: PropMismatch[]
): Promise<string[]> {
  const toAdd = missingProps.filter((m) => m.kind === "missing-in-figma");
  if (toAdd.length === 0) return [];

  const updates: string[] = [];

  for (const prop of toAdd) {
    const values = prop.storybookValues && prop.storybookValues.length > 0
      ? prop.storybookValues
      : ["true", "false"];

    // Build a Figma script to add a new variant property dimension
    const script = `
(async () => {
  const cs = await figma.getNodeByIdAsync(${JSON.stringify(cs.id)});
  if (!cs || cs.type !== 'COMPONENT_SET') return { skipped: true, reason: 'ComponentSet not found' };

  // Add the new variant property by cloning and renaming existing variants
  const newPropName = ${JSON.stringify(prop.propName)};
  const newValues = ${JSON.stringify(values)};

  // Check if property already exists
  const existingProps = cs.variantGroupProperties || {};
  if (existingProps[newPropName]) {
    return { skipped: true, reason: 'Property already exists' };
  }

  // Add the property to the first child as a reference
  const firstChild = cs.children[0];
  if (!firstChild) return { skipped: true, reason: 'No children' };

  // Set the variant property on the component set
  try {
    cs.addVariantGroupProperty(newPropName, newValues[0]);
    return { success: true, propName: newPropName, addedValue: newValues[0] };
  } catch (e) {
    return { skipped: true, reason: String(e) };
  }
})();
    `.trim();

    const result = await bridge.execute(script);
    if (result.success) {
      updates.push(`Added variant property "${prop.propName}" to "${cs.name}"`);
    } else {
      updates.push(`Skipped "${prop.propName}" on "${cs.name}": ${result.error}`);
    }
  }

  return updates;
}

// ─── Component name matching ──────────────────────────────────────────────────

function matchStorybookToFigma(
  storyTitle: string,
  componentSets: ComponentSet[]
): ComponentSet | null {
  // Stories use slash-separated titles like "Components/Button" or "Forms/Input"
  const storyName = storyTitle.split("/").pop()?.toLowerCase() ?? storyTitle.toLowerCase();
  const normalized = storyName.replace(/\s+/g, "").replace(/-/g, "");

  let bestMatch: ComponentSet | null = null;
  let bestScore = 0;

  for (const cs of componentSets) {
    const csName = cs.name.toLowerCase().replace(/\s+/g, "").replace(/-/g, "");

    if (csName === normalized) return cs; // exact match

    // Partial match score
    const commonLen = [...csName].filter((c) => normalized.includes(c)).length;
    const score = commonLen / Math.max(csName.length, normalized.length);

    if (score > bestScore && score > 0.6) {
      bestScore = score;
      bestMatch = cs;
    }
  }

  return bestMatch;
}

// ─── Group stories by component ───────────────────────────────────────────────

function groupStoriesByComponent(
  storiesJson: StorybookStoriesJson
): Map<string, StorybookStory[]> {
  const groups = new Map<string, StorybookStory[]>();
  const stories = storiesJson.stories ?? {};

  for (const story of Object.values(stories)) {
    if (!groups.has(story.title)) groups.set(story.title, []);
    groups.get(story.title)!.push(story);
  }

  return groups;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function syncFromCodeHandler(
  args: SyncFromCodeArgs
): Promise<SyncFromCodeResult> {
  const { storybookUrl, figmaLibraryFileKey, components, syncDirection } = args;

  const bridge = await getBridge();

  // 1. Fetch Storybook stories.json
  const storiesJson = await fetchStoriesJson(storybookUrl);

  // 2. Get Figma component sets
  const componentSets = await bridge.getComponentSets();

  // 3. Group stories by component title
  const storiesByComponent = groupStoriesByComponent(storiesJson);

  // 4. Filter to requested components if specified
  const componentTitles = [...storiesByComponent.keys()];
  const filteredTitles =
    components && components.length > 0
      ? componentTitles.filter((t) =>
          components.some((c) =>
            t.toLowerCase().includes(c.toLowerCase())
          )
        )
      : componentTitles;

  const comparisons: ComponentComparison[] = [];
  const figmaUpdates: string[] = [];
  const codeStubs: string[] = [];

  // 5. Compare each component
  for (const title of filteredTitles) {
    const titleStories = storiesByComponent.get(title) ?? [];

    // Aggregate all argTypes across all stories for this component
    const allArgTypes: Record<string, StorybookArgType> = {};
    for (const story of titleStories) {
      if (story.argTypes) {
        Object.assign(allArgTypes, story.argTypes);
      }
    }

    const representativeStory: StorybookStory = {
      id: title,
      title,
      name: title,
      argTypes: allArgTypes,
    };

    const sbProps = extractStorybookProps(representativeStory);

    // Find matching Figma component set
    const figmaCs = matchStorybookToFigma(title, componentSets);
    const figmaProps = figmaCs ? extractFigmaProps(figmaCs) : [];

    const mismatches = compareProps(sbProps, figmaProps);
    const matchCount = sbProps.filter(
      (sp) =>
        !mismatches.some(
          (m) => m.propName === sp.name && m.kind !== "match"
        )
    ).length;

    const componentName = title.split("/").pop() ?? title;

    const comparison: ComponentComparison = {
      componentName,
      storybookProps: sbProps.length,
      figmaProps: figmaProps.length,
      matchCount,
      mismatches,
    };

    // 6. Apply sync direction actions
    if (syncDirection === "update-figma" && figmaCs) {
      const updates = await addMissingVariantDimension(bridge, figmaCs, mismatches);
      figmaUpdates.push(...updates);
    }

    if (syncDirection === "update-code-stub") {
      const stub = generateTsStub(componentName, mismatches);
      if (stub) {
        comparison.codeStub = stub;
        codeStubs.push(stub);
      }
    }

    comparisons.push(comparison);
  }

  const fullyAligned = comparisons.filter((c) => c.mismatches.length === 0).length;
  const hasMismatches = comparisons.filter((c) => c.mismatches.length > 0).length;

  // 7. Log the action
  await decisionLog.log({
    tool: "sync-from-code",
    nodeIds: [],
    rationale: `Synced ${comparisons.length} components from Storybook (${storybookUrl}) against Figma library (${figmaLibraryFileKey}). Fully aligned: ${fullyAligned}. Has mismatches: ${hasMismatches}. Direction: ${syncDirection}.`,
    reversible: syncDirection === "report",
    metadata: {
      storybookUrl,
      figmaLibraryFileKey,
      syncDirection,
      totalComponents: comparisons.length,
      fullyAligned,
      hasMismatches,
      figmaUpdateCount: figmaUpdates.length,
      codeStubCount: codeStubs.length,
    },
  });

  return {
    storybookUrl,
    figmaLibraryFileKey,
    totalComponents: comparisons.length,
    fullyAligned,
    hasMismatches,
    comparisons,
    figmaUpdates,
    codeStubs,
  };
}
