import { FigmaBridge } from "./figma-bridge";
import { DSVariantSchema, NamingRule } from "./design-system-normalizers";
import { FigmaBridgeEvent } from "./types";
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
export type ContextScope = "all" | "components" | "variables" | "styles" | "pages" | "instances" | "selection";
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
type FigmaBridgeLike = Pick<FigmaBridge, "getStatus" | "getAllPages" | "getComponentSets" | "getTokens" | "getStyles" | "getAllInstances" | "onEvent">;
export declare class DesignSystemContextStore {
    private bridge;
    private snapshot;
    private listeners;
    private staleScopes;
    private refreshTimer;
    private activeHydration;
    private rawComponentSets;
    private rawVariables;
    private rawStyles;
    private rawPages;
    private rawInstances;
    constructor(bridge: FigmaBridgeLike);
    hydrate(force?: boolean): Promise<DesignSystemContext>;
    getSnapshot(): DesignSystemContext | null;
    invalidate(scope?: ContextScope): void;
    onUpdate(listener: (ctx: DesignSystemContext) => void): () => void;
    refreshComponents(): Promise<void>;
    refreshVariables(): Promise<void>;
    refreshStyles(): Promise<void>;
    refreshInstances(): Promise<void>;
    refreshPages(): Promise<void>;
    handleBridgeEvent(event: FigmaBridgeEvent): void;
    private hydrateInternal;
    private scheduleIncrementalRefresh;
    private rebuildSnapshot;
    private snapshotStatus;
}
export declare function getDesignSystemContextStore(bridge?: FigmaBridge): Promise<DesignSystemContextStore>;
export {};
//# sourceMappingURL=design-system-context.d.ts.map