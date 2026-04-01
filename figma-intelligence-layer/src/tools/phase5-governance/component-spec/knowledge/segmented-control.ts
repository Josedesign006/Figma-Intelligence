/**
 * segmented-control.ts — Gold-standard design knowledge for Segmented Control components
 */
import type { ComponentKnowledge } from "../types.js";

export const segmentedControlKnowledge: ComponentKnowledge = {
  description:
    "Mutually exclusive button group | Single-selection control | Inline view switcher or filter toggle",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Unselected segments show subtle background; selected segment has elevated/filled treatment",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Resting state — one segment is always selected; others are interactive",
    },
    {
      state: "Hover",
      visualChange: "Hovered unselected segment background shifts to a lighter tint of the selected color",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Mouse cursor enters an unselected segment's hit area",
    },
    {
      state: "Active/Pressed",
      visualChange: "Segment background darkens momentarily; subtle scale-down (0.98) for tactile feedback",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Mouse button is held down on a segment",
    },
    {
      state: "Selected",
      visualChange: "Segment has filled background with contrasting text; may include elevation shadow or indicator bar",
      opacity: "1",
      cursorWeb: "default",
      usage: "Currently active selection — content associated with this segment is displayed",
    },
    {
      state: "Focus",
      visualChange: "2px focus ring around the focused segment, offset by 2px; does not change selection",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Segment receives keyboard focus via Tab or arrow key navigation",
    },
    {
      state: "Disabled (Segment)",
      visualChange: "Individual segment text and background are muted; no hover or click response",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "A specific option is unavailable but still visible for context",
    },
    {
      state: "Disabled (Group)",
      visualChange: "Entire control is muted; no segment responds to interaction",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "The entire selection mechanism is temporarily unavailable",
    },
  ],

  propertyDescriptions: {
    segments: "Array of segment objects, each with a label, optional icon, and optional value identifier",
    value: "Currently selected segment value — controlled prop managed by the parent component",
    onChange: "Callback invoked with the newly selected segment value when a user changes the selection",
    size: "Dimensional preset — Small, Medium, or Large — controlling height, padding, and font size",
    type: "Content type within each segment — 'text' (label only), 'icon' (icon only), or 'both' (icon + label)",
    fullWidth: "When true, the control stretches to fill its container and segments share equal width",
    disabled: "When true, the entire control is non-interactive; overrides individual segment disabled states",
    name: "Group name for form association, used as the name attribute when rendered as radio inputs",
  },

  sizeSpecifications: [
    {
      size: "Small",
      height: "32px",
      paddingLR: "12px",
      fontSize: "12px",
      iconSize: "16px",
      borderRadius: "6px",
    },
    {
      size: "Medium",
      height: "40px",
      paddingLR: "16px",
      fontSize: "14px",
      iconSize: "20px",
      borderRadius: "8px",
    },
    {
      size: "Large",
      height: "48px",
      paddingLR: "20px",
      fontSize: "16px",
      iconSize: "24px",
      borderRadius: "10px",
    },
  ],

  designTokenBindings: [
    {
      property: "Container Background",
      tokenName: "$segmented-control-bg",
      role: "Background of the outer container that holds all segments",
      fallback: "#F2F4F7",
    },
    {
      property: "Selected Background",
      tokenName: "$segmented-control-selected-bg",
      role: "Fill color of the currently selected segment",
      fallback: "#FFFFFF",
    },
    {
      property: "Selected Text",
      tokenName: "$segmented-control-selected-text",
      role: "Text color of the selected segment label",
      fallback: "#101828",
    },
    {
      property: "Unselected Text",
      tokenName: "$segmented-control-text",
      role: "Text color of unselected segment labels",
      fallback: "#667085",
    },
    {
      property: "Selected Shadow",
      tokenName: "$shadow-segmented-selected",
      role: "Elevation shadow applied to the selected segment indicator",
      fallback: "0 1px 3px rgba(0, 0, 0, 0.1)",
    },
    {
      property: "Border",
      tokenName: "$segmented-control-border",
      role: "Outer container border for definition against the background",
      fallback: "#E4E7EC",
    },
    {
      property: "Radius (Container)",
      tokenName: "$radius-segmented-control",
      role: "Corner rounding on the outer container",
      fallback: "8px",
    },
    {
      property: "Radius (Segment)",
      tokenName: "$radius-segmented-segment",
      role: "Corner rounding on the selected segment indicator",
      fallback: "6px",
    },
    {
      property: "Transition",
      tokenName: "$transition-segmented",
      role: "Smooth slide/fade transition when selected segment changes",
      fallback: "200ms ease-in-out",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Keyboard focus indicator around the focused segment",
      fallback: "0 0 0 2px #FFFFFF, 0 0 0 4px #2E90FA",
    },
  ],

  structureRules: [
    "Outer container uses horizontal Auto Layout with equal spacing between segments",
    "Each segment is a direct child of the container — no intermediate wrappers except the sliding indicator",
    "Selected indicator is an absolutely positioned element that slides behind the active segment",
    "Segment content (icon + label) is centered both horizontally and vertically within each segment",
    "In fullWidth mode, each segment has flex: 1 to distribute space equally",
    "Container has 2px internal padding between the outer border and segment edges",
    "Icon-only segments maintain square proportions with equal padding on all sides",
    "Minimum segment width is 48px to ensure touch target compliance",
    "Dividers between segments are 1px vertical lines using the border token; hidden adjacent to selected segment",
  ],

  typeHierarchyRules: [
    "Segment labels use Medium weight (500) for unselected and SemiBold (600) for selected state",
    "Text uses sentence case — 'Day view', not 'Day View' or 'DAY VIEW'",
    "Labels are single-line only; truncate with ellipsis if text overflows the segment width",
    "Icon-only segments do not render any text — icons must be self-explanatory with tooltips",
  ],

  interactionRules: [
    { event: "Click / Tap", trigger: "Pointer up on an unselected segment", action: "Change selection to the clicked segment; fire onChange; slide indicator animates to new position" },
    { event: "Hover", trigger: "Pointer enters an unselected segment", action: "Segment background transitions to hover tint" },
    { event: "Focus", trigger: "Tab key reaches the control", action: "Focus ring appears on the currently selected segment (entry point)" },
    { event: "Arrow Right", trigger: "Right arrow key while focused", action: "Move focus (and selection) to the next segment; wraps to first at the end" },
    { event: "Arrow Left", trigger: "Left arrow key while focused", action: "Move focus (and selection) to the previous segment; wraps to last at the start" },
    { event: "Home", trigger: "Home key while focused", action: "Move focus and selection to the first segment" },
    { event: "End", trigger: "End key while focused", action: "Move focus and selection to the last segment" },
    { event: "Space / Enter", trigger: "Space or Enter while segment is focused", action: "Confirm selection on the focused segment (useful when arrow keys only move focus without selecting)" },
  ],

  contentGuidance: [
    "Use 2-5 segments — more than 5 creates cognitive overload; use tabs or a dropdown instead",
    "Labels should be short (1-2 words) and parallel in structure: 'Day', 'Week', 'Month' not 'Day view', 'By week', 'Monthly'",
    "All segments should represent related options within the same category or dimension",
    "Icon-only segments must have tooltips and aria-labels for accessibility",
    "Segment labels should be roughly equal length to maintain visual balance",
    "Do not mix icon-only and text-only segments within the same control",
    "Selected segment should persist across page navigations when used for persistent view preferences",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Full-width layout; segments stack if more than 3; minimum touch target 44px; consider dropdown alternative for 4+ options" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Inline layout with flexible segment widths; fullWidth optional based on container context" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Standard inline layout; fixed or auto segment widths; group spacing follows $spacing-md" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Control width remains capped; does not scale with viewport; left-aligned in container" },
  ],

  accessibilitySpec: {
    intro:
      "Segmented controls function as single-selection radio groups. Proper ARIA roles and keyboard navigation patterns are critical for screen reader and keyboard-only users.",
    requirements: [
      { requirement: "Group Role", level: "A", notes: "Container must have role='radiogroup' with an accessible name via aria-label or aria-labelledby" },
      { requirement: "Segment Role", level: "A", notes: "Each segment must have role='radio' with aria-checked='true' for selected, 'false' for unselected" },
      { requirement: "Arrow Key Navigation", level: "A", notes: "Left/Right arrow keys move focus between segments following the radio group pattern (roving tabindex)" },
      { requirement: "Single Tab Stop", level: "A", notes: "Only the selected segment is in the tab order; arrow keys navigate between segments" },
      { requirement: "Accessible Name", level: "A", notes: "Each segment needs an accessible name via text label or aria-label for icon-only variants" },
      { requirement: "Disabled State", level: "A", notes: "Disabled segments must have aria-disabled='true'; group-level disable applies to the radiogroup" },
      { requirement: "Contrast", level: "AA", notes: "Selected/unselected text must meet 4.5:1 ratio; selected indicator boundary must meet 3:1 non-text contrast" },
      { requirement: "Focus Visible", level: "AA", notes: "Focus ring must be visible and distinct from the selected state indicator" },
    ],
    outro: [
      "Test that screen readers announce the group label, segment label, position (e.g. '2 of 4'), and checked state",
      "Verify that arrow keys wrap around from last to first and first to last",
      "Ensure disabled segments are skipped during arrow key navigation",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Selection Change", platform: "All", expectedResult: "Clicking an unselected segment changes selection and fires onChange callback" },
    { check: "Indicator Animation", platform: "Web", expectedResult: "Selected indicator slides smoothly to the new segment position" },
    { check: "Hover State", platform: "Web", expectedResult: "Unselected segments show hover background on pointer enter" },
    { check: "Arrow Key Navigation", platform: "Web", expectedResult: "Left/Right arrows move focus between segments; wraps at boundaries" },
    { check: "Tab Behavior", platform: "Web", expectedResult: "Tab enters the control on the selected segment; next Tab exits the control entirely" },
    { check: "Disabled Segment", platform: "All", expectedResult: "Disabled segment shows muted visuals; not clickable; skipped in arrow key navigation" },
    { check: "Disabled Group", platform: "All", expectedResult: "Entire control is muted and non-interactive" },
    { check: "Full Width", platform: "All", expectedResult: "Control stretches to container width; segments share equal width" },
    { check: "Icon-Only", platform: "All", expectedResult: "Icons render centered; tooltips appear on hover; aria-label is present" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces radiogroup label, radio label, checked state, and position in group" },
    { check: "RTL Support", platform: "Web", expectedResult: "Segment order mirrors; arrow key direction reverses; indicator slides correctly" },
    { check: "Contrast", platform: "All", expectedResult: "Selected and unselected states pass 4.5:1 text contrast requirements" },
    { check: "Touch Target", platform: "Mobile", expectedResult: "Each segment meets 44x44px minimum touch target" },
  ],

  dos: [
    "Use for switching between 2-5 related views or filter options",
    "Keep segment labels short, parallel, and consistent in structure",
    "Always have one segment selected — never show an empty/no-selection state",
    "Use the sliding indicator animation to reinforce the relationship between segments",
    "Ensure the selected state is visually distinct from hover and focus states",
    "Use fullWidth mode when the control should span the entire container width",
    "Provide tooltips for icon-only segments to clarify their meaning",
  ],

  donts: [
    "Do not use for more than 5 options — switch to tabs or a dropdown menu",
    "Do not use for navigation between unrelated pages — use tabs or a navbar",
    "Do not allow zero selections — one segment must always be active",
    "Do not mix text-only and icon-only segments in the same control",
    "Do not use for multi-selection — use checkboxes or a chip group instead",
    "Do not make segments too narrow — ensure labels are readable and touch targets are met",
    "Do not use inconsistent label lengths that create visually unbalanced segments",
  ],
};
