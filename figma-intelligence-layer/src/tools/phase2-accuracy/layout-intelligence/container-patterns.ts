// ─────────────────────────────────────────────────────────────────────────────
// Container Patterns
// Lookup table that maps detected container kinds to optimal Auto Layout
// configuration and spacing tokens.  Used by layout-intelligence.
// ─────────────────────────────────────────────────────────────────────────────

export type ContainerKind =
  | "navigation bar"
  | "card"
  | "form"
  | "button"
  | "grid"
  | "list item"
  | "modal"
  | "section";

export interface AutoLayoutSpec {
  direction: "HORIZONTAL" | "VERTICAL" | "WRAP";
  primaryAxisSizingMode: "FIXED" | "AUTO";
  counterAxisSizingMode: "FIXED" | "AUTO";
  paddingToken: string;
  gapToken: string;
  paddingValue: number;
  gapValue: number;
}

/** Spacing token name → px */
export const SPACE: Record<string, number> = {
  "--space-xs":  4,
  "--space-sm":  8,
  "--space-md":  16,
  "--space-lg":  24,
  "--space-xl":  32,
  "--space-2xl": 48,
};

/**
 * Container type → recommended Auto Layout + token settings.
 *
 * From the plan:
 *   Navigation bar  → Horizontal, Fill W / Hug H, --space-md
 *   Card            → Vertical,   Fill W / Hug H, --space-lg
 *   Form            → Vertical,   Fill W / Hug H, --space-md gap
 *   Button          → Horizontal, Hug W / Hug H,  --space-sm × --space-md
 *   Grid container  → Wrap,       Fill W / Hug H, --space-md gap
 *   List item       → Horizontal, Fill W / Hug H, --space-sm gap
 *   Modal           → Vertical,   Fixed W / Hug H, --space-xl padding
 *   Page section    → Vertical,   Fill W / Hug H, --space-2xl padding
 */
export const CONTAINER_SPECS: Record<ContainerKind, AutoLayoutSpec> = {
  "navigation bar": {
    direction: "HORIZONTAL",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    paddingToken: "--space-md",
    gapToken: "--space-md",
    paddingValue: SPACE["--space-md"],
    gapValue: SPACE["--space-md"],
  },
  card: {
    direction: "VERTICAL",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    paddingToken: "--space-lg",
    gapToken: "--space-lg",
    paddingValue: SPACE["--space-lg"],
    gapValue: SPACE["--space-lg"],
  },
  form: {
    direction: "VERTICAL",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    paddingToken: "--space-md",
    gapToken: "--space-md",
    paddingValue: SPACE["--space-md"],
    gapValue: SPACE["--space-md"],
  },
  button: {
    direction: "HORIZONTAL",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    paddingToken: "--space-sm",
    gapToken: "--space-sm",
    paddingValue: SPACE["--space-sm"],
    gapValue: SPACE["--space-sm"],
  },
  grid: {
    direction: "WRAP",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    paddingToken: "--space-md",
    gapToken: "--space-md",
    paddingValue: SPACE["--space-md"],
    gapValue: SPACE["--space-md"],
  },
  "list item": {
    direction: "HORIZONTAL",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    paddingToken: "--space-sm",
    gapToken: "--space-sm",
    paddingValue: SPACE["--space-sm"],
    gapValue: SPACE["--space-sm"],
  },
  modal: {
    direction: "VERTICAL",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "AUTO",
    paddingToken: "--space-xl",
    gapToken: "--space-xl",
    paddingValue: SPACE["--space-xl"],
    gapValue: SPACE["--space-xl"],
  },
  section: {
    direction: "VERTICAL",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    paddingToken: "--space-2xl",
    gapToken: "--space-2xl",
    paddingValue: SPACE["--space-2xl"],
    gapValue: SPACE["--space-2xl"],
  },
};
