import { FigmaNode, ExecuteResult, ComponentSet, Token, FigmaBridgeEvent, FigmaBridgeEventType, FigmaContextSnapshot } from "./types.js";
import { BridgeCache } from "./cache.js";
import { CompressedResponse, CompressionTier } from "./response-compression.js";
import { EnrichedDesignSystem, ResolvedStyle } from "./enrichment-pipeline.js";
export declare function ensureRelayServer(): Promise<void>;
export declare class FigmaBridge {
    private ws;
    private pendingRequests;
    private eventListeners;
    private context;
    private hasHydratedStatus;
    private hasHydratedSelection;
    private connected;
    private connectPromise;
    private capabilitiesCache;
    private _cache;
    get cache(): BridgeCache;
    isConnected(): boolean;
    private rejectAllPending;
    private invalidateConnection;
    connect(): Promise<void>;
    private emitEvent;
    private updateContextFromEvent;
    private handleMessage;
    private send;
    execute(script: string): Promise<ExecuteResult>;
    getNode(nodeId: string): Promise<FigmaNode>;
    takeScreenshot(nodeId: string): Promise<string>;
    importImage(imageDataUri: string): Promise<{
        imageHash: string;
        byteLength: number;
    }>;
    getComponentSets(): Promise<ComponentSet[]>;
    getTokens(collectionId?: string): Promise<Token[]>;
    getAllPages(): Promise<Array<{
        id: string;
        name: string;
    }>>;
    createPage(name: string): Promise<string>;
    navigateToNode(nodeId: string): Promise<void>;
    getAllInstances(): Promise<Array<{
        id: string;
        mainComponentId: string;
        name: string;
        pageId: string;
    }>>;
    getPrototypeConnections(): Promise<Array<{
        fromId: string;
        fromName: string;
        toId: string;
        toName: string;
        trigger: Record<string, unknown>;
        action: Record<string, unknown>;
    }>>;
    disconnect(): Promise<void>;
    hydrateContext(): Promise<FigmaContextSnapshot>;
    getContextSnapshot(): FigmaContextSnapshot;
    onEvent(eventType: FigmaBridgeEventType | "*", listener: (event: FigmaBridgeEvent) => void): () => void;
    handleIncomingMessage(raw: string): void;
    getStatus(): Promise<Record<string, unknown>>;
    navigate(nodeId: string): Promise<Record<string, unknown>>;
    getSelection(): Promise<Array<{
        id: string;
        name: string;
        type: string;
    }>>;
    getCapabilities(force?: boolean): Promise<Record<string, unknown>>;
    private ensureVariablesApi;
    createVariableCollection(name: string, initialModeName?: string): Promise<Record<string, unknown>>;
    createVariable(name: string, collectionId: string, resolvedType: string, valuesByMode?: Record<string, unknown>, description?: string): Promise<Record<string, unknown>>;
    updateVariable(variableId: string, modeId: string, value: unknown): Promise<Record<string, unknown>>;
    deleteVariable(variableId: string): Promise<Record<string, unknown>>;
    renameVariable(variableId: string, newName: string): Promise<Record<string, unknown>>;
    deleteVariableCollection(collectionId: string): Promise<Record<string, unknown>>;
    addMode(collectionId: string, modeName: string): Promise<Record<string, unknown>>;
    renameMode(collectionId: string, modeId: string, newName: string): Promise<Record<string, unknown>>;
    batchCreateVariables(variables: Array<{
        name: string;
        collectionId: string;
        resolvedType: string;
        valuesByMode?: Record<string, unknown>;
        description?: string;
    }>): Promise<Record<string, unknown>>;
    batchUpdateVariables(updates: Array<{
        variableId: string;
        modeId: string;
        value: unknown;
    }>): Promise<Record<string, unknown>>;
    cloneNode(nodeId: string, x?: number, y?: number): Promise<Record<string, unknown>>;
    deleteNode(nodeId: string): Promise<Record<string, unknown>>;
    moveNode(nodeId: string, x?: number, y?: number, parentId?: string): Promise<Record<string, unknown>>;
    resizeNode(nodeId: string, width: number, height: number): Promise<Record<string, unknown>>;
    renameNode(nodeId: string, newName: string): Promise<Record<string, unknown>>;
    setFills(nodeId: string, fills: unknown[]): Promise<Record<string, unknown>>;
    setStrokes(nodeId: string, strokes: unknown[], strokeWeight?: number): Promise<Record<string, unknown>>;
    setText(nodeId: string, characters: string, fontSize?: number): Promise<Record<string, unknown>>;
    searchComponents(query: string, limit?: number): Promise<Array<Record<string, unknown>>>;
    instantiateComponent(nodeId: string, variant?: Record<string, string>, x?: number, y?: number, parentId?: string): Promise<Record<string, unknown>>;
    setDescription(nodeId: string, description: string): Promise<Record<string, unknown>>;
    bindVariables(bindings: Array<{
        nodeId: string;
        field: string;
        variableId: string;
        fillIndex?: number;
    }>): Promise<{
        bound: number;
        total: number;
    }>;
    getVariables(collectionId?: string, verbosity?: string): Promise<unknown[]>;
    getStyles(): Promise<Record<string, unknown>>;
    /**
     * Get enriched design system data — tokens organized semantically,
     * components categorized, relationships mapped. Cached for 5 minutes.
     */
    getEnrichedDesignSystem(): Promise<EnrichedDesignSystem>;
    /**
     * Get a node with resolved styles — fills as hex, typography categorized,
     * spacing grid-snapped, radius categorized.
     */
    getNodeEnriched(nodeId: string): Promise<{
        node: FigmaNode;
        styles: ResolvedStyle;
    }>;
    /**
     * Compress any response payload to fit within AI context window limits.
     * Automatically selects compression tier based on byte size.
     */
    compressForAI(data: unknown, forceTier?: CompressionTier): CompressedResponse;
    createChild(childType: string, parentId?: string, name?: string, width?: number, height?: number, x?: number, y?: number, characters?: string): Promise<Record<string, unknown>>;
}
export declare function getBridge(): Promise<FigmaBridge>;
//# sourceMappingURL=figma-bridge.d.ts.map