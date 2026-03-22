// ─────────────────────────────────────────────────────────────────────────────
// Semantic Token Catalog
// Pure data module defining ~55 semantic tokens organized by category.
// Each token maps to light/dark primitive references for automatic alias
// creation by ds-scaffolder, ds-variables, and token-binder.
// ─────────────────────────────────────────────────────────────────────────────

export interface SemanticTokenEntry {
  name: string;
  category: string;
  type: "COLOR" | "FLOAT";
  description: string;
  /** Primitive token name for light mode */
  lightRef: string;
  /** Primitive token name for dark mode */
  darkRef: string;
}

// ─── Color semantic tokens ──────────────────────────────────────────────────

const ACTIONS: SemanticTokenEntry[] = [
  { name: "color/semantic/actions/primary/bg/default",   category: "actions", type: "COLOR", description: "Primary action background",           lightRef: "color/primitive/brand/500",   darkRef: "color/primitive/brand/400" },
  { name: "color/semantic/actions/primary/bg/hover",     category: "actions", type: "COLOR", description: "Primary action hover background",     lightRef: "color/primitive/brand/600",   darkRef: "color/primitive/brand/300" },
  { name: "color/semantic/actions/primary/bg/pressed",   category: "actions", type: "COLOR", description: "Primary action pressed background",   lightRef: "color/primitive/brand/700",   darkRef: "color/primitive/brand/200" },
  { name: "color/semantic/actions/primary/bg/disabled",  category: "actions", type: "COLOR", description: "Primary action disabled background",  lightRef: "color/primitive/brand/200",   darkRef: "color/primitive/brand/800" },
  { name: "color/semantic/actions/primary/text/default",  category: "actions", type: "COLOR", description: "Text on primary action",             lightRef: "color/primitive/neutral/50",  darkRef: "color/primitive/neutral/950" },
  { name: "color/semantic/actions/secondary/bg/default", category: "actions", type: "COLOR", description: "Secondary action background",         lightRef: "color/primitive/neutral/100", darkRef: "color/primitive/neutral/800" },
  { name: "color/semantic/actions/secondary/border/default", category: "actions", type: "COLOR", description: "Secondary action border",         lightRef: "color/primitive/neutral/300", darkRef: "color/primitive/neutral/600" },
  { name: "color/semantic/actions/destructive/bg/default", category: "actions", type: "COLOR", description: "Destructive action background",     lightRef: "color/primitive/danger/500",  darkRef: "color/primitive/danger/400" },
];

const SURFACE: SemanticTokenEntry[] = [
  { name: "color/semantic/surface/default",   category: "surface", type: "COLOR", description: "Default surface background",    lightRef: "color/primitive/neutral/50",  darkRef: "color/primitive/neutral/950" },
  { name: "color/semantic/surface/subtle",    category: "surface", type: "COLOR", description: "Subtle surface background",     lightRef: "color/primitive/neutral/100", darkRef: "color/primitive/neutral/900" },
  { name: "color/semantic/surface/raised",    category: "surface", type: "COLOR", description: "Raised/card surface",           lightRef: "color/primitive/neutral/50",  darkRef: "color/primitive/neutral/900" },
  { name: "color/semantic/surface/overlay",   category: "surface", type: "COLOR", description: "Overlay/modal surface",         lightRef: "color/primitive/neutral/50",  darkRef: "color/primitive/neutral/800" },
  { name: "color/semantic/surface/inverse",   category: "surface", type: "COLOR", description: "Inverse surface (dark on light)", lightRef: "color/primitive/neutral/900", darkRef: "color/primitive/neutral/50" },
  { name: "color/semantic/surface/disabled",  category: "surface", type: "COLOR", description: "Disabled surface background",   lightRef: "color/primitive/neutral/100", darkRef: "color/primitive/neutral/800" },
];

