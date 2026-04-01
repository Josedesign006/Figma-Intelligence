/**
 * spinner.ts — Gold-standard design knowledge for Spinner / Loader components
 */
import type { ComponentKnowledge } from "../types.js";

export const spinnerKnowledge: ComponentKnowledge = {
  description:
    "Indeterminate loading indicator | Circular progress spinner | Asynchronous status feedback",

  stateSpecifications: [
    {
      state: "Active",
      visualChange: "Circular track visible with animated indicator arc rotating continuously at a steady cadence",
      opacity: "1",
      cursorWeb: "default",
      usage: "An asynchronous operation is in progress — data is loading, processing, or being fetched",
    },
    {
      state: "Complete",
      visualChange: "Indicator arc fills to 100% and transitions into a checkmark icon over 300ms; optional success color shift",
      opacity: "1",
      cursorWeb: "default",
      usage: "The asynchronous operation has finished successfully; provides completion feedback before the spinner is removed",
    },
    {
      state: "Overlay",
      visualChange: "Semi-transparent backdrop covers the parent container or viewport; spinner is centered on the backdrop",
      opacity: "1",
      cursorWeb: "wait",
      usage: "Blocking loading state — prevents interaction with underlying content while the operation completes",
    },
    {
      state: "Inline",
      visualChange: "Small spinner renders inline with text or within a button; no backdrop or blocking behavior",
      opacity: "1",
      cursorWeb: "default",
      usage: "Lightweight loading indicator within a component (e.g., inside a button or adjacent to a label)",
    },
    {
      state: "Hidden",
      visualChange: "Spinner is removed from the DOM or set to display:none; aria-busy removed from parent",
      opacity: "0",
      cursorWeb: "default",
      usage: "Loading is complete and the spinner is no longer needed; content is now fully rendered",
    },
  ],

  propertyDescriptions: {
    size: "Dimensional preset controlling the spinner diameter and stroke width (Extra Small, Small, Medium, Large, Extra Large)",
    label: "Screen-reader-only text describing the loading context (e.g., 'Loading search results'); visually hidden but announced by assistive technology",
    overlay: "When true, renders a semi-transparent backdrop behind the spinner that blocks interaction with underlying content",
    color: "Color variant for the indicator arc — primary (default brand color), inverse (for dark backgrounds), or inherit (matches parent text color)",
  },

  sizeSpecifications: [
    {
      size: "Extra Small",
      height: "16px",
      paddingLR: "0px",
      fontSize: "N/A",
      iconSize: "16px",
      borderRadius: "0px",
    },
    {
      size: "Small",
      height: "24px",
      paddingLR: "0px",
      fontSize: "N/A",
      iconSize: "24px",
      borderRadius: "0px",
    },
    {
      size: "Medium",
      height: "32px",
      paddingLR: "0px",
      fontSize: "N/A",
      iconSize: "32px",
      borderRadius: "0px",
    },
    {
      size: "Large",
      height: "48px",
      paddingLR: "0px",
      fontSize: "N/A",
      iconSize: "48px",
      borderRadius: "0px",
    },
    {
      size: "Extra Large",
      height: "64px",
      paddingLR: "0px",
      fontSize: "N/A",
      iconSize: "64px",
      borderRadius: "0px",
    },
  ],

  designTokenBindings: [
    {
      property: "Track Color",
      tokenName: "$spinner-track",
      role: "Background circular track visible behind the animated indicator arc",
      fallback: "#E4E7EC",
    },
    {
      property: "Indicator Color",
      tokenName: "$spinner-indicator",
      role: "Animated arc color — the primary visual element of the spinner",
      fallback: "#2563EB",
    },
    {
      property: "Inverse Indicator",
      tokenName: "$spinner-indicator-inverse",
      role: "Indicator color for use on dark or colored backgrounds",
      fallback: "#FFFFFF",
    },
    {
      property: "Overlay Background",
      tokenName: "$spinner-overlay-bg",
      role: "Semi-transparent backdrop color for the overlay variant",
      fallback: "rgba(255,255,255,0.7)",
    },
    {
      property: "Animation Duration",
      tokenName: "$transition-spinner",
      role: "Duration of one full rotation cycle of the indicator arc",
      fallback: "800ms",
    },
    {
      property: "Animation Easing",
      tokenName: "$easing-spinner",
      role: "Easing curve for the rotation animation — linear for steady cadence",
      fallback: "linear",
    },
    {
      property: "Z-Index Overlay",
      tokenName: "$z-spinner-overlay",
      role: "Stacking order for the overlay variant — above content but below modals",
      fallback: "1050",
    },
  ],

  structureRules: [
    "Spinner uses an SVG circle element with stroke-dasharray and stroke-dashoffset for the animated arc, or equivalent CSS animation on a bordered div",
    "Track is a full circle with the $spinner-track color; indicator arc covers approximately 75% of the circumference",
    "Stroke width scales proportionally with spinner size — 2px for xs/sm, 3px for md, 4px for lg/xl",
    "Overlay variant renders a full-coverage backdrop div with flexbox centering for the spinner element",
    "Spinner container has equal width and height (square aspect ratio) with no internal padding",
    "Inline spinners must not alter the line height or layout flow of their parent container",
    "The animation uses CSS @keyframes rotate or SVG animateTransform — no JavaScript interval timers",
  ],

  typeHierarchyRules: [
    "Spinners have no visible text — the label property is screen-reader-only using visually-hidden utility class",
    "When paired with a visible loading message, the message text uses body font size and Regular (400) weight",
    "Visible loading text is centered below the spinner with $spacing-sm (8px) gap",
    "Never display percentage text alongside an indeterminate spinner — use a progress bar for determinate loading",
  ],

  interactionRules: [
    { event: "Appear", trigger: "Loading operation begins", action: "Render spinner with fade-in over 100ms; set aria-busy='true' on parent container" },
    { event: "Disappear", trigger: "Loading operation completes", action: "Fade out over 150ms; remove aria-busy; optionally show completion checkmark for 500ms" },
    { event: "Overlay Block", trigger: "Overlay variant is active", action: "Prevent pointer events on underlying content; set cursor to wait on the backdrop" },
    { event: "Escape (Overlay)", trigger: "Escape key while overlay spinner is visible", action: "Cancel the loading operation if cancellation is supported; otherwise no action" },
    { event: "Reduced Motion", trigger: "prefers-reduced-motion media query matches", action: "Replace rotation animation with a pulsing opacity animation or static indicator" },
    { event: "Long Wait", trigger: "Loading exceeds a configurable timeout threshold", action: "Optionally display a 'Still loading...' message or a cancel/retry action below the spinner" },
  ],

  contentGuidance: [
    "Always provide a descriptive label for screen readers — 'Loading' alone is insufficient; specify what is loading (e.g., 'Loading search results')",
    "Use the smallest spinner size that remains clearly visible in context — xs for inline/button, md for section, xl for full-page",
    "Prefer skeleton screens over spinners for content-heavy layouts where the structure of the content is predictable",
    "Do not display spinners for operations that complete in under 300ms — use a 300ms delay before showing the spinner to avoid flash",
    "When using the overlay variant, ensure the backdrop does not completely obscure critical context the user may need to reference",
    "For long-running operations, pair the spinner with a text message explaining what is happening and estimated wait time",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Full-page spinners use the lg size (48px); inline spinners use xs (16px) or sm (24px); overlay covers the entire viewport" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Section-level spinners use md (32px); page-level spinners use lg (48px); overlay scoped to the loading region" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Standard sizing applies; overlay can be scoped to a panel or the full viewport depending on context" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Spinner sizes remain fixed — no proportional scaling with viewport; xl (64px) reserved for full-page loading" },
  ],

  accessibilitySpec: {
    intro:
      "Spinners are non-interactive but must communicate loading status to assistive technology users who cannot perceive the visual animation.",
    requirements: [
      { requirement: "role='status'", level: "A", notes: "Spinner container must use role='status' to create a live region that announces loading state changes" },
      { requirement: "aria-live='polite'", level: "A", notes: "The live region should use polite priority to avoid interrupting the user's current screen reader output" },
      { requirement: "aria-label", level: "A", notes: "Spinner must have a descriptive aria-label explaining what is loading (e.g., 'Loading user profile')" },
      { requirement: "aria-busy", level: "A", notes: "The parent container being loaded must set aria-busy='true' while loading and remove it on completion" },
      { requirement: "Contrast", level: "AA", notes: "Indicator arc to track must meet 3:1 non-text contrast ratio; indicator to background must also meet 3:1" },
      { requirement: "Reduced Motion", level: "AAA", notes: "Rotation animation must be replaced with a non-motion alternative when prefers-reduced-motion is active" },
      { requirement: "Completion Announcement", level: "A", notes: "When loading completes, the live region must announce completion (e.g., 'Search results loaded')" },
    ],
    outro: [
      "Ensure the spinner does not create a keyboard focus trap — spinners are not focusable elements",
      "Screen readers should announce the loading state once on appearance, not repeatedly during the animation cycle",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Animation Smoothness", platform: "Web", expectedResult: "Spinner rotates at a steady 800ms cycle with no jank or frame drops at 60fps" },
    { check: "Size Variants", platform: "All", expectedResult: "All five sizes (xs/sm/md/lg/xl) render at correct dimensions with proportional stroke width" },
    { check: "Color Variants", platform: "All", expectedResult: "Primary, inverse, and inherit color variants render correct indicator colors" },
    { check: "Overlay Blocking", platform: "Web", expectedResult: "Overlay backdrop prevents clicks on underlying content; cursor shows wait" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces loading state via role='status'; announces completion when spinner is removed" },
    { check: "aria-busy", platform: "Web", expectedResult: "Parent container has aria-busy='true' during loading; attribute removed on completion" },
    { check: "Delay Threshold", platform: "Web", expectedResult: "Spinner does not appear for operations completing in under 300ms — no visual flash" },
    { check: "Reduced Motion", platform: "Web", expectedResult: "Rotation replaced with pulsing opacity or static indicator when prefers-reduced-motion is set" },
    { check: "Inline Layout", platform: "All", expectedResult: "Inline spinner does not alter line height or cause layout shift in the parent container" },
    { check: "Completion Transition", platform: "Web", expectedResult: "Optional checkmark transition plays for 500ms before spinner is removed" },
    { check: "Visual Regression", platform: "All", expectedResult: "Spinner renders pixel-perfect against baseline for each size and color variant" },
    { check: "Dark Mode", platform: "All", expectedResult: "Inverse variant provides sufficient contrast on dark backgrounds; track color adjusts accordingly" },
  ],

  dos: [
    "Always provide a descriptive aria-label specific to the loading context, not just 'Loading'",
    "Use the delay pattern (300ms) before showing the spinner to avoid flash on fast operations",
    "Set aria-busy='true' on the parent container being loaded to inform assistive technology",
    "Use the overlay variant for blocking operations where user interaction must be prevented",
    "Scale the spinner size appropriately for the loading context — inline, section, or page level",
    "Support prefers-reduced-motion by providing a non-rotation animation alternative",
    "Remove the spinner and announce completion to screen readers when loading finishes",
    "Center the spinner both horizontally and vertically within its loading region",
  ],

  donts: [
    "Do not use a spinner for determinate progress — use a progress bar with percentage instead",
    "Do not display the spinner immediately — add a 300ms delay to prevent visual flash on fast operations",
    "Do not leave aria-busy='true' on the parent container after loading completes",
    "Do not use JavaScript setInterval for animation — rely on CSS animations or SVG for smooth rendering",
    "Do not make the spinner focusable or add it to the tab order — it is a presentational status element",
    "Do not use spinners as the only indicator of loading — pair with status text for screen reader users",
    "Do not display percentage text alongside an indeterminate spinner — this creates a misleading experience",
    "Do not override spinner token colors with hard-coded values — use the design token system consistently",
  ],
};
