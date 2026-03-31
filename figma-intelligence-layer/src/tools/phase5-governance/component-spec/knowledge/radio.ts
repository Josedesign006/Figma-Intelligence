import type { ComponentKnowledge } from "../types.js";

export const radioKnowledge: ComponentKnowledge = {
  description:
    "Exclusive selection control | Single choice from group | Mutually exclusive options",

  stateSpecifications: [
    { state: "Unchecked-Default", visualChange: "Empty circle with border", opacity: "1", cursorWeb: "pointer", usage: "Idle option not yet selected by the user" },
    { state: "Unchecked-Hover", visualChange: "Border darkens, subtle fill tint on circle", opacity: "1", cursorWeb: "pointer", usage: "Pointer over an unselected radio" },
    { state: "Unchecked-Focus", visualChange: "Focus ring around circle, no fill change", opacity: "1", cursorWeb: "default", usage: "Keyboard navigation lands on the option" },
    { state: "Checked-Default", visualChange: "Filled inner dot appears inside circle", opacity: "1", cursorWeb: "pointer", usage: "Currently selected option in the group" },
    { state: "Checked-Hover", visualChange: "Filled dot with darker border highlight", opacity: "1", cursorWeb: "pointer", usage: "Pointer hovers over the active selection" },
    { state: "Disabled-Unchecked", visualChange: "Faded circle, muted border", opacity: "0.4", cursorWeb: "not-allowed", usage: "Option unavailable for selection" },
    { state: "Disabled-Checked", visualChange: "Faded filled dot, muted border", opacity: "0.4", cursorWeb: "not-allowed", usage: "Selected but locked option" },
  ],

  propertyDescriptions: {
    checked: "Whether this radio is the currently selected option in the group",
    disabled: "Prevents interaction and dims the radio visually",
    name: "Shared group name that enforces mutual exclusivity across radios",
    value: "Unique value submitted when this option is selected",
    label: "Visible text describing the option; always required",
    helperText: "Optional secondary line clarifying the option's meaning",
    error: "Displays validation styling and error message for the group",
    size: "Controls the diameter of the radio circle and label font size",
    orientation: "Vertical (stacked) or horizontal (inline) layout for the group",
  },

  sizeSpecifications: [
    { size: "sm", height: "16px", paddingLR: "4px", fontSize: "12px", iconSize: "8px", borderRadius: "50%" },
    { size: "md", height: "20px", paddingLR: "6px", fontSize: "14px", iconSize: "10px", borderRadius: "50%" },
    { size: "lg", height: "24px", paddingLR: "8px", fontSize: "16px", iconSize: "12px", borderRadius: "50%" },
    { size: "xl", height: "28px", paddingLR: "10px", fontSize: "18px", iconSize: "14px", borderRadius: "50%" },
    { size: "compact", height: "14px", paddingLR: "2px", fontSize: "11px", iconSize: "6px", borderRadius: "50%" },
  ],

  designTokenBindings: [
    { property: "circle-border", tokenName: "color/border/interactive", role: "Outer ring of unselected radio", fallback: "#8D8D8D" },
    { property: "dot-fill", tokenName: "color/icon/interactive", role: "Inner dot fill when selected", fallback: "#0F62FE" },
    { property: "circle-bg", tokenName: "color/field/01", role: "Background of the radio circle", fallback: "#FFFFFF" },
    { property: "label-text", tokenName: "color/text/primary", role: "Label text beside the radio", fallback: "#161616" },
    { property: "focus-ring", tokenName: "color/focus", role: "Keyboard focus outline", fallback: "#0F62FE" },
    { property: "error-border", tokenName: "color/support/error", role: "Circle border when group is invalid", fallback: "#DA1E28" },
    { property: "disabled-fill", tokenName: "color/disabled/02", role: "Muted fill for disabled state", fallback: "#C6C6C6" },
  ],

  structureRules: [
    "Radios must always be grouped inside a <fieldset> with a <legend> labelling the question",
    "Each radio input must have an associated <label> element linked via htmlFor/id",
    "Only one radio in a group may have checked=true at any time",
    "The inner dot must be centered within the circle and scale proportionally with size",
    "Label text sits to the right (LTR) or left (RTL) of the circle with consistent gap",
    "Helper text, if present, aligns below the label at the same inline-start position",
    "Error messages render below the entire radio group, not per individual option",
  ],

  typeHierarchyRules: [
    "Label uses body-compact-01 for md size, body-compact-02 for lg size",
    "Helper text is one step smaller than its label counterpart",
    "Error message uses body-compact-01 in the support-error color",
    "Legend text uses heading-compact-01 to distinguish the group question from options",
    "Label and helper text must maintain a minimum 4.5:1 contrast ratio",
    "Disabled label text drops to 3:1 ratio but must still be legible",
    "No text truncation; labels should wrap if they exceed the container width",
  ],

  interactionRules: [
    { event: "click", trigger: "User clicks on circle or label", action: "Select this radio and deselect any other checked radio in the group" },
    { event: "keydown:ArrowDown/ArrowRight", trigger: "Focus is on a radio in the group", action: "Move focus and selection to the next radio, wrapping to first" },
    { event: "keydown:ArrowUp/ArrowLeft", trigger: "Focus is on a radio in the group", action: "Move focus and selection to the previous radio, wrapping to last" },
    { event: "keydown:Tab", trigger: "Focus is on any radio in the group", action: "Move focus out of the radio group to the next focusable element" },
    { event: "keydown:Space", trigger: "Focus is on an unchecked radio", action: "Select the focused radio" },
    { event: "focus", trigger: "Keyboard navigates into the group", action: "Focus lands on the currently checked radio or the first radio if none checked" },
  ],

  contentGuidance: [
    "Keep option labels concise — ideally one line of text",
    "Write labels as noun phrases, not full sentences (e.g. 'Standard shipping' not 'I want standard shipping')",
    "Present options in a logical order: most common first or in ascending/descending value",
    "Use a legend that clearly frames the question — e.g. 'Payment method'",
    "Limit groups to 7 or fewer options; use a select/dropdown for longer lists",
    "Avoid negative phrasing in labels — prefer 'Opt out' over 'Do not include'",
    "If helper text is needed, use it sparingly and only on options that need clarification",
  ],

  responsiveBehaviour: [
    { breakpoint: "≥ 1056px (lg)", behavior: "Horizontal layout if 4 or fewer options; otherwise vertical stack" },
    { breakpoint: "672–1055px (md)", behavior: "Vertical stack recommended; horizontal only for 2–3 short-label options" },
    { breakpoint: "< 672px (sm)", behavior: "Always vertical stack; label wraps, hit target fills full width" },
    { breakpoint: "Touch devices", behavior: "Minimum 44×44px touch target around circle and label area" },
    { breakpoint: "RTL layouts", behavior: "Circle moves to inline-end, label to inline-start; arrow key directions invert" },
  ],

  accessibilitySpec: {
    intro:
      "Radio groups must be perceivable, operable, and understandable by assistive technology users. The <fieldset>/<legend> pattern ensures screen readers announce the group question.",
    requirements: [
      { requirement: "Each radio must have role='radio' and be inside a group with role='radiogroup'", level: "A", notes: "Native <input type='radio'> in <fieldset> satisfies this automatically" },
      { requirement: "The group must have an accessible name via <legend> or aria-labelledby", level: "A", notes: "Visible legend preferred over aria-label" },
      { requirement: "Arrow keys must move both focus and selection within the group", level: "A", notes: "Roving tabindex pattern recommended" },
      { requirement: "Only the active/checked radio should be in the tab order (tabindex 0)", level: "A", notes: "Other radios get tabindex -1" },
      { requirement: "State change must be announced via aria-checked", level: "A", notes: "Native inputs handle this; custom implementations must manage it" },
      { requirement: "Error messages must be linked to the group via aria-describedby", level: "A", notes: "Use a live region or aria-invalid on the group container" },
      { requirement: "Focus indicator must have at least 3:1 contrast against adjacent colors", level: "AA", notes: "WCAG 2.4.11 focus appearance" },
    ],
    outro: [
      "Test with VoiceOver, NVDA, and JAWS to confirm group name and option announcement",
      "Verify arrow-key roving works correctly when radios wrap between first and last",
      "Ensure disabled radios are excluded from the arrow-key cycle",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Only one radio in a group can be selected at a time", platform: "All", expectedResult: "Selecting a new radio deselects the previous one" },
    { check: "Arrow keys cycle through options", platform: "Web", expectedResult: "Focus and selection move; wrap at boundaries" },
    { check: "Tab key exits the group", platform: "Web", expectedResult: "Focus moves to next focusable element outside the group" },
    { check: "Disabled radios cannot be selected", platform: "All", expectedResult: "Click and keyboard interactions are blocked" },
    { check: "Error state displays below the group", platform: "All", expectedResult: "Red border on circles and error text visible" },
    { check: "Touch target meets 44px minimum", platform: "Mobile", expectedResult: "Tapping near the radio reliably triggers selection" },
    { check: "Screen reader announces group label and selected state", platform: "Web", expectedResult: "'Payment method, Standard shipping, selected, radio button 1 of 3'" },
  ],

  dos: [
    "Always provide a default selected option when one choice is strongly recommended",
    "Use fieldset/legend to semantically group radios under a question",
    "Keep the number of options between 2 and 7",
    "Vertically stack options on small viewports for easy scanning",
    "Use helper text to clarify options that might be ambiguous",
    "Ensure the selected dot color meets 3:1 contrast against the circle background",
    "Provide clear error messaging at the group level when validation fails",
  ],

  donts: [
    "Don't use radios for toggling a single binary setting — use a toggle or checkbox instead",
    "Don't mix radios and checkboxes in the same option group",
    "Don't pre-select an option in legal or consent scenarios where explicit choice is required",
    "Don't rely on color alone to indicate selected state — the filled dot shape is essential",
    "Don't place radios in a horizontal row if labels vary significantly in length",
    "Don't omit the group label/legend — screen readers need it for context",
    "Don't disable all options in a group without explaining why via helper text",
  ],
};
