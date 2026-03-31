/**
 * slider.ts — Gold-standard design knowledge for Slider components
 */
import type { ComponentKnowledge } from "../types.js";

export const sliderKnowledge: ComponentKnowledge = {
  description:
    "Continuous value selector | Range input control | Numeric value adjuster",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Track bar with filled portion and thumb positioned at current value",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Resting state — slider is interactive and displays the current value",
    },
    {
      state: "Hover",
      visualChange: "Thumb scales up slightly (1.15x) and gains a subtle shadow; track highlight brightens",
      opacity: "1",
      cursorWeb: "grab",
      usage: "Mouse cursor enters the thumb or track hit area",
    },
    {
      state: "Active / Dragging",
      visualChange: "Thumb scales to 1.2x with pronounced shadow; value tooltip appears above thumb",
      opacity: "1",
      cursorWeb: "grabbing",
      usage: "User is actively dragging the thumb along the track",
    },
    {
      state: "Focus",
      visualChange: "2px focus ring around the thumb element, offset by 2px",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Thumb receives keyboard focus via Tab key",
    },
    {
      state: "Disabled",
      visualChange: "Track, fill, and thumb switch to muted/disabled tokens; no interaction possible",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "Slider value cannot be changed due to form state or permissions",
    },
    {
      state: "Error",
      visualChange: "Track or thumb border switches to error token; helper text shows validation message",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Current value is outside an acceptable range or fails validation",
    },
  ],

  propertyDescriptions: {
    value: "Current numeric value of the slider; must be between min and max",
    min: "Minimum allowed value — the left/bottom end of the track",
    max: "Maximum allowed value — the right/top end of the track",
    step: "Increment amount for each keyboard arrow press or tick mark; 0 allows continuous values",
    disabled: "When true the slider is non-interactive: muted visuals, aria-disabled='true'",
    showValue: "When true, a label or tooltip displays the current numeric value near the thumb",
    range: "When true, two thumbs define a value range (min-thumb and max-thumb) instead of a single value",
  },

  sizeSpecifications: [
    {
      size: "Small",
      height: "24px",
      paddingLR: "8px",
      fontSize: "11px",
      iconSize: "12px",
      borderRadius: "999px",
    },
    {
      size: "Medium",
      height: "32px",
      paddingLR: "12px",
      fontSize: "12px",
      iconSize: "16px",
      borderRadius: "999px",
    },
    {
      size: "Large",
      height: "40px",
      paddingLR: "16px",
      fontSize: "14px",
      iconSize: "20px",
      borderRadius: "999px",
    },
  ],

  designTokenBindings: [
    {
      property: "Track Background",
      tokenName: "$slider-track-bg",
      role: "Unfilled portion of the track bar",
      fallback: "#E4E7EC",
    },
    {
      property: "Track Fill",
      tokenName: "$slider-track-fill",
      role: "Filled/active portion of the track from min to current value",
      fallback: "#2563EB",
    },
    {
      property: "Thumb Background",
      tokenName: "$slider-thumb-bg",
      role: "Circular draggable handle fill color",
      fallback: "#FFFFFF",
    },
    {
      property: "Thumb Border",
      tokenName: "$slider-thumb-border",
      role: "Border around the thumb for definition against track and page",
      fallback: "#2563EB",
    },
    {
      property: "Thumb Shadow",
      tokenName: "$shadow-slider-thumb",
      role: "Elevation shadow on the thumb during hover and drag",
      fallback: "0 2px 6px rgba(0,0,0,0.15)",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Keyboard focus indicator around the thumb",
      fallback: "0 0 0 2px #FFFFFF, 0 0 0 4px #2E90FA",
    },
    {
      property: "Value Label",
      tokenName: "$slider-value-text",
      role: "Text color for the current value label or tooltip",
      fallback: "#344054",
    },
  ],

  structureRules: [
    "Track is a horizontal bar with border-radius 999px (fully rounded); height is 4px (sm), 6px (md), or 8px (lg)",
    "Thumb is a circle centered vertically on the track; diameter is 16px (sm), 20px (md), or 24px (lg)",
    "Fill region extends from the track start (min) to the thumb center position",
    "Value tooltip floats above the thumb during drag; connected by a small arrow pointer",
    "Dual-thumb range mode places two thumbs on the track; fill region spans between them",
    "Tick marks are evenly spaced vertical lines on the track when step is defined and showTicks is true",
    "Min and max labels are positioned at the track endpoints below the bar",
  ],

  typeHierarchyRules: [
    "Value label uses Tabular Nums (monospaced digits) to prevent layout shift as numbers change",
    "Min/max labels use Regular weight (400) at a font-size one step below the value label",
    "Value tooltip text uses Medium weight (500) on a dark background",
    "Font variant: tabular-nums ensures digit columns stay aligned during drag",
    "Labels use sentence case; units (%, px, etc.) are appended after a thin space",
  ],

  interactionRules: [
    { event: "Drag", trigger: "pointerdown on thumb then pointermove", action: "Update value proportionally to horizontal pointer position along track" },
    { event: "Track Click", trigger: "pointerup on track (not thumb)", action: "Snap thumb to clicked position; update value immediately" },
    { event: "Arrow Right/Up", trigger: "Right or Up arrow while focused", action: "Increment value by one step; clamp at max" },
    { event: "Arrow Left/Down", trigger: "Left or Down arrow while focused", action: "Decrement value by one step; clamp at min" },
    { event: "Home", trigger: "Home key while focused", action: "Set value to min" },
    { event: "End", trigger: "End key while focused", action: "Set value to max" },
    { event: "Page Up/Down", trigger: "PageUp or PageDown while focused", action: "Increment or decrement by 10% of the range" },
  ],

  contentGuidance: [
    "Always show min and max labels so users understand the value range",
    "Display the current numeric value near the thumb or in an adjacent text field",
    "Pair the slider with an input field for users who prefer typing exact values",
    "Use clear units of measurement (%, px, ms) appended to the value",
    "Provide a descriptive label above the slider explaining what the value controls",
    "For range sliders, label both the min-thumb and max-thumb values clearly",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Slider fills full container width; thumb size increases to 28px for touch; value tooltip shown during drag" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Slider spans available width within form layout; standard thumb size" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Slider constrained by parent container; hover states fully active" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Slider max-width capped to prevent overly long tracks (~480px)" },
  ],

  accessibilitySpec: {
    intro:
      "Sliders must communicate their value, range, and orientation to assistive technology. Full keyboard control is required.",
    requirements: [
      { requirement: "role='slider'", level: "A", notes: "The thumb element must have role='slider' for screen reader identification" },
      { requirement: "aria-valuenow", level: "A", notes: "Must reflect the current numeric value of the slider in real time" },
      { requirement: "aria-valuemin / aria-valuemax", level: "A", notes: "Define the permissible range so screen readers can announce bounds" },
      { requirement: "aria-valuetext", level: "A", notes: "Provide a human-readable value string when the numeric value alone is insufficient (e.g., '50%')" },
      { requirement: "Keyboard Control", level: "A", notes: "Arrow keys adjust by step; Home/End jump to min/max; PageUp/PageDown by 10%" },
      { requirement: "Contrast", level: "AA", notes: "Thumb boundary must meet 3:1 against track and page; fill color must meet 3:1 against track" },
      { requirement: "Touch Target", level: "AA", notes: "Thumb touch target is at least 44x44px regardless of visual size" },
    ],
    outro: [
      "For dual-thumb range sliders, each thumb must be independently focusable with its own aria-valuenow",
      "Announce value changes to screen readers using aria-live or by updating aria-valuenow during drag",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Drag Tracking", platform: "Web", expectedResult: "Thumb follows pointer precisely during drag; value updates in real time" },
    { check: "Track Click", platform: "Web", expectedResult: "Clicking the track snaps thumb to click position; no animation delay" },
    { check: "Keyboard Step", platform: "Web", expectedResult: "Arrow keys increment/decrement by configured step; Home/End reach min/max" },
    { check: "Value Clamping", platform: "All", expectedResult: "Value never exceeds min or max bounds via any input method" },
    { check: "Range Mode", platform: "All", expectedResult: "Two thumbs independently draggable; cannot cross each other; fill spans between them" },
    { check: "Value Display", platform: "All", expectedResult: "Current value shown in tooltip during drag and/or in a persistent label" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces role, current value, min, max, and value changes" },
    { check: "Disabled State", platform: "All", expectedResult: "Muted visuals; drag, click, and keyboard have no effect; aria-disabled='true'" },
    { check: "Focus Ring", platform: "Web", expectedResult: "Focus ring visible around thumb on keyboard focus; hidden on mouse interaction" },
    { check: "Touch Accuracy", platform: "Mobile", expectedResult: "Thumb enlarged to 28px; drag tracking accurate with finger input" },
    { check: "RTL Support", platform: "Web", expectedResult: "Track direction reverses; min is on the right; keyboard arrows behave correctly" },
  ],

  dos: [
    "Always display min and max labels at the track endpoints",
    "Show the current value in a tooltip or adjacent label during interaction",
    "Pair sliders with a text input for precise value entry",
    "Use appropriate step values to avoid meaningless precision (e.g., step=1 for integers)",
    "Ensure the thumb is large enough for comfortable touch interaction (44px minimum)",
    "Use the filled track region to give visual feedback about the selected value",
    "Support both pointer drag and keyboard arrow keys for value adjustment",
  ],

  donts: [
    "Do not use sliders for fewer than 5 possible values — use radio buttons or a stepper instead",
    "Do not hide the min/max range — users need context to choose meaningful values",
    "Do not allow the dual-thumb handles to cross or overlap each other",
    "Do not use sliders for non-numeric selections (e.g., categories or text options)",
    "Do not make the track too short — minimum 120px to allow fine-grained control",
    "Do not remove the filled track region — it provides essential spatial feedback",
    "Do not ignore keyboard accessibility — arrow keys, Home, End, and Page keys are required",
  ],
};
