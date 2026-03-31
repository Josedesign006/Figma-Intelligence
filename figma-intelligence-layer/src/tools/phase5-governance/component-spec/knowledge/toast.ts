import type { ComponentKnowledge } from "../types.js";

export const toastKnowledge: ComponentKnowledge = {
  description:
    "Transient notification | Status feedback message | Auto-dismissing alert",

  stateSpecifications: [
    { state: "Info", visualChange: "Blue left accent bar, info icon, neutral background", opacity: "1", cursorWeb: "default", usage: "General informational message — e.g. 'Settings updated'" },
    { state: "Success", visualChange: "Green left accent bar, checkmark icon", opacity: "1", cursorWeb: "default", usage: "Positive outcome confirmation — e.g. 'File saved'" },
    { state: "Warning", visualChange: "Yellow left accent bar, warning triangle icon", opacity: "1", cursorWeb: "default", usage: "Non-critical issue requiring awareness — e.g. 'Storage nearly full'" },
    { state: "Error", visualChange: "Red left accent bar, error icon", opacity: "1", cursorWeb: "default", usage: "Failure or critical issue — e.g. 'Upload failed'" },
    { state: "Entering", visualChange: "Toast slides in from edge with fade, stacking offset applied", opacity: "0→1", cursorWeb: "default", usage: "Transition state when toast appears" },
    { state: "Dismissing", visualChange: "Toast slides out and fades, siblings animate to close gap", opacity: "1→0", cursorWeb: "default", usage: "Auto-dismiss timer expired or user manually closed" },
    { state: "Paused", visualChange: "Timer bar freezes, toast remains visible", opacity: "1", cursorWeb: "default", usage: "Hover or focus pauses the auto-dismiss countdown" },
  ],

  propertyDescriptions: {
    variant: "Semantic type — info, success, warning, or error — controls color and icon",
    title: "Short bold heading summarizing the notification",
    message: "Optional body text providing additional detail about the event",
    duration: "Auto-dismiss delay in milliseconds; 0 means persistent until manually closed",
    position: "Screen anchor — top-right, top-center, bottom-right, bottom-center, bottom-left",
    hasCloseButton: "Shows an X icon allowing manual dismissal before auto-dismiss",
    actionLabel: "Optional text button inside the toast for a follow-up action (e.g. 'Undo')",
    onAction: "Callback fired when the user clicks the action button",
    stacking: "How multiple toasts arrange — stack (vertical list) or replace (latest wins)",
    maxVisible: "Maximum number of toasts shown simultaneously before older ones collapse",
  },

  sizeSpecifications: [
    { size: "compact", height: "40px", paddingLR: "12px", fontSize: "12px", iconSize: "16px", borderRadius: "4px" },
    { size: "default", height: "auto (min 48px)", paddingLR: "16px", fontSize: "14px", iconSize: "20px", borderRadius: "6px" },
    { size: "wide", height: "auto (min 48px)", paddingLR: "16px", fontSize: "14px", iconSize: "20px", borderRadius: "6px" },
    { size: "full-width", height: "auto (min 48px)", paddingLR: "24px", fontSize: "14px", iconSize: "20px", borderRadius: "0px" },
    { size: "mobile", height: "auto (min 56px)", paddingLR: "16px", fontSize: "16px", iconSize: "24px", borderRadius: "8px" },
  ],

  designTokenBindings: [
    { property: "surface-bg", tokenName: "color/layer/01", role: "Toast container background", fallback: "#FFFFFF" },
    { property: "info-accent", tokenName: "color/support/info", role: "Left border and icon for info variant", fallback: "#0043CE" },
    { property: "success-accent", tokenName: "color/support/success", role: "Left border and icon for success variant", fallback: "#198038" },
    { property: "warning-accent", tokenName: "color/support/warning", role: "Left border and icon for warning variant", fallback: "#F1C21B" },
    { property: "error-accent", tokenName: "color/support/error", role: "Left border and icon for error variant", fallback: "#DA1E28" },
    { property: "title-text", tokenName: "color/text/primary", role: "Toast title text", fallback: "#161616" },
    { property: "shadow", tokenName: "shadow/raised/03", role: "Drop shadow for floating toast", fallback: "0 4px 12px rgba(0,0,0,0.15)" },
  ],

  structureRules: [
    "Toast container uses position:fixed and is placed outside the main content flow",
    "Each toast has a 4px left accent bar indicating the semantic variant color",
    "Internal layout is a horizontal row: accent bar → icon → content (title + message) → action → close",
    "Stacked toasts offset vertically with 8px gap; newest toast appears at the top of the stack",
    "A progress bar at the bottom of the toast visualizes the remaining auto-dismiss time",
    "Toast container has z-index higher than modals to ensure visibility above all layers",
    "Maximum width is 400px (default) or 100vw on mobile; minimum width is 280px",
  ],

  typeHierarchyRules: [
    "Title uses body-compact-01 (14px) in semibold weight for quick scanning",
    "Message uses body-compact-01 (14px) in regular weight, text-secondary color",
    "Action button label uses body-compact-01 (14px) in the interactive color, underlined",
    "Title is limited to a single line; truncate with ellipsis if too long",
    "Message is limited to 2 lines; longer content should use a different notification pattern",
    "Timestamp (if shown) uses label-01 (12px) in text-helper color",
    "Ensure title and message have at least 4.5:1 contrast against the toast surface",
  ],

  interactionRules: [
    { event: "timer:expire", trigger: "Auto-dismiss duration elapses", action: "Animate toast out and remove from DOM; shift stack positions" },
    { event: "click:close", trigger: "User clicks the close icon button", action: "Immediately dismiss the toast with exit animation" },
    { event: "click:action", trigger: "User clicks the action button (e.g. 'Undo')", action: "Fire onAction callback and dismiss the toast" },
    { event: "hover", trigger: "Pointer enters the toast surface", action: "Pause the auto-dismiss timer; freeze progress bar" },
    { event: "hover:leave", trigger: "Pointer leaves the toast surface", action: "Resume the auto-dismiss timer from where it paused" },
    { event: "focus", trigger: "Keyboard focus enters the toast (close button or action)", action: "Pause auto-dismiss timer to give the user time to interact" },
    { event: "swipe:horizontal", trigger: "User swipes the toast left or right (mobile)", action: "Dismiss the toast in the swipe direction with slide animation" },
  ],

  contentGuidance: [
    "Title should be a concise past-tense statement — 'Message sent' not 'Your message has been sent successfully'",
    "Message body is optional; omit it if the title alone is sufficient",
    "Action labels should be single verbs or short phrases — 'Undo', 'View', 'Retry'",
    "Avoid technical jargon in error toasts — 'Could not save file' not 'ENOSPC: disk quota exceeded'",
    "Do not use toasts for critical errors that require user action — use an inline alert or modal instead",
    "Success toasts are often sufficient with just a title and no body text",
    "Warning toasts should suggest what the user can do to resolve the issue",
  ],

  responsiveBehaviour: [
    { breakpoint: "≥ 1056px (lg)", behavior: "Toasts anchor to top-right corner with 16px margin; max-width 400px" },
    { breakpoint: "672–1055px (md)", behavior: "Toasts anchor to top-center; width adapts up to 400px" },
    { breakpoint: "< 672px (sm)", behavior: "Toasts span full width at top or bottom of viewport with 8px margin" },
    { breakpoint: "Reduced motion", behavior: "Skip slide/fade animation; toast appears and disappears instantly" },
    { breakpoint: "Multiple toasts", behavior: "Stack up to maxVisible; excess toasts show as a collapsed count badge" },
  ],

  accessibilitySpec: {
    intro:
      "Toasts must announce their content to screen readers without stealing focus from the user's current task. They rely on ARIA live regions to push announcements into the screen reader queue.",
    requirements: [
      { requirement: "Toast container must use role='status' and aria-live='polite' for non-critical messages", level: "A", notes: "Info and success variants use polite to avoid interrupting the user" },
      { requirement: "Error toasts must use role='alert' and aria-live='assertive'", level: "A", notes: "Assertive ensures the error is announced immediately" },
      { requirement: "Close button must have aria-label='Dismiss notification' or equivalent", level: "A", notes: "Icon-only button requires a text label for screen readers" },
      { requirement: "Action button must be keyboard focusable and have a descriptive label", level: "A", notes: "Avoid generic labels like 'Click here'" },
      { requirement: "Auto-dismiss timer must pause when the toast receives keyboard focus", level: "A", notes: "WCAG 2.2.1 Timing Adjustable — user must have enough time to read" },
      { requirement: "Toast must not depend on color alone for status — icon shape must differ per variant", level: "A", notes: "Checkmark for success, triangle for warning, circle-x for error" },
      { requirement: "Focus must not move to the toast automatically — it should be announced in-place", level: "AA", notes: "Moving focus would disorient users in the middle of a task" },
    ],
    outro: [
      "Test that VoiceOver announces 'File saved' when a success toast appears without moving focus",
      "Verify error toasts interrupt the current screen reader output via assertive announcement",
      "Confirm that hover and focus both pause the dismiss timer independently",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Toast appears and auto-dismisses after configured duration", platform: "All", expectedResult: "Toast visible for duration, then animates out" },
    { check: "Hover pauses auto-dismiss timer", platform: "Web", expectedResult: "Progress bar freezes; timer resumes on mouse leave" },
    { check: "Close button dismisses immediately", platform: "All", expectedResult: "Toast removed with exit animation" },
    { check: "Action button fires callback and dismisses", platform: "All", expectedResult: "Callback executes; toast disappears" },
    { check: "Multiple toasts stack correctly", platform: "All", expectedResult: "Toasts offset vertically with 8px gap; oldest at bottom" },
    { check: "Error toast uses assertive live region", platform: "Web", expectedResult: "Screen reader announces error immediately" },
    { check: "Swipe dismisses on mobile", platform: "Mobile", expectedResult: "Horizontal swipe removes toast with slide animation" },
  ],

  dos: [
    "Use aria-live='polite' for info/success and 'assertive' for error toasts",
    "Pause the auto-dismiss timer on hover and keyboard focus",
    "Provide an action button for reversible actions — e.g. 'Undo' after deletion",
    "Use distinct icons per variant so status is not communicated by color alone",
    "Cap the visible stack at 3–5 toasts to avoid overwhelming the viewport",
    "Position toasts away from primary navigation and form fields",
    "Use a progress bar to show remaining time before auto-dismiss",
  ],

  donts: [
    "Don't use toasts for critical errors that require immediate user action — use a modal or inline alert",
    "Don't set auto-dismiss duration below 4 seconds — users need time to read",
    "Don't stack more than 5 toasts — older toasts should collapse or be replaced",
    "Don't move focus to the toast — it disrupts the user's current workflow",
    "Don't use toasts for content that needs to persist — use a banner instead",
    "Don't omit the close button on persistent (duration: 0) toasts",
    "Don't use identical toast messages in rapid succession — debounce duplicate events",
  ],
};
