/**
 * divider.ts — Gold-standard design knowledge for Divider components
 */
import type { ComponentKnowledge } from "../types.js";

export const dividerKnowledge: ComponentKnowledge = {
  description:
    "Horizontal or vertical separator line | Visually divides content sections | Supports solid, dashed, and labeled variants",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "A thin line rendered in the divider color token; no interactive feedback",
      opacity: "1",
      cursorWeb: "default",
      usage: "Standard resting state — divider is a non-interactive decorative or semantic separator",
    },
    {
      state: "With Label",
      visualChange: "Line is split into two segments with centered text label between them; label has a background fill matching the surface",
      opacity: "1",
      cursorWeb: "default",
      usage: "Divider carries a textual label such as 'OR', 'Section Title', or a date grouping",
    },
    {
      state: "Decorative",
      visualChange: "Identical to default visually; marked as aria-hidden for assistive technologies",
      opacity: "1",
      cursorWeb: "default",
      usage: "Divider is purely visual — it does not represent a semantic content boundary",
    },
  ],

  propertyDescriptions: {
    orientation: "Direction of the divider line — 'horizontal' (default, full-width) or 'vertical' (full-height, used in toolbars and inline layouts)",
    type: "Line style — 'solid' (continuous line) or 'dashed' (dashed/dotted pattern)",
    spacing: "Vertical margin (horizontal divider) or horizontal margin (vertical divider) applied above and below/left and right; uses spacing tokens",
    label: "Optional centered text rendered in the middle of the divider line; splits the line into two segments",
    inset: "When true, the divider is indented from the start edge (e.g. aligned with content in a list, not full-width)",
    decorative: "When true, the divider has aria-hidden='true' and is not announced by screen readers; when false, uses role='separator'",
    color: "Override token for the divider line color; defaults to $divider-color",
    thickness: "Line thickness in pixels; defaults to 1px; 2px for emphasis dividers",
  },

  sizeSpecifications: [
    {
      size: "Default",
      height: "1px (horizontal) / 100% (vertical)",
      paddingLR: "0px",
      fontSize: "12px (label only)",
      iconSize: "N/A",
      borderRadius: "0px",
    },
    {
      size: "Thick",
      height: "2px (horizontal) / 100% (vertical)",
      paddingLR: "0px",
      fontSize: "12px (label only)",
      iconSize: "N/A",
      borderRadius: "0px",
    },
    {
      size: "Inset",
      height: "1px",
      paddingLR: "16px start inset",
      fontSize: "12px (label only)",
      iconSize: "N/A",
      borderRadius: "0px",
    },
  ],

  designTokenBindings: [
    {
      property: "Line Color",
      tokenName: "$divider-color",
      role: "Default color for the divider line",
      fallback: "#E4E7EC",
    },
    {
      property: "Line Color Subtle",
      tokenName: "$divider-color-subtle",
      role: "Lighter divider for less prominent separation",
      fallback: "#F2F4F7",
    },
    {
      property: "Line Color Strong",
      tokenName: "$divider-color-strong",
      role: "Darker divider for high-emphasis separation",
      fallback: "#D0D5DD",
    },
    {
      property: "Label Text Color",
      tokenName: "$divider-label-text",
      role: "Text color for the optional centered label",
      fallback: "#667085",
    },
    {
      property: "Label Background",
      tokenName: "$divider-label-bg",
      role: "Background behind the label to mask the line; should match the surface color",
      fallback: "#FFFFFF",
    },
    {
      property: "Label Font Family",
      tokenName: "$font-family-sans",
      role: "Typeface for the optional label text",
      fallback: "Inter, system-ui, sans-serif",
    },
    {
      property: "Spacing Default",
      tokenName: "$spacing-md",
      role: "Default margin above and below a horizontal divider",
      fallback: "16px",
    },
    {
      property: "Spacing Compact",
      tokenName: "$spacing-sm",
      role: "Reduced spacing for compact layouts",
      fallback: "8px",
    },
    {
      property: "Spacing Spacious",
      tokenName: "$spacing-lg",
      role: "Increased spacing for major section breaks",
      fallback: "24px",
    },
  ],

  structureRules: [
    "Horizontal divider is a full-width block element with a fixed height (1px or 2px) and background-color fill",
    "Vertical divider is an inline or flex-item element with a fixed width (1px or 2px) and auto height matching its container",
    "Label variant uses a horizontal Auto Layout with the line as two flex-grow segments and the label centered between them",
    "Label text has horizontal padding ($spacing-sm) and a background fill matching the surface to create the visual gap effect",
    "Inset divider has a start margin (margin-left in LTR) matching the content indentation of adjacent list items",
    "Divider does not have any interactive areas — it is a purely visual or semantic element",
    "In Figma, divider is a 1px-height frame with fill-container width; vertical variant is a 1px-width frame with fill-container height",
    "Dashed variant uses CSS border-style:dashed or SVG stroke-dasharray for the line pattern",
  ],

  typeHierarchyRules: [
    "Label text uses Caption size (12px) with Regular (400) weight for subtlety",
    "Label text uses uppercase or sentence case depending on context — uppercase for 'OR' separators, sentence case for section titles",
    "Label text color should be de-emphasized (secondary/muted) to avoid competing with surrounding content",
    "Label text should never wrap — keep labels short (1-3 words maximum)",
  ],

  interactionRules: [
    { event: "None", trigger: "N/A", action: "Dividers are non-interactive — no hover, click, focus, or keyboard events apply" },
    { event: "Resize", trigger: "Parent container width/height changes", action: "Horizontal divider stretches to fill container width; vertical divider stretches to fill container height" },
    { event: "Theme Change", trigger: "Light/dark mode toggle", action: "Divider color updates to the resolved value of the $divider-color token for the new theme" },
  ],

  contentGuidance: [
    "Use dividers sparingly — whitespace alone is often sufficient to separate content sections",
    "Horizontal dividers are ideal between list items, form groups, or major content sections",
    "Vertical dividers work well in toolbars, header navigation, and inline element groups",
    "Labeled dividers are useful for 'OR' separators in forms (e.g. between sign-in methods), date groupings in feeds, or section headers in settings",
    "Inset dividers should align with the start of text content in lists, not the leading icon/avatar",
    "Do not use dividers inside cards — the card boundary itself provides sufficient separation",
    "Use the subtle color variant when the divider should be barely visible (e.g. within dense data tables)",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Full-width horizontal dividers; inset value may reduce; vertical dividers in toolbars remain" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Standard behavior; spacing tokens apply as specified" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Standard behavior; dividers respect container max-width constraints" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Dividers remain within content max-width; do not stretch to full viewport width" },
  ],

  accessibilitySpec: {
    intro:
      "Dividers can be semantic (representing a thematic content break) or decorative (purely visual). The correct ARIA treatment depends on the divider's purpose in context.",
    requirements: [
      { requirement: "Semantic Role", level: "A", notes: "Semantic dividers must use <hr> element or role='separator' to announce a content boundary to screen readers" },
      { requirement: "Decorative Hiding", level: "A", notes: "Decorative dividers must have aria-hidden='true' so they are invisible to assistive technologies" },
      { requirement: "Orientation", level: "A", notes: "Vertical separators must have aria-orientation='vertical' when using role='separator'" },
      { requirement: "Label Accessibility", level: "A", notes: "Labeled dividers should associate the label text with the separator via aria-label or visible text" },
      { requirement: "Contrast Ratio", level: "AA", notes: "Divider line must have at least 3:1 contrast against the adjacent surface (WCAG 1.4.11 non-text contrast)" },
      { requirement: "Not Focusable", level: "A", notes: "Dividers must not be in the tab order — they are not interactive elements" },
    ],
    outro: [
      "When a divider is used between sections of a page, the <hr> element is preferred as it provides native semantics without ARIA",
      "Decorative dividers within a list should be treated as presentational and excluded from the list item count",
      "Test with screen readers to ensure decorative dividers are truly invisible and semantic ones are announced as 'separator'",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Visual Regression", platform: "All", expectedResult: "Divider renders at correct thickness, color, and spacing for each variant" },
    { check: "Horizontal Full-width", platform: "All", expectedResult: "Line spans the full container width; no gaps or overflow" },
    { check: "Vertical Full-height", platform: "All", expectedResult: "Line spans the full container height in flex layouts; no collapse to 0px" },
    { check: "Inset Alignment", platform: "All", expectedResult: "Inset divider aligns with text content, not leading icon/avatar" },
    { check: "Label Rendering", platform: "All", expectedResult: "Label centered between two line segments; background masks the line behind the text" },
    { check: "Dashed Style", platform: "All", expectedResult: "Dashed pattern renders consistently across browsers; dash length and gap are uniform" },
    { check: "Spacing Tokens", platform: "All", expectedResult: "Margin above and below matches the specified spacing token value" },
    { check: "Theme Switching", platform: "Web", expectedResult: "Divider color updates correctly when switching between light and dark themes" },
    { check: "Semantic Role", platform: "Web", expectedResult: "Semantic dividers have <hr> or role='separator'; decorative ones have aria-hidden='true'" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Semantic dividers announced as 'separator'; decorative dividers not announced" },
    { check: "Not Focusable", platform: "Web", expectedResult: "Divider is not reachable via Tab key navigation" },
    { check: "Contrast", platform: "All", expectedResult: "Divider line passes 3:1 non-text contrast against adjacent surfaces" },
    { check: "RTL Support", platform: "Web", expectedResult: "Inset direction mirrors; label position remains centered; no layout issues" },
  ],

  dos: [
    "Use horizontal dividers to create clear visual separation between major content sections",
    "Use the semantic <hr> element when the divider represents a thematic break in content",
    "Use aria-hidden='true' for purely decorative dividers that have no semantic meaning",
    "Match the inset value to the text indentation of adjacent content (e.g. list items with leading icons)",
    "Use consistent spacing tokens above and below dividers throughout the application",
    "Use the subtle color variant for dividers within dense or information-heavy layouts",
    "Keep labeled dividers concise — one to three words maximum",
  ],

  donts: [
    "Do not overuse dividers — whitespace and grouping often provide sufficient visual separation",
    "Do not use dividers inside card components — the card border already provides a boundary",
    "Do not use thick (2px+) dividers as a styling device — they should be used sparingly for emphasis only",
    "Do not make dividers focusable or interactive — they are display-only elements",
    "Do not use dividers as the sole means of grouping content — pair with headings or spacing for clarity",
    "Do not change divider colors to brand colors unless the design system explicitly defines such tokens",
    "Do not use full-width dividers when inset dividers would better align with the content structure",
  ],
};
