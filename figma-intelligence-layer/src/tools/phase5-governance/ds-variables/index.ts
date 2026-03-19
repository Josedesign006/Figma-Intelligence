import { getBridge } from "../../../shared/figma-bridge.js";
import { dsPrimitivesHandler, DsPrimitivesArgs } from "../ds-primitives/index.js";

type VariableScalar = string | number | boolean;
type VariableAliasValue = { type: "VARIABLE_ALIAS"; variableId: string };
type VariableValue = VariableScalar | VariableAliasValue;

export interface DsVariableCollectionInput {
  name: string;
  initialModeName?: string;
  modes?: string[];
}

export interface DsVariableInput {
  collectionId?: string;
  collectionName?: string;
  name: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  valuesByMode: Record<string, VariableValue>;
  description?: string;
}

export interface DsComponentVariableTemplate {
  componentName: string;
  variant?: string;
  parts?: string[];
  properties?: string[];
  states?: string[];
}

export interface DsVariablesArgs {
  action:
    | "diagnose"
    | "scaffold-primitives"
    | "scaffold-semantics"
    | "scaffold-components"
    | "scaffold-all"
    | "create-collections"
    | "create-variables";
  brandName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  neutralColor?: string;
  accentColor?: string;
  createDarkMode?: boolean;
  createSemantics?: boolean;
  collections?: DsVariableCollectionInput[];
  variables?: DsVariableInput[];
  componentTemplates?: DsComponentVariableTemplate[];
}

export interface DsVariablesResult {
  ok: boolean;
  action: DsVariablesArgs["action"];
  diagnostics: Record<string, unknown>;
  createdCollections: Array<{ id: string; name: string }>;
  createdVariables: Array<{ id: string; name: string; resolvedType: string }>;
  notes: string[];
}

interface VariableCollectionSummary {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  variables: Array<{ id: string; name: string; type: string }>;
}

async function getAllCollections(
  bridge: Awaited<ReturnType<typeof getBridge>>
): Promise<VariableCollectionSummary[]> {
  return await bridge.getVariables(undefined, "full") as VariableCollectionSummary[];
}

function variableMapByName(collections: VariableCollectionSummary[]): Map<string, { id: string; collectionId: string }> {
  const map = new Map<string, { id: string; collectionId: string }>();
  for (const collection of collections) {
    for (const variable of collection.variables) {
      map.set(variable.name, { id: variable.id, collectionId: collection.id });
      map.set(`${collection.name}::${variable.name}`, { id: variable.id, collectionId: collection.id });
    }
  }
  return map;
}

async function ensureCollection(
  bridge: Awaited<ReturnType<typeof getBridge>>,
  name: string,
  initialModeName = "Base",
  modes: string[] = []
): Promise<{ id: string; name: string; modes: Record<string, string> }> {
  const collections = await getAllCollections(bridge);
  let collection = collections.find((item) => item.name === name);

  if (!collection) {
    const created = await bridge.createVariableCollection(name, initialModeName) as unknown as {
      id: string;
      name: string;
      modes: Array<{ modeId: string; name: string }>;
    };
    collection = {
      id: created.id,
      name: created.name,
      modes: created.modes,
      variables: [],
    };
  }

  const refreshed = await getAllCollections(bridge);
  const current = refreshed.find((item) => item.id === collection!.id || item.name === name);
  if (!current) throw new Error(`Failed to load collection: ${name}`);

  const modeMap = Object.fromEntries(current.modes.map((mode) => [mode.name, mode.modeId]));
  for (const modeName of [initialModeName, ...modes]) {
    if (!modeMap[modeName]) {
      const created = await bridge.addMode(current.id, modeName) as { modeId: string; modeName: string };
      modeMap[created.modeName] = created.modeId;
    }
  }

  return { id: current.id, name: current.name, modes: modeMap };
}

function makeAlias(variableId: string): VariableAliasValue {
  return { type: "VARIABLE_ALIAS", variableId };
}

