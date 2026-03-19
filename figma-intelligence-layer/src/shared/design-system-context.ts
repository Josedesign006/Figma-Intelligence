import { FigmaBridge, getBridge } from "./figma-bridge";
import {
  buildDesignSystemIntelligence,
  DesignSystemIntelligence,
} from "./design-system-intelligence";
import {
  DSVariantSchema,
  NamingRule,
  firstComponentChildId,
  inferComponentIntents,
  inferStyleSemanticGroup,
  inferTokenSemanticGroup,
  inferVariantSchema,
  normalizeName,
} from "./design-system-normalizers";
import {
  ComponentSet,
  FigmaBridgeEvent,
  FigmaBridgeEventType,
  FigmaDocumentChangeSummary,
  FigmaPageSummary,
  Token,
} from "./types";

export interface DSComponentSet {
  id: string;
  name: string;
  normalizedName: string;
  description?: string;
  childComponentIds: string[];
  variantSchema?: DSVariantSchema;
  intents: string[];
}

export interface DSComponent {
  id: string;
  setId?: string;
  name: string;
  normalizedName: string;
  description?: string;
  variantProps: Record<string, string>;
  intents: string[];
}

export interface DSToken {
  id: string;
  name: string;
  normalizedName: string;
  type: string;
  collectionId: string;
  value: unknown;
  modeValues?: Record<string, unknown>;
  semanticGroup?: string;
}

export interface DSStyle {
  id: string;
  name: string;
  normalizedName: string;
  styleType: "PAINT" | "TEXT" | "EFFECT" | "GRID" | "UNKNOWN";
  semanticGroup?: string;
}

export interface DSInstance {
  id: string;
  name: string;
  mainComponentId: string;
  pageId: string;
}

export interface DSPage {
  id: string;
  name: string;
}

export type ContextScope =
  | "all"
  | "components"
  | "variables"
  | "styles"
  | "pages"
  | "instances"
  | "selection";

export interface DesignSystemContext {
  file: {
    fileName?: string;
    pageId?: string;
    pageName?: string;
    lastSyncedAt: number;
    source: "live" | "fetched" | "mixed";
  };
  inventory: {
    componentSets: DSComponentSet[];
    components: DSComponent[];
    variables: DSToken[];
    styles: DSStyle[];
    pages: DSPage[];
    instances: DSInstance[];
  };
  indexes: {
    componentById: Map<string, DSComponent>;
    componentSetById: Map<string, DSComponentSet>;
    tokenById: Map<string, DSToken>;
    styleById: Map<string, DSStyle>;
    componentsByNormalizedName: Map<string, string[]>;
    tokensByNormalizedName: Map<string, string[]>;
    componentsByIntent: Map<string, string[]>;
  };
  intelligence: {
    aliases: Record<string, string[]>;
    variantSchemas: Record<string, DSVariantSchema>;
    semanticTokenGroups: Record<string, string[]>;
    preferredComponentsByIntent: Record<string, string[]>;
    namingRules: NamingRule[];
  };
  freshness: {
    componentSets: number;
    variables: number;
    styles: number;
    pages: number;
    instances: number;
  };
}

type FigmaBridgeLike = Pick<
  FigmaBridge,
  "getStatus" | "getAllPages" | "getComponentSets" | "getTokens" | "getStyles" | "getAllInstances" | "onEvent"
>;

type RawStyles = Record<string, unknown> | undefined;

const STYLE_BUCKET_TO_TYPE: Record<string, DSStyle["styleType"]> = {
  paint: "PAINT",
  text: "TEXT",
  effect: "EFFECT",
  grid: "GRID",
};

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function mapListIndex<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function pushIndex(map: Map<string, string[]>, key: string, value: string) {
  const existing = map.get(key) ?? [];
  if (!existing.includes(value)) {
    existing.push(value);
    map.set(key, existing);
  }
}

