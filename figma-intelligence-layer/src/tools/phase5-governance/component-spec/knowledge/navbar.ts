/**
 * navbar.ts — Gold-standard design knowledge for Navbar components
 */
import type { ComponentKnowledge } from "../types.js";

export const navbarKnowledge: ComponentKnowledge = {
  description:
    "Top-level horizontal navigation bar | Site-wide header and branding | AppBar/Header pattern",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Full-width bar with logo, navigation items, and action slots on a solid or transparent background",
      opacity: "1",
      cursorWeb: "default",
      usage: "Resting state — navbar is visible at the top of the viewport with all items accessible",
    },
    {
      state: "Scrolled",
      visualChange: "Background becomes opaque (if transparent), elevation shadow appears via $navbar-shadow token",
      opacity: "1",
      cursorWeb: "default",
      usage: "User has scrolled past the initial viewport — navbar gains visual separation from content below",
    },
    {
      state: "Mobile Collapsed",
      visualChange: "Navigation items hidden; hamburger menu icon visible; logo and essential actions remain",
      opacity: "1",
      cursorWeb: "default",
      usage: "Viewport is below the mobile breakpoint — full navigation is collapsed into a menu trigger",
    },
    {
      state: "Mobile Expanded",
      visualChange: "Drawer or full-height overlay slides in from the side or top; nav items displayed vertically",
      opacity: "1",
      cursorWeb: "default",
      usage: "User has activated the hamburger menu — full navigation is accessible in a mobile-friendly layout",
    },
    {
      state: "Active Item",
      visualChange: "Currently active navigation item has a bottom border indicator or filled background highlight",
      opacity: "1",
      cursorWeb: "default",
      usage: "Indicates which top-level section the user is currently viewing",
    },
    {
      state: "Hover Item",
      visualChange: "Hovered navigation item shows subtle background tint or underline indicator",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Mouse cursor enters a navigation item's hit area",
    },
    {
      state: "Focus Item",
      visualChange: "2px focus ring offset by 2px from the navigation item, using $focus-ring token",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "A navigation item receives keyboard focus via Tab key",
    },
  ],

  propertyDescriptions: {
    logo: "Brand logo element rendered in the leading position; accepts an image component, SVG, or text logotype",
    items: "Array of navigation item entries, each containing a label, href, and optional icon or submenu",
    actions: "Trailing slot for action elements — typically search, notifications, user avatar, or CTA buttons",
    sticky: "When true the navbar remains fixed at the top of the viewport during scroll (position: sticky or fixed)",
    transparent: "When true the navbar has a transparent background in its default state; becomes opaque on scroll",
    elevation: "Shadow depth level applied to the navbar — 'none', 'low', 'medium'; overridden by scrolled state",
    mobileBreakpoint: "Viewport width threshold below which the navbar collapses to mobile layout (default: 768px)",
    onMenuToggle: "Callback fired when the mobile hamburger menu is opened or closed; receives the new open state",
    activeItem: "Index or identifier of the currently active navigation item for visual highlighting",
    maxWidth: "Maximum content width within the navbar — content is centered and constrained (default: 1280px)",
    skipLink: "When true, a visually hidden 'Skip to content' link is rendered as the first focusable element",
    position: "Positioning strategy — 'static', 'sticky', or 'fixed' — controls how the navbar behaves during scroll",
  },

  sizeSpecifications: [
    {
      size: "Compact",
      height: "48px",
      paddingLR: "16px",
      fontSize: "13px",
      iconSize: "18px",
      borderRadius: "0px",
    },
    {
      size: "Default",
      height: "56px",
      paddingLR: "24px",
      fontSize: "14px",
      iconSize: "20px",
      borderRadius: "0px",
    },
    {
      size: "Large",
      height: "64px",
      paddingLR: "32px",
      fontSize: "16px",
      iconSize: "24px",
      borderRadius: "0px",
    },
  ],

  designTokenBindings: [
    {
      property: "Background",
      tokenName: "$navbar-bg",
      role: "Navbar surface fill color — typically white or dark depending on theme",
      fallback: "#FFFFFF",
    },
    {
      property: "Text Color",
      tokenName: "$navbar-text",
      role: "Navigation item and brand text color",
      fallback: "#1D2939",
    },
    {
      property: "Border Bottom",
      tokenName: "$navbar-border",
      role: "Subtle 1px bottom border separating navbar from page content",
      fallback: "#EAECF0",
    },
    {
      property: "Scroll Shadow",
      tokenName: "$navbar-shadow",
      role: "Elevation shadow applied when the user scrolls past the top of the page",
      fallback: "0 1px 3px rgba(16,24,40,0.1), 0 1px 2px rgba(16,24,40,0.06)",
    },
    {
      property: "Mobile Overlay",
      tokenName: "$navbar-mobile-overlay",
      role: "Semi-transparent backdrop behind the mobile navigation drawer",
      fallback: "rgba(16,24,40,0.6)",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Keyboard focus indicator ring for navigation items and action buttons",
      fallback: "0 0 0 2px #FFFFFF, 0 0 0 4px #2E90FA",
    },
    {
      property: "Font Family",
      tokenName: "$font-family-sans",
      role: "Navigation item typeface",
      fallback: "Inter, system-ui, sans-serif",
    },
    {
      property: "Active Indicator",
      tokenName: "$navbar-active-indicator",
      role: "Color of the bottom border or background highlight on the active navigation item",
      fallback: "#2563EB",
    },
    {
      property: "Transition",
      tokenName: "$transition-interactive",
      role: "Smooth transitions for scroll shadow, mobile drawer, and hover states",
      fallback: "200ms ease-in-out",
    },
  ],

  structureRules: [
    "Outer wrapper uses role='banner' for the site-wide header; contains a <nav> element for the navigation items",
    "Container uses horizontal Auto Layout (flexbox) with space-between distribution and center vertical alignment",
    "Logo slot is the first child; navigation items occupy the center; actions slot is the trailing child",
    "Navigation items are rendered as an <ul>/<li> list within the <nav> element",
    "Mobile hamburger button is visually hidden on desktop and displayed only below the mobile breakpoint",
    "Mobile drawer renders as a separate layer with a backdrop overlay that closes on click-outside or Escape",
    "Skip-to-content link is the first focusable element in the DOM, visually hidden until focused",
  ],

  typeHierarchyRules: [
    "Navigation item weight is Medium (500) for default items; Semi-Bold (600) for the active item",
    "Text uses sentence case for navigation labels — match section titles exactly",
    "Active indicator (bottom border or background) is 2-3px thick using $navbar-active-indicator token",
    "Logo text uses the brand typeface or is replaced by an image — never both simultaneously",
    "No underline on navigation items — underline is reserved for inline text links",
    "Mobile drawer items use a larger font-size (16px minimum) for touch readability",
  ],

  interactionRules: [
    { event: "Click Nav Item", trigger: "pointerup on a navigation item", action: "Navigate to the section/page; update active item indicator" },
    { event: "Hover Nav Item", trigger: "pointerenter on a navigation item", action: "Show subtle background tint or underline indicator" },
    { event: "Focus Nav Item", trigger: "Tab key or focus()", action: "Show focus ring; do not trigger navigation" },
    { event: "Keydown Enter", trigger: "Enter key while a nav item is focused", action: "Navigate to the section/page (same as click)" },
    { event: "Hamburger Click", trigger: "pointerup on mobile menu button", action: "Toggle mobile drawer open/closed; fire onMenuToggle callback" },
    { event: "Escape on Drawer", trigger: "Escape key while mobile drawer is open", action: "Close drawer; return focus to hamburger button" },
    { event: "Click Overlay", trigger: "pointerup on the mobile backdrop overlay", action: "Close the mobile drawer" },
    { event: "Scroll", trigger: "Window scroll passes threshold (default: 10px)", action: "Add elevation shadow and opaque background if transparent" },
  ],

  contentGuidance: [
    "Limit top-level navigation items to 5-7 for cognitive manageability — use dropdowns for deeper hierarchy",
    "Labels should be concise (one to two words) and clearly describe the destination section",
    "Place the most important navigation items first (left-to-right in LTR locales)",
    "Reserve the actions slot for utility actions (search, profile, settings) — not primary navigation",
    "Always include a 'Skip to content' link for keyboard and screen reader users",
    "Logo should link to the homepage — this is a universal convention users expect",
    "Avoid placing too many action items in the trailing slot — prioritize the top 2-3 actions",
    "Mobile drawer should mirror the desktop navigation order for consistency",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Navigation items collapse into hamburger menu; logo and 1-2 essential actions remain visible; drawer opens full-width or as side panel" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Navigation items may remain visible if count is 4 or fewer; otherwise collapse to hamburger; compact height used" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Full horizontal navigation visible; all items and actions displayed inline; standard spacing" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Navbar content constrained to maxWidth and centered; background extends full width; no proportional scaling" },
  ],

  accessibilitySpec: {
    intro:
      "The navbar is typically the first interactive region users encounter. Proper landmark roles, skip links, and keyboard navigation are essential for an accessible experience.",
    requirements: [
      { requirement: "Banner Landmark", level: "A", notes: "Use role='banner' on the header wrapper to establish a page-level landmark for assistive technology" },
      { requirement: "Navigation Landmark", level: "A", notes: "Wrap navigation items in <nav> with aria-label='Main navigation' to distinguish from other nav regions" },
      { requirement: "Skip Link", level: "A", notes: "Provide a 'Skip to main content' link as the first focusable element; visible on focus for keyboard users" },
      { requirement: "Keyboard Navigation", level: "A", notes: "All navigation items and actions reachable via Tab; Enter activates links; Escape closes mobile drawer" },
      { requirement: "Mobile Drawer Focus Trap", level: "AA", notes: "When mobile drawer is open, focus is trapped within the drawer; Tab cycles through drawer items only" },
      { requirement: "Contrast Ratio", level: "AA", notes: "Navigation text to background: 4.5:1; active indicator to background: 3:1 non-text contrast" },
      { requirement: "Hamburger Button Label", level: "A", notes: "Mobile menu button must have aria-label='Open menu' and aria-expanded reflecting open/closed state" },
    ],
    outro: [
      "When the mobile drawer closes, return focus to the hamburger button to maintain the user's place",
      "Ensure scroll-triggered visual changes (shadow, opacity) do not cause content reflow or layout shifts",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Visual Regression", platform: "All", expectedResult: "Navbar renders pixel-perfect against baseline for each size and state (default, scrolled, mobile)" },
    { check: "Sticky Behavior", platform: "Web", expectedResult: "Navbar remains fixed at top during scroll; content scrolls beneath it without overlap issues" },
    { check: "Scroll Shadow", platform: "Web", expectedResult: "Shadow appears smoothly after scrolling past threshold; disappears when scrolled back to top" },
    { check: "Active Item", platform: "All", expectedResult: "Active navigation item displays indicator; updates correctly on route change" },
    { check: "Hover State", platform: "Web", expectedResult: "Navigation items show background tint or underline on hover with smooth transition" },
    { check: "Focus State", platform: "Web", expectedResult: "Focus ring visible on Tab for all interactive elements; hidden on mouse click (focus-visible)" },
    { check: "Mobile Collapse", platform: "Mobile", expectedResult: "Navigation items hidden below mobileBreakpoint; hamburger icon visible and functional" },
    { check: "Mobile Drawer", platform: "Mobile", expectedResult: "Drawer opens with animation; overlay visible; items navigable; closes on Escape or overlay click" },
    { check: "Skip Link", platform: "Web", expectedResult: "Skip link is hidden until focused; on activation, focus moves to main content region" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces 'banner' landmark, 'Main navigation', item count, and active item designation" },
    { check: "Keyboard Navigation", platform: "Web", expectedResult: "Tab moves through items in order; Enter activates; focus trapped in open mobile drawer" },
    { check: "RTL Support", platform: "Web", expectedResult: "Logo moves to right; items reverse order; hamburger icon on left in RTL locales" },
    { check: "Contrast", platform: "All", expectedResult: "All text and indicator colors pass 4.5:1 text and 3:1 non-text contrast ratios" },
  ],

  dos: [
    "Use role='banner' for the site-wide header and <nav> with aria-label for the navigation region",
    "Always provide a 'Skip to content' link as the first focusable element",
    "Keep top-level navigation items to 5-7 entries for scannability",
    "Ensure the logo links to the homepage as users universally expect",
    "Add elevation (shadow) on scroll to provide visual separation from scrolling content",
    "Trap focus within the mobile drawer when it is open to prevent tabbing to obscured content",
    "Use the sticky or fixed position for the navbar to maintain persistent access to navigation",
    "Mirror the desktop navigation order in the mobile drawer for consistency",
  ],

  donts: [
    "Do not use the navbar for secondary or contextual navigation — use a sidebar or tabs component instead",
    "Do not remove the focus outline on navigation items without providing an equally visible alternative",
    "Do not auto-hide the navbar on scroll-down without a clear mechanism to bring it back on scroll-up",
    "Do not place more than 3 action items in the trailing slot — prioritize ruthlessly",
    "Do not use the navbar background color as the sole indicator of scrolled state — add shadow or border",
    "Do not allow the mobile drawer to open without a backdrop overlay to provide context separation",
    "Do not make the hamburger menu button smaller than 44x44px touch target",
    "Do not use different navigation structures between desktop and mobile — items must match",
  ],
};