const TEXT: SemanticTokenEntry[] = [
  { name: "color/semantic/text/primary",   category: "text", type: "COLOR", description: "Primary text color",           lightRef: "color/primitive/neutral/900", darkRef: "color/primitive/neutral/50" },
  { name: "color/semantic/text/secondary", category: "text", type: "COLOR", description: "Secondary text color",         lightRef: "color/primitive/neutral/600", darkRef: "color/primitive/neutral/300" },
  { name: "color/semantic/text/tertiary",  category: "text", type: "COLOR", description: "Tertiary/muted text color",    lightRef: "color/primitive/neutral/500", darkRef: "color/primitive/neutral/400" },
  { name: "color/semantic/text/disabled",  category: "text", type: "COLOR", description: "Disabled text color",          lightRef: "color/primitive/neutral/400", darkRef: "color/primitive/neutral/600" },
  { name: "color/semantic/text/inverse",   category: "text", type: "COLOR", description: "Inverse text (light on dark)", lightRef: "color/primitive/neutral/50",  darkRef: "color/primitive/neutral/900" },
  { name: "color/semantic/text/on-color",  category: "text", type: "COLOR", description: "Text on colored background",   lightRef: "color/primitive/neutral/50",  darkRef: "color/primitive/neutral/50" },
];

const BORDER: SemanticTokenEntry[] = [
  { name: "color/semantic/border/default",  category: "border", type: "COLOR", description: "Default border color",    lightRef: "color/primitive/neutral/200", darkRef: "color/primitive/neutral/700" },
  { name: "color/semantic/border/strong",   category: "border", type: "COLOR", description: "Strong/emphasis border",  lightRef: "color/primitive/neutral/400", darkRef: "color/primitive/neutral/500" },
  { name: "color/semantic/border/subtle",   category: "border", type: "COLOR", description: "Subtle border",          lightRef: "color/primitive/neutral/100", darkRef: "color/primitive/neutral/800" },
  { name: "color/semantic/border/disabled", category: "border", type: "COLOR", description: "Disabled border",        lightRef: "color/primitive/neutral/200", darkRef: "color/primitive/neutral/800" },
  { name: "color/semantic/border/focus",    category: "border", type: "COLOR", description: "Focus ring border",      lightRef: "color/primitive/brand/500",   darkRef: "color/primitive/brand/400" },
];

const FIELD: SemanticTokenEntry[] = [
  { name: "color/semantic/field/bg/default",      category: "field", type: "COLOR", description: "Field background default",    lightRef: "color/primitive/neutral/50",  darkRef: "color/primitive/neutral/900" },
  { name: "color/semantic/field/bg/disabled",      category: "field", type: "COLOR", description: "Field background disabled",   lightRef: "color/primitive/neutral/100", darkRef: "color/primitive/neutral/800" },
  { name: "color/semantic/field/border/default",   category: "field", type: "COLOR", description: "Field border default",       lightRef: "color/primitive/neutral/300", darkRef: "color/primitive/neutral/600" },
  { name: "color/semantic/field/border/focus",     category: "field", type: "COLOR", description: "Field border focus",         lightRef: "color/primitive/brand/500",   darkRef: "color/primitive/brand/400" },
];

const FEEDBACK: SemanticTokenEntry[] = [
  { name: "color/semantic/feedback/success/bg",   category: "feedback", type: "COLOR", description: "Success background",  lightRef: "color/primitive/success/100", darkRef: "color/primitive/success/900" },
  { name: "color/semantic/feedback/success/text", category: "feedback", type: "COLOR", description: "Success text",        lightRef: "color/primitive/success/700", darkRef: "color/primitive/success/300" },
  { name: "color/semantic/feedback/warning/bg",   category: "feedback", type: "COLOR", description: "Warning background",  lightRef: "color/primitive/warning/100", darkRef: "color/primitive/warning/900" },
  { name: "color/semantic/feedback/warning/text", category: "feedback", type: "COLOR", description: "Warning text",        lightRef: "color/primitive/warning/700", darkRef: "color/primitive/warning/300" },
  { name: "color/semantic/feedback/danger/bg",    category: "feedback", type: "COLOR", description: "Danger background",   lightRef: "color/primitive/danger/100",  darkRef: "color/primitive/danger/900" },
  { name: "color/semantic/feedback/danger/text",  category: "feedback", type: "COLOR", description: "Danger text",         lightRef: "color/primitive/danger/700",  darkRef: "color/primitive/danger/300" },
  { name: "color/semantic/feedback/info/bg",      category: "feedback", type: "COLOR", description: "Info background",     lightRef: "color/primitive/info/100",    darkRef: "color/primitive/info/900" },
  { name: "color/semantic/feedback/info/text",     category: "feedback", type: "COLOR", description: "Info text",           lightRef: "color/primitive/info/700",    darkRef: "color/primitive/info/300" },
];

