/**
 * Token math/expression engine
 * Supports: arithmetic (+, -, *, /), parentheses, token references {path.to.token},
 * functions (clamp, min, max, round, floor, ceil), and modular scales
 */
export interface TokenResolver {
    (tokenPath: string): number | undefined;
}
export interface ModularScaleOptions {
    base: number;
    ratio: number;
    steps: number;
    stepsBelow?: number;
}
export interface SpacingScaleOptions {
    base: number;
    steps: number[];
}
export interface ResponsiveTokenOptions {
    minValue: number;
    maxValue: number;
    minViewport?: number;
    maxViewport?: number;
    unit?: "px" | "rem";
    baseFontSize?: number;
}
export declare const SCALE_RATIOS: Record<string, number>;
/** Check if a string value contains an expression (math operators or token refs). */
export declare function isExpression(value: string): boolean;
/** Extract all token reference paths from an expression. */
export declare function extractReferences(expr: string): string[];
/**
 * Evaluate a math expression that may contain token references and functions.
 *
 * Grammar (roughly):
 *   expr       = term (('+' | '-') term)*
 *   term       = unary (('*' | '/') unary)*
 *   unary      = '-' unary | primary
 *   primary    = NUMBER | tokenRef | functionCall | '(' expr ')'
 *   tokenRef   = '{' path '}'
 *   functionCall = IDENT '(' expr (',' expr)* ')'
 */
export declare function evaluateExpression(expr: string, resolve: TokenResolver): number;
/**
 * Generate a modular type scale.
 *
 * Returns e.g. { "xs": 10, "sm": 13, "base": 16, "lg": 20, "xl": 25, "2xl": 31, "3xl": 39 }
 */
export declare function generateModularScale(options: ModularScaleOptions): Record<string, number>;
/**
 * Generate a spacing scale from a base unit and multipliers.
 *
 * Returns e.g. { "0": 0, "0.5": 2, "1": 4, "1.5": 6, "2": 8, ... }
 */
export declare function generateSpacingScale(options: SpacingScaleOptions): Record<string, number>;
/**
 * Generate a CSS clamp() expression for fluid responsive values.
 *
 * Returns e.g. "clamp(1rem, 0.5rem + 1.4286vw, 1.5rem)"
 */
export declare function generateClamp(options: ResponsiveTokenOptions): string;
/** Convert px to rem string. */
export declare function pxToRem(px: number, base?: number): string;
/** Convert rem to px number. */
export declare function remToPx(rem: number, base?: number): number;
//# sourceMappingURL=token-math.d.ts.map