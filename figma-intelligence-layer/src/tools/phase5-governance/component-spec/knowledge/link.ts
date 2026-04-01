/**
 * link.ts — Gold-standard design knowledge for Link / Anchor components
 */
import type { ComponentKnowledge } from "../types.js";

export const linkKnowledge: ComponentKnowledge = {
  description:
    "Navigational text element | Inline anchor | Standalone hyperlink — distinct from Button",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Text rendered in link color with underline style per configuration (always, hover-only, or none)",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Link is interactive and available for navigation — default resting appearance",
    },
    {
      state: "Hover",
      visualChange: "Underline appears (if hover-only) and text color shifts to hover token; cursor remains pointer",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "User's pointer is over the link — visual feedback indicates interactivity",
    },
    {
      state: "Visited",
      visualChange: "Text color changes to visited token — typically a muted or purple-shifted variant",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "User has previously navigated to this link's destination — provides wayfinding context",
    },
    {
      state: "Active",
      visualChange: "Text color darkens or shifts to active token during the press — momentary visual feedback",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "User is pressing the link — provides tactile feedback before navigation",
    },
    {
      state: "Focus",
      visualChange: "2px focus ring appears around the link text with 2px offset; link color unchanged",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Link is focused via keyboard navigation — visible focus indicator required for accessibility",
    },
    {
      state: "Disabled",
      visualChange: "Text color shifts to disabled token; underline removed; no href attribute rendered",
      opacity: "0.5",
      cursorWeb: "not-allowed",
      usage: "Link is temporarily unavailable — navigation is prevented and visual affordance is removed",
    },
  ],

  propertyDescriptions: {
    label: "Visible text content of the link — must be descriptive of the destination, never generic",
    href: "Navigation target URL — when omitted or empty, the link renders in disabled state",
    external: "Boolean — when true, adds target='_blank', rel='noopener noreferrer', and an external link icon",
    underline: "Underline display mode — 'always' (default), 'hover' (shows on hover only), or 'none' (no underline)",
    size: "Dimensional preset controlling font-size and line-height — sm, md, or lg",
    inline: "Boolean — when true, link renders inline within paragraph text; when false, renders as standalone block-level element",
    iconEnd: "Optional trailing icon slot — typically used for external link indicator or download icon",
    color: "Color variant override — defaults to the primary link token; can be set to inherit for body text styling",
    disabled: "Boolean — when true, removes href, sets aria-disabled, and applies disabled visual styling",
    rel: "Relationship attribute — automatically set to 'noopener noreferrer' for external links; can be manually overridden",
    target: "Link target — automatically set to '_blank' for external links; defaults to '_self' for internal navigation",
  },

  sizeSpecifications: [
    {
      size: "Small (sm)",
      height: "16px",
      paddingLR: "0px",
      fontSize: "12px",
      iconSize: "12px",
      borderRadius: "0px",
    },
    {
      size: "Medium (md)",
      height: "20px",
      paddingLR: "0px",
      fontSize: "14px",
      iconSize: "14px",
      borderRadius: "0px",
    },
    {
      size: "Large (lg)",
      height: "24px",
      paddingLR: "0px",
      fontSize: "16px",
      iconSize: "16px",
      borderRadius: "0px",
    },
  ],

  designTokenBindings: [
    {
      property: "Default Text",
      tokenName: "$link-text-default",
      role: "Primary link text color in default resting state",
      fallback: "#2563EB",
    },
    {
      property: "Hover Text",
      tokenName: "$link-text-hover",
      role: "Link text color on pointer hover — slightly darker or shifted for feedback",
      fallback: "#1D4ED8",
    },
    {
      property: "Visited Text",
      tokenName: "$link-text-visited",
      role: "Link text color after the destination has been visited",
      fallback: "#7C3AED",
    },
    {
      property: "Active Text",
      tokenName: "$link-text-active",
      role: "Link text color during the active/pressed state",
      fallback: "#1E40AF",
    },
    {
      property: "Disabled Text",
      tokenName: "$link-text-disabled",
      role: "Muted link text color when the link is disabled",
      fallback: "#D0D5DD",
    },
    {
      property: "Underline",
      tokenName: "$link-underline",
      role: "Underline color — typically matches the text color or a lighter variant",
      fallback: "currentColor",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Visible focus indicator color for keyboard navigation — shared across all focusable components",
      fallback: "#2563EB",
    },
    {
      property: "Font Family",
      tokenName: "$font-family-sans",
      role: "Link typeface — inherits from body text; does not introduce a separate font stack",
      fallback: "Inter, system-ui, sans-serif",
    },
  ],

  structureRules: [
    "Links render as native <a> elements with an href attribute — never as <span> or <div> with click handlers",
    "Inline links flow naturally within paragraph text and inherit the parent's font-size and line-height",
    "Standalone links render as block-level flex containers with their own size preset applied",
    "External link icon (if present) is placed after the label text with a 4px gap, sized to match the font",
    "Underline is rendered via text-decoration (not border-bottom) for correct baseline alignment",
    "Focus ring uses outline with 2px width and 2px offset — not box-shadow — for High Contrast Mode compatibility",
    "Disabled links render as <a> without an href attribute (not a <span>) to preserve semantic structure",
  ],

  typeHierarchyRules: [
    "Link font-size follows the size prop (12/14/16px) and inherits font-weight from surrounding text",
    "Inline links must match the parent paragraph's font-size and line-height exactly — they do not introduce size breaks",
    "Link text is never bold or uppercase — it relies on color and underline for visual differentiation",
    "Standalone links may use font-weight: 500 (medium) for subtle emphasis without disrupting body text hierarchy",
    "External link icon is vertically centered with the text baseline using inline-flex alignment",
  ],

  interactionRules: [
    { event: "Click", trigger: "pointerup on link", action: "Navigate to href destination; if external, open in new tab with noopener noreferrer" },
    { event: "Hover", trigger: "pointerenter on link", action: "Apply hover text color; show underline if underline='hover'; cursor remains pointer" },
    { event: "Hover Out", trigger: "pointerleave on link", action: "Revert to default text color; hide underline if underline='hover'" },
    { event: "Focus", trigger: "keyboard focus via Tab", action: "Display 2px focus ring around link text with 2px offset" },
    { event: "Active", trigger: "pointerdown on link", action: "Apply active text color for press feedback; revert on pointerup" },
    { event: "Disabled Click", trigger: "pointerup on disabled link", action: "No navigation occurs; event is suppressed; no href is present" },
    { event: "External Navigation", trigger: "Click on external link", action: "Screen reader announces 'opens in new window' before navigation" },
    { event: "Context Menu", trigger: "Right-click on link", action: "Browser context menu shows link-specific options (open in new tab, copy URL)" },
  ],

  contentGuidance: [
    "Write descriptive link text that conveys the destination — never use 'click here', 'read more', or 'learn more' alone",
    "Link text should make sense out of context — screen readers may navigate links in isolation via rotor/elements list",
    "Keep link text concise (2-5 words for inline links) — long links are harder to scan and click",
    "Do not embed entire sentences as links — link only the meaningful destination phrase",
    "External links should indicate they open in a new window, either via icon or explicit text like '(opens in new tab)'",
    "Use links for navigation to a new page or resource; use buttons for in-page actions that do not change the URL",
    "Avoid adjacent links without visual separation — use list markup or sufficient spacing between link groups",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Links maintain minimum 44px touch target via line-height and spacing; font-size may increase to 16px for tap friendliness" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Same link sizing as desktop; touch targets ensured by adequate line-height" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Standard link rendering at specified size presets with pointer-based interactions" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "No scaling — links follow content width and do not stretch or reposition with viewport" },
  ],

  accessibilitySpec: {
    intro:
      "Links must use native <a> elements with descriptive text, proper focus management, and clear indication of navigation behavior.",
    requirements: [
      { requirement: "Semantic <a> element", level: "A", notes: "Links must use <a href> — if a non-anchor element is used, it must have role='link' and tabindex='0' with Enter/Space key handling" },
      { requirement: "Descriptive link text", level: "A", notes: "Link text must describe the destination — 'click here' or 'read more' alone fails this requirement" },
      { requirement: "External link announcement", level: "A", notes: "External links (target='_blank') must announce 'opens in new window' via aria-label or visually hidden text" },
      { requirement: "Focus visible", level: "AA", notes: "Links must display a visible focus indicator (2px outline, 2px offset) meeting 3:1 contrast against adjacent colors" },
      { requirement: "Color independence", level: "A", notes: "Links within body text must be distinguishable by more than color alone — underline or other non-color indicator required" },
      { requirement: "Contrast", level: "AA", notes: "Link text must meet 4.5:1 contrast against background; underline must meet 3:1 non-text contrast" },
      { requirement: "Touch target", level: "AAA", notes: "On touch devices, link tap target must be at least 44x44px — achieved via line-height and padding" },
    ],
    outro: [
      "Screen readers announce link text followed by 'link' role — ensure the text is meaningful in isolation",
      "Visited link color change provides wayfinding but must not be the only indicator of visited state for colorblind users",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Navigation", platform: "All", expectedResult: "Clicking a link navigates to the specified href destination" },
    { check: "External Link", platform: "All", expectedResult: "External links open in a new tab with rel='noopener noreferrer' and display an external icon" },
    { check: "Hover Underline", platform: "Web", expectedResult: "Links with underline='hover' show underline on hover and hide it on pointer leave" },
    { check: "Visited Color", platform: "Web", expectedResult: "Previously visited links display the visited color token; unvisited links use default token" },
    { check: "Focus Ring", platform: "Web", expectedResult: "Tab-focused links display a 2px outline with 2px offset meeting 3:1 contrast" },
    { check: "Disabled State", platform: "All", expectedResult: "Disabled links have no href, show muted color, and prevent navigation on click" },
    { check: "Inline Rendering", platform: "All", expectedResult: "Inline links flow within paragraph text and inherit the parent's font-size and line-height" },
    { check: "Standalone Rendering", platform: "All", expectedResult: "Standalone links render with their own size preset and display as flex block elements" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Links announce descriptive text with 'link' role; external links announce 'opens in new window'" },
    { check: "Keyboard Navigation", platform: "Web", expectedResult: "Links are reachable via Tab and activated with Enter key; Space does not trigger navigation" },
    { check: "Touch Target", platform: "Mobile", expectedResult: "Link tap target is at least 44x44px on touch devices via line-height and spacing" },
    { check: "Dark Mode", platform: "All", expectedResult: "All link color tokens resolve correctly in dark mode with sufficient contrast" },
  ],

  dos: [
    "Use native <a> elements with a valid href for all navigational links",
    "Write descriptive link text that conveys the destination clearly",
    "Add rel='noopener noreferrer' and target='_blank' for external links automatically",
    "Include a visible external link icon for links that open in a new window",
    "Ensure links are visually distinguishable from body text by underline — not color alone",
    "Provide visited link styling to give users wayfinding context",
    "Use links for navigation and buttons for actions — do not conflate the two patterns",
    "Test link text in isolation (via screen reader link list) to verify it is self-descriptive",
  ],

  donts: [
    "Do not use 'click here', 'read more', or 'learn more' as standalone link text",
    "Do not use <button> or <span> with an onClick handler when an <a> with href is appropriate",
    "Do not open internal links in a new tab — reserve target='_blank' for external destinations only",
    "Do not remove the underline from inline links in body text — it is the primary non-color indicator",
    "Do not disable links by simply hiding them — render them with aria-disabled and no href instead",
    "Do not use link styling for non-navigational actions — use a button component instead",
    "Do not nest interactive elements inside links — no buttons, inputs, or other links within an <a>",
    "Do not rely on color alone to differentiate links from surrounding text — always pair with underline or icon",
  ],
};
