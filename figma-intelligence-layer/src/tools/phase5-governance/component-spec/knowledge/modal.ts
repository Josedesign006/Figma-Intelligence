import type { ComponentKnowledge } from "../types.js";

export const modalKnowledge: ComponentKnowledge = {
  description:
    "Overlay dialog | Focused interaction container | Content interruption layer",

  stateSpecifications: [
    { state: "Closed", visualChange: "Modal and backdrop are not rendered in the DOM or are display:none", opacity: "0", cursorWeb: "default", usage: "No modal is active; page is fully interactive" },
    { state: "Opening", visualChange: "Backdrop fades in, modal slides/scales into view", opacity: "0→1", cursorWeb: "default", usage: "Transition state during entrance animation" },
    { state: "Open-Default", visualChange: "Backdrop at reduced opacity, modal centered and fully visible", opacity: "1", cursorWeb: "default", usage: "User is interacting with modal content" },
    { state: "Open-Scrollable", visualChange: "Modal body scrolls independently, header/footer remain fixed", opacity: "1", cursorWeb: "default", usage: "Content exceeds the modal viewport height" },
    { state: "Closing", visualChange: "Modal fades/slides out, backdrop fades", opacity: "1→0", cursorWeb: "default", usage: "Transition state during exit animation" },
    { state: "Danger", visualChange: "Primary action button uses danger/destructive color", opacity: "1", cursorWeb: "default", usage: "Confirming an irreversible or destructive action" },
    { state: "Passive", visualChange: "No action buttons; informational content only with close icon", opacity: "1", cursorWeb: "default", usage: "Displaying read-only information or media" },
  ],

  propertyDescriptions: {
    open: "Controls visibility of the modal; when true the dialog is rendered and focus is trapped",
    size: "Width variant — xs (320px), sm (480px), md (640px), lg (800px), full (100vw–margins)",
    title: "Heading text rendered in the modal header bar",
    subtitle: "Optional secondary text below the title providing additional context",
    hasCloseIcon: "Renders an X button in the top-right corner of the header",
    preventCloseOnClickOutside: "When true, clicking the backdrop does not dismiss the modal",
    danger: "Applies destructive styling to the primary action button",
    primaryButtonText: "Label for the main CTA button in the footer",
    secondaryButtonText: "Label for the secondary/cancel button in the footer",
    selectorPrimaryFocus: "CSS selector for the element that receives initial focus on open",
  },

  sizeSpecifications: [
    { size: "xs", height: "auto (max 80vh)", paddingLR: "16px", fontSize: "14px", iconSize: "20px", borderRadius: "4px" },
    { size: "sm", height: "auto (max 80vh)", paddingLR: "24px", fontSize: "14px", iconSize: "20px", borderRadius: "4px" },
    { size: "md", height: "auto (max 80vh)", paddingLR: "32px", fontSize: "14px", iconSize: "20px", borderRadius: "8px" },
    { size: "lg", height: "auto (max 84vh)", paddingLR: "32px", fontSize: "16px", iconSize: "24px", borderRadius: "8px" },
    { size: "full", height: "100vh – 48px", paddingLR: "48px", fontSize: "16px", iconSize: "24px", borderRadius: "0px" },
  ],

  designTokenBindings: [
    { property: "backdrop", tokenName: "color/overlay", role: "Semi-transparent background behind modal", fallback: "rgba(22,22,22,0.5)" },
    { property: "surface", tokenName: "color/layer/01", role: "Modal container background", fallback: "#FFFFFF" },
    { property: "header-text", tokenName: "color/text/primary", role: "Title and subtitle text", fallback: "#161616" },
    { property: "border-bottom", tokenName: "color/border/subtle/01", role: "Divider between header and body", fallback: "#E0E0E0" },
    { property: "close-icon", tokenName: "color/icon/primary", role: "Close button icon fill", fallback: "#161616" },
    { property: "danger-button-bg", tokenName: "color/support/error", role: "Background of destructive primary action", fallback: "#DA1E28" },
    { property: "shadow", tokenName: "shadow/raised/04", role: "Elevation shadow around modal container", fallback: "0 8px 24px rgba(0,0,0,0.2)" },
  ],

  structureRules: [
    "Modal must use the native <dialog> element or role='dialog' with aria-modal='true'",
    "Structure follows a three-zone layout: fixed header, scrollable body, fixed footer",
    "Header contains title, optional subtitle, and close icon aligned to the end",
    "Footer contains action buttons right-aligned; primary button comes last in DOM order",
    "Backdrop is a sibling or pseudo-element that spans the entire viewport",
    "Modal must be centered both vertically and horizontally with responsive margins",
    "When content overflows, only the body zone scrolls — header and footer remain pinned",
  ],

  typeHierarchyRules: [
    "Title uses heading-03 (20px/28px) to establish the modal's purpose immediately",
    "Subtitle uses body-01 (14px/20px) in text-secondary color",
    "Body content follows standard body-01 typography with 20px line-height",
    "Footer button labels use body-compact-01 (14px) in uppercase or sentence case per system",
    "Title must not exceed two lines — truncate with ellipsis if necessary",
    "Ensure at least 16px vertical spacing between title and body content",
    "Danger button label should use the same type style as primary but with inverse text color",
  ],

  interactionRules: [
    { event: "keydown:Escape", trigger: "Modal is open and not preventCloseOnClickOutside", action: "Close the modal and return focus to the trigger element" },
    { event: "click:backdrop", trigger: "User clicks outside modal surface", action: "Close modal unless preventCloseOnClickOutside is true" },
    { event: "click:close-icon", trigger: "User clicks the X button", action: "Close modal and return focus to trigger" },
    { event: "keydown:Tab", trigger: "Focus is on the last focusable element inside modal", action: "Wrap focus back to the first focusable element (focus trap)" },
    { event: "keydown:Shift+Tab", trigger: "Focus is on the first focusable element", action: "Wrap focus to the last focusable element (reverse trap)" },
    { event: "open", trigger: "Modal becomes visible", action: "Lock body scroll, move focus to selectorPrimaryFocus or first focusable element" },
    { event: "close", trigger: "Modal is dismissed by any method", action: "Restore body scroll, return focus to the element that opened the modal" },
  ],

  contentGuidance: [
    "Use a clear, action-oriented title — e.g. 'Delete project?' not 'Are you sure?'",
    "Keep body content concise; modals are for focused tasks, not long-form reading",
    "Primary button label should match the action described in the title — e.g. 'Delete' for 'Delete project?'",
    "Secondary button should be a clear escape — 'Cancel' or 'Go back', never just 'No'",
    "Avoid stacking modals on top of modals; redesign the flow if nesting is needed",
    "For forms inside modals, validate inline and disable the primary button until valid",
    "Danger modals should explicitly name the resource being affected in the body text",
  ],

  responsiveBehaviour: [
    { breakpoint: "≥ 1056px (lg)", behavior: "Modal renders centered with defined width; backdrop visible" },
    { breakpoint: "672–1055px (md)", behavior: "Modal width may increase to md or lg size; side margins shrink to 24px" },
    { breakpoint: "< 672px (sm)", behavior: "Modal becomes full-width sheet docked to bottom or fills viewport" },
    { breakpoint: "Landscape mobile", behavior: "Modal height capped at 80vh with scrollable body" },
    { breakpoint: "Reduced motion", behavior: "Skip entrance/exit animations; modal appears/disappears instantly" },
  ],

  accessibilitySpec: {
    intro:
      "Modals must trap focus, lock background scrolling, and announce their purpose to assistive technologies. They represent a critical interruption pattern that must be fully keyboard operable.",
    requirements: [
      { requirement: "Container must have role='dialog' and aria-modal='true'", level: "A", notes: "Native <dialog> with showModal() provides this automatically" },
      { requirement: "Must have an accessible name via aria-labelledby pointing to the title element", level: "A", notes: "aria-label is acceptable if no visible title exists" },
      { requirement: "Focus must be trapped inside the modal while open", level: "A", notes: "Tab and Shift+Tab must cycle within modal boundaries" },
      { requirement: "Escape key must close the modal", level: "A", notes: "Unless explicitly prevented for critical workflows like unsaved data" },
      { requirement: "On close, focus must return to the element that triggered the modal", level: "A", notes: "Store a reference to document.activeElement before opening" },
      { requirement: "Background content must be inert (aria-hidden or inert attribute)", level: "A", notes: "Prevents screen readers from accessing content behind the modal" },
      { requirement: "Opening transition must respect prefers-reduced-motion", level: "AA", notes: "Disable or reduce animation duration to 0ms" },
    ],
    outro: [
      "Test that VoiceOver announces the dialog title on open",
      "Verify tab trapping with both Tab and Shift+Tab at modal boundaries",
      "Confirm background scroll is locked on iOS Safari, which requires special handling",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Focus moves into modal on open", platform: "Web", expectedResult: "First focusable element or selectorPrimaryFocus receives focus" },
    { check: "Tab key is trapped within modal", platform: "Web", expectedResult: "Focus cycles through modal elements only" },
    { check: "Escape closes the modal", platform: "Web", expectedResult: "Modal dismissed, focus returns to trigger" },
    { check: "Backdrop click closes modal", platform: "Web", expectedResult: "Modal dismissed unless preventCloseOnClickOutside is set" },
    { check: "Body scroll is locked", platform: "All", expectedResult: "Page behind modal does not scroll on any device" },
    { check: "Danger variant shows red primary button", platform: "All", expectedResult: "Button uses danger token, label remains legible" },
    { check: "Long content scrolls inside body zone", platform: "All", expectedResult: "Header and footer stay fixed; only body scrolls" },
  ],

  dos: [
    "Return focus to the triggering element when the modal closes",
    "Provide a visible close affordance (X icon or cancel button) at all times",
    "Use the danger variant when the action is destructive or irreversible",
    "Keep modal content focused on a single task or decision",
    "Apply inert or aria-hidden to all content behind the backdrop",
    "Animate entrance and exit with a 200–300ms duration for smooth perception",
    "Test with screen readers to confirm the title is announced on open",
  ],

  donts: [
    "Don't open a modal from within another modal — flatten the flow instead",
    "Don't use modals for simple confirmations that could be inline alerts",
    "Don't auto-close modals on a timer — users need time to read and decide",
    "Don't remove the backdrop — it provides critical visual context for layering",
    "Don't place critical page-level navigation inside a modal",
    "Don't allow background scrolling while the modal is open",
    "Don't use a modal when the content would benefit from a full page layout",
  ],
};
