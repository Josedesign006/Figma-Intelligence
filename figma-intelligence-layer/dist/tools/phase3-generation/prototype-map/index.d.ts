import { PrototypeTransition } from "../../../shared/types.js";
export interface PrototypeMapArgs {
    fileKey?: string;
    startFrameId?: string;
    includeAnimationSpecs?: boolean;
    outputFormat: "json" | "mermaid" | "both";
}
export interface StateNode {
    id: string;
    name: string;
    isStart: boolean;
    outgoingCount: number;
    incomingCount: number;
}
export interface StateMachine {
    states: StateNode[];
    transitions: PrototypeTransition[];
}
export interface PrototypeMapResult {
    stateMachine: StateMachine;
    mermaidDiagram: string | null;
    totalStates: number;
    totalTransitions: number;
    reachableStates: number;
    logEntryId: string;
}
export declare function prototypeMapHandler(args: PrototypeMapArgs): Promise<PrototypeMapResult>;
//# sourceMappingURL=index.d.ts.map