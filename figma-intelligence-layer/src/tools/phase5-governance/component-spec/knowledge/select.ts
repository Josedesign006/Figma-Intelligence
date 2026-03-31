/**
 * Knowledge: Select / Dropdown
 */
import type { ComponentKnowledge } from "../types.js";

export const selectKnowledge: ComponentKnowledge = {
  description:
    "Option selector | Single or multi-choice picker | Form selection control",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Trigger shows placeholder or current value with chevron",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Idle state ready for user interaction",
    },
    {
      state: "Hover",
      visualChange: "Trigger border darkens; subtle background tint",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Indicates the control is clickable on pointer hover",
    },
    {
      state: "Open",
      visualChange:
        "Dropdown list is visible below or above the trigger; chevron rotates",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "User is actively browsing available options",
    },
    {
      state: "Focused",
      visualChange: "Focus ring visible on trigger; dropdown remains closed",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Trigger has keyboard focus but the list is not open",
    },
    {
      state: "Disabled",
      visualChange:
        "Muted colors on trigger, chevron, and text; no pointer events",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "Selection is unavailable due to form logic or permissions",
    },
    {
      state: "Error",
      visualChange:
        "Trigger border changes to error color; error message appears below",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Validation failed — user must make or change a selection",
    },
    {
      state: "Filled",
      visualChange:
        "Selected value replaces placeholder text inside the trigger",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "A valid option has been selected",
    },
  ],

  propertyDescriptions: {
    value: "Currently selected value (string or array for multi-select)",
    options:
      "List of available choices, each with a value and display label",
    placeholder: "Hint text shown inside the trigger when nothing is selected",
    label: "Visible label rendered above or beside the trigger",
    multiple: "Enables multi-select mode when true",
    searchable:
      "Adds a text filter inside the dropdown for long option lists",
    disabled: "Prevents interaction and visually mutes the component",
    error: "Boolean flag placing the component in the error state",
    clearable:
      "Shows a clear icon inside the trigger to reset the selection",
  },

  sizeSpecifications: [
    {
      size: "Small",
      height: "32px",
      paddingLR: "8px",
      fontSize: "12px",
      iconSize: "16px",
      borderRadius: "4px",
    },
    {
      size: "Medium",
      height: "40px",
      paddingLR: "12px",
      fontSize: "14px",
      iconSize: "20px",
      borderRadius: "6px",
    },
    {
      size: "Large",
      height: "48px",
      paddingLR: "16px",
      fontSize: "16px",
      iconSize: "24px",
      borderRadius: "8px",
    },
  ],

  designTokenBindings: [
    {
      property: "border-color (trigger)",
      tokenName: "select/trigger/border/default",
      role: "Default border for the trigger element",
      fallback: "#C6C6C6",
    },
    {
      property: "background-color (trigger)",
      tokenName: "select/trigger/bg/default",
      role: "Trigger background fill",
      fallback: "#FFFFFF",
    },
    {
      property: "background-color (option hover)",
      tokenName: "select/option/bg/hover",
      role: "Background tint when hovering over an option row",
      fallback: "#E8E8E8",
    },
    {
      property: "background-color (option selected)",
      tokenName: "select/option/bg/selected",
      role: "Background for the currently selected option",
      fallback: "#E0E0E0",
    },
    {
      property: "color (chevron)",
      tokenName: "select/icon/chevron",
      role: "Chevron indicator color inside the trigger",
      fallback: "#525252",
    },
    {
      property: "box-shadow (dropdown)",
      tokenName: "select/dropdown/shadow",
      role: "Elevation shadow on the dropdown panel",
      fallback: "0 4px 12px rgba(0,0,0,0.12)",
    },
    {
      property: "background-color (option default)",
      tokenName: "select/option/bg/default",
      role: "Default background for option rows",
      fallback: "#FFFFFF",
    },
  ],

  structureRules: [
    "The trigger element includes the selected value (or placeholder), a chevron icon, and optionally a clear icon",
    "The dropdown panel is a portal-rendered overlay positioned relative to the trigger",
    "Each option row contains a label and an optional leading icon or avatar",
    "In multi-select mode, selected values appear as removable chips inside the trigger",
    "A search input is rendered as the first element inside the dropdown when searchable is true",
    "The dropdown must not overflow the viewport — flip direction when space is insufficient",
  ],

  typeHierarchyRules: [
    "Label uses the component's base font size at semibold weight",
    "Trigger value text uses the component's base font size at regular weight",
    "Option labels match the trigger font size",
    "Group headings (if present) use a smaller font size at semibold weight with uppercase tracking",
  ],

  interactionRules: [
    {
      event: "click",
      trigger: "User clicks the trigger element",
      action: "Dropdown opens; first option or current selection receives visual focus",
    },
    {
      event: "keydown (ArrowDown / ArrowUp)",
      trigger: "User presses arrow keys while dropdown is open",
      action: "Visual focus moves through options sequentially; list scrolls to keep the focused option visible",
    },
    {
      event: "keydown (Enter)",
      trigger: "User presses Enter on a focused option",
      action: "Option is selected, dropdown closes, and onChange fires",
    },
    {
      event: "keydown (Escape)",
      trigger: "User presses Escape while dropdown is open",
      action: "Dropdown closes without changing the selection; focus returns to the trigger",
    },
    {
      event: "keydown (character)",
      trigger: "User types a letter while dropdown is open (type-ahead)",
      action: "Focus jumps to the first option whose label starts with the typed character",
    },
  ],

  contentGuidance: [
    "Always provide a label above the trigger — do not rely on placeholder alone",
    "Placeholder text should read as an instruction (e.g. 'Select a country') not a value",
    "Keep option labels concise — one line, no truncation in the default dropdown width",
    "Group related options under section headings when the list exceeds 10 items",
    "For three or fewer options, consider radio buttons instead of a select",
  ],

  responsiveBehaviour: [
    {
      breakpoint: "< 480px",
      behavior:
        "Trigger stretches to full width; dropdown renders as a bottom sheet or full-width overlay",
    },
    {
      breakpoint: "480px – 1024px",
      behavior:
        "Trigger follows grid column span; dropdown panel matches trigger width or grows to content",
    },
    {
      breakpoint: "> 1024px",
      behavior:
        "Trigger may have a constrained max-width; dropdown remains anchored to the trigger edge",
    },
  ],

  accessibilitySpec: {
    intro:
      "The select must follow the ARIA combobox pattern so assistive technology can announce the role, expanded state, and active option.",
    requirements: [
      {
        requirement:
          "Trigger has role=\"combobox\" with aria-haspopup=\"listbox\" and aria-expanded reflecting open/closed state",
        level: "A",
        notes: "WCAG 4.1.2 – Name, Role, Value",
      },
      {
        requirement:
          "The dropdown list has role=\"listbox\" and each option has role=\"option\"",
        level: "A",
        notes: "ARIA listbox pattern",
      },
      {
        requirement:
          "aria-activedescendant on the trigger points to the id of the currently focused option",
        level: "A",
        notes: "Enables screen readers to track visual focus without moving DOM focus",
      },
      {
        requirement:
          "Label element is linked to the trigger via htmlFor/id or aria-labelledby",
        level: "A",
        notes: "WCAG 1.3.1 – Info and Relationships",
      },
      {
        requirement:
          "Focus indicator on the trigger and on individual options meets 3:1 contrast",
        level: "AA",
        notes: "WCAG 2.4.7 – Focus Visible",
      },
    ],
    outro: [
      "Test with VoiceOver and NVDA: open dropdown, navigate options, select, and verify announcements",
      "Ensure Escape closes the dropdown and returns focus to the trigger",
      "Verify that type-ahead works with screen readers active",
    ],
  },

  qaAcceptanceCriteria: [
    {
      check: "Open / close",
      platform: "Web / Mobile",
      expectedResult:
        "Clicking the trigger opens the dropdown; clicking outside or pressing Escape closes it",
    },
    {
      check: "Keyboard navigation",
      platform: "Web",
      expectedResult:
        "Arrow keys move focus through options; Enter selects; Home/End jump to first/last option",
    },
    {
      check: "Search filtering",
      platform: "Web",
      expectedResult:
        "Typing in the search field filters options in real time; no-match state shows an empty message",
    },
    {
      check: "Multi-select",
      platform: "Web / Mobile",
      expectedResult:
        "Checking multiple options adds chips to the trigger; each chip has a remove button",
    },
    {
      check: "Scroll behavior",
      platform: "Web / Mobile",
      expectedResult:
        "Long option lists scroll within the dropdown; focused option is always scrolled into view",
    },
    {
      check: "Screen reader announcement",
      platform: "Web",
      expectedResult:
        "VoiceOver/NVDA reads label, role, expanded state, option count, and selected option",
    },
  ],

  dos: [
    "Always pair the select with a visible label",
    "Use a placeholder that reads as an instruction (e.g. 'Choose an option')",
    "Provide a clear button when the selection is optional",
    "Sort options in a logical order (alphabetical, frequency, or grouped)",
    "Show a checkmark or highlight for the currently selected option in the list",
  ],

  donts: [
    "Do not use a select for fewer than three options — use radio buttons instead",
    "Do not auto-submit the form on selection change without warning the user",
    "Do not truncate option labels — widen the dropdown or wrap text",
    "Do not nest selects inside other selects",
    "Do not remove keyboard support in favor of mouse-only interaction",
  ],
};
