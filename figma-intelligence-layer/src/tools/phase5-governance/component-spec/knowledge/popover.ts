/**
 * popover.ts — Gold-standard design knowledge for Popover components
 */
import type { ComponentKnowledge } from "../types.js";

export const popoverKnowledge: ComponentKnowledge = {
  description:
    "Interactive floating panel | Triggered by click | Displays rich content in context",

  stateSpecifications: [
    {
      state: "Closed",
      visualChange: "Popover panel is not rendered or is hidden; trigger element appears in its default state",
      opacity: "0",
      cursorWeb: "pointer",
      usage: "Default resting state — popover content is not visible to the user",
    },
    {
      state: "Open",
      visualChange: "Floating panel appears adjacent to the trigger with optional arrow; background overlay may dim surrounding content",
      opacity: "1",
      cursorWeb: "default",
      usage: "User has clicked the trigger and the popover content is displayed for interaction",
    },
    {
      state: "Opening (Animating In)",
      visualChange: "Panel fades in and scales from 95% to 100% over the transition duration; origin matches placement direction",
      opacity: "0 → 1",
      cursorWeb: "default",
      usage: "Transition state between closed and fully open — content becomes visible progressively",
    },
    {
      state: "Closing (Animating Out)",
      visualChange: "Panel fades out and scales from 100% to 95% over the transition duration; pointer-events disabled during animation",
      opacity: "1 → 0",
      cursorWeb: "default",
      usage: "Transition state between open and fully closed — content is being dismissed",
    },
    {
      state: "Focus Within",
      visualChange: "Focus ring appears on the currently focused interactive element inside the popover panel",
      opacity: "1",
      cursorWeb: "default",
      usage: "Keyboard user is navigating interactive content within the popover",
    },
    {
      state: "Trigger Focused",
      visualChange: "2px focus ring offset by 2px from the trigger element edge, using $focus-ring token",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Trigger element receives keyboard focus via Tab; popover does not open on focus alone",
    },
  ],

  propertyDescriptions: {
    trigger: "The element that, when clicked, opens the popover panel; can be a button, icon button, or any interactive element",
    placement: "Preferred position of the popover relative to its trigger — top, bottom, left, right, or auto (flips to avoid viewport clipping)",
    hasArrow: "When true renders a triangular arrow/caret connecting the popover panel to its trigger element for visual association",
    offset: "Distance in pixels between the trigger element and the popover panel edge; default is 8px",
    closeOnClickOutside: "When true the popover dismisses if the user clicks anywhere outside the panel boundaries; default is true",
    closeOnEscape: "When true pressing the Escape key dismisses the popover and returns focus to the trigger; default is true",
    isOpen: "Controlled open state — when provided the component operates in controlled mode and ignores internal toggle logic",
    onOpenChange: "Callback fired when the popover opens or closes; receives the new boolean open state as its argument",
    initialFocus: "Ref or selector for the element that receives focus when the popover opens; defaults to the first focusable element",
    returnFocusOnClose: "When true focus returns to the trigger element after the popover is dismissed; default is true",
    trapFocus: "When true keyboard focus is trapped within the popover panel, preventing Tab from leaving until dismissed",
    role: "ARIA role applied to the popover panel — typically 'dialog' for interactive content; defaults to 'dialog'",
  },

  sizeSpecifications: [
    {
      size: "Small",
      height: "auto (min 80px)",
      paddingLR: "12px",
      fontSize: "12px",
      iconSize: "16px",
      borderRadius: "8px",
    },
    {
      size: "Medium",
      height: "auto (min 120px)",
      paddingLR: "16px",
      fontSize: "14px",
      iconSize: "20px",
      borderRadius: "10px",
    },
    {
      size: "Large",
      height: "auto (min 160px)",
      paddingLR: "20px",
      fontSize: "16px",
      iconSize: "24px",
      borderRadius: "12px",
    },
  ],

  designTokenBindings: [
    {
      property: "Background",
      tokenName: "$popover-bg",
      role: "Panel surface color — elevated above the page surface",
      fallback: "#FFFFFF",
    },
    {
      property: "Border",
      tokenName: "$popover-border",
      role: "Subtle border separating popover from surrounding content",
      fallback: "#E5E7EB",
    },
    {
      property: "Shadow",
      tokenName: "$shadow-popover",
      role: "Elevation shadow giving the popover a floating appearance",
      fallback: "0 4px 16px rgba(0,0,0,0.12)",
    },
    {
      property: "Arrow Fill",
      tokenName: "$popover-arrow-bg",
      role: "Arrow/caret fill matching the panel background",
      fallback: "#FFFFFF",
    },
    {
      property: "Arrow Border",
      tokenName: "$popover-arrow-border",
      role: "Arrow border matching the panel border for visual continuity",
      fallback: "#E5E7EB",
    },
    {
      property: "Text Color",
      tokenName: "$popover-text",
      role: "Default text color for content within the popover panel",
      fallback: "#1F2937",
    },
    {
      property: "Overlay",
      tokenName: "$overlay-light",
      role: "Optional backdrop overlay behind the popover for modal-like behavior",
      fallback: "rgba(0,0,0,0.05)",
    },
    {
      property: "Radius",
      tokenName: "$radius-popover",
      role: "Corner rounding applied to the floating panel",
      fallback: "10px",
    },
    {
      property: "Transition",
      tokenName: "$transition-popover",
      role: "Entry and exit animation timing for the floating panel",
      fallback: "200ms ease-out",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Keyboard focus indicator ring for interactive elements inside the popover",
      fallback: "0 0 0 2px #FFFFFF, 0 0 0 4px #2E90FA",
    },
    {
      property: "Z-Index",
      tokenName: "$z-popover",
      role: "Stacking context for the floating panel above page content",
      fallback: "1000",
    },
  ],

  structureRules: [
    "Popover consists of a trigger slot and a floating panel — trigger is inline, panel is portaled to the body",
    "Panel uses vertical Auto Layout with top alignment and content wrapping",
    "Arrow element is absolutely positioned relative to the panel edge closest to the trigger",
    "Panel is positioned using a floating-UI library (Floating UI or Popper.js) for collision-aware placement",
    "Content area supports arbitrary children: text, form fields, buttons, lists, or custom components",
    "Maximum height is constrained to viewport height minus offset; overflow-y auto enables scrolling for tall content",
    "Panel width defaults to the size preset but can be overridden by content; max-width is capped at 90vw on mobile",
    "Popover is rendered via a portal to avoid clipping by parent overflow or stacking context issues",
  ],

  typeHierarchyRules: [
    "Popover headings use font-weight Semi-Bold (600) at the size-appropriate font scale",
    "Body text within the popover uses Regular (400) weight at one step below heading size",
    "Action links or buttons within the popover follow the standard button typography rules",
    "Text uses sentence case throughout — no all-caps except for very short labels (e.g., 'NEW')",
    "Line height within the popover body should be comfortable at 1.5 for readability",
  ],

  interactionRules: [
    { event: "Click Trigger", trigger: "pointerup on trigger element", action: "Toggle popover open/closed state; animate panel in or out" },
    { event: "Click Outside", trigger: "pointerdown outside panel and trigger", action: "Close the popover if closeOnClickOutside is true" },
    { event: "Escape Key", trigger: "Escape key pressed while popover is open", action: "Close the popover and return focus to the trigger element" },
    { event: "Tab Key", trigger: "Tab key pressed within popover", action: "Move focus to next focusable element; if trapFocus is true, cycle within panel" },
    { event: "Shift+Tab", trigger: "Shift+Tab pressed on first focusable element", action: "If trapFocus is true, wrap to last focusable element; otherwise close and focus trigger" },
    { event: "Focus Trigger", trigger: "Tab key focuses the trigger", action: "Show focus ring on trigger; do not open popover (click-only activation)" },
    { event: "Scroll Parent", trigger: "User scrolls the page while popover is open", action: "Reposition popover to maintain alignment; close if trigger scrolls out of view" },
    { event: "Resize Viewport", trigger: "Window resize event", action: "Recalculate placement; flip to opposite side if current placement clips viewport" },
  ],

  contentGuidance: [
    "Popover content should be concise and contextual — avoid placing full forms; use a modal for complex workflows",
    "Include a clear heading if the popover contains more than a single paragraph of text",
    "Provide explicit close affordance (X button or 'Done' action) in addition to click-outside and Escape dismissal",
    "Limit popover content to a single focused task or piece of information — do not stack multiple concerns",
    "Avoid nesting popovers inside popovers; use progressive disclosure with a different pattern if deeper context is needed",
    "Action buttons within the popover should follow the same Do/Don't rules as standalone buttons",
    "Popover is distinct from Tooltip: tooltips are hover-triggered, non-interactive, and text-only; popovers are click-triggered and interactive",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Popover may convert to a bottom sheet or full-width panel anchored to the bottom of the viewport" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Standard floating popover with auto placement; max-width constrained to 90% of viewport" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Floating popover positioned relative to trigger with standard offset and arrow" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Popover size remains capped at large preset — does not scale with viewport width" },
  ],

  accessibilitySpec: {
    intro:
      "Popovers contain interactive content and must implement a full dialog-like accessibility pattern with focus management and keyboard dismissal.",
    requirements: [
      { requirement: "ARIA Role", level: "A", notes: "Trigger uses aria-haspopup='dialog'; panel uses role='dialog' for interactive content" },
      { requirement: "ARIA Expanded", level: "A", notes: "Trigger must set aria-expanded='true' when popover is open, 'false' when closed" },
      { requirement: "ARIA Controls", level: "A", notes: "Trigger must reference the popover panel id via aria-controls attribute" },
      { requirement: "Focus Management", level: "A", notes: "Focus moves to the first focusable element inside the popover when it opens" },
      { requirement: "Focus Trap", level: "A", notes: "Tab and Shift+Tab must cycle within the popover when trapFocus is enabled" },
      { requirement: "Return Focus", level: "A", notes: "When the popover closes, focus must return to the trigger element that opened it" },
      { requirement: "Escape Dismissal", level: "A", notes: "Pressing Escape must close the popover from any focus position within the panel" },
      { requirement: "Contrast Ratio", level: "AA", notes: "All text within the popover must meet 4.5:1 contrast against the panel background" },
      { requirement: "Touch Target", level: "AA", notes: "Trigger and interactive elements inside the popover must have 44x44px minimum touch area" },
      { requirement: "Screen Reader Announcement", level: "A", notes: "Opening the popover should announce the dialog label to screen readers via aria-labelledby" },
    ],
    outro: [
      "Ensure that the popover does not trap keyboard users if trapFocus is disabled — Tab should exit gracefully and close the popover",
      "Test with VoiceOver, NVDA, and JAWS to verify that the popover is announced as a dialog and dismissal is communicated",
      "Avoid auto-opening popovers on page load as they disrupt screen reader navigation flow",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Open on Click", platform: "Web", expectedResult: "Popover panel appears on trigger click with correct placement relative to trigger" },
    { check: "Close on Click Outside", platform: "Web", expectedResult: "Popover dismisses when clicking outside the panel boundaries" },
    { check: "Close on Escape", platform: "Web", expectedResult: "Popover dismisses when Escape is pressed; focus returns to trigger" },
    { check: "Focus Trap", platform: "Web", expectedResult: "Tab cycles through focusable elements within the popover without escaping" },
    { check: "Arrow Rendering", platform: "Web", expectedResult: "Arrow points toward the trigger and repositions with placement changes" },
    { check: "Viewport Collision", platform: "Web", expectedResult: "Popover flips to opposite placement when it would clip the viewport edge" },
    { check: "Animation", platform: "Web", expectedResult: "Smooth fade-in/scale-up on open; fade-out/scale-down on close; no layout shift" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces role='dialog', accessible name, and content on open" },
    { check: "Keyboard Navigation", platform: "Web", expectedResult: "Tab moves through interactive elements inside the popover in DOM order" },
    { check: "Nested Scrolling", platform: "Web", expectedResult: "Long popover content scrolls within the panel; page scroll is optionally locked" },
    { check: "RTL Support", platform: "Web", expectedResult: "Placement and arrow mirror correctly in RTL locales; left becomes right" },
    { check: "Mobile Adaptation", platform: "Mobile", expectedResult: "Converts to bottom sheet on viewports below 768px with swipe-to-dismiss" },
    { check: "Contrast", platform: "All", expectedResult: "All text and interactive elements pass 4.5:1 contrast against panel background" },
  ],

  dos: [
    "Use popovers for contextual information or small interactive tasks tied to a specific trigger",
    "Always provide an explicit close button inside the popover for touch and accessibility users",
    "Ensure focus moves into the popover on open and returns to the trigger on close",
    "Use the arrow indicator to clearly associate the popover with its trigger element",
    "Keep popover content focused on a single task — avoid cramming multiple unrelated actions",
    "Use the auto placement option to handle edge cases where the preferred side clips the viewport",
    "Match popover background and border tokens to the rest of the design system for visual consistency",
  ],

  donts: [
    "Do not use a popover for simple text hints — use a Tooltip instead (hover-triggered, non-interactive)",
    "Do not nest popovers inside other popovers — escalate to a modal for deeper context",
    "Do not open popovers on hover — hover-triggered floating panels should use the Tooltip pattern",
    "Do not place full multi-step forms inside a popover — use a modal or dedicated page instead",
    "Do not auto-open a popover on page load without user action — this disrupts focus and screen readers",
    "Do not remove Escape key dismissal — it is a WCAG requirement for dialog-like floating content",
    "Do not allow the popover to be clipped by parent containers — always render via a portal",
  ],
};
