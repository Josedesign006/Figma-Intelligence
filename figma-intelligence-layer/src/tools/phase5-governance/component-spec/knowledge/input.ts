/**
 * Knowledge: Input / Text Field
 */
import type { ComponentKnowledge } from "../types.js";

export const inputKnowledge: ComponentKnowledge = {
  description:
    "Text entry field | Captures user input | Form data collection element",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Neutral border, empty or placeholder text visible",
      opacity: "1",
      cursorWeb: "text",
      usage: "Idle state awaiting user interaction",
    },
    {
      state: "Hover",
      visualChange: "Border color darkens slightly",
      opacity: "1",
      cursorWeb: "text",
      usage: "Indicates the field is interactive on pointer hover",
    },
    {
      state: "Focused",
      visualChange: "Focus ring appears, border changes to primary color",
      opacity: "1",
      cursorWeb: "text",
      usage: "Field is actively receiving keyboard input",
    },
    {
      state: "Filled",
      visualChange: "User-entered value replaces placeholder text",
      opacity: "1",
      cursorWeb: "text",
      usage: "Field contains a user-supplied value",
    },
    {
      state: "Error",
      visualChange:
        "Border turns error color, error message appears below field",
      opacity: "1",
      cursorWeb: "text",
      usage: "Validation has failed; user must correct the value",
    },
    {
      state: "Disabled",
      visualChange: "Muted background and text, no interaction possible",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "Field is non-interactive due to form logic or permissions",
    },
    {
      state: "Read-only",
      visualChange:
        "Value is visible but field chrome is reduced; no editable caret",
      opacity: "1",
      cursorWeb: "default",
      usage: "Displays a value the user cannot modify",
    },
  ],

  propertyDescriptions: {
    value: "Current text content of the input",
    placeholder: "Hint text shown when the field is empty",
    label: "Visible label rendered above or beside the field",
    helperText:
      "Supplementary guidance displayed below the field (e.g. format hint)",
    error: "Boolean flag indicating the field is in an error state",
    errorMessage: "Descriptive text explaining the validation failure",
    disabled: "Prevents all user interaction when true",
    readOnly: "Displays the value but disallows editing",
    required: "Marks the field as mandatory for form submission",
    type: "HTML input type attribute (text, email, password, number, etc.)",
    maxLength: "Maximum number of characters the field will accept",
    prefix: "Static content rendered inside the field before the value (e.g. $)",
    suffix:
      "Static content rendered inside the field after the value (e.g. kg)",
    icon: "Optional icon displayed inside the field for contextual meaning",
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
      property: "border-color",
      tokenName: "input/border/default",
      role: "Default border surrounding the field",
      fallback: "#C6C6C6",
    },
    {
      property: "background-color",
      tokenName: "input/bg/default",
      role: "Field background fill",
      fallback: "#FFFFFF",
    },
    {
      property: "color",
      tokenName: "input/text/default",
      role: "Entered text color",
      fallback: "#161616",
    },
    {
      property: "color (placeholder)",
      tokenName: "input/text/placeholder",
      role: "Placeholder hint text color",
      fallback: "#A8A8A8",
    },
    {
      property: "color (label)",
      tokenName: "input/label/default",
      role: "Label text color above the field",
      fallback: "#525252",
    },
    {
      property: "box-shadow (focus)",
      tokenName: "input/focus-ring",
      role: "Focus ring outline on keyboard focus",
      fallback: "0 0 0 2px #0F62FE",
    },
    {
      property: "border-color (error)",
      tokenName: "input/border/error",
      role: "Border color when validation fails",
      fallback: "#DA1E28",
    },
    {
      property: "color (error text)",
      tokenName: "input/text/error",
      role: "Error message text color",
      fallback: "#DA1E28",
    },
  ],

  structureRules: [
    "Label is always a separate element positioned above the field",
    "Helper text and error message occupy the same slot below the field — only one is visible at a time",
    "Prefix and suffix are inline elements inside the field container, before/after the editable area",
    "Icon is placed at the leading or trailing edge inside the field, never both simultaneously",
    "A clear button appears at the trailing edge when the field contains a value and is not disabled or read-only",
  ],

  typeHierarchyRules: [
    "Label uses the component's base font size at semibold weight",
    "Input value text uses the component's base font size at regular weight",
    "Placeholder text matches the value font size but uses placeholder color",
    "Helper text and error message use a font size one step smaller than the value text",
  ],

  interactionRules: [
    {
      event: "click",
      trigger: "User clicks anywhere inside the field area",
      action: "Field gains focus and displays the text caret",
    },
    {
      event: "keydown",
      trigger: "User types while field is focused",
      action:
        "Characters are inserted at the caret position; value updates in real time",
    },
    {
      event: "blur",
      trigger: "Field loses focus (user clicks elsewhere or tabs away)",
      action:
        "Validation fires; error state is applied if the value is invalid",
    },
    {
      event: "click (clear)",
      trigger: "User clicks the clear button inside the field",
      action:
        "Value is emptied, field retains focus, and onChange callback fires",
    },
  ],

  contentGuidance: [
    "Labels should be placed above the field, not inside it",
    "Use placeholder text to show an example value, never as a replacement for the label",
    "Helper text should describe the expected format or constraints (e.g. 'Must be at least 8 characters')",
    "Error messages must be specific and actionable — avoid generic phrases like 'Invalid input'",
    "Keep labels concise: one to three words when possible",
  ],

  responsiveBehaviour: [
    {
      breakpoint: "< 480px",
      behavior:
        "Field stretches to full container width; label stacks above the field",
    },
    {
      breakpoint: "480px – 1024px",
      behavior:
        "Field width follows the grid column span; side-by-side labels are acceptable",
    },
    {
      breakpoint: "> 1024px",
      behavior:
        "Field width may be constrained to a max-width for readability; inline labels permitted",
    },
  ],

  accessibilitySpec: {
    intro:
      "The text input must be operable via keyboard and correctly announce its label, state, and errors to assistive technology.",
    requirements: [
      {
        requirement:
          "Field has role=\"textbox\" (implicit via <input>) and a visible <label> element linked by htmlFor/id",
        level: "A",
        notes: "WCAG 1.3.1 – Info and Relationships",
      },
      {
        requirement:
          "When the field is required, aria-required=\"true\" is set and the label includes a visual required indicator",
        level: "A",
        notes: "WCAG 3.3.2 – Labels or Instructions",
      },
      {
        requirement:
          "When validation fails, aria-invalid=\"true\" is set on the input",
        level: "A",
        notes: "WCAG 3.3.1 – Error Identification",
      },
      {
        requirement:
          "Error message element is linked to the input via aria-describedby so screen readers announce the error on focus",
        level: "A",
        notes: "WCAG 3.3.1 – Error Identification",
      },
      {
        requirement:
          "Text and border meet WCAG AA contrast ratio (4.5:1 for text, 3:1 for non-text UI)",
        level: "AA",
        notes: "WCAG 1.4.3 / 1.4.11",
      },
      {
        requirement:
          "Focus indicator is visible with at least 3:1 contrast against adjacent colors",
        level: "AA",
        notes: "WCAG 2.4.7 – Focus Visible",
      },
    ],
    outro: [
      "Test with VoiceOver (macOS/iOS) and NVDA (Windows) to verify label, required, and error announcements",
      "Ensure Tab moves focus into the field and Shift+Tab moves it out",
      "Verify that autocomplete attributes (autocomplete) are present for common fields (name, email, address)",
    ],
  },

  qaAcceptanceCriteria: [
    {
      check: "Focus behavior",
      platform: "Web / Mobile",
      expectedResult:
        "Clicking or tapping the field shows a visible focus ring and text caret",
    },
    {
      check: "Validation on blur",
      platform: "Web",
      expectedResult:
        "Leaving an invalid required field displays the error message and sets the error border",
    },
    {
      check: "Character count",
      platform: "Web / Mobile",
      expectedResult:
        "When maxLength is set, the user cannot type beyond the limit and a counter is displayed",
    },
    {
      check: "Paste handling",
      platform: "Web",
      expectedResult:
        "Pasting text that exceeds maxLength truncates to the limit; value updates correctly",
    },
    {
      check: "RTL support",
      platform: "Web",
      expectedResult:
        "In RTL locales the label, value, and helper text are right-aligned; prefix/suffix positions are mirrored",
    },
    {
      check: "Screen reader announcement",
      platform: "Web",
      expectedResult:
        "VoiceOver/NVDA reads: label, required status, current value, and any error message on focus",
    },
  ],

  dos: [
    "Always pair the input with a visible label element",
    "Use helper text to clarify expected format or constraints",
    "Provide real-time character count when maxLength is enforced",
    "Show the clear button only when the field has a value",
    "Match the input size variant to surrounding form controls for visual harmony",
  ],

  donts: [
    "Do not use placeholder text as a substitute for a label",
    "Do not disable the field without explaining why to the user",
    "Do not validate on every keystroke — wait for blur or explicit submission",
    "Do not show both helper text and error message simultaneously",
    "Do not remove the focus ring for sighted keyboard users",
  ],
};
