type VariableScalar = string | number | boolean;
type VariableAliasValue = {
    type: "VARIABLE_ALIAS";
    variableId: string;
};
type VariableValue = VariableScalar | VariableAliasValue;
export interface DsVariableCollectionInput {
    name: string;
    initialModeName?: string;
    modes?: string[];
}
export interface DsVariableInput {
    collectionId?: string;
    collectionName?: string;
    name: string;
    resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
    valuesByMode: Record<string, VariableValue>;
    description?: string;
}
export interface DsComponentVariableTemplate {
    componentName: string;
    variant?: string;
    parts?: string[];
    properties?: string[];
    states?: string[];
}
export interface DsVariablesArgs {
    action: "diagnose" | "scaffold-primitives" | "scaffold-semantics" | "scaffold-components" | "scaffold-all" | "create-collections" | "create-variables";
    brandName?: string;
    primaryColor?: string;
    secondaryColor?: string;
    neutralColor?: string;
    accentColor?: string;
    createDarkMode?: boolean;
    createSemantics?: boolean;
    collections?: DsVariableCollectionInput[];
    variables?: DsVariableInput[];
    componentTemplates?: DsComponentVariableTemplate[];
}
export interface DsVariablesResult {
    ok: boolean;
    action: DsVariablesArgs["action"];
    diagnostics: Record<string, unknown>;
    createdCollections: Array<{
        id: string;
        name: string;
    }>;
    createdVariables: Array<{
        id: string;
        name: string;
        resolvedType: string;
    }>;
    notes: string[];
}
export declare function dsVariablesHandler(args: DsVariablesArgs): Promise<DsVariablesResult>;
export {};
//# sourceMappingURL=index.d.ts.map