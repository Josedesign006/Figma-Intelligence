import { TriggerType, AnimationType, SlideDirection, EasingType, NavigationType } from "../../../shared/prototype-script-builder.js";
export interface PrototypeScanArgs {
    frameIds?: string[];
    journeyDescription?: string;
    maxDepth?: number;
}
export interface InteractiveElement {
    nodeId: string;
    nodeName: string;
    nodeType: string;
    textContent?: string;
    componentName?: string;
    interactivityScore: number;
    signals: string[];
    boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    parentFrameId: string;
    parentFrameName: string;
    depth: number;
}
export interface FrameScanResult {
    frameId: string;
    frameName: string;
    interactiveElements: InteractiveElement[];
    totalNodesScanned: number;
}
export interface PrototypeScanResult {
    frames: FrameScanResult[];
    totalFrames: number;
    totalInteractiveElements: number;
    existingConnections: number;
    truncated: boolean;
    journeyDescription?: string;
    logEntryId: string;
}
export interface ConnectionSpec {
    fromElementId: string;
    toFrameId: string;
    trigger?: TriggerType;
    animation?: {
        type?: AnimationType;
        direction?: SlideDirection;
        duration?: number;
        easing?: EasingType;
    };
    navigation?: NavigationType;
}
export interface PrototypeWireArgs {
    connections?: ConnectionSpec[];
    journeyDescription?: string;
    frameIds?: string[];
    defaultTrigger?: TriggerType;
    defaultAnimation?: {
        type?: AnimationType;
        direction?: SlideDirection;
        duration?: number;
        easing?: EasingType;
    };
    clearExisting?: boolean;
    dryRun?: boolean;
}
export interface WireResultEntry {
    fromElementId: string;
    fromElementName: string;
    toFrameId: string;
    toFrameName: string;
    trigger: TriggerType;
    animation: AnimationType;
    success: boolean;
    error?: string;
}
export interface PrototypeWireResult {
    mode: "executed" | "dry-run" | "scan-for-journey";
    scanData?: PrototypeScanResult;
    wiredConnections?: WireResultEntry[];
    totalAttempted?: number;
    totalSucceeded?: number;
    totalFailed?: number;
    plannedConnections?: Array<{
        fromElementId: string;
        fromElementName: string;
        toFrameId: string;
        toFrameName: string;
        trigger: TriggerType;
        animation: AnimationType;
    }>;
    logEntryId: string;
}
export declare function prototypeScanHandler(args: PrototypeScanArgs): Promise<PrototypeScanResult>;
export declare function prototypeWireHandler(args: PrototypeWireArgs): Promise<PrototypeWireResult>;
//# sourceMappingURL=index.d.ts.map