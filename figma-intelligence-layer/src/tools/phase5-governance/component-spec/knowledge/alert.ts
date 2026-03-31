/**
 * alert.ts — Gold-standard design knowledge for Alert components
 */
import type { ComponentKnowledge } from "../types.js";

export const alertKnowledge: ComponentKnowledge = {
  description:
    "Status notification | Inline feedback message | Contextual information banner",

  stateSpecifications: [
    {
      state: "Info",
      visualChange: "Blue-tinted background with info circle icon; neutral informational tone",
      opacity: "1",
      cursorWeb: "default",
      usage: "General information or tips that do not require immediate action",
    },
    {
      state: "Success",
      visualChange: "Green-tinted background with checkmark circle icon; positive confirmation tone",
      opacity: "1",
      cursorWeb: "default",
      usage: "Operation completed successfully — confirms the user's action",
    },
    {
      state: "Warning",
      visualChange: "Yellow/amber-tinted background with triangle exclamation icon; cautionary tone",
      opacity: "1",
      cursorWeb: "default",
      usage: "Potential issue that the user should be aware of but can proceed",
    },
    {
      state: "Error",
      visualChange: "Red-tinted background with circle X icon; urgent negative tone",
      opacity: "1",
      cursorWeb: "default",
      usage: "Critical failure or validation error requiring user attention or correction",
    },
    {
      state: "Dismissing",
      visualChange: "Alert fades out over 200ms and collapses height to 0; surrounding content reflows",
      opacity: "1 → 0",
      cursorWeb: "default",
      usage: "User clicks the dismiss/close button to remove the alert",
    },
    {
      state: "Hover (Dismiss Button)",
      visualChange: "Close icon background shifts to hover token; icon color darkens",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Mouse enters the dismiss button hit area",
    },
  ],

  propertyDescriptions: {
    severity: "Visual tone and icon selection — info, success, warning, or error — controls background tint and icon",
    title: "Optional bold heading text displayed above the description for quick scanning",
    description: "Body text explaining the alert message in detail; supports plain text or rich content",
    dismissible: "When true, a close button appears allowing the user to remove the alert from view",
    icon: "Severity-specific icon rendered at the leading edge; auto-selected by severity or overridden manually",
    action: "Optional action button or link rendered at the trailing edge or below the description",
    onDismiss: "Callback fired when the dismiss button is clicked; used to remove the alert from state",
  },

  sizeSpecifications: [
    {
      size: "Compact",
      height: "40px",
      paddingLR: "12px",
      fontSize: "13px",
      iconSize: "16px",
      borderRadius: "6px",
    },
    {
      size: "Standard",
      height: "auto",
      paddingLR: "16px",
      fontSize: "14px",
      iconSize: "20px",
      borderRadius: "8px",
    },
    {
      size: "Large",
      height: "auto",
      paddingLR: "20px",
      fontSize: "14px",
      iconSize: "24px",
      borderRadius: "10px",
    },
  ],

  designTokenBindings: [
    {
      property: "Info Background",
      tokenName: "$alert-info-bg",
      role: "Light blue tinted background for informational alerts",
      fallback: "#EFF8FF",
    },
    {
      property: "Success Background",
      tokenName: "$alert-success-bg",
      role: "Light green tinted background for success alerts",
      fallback: "#ECFDF3",
    },
    {
      property: "Warning Background",
      tokenName: "$alert-warning-bg",
      role: "Light amber tinted background for warning alerts",
      fallback: "#FFFAEB",
    },
    {
      property: "Error Background",
      tokenName: "$alert-error-bg",
      role: "Light red tinted background for error alerts",
      fallback: "#FEF3F2",
    },
    {
      property: "Border",
      tokenName: "$alert-border",
      role: "Left accent border or full border matching severity color at medium intensity",
      fallback: "currentColor at 40% opacity",
    },
    {
      property: "Title Text",
      tokenName: "$alert-title-text",
      role: "Heading text color — darker shade of the severity color for hierarchy",
      fallback: "#101828",
    },
    {
      property: "Icon Color",
      tokenName: "$alert-icon",
      role: "Severity icon fill color — matches the severity's primary color",
      fallback: "severity-dependent",
    },
  ],

  structureRules: [
    "Container uses horizontal Auto Layout: icon on the left, content area fills, dismiss button on the right",
    "Content area uses vertical Auto Layout: title (optional) above description, with $spacing-xs gap",
    "A 3-4px accent border on the left edge (or full border) uses the severity color at medium intensity",
    "Icon is vertically aligned to the first line of text, not centered to the full container height",
    "Dismiss button is a small icon button (16-20px) positioned in the top-right corner of the container",
    "Action buttons or links are placed below the description with $spacing-sm top margin",
    "Alert container fills the available width of its parent — never fixed width",
  ],

  typeHierarchyRules: [
    "Title uses Semi-Bold (600) at the same font-size as description for emphasis without size change",
    "Description uses Regular weight (400) at the component's base font-size",
    "Action link text uses Medium weight (500) with underline on hover",
    "Text uses sentence case throughout — no all-caps severity labels",
    "Title and description can be combined on a single line for compact alerts",
    "Line height is 1.5 for comfortable reading of multi-line descriptions",
  ],

  interactionRules: [
    { event: "Dismiss Click", trigger: "pointerup on close button", action: "Fire onDismiss callback; animate alert out with fade and height collapse" },
    { event: "Action Click", trigger: "pointerup on action button/link", action: "Fire the action handler; alert may remain or dismiss based on context" },
    { event: "Focus Dismiss", trigger: "Tab key to close button", action: "Show focus ring on dismiss button" },
    { event: "Keydown Enter", trigger: "Enter on focused dismiss button", action: "Dismiss alert (same as click)" },
    { event: "Keydown Escape", trigger: "Escape while alert or its children are focused", action: "Dismiss alert if dismissible; otherwise no action" },
    { event: "Auto-Dismiss", trigger: "Timer expires (if configured)", action: "Fade out and remove alert after specified duration (e.g., 5000ms)" },
    { event: "Hover Dismiss", trigger: "pointerenter on close button", action: "Show hover state on the dismiss icon button" },
  ],

  contentGuidance: [
    "Write clear, actionable alert messages — tell users what happened and what to do next",
    "Use the title for a concise summary (3-8 words) and the description for details",
    "Match severity to the actual urgency: info for tips, success for confirmations, warning for caution, error for failures",
    "Include an action button or link when the user can take a specific corrective step",
    "Avoid stacking more than 2-3 alerts simultaneously — prioritize the most important message",
    "Error alerts should explain the cause and suggest a resolution, not just state the failure",
    "Do not use alerts for marketing or promotional content — use banners instead",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Alert fills full width; action button stacks below description; dismiss button touch target 44px" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Alert spans container width; inline action button if space allows" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Standard layout with icon, content, and dismiss button in a single row" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Alert max-width may be capped by parent container; does not stretch infinitely" },
  ],

  accessibilitySpec: {
    intro:
      "Alerts must communicate their severity and content to assistive technology. Persistent alerts use role='alert'; status updates use role='status'.",
    requirements: [
      { requirement: "role='alert'", level: "A", notes: "Error and warning alerts use role='alert' to trigger assertive announcements by screen readers" },
      { requirement: "role='status'", level: "A", notes: "Info and success alerts use role='status' for polite announcements that do not interrupt" },
      { requirement: "aria-live", level: "A", notes: "Dynamically injected alerts must use aria-live='assertive' (errors) or 'polite' (info/success)" },
      { requirement: "Icon + Text", level: "A", notes: "Severity must be conveyed by both color AND icon/text — never by color alone" },
      { requirement: "Dismiss Label", level: "A", notes: "Close button must have aria-label='Dismiss' or 'Close alert' for screen readers" },
      { requirement: "Contrast", level: "AA", notes: "Text-to-background: 4.5:1; icon and border to background: 3:1 for each severity" },
      { requirement: "Focus Management", level: "AA", notes: "After dismissal, focus moves to a logical next element — not lost in the void" },
    ],
    outro: [
      "Screen readers should announce severity, title, and description when the alert appears",
      "Auto-dismissing alerts must remain visible long enough for screen reader users to hear the full message",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Severity Variants", platform: "All", expectedResult: "Each severity (info, success, warning, error) renders correct background, icon, and border color" },
    { check: "Dismiss Animation", platform: "Web", expectedResult: "Alert fades out over 200ms and collapses height; surrounding content reflows smoothly" },
    { check: "Dismiss Focus", platform: "Web", expectedResult: "After dismissal, focus moves to the next focusable element in the DOM" },
    { check: "Action Button", platform: "All", expectedResult: "Action button renders inline or below description; fires handler on click" },
    { check: "Icon Alignment", platform: "All", expectedResult: "Severity icon aligns to the first line of text, not vertically centered" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces severity and message via role='alert' or role='status' appropriately" },
    { check: "Keyboard Navigation", platform: "Web", expectedResult: "Tab reaches dismiss button and action link; Enter activates them" },
    { check: "Auto-Dismiss", platform: "Web", expectedResult: "When configured, alert disappears after timeout; mouse hover pauses the timer" },
    { check: "Title + Description", platform: "All", expectedResult: "Title renders bold above description; omitting title still renders correctly" },
    { check: "Full Width", platform: "All", expectedResult: "Alert spans the full width of its container without horizontal overflow" },
    { check: "Contrast per Severity", platform: "All", expectedResult: "All four severity variants pass 4.5:1 text and 3:1 non-text contrast" },
  ],

  dos: [
    "Use the appropriate severity level that matches the actual urgency of the message",
    "Include a specific icon for each severity to reinforce the meaning beyond color alone",
    "Write actionable descriptions that tell users what happened and what to do next",
    "Allow users to dismiss non-critical alerts (info, success) with a close button",
    "Keep error alerts persistent until the underlying issue is resolved",
    "Place alerts near the relevant content or at the top of the page for global messages",
    "Use a left accent border to reinforce the severity color and visual grouping",
  ],

  donts: [
    "Do not use color alone to communicate severity — always pair with an icon and text",
    "Do not stack more than 3 alerts at once — consolidate or prioritize messages",
    "Do not auto-dismiss error alerts — they require user attention and action",
    "Do not use alerts for lengthy content — keep messages under 3 sentences",
    "Do not place alerts inside other alerts or inside modals unless contextually appropriate",
    "Do not use warning severity for informational messages — match the tone to the content",
    "Do not remove the alert from the DOM without an exit animation — sudden disappearance is jarring",
  ],
};
