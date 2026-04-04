// ─────────────────────────────────────────────────────────────────────────────
// Concept Taxonomy
// Typed, queryable data module encoding ~25 UI concepts from the semantic
// token naming convention. Each concept defines its purpose, typical forms
// (component names), required token roles, valid states, and valid variants.
//
// Used by: taxonomy-docs, token-binder, token-naming, component-archaeologist,
//          variant-expander, ds-scaffolder.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────────────────

export type TokenCategory =
  | "color"
  | "border"
  | "radius"
  | "shadow"
  | "space"
  | "typography"
  | "motion"
  | "opacity"
  | "z-index"
  | "border-width"
  | "icon-size";

export interface TokenRole {
  /** Top-level token category (matches primitiveCategories in token-naming) */
  category: TokenCategory;
  /** Property within the category: "background", "text", "icon", "border", "ring", etc. */
  property: string;
  /** Whether this role is required for a well-formed component of this concept */
  required: boolean;
}

export interface ConceptDefinition {
  /** Unique concept identifier, e.g. "action", "surface", "field" */
  id: string;
  /** Short purpose description */
  purpose: string;
  /** Component names that belong to this concept (maps to COMPONENT_BLUEPRINTS names) */
  typicalForms: string[];
  /** Token roles this concept requires */
  tokenRoles: TokenRole[];
  /** Valid interaction/visual states */
  validStates: string[];
  /** Valid visual variants */
  validVariants: string[];
}

// ─── Grammar Constants ───────────────────────────────────────────────────────
// The formal naming grammar for semantic tokens:
//   <category>/<concept>[/<variant>]/<property>[/<state>]
//
// For component alias tokens:
//   component/<component>[/<part>][/<variant>]/<category>/<property>[/<state>]

export const GRAMMAR = {
  separator: "/",
  pattern: "<category>/<concept>[/<variant>]/<property>[/<state>]",
  componentPattern: "component/<component>[/<part>][/<variant>]/<category>/<property>[/<state>]",
  categories: ["color", "border", "radius", "shadow", "space", "typography", "motion", "opacity", "z-index", "border-width", "icon-size"] as const,
  properties: ["background", "text", "icon", "border", "ring", "border-color", "border-width", "shadow", "inset", "gap", "corner-radius", "font-size", "font-weight", "line-height", "letter-spacing", "duration", "easing"] as const,
  states: ["default", "hover", "active", "pressed", "focus", "disabled", "selected", "visited", "error", "success", "warning", "loading", "checked", "indeterminate", "on", "off"] as const,
} as const;

// ─── Concept Definitions ─────────────────────────────────────────────────────