const FOCUS: SemanticTokenEntry[] = [
  { name: "color/semantic/focus/ring",  category: "focus", type: "COLOR", description: "Focus ring color",   lightRef: "color/primitive/brand/500", darkRef: "color/primitive/brand/400" },
];

const INTERACTIVE: SemanticTokenEntry[] = [
  { name: "color/semantic/interactive/hover-overlay",   category: "interactive", type: "COLOR", description: "Hover overlay tint",    lightRef: "color/primitive/neutral/100", darkRef: "color/primitive/neutral/800" },
  { name: "color/semantic/interactive/pressed-overlay",  category: "interactive", type: "COLOR", description: "Pressed overlay tint",  lightRef: "color/primitive/neutral/200", darkRef: "color/primitive/neutral/700" },
];

// ─── Float semantic tokens ──────────────────────────────────────────────────

const SPACING_SEMANTIC: SemanticTokenEntry[] = [
  { name: "space/semantic/inset/control/sm",  category: "spacing", type: "FLOAT", description: "Control inset padding small",  lightRef: "space/1",  darkRef: "space/1" },
  { name: "space/semantic/inset/control/md",  category: "spacing", type: "FLOAT", description: "Control inset padding medium", lightRef: "space/4",  darkRef: "space/4" },
  { name: "space/semantic/inset/control/lg",  category: "spacing", type: "FLOAT", description: "Control inset padding large",  lightRef: "space/6",  darkRef: "space/6" },
  { name: "space/semantic/inset/page",        category: "spacing", type: "FLOAT", description: "Page-level inset padding",     lightRef: "space/6",  darkRef: "space/6" },
  { name: "space/semantic/gap/stack/sm",      category: "spacing", type: "FLOAT", description: "Vertical stack gap small",     lightRef: "space/2",  darkRef: "space/2" },
  { name: "space/semantic/gap/stack/md",      category: "spacing", type: "FLOAT", description: "Vertical stack gap medium",    lightRef: "space/4",  darkRef: "space/4" },
  { name: "space/semantic/gap/stack/lg",      category: "spacing", type: "FLOAT", description: "Vertical stack gap large",     lightRef: "space/8",  darkRef: "space/8" },
  { name: "space/semantic/gap/inline/md",     category: "spacing", type: "FLOAT", description: "Horizontal inline gap medium", lightRef: "space/3",  darkRef: "space/3" },
];

const RADIUS_SEMANTIC: SemanticTokenEntry[] = [
  { name: "radius/semantic/field/default",    category: "radius", type: "FLOAT", description: "Field border radius",     lightRef: "radius/sm",   darkRef: "radius/sm" },
  { name: "radius/semantic/surface/default",  category: "radius", type: "FLOAT", description: "Surface border radius",   lightRef: "radius/lg",   darkRef: "radius/lg" },
  { name: "radius/semantic/pill",             category: "radius", type: "FLOAT", description: "Pill / full radius",      lightRef: "radius/full", darkRef: "radius/full" },
  { name: "radius/semantic/control/default",  category: "radius", type: "FLOAT", description: "Control border radius",   lightRef: "radius/md",   darkRef: "radius/md" },
];

// ─── Aggregate catalog ──────────────────────────────────────────────────────

export const SEMANTIC_TOKEN_CATALOG: SemanticTokenEntry[] = [
  ...ACTIONS,
  ...SURFACE,
  ...TEXT,
  ...BORDER,
  ...FIELD,
  ...FEEDBACK,
  ...FOCUS,
  ...INTERACTIVE,
  ...SPACING_SEMANTIC,
  ...RADIUS_SEMANTIC,
];

/**
 * Filter catalog entries by category.
 */
export function getTokensByCategory(category: string): SemanticTokenEntry[] {
  return SEMANTIC_TOKEN_CATALOG.filter((t) => t.category === category);
}

/**
 * Get all unique categories in the catalog.
 */
export function getCategories(): string[] {
  return [...new Set(SEMANTIC_TOKEN_CATALOG.map((t) => t.category))];
}

/**
 * Get only COLOR-type semantic tokens.
 */
export function getColorSemanticTokens(): SemanticTokenEntry[] {
  return SEMANTIC_TOKEN_CATALOG.filter((t) => t.type === "COLOR");
}

/**
 * Get only FLOAT-type semantic tokens (spacing, radius).
 */
export function getFloatSemanticTokens(): SemanticTokenEntry[] {
  return SEMANTIC_TOKEN_CATALOG.filter((t) => t.type === "FLOAT");
}
