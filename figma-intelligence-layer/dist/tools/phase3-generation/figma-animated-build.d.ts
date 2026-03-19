export interface AgentDef {
    id: string;
    name: string;
    color: string;
}
export type BuildStep = {
    type: "moveCursor";
    agentId: string;
    x: number;
    y: number;
} | {
    type: "showChat";
    agentId: string;
    text: string;
} | {
    type: "hideChat";
    agentId: string;
} | {
    type: "createFrame";
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    color?: string;
    radius?: number;
    parentId?: string;
} | {
    type: "createRect";
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    color?: string;
    parentId?: string;
} | {
    type: "createText";
    name: string;
    x: number;
    y: number;
    text: string;
    size?: number;
    color?: string;
    parentId?: string;
} | {
    type: "createEllipse";
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    color?: string;
    parentId?: string;
} | {
    type: "pause";
    ms: number;
};
export interface AnimatedBuildArgs {
    agents?: AgentDef[];
    steps?: BuildStep[];
    stepDelayMs?: number;
    useDefaultIosTemplate?: boolean;
}
export interface AnimatedBuildResult {
    stepsCompleted: number;
    framesCreated: number;
    agentNames: string[];
}
export declare function animatedBuildHandler(args: AnimatedBuildArgs): Promise<AnimatedBuildResult>;
//# sourceMappingURL=figma-animated-build.d.ts.map