/**
 * range-slider.ts — Gold-standard design knowledge for Range Slider (dual-thumb) components
 */
import type { ComponentKnowledge } from "../types.js";

export const rangeSliderKnowledge: ComponentKnowledge = {
  description:
    "Dual-thumb range slider | Min/max value selection | Continuous or stepped range input with two draggable handles",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Track shows filled range between two thumbs; unfilled portions are muted; thumbs are at their current positions",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Resting state — both thumbs are interactive and positioned at their current values",
    },
    {
      state: "Hover (Thumb)",
      visualChange: "Hovered thumb increases in size slightly or gains a subtle glow/ring effect",
      opacity: "1",
      cursorWeb: "grab",
      usage: "Mouse cursor enters a thumb's hit area — indicates the thumb can be dragged",
    },
    {
      state: "Active (Dragging)",
      visualChange: "Active thumb is visually elevated (shadow or scale-up); value tooltip appears above showing current value",
      opacity: "1",
      cursorWeb: "grabbing",
      usage: "User is actively dragging a thumb to adjust the range boundary",
    },
    {
      state: "Focus",
      visualChange: "Focused thumb shows a 2px focus ring; keyboard adjustments are possible",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "A thumb receives keyboard focus via Tab navigation for keyboard-driven value adjustment",
    },
    {
      state: "Disabled",
      visualChange: "Track and both thumbs are muted/desaturated; no interaction possible",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "Range selection is unavailable — the component is non-interactive",
    },
    {
      state: "Error",
      visualChange: "Track filled portion turns error color; error message appears below; thumbs may show error ring",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Selected range is invalid — e.g. range too narrow or too wide for business rules",
    },
  ],

  propertyDescriptions: {
    min: "Minimum possible value for the slider range — the leftmost position of the track",
    max: "Maximum possible value for the slider range — the rightmost position of the track",
    step: "Increment between selectable values — determines the snap points on the track (e.g. 1, 5, 10)",
    value: "Tuple [minValue, maxValue] representing the current range selection; controlled by parent component",
    onChange: "Callback invoked with the new [minValue, maxValue] tuple when either thumb is moved",
    size: "Dimensional preset — Small, Medium, or Large — controlling track height, thumb size, and label font size",
    label: "Visible label text for the range slider; positioned above the track",
    showValues: "When true, displays the current min and max values as text labels at each end or above each thumb",
    showTooltip: "When true, shows a value tooltip above the thumb while dragging or on hover",
    marks: "Array of labeled tick marks to display along the track at specific value positions",
    disabled: "When true, the slider is non-interactive; both thumbs and the track are muted",
    minRange: "Minimum allowed distance between the two thumbs; prevents them from being too close together",
    maxRange: "Maximum allowed distance between the two thumbs; constrains the range width",
  },

  sizeSpecifications: [
    {
      size: "Small",
      height: "4px (track)",
      paddingLR: "0px",
      fontSize: "12px",
      iconSize: "14px (thumb)",
      borderRadius: "2px (track) / 50% (thumb)",
    },
    {
      size: "Medium",
      height: "6px (track)",
      paddingLR: "0px",
      fontSize: "14px",
      iconSize: "18px (thumb)",
      borderRadius: "3px (track) / 50% (thumb)",
    },
    {
      size: "Large",
      height: "8px (track)",
      paddingLR: "0px",
      fontSize: "16px",
      iconSize: "24px (thumb)",
      borderRadius: "4px (track) / 50% (thumb)",
    },
  ],

  designTokenBindings: [
    {
      property: "Track Background",
      tokenName: "$range-slider-track-bg",
      role: "Unfilled track background color (portions outside the selected range)",
      fallback: "#E4E7EC",
    },
    {
      property: "Track Fill",
      tokenName: "$range-slider-fill",
      role: "Filled track color between the two thumbs (the selected range)",
      fallback: "#2563EB",
    },
    {
      property: "Thumb Background",
      tokenName: "$range-slider-thumb-bg",
      role: "Background fill of both thumb elements",
      fallback: "#FFFFFF",
    },
    {
      property: "Thumb Border",
      tokenName: "$range-slider-thumb-border",
      role: "Border around both thumb elements",
      fallback: "#2563EB",
    },
    {
      property: "Thumb Shadow",
      tokenName: "$range-slider-thumb-shadow",
      role: "Elevation shadow on thumb elements",
      fallback: "0 1px 3px rgba(0, 0, 0, 0.2)",
    },
    {
      property: "Thumb Hover Ring",
      tokenName: "$range-slider-thumb-hover",
      role: "Subtle ring or glow effect on thumb hover",
      fallback: "rgba(37, 99, 235, 0.15)",
    },
    {
      property: "Tooltip Background",
      tokenName: "$range-slider-tooltip-bg",
      role: "Background of the value tooltip shown during dragging",
      fallback: "#101828",
    },
    {
      property: "Tooltip Text",
      tokenName: "$range-slider-tooltip-text",
      role: "Text color inside the value tooltip",
      fallback: "#FFFFFF",
    },
    {
      property: "Label Color",
      tokenName: "$range-slider-label",
      role: "Label text color above the slider",
      fallback: "#344054",
    },
    {
      property: "Value Text",
      tokenName: "$range-slider-value-text",
      role: "Text color for the displayed min/max values",
      fallback: "#667085",
    },
    {
      property: "Mark Color",
      tokenName: "$range-slider-mark",
      role: "Color for tick marks along the track",
      fallback: "#98A2B3",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Keyboard focus indicator around the focused thumb",
      fallback: "0 0 0 2px #FFFFFF, 0 0 0 4px #2E90FA",
    },
  ],

  structureRules: [
    "Container uses vertical Auto Layout: label (optional) → slider track with thumbs → value labels/marks (optional)",
    "Track is a horizontal bar with the filled range portion colored between the two thumb positions",
    "Two thumb elements are positioned absolutely along the track based on their respective values",
    "Each thumb is a circular element (border-radius: 50%) centered vertically on the track",
    "Thumb hit area extends beyond the visible thumb to at least 44x44px for touch accessibility",
    "Value tooltip is positioned above the active thumb using absolute positioning with a small arrow pointer",
    "Tick marks are positioned along the track at values specified in the marks array",
    "Mark labels are positioned below the track, centered on their corresponding tick mark",
    "The filled track segment starts at the min thumb position and ends at the max thumb position",
    "Thumbs cannot cross each other — the min thumb is constrained to values less than or equal to the max thumb",
  ],

  typeHierarchyRules: [
    "Label text uses Medium weight (500) at the standard fontSize for the size preset",
    "Value display text uses Regular weight (400) at the same fontSize or one step smaller",
    "Tooltip text uses Medium weight (500) at 12px with inverted (light-on-dark) color scheme",
    "Mark labels use Regular weight (400) at 10-12px in a muted color",
    "All numeric values should use tabular/monospace figures to prevent layout shifts during dragging",
  ],

  interactionRules: [
    { event: "Drag Thumb", trigger: "Pointer down on a thumb then drag horizontally", action: "Move the thumb along the track; update value in real-time; fire onChange continuously" },
    { event: "Click Track", trigger: "Click/tap on the track between or outside the thumbs", action: "Move the nearest thumb to the clicked position; fire onChange" },
    { event: "Hover Thumb", trigger: "Pointer enters a thumb's hit area", action: "Show hover ring effect; cursor changes to 'grab'" },
    { event: "Focus Thumb", trigger: "Tab key reaches a thumb element", action: "Focus ring appears on the thumb; ready for keyboard adjustment" },
    { event: "Arrow Right/Up", trigger: "Arrow key while a thumb is focused", action: "Increase the thumb value by one step; fire onChange" },
    { event: "Arrow Left/Down", trigger: "Arrow key while a thumb is focused", action: "Decrease the thumb value by one step; fire onChange" },
    { event: "Page Up", trigger: "Page Up while a thumb is focused", action: "Increase the thumb value by 10 steps (or 10% of range); fire onChange" },
    { event: "Page Down", trigger: "Page Down while a thumb is focused", action: "Decrease the thumb value by 10 steps (or 10% of range); fire onChange" },
    { event: "Home", trigger: "Home key while a thumb is focused", action: "Set the thumb to its minimum allowed value (min for low thumb, low thumb value for high thumb)" },
    { event: "End", trigger: "End key while a thumb is focused", action: "Set the thumb to its maximum allowed value (high thumb value for low thumb, max for high thumb)" },
    { event: "Touch Drag", trigger: "Touch start + move on a thumb", action: "Same as pointer drag; ensure no page scroll while dragging" },
  ],

  contentGuidance: [
    "Label the slider clearly with the dimension being controlled: 'Price range', 'Distance', 'Age range'",
    "Always display the current min and max values so users know their exact selection",
    "Use units in value displays: '$50 - $200', '10km - 50km' — not just raw numbers",
    "For financial values, use appropriate formatting with currency symbols and separators",
    "Consider showing the full range bounds (min and max) at the track endpoints for context",
    "Use tick marks with labels for sliders with discrete, meaningful stops (e.g. t-shirt sizes, price tiers)",
    "Tooltip values should match the format of the displayed value labels for consistency",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Slider takes full container width; thumb size increases to 24px minimum for touch; value labels may stack vertically" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Standard slider width; comfortable thumb sizes; value labels positioned inline" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Standard layout; tooltips appear on hover/drag; mark labels fully visible" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Slider width remains capped at container max-width; does not scale with viewport" },
  ],

  accessibilitySpec: {
    intro:
      "Range sliders use two separate slider ARIA roles to enable independent control of min and max values. Each thumb must be independently operable via keyboard with proper value announcements.",
    requirements: [
      { requirement: "Slider Role (Min)", level: "A", notes: "Min thumb must have role='slider' with aria-valuemin, aria-valuemax (capped at max thumb), and aria-valuenow" },
      { requirement: "Slider Role (Max)", level: "A", notes: "Max thumb must have role='slider' with aria-valuemin (capped at min thumb), aria-valuemax, and aria-valuenow" },
      { requirement: "Accessible Labels", level: "A", notes: "Each thumb needs a distinct aria-label: 'Minimum price' and 'Maximum price' to differentiate them" },
      { requirement: "Value Text", level: "A", notes: "Use aria-valuetext to provide formatted values (e.g. '$50') instead of raw numbers" },
      { requirement: "Keyboard Navigation", level: "A", notes: "Arrow keys change value by step; Page Up/Down by 10x step; Home/End to boundaries" },
      { requirement: "Tab Order", level: "A", notes: "Both thumbs must be in the tab order; Tab moves between thumbs; the min thumb comes first" },
      { requirement: "Contrast", level: "AA", notes: "Track fill and thumbs must meet 3:1 non-text contrast against the background; value text must meet 4.5:1" },
      { requirement: "Touch Target", level: "AA", notes: "Each thumb's interactive area must be at least 44x44px on touch devices" },
      { requirement: "Value Announcement", level: "AA", notes: "Screen readers should announce the new value as the thumb is moved via keyboard" },
    ],
    outro: [
      "Test that both thumbs can be independently controlled via keyboard without the values crossing",
      "Verify screen readers announce the correct formatted value (aria-valuetext) when thumbs move",
      "Ensure the relationship between the two thumbs is clear — use a group label like 'Price range'",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Default Render", platform: "All", expectedResult: "Track shows filled range between two thumbs; unfilled portions are muted" },
    { check: "Drag Min Thumb", platform: "All", expectedResult: "Min thumb moves along track; value updates in real-time; cannot cross max thumb" },
    { check: "Drag Max Thumb", platform: "All", expectedResult: "Max thumb moves along track; value updates in real-time; cannot cross min thumb" },
    { check: "Track Click", platform: "All", expectedResult: "Clicking track moves the nearest thumb to the clicked position" },
    { check: "Step Snapping", platform: "All", expectedResult: "Thumbs snap to valid step positions; no intermediate values" },
    { check: "Value Display", platform: "All", expectedResult: "Current min and max values are displayed with correct formatting and units" },
    { check: "Tooltip", platform: "Web", expectedResult: "Value tooltip appears above the active thumb during dragging; shows formatted value" },
    { check: "Keyboard Control", platform: "Web", expectedResult: "Arrow keys change value by step; Page Up/Down by 10x; Home/End to boundaries" },
    { check: "Min Range Constraint", platform: "All", expectedResult: "Thumbs cannot be closer than minRange; movement stops at the constraint boundary" },
    { check: "Max Range Constraint", platform: "All", expectedResult: "Thumbs cannot be farther apart than maxRange; movement stops at the constraint boundary" },
    { check: "Disabled State", platform: "All", expectedResult: "Track and thumbs are muted; no drag, click, or keyboard interaction" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Both thumbs announce slider role, label, and current formatted value" },
    { check: "Touch Target", platform: "Mobile", expectedResult: "Each thumb has at least 44x44px touch area; drag works on touch devices without page scroll" },
    { check: "RTL Support", platform: "Web", expectedResult: "Track direction reverses; min thumb on right, max thumb on left; keyboard directions adjust" },
  ],

  dos: [
    "Give each thumb a distinct aria-label so screen readers can differentiate them (e.g. 'Minimum' and 'Maximum')",
    "Use aria-valuetext to announce formatted values with units ('$50') instead of raw numbers",
    "Display current values prominently so users always know their exact selection",
    "Prevent thumbs from crossing each other — the min value must always be less than or equal to the max value",
    "Support both drag interaction and keyboard step-by-step adjustment for accessibility",
    "Enlarge thumb hit areas on touch devices to at least 44x44px for comfortable interaction",
    "Use tick marks with labels for sliders with meaningful discrete stops",
  ],

  donts: [
    "Do not use a range slider for simple single-value selection — use a standard slider instead",
    "Do not allow thumbs to overlap or cross — enforce min/max constraints",
    "Do not fire onChange only on drag-end — provide continuous updates during dragging for real-time feedback",
    "Do not make the track thinner than 4px — it must be a visible, clickable target",
    "Do not use a range slider for precise numeric entry — pair with input fields for exact values",
    "Do not omit value labels — users need to see the exact numbers, not just relative positions",
    "Do not use the same aria-label for both thumbs — they must be distinguishable by screen readers",
  ],
};
