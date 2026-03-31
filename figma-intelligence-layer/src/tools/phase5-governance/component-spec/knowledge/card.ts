import type { ComponentKnowledge } from "../types.js";

export const cardKnowledge: ComponentKnowledge = {
  description:
    "Content container | Grouped information surface | Scannable content unit",

  stateSpecifications: [
    { state: "Default", visualChange: "Elevated surface with content zones, resting shadow", opacity: "1", cursorWeb: "default", usage: "Static content display card" },
    { state: "Hover (clickable)", visualChange: "Shadow increases, subtle lift transform", opacity: "1", cursorWeb: "pointer", usage: "User hovers over an interactive card" },
    { state: "Focus (clickable)", visualChange: "Focus ring around entire card boundary", opacity: "1", cursorWeb: "pointer", usage: "Keyboard focus on an interactive card" },
    { state: "Pressed (clickable)", visualChange: "Shadow decreases, card presses down slightly", opacity: "1", cursorWeb: "pointer", usage: "Card is being actively clicked or tapped" },
    { state: "Selected", visualChange: "Border changes to primary color, optional checkmark overlay", opacity: "1", cursorWeb: "pointer", usage: "Card has been chosen in a selection context" },
    { state: "Disabled", visualChange: "Content and surface dimmed, no interaction", opacity: "0.5", cursorWeb: "not-allowed", usage: "Card content is unavailable" },
    { state: "Loading/Skeleton", visualChange: "Placeholder shimmer blocks replace text and image areas", opacity: "1", cursorWeb: "default", usage: "Card data is being fetched asynchronously" },
  ],

  propertyDescriptions: {
    variant: "Visual style — elevated (shadow), outlined (border), or filled (background tint)",
    clickable: "When true, the entire card surface is an interactive click target",
    mediaPosition: "Where the image/media sits relative to content — top, left, right, or background",
    title: "Primary heading text for the card",
    subtitle: "Secondary text below the title providing context or metadata",
    body: "Main descriptive content inside the card",
    mediaSlot: "Image, illustration, or video displayed in the media zone",
    actionsSlot: "Footer area for buttons, links, or icon actions",
    badge: "Optional status indicator overlaid on the card (e.g. 'New', 'Sale')",
    selected: "Whether the card is in a selected state within a selectable group",
  },

  sizeSpecifications: [
    { size: "compact", height: "auto (min 120px)", paddingLR: "12px", fontSize: "12px", iconSize: "16px", borderRadius: "8px" },
    { size: "sm", height: "auto (min 160px)", paddingLR: "16px", fontSize: "14px", iconSize: "16px", borderRadius: "8px" },
    { size: "md", height: "auto (min 200px)", paddingLR: "16px", fontSize: "14px", iconSize: "20px", borderRadius: "12px" },
    { size: "lg", height: "auto (min 280px)", paddingLR: "24px", fontSize: "16px", iconSize: "20px", borderRadius: "12px" },
    { size: "horizontal", height: "auto (min 140px)", paddingLR: "16px", fontSize: "14px", iconSize: "20px", borderRadius: "12px" },
  ],

  designTokenBindings: [
    { property: "surface-bg", tokenName: "color/layer/01", role: "Card background fill", fallback: "#FFFFFF" },
    { property: "border", tokenName: "color/border/subtle/01", role: "Outline variant border", fallback: "#E0E0E0" },
    { property: "shadow-resting", tokenName: "shadow/raised/02", role: "Elevation shadow at rest", fallback: "0 2px 6px rgba(0,0,0,0.1)" },
    { property: "shadow-hover", tokenName: "shadow/raised/04", role: "Elevated shadow on hover for clickable cards", fallback: "0 6px 16px rgba(0,0,0,0.15)" },
    { property: "title-text", tokenName: "color/text/primary", role: "Card title color", fallback: "#161616" },
    { property: "body-text", tokenName: "color/text/secondary", role: "Body and subtitle text color", fallback: "#525252" },
    { property: "selected-border", tokenName: "color/border/interactive", role: "Border on selected cards", fallback: "#0F62FE" },
  ],

  structureRules: [
    "Cards follow a vertical stack: media zone → content zone (title, subtitle, body) → action zone",
    "Horizontal cards place the media zone on the left (LTR) or right (RTL) with content beside it",
    "The media zone has no padding; images bleed to the card edges with overflow:hidden and border-radius",
    "Content zone applies internal padding; title comes first, followed by subtitle, then body",
    "Action zone sits at the bottom with a top divider and horizontal button layout aligned to the end",
    "Clickable cards wrap the entire surface in an <a> or <button>; actions inside use stopPropagation",
    "Card aspect ratio is content-driven by default; media zone can enforce a fixed aspect ratio (16:9, 4:3)",
  ],

  typeHierarchyRules: [
    "Title uses heading-compact-02 (16px/22px semibold) for md size and heading-compact-01 for sm",
    "Subtitle uses body-compact-01 (14px) in text-secondary color",
    "Body text uses body-01 (14px/20px) for comfortable reading within the card",
    "Metadata (date, author, category) uses label-01 (12px) in text-helper color",
    "Action button labels use body-compact-01 (14px) matching the design system button spec",
    "Badge text uses label-01 (12px) with inverse text on a filled background",
    "Title is limited to 2 lines with line-clamp; body limited to 3 lines",
  ],

  interactionRules: [
    { event: "click", trigger: "User clicks anywhere on a clickable card", action: "Navigate to the card's detail view or trigger onSelect callback" },
    { event: "keydown:Enter/Space", trigger: "Focus is on a clickable card", action: "Activate the card (same as click)" },
    { event: "hover", trigger: "Pointer enters card boundary", action: "Increase shadow elevation and apply subtle scale transform" },
    { event: "click:action-button", trigger: "User clicks a button inside the action zone", action: "Execute button action; stopPropagation prevents card-level click" },
    { event: "long-press", trigger: "Touch user holds on card (mobile)", action: "Show context menu or enter selection mode" },
    { event: "swipe", trigger: "Horizontal swipe on card (mobile)", action: "Reveal quick actions (archive, delete) from the side" },
  ],

  contentGuidance: [
    "Use a clear, specific title — 'Q3 Revenue Report' not 'Report'",
    "Limit body text to 2–3 sentences; cards are for scanning, not deep reading",
    "Use high-quality images with consistent aspect ratios across a card grid",
    "Place the most important information (title, key metric) at the top of the content zone",
    "Action buttons should use ghost or tertiary style to avoid competing with card-level click",
    "Metadata like dates and authors belong below the body text or in the subtitle",
    "Badge labels should be 1–2 words: 'New', 'Featured', 'Sold out'",
  ],

  responsiveBehaviour: [
    { breakpoint: "≥ 1056px (lg)", behavior: "Cards in a 3–4 column grid; horizontal variant available" },
    { breakpoint: "672–1055px (md)", behavior: "Cards reflow to 2 column grid; horizontal cards stack vertically" },
    { breakpoint: "< 672px (sm)", behavior: "Single column stack; cards fill full width; media aspect ratio may shift to 16:9" },
    { breakpoint: "Touch devices", behavior: "Hover states replaced by active/pressed feedback; swipe actions enabled" },
    { breakpoint: "Container queries", behavior: "Card adapts internal layout based on its own width, not viewport" },
  ],

  accessibilitySpec: {
    intro:
      "Cards must be perceivable as distinct content units and, when interactive, operable via keyboard. Clickable cards require careful handling to avoid nested interactive element issues.",
    requirements: [
      { requirement: "Clickable cards must be focusable and activated via Enter or Space", level: "A", notes: "Use <a> for navigation or <button> for actions" },
      { requirement: "Card images must have descriptive alt text or be marked decorative (alt='')", level: "A", notes: "If the image is essential to understanding the card, alt text is required" },
      { requirement: "Nested interactive elements (buttons, links) must not be inside the card's primary <a>/<button>", level: "A", notes: "Use CSS pseudo-element technique to make card clickable without nesting" },
      { requirement: "Card groups should use <ul>/<li> structure for list semantics", level: "A", notes: "Screen readers announce 'list of 12 items' providing context" },
      { requirement: "Selected cards must convey state via aria-selected or aria-pressed", level: "A", notes: "Also provide visual indicator beyond color (checkmark, border)" },
      { requirement: "Text must maintain 4.5:1 contrast against the card surface", level: "AA", notes: "Check both light and dark theme values" },
      { requirement: "Skeleton loading state should use aria-busy='true' on the card region", level: "AA", notes: "Announce 'loading' to screen readers" },
    ],
    outro: [
      "Test keyboard navigation through a grid of clickable cards using Tab key",
      "Verify that nested action buttons are independently focusable and do not trigger card navigation",
      "Ensure card groups announce the count and position (e.g. 'item 3 of 12')",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Clickable card navigates on click and Enter key", platform: "All", expectedResult: "Detail view opens; URL updates if applicable" },
    { check: "Hover shadow elevation increases", platform: "Web", expectedResult: "Smooth transition from resting to hover shadow" },
    { check: "Action buttons work independently of card click", platform: "Web", expectedResult: "Button action fires; card navigation does not trigger" },
    { check: "Image maintains aspect ratio", platform: "All", expectedResult: "No stretching or cropping beyond intended bounds" },
    { check: "Cards reflow to single column on mobile", platform: "Mobile", expectedResult: "Full width cards stacked vertically with consistent spacing" },
    { check: "Selected state is visually distinct", platform: "All", expectedResult: "Border color changes, checkmark visible, aria-selected is true" },
    { check: "Skeleton state renders placeholder blocks", platform: "Web", expectedResult: "Shimmer animation on text and media placeholders" },
  ],

  dos: [
    "Maintain consistent card heights within a row using CSS grid alignment",
    "Use the outlined variant on busy backgrounds to provide clear boundaries",
    "Apply the pseudo-element click technique to avoid nested interactive elements",
    "Use skeleton loading when card data loads asynchronously",
    "Group related cards with consistent metadata placement across the set",
    "Provide alt text for card images that convey meaningful content",
    "Use container queries to make card layout adapt to its allocated space",
  ],

  donts: [
    "Don't nest links inside a clickable card element — it creates invalid HTML",
    "Don't use cards for single pieces of unrelated data — use a list instead",
    "Don't make every card clickable if the action is ambiguous or undefined",
    "Don't vary card heights dramatically in a grid — use line-clamp for consistency",
    "Don't place too many action buttons in the footer — limit to 2–3 maximum",
    "Don't use card shadows in a flat design system that avoids elevation",
    "Don't omit loading states — empty cards with no content look broken",
  ],
};
