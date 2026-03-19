export interface AnimationSpecifierArgs {
    fileKey?: string;
    frameNodeId?: string;
    outputFormat: "json" | "framer-motion" | "css" | "swift" | "android" | "all";
}
export interface AnimationSpec {
    name: string;
    fromId: string;
    toId: string;
    duration: number;
    easing: string;
    easingValues: number[];
    direction: string;
    type: string;
    isSpring: boolean;
    springStiffness?: number;
    springDamping?: number;
}
export interface AnimationSpecifierResult {
    animations: AnimationSpec[];
    code: {
        json?: string;
        framerMotion?: string;
        css?: string;
        swift?: string;
        android?: string;
    };
    totalConnections: number;
    animatedConnections: number;
}
export declare function animationSpecifierHandler(args: AnimationSpecifierArgs): Promise<AnimationSpecifierResult>;
//# sourceMappingURL=index.d.ts.map