/**
 * chip.ts — Gold-standard design knowledge for Chip / Tag / Pill components
 */
import type { ComponentKnowledge } from "../types.js";

export const chipKnowledge: ComponentKnowledge = {
  description:
    "Compact label | Filterable tag | Dismissible metadata token",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Subtle fill or outlined container with label text and optional icon/avatar",
      opacity: "1",
      cursorWeb: "default",
      usage: "Resting state displaying metadata or a category label",
    },
    {
      state: "Hover",
      visualChange: "Background darkens slightly; close icon (if removable) gains emphasis",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Cursor enters the chip hit area on interactive chips",
    },
    {
      state: "Selected",
      visualChange: "Filled background with contrasting text; checkmark icon may appear",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Chip is actively selected in a filter or choice group",
    },
    {
      state: "Disabled",
      visualChange: "Muted background and text; close icon hidden or non-interactive",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "Chip cannot be selected, removed, or interacted with",
    },
    {
      state: "Focus",
      visualChange: "2px focus ring offset by 2px from the chip edge using $focus-ring token",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Chip receives keyboard focus via Tab key",
    },
    {
      state: "Active",
      visualChange: "Background shifts one step darker; slight scale-down (0.97) on press",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Mouse button held down or touch press in progress on the chip",
    },
    {
      state: "Removing",
      visualChange: "Chip shrinks horizontally with opacity fade-out animation before removal from DOM",
      opacity: "0",
      cursorWeb: "default",
      usage: "User clicked the close icon or triggered deletion via Backspace/Delete key",
    },
  ],

  propertyDescriptions: {
    label: "Text content displayed inside the chip; should be short (1-3 words)",
    type: "Chip behavior variant — Filter (toggleable), Input (removable user entry), Choice (single-select), or Assist (action suggestion)",
    removable: "When true, a close/dismiss icon is rendered on the trailing edge of the chip",
    selected: "When true, the chip shows its selected visual state with filled background",
    disabled: "When true, the chip is non-interactive with muted visuals and aria-disabled",
    icon: "Optional leading icon rendered before the label text",
    avatar: "Optional leading avatar thumbnail rendered before the label, typically 20px circular",
  },

  sizeSpecifications: [
    {
      size: "Small",
      height: "24px",
      paddingLR: "8px",
      fontSize: "11px",
      iconSize: "14px",
      borderRadius: "12px",
    },
    {
      size: "Medium",
      height: "32px",
      paddingLR: "12px",
      fontSize: "13px",
      iconSize: "16px",
      borderRadius: "16px",
    },
    {
      size: "Large",
      height: "40px",
      paddingLR: "16px",
      fontSize: "14px",
      iconSize: "20px",
      borderRadius: "20px",
    },
  ],

  designTokenBindings: [
    {
      property: "Background",
      tokenName: "$chip-bg",
      role: "Default chip fill color — subtle neutral tone",
      fallback: "#F3F4F6",
    },
    {
      property: "Background Selected",
      tokenName: "$chip-bg-selected",
      role: "Fill color when chip is in selected state",
      fallback: "#2563EB",
    },
    {
      property: "Text Color",
      tokenName: "$chip-text",
      role: "Label and icon color in default state",
      fallback: "#374151",
    },
    {
      property: "Text Color Selected",
      tokenName: "$chip-text-selected",
      role: "Label and icon color in selected state",
      fallback: "#FFFFFF",
    },
    {
      property: "Border",
      tokenName: "$chip-border",
      role: "Outlined variant border color",
      fallback: "#D1D5DB",
    },
    {
      property: "Close Icon Color",
      tokenName: "$chip-close-icon",
      role: "Color of the trailing dismiss/close icon",
      fallback: "#6B7280",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Keyboard focus indicator ring",
      fallback: "0 0 0 2px #FFFFFF, 0 0 0 4px #2E90FA",
    },
  ],

  structureRules: [
    "Container uses horizontal Auto Layout with center vertical alignment and hug-contents width",
    "Leading icon or avatar is an optional first child; label text is the center child; close icon is the trailing child",
    "Border-radius is set to 50% of the height to create the pill/capsule shape",
    "Close icon has its own 4px hit area padding to meet the 24x24px minimum interactive target",
    "Chip groups use horizontal Auto Layout with wrap enabled and $spacing-xs (4px) gap",
    "When chips overflow their container, the group wraps to the next line — no horizontal scrolling by default",
    "Selected chips with a checkmark prepend the check icon before the label, shifting content right",
  ],

  typeHierarchyRules: [
    "Font weight is Medium (500) for all chip states",
    "Text uses sentence case — 'New arrival', not 'New Arrival' or 'NEW ARRIVAL'",
    "Labels are single-line only; truncate with ellipsis at a configurable max-width",
    "Maximum label length is 25 characters — longer values should be truncated",
    "Close icon (x) uses a slightly smaller size than the leading icon",
  ],

  interactionRules: [
    { event: "Click / Tap", trigger: "pointerup on chip body", action: "Toggle selected state for Filter/Choice chips; no action for Input chips" },
    { event: "Close Click", trigger: "pointerup on close icon", action: "Fire onRemove handler; animate chip out; remove from DOM" },
    { event: "Hover", trigger: "pointerenter", action: "Transition to hover background; close icon gains emphasis" },
    { event: "Focus", trigger: "Tab key or focus()", action: "Show focus ring; arrow keys navigate between chips in a group" },
    { event: "Backspace / Delete", trigger: "Key pressed while chip is focused", action: "Remove the focused chip if removable; move focus to the next chip" },
    { event: "Arrow Keys", trigger: "Left/Right arrows while chip group is focused", action: "Move focus between sibling chips in the group" },
  ],

  contentGuidance: [
    "Chip labels should be 1-3 words maximum — they represent metadata, not sentences",
    "Use nouns or short noun phrases: 'JavaScript', 'In Progress', 'Priority: High'",
    "Avoid action verbs in chip labels — chips represent state, not actions",
    "Leading icons should reinforce the category (e.g. calendar icon for date chips)",
    "In filter groups, include an 'All' or 'Clear filters' option to reset selections",
    "Removable chips should confirm destructive removal if the chip represents important data",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Chip groups wrap freely; use Small size; max 2 lines visible with 'Show more' toggle" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Medium size default; groups may show 3 lines before overflow" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "All sizes available; horizontal chip groups with wrap at container edge" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Chip sizes remain capped — do not scale with viewport" },
    { breakpoint: "Input Field Context", behavior: "Chips inside text inputs use Small size and compress to fit available width" },
  ],

  accessibilitySpec: {
    intro:
      "Chips serve as compact interactive elements that must be fully operable by keyboard and announced correctly by screen readers.",
    requirements: [
      { requirement: "Role", level: "A", notes: "Filter/Choice chips use role='option' within a listbox; Input chips use role='button' with aria-label" },
      { requirement: "Focusable", level: "A", notes: "Each chip must be focusable via Tab; within groups, arrow keys navigate between chips" },
      { requirement: "Keyboard Removal", level: "A", notes: "Backspace or Delete removes a focused removable chip; focus moves to the next sibling" },
      { requirement: "Selected State", level: "A", notes: "Selected chips must announce aria-selected='true' and convey state change" },
      { requirement: "Contrast Ratio", level: "AA", notes: "Text-to-background: 4.5:1 minimum in both default and selected states" },
      { requirement: "Touch Target", level: "AA", notes: "Chip and close icon must each have a minimum 44x24px touch area" },
    ],
    outro: [
      "Chip groups should use role='listbox' or role='group' with an aria-label describing the filter category",
      "Announce removal actions to screen readers via aria-live polite region",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Visual Regression", platform: "All", expectedResult: "Chip renders pixel-perfect against baseline for each type and state" },
    { check: "Selection Toggle", platform: "All", expectedResult: "Filter/Choice chips toggle between default and selected states on click" },
    { check: "Removal Animation", platform: "Web", expectedResult: "Chip animates out smoothly on close; remaining chips reflow without jank" },
    { check: "Keyboard Navigation", platform: "Web", expectedResult: "Arrow keys move focus between chips; Backspace removes focused chip" },
    { check: "Truncation", platform: "All", expectedResult: "Labels exceeding max-width truncate with ellipsis; tooltip shows full text" },
    { check: "Wrap Behavior", platform: "All", expectedResult: "Chip groups wrap to next line at container boundary; no horizontal scroll" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces chip label, type, selected state, and removable status" },
  ],

  dos: [
    "Use Filter chips for multi-select category filtering in search interfaces",
    "Use Input chips for user-entered tags (email addresses, categories) in form fields",
    "Use Choice chips for single-select options where radio buttons feel too heavy",
    "Keep labels concise — 1-3 words that clearly communicate the metadata",
    "Provide keyboard navigation within chip groups using arrow keys",
    "Animate chip removal for smooth visual feedback",
  ],

  donts: [
    "Do not use chips for primary actions — use buttons instead",
    "Do not allow chip labels to wrap to multiple lines",
    "Do not mix chip types (Filter, Input, Choice) within the same group",
    "Do not use chips as a replacement for navigation tabs",
    "Do not place more than 20 chips in a single visible group without pagination or 'Show more'",
    "Do not remove the close icon hit area padding — it must remain easily tappable",
    "Do not use chips for long-form content or sentences",
  ],
};