export const CONCEPT_TAXONOMY: ConceptDefinition[] = [
  // ── Interactive Concepts ───────────────────────────────────────────────────

  {
    id: "action",
    purpose: "Interactive elements like buttons, links, and icon-buttons that trigger operations",
    typicalForms: ["Button", "IconButton", "Link", "FAB"],
    tokenRoles: [
      { category: "color",        property: "background",    required: true },
      { category: "color",        property: "text",          required: true },
      { category: "color",        property: "icon",          required: false },
      { category: "color",        property: "border",        required: false },
      { category: "radius",       property: "corner-radius", required: true },
      { category: "space",        property: "inset",         required: true },
      { category: "opacity",      property: "disabled",      required: true },
      { category: "color",        property: "ring",          required: false },
      { category: "radius",       property: "ring",          required: false },
    ],
    validStates: ["default", "hover", "active", "pressed", "focus", "disabled", "loading"],
    validVariants: ["primary", "secondary", "ghost", "destructive", "outline"],
  },

  {
    id: "field",
    purpose: "Inputs and editable components for user data entry",
    typicalForms: ["Input", "Select", "Textarea", "DatePicker", "TimePicker", "ColorPicker", "Slider", "NumberInput"],
    tokenRoles: [
      { category: "color",        property: "background",    required: true },
      { category: "color",        property: "text",          required: true },
      { category: "color",        property: "border",        required: true },
      { category: "color",        property: "icon",          required: false },
      { category: "radius",       property: "corner-radius", required: true },
      { category: "space",        property: "inset",         required: true },
      { category: "border-width", property: "border-width",  required: true },
      { category: "color",        property: "ring",          required: false },
    ],
    validStates: ["default", "focus", "error", "success", "warning", "disabled"],
    validVariants: ["default", "filled", "outlined"],
  },

  {
    id: "selection",
    purpose: "Selectable elements showing user choices or highlights",
    typicalForms: ["Checkbox", "Radio", "Toggle", "Switch", "SegmentedControl"],
    tokenRoles: [
      { category: "color",   property: "background",    required: true },
      { category: "color",   property: "border",        required: true },
      { category: "color",   property: "text",          required: true },
      { category: "color",   property: "icon",          required: false },
      { category: "radius",  property: "corner-radius", required: true },
    ],
    validStates: ["default", "checked", "indeterminate", "selected", "disabled", "focus"],
    validVariants: [],
  },

  // ── Container / Surface Concepts ──────────────────────────────────────────

  {
    id: "surface",
    purpose: "Structural backgrounds and containers for content areas like cards, panels, sheets",
    typicalForms: ["Card", "Panel", "Sheet", "Section", "Paper", "Well"],
    tokenRoles: [
      { category: "color",   property: "background",    required: true },
      { category: "color",   property: "border",        required: false },
      { category: "radius",  property: "corner-radius", required: true },
      { category: "shadow",  property: "shadow",        required: false },
      { category: "space",   property: "inset",         required: true },
    ],
    validStates: ["default"],
    validVariants: ["default", "raised", "subtle", "overlay", "inverse"],
  },

  {
    id: "float",
    purpose: "Floating layers or containers appearing above other UI — popovers, dropdowns, menus",
    typicalForms: ["Popover", "Dropdown", "Menu", "ContextMenu", "FloatingPanel"],
    tokenRoles: [
      { category: "color",   property: "background",    required: true },
      { category: "color",   property: "border",        required: true },
      { category: "radius",  property: "corner-radius", required: true },
      { category: "shadow",  property: "shadow",        required: true },
      { category: "z-index", property: "z-index",       required: true },
    ],
    validStates: ["default"],
    validVariants: ["default", "compact"],
  },

  {
    id: "modal",
    purpose: "Modal dialogs and overlays that block interaction with content behind",
    typicalForms: ["Modal", "Dialog", "Drawer", "AlertDialog", "BottomSheet"],
    tokenRoles: [
      { category: "color",   property: "background",    required: true },
      { category: "color",   property: "border",        required: false },
      { category: "color",   property: "text",          required: true },
      { category: "radius",  property: "corner-radius", required: true },
      { category: "shadow",  property: "shadow",        required: true },
      { category: "z-index", property: "z-index",       required: true },
      { category: "opacity", property: "backdrop",      required: true },
    ],
    validStates: ["default"],
    validVariants: ["default", "fullscreen", "compact"],
  },

  // ── Feedback Concepts ─────────────────────────────────────────────────────

  {
    id: "feedback",
    purpose: "Status or alert components conveying system state — toasts, banners, alerts",
    typicalForms: ["Toast", "Alert", "Banner", "Snackbar", "Callout", "InlineMessage"],
    tokenRoles: [
      { category: "color",   property: "background",    required: true },
      { category: "color",   property: "text",          required: true },
      { category: "color",   property: "icon",          required: false },
      { category: "color",   property: "border",        required: false },
      { category: "radius",  property: "corner-radius", required: true },
      { category: "shadow",  property: "shadow",        required: false },
      { category: "z-index", property: "z-index",       required: false },
    ],
    validStates: ["default"],
    validVariants: ["success", "warning", "error", "info"],
  },

  {
    id: "progress",
    purpose: "Visual indicators of task completion — progress bars, spinners, steppers",
    typicalForms: ["ProgressBar", "Spinner", "Stepper", "Skeleton", "LoadingDots"],
    tokenRoles: [
      { category: "color",  property: "background",    required: true },
      { category: "color",  property: "indicator",     required: true },
      { category: "radius", property: "corner-radius", required: true },
      { category: "motion", property: "duration",      required: false },
      { category: "motion", property: "easing",        required: false },
    ],
    validStates: ["default", "loading"],
    validVariants: ["linear", "circular", "determinate", "indeterminate"],
  },

  // ── Navigation Concepts ───────────────────────────────────────────────────

  {
    id: "navigation",
    purpose: "UI elements that support movement through the application — tabs, breadcrumbs, navbars",
    typicalForms: ["NavBar", "Tabs", "Breadcrumb", "Sidebar", "Pagination", "BottomNav", "AppBar"],
    tokenRoles: [
      { category: "color",  property: "background",    required: true },
      { category: "color",  property: "text",          required: true },
      { category: "color",  property: "border",        required: false },
      { category: "color",  property: "icon",          required: false },
      { category: "shadow", property: "shadow",        required: false },
    ],
    validStates: ["default", "active", "hover", "focus", "disabled", "visited"],
    validVariants: ["default", "compact", "expanded"],
  },

  // ── Compact / Inline Concepts ─────────────────────────────────────────────

  {
    id: "chip",
    purpose: "Compact, pill-shaped elements for filters, tags, or input tokens",
    typicalForms: ["Tag", "Chip", "FilterChip", "InputTag"],
    tokenRoles: [
      { category: "color",  property: "background",    required: true },
      { category: "color",  property: "text",          required: true },
      { category: "color",  property: "border",        required: false },
      { category: "color",  property: "icon",          required: false },
      { category: "radius", property: "corner-radius", required: true },
    ],
    validStates: ["default", "selected", "disabled", "hover", "focus"],
    validVariants: ["default", "outlined", "filled"],
  },

  {
    id: "badge",
    purpose: "Tiny indicators for counts or status — notification dots, status badges",
    typicalForms: ["Badge", "StatusDot", "Counter"],
    tokenRoles: [
      { category: "color",  property: "background", required: true },
      { category: "color",  property: "text",       required: true },
      { category: "radius", property: "corner-radius", required: true },
    ],
    validStates: ["default"],
    validVariants: ["default", "dot", "count"],
  },

  // ── Content Display Concepts ──────────────────────────────────────────────

  {
    id: "text",
    purpose: "Semantic typography tokens applied across components — headings, body, captions",
    typicalForms: ["Heading", "Paragraph", "Caption", "Label", "Overline", "Blockquote"],
    tokenRoles: [
      { category: "color",      property: "text",           required: true },
      { category: "typography", property: "font-size",      required: true },
      { category: "typography", property: "font-weight",    required: true },
      { category: "typography", property: "line-height",    required: true },
      { category: "typography", property: "letter-spacing", required: false },
    ],
    validStates: ["default", "disabled"],
    validVariants: ["primary", "secondary", "tertiary", "inverse"],
  },

  {
    id: "icon",
    purpose: "Visual symbols and graphics indicating meaning or functionality",
    typicalForms: ["Icon", "Avatar", "Logo", "Illustration"],
    tokenRoles: [
      { category: "color",     property: "foreground", required: true },
      { category: "icon-size", property: "size",       required: true },
    ],
    validStates: ["default", "active", "disabled"],
    validVariants: ["default", "primary", "secondary", "inverse"],
  },

  {
    id: "data-display",
    purpose: "Components showing structured or visual data — tables, lists, stats",
    typicalForms: ["Table", "DataGrid", "List", "DescriptionList", "StatCard", "KPI"],
    tokenRoles: [
      { category: "color",  property: "background",    required: true },
      { category: "color",  property: "text",          required: true },
      { category: "color",  property: "border",        required: true },
      { category: "space",  property: "gap",           required: true },
    ],
    validStates: ["default", "selected", "hover"],
    validVariants: ["default", "striped", "compact"],
  },

  {
    id: "profile",
    purpose: "Profile or entity representations — avatars, user cards",
    typicalForms: ["Avatar", "AvatarGroup", "UserCard", "EntityCard"],
    tokenRoles: [
      { category: "color",  property: "background", required: true },
      { category: "color",  property: "text",       required: false },
      { category: "radius", property: "corner-radius", required: true },
    ],
    validStates: ["default", "active"],
    validVariants: ["circle", "square", "rounded"],
  },

  // ── Overlay & Utility Concepts ────────────────────────────────────────────

  {
    id: "tooltip",
    purpose: "Contextual hints or inline explanations — tooltips, help bubbles",
    typicalForms: ["Tooltip", "HelpText", "InfoBubble"],
    tokenRoles: [
      { category: "color",   property: "background", required: true },
      { category: "color",   property: "text",       required: true },
      { category: "radius",  property: "corner-radius", required: true },
      { category: "shadow",  property: "shadow",     required: true },
      { category: "z-index", property: "z-index",    required: true },
    ],
    validStates: ["default"],
    validVariants: ["default", "rich"],
  },

  {
    id: "focus",
    purpose: "Visual outlines or rings indicating keyboard or accessibility focus",
    typicalForms: [],
    tokenRoles: [
      { category: "color",        property: "ring",          required: true },
      { category: "border-width", property: "ring-width",    required: true },
      { category: "radius",       property: "ring-radius",   required: false },
      { category: "color",        property: "ring-border",   required: false },
    ],
    validStates: ["default", "active"],
    validVariants: [],
  },

  {
    id: "elevation",
    purpose: "Depth and shadow levels indicating hierarchy or separation",
    typicalForms: [],
    tokenRoles: [
      { category: "shadow", property: "shadow", required: true },
    ],
    validStates: ["default"],
    validVariants: ["xs", "sm", "md", "lg", "xl"],
  },

  {
    id: "layout",
    purpose: "Spacing and structure elements for grids or containers",
    typicalForms: ["Grid", "Stack", "Flex", "Divider", "Spacer"],
    tokenRoles: [
      { category: "space", property: "gap",   required: true },
      { category: "space", property: "inset", required: true },
    ],
    validStates: ["default"],
    validVariants: ["compact", "default", "spacious"],
  },

  {
    id: "motion",
    purpose: "Timing, duration, and easing for transitions and animations",
    typicalForms: [],
    tokenRoles: [
      { category: "motion", property: "duration", required: true },
      { category: "motion", property: "easing",   required: true },
    ],
    validStates: ["default"],
    validVariants: ["instant", "fast", "normal", "slow"],
  },

  {
    id: "status",
    purpose: "Color and meaning tokens for brand or status communications",
    typicalForms: ["StatusIndicator", "StatusBadge"],
    tokenRoles: [
      { category: "color", property: "background", required: true },
      { category: "color", property: "text",       required: true },
      { category: "color", property: "border",     required: false },
    ],
    validStates: ["default"],
    validVariants: ["success", "warning", "error", "info", "neutral"],
  },

  {
    id: "skeleton",
    purpose: "Loading placeholders that mimic content shapes before data arrives",
    typicalForms: ["Skeleton", "Shimmer", "Placeholder"],
    tokenRoles: [
      { category: "color",  property: "background", required: true },
      { category: "radius", property: "corner-radius", required: true },
      { category: "motion", property: "duration",   required: false },
    ],
    validStates: ["default", "loading"],
    validVariants: ["text", "circle", "rect"],
  },

  {
    id: "toggles",
    purpose: "Binary or inclusive selection components — switches, toggles",
    typicalForms: ["Toggle", "Switch"],
    tokenRoles: [
      { category: "color",  property: "background", required: true },
      { category: "color",  property: "indicator",  required: true },
      { category: "color",  property: "border",     required: false },
      { category: "radius", property: "corner-radius", required: true },
    ],
    validStates: ["default", "on", "off", "disabled", "focus"],
    validVariants: [],
  },

  {
    id: "utility",
    purpose: "Supportive structural or functional elements — dividers, scrollbars",
    typicalForms: ["Divider", "Scrollbar", "Resizer"],
    tokenRoles: [
      { category: "color", property: "background", required: true },
    ],
    validStates: ["default"],
    validVariants: [],
  },

  {
    id: "decorative",
    purpose: "Purely aesthetic elements — backgrounds, patterns, gradients",
    typicalForms: ["Illustration", "Pattern", "Gradient", "BackgroundArt"],
    tokenRoles: [
      { category: "color", property: "foreground", required: false },
    ],
    validStates: [],
    validVariants: [],
  },
];

