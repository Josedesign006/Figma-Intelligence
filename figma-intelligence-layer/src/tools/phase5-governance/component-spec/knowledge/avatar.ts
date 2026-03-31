/**
 * avatar.ts — Gold-standard design knowledge for Avatar components
 */
import type { ComponentKnowledge } from "../types.js";

export const avatarKnowledge: ComponentKnowledge = {
  description:
    "User representation | Identity thumbnail | Profile image display",

  stateSpecifications: [
    {
      state: "Image Loaded",
      visualChange: "User photo fills the circular container with object-fit cover",
      opacity: "1",
      cursorWeb: "default",
      usage: "Primary state when a valid image source is available",
    },
    {
      state: "Initials Fallback",
      visualChange: "Colored background with 1-2 uppercase initials centered in the circle",
      opacity: "1",
      cursorWeb: "default",
      usage: "Fallback when no image URL is provided or image fails to load",
    },
    {
      state: "Icon Fallback",
      visualChange: "Generic person silhouette icon centered on a neutral background",
      opacity: "1",
      cursorWeb: "default",
      usage: "Final fallback when neither image nor initials data is available",
    },
    {
      state: "Hover",
      visualChange: "Subtle overlay or ring highlight appears around the avatar",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Avatar is interactive (links to profile or triggers a popover)",
    },
    {
      state: "Focus",
      visualChange: "2px focus ring offset by 2px from the avatar edge using $focus-ring token",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Avatar receives keyboard focus when interactive",
    },
    {
      state: "Loading",
      visualChange: "Skeleton pulse animation in the circular shape while image loads",
      opacity: "0.6",
      cursorWeb: "default",
      usage: "Image is being fetched from a remote source",
    },
    {
      state: "Error",
      visualChange: "Graceful degradation to initials or icon fallback; no broken image icon shown",
      opacity: "1",
      cursorWeb: "default",
      usage: "Image URL returned a network error or 404",
    },
  ],

  propertyDescriptions: {
    src: "Image URL for the user photo; triggers the image-loaded state when valid",
    alt: "Accessible alternative text describing the user; required for screen readers",
    initials: "1-2 character string used as the text fallback when no image is available",
    size: "Dimensional preset — Extra Small, Small, Medium, Large, Extra Large — controls diameter and font size",
    shape: "Container shape — Circle (default) or Square with rounded corners",
    status: "Online presence badge — online (green), away (yellow), busy (red), offline (grey)",
    statusPosition: "Badge placement — bottom-right (default) or top-right of the avatar",
  },

  sizeSpecifications: [
    {
      size: "Extra Small",
      height: "24px",
      paddingLR: "0px",
      fontSize: "10px",
      iconSize: "14px",
      borderRadius: "50%",
    },
    {
      size: "Small",
      height: "32px",
      paddingLR: "0px",
      fontSize: "12px",
      iconSize: "16px",
      borderRadius: "50%",
    },
    {
      size: "Medium",
      height: "40px",
      paddingLR: "0px",
      fontSize: "14px",
      iconSize: "20px",
      borderRadius: "50%",
    },
    {
      size: "Large",
      height: "48px",
      paddingLR: "0px",
      fontSize: "16px",
      iconSize: "24px",
      borderRadius: "50%",
    },
    {
      size: "Extra Large",
      height: "64px",
      paddingLR: "0px",
      fontSize: "20px",
      iconSize: "32px",
      borderRadius: "50%",
    },
  ],

  designTokenBindings: [
    {
      property: "Background",
      tokenName: "$avatar-bg",
      role: "Fill color for initials and icon fallback states",
      fallback: "#E5E7EB",
    },
    {
      property: "Initials Color",
      tokenName: "$avatar-initials-text",
      role: "Text color for the initials fallback",
      fallback: "#374151",
    },
    {
      property: "Border",
      tokenName: "$avatar-border",
      role: "Optional ring around the avatar for grouped/stacked layouts",
      fallback: "2px solid #FFFFFF",
    },
    {
      property: "Status Online",
      tokenName: "$status-online",
      role: "Green badge color for online presence",
      fallback: "#22C55E",
    },
    {
      property: "Status Busy",
      tokenName: "$status-busy",
      role: "Red badge color for busy/do-not-disturb presence",
      fallback: "#EF4444",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Keyboard focus indicator ring for interactive avatars",
      fallback: "0 0 0 2px #FFFFFF, 0 0 0 4px #2E90FA",
    },
    {
      property: "Skeleton Pulse",
      tokenName: "$skeleton-bg",
      role: "Animated placeholder color during image loading",
      fallback: "#F3F4F6",
    },
  ],

  structureRules: [
    "Container is a fixed-size frame with clip content enabled and border-radius 50% for circular shape",
    "Image layer fills the container using object-fit cover to prevent distortion",
    "Initials text is absolutely centered within the container using auto layout with center/center alignment",
    "Status badge is positioned as an overlay in the bottom-right corner with a 2px white border ring",
    "Status badge diameter is 25% of the avatar diameter, with a minimum of 8px",
    "In avatar groups, items overlap by 25% of their diameter with a negative margin and a white border ring",
    "Avatar group renders right-to-left stacking order so the first avatar appears on top",
  ],

  typeHierarchyRules: [
    "Initials use Medium weight (500) and are always uppercase",
    "Font size scales proportionally with avatar size — never exceeds 40% of the diameter",
    "Single-character initials are preferred for Extra Small size to avoid clipping",
    "Two-character initials use tighter letter spacing (-0.02em) to fit within the circle",
    "Overflow count in avatar groups ('+3') uses the same font size as the avatar initials",
  ],

  interactionRules: [
    { event: "Click / Tap", trigger: "pointerup on interactive avatar", action: "Navigate to user profile or open profile popover" },
    { event: "Hover", trigger: "pointerenter on interactive avatar", action: "Show tooltip with full user name; apply subtle ring highlight" },
    { event: "Image Error", trigger: "onerror on <img>", action: "Hide image layer; reveal initials fallback; if no initials, show icon fallback" },
    { event: "Focus", trigger: "Tab key or focus()", action: "Show focus ring around the avatar" },
    { event: "Blur", trigger: "Focus moves away", action: "Remove focus ring" },
    { event: "Group Overflow", trigger: "Avatar count exceeds maxVisible", action: "Render a '+N' overflow indicator as the last avatar in the group" },
  ],

  contentGuidance: [
    "Always provide a meaningful alt text — use the person's full name, not 'avatar' or 'user'",
    "Initials should be derived from the user's first and last name (e.g. 'JD' for John Doe)",
    "Use a consistent color-hashing algorithm for initials backgrounds to give each user a stable color",
    "Profile images should be square at source; the component handles circular cropping",
    "Avoid using avatars for decorative purposes — they should always represent a real person or entity",
    "In avatar groups, include a tooltip on the overflow indicator showing the remaining names",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Use Small or Medium sizes; avatar groups show max 3 items with overflow count" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Medium size is default; avatar groups may show up to 5 items" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "All sizes available; avatar groups show up to 8 items inline" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Large and Extra Large sizes for profile headers; groups remain capped at 8" },
    { breakpoint: "Navigation Bar", behavior: "Use Small (32px) or Extra Small (24px) size to fit within nav height constraints" },
  ],

  accessibilitySpec: {
    intro:
      "Avatars convey user identity and must be accessible to screen readers with meaningful alternative text and proper roles.",
    requirements: [
      { requirement: "Alt Text", level: "A", notes: "Image avatars require descriptive alt text with the user's name; decorative avatars use alt=''" },
      { requirement: "Role", level: "A", notes: "Interactive avatars must use role='button' or role='link' with an accessible name" },
      { requirement: "Focusable", level: "A", notes: "Interactive avatars must be reachable via Tab key with visible focus indicator" },
      { requirement: "Color Independence", level: "A", notes: "Status badges must not rely solely on color — include aria-label describing presence state" },
      { requirement: "Contrast Ratio", level: "AA", notes: "Initials text-to-background: 4.5:1 minimum; status badge-to-avatar: 3:1 non-text contrast" },
      { requirement: "Touch Target", level: "AA", notes: "Interactive avatars must have at least 44x44px touch area, even for Small sizes" },
    ],
    outro: [
      "In avatar groups, announce the total count and visible names to screen readers via an aria-label on the group container",
      "Status badges should use aria-label (e.g. 'Online') rather than relying on color alone",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Image Rendering", platform: "All", expectedResult: "User photo renders without distortion in a perfect circle with object-fit cover" },
    { check: "Fallback Chain", platform: "All", expectedResult: "Image error triggers initials; missing initials triggers icon; no broken image icon ever shown" },
    { check: "Initials Display", platform: "All", expectedResult: "1-2 uppercase characters centered in the circle with correct background color" },
    { check: "Status Badge", platform: "All", expectedResult: "Badge appears in correct position with white ring; color matches presence state" },
    { check: "Avatar Group", platform: "All", expectedResult: "Avatars overlap correctly with white border rings; overflow '+N' indicator appears when needed" },
    { check: "Focus State", platform: "Web", expectedResult: "Focus ring visible on Tab for interactive avatars; hidden for non-interactive ones" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces user name and presence status; group announces total count" },
  ],

  dos: [
    "Use the image-initials-icon fallback chain consistently across the application",
    "Apply a deterministic color-hashing algorithm for initials backgrounds",
    "Include a white border ring when avatars are stacked or placed on colored backgrounds",
    "Use the status badge to indicate real-time presence — keep it updated",
    "Provide alt text with the user's full name for all image avatars",
    "Use consistent sizes within the same context (e.g. all Medium in a comment thread)",
  ],

  donts: [
    "Do not display a broken image icon — always fall back gracefully",
    "Do not use square avatars for user photos — circles are the standard convention",
    "Do not scale avatars beyond Extra Large (64px) without design approval",
    "Do not use status badges on non-interactive or decorative avatars",
    "Do not crop initials — use single characters for Extra Small sizes",
    "Do not stack more than 8 avatars in a group without an overflow indicator",
    "Do not use low-resolution images — minimum 2x the display size for retina screens",
  ],
};
