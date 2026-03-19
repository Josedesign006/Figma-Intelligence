import { ComponentManifest } from "../../../shared/types.js";

interface FontName {
  family: string;
  style: string;
}

interface RawTextStyle {
  id: string;
  name: string;
  fontName?: FontName;
  fontSize?: number;
  lineHeight?: { unit?: string; value?: number };
}

export interface FontStyleMatch {
  styleId: string;
  styleName: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeightPx?: number;
  confidence: number;
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function scoreStringMatch(a: string | undefined, b: string | undefined): number {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.8;

  const leftTokens = new Set(left.split(/[\s/_-]+/).filter(Boolean));
  const rightTokens = right.split(/[\s/_-]+/).filter(Boolean);
  if (!leftTokens.size || !rightTokens.length) return 0;

  const overlap = rightTokens.filter((token) => leftTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.length);
}

function scoreNumericProximity(actual: number | undefined, expected: number | undefined, maxDelta: number): number {
  if (actual == null || expected == null) return 0;
  const delta = Math.abs(actual - expected);
  return Math.max(0, 1 - delta / maxDelta);
}

function normalizeTextStyles(styles: Record<string, unknown> | undefined): RawTextStyle[] {
  if (!styles || !Array.isArray(styles.text)) return [];
  return styles.text.filter((style): style is RawTextStyle => {
    return typeof style === "object" && style !== null && "id" in style && "name" in style;
  });
}

export function resolveFontStyleMatch(
  manifest: ComponentManifest,
  styles: Record<string, unknown> | undefined
): FontStyleMatch | null {
  const candidates = normalizeTextStyles(styles);
  if (candidates.length === 0) return null;

  const scored = candidates
    .map((style) => {
      const familyScore = scoreStringMatch(style.fontName?.family, manifest.fontFamilyGuess);
      const styleScore = scoreStringMatch(style.fontName?.style ?? style.name, manifest.fontStyleGuess);
      const sizeScore = scoreNumericProximity(style.fontSize, manifest.estimatedFontSize, 16);
      const weightScore = scoreNumericProximity(
        inferWeight(style.fontName?.style),
        manifest.fontWeightGuess,
        500
      );

      const confidence = familyScore * 0.45 + styleScore * 0.2 + sizeScore * 0.2 + weightScore * 0.15;

      return {
        style,
        confidence,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const best = scored[0];
  if (!best || best.confidence < 0.35 || !best.style.fontName || best.style.fontSize == null) {
    return null;
  }

  return {
    styleId: best.style.id,
    styleName: best.style.name,
    fontFamily: best.style.fontName.family,
    fontStyle: best.style.fontName.style,
    fontSize: best.style.fontSize,
    lineHeightPx: best.style.lineHeight?.unit === "PIXELS" ? best.style.lineHeight.value : undefined,
    confidence: best.confidence,
  };
}

function inferWeight(fontStyle: string | undefined): number | undefined {
  const value = normalize(fontStyle);
  if (!value) return undefined;
  if (value.includes("thin")) return 100;
  if (value.includes("extralight") || value.includes("ultralight")) return 200;
  if (value.includes("light")) return 300;
  if (value.includes("regular") || value.includes("book")) return 400;
  if (value.includes("medium")) return 500;
  if (value.includes("semibold") || value.includes("demibold")) return 600;
  if (value.includes("bold")) return 700;
  if (value.includes("extrabold") || value.includes("ultrabold")) return 800;
  if (value.includes("black") || value.includes("heavy")) return 900;
  return undefined;
}
