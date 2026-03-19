import { FigmaNode, Paint } from "../../../shared/types.js";
export interface LintRule {
    id: string;
    name: string;
    description: string;
    severity: "error" | "warning";
    autoFixable: boolean;
    builtIn: boolean;
}
export declare function loadStoredRules(): Promise<LintRule[]>;
export declare function saveStoredRules(rules: LintRule[]): Promise<void>;
export declare function loadRulesFromYaml(filePath: string): Promise<LintRule[]>;
export declare function mergeRules(builtIn: LintRule[], stored: LintRule[]): LintRule[];
export declare function hasHardcodedColor(fills: Paint[] | undefined): boolean;
export declare function isSpacingOffGrid(value: number | undefined): boolean;
export declare function isButton(node: FigmaNode): boolean;
export declare function isInteractiveButNotInstance(node: FigmaNode): boolean;
export declare function collectAllNodes(root: FigmaNode): FigmaNode[];
//# sourceMappingURL=rule-engine.d.ts.map