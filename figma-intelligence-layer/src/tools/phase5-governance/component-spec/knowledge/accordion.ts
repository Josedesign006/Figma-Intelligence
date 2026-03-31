/**
 * accordion.ts — Gold-standard design knowledge for Accordion components
 */
import type { ComponentKnowledge } from "../types.js";

export const accordionKnowledge: ComponentKnowledge = {
  description:
    "Expandable content panel | Progressive disclosure control | Collapsible section container",

  stateSpecifications: [
    {
      state: "Collapsed",
      visualChange: "Header visible with chevron pointing right/down; content panel height is 0 with overflow hidden",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Default resting state — content is hidden to reduce cognitive load",
    },
    {
      state: "Expanded",
      visualChange: "Chevron rotates 90° (or 180°); content panel animates to full intrinsic height",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "User has activated the header to reveal the section content",
    },
    {
      state: "Hover",
      visualChange: "Header background shifts to hover token; chevron may gain subtle color change",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Mouse cursor enters the clickable header region",
    },
    {
      state: "Focus",
      visualChange: "2px focus ring around the header trigger element, offset by 2px",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Header receives keyboard focus via Tab key navigation",
    },
    {
      state: "Disabled",
      visualChange: "Header text and chevron switch to muted tokens; no expand/collapse interaction",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "Section content is unavailable or irrelevant in the current context",
    },
    {
      state: "Active",
      visualChange: "Header background darkens momentarily on click/tap before expand animation begins",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Mouse button is held down or touch press is in progress on the header",
    },
  ],

  propertyDescriptions: {
    title: "Visible heading text rendered in the accordion header; should clearly describe the hidden content",
    expanded: "Boolean controlling whether the content panel is currently visible; supports controlled and uncontrolled modes",
    disabled: "When true the header is non-interactive; content cannot be toggled open or closed",
    allowMultiple: "When true, multiple panels can be open simultaneously; when false, opening one closes the others (exclusive mode)",
    iconPosition: "Controls whether the expand/collapse chevron appears on the left or right side of the header",
    size: "Dimensional preset controlling header height, padding, and font-size (Small, Medium, Large)",
    onToggle: "Callback fired when the expanded state changes; receives the panel index and new expanded boolean",
  },

  sizeSpecifications: [
    {
      size: "Small",
      height: "36px",
      paddingLR: "12px",
      fontSize: "13px",
      iconSize: "16px",
      borderRadius: "6px",
    },
    {
      size: "Medium",
      height: "48px",
      paddingLR: "16px",
      fontSize: "14px",
      iconSize: "20px",
      borderRadius: "8px",
    },
    {
      size: "Large",
      height: "56px",
      paddingLR: "20px",
      fontSize: "16px",
      iconSize: "24px",
      borderRadius: "10px",
    },
  ],

  designTokenBindings: [
    {
      property: "Header Background",
      tokenName: "$accordion-header-bg",
      role: "Fill color for the clickable header region",
      fallback: "#F9FAFB",
    },
    {
      property: "Header Text",
      tokenName: "$accordion-header-text",
      role: "Title label color in the header",
      fallback: "#101828",
    },
    {
      property: "Chevron Color",
      tokenName: "$accordion-icon-color",
      role: "Fill/stroke color for the expand/collapse indicator icon",
      fallback: "#667085",
    },
    {
      property: "Border",
      tokenName: "$accordion-border",
      role: "Divider line between accordion items",
      fallback: "#E4E7EC",
    },
    {
      property: "Content Background",
      tokenName: "$accordion-content-bg",
      role: "Fill color for the expanded content region",
      fallback: "#FFFFFF",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Keyboard focus indicator on the header trigger",
      fallback: "0 0 0 2px #FFFFFF, 0 0 0 4px #2E90FA",
    },
    {
      property: "Transition",
      tokenName: "$transition-expand",
      role: "Animation timing for expand/collapse height transition",
      fallback: "250ms ease-in-out",
    },
  ],

  structureRules: [
    "Each accordion item consists of a header (trigger) and a content panel (region) as sibling elements",
    "Header uses horizontal Auto Layout with space-between to position title and chevron",
    "Content panel uses vertical Auto Layout; height animates between 0 and intrinsic height",
    "Chevron icon rotates via CSS transform — no icon swap between states",
    "Adjacent accordion items are separated by a 1px border using $accordion-border token",
    "Content panel includes internal padding separate from the header padding for visual breathing room",
    "The outer container clips overflow to prevent content from leaking during animation",
  ],

  typeHierarchyRules: [
    "Header title uses font-weight Semi-Bold (600) to distinguish from body content",
    "Content text uses Regular weight (400) and the body font-size one step smaller than the header",
    "Title text uses sentence case — capitalize only the first word",
    "Long titles truncate with ellipsis; never wrap to a second line in the header",
    "Nested content may include any block-level elements (paragraphs, lists, images)",
  ],

  interactionRules: [
    { event: "Click / Tap", trigger: "pointerup on header", action: "Toggle expanded state; fire onToggle callback" },
    { event: "Hover", trigger: "pointerenter on header", action: "Transition header to hover background token" },
    { event: "Focus", trigger: "Tab key to header", action: "Show focus ring on the header trigger element" },
    { event: "Keydown Enter", trigger: "Enter key while header focused", action: "Toggle expanded state (same as click)" },
    { event: "Keydown Space", trigger: "Space key while header focused", action: "Toggle expanded state; prevent page scroll" },
    { event: "Arrow Down", trigger: "Down arrow while header focused", action: "Move focus to the next accordion header in the group" },
    { event: "Arrow Up", trigger: "Up arrow while header focused", action: "Move focus to the previous accordion header in the group" },
  ],

  contentGuidance: [
    "Header titles should be concise and descriptive — summarize the hidden content in 2-5 words",
    "Content should be meaningful enough to justify hiding — avoid hiding single lines of text",
    "Use accordions for progressive disclosure when content volume would overwhelm the page",
    "Group related content into logical sections; each panel should cover one distinct topic",
    "Avoid nesting accordions within accordions — use a flat hierarchy or a different pattern",
    "Consider starting with one panel expanded if the content is frequently needed",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Accordion fills full width; header padding reduces to compact preset; touch target 48px min" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Accordion may span full width or sit within a card container; same interaction model" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Accordion may be constrained to a max-width column; content area has generous padding" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Max-width capped; accordion does not stretch beyond readable line length (~720px)" },
  ],

  accessibilitySpec: {
    intro:
      "Accordions rely on the disclosure pattern (heading + region) to be accessible. Proper ARIA roles and keyboard support are essential.",
    requirements: [
      { requirement: "Heading + Button", level: "A", notes: "Header must use a heading element wrapping a button; the button controls expand/collapse" },
      { requirement: "aria-expanded", level: "A", notes: "The trigger button must have aria-expanded='true' when open and 'false' when closed" },
      { requirement: "aria-controls", level: "A", notes: "The trigger button must reference the content panel ID via aria-controls" },
      { requirement: "role='region'", level: "A", notes: "The content panel should have role='region' and aria-labelledby pointing to the header" },
      { requirement: "Keyboard Navigation", level: "A", notes: "Enter and Space toggle; arrow keys move between headers in a group" },
      { requirement: "Contrast", level: "AA", notes: "Header text must meet 4.5:1 contrast; chevron icon must meet 3:1 non-text contrast" },
      { requirement: "Motion", level: "AAA", notes: "Expand/collapse animation must respect prefers-reduced-motion and collapse instantly when set" },
    ],
    outro: [
      "Screen readers should announce the heading level, expanded state, and panel content when expanded",
      "Focus must remain on the header trigger after toggling — never move focus into the content automatically",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Expand Animation", platform: "Web", expectedResult: "Content panel smoothly animates from 0 to full height within 250ms" },
    { check: "Collapse Animation", platform: "Web", expectedResult: "Content panel smoothly animates to 0 height; no content flash or jump" },
    { check: "Chevron Rotation", platform: "All", expectedResult: "Chevron rotates smoothly on toggle; points right when collapsed, down when expanded" },
    { check: "Exclusive Mode", platform: "All", expectedResult: "When allowMultiple=false, opening one panel closes all others" },
    { check: "Multi-Open Mode", platform: "All", expectedResult: "When allowMultiple=true, multiple panels can remain open simultaneously" },
    { check: "Keyboard Navigation", platform: "Web", expectedResult: "Tab focuses header; Enter/Space toggles; Arrow keys move between headers" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces heading level, button role, expanded/collapsed state" },
    { check: "Disabled Panel", platform: "All", expectedResult: "Header appears muted; click and keyboard have no effect; aria-disabled='true'" },
    { check: "Reduced Motion", platform: "Web", expectedResult: "Animation disabled when prefers-reduced-motion: reduce is set" },
    { check: "Overflow Content", platform: "Web", expectedResult: "Long content scrolls within panel or extends panel height without clipping" },
    { check: "Focus Ring", platform: "Web", expectedResult: "Visible focus ring on header when navigated via keyboard" },
  ],

  dos: [
    "Use accordions to organize lengthy content into scannable sections",
    "Provide clear, descriptive header titles so users can find content without expanding",
    "Allow multiple panels open when users need to compare content across sections",
    "Use exclusive mode (single open) when context switching is acceptable and screen space is limited",
    "Respect prefers-reduced-motion by disabling expand/collapse animation",
    "Maintain consistent spacing between accordion items using design tokens",
    "Include a visible border or separator between items for clear visual grouping",
  ],

  donts: [
    "Do not nest accordions inside other accordions — flatten the hierarchy instead",
    "Do not use accordions for only one or two items — use a simple disclosure or show the content directly",
    "Do not hide critical actions or required form fields inside collapsed panels",
    "Do not auto-collapse panels when the user scrolls — let the user control visibility",
    "Do not use expand/collapse animations longer than 300ms — they feel sluggish",
    "Do not override the chevron icon with unrelated iconography — keep the affordance clear",
    "Do not remove focus indicators from the header trigger",
  ],
};
