/**
 * Knowledge: Toggle Switch
 */
import type { ComponentKnowledge } from "../types.js";

export const toggleKnowledge: ComponentKnowledge = {
  description:
    "Binary switch control | Immediate state change | On/Off preference toggle",

  stateSpecifications: [
    {
      state: "Off",
      visualChange: "Track is neutral/muted; thumb is positioned to the left",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Default inactive state — the associated setting is disabled",
    },
    {
      state: "On",
      visualChange:
        "Track fills with primary color; thumb slides to the right",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Active state — the associated setting is enabled",
    },
    {
      state: "Disabled (off)",
      visualChange:
        "Track and thumb are muted; no pointer events; off position",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "Toggle is inactive and cannot be changed by the user",
    },
    {
      state: "Disabled (on)",
      visualChange:
        "Track shows muted primary; thumb on right; no pointer events",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "Toggle is active but locked and cannot be changed",
    },
    {
      state: "Focus",
      visualChange: "Focus ring appears around the track or thumb",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Toggle has keyboard focus and can be operated with Space",
    },
    {
      state: "Hover",
      visualChange: "Subtle background tint or shadow on the track",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Pointer is over the toggle, indicating interactivity",
    },
  ],

  propertyDescriptions: {
    checked: "Boolean indicating whether the toggle is on (true) or off (false)",
    disabled: "Prevents interaction and visually mutes the component",
    label: "Descriptive text adjacent to the toggle explaining its purpose",
    labelPosition:
      "Placement of the label relative to the toggle: 'start' (left/above) or 'end' (right/below)",
    size: "Visual size variant: small, medium, or large",
  },

  sizeSpecifications: [
    {
      size: "Small",
      height: "16px",
      paddingLR: "2px",
      fontSize: "12px",
      iconSize: "12px",
      borderRadius: "8px",
    },
    {
      size: "Medium",
      height: "20px",
      paddingLR: "2px",
      fontSize: "14px",
      iconSize: "14px",
      borderRadius: "10px",
    },
    {
      size: "Large",
      height: "24px",
      paddingLR: "3px",
      fontSize: "16px",
      iconSize: "16px",
      borderRadius: "12px",
    },
  ],

  designTokenBindings: [
    {
      property: "background-color (track off)",
      tokenName: "toggle/track/bg/off",
      role: "Track background when toggle is off",
      fallback: "#C6C6C6",
    },
    {
      property: "background-color (track on)",
      tokenName: "toggle/track/bg/on",
      role: "Track background when toggle is on",
      fallback: "#0F62FE",
    },
    {
      property: "background-color (thumb)",
      tokenName: "toggle/thumb/bg",
      role: "Thumb circle fill color",
      fallback: "#FFFFFF",
    },
    {
      property: "box-shadow (focus)",
      tokenName: "toggle/focus-ring",
      role: "Focus ring outline on keyboard focus",
      fallback: "0 0 0 2px #0F62FE",
    },
    {
      property: "color (label)",
      tokenName: "toggle/label/color",
      role: "Label text color adjacent to the toggle",
      fallback: "#161616",
    },
  ],

  structureRules: [
    "The toggle consists of a track (pill shape) and a thumb (circle) that slides between left and right positions",
    "The label is a sibling element positioned to the start or end of the track depending on labelPosition",
    "Track width is approximately 1.75x its height to allow clear thumb travel",
    "The thumb diameter equals the track height minus internal padding on both sides",
    "No additional icons or text are placed inside the track by default",
  ],

  typeHierarchyRules: [
    "Label uses the component's base font size at regular weight",
    "If a description or sub-label is present, it uses one step smaller font size at regular weight",
    "Label and toggle are vertically center-aligned",
  ],

  interactionRules: [
    {
      event: "click",
      trigger: "User clicks the track, thumb, or label",
      action:
        "Toggle state flips immediately (on to off or off to on); onChange fires",
    },
    {
      event: "keydown (Space)",
      trigger: "User presses Space while the toggle is focused",
      action: "Toggle state flips; same behavior as click",
    },
    {
      event: "drag",
      trigger: "User drags the thumb horizontally across the track",
      action:
        "Thumb follows the pointer; state commits when released past the midpoint",
    },
    {
      event: "change",
      trigger: "Toggle state changes by any method",
      action:
        "Effect takes place immediately — no form submission required",
    },
  ],

  contentGuidance: [
    "Label should clearly describe the setting being controlled (e.g. 'Enable notifications')",
    "Use positive framing — the label describes what happens when the toggle is on",
    "Avoid double negatives (e.g. 'Disable auto-save' is confusing when toggled off)",
    "If the toggle controls a destructive or irreversible action, pair it with a confirmation dialog",
    "Toggles imply an immediate effect — do not use them for choices that require a Save button",
  ],

  responsiveBehaviour: [
    {
      breakpoint: "< 480px",
      behavior:
        "Toggle and label are placed on a single row; label may wrap to a second line if needed",
    },
    {
      breakpoint: "480px – 1024px",
      behavior:
        "Toggle and label sit inline within settings cards or form rows",
    },
    {
      breakpoint: "> 1024px",
      behavior:
        "Toggle may appear in dense settings panels; size stays consistent across breakpoints",
    },
  ],

  accessibilitySpec: {
    intro:
      "The toggle must use role=\"switch\" so assistive technology announces it as a binary on/off control with immediate effect.",
    requirements: [
      {
        requirement:
          "Element has role=\"switch\" with aria-checked reflecting the current state (true/false)",
        level: "A",
        notes: "WCAG 4.1.2 – Name, Role, Value",
      },
      {
        requirement:
          "An accessible name is provided via a visible label linked by htmlFor/id or aria-labelledby",
        level: "A",
        notes: "WCAG 1.3.1 – Info and Relationships",
      },
      {
        requirement:
          "State change is announced immediately by screen readers when toggled",
        level: "A",
        notes: "WCAG 4.1.2 – users must perceive the state change",
      },
      {
        requirement:
          "Focus indicator is visible with at least 3:1 contrast against adjacent colors",
        level: "AA",
        notes: "WCAG 2.4.7 – Focus Visible",
      },
      {
        requirement:
          "Track and thumb contrast meet 3:1 non-text UI requirement in both on and off states",
        level: "AA",
        notes: "WCAG 1.4.11 – Non-text Contrast",
      },
    ],
    outro: [
      "Test with VoiceOver and NVDA: focus the toggle, press Space, and verify the state announcement changes",
      "Ensure the change takes effect immediately without requiring a separate submit action",
      "Verify that disabled toggles are announced as dimmed/unavailable and cannot be operated",
    ],
  },

  qaAcceptanceCriteria: [
    {
      check: "Toggle animation",
      platform: "Web / Mobile",
      expectedResult:
        "Thumb slides smoothly between on and off positions; track color transitions within 150ms",
    },
    {
      check: "Disabled state",
      platform: "Web / Mobile",
      expectedResult:
        "Clicking or pressing Space on a disabled toggle has no effect; cursor shows not-allowed",
    },
    {
      check: "Keyboard operation",
      platform: "Web",
      expectedResult:
        "Space key toggles the state; Tab moves focus to/from the toggle",
    },
    {
      check: "Screen reader announcement",
      platform: "Web",
      expectedResult:
        "VoiceOver/NVDA reads label, role as 'switch', and current state ('on' or 'off')",
    },
    {
      check: "Drag behavior",
      platform: "Web / Mobile",
      expectedResult:
        "Dragging the thumb past the midpoint commits the state change; releasing before midpoint reverts",
    },
    {
      check: "Immediate effect",
      platform: "Web / Mobile",
      expectedResult:
        "Toggling fires the onChange callback immediately without waiting for form submission",
    },
  ],

  dos: [
    "Use toggles for binary settings that take effect immediately",
    "Provide a clear label that describes the 'on' state",
    "Animate the thumb transition for visual feedback",
    "Maintain consistent sizing with adjacent form controls",
    "Ensure both on and off track colors have sufficient contrast against the background",
  ],

  donts: [
    "Do not use a toggle when a checkbox with a Save button is more appropriate",
    "Do not use a toggle for multi-option choices — use radio buttons or a select instead",
    "Do not place the toggle inside a scrollable container where drag conflicts with scroll",
    "Do not remove the label — a standalone toggle without text is not self-explanatory",
    "Do not change the toggle's semantics to behave like a button that triggers navigation",
  ],
};
