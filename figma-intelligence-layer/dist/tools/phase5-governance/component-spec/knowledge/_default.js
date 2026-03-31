"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultKnowledge = void 0;
exports.defaultKnowledge = {
    description: "UI component | Reusable interface element | Design system building block",
    stateSpecifications: [
        {
            state: "Default",
            visualChange: "Base appearance with standard styling",
            opacity: "1",
            cursorWeb: "default",
            usage: "Resting state when no interaction is occurring",
        },
        {
            state: "Hover",
            visualChange: "Subtle visual emphasis to indicate interactivity",
            opacity: "1",
            cursorWeb: "pointer",
            usage: "Mouse cursor enters the interactive area",
        },
        {
            state: "Disabled",
            visualChange: "Reduced contrast, muted colors",
            opacity: "0.4",
            cursorWeb: "not-allowed",
            usage: "Component is non-interactive due to current context",
        },
        {
            state: "Focus",
            visualChange: "Visible focus ring or outline",
            opacity: "1",
            cursorWeb: "default",
            usage: "Component receives keyboard focus",
        },
    ],
    propertyDescriptions: {
        disabled: "When true the component is non-interactive and visually muted",
        children: "Content rendered inside the component",
    },
    sizeSpecifications: [
        {
            size: "Small",
            height: "32px",
            paddingLR: "8px",
            fontSize: "12px",
            iconSize: "16px",
            borderRadius: "4px",
        },
        {
            size: "Medium",
            height: "40px",
            paddingLR: "12px",
            fontSize: "14px",
            iconSize: "20px",
            borderRadius: "6px",
        },
        {
            size: "Large",
            height: "48px",
            paddingLR: "16px",
            fontSize: "16px",
            iconSize: "24px",
            borderRadius: "8px",
        },
    ],
    designTokenBindings: [
        {
            property: "Background",
            tokenName: "$surface-default",
            role: "Component background fill",
            fallback: "#FFFFFF",
        },
        {
            property: "Border",
            tokenName: "$border-default",
            role: "Component border color",
            fallback: "#D0D5DD",
        },
        {
            property: "Text Color",
            tokenName: "$text-primary",
            role: "Primary text content",
            fallback: "#101828",
        },
        {
            property: "Focus Ring",
            tokenName: "$focus-ring",
            role: "Visible keyboard focus indicator",
            fallback: "0 0 0 2px #2E90FA",
        },
    ],
    structureRules: [
        "Use Auto Layout for all internal arrangement",
        "Respect consistent padding and spacing tokens",
        "Ensure minimum 44x44px touch target on interactive elements",
        "Keep the layer tree flat; avoid unnecessary nesting",
    ],
    typeHierarchyRules: [
        "Use the design system's type scale — do not hard-code font sizes",
        "Maintain consistent line-height across label text",
        "Sentence case for UI labels unless the system specifies otherwise",
    ],
    interactionRules: [
        { event: "Click / Tap", trigger: "pointerdown + pointerup inside bounds", action: "Trigger primary action" },
        { event: "Focus", trigger: "Tab key or programmatic focus", action: "Show focus indicator" },
        { event: "Blur", trigger: "Focus leaves component", action: "Remove focus indicator" },
    ],
    contentGuidance: [
        "Keep text labels concise and action-oriented where applicable",
        "Use placeholder text sparingly — prefer visible labels",
        "Ensure all decorative icons have empty alt text; meaningful icons need descriptive alt text",
    ],
    responsiveBehaviour: [
        { breakpoint: "Mobile (<768px)", behavior: "Stack elements vertically; increase touch targets" },
        { breakpoint: "Desktop (>=1024px)", behavior: "Use standard sizing and horizontal layouts" },
    ],
    accessibilitySpec: {
        intro: "All components must meet WCAG 2.1 AA. Verify keyboard access, screen reader announcements, and color contrast.",
        requirements: [
            { requirement: "Focusable", level: "A", notes: "Must be reachable via Tab key when interactive" },
            { requirement: "Contrast Ratio", level: "AA", notes: "Text: 4.5:1 minimum; large text and UI controls: 3:1" },
            { requirement: "Screen Reader", level: "A", notes: "Announce role, name, and state to assistive technology" },
        ],
        outro: [
            "Test with at least one screen reader (VoiceOver, NVDA, or JAWS)",
            "Never rely on color alone to convey meaning",
        ],
    },
    qaAcceptanceCriteria: [
        { check: "Visual Regression", platform: "All", expectedResult: "No unintended visual changes from baseline" },
        { check: "Keyboard Navigation", platform: "Web", expectedResult: "All interactive elements reachable and operable via keyboard" },
        { check: "Screen Reader", platform: "Web", expectedResult: "Role, name, and state announced correctly" },
        { check: "Disabled State", platform: "All", expectedResult: "Non-interactive appearance; no event firing" },
        { check: "Contrast", platform: "All", expectedResult: "Meets WCAG AA contrast ratios" },
    ],
    dos: [
        "Follow the design system's spacing and color tokens",
        "Provide visible focus indicators for keyboard users",
        "Test across supported breakpoints",
        "Use semantic HTML elements where possible",
    ],
    donts: [
        "Do not override token values with hard-coded colors",
        "Do not remove focus outlines without providing an alternative",
        "Do not rely solely on hover states for critical information",
        "Do not nest interactive elements inside other interactive elements",
    ],
};
//# sourceMappingURL=_default.js.map