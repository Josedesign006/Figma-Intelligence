/**
 * status-dot.ts — Gold-standard design knowledge for Status Dot components
 */
import type { ComponentKnowledge } from "../types.js";

export const statusDotKnowledge: ComponentKnowledge = {
  description:
    "Simple colored dot indicator | Conveys status at a glance | Paired with text label for accessibility",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Solid filled circle in the corresponding status color with optional text label",
      opacity: "1",
      cursorWeb: "default",
      usage: "Resting state — dot displays current status; not interactive",
    },
    {
      state: "Success",
      visualChange: "Dot fill uses $status-dot-success token (green); communicates positive or completed status",
      opacity: "1",
      cursorWeb: "default",
      usage: "Operation succeeded, service is healthy, or item is approved",
    },
    {
      state: "Warning",
      visualChange: "Dot fill uses $status-dot-warning token (amber/yellow); communicates caution or degraded state",
      opacity: "1",
      cursorWeb: "default",
      usage: "Service is degraded, approaching a limit, or requires attention",
    },
    {
      state: "Error",
      visualChange: "Dot fill uses $status-dot-error token (red); communicates failure or critical issue",
      opacity: "1",
      cursorWeb: "default",
      usage: "Operation failed, service is down, or item has a blocking issue",
    },
    {
      state: "Info",
      visualChange: "Dot fill uses $status-dot-info token (blue); communicates neutral informational status",
      opacity: "1",
      cursorWeb: "default",
      usage: "General informational status — neither positive nor negative",
    },
    {
      state: "Neutral",
      visualChange: "Dot fill uses $status-dot-neutral token (gray); communicates inactive or unknown status",
      opacity: "1",
      cursorWeb: "default",
      usage: "No status determined, pending, or not yet started",
    },
    {
      state: "Offline",
      visualChange: "Dot fill uses $status-dot-neutral token with a hollow ring style or muted gray",
      opacity: "0.6",
      cursorWeb: "default",
      usage: "User or service is offline or unavailable",
    },
    {
      state: "Online",
      visualChange: "Dot fill uses $status-dot-online token (green); may include pulse animation",
      opacity: "1",
      cursorWeb: "default",
      usage: "User or service is actively online and available",
    },
  ],

  propertyDescriptions: {
    status: "Status variant controlling the dot color — success, warning, error, info, neutral, offline, or online",
    size: "Dimensional preset controlling dot diameter and optional label font-size (sm, md, lg)",
    label: "Visible text rendered beside the dot providing accessible context for the status color",
    pulse: "When true a subtle radial pulse animation plays on the dot to indicate live/active status",
  },

  sizeSpecifications: [
    {
      size: "Small",
      height: "16px",
      paddingLR: "0px",
      fontSize: "12px",
      iconSize: "8px",
      borderRadius: "50%",
    },
    {
      size: "Medium",
      height: "20px",
      paddingLR: "0px",
      fontSize: "14px",
      iconSize: "10px",
      borderRadius: "50%",
    },
    {
      size: "Large",
      height: "24px",
      paddingLR: "0px",
      fontSize: "16px",
      iconSize: "12px",
      borderRadius: "50%",
    },
  ],

  designTokenBindings: [
    {
      property: "Fill (Success)",
      tokenName: "$status-dot-success",
      role: "Dot fill color for success/healthy status",
      fallback: "#12B76A",
    },
    {
      property: "Fill (Warning)",
      tokenName: "$status-dot-warning",
      role: "Dot fill color for warning/degraded status",
      fallback: "#F79009",
    },
    {
      property: "Fill (Error)",
      tokenName: "$status-dot-error",
      role: "Dot fill color for error/critical status",
      fallback: "#F04438",
    },
    {
      property: "Fill (Info)",
      tokenName: "$status-dot-info",
      role: "Dot fill color for informational status",
      fallback: "#2E90FA",
    },
    {
      property: "Fill (Neutral)",
      tokenName: "$status-dot-neutral",
      role: "Dot fill color for inactive/unknown status",
      fallback: "#98A2B3",
    },
    {
      property: "Fill (Online)",
      tokenName: "$status-dot-online",
      role: "Dot fill color for online/available status",
      fallback: "#12B76A",
    },
    {
      property: "Label Color",
      tokenName: "$text-secondary",
      role: "Text color for the accompanying label",
      fallback: "#344054",
    },
    {
      property: "Font Family",
      tokenName: "$font-family-sans",
      role: "Label typeface",
      fallback: "Inter, system-ui, sans-serif",
    },
    {
      property: "Pulse Animation",
      tokenName: "$animation-pulse-duration",
      role: "Duration of the radial pulse keyframe animation",
      fallback: "1.5s ease-in-out infinite",
    },
  ],

  structureRules: [
    "Container uses horizontal Auto Layout with center vertical alignment",
    "Dot is a circle frame with equal width and height; border-radius is always 50%",
    "Label text is a direct sibling of the dot — no intermediate wrappers",
    "Spacing between dot and label uses the $spacing-xs token (4px default)",
    "When label is hidden, container collapses to dot size only",
    "Pulse animation uses a pseudo-element or separate layer behind the dot with opacity fade",
    "Dot must never be the sole indicator — always pair with a text label or tooltip",
  ],

  typeHierarchyRules: [
    "Label font weight is Regular (400) — status context comes from color and text, not weight",
    "Text uses sentence case ('Service healthy', not 'SERVICE HEALTHY')",
    "Label font size scales with the size prop; always one step smaller than body text",
    "No underline or decoration on label text",
  ],

  interactionRules: [
    { event: "None", trigger: "N/A", action: "Status dot is a non-interactive indicator; no pointer events by default" },
    { event: "Hover (optional)", trigger: "pointerenter on container", action: "If wrapped in a tooltip, show tooltip with full status description" },
    { event: "Pulse Start", trigger: "pulse prop set to true", action: "Begin radial pulse animation on the dot layer" },
    { event: "Pulse Stop", trigger: "pulse prop set to false", action: "Stop pulse animation; dot returns to static fill" },
    { event: "Status Change", trigger: "status prop updates", action: "Dot fill transitions smoothly to new status color using $transition-interactive" },
  ],

  contentGuidance: [
    "Always provide a text label next to the dot — color alone must never convey meaning (WCAG 1.4.1)",
    "Labels should describe the status concisely: 'Online', 'Degraded', 'Offline', 'Healthy'",
    "Avoid using status dots without context — always clarify what the status refers to",
    "For tables or lists, keep labels consistent across rows (e.g. all use the same vocabulary)",
    "Use the pulse animation sparingly — only for truly live/active indicators to avoid visual noise",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Dot and label render inline; label may truncate in tight table cells" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Standard rendering; no size changes" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Standard rendering; status dots commonly appear in tables, sidebars, and dashboards" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "No scaling — dot sizes remain fixed at their size-prop values" },
  ],

  accessibilitySpec: {
    intro:
      "Status dots rely on color to convey meaning, which is invisible to colorblind and screen-reader users. Accessible implementation is non-negotiable.",
    requirements: [
      { requirement: "Color Independence", level: "A", notes: "WCAG 1.4.1 — Color must not be the only visual means of conveying status; always include a text label" },
      { requirement: "ARIA Role", level: "A", notes: "Container should use role='status' so assistive tech announces changes as a live region" },
      { requirement: "Accessible Name", level: "A", notes: "The dot element itself needs aria-label (e.g. 'Status: Online') or be marked aria-hidden with the label providing context" },
      { requirement: "Contrast Ratio", level: "AA", notes: "Dot color against its background must meet 3:1 non-text contrast; label text must meet 4.5:1" },
      { requirement: "Live Region", level: "AA", notes: "When status changes dynamically, the container should be an aria-live='polite' region to announce updates" },
      { requirement: "Motion Sensitivity", level: "AAA", notes: "Pulse animation must respect prefers-reduced-motion and stop when the user preference is set" },
    ],
    outro: [
      "Never use a standalone dot without text — screen readers cannot perceive color",
      "When status dots appear in a table, ensure the column header clearly labels the data as 'Status'",
      "Test with high-contrast mode to verify dots remain visible against forced backgrounds",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Visual Regression", platform: "All", expectedResult: "Dot renders at correct size and color for each status variant" },
    { check: "Label Pairing", platform: "All", expectedResult: "Text label is always present and accurately describes the status" },
    { check: "Color Tokens", platform: "All", expectedResult: "Each status maps to its correct design token; no hard-coded hex values" },
    { check: "Pulse Animation", platform: "Web", expectedResult: "Pulse plays when pulse=true; stops when false; respects prefers-reduced-motion" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces status text via role='status' or aria-label; dot alone is not announced" },
    { check: "Color Blindness", platform: "All", expectedResult: "Status is distinguishable without color via the text label" },
    { check: "Contrast", platform: "All", expectedResult: "Dot meets 3:1 non-text contrast; label meets 4.5:1 text contrast" },
    { check: "Dynamic Update", platform: "Web", expectedResult: "Changing status prop updates dot color and label; aria-live region announces change" },
    { check: "Size Variants", platform: "All", expectedResult: "sm=8px dot, md=10px dot, lg=12px dot with proportional label sizing" },
    { check: "High Contrast Mode", platform: "Web", expectedResult: "Dot remains visible with a border or alternate indicator in forced-colors mode" },
    { check: "Tooltip Fallback", platform: "Web", expectedResult: "If label is hidden for space, tooltip provides full status description on hover/focus" },
    { check: "RTL Support", platform: "Web", expectedResult: "Label renders on the correct side of the dot in RTL layouts" },
  ],

  dos: [
    "Always pair the status dot with a visible text label for accessibility",
    "Use the pulse animation only for live/active indicators like 'Online' or 'Recording'",
    "Map each status type to its corresponding design token — never hard-code colors",
    "Use role='status' on the container for dynamic status updates",
    "Respect prefers-reduced-motion by disabling the pulse animation when set",
    "Keep label text concise and consistent across the interface",
    "Ensure sufficient contrast between the dot color and its background surface",
  ],

  donts: [
    "Do not use a status dot without a text label — color alone is not accessible (WCAG 1.4.1)",
    "Do not make the dot interactive — use a separate button or link for actions",
    "Do not use more than 6-7 status types in a single interface to avoid cognitive overload",
    "Do not hard-code hex values — always reference status design tokens",
    "Do not use the pulse animation on multiple dots simultaneously — it creates visual noise",
    "Do not resize dots outside the defined size presets (sm, md, lg)",
    "Do not rely on the dot as the primary content — it is a supplementary indicator only",
  ],
};
