"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// VPAT Report Builder
// Takes raw audit issues + the criteria registry and produces a structured
// VPAT-style accessibility conformance report with rich, design-aware remarks.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVPATReport = buildVPATReport;
const wcag_criteria_js_1 = require("./wcag-criteria.js");
// ─────────────────────────────────────────────────────────────────────────────
// Conformance determination
// ─────────────────────────────────────────────────────────────────────────────
function determineConformance(criterion, issues, override) {
    if (override)
        return override;
    const { checkCapability } = criterion;
    // Manual criteria cannot be evaluated by the tool
    if (checkCapability === "manual") {
        return "Not Evaluated";
    }
    const hasErrors = issues.some((i) => i.severity === "error");
    const hasWarnings = issues.some((i) => i.severity === "warning" || i.severity === "suggestion");
    if (checkCapability === "automated") {
        if (hasErrors)
            return "Does Not Support";
        if (hasWarnings)
            return "Partially Supports";
        return "Supports";
    }
    // Heuristic: even with zero issues, we can only claim partial support
    if (checkCapability === "heuristic") {
        if (hasErrors)
            return "Does Not Support";
        if (hasWarnings)
            return "Partially Supports";
        // No issues found, but check was not exhaustive
        return "Partially Supports";
    }
    return "Not Evaluated";
}
// ─────────────────────────────────────────────────────────────────────────────
// Context-aware remarks builder
// ─────────────────────────────────────────────────────────────────────────────
function buildRemarks(criterion, issues, conformance, ctx) {
    const parts = [];
    if (conformance === "Not Applicable") {
        parts.push(getNotApplicableReason(criterion, ctx));
        return parts.join(" ");
    }
    if (conformance === "Not Evaluated") {
        parts.push(getDesignAwareManualGuidance(criterion, ctx));
        return parts.join(" ");
    }
    // ── Issues found ──────────────────────────────────────────────────────────
    if (issues.length > 0) {
        const errorCount = issues.filter((i) => i.severity === "error").length;
        const warningCount = issues.filter((i) => i.severity === "warning").length;
        const suggestionCount = issues.filter((i) => i.severity === "suggestion").length;
        // Severity summary
        const counts = [];
        if (errorCount > 0)
            counts.push(`${errorCount} error(s)`);
        if (warningCount > 0)
            counts.push(`${warningCount} warning(s)`);
        if (suggestionCount > 0)
            counts.push(`${suggestionCount} suggestion(s)`);
        parts.push(`Found ${counts.join(", ")} across ${ctx.totalNodes} nodes scanned.`);
        // Group issues by type for a richer summary
        const issuesByType = new Map();
        for (const issue of issues) {
            const key = issue.issue.split(".")[0].split(":")[0].trim();
            const existing = issuesByType.get(key) || [];
            existing.push(issue);
            issuesByType.set(key, existing);
        }
        // Show grouped issue summaries (up to 5 groups)
        const groups = Array.from(issuesByType.entries()).slice(0, 5);
        for (const [type, groupIssues] of groups) {
            if (groupIssues.length === 1) {
                const i = groupIssues[0];
                parts.push(`- ${i.nodeName}: ${i.issue}`);
            }
            else {
                const nodeNames = groupIssues
                    .slice(0, 3)
                    .map((i) => i.nodeName)
                    .join(", ");
                const suffix = groupIssues.length > 3
                    ? ` (+${groupIssues.length - 3} more)`
                    : "";
                parts.push(`- ${type} — affects: ${nodeNames}${suffix}`);
            }
        }
        if (issuesByType.size > 5) {
            parts.push(`... and ${issuesByType.size - 5} more issue categories.`);
        }
        // Actionable fix guidance
        const fixes = new Set();
        for (const issue of issues) {
            if (issue.suggestedFix && fixes.size < 3) {
                fixes.add(issue.suggestedFix);
            }
        }
        if (fixes.size > 0) {
            parts.push("Recommended fixes:");
            for (const fix of fixes) {
                parts.push(`  → ${fix}`);
            }
        }
    }
    else {
        // ── No issues — heuristic or automated pass ───────────────────────────
        parts.push(getPassRemarks(criterion, ctx));
    }
    return parts.join("\n");
}
// ─────────────────────────────────────────────────────────────────────────────
// Criterion-specific remark generators
// ─────────────────────────────────────────────────────────────────────────────
function getNotApplicableReason(criterion, ctx) {
    const id = criterion.id;
    // Time-based media criteria
    if (id.startsWith("1.2")) {
        return `Not applicable — "${ctx.frameName}" is a static UI design with no audio or video content. If the final product introduces media players or video embeds, re-evaluate this criterion.`;
    }
    if (id === "1.4.2") {
        return `Not applicable — no auto-playing audio content detected in this static design. If the implementation adds background audio, sound effects, or media players, ensure a pause/stop/mute control is provided.`;
    }
    return `Not applicable to this design context. Re-evaluate if the implementation introduces related functionality.`;
}
function getDesignAwareManualGuidance(criterion, ctx) {
    const id = criterion.id;
    const parts = [];
    parts.push("[Manual Review Required]");
    switch (id) {
        // ── 1.2.x Time-based Media ──────────────────────────────────────────
        case "1.2.1":
            parts.push(`This static design does not contain audio/video, but the final implementation for "${ctx.frameName}" may include media content.`, "DEV ACTION: If any audio-only or video-only prerecorded content is added, provide a transcript (audio) or text/audio alternative (video).", "QA CHECK: Verify transcripts are accurate and complete.");
            break;
        case "1.2.2":
            parts.push(`No video content present in this Figma design.`, "DEV ACTION: All prerecorded video with audio must include synchronised captions. Use WebVTT format. Ensure captions are accurate, synchronised, and include speaker identification.", "QA CHECK: Review captions for accuracy and timing across all video content.");
            break;
        case "1.2.3":
            parts.push(`No video content in this static design.`, "DEV ACTION: Provide audio description or a full text alternative for prerecorded video. Audio descriptions should narrate visual-only information not conveyed through dialogue.", "QA CHECK: Verify audio descriptions cover all visual information essential to understanding the content.");
            break;
        case "1.2.4":
            parts.push("DEV ACTION: If live video with audio is implemented, real-time captions must be provided. Consider integrating a live captioning service.", "QA CHECK: Test live captioning accuracy and latency.");
            break;
        case "1.2.5":
            parts.push("DEV ACTION: Provide audio descriptions for all prerecorded video content where the soundtrack alone does not convey all visual information.", "QA CHECK: Audio descriptions should cover actions, scene changes, and on-screen text not spoken in dialogue.");
            break;
        // ── 1.3.3 Sensory Characteristics ───────────────────────────────────
        case "1.3.3": {
            parts.push(`Design "${ctx.frameName}" contains ${ctx.textNodeCount} text elements.`);
            if (ctx.hasFormInputs) {
                parts.push("RISK: Form instructions may rely on visual position (\"the field on the left\") or color (\"fields in red are required\"). Ensure all instructions also use text labels.");
            }
            if (ctx.hasNavigation) {
                parts.push("RISK: Navigation cues must not rely solely on shape or position. Ensure active/current state is conveyed through text (e.g., aria-current) not just color.");
            }
            parts.push("DEV ACTION: Review all instructional text. Replace references like \"click the green button\" or \"see the sidebar\" with explicit labels. Use aria-describedby for supplementary instructions.", "QA CHECK: Disable CSS and verify instructions still make sense without visual cues.");
            break;
        }
        // ── 2.1.x Keyboard Accessible ──────────────────────────────────────
        case "2.1.1": {
            parts.push(`Design contains ${ctx.interactiveCount} interactive elements: ${summarizeInteractiveBreakdown(ctx)}.`);
            if (ctx.interactiveLabels.length > 0) {
                const sample = ctx.interactiveLabels.slice(0, 6).join(", ");
                parts.push(`Key elements to verify: ${sample}.`);
            }
            parts.push("DEV ACTION: All interactive elements must be operable via keyboard (Tab to focus, Enter/Space to activate). Custom widgets must implement WAI-ARIA APG keyboard patterns.", "QA CHECK: Tab through every interactive element. Verify all actions are reachable and operable without a mouse. Test with screen reader in forms mode.");
            break;
        }
        case "2.1.2": {
            const trapRisks = [];
            if (ctx.interactiveBreakdown["modal"] || ctx.interactiveBreakdown["dialog"])
                trapRisks.push("modal dialogs (must trap focus but allow Esc to dismiss)");
            if (ctx.hasFormInputs)
                trapRisks.push("form fields with autocomplete dropdowns");
            if (ctx.interactiveBreakdown["menu"])
                trapRisks.push("menus/dropdowns");
            parts.push(`Design has ${ctx.interactiveCount} interactive elements.`);
            if (trapRisks.length > 0) {
                parts.push(`Keyboard trap risk areas: ${trapRisks.join("; ")}.`);
            }
            parts.push("DEV ACTION: Ensure focus can always be moved away using standard keys (Tab, Shift+Tab, Escape). For modals, trap focus within the dialog but allow Escape to close.", "QA CHECK: Navigate with keyboard only through all interactive paths. Verify you can always Tab away or Escape out.");
            break;
        }
        case "2.1.4":
            parts.push("DEV ACTION: If single character key shortcuts (e.g., 'S' for search, 'N' for next) are implemented, provide settings to remap or disable them. Modifier-key shortcuts (Ctrl+S) are exempt.", "QA CHECK: Test that all single-key shortcuts can be turned off or remapped.");
            break;
        // ── 2.2.x Enough Time ──────────────────────────────────────────────
        case "2.2.1":
            parts.push(`Review "${ctx.frameName}" implementation for any time-limited interactions (session timeouts, auto-advancing carousels, countdown timers).`, "DEV ACTION: For each time limit, provide controls to extend (10x default), turn off, or adjust the limit. Warn users at least 20 seconds before expiry.", "QA CHECK: Identify all time-limited interactions and verify extension mechanisms work.");
            break;
        case "2.2.2":
            parts.push("DEV ACTION: Any auto-moving, blinking, or auto-updating content must have a pause/stop/hide mechanism. This includes carousels, news tickers, and real-time updates.", "QA CHECK: Verify the pause mechanism persists across page interactions.");
            break;
        // ── 2.3.x Seizures ────────────────────────────────────────────────
        case "2.3.1":
            parts.push("DEV ACTION: No content should flash more than 3 times per second. This applies to animations, video, GIFs, and CSS transitions. Use the Photosensitive Epilepsy Analysis Tool (PEAT) to test.", "QA CHECK: Review all animations and transitions for flash frequency.");
            break;
        // ── 2.4.x Navigable ───────────────────────────────────────────────
        case "2.4.1": {
            parts.push(`Design "${ctx.frameName}" has ${ctx.landmarkNames.length > 0 ? "landmarks: " + ctx.landmarkNames.join(", ") : "no detected landmark regions"}.`);
            if (ctx.hasNavigation) {
                parts.push("IMPORTANT: Navigation block detected — a skip link must be provided to bypass repeated navigation and jump to main content.");
            }
            parts.push("DEV ACTION: Add a visually hidden \"Skip to main content\" link as the first focusable element. Implement ARIA landmarks: <nav>, <main>, <header>, <footer>. These provide screen reader skip navigation.", "QA CHECK: Tab to the first element — verify a skip link appears. Test with screen reader landmark navigation (NVDA: D key, VoiceOver: rotor).");
            break;
        }
        case "2.4.2":
            parts.push(`This page is named "${ctx.frameName}" in Figma. The HTML <title> must describe the page's topic and purpose.`, "DEV ACTION: Set a descriptive <title> like \"Checkout - Address Selection | Store Name\". For SPAs, update document.title on route change.", "QA CHECK: Check browser tab for a meaningful, unique title on every page/view.");
            break;
        case "2.4.5":
            parts.push(`Design contains navigation elements.`, "DEV ACTION: Provide at least two ways to find any page: navigation menu, site search, sitemap, table of contents, or A-Z index.", "QA CHECK: Verify users can reach every page through at least two distinct mechanisms.");
            break;
        // ── 2.5.x Input Modalities ────────────────────────────────────────
        case "2.5.1":
            parts.push("DEV ACTION: All multipoint gestures (pinch-zoom, two-finger scroll, multi-finger swipe) must have single-pointer alternatives (e.g., +/- buttons for zoom).", "QA CHECK: Disable multi-touch and verify all features remain accessible via single tap/click.");
            break;
        case "2.5.2":
            parts.push("DEV ACTION: Actions must activate on pointer-up (not pointer-down), and the user must be able to abort by moving the pointer away before releasing. This applies to all buttons and interactive elements.", "QA CHECK: Press and hold an interactive element, move pointer away, and release — verify no activation occurs.");
            break;
        case "2.5.4":
            parts.push("DEV ACTION: Any functionality triggered by device motion (shake to undo, tilt to scroll) must also have a UI button alternative, and motion triggering must be disableable to prevent accidental activation.", "QA CHECK: Verify all motion-triggered features have equivalent button controls.");
            break;
        case "2.5.7":
            parts.push("DEV ACTION: Drag-and-drop functionality (e.g., reordering lists) must have a single-pointer alternative (e.g., move up/down buttons or a sort dialog).", "QA CHECK: Test all drag interactions without dragging — verify alternative controls exist.");
            break;
        // ── 3.1.x Readable ────────────────────────────────────────────────
        case "3.1.1":
            parts.push("DEV ACTION: Set lang attribute on <html> element matching the primary language of the content (e.g., <html lang=\"en\">). This enables correct screen reader pronunciation.", "QA CHECK: Inspect <html> element and verify lang attribute is present and correct.");
            break;
        case "3.1.2": {
            parts.push("DEV ACTION: Wrap any content in a different language with the appropriate lang attribute (e.g., <span lang=\"fr\">Bonjour</span>). This allows screen readers to switch pronunciation.", "QA CHECK: Review text content for foreign-language phrases and verify lang attributes.");
            break;
        }
        // ── 3.2.x Predictable ─────────────────────────────────────────────
        case "3.2.1":
            parts.push(`Design has ${ctx.interactiveCount} focusable elements.`, "DEV ACTION: No element should trigger a context change (page navigation, new window, form submission) simply by receiving focus. Activations must require explicit user action (click/Enter).", "QA CHECK: Tab through all elements and verify no unexpected navigation or popups occur on focus alone.");
            break;
        case "3.2.2": {
            parts.push(`Design contains ${ctx.hasFormInputs ? "form inputs that" : "interactive elements that"} must not auto-submit or navigate on value change.`);
            if (ctx.hasFormInputs) {
                parts.push("RISK: Dropdowns and radio buttons that immediately navigate or submit without a dedicated \"Apply\" or \"Submit\" button violate this criterion.");
            }
            parts.push("DEV ACTION: Do not auto-submit forms or navigate on select/radio change unless users are warned in advance. Provide explicit submit buttons.", "QA CHECK: Change every form control value and verify no unexpected page changes occur.");
            break;
        }
        case "3.2.3":
            parts.push(`Navigation structure in "${ctx.frameName}" must remain consistent across all pages.`, "DEV ACTION: Navigation menus must appear in the same position and order on every page. New items may be added but existing item order must be preserved.", "QA CHECK: Compare navigation across multiple pages — verify order and position are consistent.");
            break;
        case "3.2.4":
            parts.push("DEV ACTION: Components with the same function must use the same labels and icons across all pages (e.g., don't use \"Search\" on one page and \"Find\" on another for the same feature).", "QA CHECK: Cross-reference common actions (search, save, delete) across pages for consistency.");
            break;
        case "3.2.6":
            parts.push("DEV ACTION: If help mechanisms exist (contact info, chat widget, FAQ link), place them in the same relative position on every page.", "QA CHECK: Verify help mechanism position is consistent across all pages.");
            break;
        // ── 3.3.x Input Assistance ────────────────────────────────────────
        case "3.3.4": {
            parts.push(`"${ctx.frameName}" ${ctx.hasFormInputs ? "contains form inputs" : "may involve data submission"}.`);
            parts.push("IMPORTANT: If this page involves financial transactions, legal commitments, or user-controlled data: (1) submissions must be reversible, (2) data must be checked for errors and the user given an opportunity to correct, or (3) a confirmation/review step must be provided before final submission.", "DEV ACTION: Add a review step before checkout/payment. Show a summary of all entered data with an \"Edit\" option. Provide \"Undo\" for irreversible actions.", "QA CHECK: Complete a full transaction flow and verify there is a review/confirmation step before final submission.");
            break;
        }
        case "3.3.7": {
            parts.push(`"${ctx.frameName}" ${ctx.hasFormInputs ? "contains form fields" : "may be part of a multi-step flow"}.`);
            parts.push("DEV ACTION: If the user has already provided information in a previous step (name, address, email), auto-populate it or offer a selection rather than requiring re-entry.", "QA CHECK: Walk through multi-step flows and verify previously entered data is not requested again.");
            break;
        }
        case "3.3.8":
            parts.push("DEV ACTION: Authentication must not require cognitive function tests (CAPTCHAs, puzzles). Allow password managers, passkeys, and WebAuthn. If CAPTCHAs are used, provide an audio alternative.", "QA CHECK: Test login/auth flows with a password manager and verify it works without cognitive tests.");
            break;
        // ── 4.1.x Robust ──────────────────────────────────────────────────
        case "4.1.3": {
            parts.push(`Design "${ctx.frameName}" has ${ctx.interactiveCount} interactive elements that may produce status messages.`);
            parts.push("DEV ACTION: Status messages (success confirmations, error counts, search result counts, cart updates) must use aria-live regions or appropriate ARIA roles (role=\"status\", role=\"alert\") so screen readers announce them without focus moving.", "IMPLEMENTATION: Use role=\"status\" + aria-live=\"polite\" for non-urgent updates (cart count, search results). Use role=\"alert\" + aria-live=\"assertive\" for errors or urgent messages.", "QA CHECK: Trigger status messages (add to cart, form submission, search) and verify screen reader announces them without focus change.");
            break;
        }
        default:
            // Fallback: use the criterion's manual guidance with design context
            parts.push(criterion.manualGuidance);
            if (ctx.interactiveCount > 0) {
                parts.push(`This design contains ${ctx.interactiveCount} interactive elements and ${ctx.textNodeCount} text nodes that should be reviewed against this criterion.`);
            }
            parts.push(`DEV ACTION: Review the implementation of "${ctx.frameName}" against this WCAG criterion during development and QA testing.`);
            break;
    }
    return parts.join("\n");
}
/** Provide rich pass remarks for heuristic/automated checks with no issues */
function getPassRemarks(criterion, ctx) {
    const id = criterion.id;
    const isHeuristic = criterion.checkCapability === "heuristic";
    const prefix = isHeuristic
        ? "No issues detected via heuristic analysis."
        : "All automated checks passed.";
    switch (id) {
        case "1.1.1":
            return `${prefix} Scanned ${ctx.imageCount} image/vector nodes — all have adjacent text labels or descriptive naming.\nDEV ACTION: Verify each image has appropriate alt text in HTML. Decorative images should use alt="" and role="presentation". Icons should use aria-label or sr-only text.\nMANUAL VERIFY: Check that alt text accurately describes the image purpose, not just the file name.`;
        case "1.3.1":
            return `${prefix} Detected ${ctx.hasHeadings ? "heading hierarchy from font size/weight" : "no clear heading hierarchy"}. Found ${ctx.textNodeCount} text nodes with ${ctx.headingTexts.length > 0 ? "headings: " + ctx.headingTexts.slice(0, 4).join(", ") : "no headings detected"}.\nDEV ACTION: Map visual heading hierarchy to semantic HTML (h1-h6). Use <ul>/<ol> for lists, <table> for tabular data. Group related form fields in <fieldset> with <legend>.\nMANUAL VERIFY: Ensure heading levels don't skip (e.g., h1 → h3) and all sections have headings.`;
        case "1.3.2":
            return `${prefix} Compared Figma layer order against visual layout positions for ${ctx.frameCount} frames.\nDEV ACTION: Ensure DOM order matches visual reading order (top-to-bottom, left-to-right in LTR layouts). Use CSS for visual positioning, not DOM re-ordering. Test with CSS disabled.\nMANUAL VERIFY: Read the page with styles disabled — content should still make logical sense.`;
        case "1.3.4":
            return `${prefix} Design layout appears to be single-orientation.\nDEV ACTION: Do not lock viewport orientation with CSS (orientation: portrait). Content must work in both portrait and landscape unless a specific orientation is essential (e.g., piano app).\nMANUAL VERIFY: Test on mobile in both orientations.`;
        case "1.3.5":
            return `${prefix} Scanned ${ctx.interactiveCount} interactive elements for autocomplete purpose hints.\nDEV ACTION: Add autocomplete attributes to inputs collecting personal data: autocomplete="name", "email", "tel", "address-line1", etc. This enables browser auto-fill and helps users with cognitive disabilities.\nMANUAL VERIFY: Test that browser auto-fill populates form fields correctly.`;
        case "1.4.1":
            return `${prefix} Checked ${ctx.componentSetCount} component sets for color-only state differentiation.\nDEV ACTION: Ensure states (error, success, active, disabled) use icons, text, or borders in addition to color. Error states should have error icons + text, not just red coloring.\nMANUAL VERIFY: View the interface in grayscale (browser devtools) — all states should still be distinguishable.`;
        case "1.4.3":
            return `All ${ctx.textNodeCount} text nodes meet WCAG AA minimum contrast ratio (4.5:1 for normal text, 3:1 for large text 18px+/14px bold+).\nPASS DETAILS: All foreground/background pairs analysed from Figma fill properties.\nMANUAL VERIFY: Check contrast for text rendered over images, gradients, or dynamic backgrounds that may not be captured in static design.`;
        case "1.4.4":
            return `${prefix} No fixed-height containers with text children that would clip on resize were detected.\nDEV ACTION: Use relative units (rem, em, %) for typography and containers. Text must be resizable up to 200% without content loss.\nMANUAL VERIFY: Zoom browser to 200% and verify no text is clipped, overlaps, or becomes unreadable.`;
        case "1.4.5":
            return `${prefix} No rasterised text (images of text) detected.\nDEV ACTION: Always use real HTML text, not images of text. Exceptions: logos and cases where a particular visual presentation is essential.\nMANUAL VERIFY: Verify no text is embedded in images — select all text on the page to confirm.`;
        case "1.4.10":
            return `${prefix} Checked ${ctx.frameCount} frames for auto-layout usage and responsive constraints. ${ctx.hasAutoLayout ? "Auto-layout detected — good foundation for reflow." : "Warning: Limited auto-layout usage may indicate reflow issues."}\nDEV ACTION: Content must reflow to single-column at 320px viewport width without horizontal scrolling. Use CSS flexbox/grid with relative units.\nMANUAL VERIFY: Test at 320px wide viewport and 256px tall viewport.`;
        case "1.4.11":
            return `All ${ctx.interactiveCount} interactive element borders and icons meet 3:1 minimum contrast ratio against their backgrounds.\nDEV ACTION: UI components (buttons, form inputs, focus indicators) and meaningful graphics must maintain 3:1 contrast. This includes borders, icons, and graphical objects.\nMANUAL VERIFY: Check custom UI elements and state changes (hover, focus) maintain contrast.`;
        case "1.4.12":
            return `All ${ctx.textNodeCount} text nodes pass text spacing requirements.\nPASS DETAILS: Line height ≥ 1.5× font size, paragraph spacing ≥ 2× font size, letter spacing ≥ 0.12× font size, word spacing ≥ 0.16× font size.\nDEV ACTION: No content loss when users override text spacing. Avoid fixed-height containers for text. Use CSS that allows spacing overrides.\nMANUAL VERIFY: Apply the WCAG text spacing bookmarklet and verify no text is clipped.`;
        case "1.4.13":
            return `${prefix} Checked ${ctx.componentSetCount} component sets for hover/tooltip patterns.\nDEV ACTION: Content appearing on hover/focus must be: (1) dismissable with Escape key without moving focus, (2) hoverable — pointer can move over the new content without it disappearing, (3) persistent — remains visible until dismissed or focus moves.\nMANUAL VERIFY: Test all tooltips and hover content for these three requirements.`;
        case "2.4.3":
            return `${prefix} Compared interactive element positions against node tree order for ${ctx.interactiveCount} elements.\nDEV ACTION: Tab order should follow the visual reading order (generally top-to-bottom, left-to-right). Use tabindex="0" for custom interactive elements. Avoid tabindex > 0. Use CSS for layout, not DOM order changes.\nMANUAL VERIFY: Tab through the entire page and verify focus moves logically.`;
        case "2.4.4":
            return `${prefix} All link-like elements have descriptive text labels.\nDEV ACTION: Avoid generic link text ("Click here", "Read more", "Learn more"). If visual design requires short text, use aria-label or visually hidden text for full context (e.g., "Read more about Product Name").\nMANUAL VERIFY: List all links (NVDA: Insert+F7) — each should be understandable out of context.`;
        case "2.4.6":
            return `${prefix} Checked ${ctx.frameCount} sections for heading and label presence. ${ctx.headingTexts.length > 0 ? "Headings found: " + ctx.headingTexts.slice(0, 5).join(", ") + "." : "No headings detected."}\nDEV ACTION: Every section must have a descriptive heading. Form fields must have visible labels (not just placeholder text). Labels must describe the purpose of the input.\nMANUAL VERIFY: Confirm every section has a heading and every input has a persistent visible label.`;
        case "2.4.7":
            return `${prefix} Checked component sets for visible focus-state variants.\nDEV ACTION: All focusable elements must show a visible focus indicator. Default browser focus ring is acceptable. Custom focus styles must meet 3:1 contrast and at least 2px outline.\nMANUAL VERIFY: Tab through all elements and verify a clearly visible focus ring appears on each.`;
        case "2.4.11":
            return `${prefix} Checked component sets for focus indicator obscuration.\nDEV ACTION: When an element receives focus, it must not be completely hidden by other content (sticky headers, modals, toasts). Use scroll-margin to ensure focused elements are visible.\nMANUAL VERIFY: Tab through elements near sticky headers/footers and verify focus is never hidden.`;
        case "2.5.3":
            return `${prefix} Checked interactive components for label-in-name match.\nDEV ACTION: The accessible name (aria-label, alt text) must include the visible text label. e.g., if a button shows "Search", the accessible name should contain "Search" (not just "Magnifying glass icon").\nMANUAL VERIFY: For each labeled interactive element, verify that speaking the visible text activates it in voice control (Dragon NaturallySpeaking, Voice Control).`;
        case "2.5.5":
            return `All ${ctx.interactiveCount} interactive elements meet the enhanced 44×44px target size.\nDEV ACTION: Maintain minimum 44×44 CSS pixel click/tap targets. Smaller targets are allowed if an equivalent larger target exists, or spacing ensures no overlap.\nMANUAL VERIFY: Test on actual touch devices — verify all targets are easy to tap accurately.`;
        case "2.5.8":
            return `All ${ctx.interactiveCount} interactive elements meet the minimum 24×24px target size.\nDEV ACTION: Maintain at least 24×24 CSS pixel targets for pointer inputs. Inline links within text are exempt. Ensure spacing between adjacent targets prevents accidental activation.\nMANUAL VERIFY: Test on mobile — verify no adjacent targets cause mis-taps.`;
        case "3.3.1":
            return `${prefix} Checked ${ctx.componentSetCount} component sets for error-state variants with descriptive text.\nDEV ACTION: Error messages must: (1) identify the field in error, (2) describe the error in text, (3) not rely solely on color. Use aria-invalid="true" and aria-describedby pointing to the error message.\nMANUAL VERIFY: Trigger validation errors and verify screen reader announces which field has the error and what the error is.`;
        case "3.3.2":
            return `${prefix} Checked ${ctx.interactiveCount} interactive elements for visible label siblings.\nDEV ACTION: Every input must have a visible label (not just placeholder). Use <label for="id"> associations. Group related inputs in <fieldset> with <legend>. Provide format hints (e.g., "MM/DD/YYYY").\nMANUAL VERIFY: Clear all inputs and verify each has a persistent visible label that describes its purpose.`;
        case "3.3.3":
            return `${prefix} Error-state variants checked for suggestion text.\nDEV ACTION: When input errors are detected and corrections are known, suggest the fix (e.g., "Email must contain @" not just "Invalid email"). For constrained values, show valid options.\nMANUAL VERIFY: Trigger validation errors and verify helpful correction suggestions appear.`;
        case "4.1.2":
            return `${prefix} Checked ${ctx.interactiveCount} interactive elements for name/description properties and visible labels.\nDEV ACTION: Every interactive element must expose: (1) name — accessible label (aria-label, <label>, alt text), (2) role — element type (button, link, textbox) via semantic HTML or ARIA, (3) value — current state (checked, expanded, selected) via ARIA properties.\nMANUAL VERIFY: Test with screen reader — each element should announce its name, role, and state.`;
        default:
            return `${prefix} ${criterion.figmaRelevance}\nMANUAL VERIFY: ${criterion.manualGuidance}`;
    }
}
function summarizeInteractiveBreakdown(ctx) {
    const entries = Object.entries(ctx.interactiveBreakdown);
    if (entries.length === 0)
        return "no categorized elements";
    return entries
        .filter(([, count]) => count > 0)
        .map(([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`)
        .join(", ");
}
// ─────────────────────────────────────────────────────────────────────────────
// Markdown formatter
// ─────────────────────────────────────────────────────────────────────────────
function formatMarkdownReport(report) {
    const lines = [];
    lines.push(`# WCAG 2.2 Level ${report.evaluatedLevel} — Accessibility Conformance Report`);
    lines.push("");
    lines.push(`**Product:** ${report.nodeName} (Node ${report.nodeId})`);
    lines.push(`**Date:** ${report.evaluationDate}`);
    lines.push(`**WCAG Version:** ${report.wcagVersion}`);
    lines.push(`**Evaluation Level:** ${report.evaluatedLevel}`);
    lines.push("");
    // Summary
    lines.push("## Summary");
    lines.push("");
    lines.push(`| Metric | Count |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Criteria | ${report.summary.totalCriteria} |`);
    lines.push(`| Supports | ${report.summary.supports} |`);
    lines.push(`| Partially Supports | ${report.summary.partiallySupports} |`);
    lines.push(`| Does Not Support | ${report.summary.doesNotSupport} |`);
    lines.push(`| Not Applicable | ${report.summary.notApplicable} |`);
    lines.push(`| Not Evaluated (Manual Review) | ${report.summary.notEvaluated} |`);
    lines.push("");
    lines.push(`> **Automated checks:** ${report.summary.automatedChecks} | **Heuristic checks:** ${report.summary.heuristicChecks} | **Manual review required:** ${report.summary.manualReviewRequired}`);
    lines.push("");
    // Per-principle tables
    const principleOrder = [
        "Perceivable",
        "Operable",
        "Understandable",
        "Robust",
    ];
    for (const principle of principleOrder) {
        const rows = report.principles[principle];
        if (rows.length === 0)
            continue;
        lines.push(`## ${principle}`);
        lines.push("");
        lines.push(`| SC | Name | Level | Conformance | Check | Remarks |`);
        lines.push(`|----|------|-------|-------------|-------|---------|`);
        for (const row of rows) {
            const statusIcon = getStatusIcon(row.conformanceStatus);
            // Truncate remarks for table readability
            const shortRemarks = truncateRemarks(row.remarks, 200);
            lines.push(`| ${row.criterionId} | ${row.criterionName} | ${row.level} | ${statusIcon} ${row.conformanceStatus} | ${row.checkType} | ${shortRemarks} |`);
        }
        lines.push("");
    }
    // Detailed remarks section — full content for every criterion
    lines.push("## Detailed Assessment");
    lines.push("");
    for (const principle of principleOrder) {
        const rows = report.principles[principle];
        if (rows.length === 0)
            continue;
        lines.push(`### ${principle}`);
        lines.push("");
        for (const row of rows) {
            const statusIcon = getStatusIcon(row.conformanceStatus);
            lines.push(`#### ${row.criterionId} ${row.criterionName} — ${statusIcon} ${row.conformanceStatus}`);
            lines.push("");
            lines.push(row.remarks);
            lines.push("");
            // Include specific issues if any
            if (row.issues.length > 0) {
                lines.push("**Issues:**");
                for (const issue of row.issues) {
                    const severity = issue.severity.toUpperCase();
                    lines.push(`- **[${severity}]** \`${issue.nodeName}\` (${issue.nodeId}): ${issue.issue}`);
                    if (issue.currentValue) {
                        lines.push(`  - Current: ${issue.currentValue}`);
                    }
                    if (issue.suggestedFix) {
                        lines.push(`  - Fix: ${issue.suggestedFix}`);
                    }
                }
                lines.push("");
            }
        }
    }
    return lines.join("\n");
}
function getStatusIcon(status) {
    switch (status) {
        case "Supports":
            return "[PASS]";
        case "Partially Supports":
            return "[PARTIAL]";
        case "Does Not Support":
            return "[FAIL]";
        case "Not Applicable":
            return "[N/A]";
        case "Not Evaluated":
            return "[REVIEW]";
    }
}
function truncateRemarks(text, maxLen) {
    // For table display, take only the first line/sentence
    const firstLine = text.split("\n")[0];
    if (firstLine.length <= maxLen)
        return firstLine;
    return firstLine.slice(0, maxLen - 3) + "...";
}
// ─────────────────────────────────────────────────────────────────────────────
// Main builder
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Build a VPAT-style accessibility conformance report.
 *
 * @param evaluatedLevel - WCAG conformance level to evaluate
 * @param nodeId         - Figma node ID that was audited
 * @param nodeName       - Human-readable name of the audited node
 * @param issues         - All issues found by the checker functions
 * @param designContext  - Summary of design contents for contextual remarks
 * @param applicabilityOverrides - Optional overrides for specific SC (e.g. mark media criteria as N/A)
 */
function buildVPATReport(evaluatedLevel, nodeId, nodeName, issues, designContext, applicabilityOverrides) {
    const criteria = (0, wcag_criteria_js_1.getCriteriaForLevel)(evaluatedLevel);
    const today = new Date().toISOString().split("T")[0];
    // Default context if not provided (backwards compatibility)
    const ctx = designContext || {
        frameName: nodeName,
        totalNodes: 0,
        textNodeCount: 0,
        interactiveCount: 0,
        imageCount: 0,
        componentSetCount: 0,
        frameCount: 0,
        landmarkNames: [],
        interactiveLabels: [],
        hasFormInputs: false,
        hasNavigation: false,
        hasImages: false,
        hasHeadings: false,
        headingTexts: [],
        hasAutoLayout: false,
        sampleTexts: [],
        interactiveBreakdown: {},
    };
    // Group issues by criterion ID (match the leading SC number)
    const issuesByCriterion = new Map();
    for (const issue of issues) {
        // The criterion field may be "1.4.3" or "1.4.3 Contrast (Minimum)"
        const scId = issue.criterion.split(" ")[0];
        const existing = issuesByCriterion.get(scId) || [];
        existing.push(issue);
        issuesByCriterion.set(scId, existing);
    }
    const rows = [];
    const principles = {
        Perceivable: [],
        Operable: [],
        Understandable: [],
        Robust: [],
    };
    for (const criterion of criteria) {
        const scIssues = issuesByCriterion.get(criterion.id) || [];
        const override = applicabilityOverrides?.[criterion.id];
        const conformance = determineConformance(criterion, scIssues, override);
        const remarks = buildRemarks(criterion, scIssues, conformance, ctx);
        const row = {
            criterionId: criterion.id,
            criterionName: criterion.name,
            level: criterion.level,
            principle: criterion.principle,
            guideline: criterion.guideline,
            conformanceStatus: conformance,
            checkType: criterion.checkCapability,
            remarks,
            issues: scIssues,
        };
        rows.push(row);
        principles[criterion.principle].push(row);
    }
    // Compute summary
    const summary = {
        totalCriteria: rows.length,
        supports: rows.filter((r) => r.conformanceStatus === "Supports").length,
        partiallySupports: rows.filter((r) => r.conformanceStatus === "Partially Supports").length,
        doesNotSupport: rows.filter((r) => r.conformanceStatus === "Does Not Support").length,
        notApplicable: rows.filter((r) => r.conformanceStatus === "Not Applicable").length,
        notEvaluated: rows.filter((r) => r.conformanceStatus === "Not Evaluated").length,
        automatedChecks: criteria.filter((c) => c.checkCapability === "automated").length,
        heuristicChecks: criteria.filter((c) => c.checkCapability === "heuristic").length,
        manualReviewRequired: criteria.filter((c) => c.checkCapability === "manual").length,
    };
    const partial = {
        title: `WCAG 2.2 Level ${evaluatedLevel} Conformance Report`,
        wcagVersion: "2.2",
        evaluatedLevel,
        evaluationDate: today,
        nodeId,
        nodeName,
        summary,
        principles,
        rows,
    };
    return {
        ...partial,
        formattedReport: formatMarkdownReport(partial),
    };
}
//# sourceMappingURL=vpat-report.js.map