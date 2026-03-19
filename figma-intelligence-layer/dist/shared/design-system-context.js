"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesignSystemContextStore = void 0;
exports.getDesignSystemContextStore = getDesignSystemContextStore;
const figma_bridge_1 = require("./figma-bridge");
const design_system_intelligence_1 = require("./design-system-intelligence");
const design_system_normalizers_1 = require("./design-system-normalizers");
const STYLE_BUCKET_TO_TYPE = {
    paint: "PAINT",
    text: "TEXT",
    effect: "EFFECT",
    grid: "GRID",
};
function uniqueStrings(values) {
    return Array.from(new Set(values.filter(Boolean)));
}
function mapListIndex(items) {
    return new Map(items.map((item) => [item.id, item]));
}
function pushIndex(map, key, value) {
    const existing = map.get(key) ?? [];
    if (!existing.includes(value)) {
        existing.push(value);
        map.set(key, existing);
    }
}
function normalizeComponentSets(componentSets) {
    const normalizedSets = [];
    const normalizedComponents = [];
    const variantSchemas = {};
    for (const set of componentSets) {
        const variantSchema = (0, design_system_normalizers_1.inferVariantSchema)(set);
        const setIntents = new Set((0, design_system_normalizers_1.inferComponentIntents)(set.name, set.description));
        const childComponentIds = uniqueStrings(set.children.map((child) => child.id).filter((value) => Boolean(value)));
        for (const child of set.children) {
            const childIntents = (0, design_system_normalizers_1.inferComponentIntents)(child.name, child.description);
            for (const intent of childIntents) {
                setIntents.add(intent);
            }
            normalizedComponents.push({
                id: child.id,
                setId: set.id,
                name: child.name,
                normalizedName: (0, design_system_normalizers_1.normalizeName)(child.name),
                description: child.description,
                variantProps: Object.fromEntries(Object.entries((0, design_system_normalizers_1.inferVariantSchema)({
                    ...set,
                    children: [child],
                })?.properties ?? {}).map(([property, values]) => [property, values[0] ?? ""])),
                intents: childIntents,
            });
        }
        normalizedSets.push({
            id: set.id,
            name: set.name,
            normalizedName: (0, design_system_normalizers_1.normalizeName)(set.name),
            description: set.description,
            childComponentIds: childComponentIds.length > 0
                ? childComponentIds
                : [(0, design_system_normalizers_1.firstComponentChildId)(set.children)].filter((value) => Boolean(value)),
            variantSchema,
            intents: uniqueStrings(Array.from(setIntents)),
        });
        if (variantSchema) {
            variantSchemas[set.id] = variantSchema;
        }
    }
    return {
        componentSets: normalizedSets,
        components: normalizedComponents,
        variantSchemas,
    };
}
function normalizeTokens(tokens) {
    return tokens.map((token) => ({
        id: token.id,
        name: token.name,
        normalizedName: (0, design_system_normalizers_1.normalizeName)(token.name),
        type: token.type,
        collectionId: token.collectionId,
        value: token.value,
        modeValues: token.modeValues,
        semanticGroup: (0, design_system_normalizers_1.inferTokenSemanticGroup)(token),
    }));
}
function normalizeStyles(styles) {
    if (!styles)
        return [];
    const normalized = [];
    for (const [bucketName, styleType] of Object.entries(STYLE_BUCKET_TO_TYPE)) {
        const bucket = styles[bucketName];
        if (!Array.isArray(bucket))
            continue;
        for (const item of bucket) {
            if (!item || typeof item !== "object")
                continue;
            const candidate = item;
            if (typeof candidate.id !== "string" || typeof candidate.name !== "string")
                continue;
            normalized.push({
                id: candidate.id,
                name: candidate.name,
                normalizedName: (0, design_system_normalizers_1.normalizeName)(candidate.name),
                styleType,
                semanticGroup: (0, design_system_normalizers_1.inferStyleSemanticGroup)(candidate.name, styleType),
            });
        }
    }
    return normalized;
}
function normalizePages(pages) {
    return pages.map((page) => ({ id: page.id, name: page.name }));
}
function buildIndexes(inventory) {
    const componentsByNormalizedName = new Map();
    const tokensByNormalizedName = new Map();
    const componentsByIntent = new Map();
    for (const component of inventory.components) {
        pushIndex(componentsByNormalizedName, component.normalizedName, component.id);
        for (const intent of component.intents) {
            pushIndex(componentsByIntent, intent, component.id);
        }
    }
    for (const token of inventory.variables) {
        pushIndex(tokensByNormalizedName, token.normalizedName, token.id);
    }
    return {
        componentById: mapListIndex(inventory.components),
        componentSetById: mapListIndex(inventory.componentSets),
        tokenById: mapListIndex(inventory.variables),
        styleById: mapListIndex(inventory.styles),
        componentsByNormalizedName,
        tokensByNormalizedName,
        componentsByIntent,
    };
}
class DesignSystemContextStore {
    bridge;
    snapshot = null;
    listeners = new Set();
    staleScopes = new Set([
        "components",
        "variables",
        "styles",
        "pages",
        "instances",
    ]);
    refreshTimer = null;
    activeHydration = null;
    rawComponentSets = [];
    rawVariables = [];
    rawStyles = undefined;
    rawPages = [];
    rawInstances = [];
    constructor(bridge) {
        this.bridge = bridge;
        this.bridge.onEvent("*", (event) => {
            this.handleBridgeEvent(event);
        });
    }
    async hydrate(force = false) {
        if (!force && this.snapshot && this.staleScopes.size === 0) {
            return this.snapshot;
        }
        if (this.activeHydration && !force) {
            return this.activeHydration;
        }
        this.activeHydration = this.hydrateInternal(force).finally(() => {
            this.activeHydration = null;
        });
        return this.activeHydration;
    }
    getSnapshot() {
        return this.snapshot;
    }
    invalidate(scope = "all") {
        if (scope === "selection")
            return;
        if (scope === "all") {
            this.staleScopes = new Set(["components", "variables", "styles", "pages", "instances"]);
            return;
        }
        this.staleScopes.add(scope);
    }
    onUpdate(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    async refreshComponents() {
        this.rawComponentSets = await this.bridge.getComponentSets();
        this.staleScopes.delete("components");
        this.rebuildSnapshot("live");
    }
    async refreshVariables() {
        this.rawVariables = await this.bridge.getTokens();
        this.staleScopes.delete("variables");
        this.rebuildSnapshot("live");
    }
    async refreshStyles() {
        this.rawStyles = await this.bridge.getStyles();
        this.staleScopes.delete("styles");
        this.rebuildSnapshot("live");
    }
    async refreshInstances() {
        this.rawInstances = await this.bridge.getAllInstances();
        this.staleScopes.delete("instances");
        this.rebuildSnapshot("live");
    }
    async refreshPages() {
        this.rawPages = await this.bridge.getAllPages();
        this.staleScopes.delete("pages");
        this.rebuildSnapshot("live");
    }
    handleBridgeEvent(event) {
        switch (event.eventType) {
            case "bridge.ready":
                this.invalidate("all");
                void this.hydrate();
                return;
            case "currentpagechange":
                this.invalidate("components");
                this.invalidate("instances");
                void Promise.all([this.refreshComponents(), this.refreshInstances()]);
                return;
            case "selectionchange":
                return;
            case "documentchange":
                this.scheduleIncrementalRefresh(event.payload);
                return;
            default:
                return;
        }
    }
    async hydrateInternal(force) {
        const shouldFetchAll = force || !this.snapshot;
        const statusPromise = this.bridge.getStatus();
        const tasks = [];
        if (shouldFetchAll || this.staleScopes.has("pages")) {
            tasks.push(this.refreshPages());
        }
        if (shouldFetchAll || this.staleScopes.has("components")) {
            tasks.push(this.refreshComponents());
        }
        if (shouldFetchAll || this.staleScopes.has("variables")) {
            tasks.push(this.refreshVariables());
        }
        if (shouldFetchAll || this.staleScopes.has("styles")) {
            tasks.push(this.refreshStyles());
        }
        if (shouldFetchAll || this.staleScopes.has("instances")) {
            tasks.push(this.refreshInstances());
        }
        const [status] = await Promise.all([statusPromise, ...tasks]);
        return this.rebuildSnapshot(force ? "fetched" : "live", status);
    }
    scheduleIncrementalRefresh(summary) {
        const changes = summary?.documentChanges ?? [];
        for (const change of changes) {
            const nodeType = (0, design_system_normalizers_1.normalizeName)(change.nodeType ?? "");
            const changeType = (0, design_system_normalizers_1.normalizeName)(change.type);
            if (nodeType.includes("component") || changeType.includes("component")) {
                this.invalidate("components");
                this.invalidate("instances");
            }
            if (nodeType.includes("instance")) {
                this.invalidate("instances");
            }
            if (nodeType.includes("page")) {
                this.invalidate("pages");
            }
            if (changeType.includes("variable")) {
                this.invalidate("variables");
            }
            if (changeType.includes("style")) {
                this.invalidate("styles");
            }
        }
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = null;
            const refreshes = [];
            if (this.staleScopes.has("components"))
                refreshes.push(this.refreshComponents());
            if (this.staleScopes.has("variables"))
                refreshes.push(this.refreshVariables());
            if (this.staleScopes.has("styles"))
                refreshes.push(this.refreshStyles());
            if (this.staleScopes.has("pages"))
                refreshes.push(this.refreshPages());
            if (this.staleScopes.has("instances"))
                refreshes.push(this.refreshInstances());
            if (refreshes.length === 0)
                return;
            void Promise.all(refreshes);
        }, 50);
    }
    rebuildSnapshot(source, status) {
        const normalizedComponents = normalizeComponentSets(this.rawComponentSets);
        const inventory = {
            componentSets: normalizedComponents.componentSets,
            components: normalizedComponents.components,
            variables: normalizeTokens(this.rawVariables),
            styles: normalizeStyles(this.rawStyles),
            pages: normalizePages(this.rawPages),
            instances: this.rawInstances,
        };
        const indexes = buildIndexes(inventory);
        const now = Date.now();
        const freshness = this.snapshot?.freshness ?? {
            componentSets: 0,
            variables: 0,
            styles: 0,
            pages: 0,
            instances: 0,
        };
        if (!this.staleScopes.has("components"))
            freshness.componentSets = now;
        if (!this.staleScopes.has("variables"))
            freshness.variables = now;
        if (!this.staleScopes.has("styles"))
            freshness.styles = now;
        if (!this.staleScopes.has("pages"))
            freshness.pages = now;
        if (!this.staleScopes.has("instances"))
            freshness.instances = now;
        const intelligence = (0, design_system_intelligence_1.buildDesignSystemIntelligence)({
            componentSets: inventory.componentSets,
            components: inventory.components,
            tokens: inventory.variables,
            styles: inventory.styles,
            instances: inventory.instances,
            variantSchemas: normalizedComponents.variantSchemas,
        });
        const activeStatus = status ?? this.snapshotStatus();
        const currentPage = activeStatus.currentPage;
        this.snapshot = {
            file: {
                fileName: activeStatus.fileName,
                pageId: currentPage?.id,
                pageName: currentPage?.name,
                lastSyncedAt: now,
                source,
            },
            inventory,
            indexes,
            intelligence: {
                aliases: intelligence.aliases,
                variantSchemas: intelligence.variantSchemas,
                semanticTokenGroups: intelligence.semanticTokenGroups,
                preferredComponentsByIntent: intelligence.preferredComponentsByIntent,
                namingRules: intelligence.namingRules,
            },
            freshness,
        };
        for (const listener of this.listeners) {
            listener(this.snapshot);
        }
        return this.snapshot;
    }
    snapshotStatus() {
        return this.snapshot
            ? {
                fileName: this.snapshot.file.fileName,
                currentPage: this.snapshot.file.pageId && this.snapshot.file.pageName
                    ? { id: this.snapshot.file.pageId, name: this.snapshot.file.pageName }
                    : undefined,
            }
            : {};
    }
}
exports.DesignSystemContextStore = DesignSystemContextStore;
let designSystemContextStore = null;
async function getDesignSystemContextStore(bridge) {
    if (bridge) {
        return new DesignSystemContextStore(bridge);
    }
    if (!designSystemContextStore) {
        designSystemContextStore = new DesignSystemContextStore(await (0, figma_bridge_1.getBridge)());
    }
    return designSystemContextStore;
}
//# sourceMappingURL=design-system-context.js.map