function requireVariable(
  variableIndex: Map<string, { id: string; collectionId: string }>,
  name: string
): string {
  const found = variableIndex.get(name);
  if (!found) {
    throw new Error(`Required variable not found: ${name}`);
  }
  return found.id;
}

function buildSemanticVariableSpecs(
  brandName: string,
  variableIndex: Map<string, { id: string; collectionId: string }>,
  createDarkMode: boolean
): DsVariableInput[] {
  const lightDark = (light: string, dark: string): Record<string, VariableValue> => {
    const values: Record<string, VariableValue> = {
      Light: makeAlias(requireVariable(variableIndex, light)),
    };
    if (createDarkMode) {
      values.Dark = makeAlias(requireVariable(variableIndex, dark));
    }
    return values;
  };

  const baseOnly = (value: VariableValue) => ({ Base: value });

  return [
    {
      collectionName: `${brandName} Semantic Colors`,
      name: "color.actions.primary.background.default",
      resolvedType: "COLOR",
      valuesByMode: lightDark("color/primitive/brand/500", "color/primitive/brand/400"),
    },
    {
      collectionName: `${brandName} Semantic Colors`,
      name: "color.actions.primary.background.hover",
      resolvedType: "COLOR",
      valuesByMode: lightDark("color/primitive/brand/600", "color/primitive/brand/300"),
    },
    {
      collectionName: `${brandName} Semantic Colors`,
      name: "color.actions.primary.text.default",
      resolvedType: "COLOR",
      valuesByMode: lightDark("color/primitive/neutral/50", "color/primitive/neutral/950"),
    },
    {
      collectionName: `${brandName} Semantic Colors`,
      name: "color.surface.background.default",
      resolvedType: "COLOR",
      valuesByMode: lightDark("color/primitive/neutral/50", "color/primitive/neutral/950"),
    },
    {
      collectionName: `${brandName} Semantic Colors`,
      name: "color.surface.border.default",
      resolvedType: "COLOR",
      valuesByMode: lightDark("color/primitive/neutral/200", "color/primitive/neutral/700"),
    },
    {
      collectionName: `${brandName} Semantic Colors`,
      name: "color.text.primary.default",
      resolvedType: "COLOR",
      valuesByMode: lightDark("color/primitive/neutral/900", "color/primitive/neutral/50"),
    },
    {
      collectionName: `${brandName} Semantic Colors`,
      name: "color.text.secondary.default",
      resolvedType: "COLOR",
      valuesByMode: lightDark("color/primitive/neutral/600", "color/primitive/neutral/300"),
    },
    {
      collectionName: `${brandName} Semantic Colors`,
      name: "color.field.border.default",
      resolvedType: "COLOR",
      valuesByMode: lightDark("color/primitive/neutral/300", "color/primitive/neutral/600"),
    },
    {
      collectionName: `${brandName} Semantic Colors`,
      name: "color.field.border.focus",
      resolvedType: "COLOR",
      valuesByMode: lightDark("color/primitive/brand/500", "color/primitive/brand/400"),
    },
    {
      collectionName: `${brandName} Semantic Space`,
      name: "space.inset.control.md",
      resolvedType: "FLOAT",
      valuesByMode: baseOnly(makeAlias(requireVariable(variableIndex, "space/4"))),
    },
    {
      collectionName: `${brandName} Semantic Space`,
      name: "space.gap.stack.md",
      resolvedType: "FLOAT",
      valuesByMode: baseOnly(makeAlias(requireVariable(variableIndex, "space/4"))),
    },
    {
      collectionName: `${brandName} Semantic Radius`,
      name: "radius.field.all.default",
      resolvedType: "FLOAT",
      valuesByMode: baseOnly(makeAlias(requireVariable(variableIndex, "radius/sm"))),
    },
    {
      collectionName: `${brandName} Semantic Radius`,
      name: "radius.surface.all.default",
      resolvedType: "FLOAT",
      valuesByMode: baseOnly(makeAlias(requireVariable(variableIndex, "radius/lg"))),
    },
    {
      collectionName: `${brandName} Semantic Typography`,
      name: "typography.body.md.size",
      resolvedType: "FLOAT",
      valuesByMode: baseOnly(makeAlias(requireVariable(variableIndex, "typography/size/md"))),
    },
    {
      collectionName: `${brandName} Semantic Typography`,
      name: "typography.body.md.line-height",
      resolvedType: "FLOAT",
      valuesByMode: baseOnly(makeAlias(requireVariable(variableIndex, "typography/line-height/md"))),
    },
    {
      collectionName: `${brandName} Semantic Typography`,
      name: "typography.label.sm.weight",
      resolvedType: "FLOAT",
      valuesByMode: baseOnly(makeAlias(requireVariable(variableIndex, "typography/weight/medium"))),
    },
  ];
}