function normalizeComponentSets(componentSets: ComponentSet[]): {
  componentSets: DSComponentSet[];
  components: DSComponent[];
  variantSchemas: Record<string, DSVariantSchema>;
} {
  const normalizedSets: DSComponentSet[] = [];
  const normalizedComponents: DSComponent[] = [];
  const variantSchemas: Record<string, DSVariantSchema> = {};

  for (const set of componentSets) {
    const variantSchema = inferVariantSchema(set);
    const setIntents = new Set<string>(inferComponentIntents(set.name, set.description));
    const childComponentIds = uniqueStrings(
      set.children.map((child) => child.id).filter((value): value is string => Boolean(value))
    );

    for (const child of set.children) {
      const childIntents = inferComponentIntents(child.name, child.description);
      for (const intent of childIntents) {
        setIntents.add(intent);
      }

      normalizedComponents.push({
        id: child.id,
        setId: set.id,
        name: child.name,
        normalizedName: normalizeName(child.name),
        description: child.description,
        variantProps: Object.fromEntries(
          Object.entries(inferVariantSchema({
            ...set,
            children: [child],
          })?.properties ?? {}).map(([property, values]) => [property, values[0] ?? ""])
        ),
        intents: childIntents,
      });
    }

    normalizedSets.push({
      id: set.id,
      name: set.name,
      normalizedName: normalizeName(set.name),
      description: set.description,
      childComponentIds: childComponentIds.length > 0
        ? childComponentIds
        : [firstComponentChildId(set.children)].filter((value): value is string => Boolean(value)),
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

function normalizeTokens(tokens: Token[]): DSToken[] {
  return tokens.map((token) => ({
    id: token.id,
    name: token.name,
    normalizedName: normalizeName(token.name),
    type: token.type,
    collectionId: token.collectionId,
    value: token.value,
    modeValues: token.modeValues as Record<string, unknown> | undefined,
    semanticGroup: inferTokenSemanticGroup(token),
  }));
}

function normalizeStyles(styles: RawStyles): DSStyle[] {
  if (!styles) return [];

  const normalized: DSStyle[] = [];

  for (const [bucketName, styleType] of Object.entries(STYLE_BUCKET_TO_TYPE)) {
    const bucket = styles[bucketName];
    if (!Array.isArray(bucket)) continue;

    for (const item of bucket) {
      if (!item || typeof item !== "object") continue;
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.id !== "string" || typeof candidate.name !== "string") continue;

      normalized.push({
        id: candidate.id,
        name: candidate.name,
        normalizedName: normalizeName(candidate.name),
        styleType,
        semanticGroup: inferStyleSemanticGroup(candidate.name, styleType),
      });
    }
  }

  return normalized;
}

function normalizePages(pages: FigmaPageSummary[]): DSPage[] {
  return pages.map((page) => ({ id: page.id, name: page.name }));
}

function buildIndexes(inventory: DesignSystemContext["inventory"]): DesignSystemContext["indexes"] {
  const componentsByNormalizedName = new Map<string, string[]>();
  const tokensByNormalizedName = new Map<string, string[]>();
  const componentsByIntent = new Map<string, string[]>();

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

export class DesignSystemContextStore {
  private snapshot: DesignSystemContext | null = null;
  private listeners = new Set<(ctx: DesignSystemContext) => void>();
  private staleScopes = new Set<Exclude<ContextScope, "all" | "selection">>([
    "components",
    "variables",
    "styles",
    "pages",
    "instances",
  ]);
  private refreshTimer: NodeJS.Timeout | null = null;
  private activeHydration: Promise<DesignSystemContext> | null = null;
  private rawComponentSets: ComponentSet[] = [];
  private rawVariables: Token[] = [];
  private rawStyles: RawStyles = undefined;
  private rawPages: FigmaPageSummary[] = [];
  private rawInstances: DSInstance[] = [];

  constructor(private bridge: FigmaBridgeLike) {
    this.bridge.onEvent("*", (event) => {
      this.handleBridgeEvent(event);
    });
  }

  async hydrate(force = false): Promise<DesignSystemContext> {
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

  getSnapshot(): DesignSystemContext | null {
    return this.snapshot;
  }

  invalidate(scope: ContextScope = "all"): void {
    if (scope === "selection") return;

    if (scope === "all") {
      this.staleScopes = new Set(["components", "variables", "styles", "pages", "instances"]);
      return;
    }

    this.staleScopes.add(scope);
  }

  onUpdate(listener: (ctx: DesignSystemContext) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async refreshComponents(): Promise<void> {
    this.rawComponentSets = await this.bridge.getComponentSets();
    this.staleScopes.delete("components");
    this.rebuildSnapshot("live");
  }

  async refreshVariables(): Promise<void> {
    this.rawVariables = await this.bridge.getTokens();
    this.staleScopes.delete("variables");
    this.rebuildSnapshot("live");
  }

  async refreshStyles(): Promise<void> {
    this.rawStyles = await this.bridge.getStyles();
    this.staleScopes.delete("styles");
    this.rebuildSnapshot("live");
  }

  async refreshInstances(): Promise<void> {
    this.rawInstances = await this.bridge.getAllInstances();
    this.staleScopes.delete("instances");
    this.rebuildSnapshot("live");
  }

  async refreshPages(): Promise<void> {
    this.rawPages = await this.bridge.getAllPages();
    this.staleScopes.delete("pages");
    this.rebuildSnapshot("live");
  }

  handleBridgeEvent(event: FigmaBridgeEvent): void {
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
        this.scheduleIncrementalRefresh(event.payload as FigmaDocumentChangeSummary);
        return;
      default:
        return;
    }
  }

  private async hydrateInternal(force: boolean): Promise<DesignSystemContext> {
    const shouldFetchAll = force || !this.snapshot;
    const statusPromise = this.bridge.getStatus();
    const tasks: Promise<unknown>[] = [];

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
    return this.rebuildSnapshot(force ? "fetched" : "live", status as Record<string, unknown>);
  }

  private scheduleIncrementalRefresh(summary?: FigmaDocumentChangeSummary): void {
    const changes = summary?.documentChanges ?? [];

    for (const change of changes) {
      const nodeType = normalizeName(change.nodeType ?? "");
      const changeType = normalizeName(change.type);

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
      const refreshes: Promise<unknown>[] = [];

      if (this.staleScopes.has("components")) refreshes.push(this.refreshComponents());
      if (this.staleScopes.has("variables")) refreshes.push(this.refreshVariables());
      if (this.staleScopes.has("styles")) refreshes.push(this.refreshStyles());
      if (this.staleScopes.has("pages")) refreshes.push(this.refreshPages());
      if (this.staleScopes.has("instances")) refreshes.push(this.refreshInstances());

      if (refreshes.length === 0) return;
      void Promise.all(refreshes);
    }, 50);
  }

  private rebuildSnapshot(
    source: DesignSystemContext["file"]["source"],
    status?: Record<string, unknown>
  ): DesignSystemContext {
    const normalizedComponents = normalizeComponentSets(this.rawComponentSets);
    const inventory: DesignSystemContext["inventory"] = {
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

    if (!this.staleScopes.has("components")) freshness.componentSets = now;
    if (!this.staleScopes.has("variables")) freshness.variables = now;
    if (!this.staleScopes.has("styles")) freshness.styles = now;
    if (!this.staleScopes.has("pages")) freshness.pages = now;
    if (!this.staleScopes.has("instances")) freshness.instances = now;

    const intelligence: DesignSystemIntelligence = buildDesignSystemIntelligence({
      componentSets: inventory.componentSets,
      components: inventory.components,
      tokens: inventory.variables,
      styles: inventory.styles,
      instances: inventory.instances,
      variantSchemas: normalizedComponents.variantSchemas,
    });

    const activeStatus = status ?? this.snapshotStatus();
    const currentPage = activeStatus.currentPage as FigmaPageSummary | undefined;

    this.snapshot = {
      file: {
        fileName: activeStatus.fileName as string | undefined,
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

  private snapshotStatus(): Record<string, unknown> {
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

let designSystemContextStore: DesignSystemContextStore | null = null;

export async function getDesignSystemContextStore(
  bridge?: FigmaBridge
): Promise<DesignSystemContextStore> {
  if (bridge) {
    return new DesignSystemContextStore(bridge);
  }

  if (!designSystemContextStore) {
    designSystemContextStore = new DesignSystemContextStore(await getBridge());
  }

  return designSystemContextStore;
}
