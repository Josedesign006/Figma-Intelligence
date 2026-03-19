export interface FigmaNode {
    id: string;
    name: string;
    type: string;
    children?: FigmaNode[];
    fills?: Paint[];
    strokes?: Paint[];
    effects?: Effect[];
    absoluteBoundingBox?: Rect;
    constraints?: Constraints;
    layoutMode?: "HORIZONTAL" | "VERTICAL" | "NONE";
    primaryAxisSizingMode?: "FIXED" | "AUTO";
    counterAxisSizingMode?: "FIXED" | "AUTO";
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    itemSpacing?: number;
    opacity?: number;
    componentId?: string;
    componentProperties?: Record<string, ComponentProperty>;
    variantProperties?: Record<string, string>;
    description?: string;
    characters?: string;
    style?: TextStyle;
    width?: number;
    height?: number;
}
export interface Paint {
    type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "IMAGE" | "VARIABLE_ALIAS";
    color?: RGBA;
    opacity?: number;
    variableId?: string;
}
export interface RGBA {
    r: number;
    g: number;
    b: number;
    a: number;
}
export interface Effect {
    type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
    color?: RGBA;
    offset?: Vector;
    radius?: number;
    spread?: number;
    visible?: boolean;
}
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface Vector {
    x: number;
    y: number;
}
export interface Constraints {
    horizontal: "LEFT" | "RIGHT" | "CENTER" | "SCALE" | "STRETCH";
    vertical: "TOP" | "BOTTOM" | "CENTER" | "SCALE" | "STRETCH";
}
export interface ComponentProperty {
    type: "BOOLEAN" | "TEXT" | "INSTANCE_SWAP" | "VARIANT";
    value: boolean | string;
    defaultValue?: boolean | string;
    variantOptions?: string[];
}
export interface TextStyle {
    fontFamily: string;
    fontStyle: string;
    fontSize: number;
    fontWeight: number;
    letterSpacing: number;
    lineHeightPx: number;
}
export interface Token {
    id: string;
    name: string;
    type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
    value: string | number | boolean;
    collectionId: string;
    modeValues?: Record<string, string | number | boolean>;
    description?: string;
}
export interface ComponentSet {
    id: string;
    name: string;
    description?: string;
    variantGroupProperties: Record<string, {
        values: string[];
    }>;
    children: FigmaNode[];
}
export interface FigmaSelectionItem {
    id: string;
    name: string;
    type: string;
}
export interface FigmaPageSummary {
    id: string;
    name: string;
}
export interface FigmaDocumentChangeSummary {
    documentChanges: Array<{
        id?: string;
        type: string;
        nodeId?: string;
        nodeType?: string;
    }>;
}
export type FigmaBridgeEventType = "bridge.ready" | "selectionchange" | "currentpagechange" | "documentchange";
export interface FigmaBridgeEvent<TPayload = unknown> {
    type: "bridge-event";
    eventType: FigmaBridgeEventType;
    payload: TPayload;
    timestamp: number;
}
export interface FigmaContextSnapshot {
    status: "connected" | "disconnected";
    fileName?: string;
    currentPage?: FigmaPageSummary;
    pageCount?: number;
    selection: FigmaSelectionItem[];
    lastDocumentChange?: FigmaDocumentChangeSummary;
    lastUpdatedAt?: number;
}
export type LayoutNodeType = "page" | "sidebar" | "header" | "toolbar" | "content" | "footer" | "drawer" | "modal" | "card" | "form" | "form-row" | "nav" | "button-group" | "tab-bar" | "table" | "table-row" | "list" | "list-item" | "section" | "overlay";
export interface LayoutPadding {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
export interface LayoutNodeAlignment {
    direction?: "horizontal" | "vertical" | "none";
    distribution?: "start" | "center" | "end" | "space-between";
    crossAlignment?: "start" | "center" | "end" | "stretch";
    gap?: number;
    padding?: Partial<LayoutPadding>;
    columns?: number;
    stackingOrder?: "normal" | "reverse" | "overlay";
}
export interface LayoutSiblingHints {
    alignedLeftWith?: string[];
    equalSpacingWith?: string[];
    repeatedChildren?: string[];
    anchored?: "left" | "right" | "top" | "bottom" | "center";
    overlay?: boolean;
}
export interface LayoutRepetition {
    isRepeated: boolean;
    pattern?: "row" | "column" | "grid" | "tabs" | "menu" | "list";
    itemCount?: number;
    canonicalChildId?: string;
    repeatedChildIds?: string[];
    repeatAxis?: "horizontal" | "vertical";
}
export interface LayoutNode {
    id: string;
    label: string;
    boundingBox: Rect;
    layoutType: LayoutNodeType;
    childCount: number;
    children?: LayoutNode[];
    layout?: LayoutNodeAlignment;
    siblingHints?: LayoutSiblingHints;
    repetition?: LayoutRepetition;
    zoneImage?: string;
}
export type LayoutZone = LayoutNode;
export interface ComponentManifest {
    componentType: string;
    variants: Record<string, string>;
    textContent?: string;
    textContentConfidence?: number;
    iconPresent: boolean;
    iconName?: string;
    iconNameConfidence?: number;
    iconKind?: "system" | "brand" | "illustration" | "unknown";
    preferredIconLibrary?: string;
    openSourceIconName?: string;
    interactiveElement: boolean;
    estimatedSpacing: number;
    estimatedSpacingConfidence?: number;
    estimatedRadius?: number;
    estimatedRadiusConfidence?: number;
    estimatedFontSize?: number;
    estimatedFontSizeConfidence?: number;
    fontFamilyGuess?: string;
    fontFamilyGuessConfidence?: number;
    fontStyleGuess?: string;
    fontStyleGuessConfidence?: number;
    fontWeightGuess?: number;
    fontWeightGuessConfidence?: number;
    confidence: number;
    dsBestMatch?: string;
    dsNodeId?: string;
}
export interface VisionResult {
    layoutTree?: LayoutNode[];
    zones?: LayoutZone[];
    manifest?: ComponentManifest;
    rawAnalysis: string;
    confidence: number;
}
export interface TokenRef {
    tokenName: string;
    tokenValue: number | string;
    delta?: number;
}
export interface WCAGIssue {
    severity: "error" | "warning" | "suggestion";
    criterion: string;
    nodeId: string;
    nodeName: string;
    issue: string;
    currentValue: string;
    suggestedFix: string;
    autoFixAvailable: boolean;
}
export interface LintViolation {
    ruleId: string;
    severity: "error" | "warning";
    nodeId: string;
    nodeName: string;
    message: string;
    autoFixed?: boolean;
}
export interface LogEntry {
    id: string;
    timestamp: string;
    tool: string;
    nodeIds: string[];
    rationale: string;
    tokens?: string[];
    reversible?: boolean;
    metadata?: Record<string, unknown>;
}
export interface HealthScore {
    overall: number;
    tokenCoverage: number;
    accessibility: number;
    componentAdoption: number;
    documentation: number;
    lintScore: number;
    driftScore: number;
}
export interface ExecuteResult {
    success: boolean;
    result?: unknown;
    error?: string;
    logs?: string[];
}
export interface DriftReport {
    canonicalFileKey: string;
    targetFileKey: string;
    totalTokens: number;
    driftingTokens: number;
    driftScore: number;
    violations: TokenDrift[];
}
export interface TokenDrift {
    tokenName: string;
    canonicalValue: string;
    targetValue: string;
    driftType: "typo" | "override" | "missing" | "extra";
    severity: "warning" | "critical";
    instancesAffected: number;
}
export interface PrototypeTransition {
    from: string;
    fromName: string;
    to: string;
    toName: string;
    trigger: {
        type: string;
        nodeName?: string;
    };
    animation: {
        type: string;
        direction?: string;
        duration: number;
        easing?: number[];
    };
}
//# sourceMappingURL=types.d.ts.map