function buildComponentVariableSpecs(
  brandName: string,
  variableIndex: Map<string, { id: string; collectionId: string }>,
  templates: DsComponentVariableTemplate[]
): DsVariableInput[] {
  const items: DsVariableInput[] = [];
  const colorBg = makeAlias(requireVariable(variableIndex, `${brandName} Semantic Colors::color.actions.primary.background.default`));
  const colorText = makeAlias(requireVariable(variableIndex, `${brandName} Semantic Colors::color.actions.primary.text.default`));
  const radius = makeAlias(requireVariable(variableIndex, `${brandName} Semantic Radius::radius.field.all.default`));
  const space = makeAlias(requireVariable(variableIndex, `${brandName} Semantic Space::space.inset.control.md`));

  for (const template of templates) {
    const parts = template.parts?.length ? template.parts : ["container", "label"];
    const properties = template.properties?.length ? template.properties : ["background", "text", "radius", "padding-x"];
    const states = template.states?.length ? template.states : ["default", "hover", "disabled"];

    for (const part of parts) {
      for (const property of properties) {
        for (const state of states) {
          const nameParts = ["components", template.componentName];
          if (template.variant) nameParts.push(template.variant);
          nameParts.push(part, property, state);
          const name = nameParts.join(".");

          let resolvedType: DsVariableInput["resolvedType"] = "COLOR";
          let valuesByMode: Record<string, VariableValue> = { Base: colorBg };

          if (property.includes("text")) {
            resolvedType = "COLOR";
            valuesByMode = { Base: colorText };
          } else if (property.includes("radius")) {
            resolvedType = "FLOAT";
            valuesByMode = { Base: radius };
          } else if (property.includes("padding") || property.includes("gap")) {
            resolvedType = "FLOAT";
            valuesByMode = { Base: space };
          }

          items.push({
            collectionName: `${brandName} Component Tokens`,
            name,
            resolvedType,
            valuesByMode,
          });
        }
      }
    }
  }

  return items;
}

async function createVariablesFromSpec(
  bridge: Awaited<ReturnType<typeof getBridge>>,
  specs: DsVariableInput[]
): Promise<Array<{ id: string; name: string; resolvedType: string }>> {
  const created: Array<{ id: string; name: string; resolvedType: string }> = [];

  for (const spec of specs) {
    let collectionId = spec.collectionId;
    if (!collectionId) {
      if (!spec.collectionName) {
        throw new Error(`Variable ${spec.name} is missing collectionId or collectionName`);
      }
      const collection = await ensureCollection(bridge, spec.collectionName, Object.keys(spec.valuesByMode)[0] ?? "Base");
      collectionId = collection.id;

      const translatedValues = Object.fromEntries(
        Object.entries(spec.valuesByMode).map(([modeName, value]) => {
          const modeId = collection.modes[modeName] ?? collection.modes.Base ?? collection.modes.Light;
          if (!modeId) {
            throw new Error(`Mode ${modeName} not found in collection ${collection.name}`);
          }
          return [modeId, value];
        })
      );

      const result = await bridge.createVariable(
        spec.name,
        collectionId,
        spec.resolvedType,
        translatedValues,
        spec.description
      ) as { id: string; name: string; resolvedType: string };
      created.push(result);
      continue;
    }

    const result = await bridge.createVariable(
      spec.name,
      collectionId,
      spec.resolvedType,
      spec.valuesByMode,
      spec.description
    ) as { id: string; name: string; resolvedType: string };
    created.push(result);
  }

  return created;
}

