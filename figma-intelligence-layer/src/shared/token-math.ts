/**
 * Token math/expression engine
 * Supports: arithmetic (+, -, *, /), parentheses, token references {path.to.token},
 * functions (clamp, min, max, round, floor, ceil), and modular scales
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Named scale ratios
// ---------------------------------------------------------------------------

export const SCALE_RATIOS: Record<string, number> = {
  "minor-second": 1.067,
  "major-second": 1.125,
  "minor-third": 1.2,
  "major-third": 1.25,
  "perfect-fourth": 1.333,
  "augmented-fourth": 1.414,
  "perfect-fifth": 1.5,
  "golden-ratio": 1.618,
};

// ---------------------------------------------------------------------------
// Expression helpers
// ---------------------------------------------------------------------------

const TOKEN_REF_RE = /\{([^}]+)\}/g;

/** Check if a string value contains an expression (math operators or token refs). */
export function isExpression(value: string): boolean {
  if (TOKEN_REF_RE.test(value)) return true;
  // Reset lastIndex after test
  TOKEN_REF_RE.lastIndex = 0;
  // Contains arithmetic operators (but not just a plain number)
  return /[+\-*/()]/.test(value) && !/^\s*-?\d+(\.\d+)?\s*$/.test(value);
}

/** Extract all token reference paths from an expression. */
export function extractReferences(expr: string): string[] {
  const refs: string[] = [];
  let match: RegExpExecArray | null;
  const re = /\{([^}]+)\}/g;
  while ((match = re.exec(expr)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

// ---------------------------------------------------------------------------
// Recursive-descent expression parser
// ---------------------------------------------------------------------------

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
export function evaluateExpression(expr: string, resolve: TokenResolver): number {
  const parser = new Parser(expr, resolve);
  const result = parser.parseExpression();
  parser.skipWhitespace();
  if (parser.pos < parser.input.length) {
    throw new Error(
      `Unexpected character '${parser.input[parser.pos]}' at position ${parser.pos} in expression: ${expr}`
    );
  }
  return result;
}

class Parser {
  public pos = 0;
  public input: string;
  private resolve: TokenResolver;

  constructor(input: string, resolve: TokenResolver) {
    this.input = input;
    this.resolve = resolve;
  }

  // --- helpers ---

  skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  peek(): string {
    this.skipWhitespace();
    return this.input[this.pos] ?? "";
  }

  consume(ch: string): void {
    this.skipWhitespace();
    if (this.input[this.pos] !== ch) {
      throw new Error(
        `Expected '${ch}' but got '${this.input[this.pos] ?? "EOF"}' at position ${this.pos}`
      );
    }
    this.pos++;
  }

  // --- grammar rules ---

  parseExpression(): number {
    let left = this.parseTerm();
    while (true) {
      this.skipWhitespace();
      const ch = this.input[this.pos];
      if (ch === "+") {
        this.pos++;
        left = left + this.parseTerm();
      } else if (ch === "-") {
        this.pos++;
        left = left - this.parseTerm();
      } else {
        break;
      }
    }
    return left;
  }

  parseTerm(): number {
    let left = this.parseUnary();
    while (true) {
      this.skipWhitespace();
      const ch = this.input[this.pos];
      if (ch === "*") {
        this.pos++;
        left = left * this.parseUnary();
      } else if (ch === "/") {
        this.pos++;
        const divisor = this.parseUnary();
        if (divisor === 0) throw new Error("Division by zero");
        left = left / divisor;
      } else {
        break;
      }
    }
    return left;
  }

  parseUnary(): number {
    this.skipWhitespace();
    if (this.input[this.pos] === "-") {
      this.pos++;
      return -this.parseUnary();
    }
    return this.parsePrimary();
  }

  parsePrimary(): number {
    this.skipWhitespace();
    const ch = this.input[this.pos];

    // Parenthesised sub-expression
    if (ch === "(") {
      this.pos++;
      const val = this.parseExpression();
      this.consume(")");
      return val;
    }

    // Token reference: {path.to.token}
    if (ch === "{") {
      this.pos++; // skip '{'
      const start = this.pos;
      while (this.pos < this.input.length && this.input[this.pos] !== "}") {
        this.pos++;
      }
      const path = this.input.slice(start, this.pos);
      this.consume("}");
      const resolved = this.resolve(path);
      if (resolved === undefined) {
        throw new Error(`Unresolved token reference: {${path}}`);
      }
      return resolved;
    }

    // Function call: ident(args...)
    if (/[a-zA-Z_]/.test(ch)) {
      const start = this.pos;
      while (this.pos < this.input.length && /[a-zA-Z_0-9]/.test(this.input[this.pos])) {
        this.pos++;
      }
      const name = this.input.slice(start, this.pos).toLowerCase();
      this.skipWhitespace();
      if (this.input[this.pos] === "(") {
        this.pos++; // skip '('
        const args: number[] = [];
        this.skipWhitespace();
        if (this.input[this.pos] !== ")") {
          args.push(this.parseExpression());
          while (this.peek() === ",") {
            this.pos++; // skip ','
            args.push(this.parseExpression());
          }
        }
        this.consume(")");
        return this.callFunction(name, args);
      }
      throw new Error(`Unknown identifier '${name}' at position ${start}`);
    }

    // Number literal
    if (/[0-9.]/.test(ch)) {
      return this.parseNumber();
    }

    throw new Error(
      `Unexpected character '${ch ?? "EOF"}' at position ${this.pos}`
    );
  }

  parseNumber(): number {
    const start = this.pos;
    while (this.pos < this.input.length && /[0-9.]/.test(this.input[this.pos])) {
      this.pos++;
    }
    const numStr = this.input.slice(start, this.pos);
    const num = Number(numStr);
    if (isNaN(num)) {
      throw new Error(`Invalid number '${numStr}' at position ${start}`);
    }
    return num;
  }

  callFunction(name: string, args: number[]): number {
    switch (name) {
      case "round":
        this.expectArity(name, args, 1);
        return Math.round(args[0]);
      case "floor":
        this.expectArity(name, args, 1);
        return Math.floor(args[0]);
      case "ceil":
        this.expectArity(name, args, 1);
        return Math.ceil(args[0]);
      case "min":
        if (args.length < 1) throw new Error(`min() requires at least 1 argument`);
        return Math.min(...args);
      case "max":
        if (args.length < 1) throw new Error(`max() requires at least 1 argument`);
        return Math.max(...args);
      case "clamp":
        this.expectArity(name, args, 3);
        return Math.min(Math.max(args[1], args[0]), args[2]);
      default:
        throw new Error(`Unknown function '${name}'`);
    }
  }

  private expectArity(name: string, args: number[], expected: number): void {
    if (args.length !== expected) {
      throw new Error(`${name}() expects ${expected} argument(s), got ${args.length}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Scale generators
// ---------------------------------------------------------------------------

const TYPE_SCALE_LABELS_BELOW = ["xs", "sm"];
const TYPE_SCALE_LABELS_ABOVE = [
  "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl",
];

/**
 * Generate a modular type scale.
 *
 * Returns e.g. { "xs": 10, "sm": 13, "base": 16, "lg": 20, "xl": 25, "2xl": 31, "3xl": 39 }
 */
export function generateModularScale(options: ModularScaleOptions): Record<string, number> {
  const { base, ratio, steps, stepsBelow = 2 } = options;
  const result: Record<string, number> = {};

  // Steps below base (in ascending order)
  for (let i = stepsBelow; i >= 1; i--) {
    const label = TYPE_SCALE_LABELS_BELOW[TYPE_SCALE_LABELS_BELOW.length - i];
    if (label) {
      result[label] = Math.round(base / Math.pow(ratio, i));
    }
  }

  // Base and steps above
  for (let i = 0; i <= steps; i++) {
    const label = TYPE_SCALE_LABELS_ABOVE[i];
    if (label) {
      result[label] = Math.round(base * Math.pow(ratio, i));
    }
  }

  return result;
}

/**
 * Generate a spacing scale from a base unit and multipliers.
 *
 * Returns e.g. { "0": 0, "0.5": 2, "1": 4, "1.5": 6, "2": 8, ... }
 */
export function generateSpacingScale(options: SpacingScaleOptions): Record<string, number> {
  const { base, steps } = options;
  const result: Record<string, number> = {};
  for (const step of steps) {
    result[String(step)] = Math.round(base * step);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Responsive / clamp
// ---------------------------------------------------------------------------

/**
 * Generate a CSS clamp() expression for fluid responsive values.
 *
 * Returns e.g. "clamp(1rem, 0.5rem + 1.4286vw, 1.5rem)"
 */
export function generateClamp(options: ResponsiveTokenOptions): string {
  const {
    minValue,
    maxValue,
    minViewport = 320,
    maxViewport = 1440,
    unit = "rem",
    baseFontSize = 16,
  } = options;

  if (unit === "rem") {
    const minRem = roundTo(minValue / baseFontSize, 4);
    const maxRem = roundTo(maxValue / baseFontSize, 4);

    // slope = (maxValue - minValue) / (maxViewport - minViewport) * 100  (vw)
    const slope = roundTo(
      ((maxValue - minValue) / (maxViewport - minViewport)) * 100,
      4
    );

    // intercept in rem = minValue/base - minViewport * slope / 100 / base
    const intercept = roundTo(
      minValue / baseFontSize - (minViewport * slope) / 100 / baseFontSize,
      4
    );

    const preferred =
      (intercept >= 0 ? `${intercept}rem + ` : `${intercept}rem + `) +
      `${slope}vw`;

    // Clean up double negative
    const preferredClean = preferred.replace(/\+ -/g, "- ").replace(/-0rem \+ /, "");

    return `clamp(${minRem}rem, ${preferredClean}, ${maxRem}rem)`;
  }

  // px mode
  const slope = roundTo(
    ((maxValue - minValue) / (maxViewport - minViewport)) * 100,
    4
  );
  const intercept = roundTo(minValue - (minViewport * slope) / 100, 4);

  const preferred =
    (intercept >= 0 ? `${intercept}px + ` : `${intercept}px + `) +
    `${slope}vw`;

  const preferredClean = preferred.replace(/\+ -/g, "- ").replace(/-0px \+ /, "");

  return `clamp(${minValue}px, ${preferredClean}, ${maxValue}px)`;
}

// ---------------------------------------------------------------------------
// Unit conversion
// ---------------------------------------------------------------------------

/** Convert px to rem string. */
export function pxToRem(px: number, base: number = 16): string {
  return `${roundTo(px / base, 4)}rem`;
}

/** Convert rem to px number. */
export function remToPx(rem: number, base: number = 16): number {
  return roundTo(rem * base, 4);
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
