import { Token } from "./types.js";
export interface TokenBinding {
    nodeVar: string;
    field: string;
    fillIndex?: number;
    variableId: string;
}
export interface SemanticTokenMap {
    [semanticRole: string]: string;
}
/**
 * Look up a Figma variable ID by token name from the available tokens.
 * Supports partial matching: "color/semantic/primary" matches token named
 * "color/semantic/primary" or "Brand Tokens/color/semantic/primary".
 */
export declare function resolveTokenId(tokenName: string, tokens: Token[]): string | null;
/**
 * Build a map of semantic role → variable ID from the available tokens.
 * Used by tools that need to resolve multiple token references at once.
 */
export declare function buildTokenIdMap(tokens: Token[]): SemanticTokenMap;
/**
 * Resolve which token names are relevant for a given component type.
 */
export declare function getTokenRolesForComponent(componentType: string): string[];
/**
 * Given a component type and available tokens, resolve the relevant token names
 * to their variable IDs.
 */
export declare function resolveTokenRefsForComponent(componentType: string, tokens: Token[]): string[];
/**
 * Generate a Figma Plugin API script line that binds a color variable
 * to a paint fill on a node.
 *
 * Example output:
 *   const v = await figma.variables.getVariableByIdAsync("VariableID:1:2");
 *   if (v) node.setBoundVariable('fills', 0, v.id);
 */
export declare function bindColorScript(nodeVar: string, fillIndex: number, variableId: string, paintType?: "fills" | "strokes"): string;
/**
 * Generate a Figma Plugin API script line that binds a float variable
 * to a node property (spacing, radius, etc.).
 *
 * Example output:
 *   const v = await figma.variables.getVariableByIdAsync("VariableID:1:2");
 *   if (v) node.setBoundVariable('paddingLeft', v.id);
 */
export declare function bindFloatScript(nodeVar: string, field: string, variableId: string): string;
/**
 * Build a complete binding script for a single node, applying multiple
 * token bindings. Returns empty string if no bindings.
 */
export declare function buildBindingScript(nodeId: string, bindings: TokenBinding[]): string;
/**
 * Build a batch binding script that binds variables to multiple nodes
 * in a single execute call. Designed for use via bridge.execute().
 */
export declare function buildBatchBindingScript(bindings: Array<{
    nodeId: string;
    field: string;
    variableId: string;
    fillIndex?: number;
}>): string;
/**
 * Resolve a design palette from tokens, returning both the RGB values (for
 * immediate use in fills) and the variable IDs (for binding). Falls back to
 * hardcoded values if no tokens are found.
 */
export interface ResolvedPalette {
    primary: {
        rgb: string;
        variableId: string | null;
    };
    primaryText: {
        rgb: string;
        variableId: string | null;
    };
    surface: {
        rgb: string;
        variableId: string | null;
    };
    border: {
        rgb: string;
        variableId: string | null;
    };
    muted: {
        rgb: string;
        variableId: string | null;
    };
    accent: {
        rgb: string;
        variableId: string | null;
    };
}
export declare function resolveDesignPalette(tokens: Token[]): ResolvedPalette;
/**
 * Resolve a float token (spacing, radius) value and variable ID.
 * Returns the numeric value and optionally the variable ID for binding.
 */
export declare function resolveFloatToken(tokenName: string, tokens: Token[], fallback: number): {
    value: number;
    variableId: string | null;
};
//# sourceMappingURL=token-binder.d.ts.map