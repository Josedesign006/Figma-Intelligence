"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dsVariablesHandler = dsVariablesHandler;
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const index_js_1 = require("../ds-primitives/index.js");
const semantic_token_catalog_js_1 = require("../../../shared/semantic-token-catalog.js");
async function getAllCollections(bridge) {
    return await bridge.getVariables(undefined, "full");
}
function variableMapByName(collections) {
    const map = new Map();
    for (const collection of collections) {
        for (const variable of collection.variables) {
            map.set(variable.name, { id: variable.id, collectionId: collection.id });
            map.set(`${collection.name}::${variable.name}`, { id: variable.id, collectionId: collection.id });
        }
    }
    return map;
}
async function ensureCollection(bridge, name, initialModeName = "Base", modes = []) {
    const collections = await getAllCollections(bridge);
    let collection = collections.find((item) => item.name === name);
    if (!collection) {
        const created = await bridge.createVariableCollection(name, initialModeName);
        collection = {
            id: created.id,
            name: created.name,
            modes: created.modes,
            variables: [],
        };
    }
    const refreshed = await getAllCollections(bridge);
    const current = refreshed.find((item) => item.id === collection.id || item.name === name);
    if (!current)
        throw new Error(`Failed to load collection: ${name}`);
    const modeMap = Object.fromEntries(current.modes.map((mode) => [mode.name, mode.modeId]));
    for (const modeName of [initialModeName, ...modes]) {
        if (!modeMap[modeName]) {
            const created = await bridge.addMode(current.id, modeName);
            modeMap[created.modeName] = created.modeId;
        }
    }
    return { id: current.id, name: current.name, modes: modeMap };
}
function makeAlias(variableId) {
    return { type: "VARIABLE_ALIAS", variableId };
}
function requireVariable(variableIndex, name) {
    const found = variableIndex.get(name);
    if (!found) {
        throw new Error(`Required variable not found: ${name}`);
    }
    return found.id;
}
function buildSemanticVariableSpecs(brandName, variableIndex, createDarkMode) {
    const specs = [];
    const tryAlias = (ref) => {
        const found = variableIndex.get(ref);
        if (found)
            return makeAlias(found.id);
        return null;
    };
    const lightDark = (lightRef, darkRef) => {
        const lightAlias = tryAlias(lightRef);
        if (!lightAlias)
            return {}; // skip if primitive not found
        const values = { Light: lightAlias };
        if (createDarkMode) {
            const darkAlias = tryAlias(darkRef);
            if (darkAlias)
                values.Dark = darkAlias;
        }
        return values;
    };
    const baseOnly = (ref) => {
        const alias = tryAlias(ref);
        if (!alias)
            return {};
        return { Base: alias };
    };
    // Iterate the full semantic token catalog
    for (const entry of semantic_token_catalog_js_1.SEMANTIC_TOKEN_CATALOG) {
        // Determine collection name based on category
        let collectionName;
        if (entry.type === "COLOR") {
            collectionName = `${brandName} Semantic Colors`;
        }
        else if (entry.category === "spacing") {
            collectionName = `${brandName} Semantic Space`;
        }
        else if (entry.category === "radius") {
            collectionName = `${brandName} Semantic Radius`;
        }
        else {
            collectionName = `${brandName} Semantic Colors`;
        }
        // Convert token name to dot-notation for variable name
        const varName = entry.name.replace(/\//g, ".");
        if (entry.type === "COLOR") {
            const valuesByMode = lightDark(entry.lightRef, entry.darkRef);
            if (Object.keys(valuesByMode).length === 0)
                continue;
            specs.push({
                collectionName,
                name: varName,
                resolvedType: "COLOR",
                valuesByMode,
                description: entry.description,
            });
        }
        else {
            const valuesByMode = baseOnly(entry.lightRef);
            if (Object.keys(valuesByMode).length === 0)
                continue;
            specs.push({
                collectionName,
                name: varName,
                resolvedType: "FLOAT",
                valuesByMode,
                description: entry.description,
            });
        }
    }
    // Also add typography semantic aliases
    const typoAliases = [
        ["typography.body.md.size", "typography/size/md", "Body medium font size"],
        ["typography.body.md.line-height", "typography/line-height/md", "Body medium line height"],
        ["typography.body.sm.size", "typography/size/sm", "Body small font size"],
        ["typography.body.sm.line-height", "typography/line-height/sm", "Body small line height"],
        ["typography.heading.h3.size", "typography/size/2xl", "Heading h3 font size"],
        ["typography.heading.h3.line-height", "typography/line-height/2xl", "Heading h3 line height"],
        ["typography.label.md.size", "typography/size/sm", "Label medium font size"],
        ["typography.label.md.weight", "typography/weight/medium", "Label medium font weight"],
        ["typography.label.sm.size", "typography/size/xs", "Label small font size"],
        ["typography.label.sm.weight", "typography/weight/medium", "Label small font weight"],
    ];
    for (const [name, ref, desc] of typoAliases) {
        const valuesByMode = baseOnly(ref);
        if (Object.keys(valuesByMode).length === 0)
            continue;
        specs.push({
            collectionName: `${brandName} Semantic Typography`,
            name,
            resolvedType: "FLOAT",
            valuesByMode,
            description: desc,
        });
    }
    return specs;
}
function buildComponentVariableSpecs(brandName, variableIndex, templates) {
    const items = [];
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
                    if (template.variant)
                        nameParts.push(template.variant);
                    nameParts.push(part, property, state);
                    const name = nameParts.join(".");
                    let resolvedType = "COLOR";
                    let valuesByMode = { Base: colorBg };
                    if (property.includes("text")) {
                        resolvedType = "COLOR";
                        valuesByMode = { Base: colorText };
                    }
                    else if (property.includes("radius")) {
                        resolvedType = "FLOAT";
                        valuesByMode = { Base: radius };
                    }
                    else if (property.includes("padding") || property.includes("gap")) {
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
async function createVariablesFromSpec(bridge, specs) {
    const created = [];
    for (const spec of specs) {
        let collectionId = spec.collectionId;
        if (!collectionId) {
            if (!spec.collectionName) {
                throw new Error(`Variable ${spec.name} is missing collectionId or collectionName`);
            }
            const collection = await ensureCollection(bridge, spec.collectionName, Object.keys(spec.valuesByMode)[0] ?? "Base");
            collectionId = collection.id;
            const translatedValues = Object.fromEntries(Object.entries(spec.valuesByMode).map(([modeName, value]) => {
                const modeId = collection.modes[modeName] ?? collection.modes.Base ?? collection.modes.Light;
                if (!modeId) {
                    throw new Error(`Mode ${modeName} not found in collection ${collection.name}`);
                }
                return [modeId, value];
            }));
            const result = await bridge.createVariable(spec.name, collectionId, spec.resolvedType, translatedValues, spec.description);
            created.push(result);
            continue;
        }
        const result = await bridge.createVariable(spec.name, collectionId, spec.resolvedType, spec.valuesByMode, spec.description);
        created.push(result);
    }
    return created;
}
async function dsVariablesHandler(args) {
    const bridge = await (0, figma_bridge_js_1.getBridge)();
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
    const createdCollections = [];
    const createdVariables = [];
    const notes = [];
    if (args.action === "scaffold-primitives" || args.action === "scaffold-all") {
        const primitiveResult = await (0, index_js_1.dsPrimitivesHandler)({
            brandName,
            primaryColor: args.primaryColor,
            secondaryColor: args.secondaryColor,
            neutralColor: args.neutralColor,
            accentColor: args.accentColor,
            createSemantics: args.createSemantics,
            createDarkMode: args.createDarkMode,
        });
        createdCollections.push(...primitiveResult.collectionsCreated.map(({ id, name }) => ({ id, name })));
        notes.push("Primitive collections scaffolded.");
    }
    if (args.action === "create-collections") {
        for (const collectionSpec of args.collections ?? []) {
            const ensured = await ensureCollection(bridge, collectionSpec.name, collectionSpec.initialModeName ?? "Base", collectionSpec.modes ?? []);
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
//# sourceMappingURL=index.js.map