export async function dsVariablesHandler(args: DsVariablesArgs): Promise<DsVariablesResult> {
  const bridge = await getBridge();
  const diagnostics = await bridge.getCapabilities();

  if (args.action === "diagnose") {
    return {
      ok: true,
      action: args.action,
      diagnostics,
      createdCollections: [],
      createdVariables: [],
      notes: [],
    };
  }

  if (!diagnostics.variablesApi || !diagnostics.localVariablesApi) {
    return {
      ok: false,
      action: args.action,
      diagnostics,
      createdCollections: [],
      createdVariables: [],
      notes: ["Variables API is unavailable in the current plugin runtime."],
    };
  }

  const brandName = args.brandName ?? "Design System";
  const createdCollections: Array<{ id: string; name: string }> = [];
  const createdVariables: Array<{ id: string; name: string; resolvedType: string }> = [];
  const notes: string[] = [];

  if (args.action === "scaffold-primitives" || args.action === "scaffold-all") {
    const primitiveResult = await dsPrimitivesHandler({
      brandName,
      primaryColor: args.primaryColor,
      secondaryColor: args.secondaryColor,
      neutralColor: args.neutralColor,
      accentColor: args.accentColor,
      createSemantics: args.createSemantics,
      createDarkMode: args.createDarkMode,
    } as DsPrimitivesArgs);
    createdCollections.push(...primitiveResult.collectionsCreated.map(({ id, name }) => ({ id, name })));
    notes.push("Primitive collections scaffolded.");
  }

  if (args.action === "create-collections") {
    for (const collectionSpec of args.collections ?? []) {
      const ensured = await ensureCollection(
        bridge,
        collectionSpec.name,
        collectionSpec.initialModeName ?? "Base",
        collectionSpec.modes ?? []
      );
      createdCollections.push({ id: ensured.id, name: ensured.name });
    }
  }

  if (args.action === "create-variables") {
    createdVariables.push(...await createVariablesFromSpec(bridge, args.variables ?? []));
  }

  if (args.action === "scaffold-semantics" || args.action === "scaffold-all") {
    await ensureCollection(bridge, `${brandName} Semantic Colors`, "Light", args.createDarkMode === false ? [] : ["Dark"]);
    await ensureCollection(bridge, `${brandName} Semantic Space`, "Base");
    await ensureCollection(bridge, `${brandName} Semantic Radius`, "Base");
    await ensureCollection(bridge, `${brandName} Semantic Typography`, "Base");

    const variableIndex = variableMapByName(await getAllCollections(bridge));
    const semanticSpecs = buildSemanticVariableSpecs(brandName, variableIndex, args.createDarkMode !== false);
    createdVariables.push(...await createVariablesFromSpec(bridge, semanticSpecs));
    notes.push("Semantic collections scaffolded with primitive aliases.");
  }

  if (args.action === "scaffold-components" || args.action === "scaffold-all") {
    await ensureCollection(bridge, `${brandName} Component Tokens`, "Base");
    const variableIndex = variableMapByName(await getAllCollections(bridge));
    const templates = args.componentTemplates?.length
      ? args.componentTemplates
      : [
          { componentName: "button", variant: "primary" },
          { componentName: "input", variant: "default", parts: ["container", "label", "text"], properties: ["background", "text", "radius", "padding-x"], states: ["default", "focus", "disabled"] },
        ];
    const componentSpecs = buildComponentVariableSpecs(brandName, variableIndex, templates);
    createdVariables.push(...await createVariablesFromSpec(bridge, componentSpecs));
    notes.push("Component token collection scaffolded with semantic aliases.");
  }

  return {
    ok: true,
    action: args.action,
    diagnostics,
    createdCollections,
    createdVariables,
    notes,
  };
}
