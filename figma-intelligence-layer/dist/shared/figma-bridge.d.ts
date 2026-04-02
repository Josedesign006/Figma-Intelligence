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
    /** Fire-and-forget hydration after (re)connect — populates context cache quickly */
    private hydrateAfterConnect;
    private emitEvent;
    private updateContextFromEvent;
    private handleMessage;
    private send;
    private sendWithTimeout;
    execute(script: string, timeoutMs?: number): Promise<ExecuteResult>;
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
    createVariable(name: string, collectionId: string, resolvedType: string, valuesByMode?: Record<string, unknown>, description?: string, scopes?: string[], codeSyntax?: Record<string, string>): Promise<Record<string, unknown>>;
    /**
     * Set variable scoping (which properties this variable can be applied to).
     * Scopes: ALL_SCOPES, ALL_FILLS, FRAME_FILL, SHAPE_FILL, TEXT_FILL, STROKE_COLOR,
     * EFFECT_COLOR, WIDTH_HEIGHT, GAP, CORNER_RADIUS, OPACITY, STROKE_FLOAT,
     * EFFECT_FLOAT, FONT_SIZE, LINE_HEIGHT, LETTER_SPACING, PARAGRAPH_SPACING,
     * PARAGRAPH_INDENT, FONT_WEIGHT, FONT_FAMILY, FONT_STYLE, TEXT_CONTENT
     */
    setVariableScopes(variableId: string, scopes: string[]): Promise<Record<string, unknown>>;
    /**
     * Set code syntax for a variable (platform-specific code identifiers).
     * e.g. { WEB: "--color-brand-500", ANDROID: "colorBrand500", iOS: "Color.brand500" }
     */
    setVariableCodeSyntax(variableId: string, codeSyntax: Record<string, string>): Promise<Record<string, unknown>>;
    /**
     * Set variable description.
     */
    setVariableDescription(variableId: string, description: string): Promise<Record<string, unknown>>;
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
        scopes?: string[];
        codeSyntax?: Record<string, string>;
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
     * Get a node with full recursive child data up to maxDepth.
     * Unlike getNode() which returns 1-level children as {id, name, type},
     * this returns the full property set for every descendant.
     */
    getNodeDeep(nodeId: string, maxDepth?: number): Promise<unknown>;
    /**
     * Batch read multiple nodes in a single round-trip.
     * Returns a map of nodeId → serialized node data (1-level deep children).
     */
    batchGetNodes(nodeIds: string[], includeChildren?: boolean): Promise<Record<string, unknown>>;
    /**
     * Bind semantic variables to nodes AND set the explicit variable mode on a
     * container frame. This is the key method for theme-switching support.
     *
     * Unlike bindVariables() which just binds variables without mode awareness,
     * this method:
     *   1. Binds semantic variables (which have Light/Dark mode values)
     *   2. Sets the explicit mode on the target frame so children resolve correctly
     */
    bindVariablesMultiMode(bindings: Array<{
        nodeId: string;
        field: string;
        variableId: string;
        fillIndex?: number;
    }>, targetFrameId: string, collectionId: string, activeModeId: string): Promise<{
        bound: number;
        total: number;
        modeSet: boolean;
        errors?: string[];
    }>;
    /**
     * Switch a frame's variable mode (theme switching).
     * All children with bound variables will resolve to the new mode's values.
     */
    switchMode(frameId: string, collectionId: string, modeId: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * List all modes for a variable collection.
     * Returns mode IDs and names so callers can pick one for switchMode().
     */
    listModes(collectionId: string): Promise<unknown>;
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