/**
 * rating.ts — Gold-standard design knowledge for Rating components
 */
import type { ComponentKnowledge } from "../types.js";

export const ratingKnowledge: ComponentKnowledge = {
  description:
    "Star-based rating input and display | Supports full and half-star precision | Read-only and interactive modes",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Stars rendered with filled/empty styling reflecting the current value; unfilled stars use $rating-empty token",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Resting interactive state — user can click or hover to set a rating",
    },
    {
      state: "Hover",
      visualChange: "Stars up to and including the hovered star highlight with $rating-hover token; remaining stars stay empty",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Mouse cursor enters a star's hit area, providing preview of the potential rating",
    },
    {
      state: "Active",
      visualChange: "Clicked star and all preceding stars fill with $rating-filled token; value updates immediately",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "User clicks or taps to commit a rating value",
    },
    {
      state: "ReadOnly",
      visualChange: "Stars reflect the set value but have no hover or click interactions; no cursor change",
      opacity: "1",
      cursorWeb: "default",
      usage: "Display-only mode — shows an existing rating without allowing modification",
    },
    {
      state: "Disabled",
      visualChange: "All stars use $rating-disabled token; muted appearance with reduced opacity",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "Rating input is unavailable due to permissions or form state",
    },
    {
      state: "Focus",
      visualChange: "2px focus ring around the currently focused star using $focus-ring token",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Star receives keyboard focus via Tab or arrow key navigation",
    },
    {
      state: "Half-Star",
      visualChange: "Star is split vertically — left half filled with $rating-filled, right half with $rating-empty",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Half-star precision enabled; mouse position on left/right half determines the value",
    },
  ],

  propertyDescriptions: {
    value: "Current rating value as a number (e.g. 3, 3.5); determines how many stars are filled",
    max: "Maximum number of stars displayed; defaults to 5; valid range is 1-10",
    size: "Dimensional preset controlling star size and gap between stars (sm, md, lg)",
    readOnly: "When true the component displays the rating without interactive behavior — no hover, click, or keyboard input",
    precision: "Rating granularity — 'full' allows whole-star increments only; 'half' allows half-star increments (e.g. 3.5)",
    onChange: "Callback function invoked when the user selects a new rating value; receives the numeric value as argument",
    label: "Accessible text label describing what is being rated (e.g. 'Product rating', 'Service quality')",
    disabled: "When true the rating input is non-interactive with muted visuals and aria-disabled='true'",
  },

  sizeSpecifications: [
    {
      size: "Small",
      height: "16px",
      paddingLR: "0px",
      fontSize: "12px",
      iconSize: "16px",
      borderRadius: "0px",
    },
    {
      size: "Medium",
      height: "24px",
      paddingLR: "0px",
      fontSize: "14px",
      iconSize: "24px",
      borderRadius: "0px",
    },
    {
      size: "Large",
      height: "32px",
      paddingLR: "0px",
      fontSize: "16px",
      iconSize: "32px",
      borderRadius: "0px",
    },
  ],

  designTokenBindings: [
    {
      property: "Filled Star",
      tokenName: "$rating-filled",
      role: "Fill color for active/selected stars",
      fallback: "#F59E0B",
    },
    {
      property: "Empty Star",
      tokenName: "$rating-empty",
      role: "Fill or stroke color for unselected stars",
      fallback: "#D0D5DD",
    },
    {
      property: "Hover Star",
      tokenName: "$rating-hover",
      role: "Preview highlight color when hovering over a star",
      fallback: "#FBBF24",
    },
    {
      property: "Disabled Star",
      tokenName: "$rating-disabled",
      role: "Muted fill color for stars in the disabled state",
      fallback: "#E4E7EC",
    },
    {
      property: "Value Text",
      tokenName: "$rating-text",
      role: "Color for the optional numeric value display (e.g. '4.5')",
      fallback: "#344054",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Keyboard focus indicator around the active star",
      fallback: "0 0 0 2px #FFFFFF, 0 0 0 4px #2E90FA",
    },
    {
      property: "Font Family",
      tokenName: "$font-family-sans",
      role: "Typeface for the optional numeric value label",
      fallback: "Inter, system-ui, sans-serif",
    },
    {
      property: "Transition",
      tokenName: "$transition-interactive",
      role: "Smooth color transitions for hover and selection feedback",
      fallback: "150ms ease-in-out",
    },
  ],

  structureRules: [
    "Container uses horizontal Auto Layout with center vertical alignment",
    "Each star is an individual interactive element (radio) within a radiogroup container",
    "Gap between stars is 2px (sm), 4px (md), or 6px (lg) based on the size prop",
    "Half-star precision splits each star into two hit areas (left half and right half)",
    "Optional numeric value text (e.g. '4.5') renders after the last star with $spacing-sm gap",
    "Star icons use a filled variant for selected and a stroked/outlined variant for empty",
    "Touch targets for each star must be at least 44x44px — add transparent padding if the star is smaller",
    "Container width is determined by (starSize * max) + (gap * (max - 1)) plus optional value text",
  ],

  typeHierarchyRules: [
    "Numeric value text uses Regular (400) weight — the stars themselves convey emphasis",
    "Value text font size matches the size prop's fontSize specification",
    "Value text displays one decimal place when precision is 'half' (e.g. '3.5'), whole number when 'full'",
    "No bold, underline, or uppercase styling on the value text",
  ],

  interactionRules: [
    { event: "Click / Tap", trigger: "pointerup on a star", action: "Set the rating value to the clicked star's position; fire onChange callback" },
    { event: "Hover", trigger: "pointerenter on a star", action: "Preview-highlight all stars up to and including the hovered star" },
    { event: "Hover Exit", trigger: "pointerleave from the container", action: "Revert star highlights back to the committed value" },
    { event: "Half-Star Hover", trigger: "Pointer in left half of a star (precision='half')", action: "Preview-highlight up to the half-star position (e.g. 3.5)" },
    { event: "Focus", trigger: "Tab key into the radiogroup", action: "Focus the star matching the current value (or first star if no value)" },
    { event: "Arrow Right", trigger: "Right arrow key while focused", action: "Move focus and value to the next star (increment by 1 or 0.5 based on precision)" },
    { event: "Arrow Left", trigger: "Left arrow key while focused", action: "Move focus and value to the previous star (decrement by 1 or 0.5 based on precision)" },
    { event: "Keydown Enter/Space", trigger: "Enter or Space while a star is focused", action: "Commit the focused star's value; fire onChange callback" },
  ],

  contentGuidance: [
    "Always provide a visible or accessible label describing what is being rated ('Rate this product')",
    "Use a consistent max value within the same interface — mixing 5-star and 10-star scales is confusing",
    "Display the numeric value alongside stars when precision matters (e.g. product reviews)",
    "In read-only mode, consider showing the count of ratings alongside the average (e.g. '4.5 (238 reviews)')",
    "Avoid using rating components for binary choices — use a thumbs up/down or toggle instead",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Stars maintain minimum 44px touch targets; may use lg size for easier tapping" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Standard rendering; md size is typical" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Standard rendering; sm or md size depending on context (inline vs. standalone)" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Star sizes remain fixed — do not scale with viewport width" },
  ],

  accessibilitySpec: {
    intro:
      "Rating components must be fully operable via keyboard and correctly announced by screen readers. The star metaphor is visual — assistive tech needs explicit value context.",
    requirements: [
      { requirement: "Role (Group)", level: "A", notes: "Container must use role='radiogroup' with an accessible label describing what is being rated" },
      { requirement: "Role (Star)", level: "A", notes: "Each star must use role='radio' with aria-checked indicating whether it is selected" },
      { requirement: "Accessible Name", level: "A", notes: "Each star needs aria-label (e.g. '3 out of 5 stars'); the group needs aria-label (e.g. 'Product rating')" },
      { requirement: "Keyboard Navigation", level: "A", notes: "Left/Right arrow keys move between stars; Enter/Space commits the selection" },
      { requirement: "Contrast Ratio", level: "AA", notes: "Filled stars vs. background must meet 3:1 non-text contrast; empty stars must be distinguishable from background" },
      { requirement: "Focus Indicator", level: "AA", notes: "Currently focused star must show a visible 2px focus ring meeting 3:1 contrast against adjacent colors" },
      { requirement: "Touch Target", level: "AA", notes: "Each star's hit area must be at least 44x44px (WCAG 2.5.5)" },
      { requirement: "Read-Only Announcement", level: "A", notes: "In read-only mode, announce the current value (e.g. 'Rated 4 out of 5 stars') without interactive roles" },
    ],
    outro: [
      "When the rating changes, announce the new value via an aria-live region (e.g. '3 out of 5 stars selected')",
      "In read-only mode, use aria-readonly='true' and remove interactive roles to prevent confusing screen reader users",
      "Test with VoiceOver, NVDA, and JAWS to ensure consistent star-by-star announcement behavior",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Visual Regression", platform: "All", expectedResult: "Stars render at correct size with proper filled/empty styling for each value" },
    { check: "Hover Preview", platform: "Web", expectedResult: "Hovering over a star highlights all stars up to that position; reverts on mouse leave" },
    { check: "Half-Star Precision", platform: "Web", expectedResult: "With precision='half', left-half hover shows half-star; clicking commits the half value" },
    { check: "Keyboard Navigation", platform: "Web", expectedResult: "Left/Right arrows move focus and value between stars; wrapping behavior at edges" },
    { check: "Keyboard Activation", platform: "Web", expectedResult: "Enter and Space commit the focused star's value; onChange fires correctly" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces role='radiogroup', each star as role='radio', and current value (e.g. '3 out of 5')" },
    { check: "Read-Only Mode", platform: "All", expectedResult: "Stars display value but are not interactive; no hover, click, or keyboard response" },
    { check: "Disabled State", platform: "All", expectedResult: "Muted visuals; pointer-events none; aria-disabled='true'; not focusable" },
    { check: "Touch Target", platform: "Mobile", expectedResult: "Each star has at least 44x44px hit area even at sm size" },
    { check: "Contrast", platform: "All", expectedResult: "Filled stars pass 3:1 non-text contrast; value text passes 4.5:1 text contrast" },
    { check: "RTL Support", platform: "Web", expectedResult: "Stars render right-to-left; arrow key directions are logically reversed" },
    { check: "Value Display", platform: "All", expectedResult: "Optional numeric value shows correct decimal precision next to stars" },
    { check: "Max Prop", platform: "All", expectedResult: "Changing max updates the number of rendered stars; value is clamped to max" },
  ],

  dos: [
    "Use role='radiogroup' for the container and role='radio' for each star",
    "Provide aria-label on each star describing its position (e.g. '3 out of 5 stars')",
    "Support keyboard navigation with Left/Right arrow keys for star selection",
    "Show a visible focus ring on the currently focused star",
    "Use half-star precision for review systems where granularity matters",
    "Display the numeric average alongside stars in read-only summaries",
    "Ensure each star's touch target is at least 44x44px on mobile",
  ],

  donts: [
    "Do not use the rating component for binary (yes/no) feedback — use a toggle instead",
    "Do not allow more than 10 stars — higher counts are overwhelming and imprecise",
    "Do not rely solely on star color to distinguish filled from empty — use fill vs. outline treatment",
    "Do not remove the focus indicator — keyboard users must see which star is focused",
    "Do not hard-code star colors — always use $rating-filled, $rating-empty, and $rating-hover tokens",
    "Do not fire onChange on hover — only fire on explicit click, tap, or keyboard commit",
    "Do not mix different max values in the same interface (e.g. 5-star and 10-star side by side)",
  ],
};
