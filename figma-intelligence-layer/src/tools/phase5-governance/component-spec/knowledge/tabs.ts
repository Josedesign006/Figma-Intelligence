import type { ComponentKnowledge } from "../types.js";

export const tabsKnowledge: ComponentKnowledge = {
  description:
    "Content organizer | Sectioned view switcher | Tabbed navigation pattern",

  stateSpecifications: [
    { state: "Default-Unselected", visualChange: "Label in secondary color, no indicator bar", opacity: "1", cursorWeb: "pointer", usage: "Tab is available but not currently active" },
    { state: "Hover-Unselected", visualChange: "Background tint appears behind label", opacity: "1", cursorWeb: "pointer", usage: "Pointer hovering over an inactive tab" },
    { state: "Focus-Unselected", visualChange: "Focus ring around tab, no indicator", opacity: "1", cursorWeb: "default", usage: "Keyboard focus on an inactive tab" },
    { state: "Selected", visualChange: "Bold label, indicator bar on bottom edge, primary text color", opacity: "1", cursorWeb: "default", usage: "Currently active tab showing its panel content" },
    { state: "Selected-Focus", visualChange: "Focus ring around active tab with indicator bar", opacity: "1", cursorWeb: "default", usage: "Keyboard focus on the active tab" },
    { state: "Disabled", visualChange: "Label dimmed, no hover/focus effects", opacity: "0.4", cursorWeb: "not-allowed", usage: "Tab content is unavailable or locked" },
    { state: "Overflow", visualChange: "Scroll arrows or 'more' button visible at tab bar edges", opacity: "1", cursorWeb: "pointer", usage: "Too many tabs to fit in available width" },
  ],

  propertyDescriptions: {
    selectedIndex: "Zero-based index of the currently active tab",
    variant: "Visual style — line (underline indicator), contained (filled background), or vertical (sidebar tabs)",
    size: "Height variant affecting padding and font size of tab labels",
    label: "Visible text for each individual tab trigger",
    icon: "Optional leading icon displayed before the tab label",
    badge: "Notification badge (dot or count) on a tab for unread/new content",
    disabled: "Prevents a specific tab from being selected",
    dismissible: "Shows a close icon on the tab allowing removal from the tab bar",
    scrollable: "Enables horizontal scrolling when tabs overflow container width",
  },

  sizeSpecifications: [
    { size: "sm", height: "32px", paddingLR: "12px", fontSize: "12px", iconSize: "16px", borderRadius: "0px" },
    { size: "md", height: "40px", paddingLR: "16px", fontSize: "14px", iconSize: "16px", borderRadius: "0px" },
    { size: "lg", height: "48px", paddingLR: "16px", fontSize: "14px", iconSize: "20px", borderRadius: "0px" },
    { size: "xl", height: "56px", paddingLR: "20px", fontSize: "16px", iconSize: "20px", borderRadius: "0px" },
    { size: "contained-md", height: "40px", paddingLR: "16px", fontSize: "14px", iconSize: "16px", borderRadius: "4px 4px 0 0" },
  ],

  designTokenBindings: [
    { property: "indicator-bar", tokenName: "color/border/interactive", role: "Bottom border of the selected tab", fallback: "#0F62FE" },
    { property: "label-selected", tokenName: "color/text/primary", role: "Text color of the active tab", fallback: "#161616" },
    { property: "label-unselected", tokenName: "color/text/secondary", role: "Text color of inactive tabs", fallback: "#525252" },
    { property: "hover-bg", tokenName: "color/layer/hover/01", role: "Background tint on hover for unselected tab", fallback: "rgba(141,141,141,0.12)" },
    { property: "divider", tokenName: "color/border/subtle/01", role: "Bottom border of the entire tab bar", fallback: "#E0E0E0" },
    { property: "focus-ring", tokenName: "color/focus", role: "Keyboard focus outline color", fallback: "#0F62FE" },
    { property: "badge-bg", tokenName: "color/support/error", role: "Notification badge background", fallback: "#DA1E28" },
  ],

  structureRules: [
    "Tab bar uses role='tablist' with individual tabs using role='tab'",
    "Each tab must have a corresponding panel with role='tabpanel' linked via aria-controls/aria-labelledby",
    "The indicator bar is 2–3px tall and positioned at the bottom edge of the selected tab",
    "Indicator animates horizontally to slide from the previous tab to the newly selected tab",
    "Contained variant wraps each tab in a filled rectangle; selected tab shares background with the panel",
    "Overflow tabs are accessible via scroll buttons or a dropdown 'more' menu at the end",
    "Tab panels must be direct siblings or linked via IDREF; only the active panel is visible",
  ],

  typeHierarchyRules: [
    "Tab labels use body-compact-01 (14px) for md/lg and label-01 (12px) for sm",
    "Selected tab label may use semibold weight to reinforce active state",
    "Badge count uses caption-01 (12px) with inverse text on the badge background",
    "Tab labels should be single-line; truncate with ellipsis at max-width",
    "Vertical tab labels use body-01 (14px/20px) with left alignment",
    "Label width is content-driven with min-width of 64px and max-width of 200px",
    "If icons are used, all tabs in the bar must have icons for visual consistency",
  ],

  interactionRules: [
    { event: "click", trigger: "User clicks an unselected tab", action: "Activate the tab, show its panel, update indicator position" },
    { event: "keydown:ArrowRight", trigger: "Focus is on a tab in horizontal tablist", action: "Move focus to the next tab; wrap to first if at end" },
    { event: "keydown:ArrowLeft", trigger: "Focus is on a tab in horizontal tablist", action: "Move focus to the previous tab; wrap to last if at start" },
    { event: "keydown:Home", trigger: "Focus is on any tab", action: "Move focus to the first tab in the list" },
    { event: "keydown:End", trigger: "Focus is on any tab", action: "Move focus to the last tab in the list" },
    { event: "keydown:Enter/Space", trigger: "Focus is on an unselected tab (manual activation mode)", action: "Activate the focused tab and reveal its panel" },
    { event: "keydown:Delete", trigger: "Focus is on a dismissible tab", action: "Remove the tab and move focus to the nearest remaining tab" },
  ],

  contentGuidance: [
    "Tab labels should be 1–2 words; think nouns like 'Overview', 'Settings', 'Activity'",
    "Do not use verbs for tab labels — tabs are not actions, they are content sections",
    "Keep the number of tabs between 2 and 8; consider a different pattern for more sections",
    "Order tabs by user priority — most-used section first",
    "Avoid mixing tabs with icons and tabs without icons in the same bar",
    "Badge counts should use compact number formatting (e.g. '99+' not '143')",
    "If tabs control unrelated content, consider using top-level navigation instead",
  ],

  responsiveBehaviour: [
    { breakpoint: "≥ 1056px (lg)", behavior: "All tabs visible inline; indicator animates between tabs" },
    { breakpoint: "672–1055px (md)", behavior: "Tabs that overflow become scrollable with arrow buttons" },
    { breakpoint: "< 672px (sm)", behavior: "Consider collapsing to a dropdown select or accordion pattern" },
    { breakpoint: "Touch devices", behavior: "Support horizontal swipe gesture to switch between tab panels" },
    { breakpoint: "Vertical variant", behavior: "Sidebar tabs remain visible; panels fill remaining width" },
  ],

  accessibilitySpec: {
    intro:
      "Tabs must implement the WAI-ARIA tabs pattern with proper roles, relationships, and keyboard support. Users must be able to discover and switch between tab panels using keyboard alone.",
    requirements: [
      { requirement: "Container must have role='tablist'", level: "A", notes: "Group all tab triggers inside the tablist" },
      { requirement: "Each trigger must have role='tab' with aria-selected indicating active state", level: "A", notes: "aria-selected='true' on active tab, 'false' on others" },
      { requirement: "Each panel must have role='tabpanel' and be labelled by its tab via aria-labelledby", level: "A", notes: "Tab uses aria-controls pointing to panel id" },
      { requirement: "Only the selected tab should have tabindex='0'; others get tabindex='-1'", level: "A", notes: "Roving tabindex enables arrow key navigation" },
      { requirement: "Arrow keys must move focus between tabs (left/right for horizontal, up/down for vertical)", level: "A", notes: "Focus wraps from last to first and vice versa" },
      { requirement: "Disabled tabs must have aria-disabled='true' and be skipped by arrow key navigation", level: "A", notes: "Alternatively, disabled tabs can receive focus but not activate" },
      { requirement: "Panels must be discoverable — hidden panels should use hidden attribute, not display:none with no aria", level: "AA", notes: "Ensures assistive tech can identify available panels" },
    ],
    outro: [
      "Test that screen readers announce 'tab, 1 of 5, selected' pattern on focus",
      "Verify arrow keys skip disabled tabs when navigating",
      "Confirm Tab key moves focus from the tablist into the active panel content",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Clicking a tab shows its panel and hides others", platform: "All", expectedResult: "Only active panel is visible; indicator moves to clicked tab" },
    { check: "Arrow keys navigate between tabs", platform: "Web", expectedResult: "Focus moves; wrap at boundaries; disabled tabs skipped" },
    { check: "Tab key moves focus into the panel", platform: "Web", expectedResult: "Focus leaves tablist and enters active panel's first focusable element" },
    { check: "Indicator animates between tabs", platform: "Web", expectedResult: "Smooth 200ms slide transition for the indicator bar" },
    { check: "Overflow tabs are accessible", platform: "Web", expectedResult: "Scroll buttons appear; all tabs reachable via keyboard" },
    { check: "Dismissible tab can be removed", platform: "Web", expectedResult: "Tab removed, focus moves to nearest sibling, panel removed" },
    { check: "Badge renders correctly on tab", platform: "All", expectedResult: "Badge positioned top-right of label, count visible" },
  ],

  dos: [
    "Use semantic tablist/tab/tabpanel roles for all tab implementations",
    "Animate the indicator bar for clear visual feedback during tab changes",
    "Provide a scroll mechanism when tabs overflow the container",
    "Keep tab labels short and descriptive — one or two words",
    "Set aria-orientation='vertical' on vertical tablists",
    "Load tab panel content eagerly if SEO matters; lazy-load for performance",
    "Use the contained variant when tabs sit above a card-like content area",
  ],

  donts: [
    "Don't use tabs for sequential steps — use a stepper/wizard pattern instead",
    "Don't nest tabs within tabs — it creates confusing navigation hierarchy",
    "Don't change the page URL when switching tabs unless tabs represent distinct routes",
    "Don't mix tab variants (line and contained) in the same interface",
    "Don't auto-rotate through tabs like a carousel — tabs are user-driven",
    "Don't hide critical content in later tabs — users may never discover it",
    "Don't make the tab panel height change dramatically between tabs without transition",
  ],
};
