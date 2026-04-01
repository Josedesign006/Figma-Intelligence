/**
 * banner.ts — Gold-standard design knowledge for Banner components
 */
import type { ComponentKnowledge } from "../types.js";

export const bannerKnowledge: ComponentKnowledge = {
  description:
    "Full-width persistent notification bar | Communicates system-level messages | Pinned to top, bottom, or inline position",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Banner displays at full width with type-specific background color, icon, message text, and optional action/dismiss controls",
      opacity: "1",
      cursorWeb: "default",
      usage: "Active state — the banner is visible and conveying information, success, warning, or error to the user",
    },
    {
      state: "Hover (Action)",
      visualChange: "Action link or button within the banner transitions to its hover state — underline or background change",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Mouse cursor enters the inline action element within the banner",
    },
    {
      state: "Hover (Dismiss)",
      visualChange: "Dismiss (X) button background darkens one step; icon color may intensify",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Mouse cursor enters the dismiss button — signals the banner can be closed",
    },
    {
      state: "Focus (Action)",
      visualChange: "Action element receives a 2px focus ring using $focus-ring token; high contrast against banner background",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Action link or button receives keyboard focus via Tab key",
    },
    {
      state: "Focus (Dismiss)",
      visualChange: "Dismiss button receives a 2px focus ring offset by 2px from its edge",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Dismiss button receives keyboard focus via Tab key",
    },
    {
      state: "Dismissed",
      visualChange: "Banner slides out or fades to opacity 0; container collapses to height 0 and is removed from the layout flow",
      opacity: "0",
      cursorWeb: "default",
      usage: "User has dismissed the banner — it is no longer visible and should not occupy layout space",
    },
    {
      state: "Entering",
      visualChange: "Banner slides in from the top/bottom edge or fades in; height animates from 0 to full height",
      opacity: "0 → 1",
      cursorWeb: "default",
      usage: "Banner is appearing for the first time — entry animation provides smooth visual transition",
    },
  ],

  propertyDescriptions: {
    type: "Semantic variant controlling the color scheme and leading icon — info (blue), success (green), warning (amber), error (red)",
    message: "Primary text content of the banner — should be concise and actionable, typically one sentence",
    dismissible: "When true a close (X) button is rendered allowing the user to dismiss the banner; default is true for info, false for error",
    action: "Optional inline action rendered as a text button or link — e.g., 'Learn more', 'Upgrade now', 'Retry'",
    onDismiss: "Callback fired when the dismiss button is clicked; parent component manages whether the banner re-appears",
    onAction: "Callback fired when the inline action is clicked; typically navigates or triggers a remediation flow",
    position: "Layout position of the banner — 'top' (pinned to viewport top), 'bottom' (pinned to viewport bottom), 'inline' (flows with content)",
    icon: "Leading icon rendered before the message text — defaults to a type-appropriate icon (info circle, check circle, warning triangle, error circle)",
    persistent: "When true the banner cannot be dismissed and the dismiss button is hidden; used for critical system messages",
    fullWidth: "When true the banner spans the full viewport width regardless of parent container constraints; default for top/bottom positions",
    role: "ARIA role — 'alert' for urgent messages (error, warning), 'status' for informational messages (info, success)",
  },

  sizeSpecifications: [
    {
      size: "Compact",
      height: "40px",
      paddingLR: "16px",
      fontSize: "12px",
      iconSize: "16px",
      borderRadius: "0px",
    },
    {
      size: "Default",
      height: "48px",
      paddingLR: "20px",
      fontSize: "14px",
      iconSize: "20px",
      borderRadius: "0px",
    },
    {
      size: "Large",
      height: "56px",
      paddingLR: "24px",
      fontSize: "16px",
      iconSize: "24px",
      borderRadius: "0px",
    },
  ],

  designTokenBindings: [
    {
      property: "Info Background",
      tokenName: "$banner-info-bg",
      role: "Background fill for the informational banner variant",
      fallback: "#EFF6FF",
    },
    {
      property: "Info Text",
      tokenName: "$banner-info-text",
      role: "Text color for the informational banner message and icon",
      fallback: "#1E40AF",
    },
    {
      property: "Info Border",
      tokenName: "$banner-info-border",
      role: "Bottom border accent for the informational banner",
      fallback: "#93C5FD",
    },
    {
      property: "Success Background",
      tokenName: "$banner-success-bg",
      role: "Background fill for the success banner variant",
      fallback: "#F0FDF4",
    },
    {
      property: "Success Text",
      tokenName: "$banner-success-text",
      role: "Text color for the success banner message and icon",
      fallback: "#166534",
    },
    {
      property: "Warning Background",
      tokenName: "$banner-warning-bg",
      role: "Background fill for the warning banner variant",
      fallback: "#FFFBEB",
    },
    {
      property: "Warning Text",
      tokenName: "$banner-warning-text",
      role: "Text color for the warning banner message and icon",
      fallback: "#92400E",
    },
    {
      property: "Error Background",
      tokenName: "$banner-error-bg",
      role: "Background fill for the error/critical banner variant",
      fallback: "#FEF2F2",
    },
    {
      property: "Error Text",
      tokenName: "$banner-error-text",
      role: "Text color for the error banner message and icon",
      fallback: "#991B1B",
    },
    {
      property: "Dismiss Icon",
      tokenName: "$banner-dismiss-icon",
      role: "Color of the dismiss (X) button icon — slightly muted relative to the message text",
      fallback: "#6B7280",
    },
    {
      property: "Action Text",
      tokenName: "$banner-action-text",
      role: "Color of the inline action link/button — typically underlined and slightly bolder than message text",
      fallback: "#1D4ED8",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Keyboard focus indicator ring for action and dismiss buttons within the banner",
      fallback: "0 0 0 2px #FFFFFF, 0 0 0 4px #2E90FA",
    },
    {
      property: "Transition",
      tokenName: "$transition-banner",
      role: "Entry and exit animation timing for banner appearance and dismissal",
      fallback: "300ms ease-in-out",
    },
  ],

  structureRules: [
    "Banner uses horizontal Auto Layout with vertical center alignment — icon, message, spacer, action, dismiss in a single row",
    "Leading icon is fixed-size and vertically centered; it inherits the type-specific text color token",
    "Message text fills the remaining horizontal space with text-overflow: ellipsis for single-line overflow",
    "Action element is rendered as an inline text button or link after the message, separated by $spacing-md",
    "Dismiss button is the rightmost element — a small icon-only button with the X/close icon",
    "For top/bottom positions, the banner is fixed to the viewport edge and uses full viewport width",
    "Inline position renders the banner within the document flow — it pushes content below it down",
    "Banner has no border-radius by default (full-width edge-to-edge); inline variant may use small radius (4px)",
    "Multiple banners stack vertically with no gap between them — they appear as a unified notification area",
  ],

  typeHierarchyRules: [
    "Message text uses font-weight Regular (400) at the size-appropriate body scale",
    "Action text uses font-weight Medium (500) with underline decoration for link-style affordance",
    "Text uses sentence case — 'System maintenance scheduled', not 'System Maintenance Scheduled'",
    "Single-line only — message text must not wrap; truncate with ellipsis if it exceeds available width",
    "On mobile, message may wrap to two lines maximum; action moves below the message if space is tight",
  ],

  interactionRules: [
    { event: "Click Dismiss", trigger: "pointerup on dismiss (X) button", action: "Fire onDismiss callback; animate banner out; remove from layout flow" },
    { event: "Click Action", trigger: "pointerup on inline action button/link", action: "Fire onAction callback; banner may remain visible or dismiss depending on implementation" },
    { event: "Hover Dismiss", trigger: "pointerenter on dismiss button", action: "Darken dismiss button background; show pointer cursor" },
    { event: "Hover Action", trigger: "pointerenter on action element", action: "Show underline or darken action text for link-style hover feedback" },
    { event: "Focus Dismiss", trigger: "Tab key focuses dismiss button", action: "Show focus ring on dismiss button; announce 'Close' or 'Dismiss banner'" },
    { event: "Focus Action", trigger: "Tab key focuses action element", action: "Show focus ring on action; announce the action label" },
    { event: "Enter / Space", trigger: "Enter or Space on focused dismiss or action", action: "Fire the same handler as a click on that element" },
    { event: "Auto-Dismiss Timer", trigger: "Optional timer expires for non-critical banners", action: "Banner auto-dismisses with exit animation; never auto-dismiss error banners" },
    { event: "Page Scroll", trigger: "User scrolls the page with a top/bottom-fixed banner", action: "Banner remains fixed in its viewport position; content scrolls behind it" },
  ],

  contentGuidance: [
    "Banner messages should be one concise sentence — get to the point immediately",
    "Include an action when the user can do something about the message — 'Upgrade now', 'View details', 'Retry'",
    "Use the appropriate type for the message severity — info for neutral updates, warning for potential issues, error for failures",
    "Banner is distinct from Alert: banners are full-width and pinned to an edge; alerts are inline content-level components",
    "Do not use banners for transient success feedback — use a Toast for ephemeral notifications",
    "Error banners should not be dismissible unless the user can take an action to resolve the issue",
    "System maintenance or downtime announcements are ideal use cases for persistent info banners",
    "Warning banners should clearly state the consequence of inaction — 'Your trial expires in 3 days' is better than 'Trial ending soon'",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Message text may wrap to two lines; action moves below message; dismiss button remains in top-right corner; min-height increases to accommodate wrapping" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Single-line layout with message, action, and dismiss in one row; standard padding" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Full-width banner with ample horizontal space; all elements in a single row" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Banner content may be constrained to a max-width container centered within the full-width background" },
  ],

  accessibilitySpec: {
    intro:
      "Banners are system-level notifications that must be announced to assistive technologies appropriately based on their urgency level. Error and warning banners use role='alert' for assertive announcement; info and success use role='status' for polite announcement.",
    requirements: [
      { requirement: "ARIA Role", level: "A", notes: "Use role='alert' for error/warning banners (assertive); role='status' for info/success banners (polite)" },
      { requirement: "ARIA Live", level: "A", notes: "role='alert' implies aria-live='assertive'; role='status' implies aria-live='polite' — do not duplicate" },
      { requirement: "Dismiss Button Label", level: "A", notes: "Dismiss button must have aria-label='Dismiss banner' or 'Close notification' — the X icon alone is not sufficient" },
      { requirement: "Focus Management", level: "A", notes: "After dismissal, focus should move to the next logical element — not get lost in the DOM" },
      { requirement: "Keyboard Accessible", level: "A", notes: "Action and dismiss buttons must be reachable via Tab and activatable with Enter/Space" },
      { requirement: "Contrast Ratio", level: "AA", notes: "Message text must meet 4.5:1 contrast against the type-specific background; icon must meet 3:1 non-text contrast" },
      { requirement: "Touch Target", level: "AA", notes: "Dismiss button and action must have 44x44px minimum touch area" },
      { requirement: "No Auto-Dismiss for Errors", level: "A", notes: "Error banners must never auto-dismiss — users need time to read and act on critical information" },
      { requirement: "Content Shift", level: "AA", notes: "Banner entry/exit must not cause unexpected content shift — use smooth height animation" },
      { requirement: "Motion Preference", level: "AAA", notes: "Entry/exit animations must respect prefers-reduced-motion; fall back to instant show/hide" },
    ],
    outro: [
      "Test with screen readers to verify that role='alert' banners interrupt the current announcement and role='status' banners wait for a pause",
      "Ensure that multiple stacked banners are announced in a logical order — newest first or most critical first",
      "Verify that focus is not trapped on the banner — Tab must be able to move past it to page content",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Type Variants", platform: "All", expectedResult: "Info (blue), success (green), warning (amber), error (red) render with correct colors and icons" },
    { check: "Dismiss Button", platform: "Web", expectedResult: "Clicking X dismisses the banner with exit animation; fires onDismiss callback" },
    { check: "Action Button", platform: "Web", expectedResult: "Clicking action fires onAction callback; action shows hover/focus states" },
    { check: "Persistent Mode", platform: "All", expectedResult: "When persistent is true, dismiss button is hidden and banner cannot be closed" },
    { check: "Position Top", platform: "Web", expectedResult: "Banner is fixed to viewport top; content scrolls behind it; no overlap with content" },
    { check: "Position Bottom", platform: "Web", expectedResult: "Banner is fixed to viewport bottom; content scrolls behind it" },
    { check: "Position Inline", platform: "Web", expectedResult: "Banner renders in document flow; pushes content below it down" },
    { check: "Keyboard Navigation", platform: "Web", expectedResult: "Tab focuses action then dismiss; Enter/Space activates both; focus ring visible" },
    { check: "Screen Reader (Alert)", platform: "Web", expectedResult: "Error/warning banners interrupt current announcement via role='alert'" },
    { check: "Screen Reader (Status)", platform: "Web", expectedResult: "Info/success banners announced politely via role='status'" },
    { check: "Entry Animation", platform: "Web", expectedResult: "Banner slides/fades in smoothly; no layout jump; respects reduced-motion preference" },
    { check: "Exit Animation", platform: "Web", expectedResult: "Banner slides/fades out; container collapses height; no orphaned whitespace" },
    { check: "Contrast", platform: "All", expectedResult: "All text meets 4.5:1 contrast against the type-specific background fill" },
    { check: "RTL Support", platform: "Web", expectedResult: "Icon moves to right; dismiss button moves to left; text alignment mirrors" },
    { check: "Stacked Banners", platform: "Web", expectedResult: "Multiple banners stack vertically with no gap; each individually dismissible" },
  ],

  dos: [
    "Use banners for system-level messages that apply to the entire page or application context",
    "Choose the correct type (info/success/warning/error) based on the message severity",
    "Provide an inline action when the user can take steps to address the message",
    "Use role='alert' for urgent messages (error, warning) and role='status' for informational ones",
    "Make error banners persistent — they should not auto-dismiss or be easily closed without resolution",
    "Keep banner messages to one sentence — be concise and direct about what happened and what to do",
    "Ensure smooth entry/exit animations that do not cause unexpected content shift",
  ],

  donts: [
    "Do not use banners for transient success feedback — use a Toast for ephemeral notifications instead",
    "Do not auto-dismiss error or warning banners — users need time to read and act on critical information",
    "Do not stack more than 3 banners simultaneously — consolidate messages or use a notification center",
    "Do not use banners for in-context validation messages — use inline form errors or Alert components",
    "Do not place banners inside cards, modals, or other contained components — banners are page-level elements",
    "Do not remove the leading icon — it provides an essential visual cue about the message severity",
    "Do not use the same banner type for all messages — differentiate severity with appropriate color coding",
  ],
};