// ─── Lookup Maps (built once) ────────────────────────────────────────────────

const conceptById = new Map<string, ConceptDefinition>();
const conceptByForm = new Map<string, ConceptDefinition>();

for (const concept of CONCEPT_TAXONOMY) {
  conceptById.set(concept.id, concept);
  for (const form of concept.typicalForms) {
    conceptByForm.set(form.toLowerCase(), concept);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get a concept by its ID (e.g. "action", "surface").
 */
export function getConceptById(id: string): ConceptDefinition | null {
  return conceptById.get(id) ?? null;
}

/**
 * Get the concept definition for a component name (e.g. "Button" → action).
 * Case-insensitive match against typicalForms.
 */
export function getConceptForComponent(componentName: string): ConceptDefinition | null {
  return conceptByForm.get(componentName.toLowerCase()) ?? null;
}

/**
 * Get all concept IDs.
 */
export function getConceptIds(): string[] {
  return CONCEPT_TAXONOMY.map((c) => c.id);
}

/**
 * Get valid states for a concept.
 */
export function getValidStatesForConcept(conceptId: string): string[] {
  return conceptById.get(conceptId)?.validStates ?? [];
}

/**
 * Get valid variants for a concept.
 */
export function getValidVariantsForConcept(conceptId: string): string[] {
  return conceptById.get(conceptId)?.validVariants ?? [];
}

// ─── Token Path Generation ───────────────────────────────────────────────────

/**
 * Maps a TokenRole to the slash-delimited token paths it represents,
 * using the existing codebase naming convention.
 */
function roleToTokenPaths(conceptId: string, role: TokenRole): string[] {
  const paths: string[] = [];
  const { category, property } = role;

  switch (category) {
    case "color":
      if (property === "background") {
        paths.push(`color/semantic/${conceptId === "action" ? "actions" : conceptId}/bg/default`);
      } else if (property === "text") {
        paths.push(`color/semantic/text/primary`);
        if (conceptId === "action") paths.push(`color/semantic/text/on-color`);
      } else if (property === "border") {
        paths.push(`color/semantic/border/default`);
      } else if (property === "icon") {
        paths.push(`color/semantic/icon/default`);
      } else if (property === "ring") {
        paths.push(`color/semantic/focus/ring`);
      } else if (property === "foreground") {
        paths.push(`color/semantic/icon/default`);
      } else if (property === "indicator") {
        paths.push(`color/semantic/actions/primary/bg/default`);
      } else if (property === "ring-border") {
        paths.push(`color/semantic/border/focus`);
      }
      break;

    case "radius":
      if (property === "corner-radius") {
        const sub = (conceptId === "surface" || conceptId === "modal" || conceptId === "float")
          ? "surface" : "control";
        paths.push(`radius/semantic/${sub}/default`);
      } else if (property === "ring" || property === "ring-radius") {
        paths.push(`radius/semantic/control/default`);
      }
      break;

    case "shadow":
      paths.push(`elevation/semantic/shadow/md`);
      break;

    case "space":
      if (property === "inset") {
        paths.push(`space/semantic/inset/control/md`);
      } else if (property === "gap") {
        paths.push(`space/semantic/gap/stack/md`);
      }
      break;

    case "opacity":
      if (property === "disabled") {
        paths.push(`opacity/semantic/disabled`);
      } else if (property === "backdrop") {
        paths.push(`opacity/semantic/backdrop`);
      }
      break;

    case "z-index":
      if (conceptId === "modal") paths.push(`z-index/semantic/modal`);
      else if (conceptId === "tooltip") paths.push(`z-index/semantic/tooltip`);
      else if (conceptId === "float") paths.push(`z-index/semantic/dropdown`);
      else if (conceptId === "feedback") paths.push(`z-index/semantic/toast`);
      else paths.push(`z-index/semantic/base`);
      break;

    case "border-width":
      paths.push(`border-width/semantic/thin`);
      break;

    case "icon-size":
      paths.push(`icon-size/semantic/md`);
      break;

    case "typography":
      if (property === "font-size") paths.push(`typography/size/md`);
      else if (property === "font-weight") paths.push(`typography/font-weight/regular`);
      else if (property === "line-height") paths.push(`typography/line-height/normal`);
      else if (property === "letter-spacing") paths.push(`typography/letter-spacing/normal`);
      break;

    case "motion":
      if (property === "duration") paths.push(`motion/duration/normal`);
      else if (property === "easing") paths.push(`motion/easing/productive`);
      break;
  }

  return paths;
}

/**
 * Get all required token paths for a concept, using the existing
 * slash-delimited naming convention from the codebase.
 */
export function getRequiredTokenPaths(conceptId: string): string[] {
  const concept = conceptById.get(conceptId);
  if (!concept) return [];

  const paths: string[] = [];
  for (const role of concept.tokenRoles) {
    if (role.required) {
      paths.push(...roleToTokenPaths(conceptId, role));
    }
  }
  return [...new Set(paths)];
}

/**
 * Get ALL token paths (required + optional) for a concept.
 */
export function getAllTokenPaths(conceptId: string): string[] {
  const concept = conceptById.get(conceptId);
  if (!concept) return [];

  const paths: string[] = [];
  for (const role of concept.tokenRoles) {
    paths.push(...roleToTokenPaths(conceptId, role));
  }
  return [...new Set(paths)];
}

/**
 * Assemble a token name following the grammar:
 *   <category>/<concept>[/<variant>]/<property>[/<state>]
 */
export function generateTokenName(
  category: string,
  concept: string,
  property: string,
  variant?: string,
  state?: string,
): string {
  const parts = [category, concept];
  if (variant) parts.push(variant);
  parts.push(property);
  if (state) parts.push(state);
  return parts.join(GRAMMAR.separator);
}

/**
 * Parse a semantic token name into its grammar components.
 * Returns null if the name doesn't follow the grammar.
 */
export function parseTokenName(name: string): {
  category: string;
  concept: string;
  variant: string | null;
  property: string;
  state: string | null;
} | null {
  const segments = name.split(GRAMMAR.separator).filter(Boolean);
  if (segments.length < 2) return null;

  const category = segments[0];

  // Skip the "semantic" prefix if present (e.g. "color/semantic/actions/primary/bg/default")
  let idx = 1;
  if (segments[idx] === "semantic") idx++;
  if (idx >= segments.length) return null;

  const concept = segments[idx++];
  if (idx >= segments.length) return { category, concept, variant: null, property: concept, state: null };

  // Remaining segments: could be [variant, property, state] or [property, state] or [property]
  const remaining = segments.slice(idx);

  // Check if last segment is a known state
  const lastSegment = remaining[remaining.length - 1];
  const knownStates = new Set<string>(GRAMMAR.states);
  const hasState = knownStates.has(lastSegment);

  if (remaining.length === 1) {
    return { category, concept, variant: null, property: remaining[0], state: null };
  }

  if (remaining.length === 2) {
    if (hasState) {
      return { category, concept, variant: null, property: remaining[0], state: remaining[1] };
    }
    return { category, concept, variant: remaining[0], property: remaining[1], state: null };
  }

  if (remaining.length >= 3) {
    if (hasState) {
      return {
        category,
        concept,
        variant: remaining.slice(0, -2).join(GRAMMAR.separator),
        property: remaining[remaining.length - 2],
        state: remaining[remaining.length - 1],
      };
    }
    return {
      category,
      concept,
      variant: remaining.slice(0, -1).join(GRAMMAR.separator),
      property: remaining[remaining.length - 1],
      state: null,
    };
  }

  return null;
}
