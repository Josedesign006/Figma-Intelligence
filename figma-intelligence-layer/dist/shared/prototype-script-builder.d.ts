export type TriggerType = "ON_CLICK" | "ON_DRAG" | "ON_HOVER" | "AFTER_DELAY" | "MOUSE_ENTER" | "MOUSE_LEAVE";
export type AnimationType = "SMART_ANIMATE" | "DISSOLVE" | "SLIDE_IN" | "SLIDE_OUT" | "PUSH" | "MOVE_IN" | "MOVE_OUT" | "INSTANT";
export type SlideDirection = "LEFT" | "RIGHT" | "TOP" | "BOTTOM";
export type EasingType = "EASE_IN" | "EASE_OUT" | "EASE_IN_AND_OUT" | "LINEAR";
export type NavigationType = "NAVIGATE" | "OVERLAY" | "SWAP" | "SCROLL_TO" | "BACK" | "CLOSE";
export interface WireSpec {
    fromNodeId: string;
    toNodeId: string;
    trigger: {
        type: TriggerType;
        delay?: number;
    };
    animation: {
        type: AnimationType;
        direction?: SlideDirection;
        duration?: number;
        easing?: EasingType;
    };
    navigation?: NavigationType;
    preserveScrollPosition?: boolean;
}
export interface WireScriptResult {
    fromNodeId: string;
    success: boolean;
    error?: string;
}
/**
 * Generate a single Figma Plugin API script that sets prototype reactions
 * for all provided wire specs in one batch.  Preserves existing reactions.
 */
export declare function buildWireScript(specs: WireSpec[]): string;
/**
 * Generate a script that clears all reactions from the specified nodes.
 */
export declare function buildClearReactionsScript(nodeIds: string[]): string;
//# sourceMappingURL=prototype-script-builder.d.ts.map