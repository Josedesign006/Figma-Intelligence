"use strict";
/**
 * figma_component_doc — Comprehensive design system documentation generator
 *
 * Produces Uber uSpec / Carbon Design System-quality documentation for a
 * selected Figma component or component set.  Sections: overview, anatomy,
 * variants, states, spacing & structure, color tokens, typography, usage
 * guidelines, accessibility (via APG doc), and API / props table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.componentDocHandler = componentDocHandler;
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
const index_js_1 = require("../spec-generator/index.js");
const index_js_2 = require("../apg-doc/index.js");
const component_templates_js_1 = require("../../../shared/component-templates.js");
const typography_presets_js_1 = require("../../../shared/typography-presets.js");
const token_override_maps_js_1 = require("../../phase2-accuracy/variant-expander/token-override-maps.js");
const auto_layout_validator_js_1 = require("../../../shared/auto-layout-validator.js");
// ─── Deep data extraction via Figma Plugin API ──────────────────────────────
async function captureSpacingStructure(nodeId) {
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found");

      const entries = [];
      const queue = [node];
      while (queue.length > 0 && entries.length < 80) {
        const current = queue.shift();
        if (!current) break;
        if ("layoutMode" in current && current.layoutMode && current.layoutMode !== "NONE") {
          entries.push({
            element: current.name || "Unnamed",
            paddingTop: current.paddingTop || 0,
            paddingRight: current.paddingRight || 0,
            paddingBottom: current.paddingBottom || 0,
            paddingLeft: current.paddingLeft || 0,
            itemSpacing: current.itemSpacing || 0,
            width: Math.round(current.width || 0),
            height: Math.round(current.height || 0),
            layoutMode: String(current.layoutMode),
            layoutSizingH: "layoutSizingHorizontal" in current ? String(current.layoutSizingHorizontal || "FIXED") : "FIXED",
            layoutSizingV: "layoutSizingVertical" in current ? String(current.layoutSizingVertical || "FIXED") : "FIXED",
          });
        }
        if ("children" in current && current.children.length > 0) {
          for (const child of current.children.slice(0, 20)) {
            queue.push(child);
          }
        }
      }
      return entries;
    })();
  `);
    if (!result.success)
        return [];
    return result.result || [];
}
async function captureColorTokenMap(nodeId) {
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found");

      function rgbToHex(c) {
        var r = Math.round((c.r || 0) * 255);
        var g = Math.round((c.g || 0) * 255);
        var b = Math.round((c.b || 0) * 255);
        return "#" + [r, g, b].map(function(v) { return v.toString(16).padStart(2, "0"); }).join("");
      }

      const entries = [];
      const queue = [node];
      const varCache = {};

      while (queue.length > 0 && entries.length < 120) {
        const current = queue.shift();
        if (!current) break;

        async function processPaints(paints, boundVars, prop) {
          if (!Array.isArray(paints)) return;
          for (var i = 0; i < paints.length; i++) {
            var paint = paints[i];
            if (!paint || paint.type !== "SOLID") continue;
            var hex = paint.color ? rgbToHex(paint.color) : "#000000";
            var tokenName = "";
            var tokenId = "";
            if (boundVars && boundVars[prop]) {
              var binding = Array.isArray(boundVars[prop]) ? boundVars[prop][i] : boundVars[prop];
              if (binding && binding.id) {
                tokenId = binding.id;
                if (!varCache[tokenId]) {
                  try {
                    var v = await figma.variables.getVariableByIdAsync(tokenId);
                    varCache[tokenId] = v ? v.name : "";
                  } catch(e) { varCache[tokenId] = ""; }
                }
                tokenName = varCache[tokenId] || "";
              }
            }
            entries.push({
              element: current.name || "Unnamed",
              property: prop === "fills" ? "fill" : "stroke",
              colorHex: hex,
              tokenName: tokenName,
              tokenId: tokenId,
            });
          }
        }

        var bv = current.boundVariables || {};
        await processPaints(current.fills, bv, "fills");
        await processPaints(current.strokes, bv, "strokes");

        if ("children" in current && current.children.length > 0) {
          for (const child of current.children.slice(0, 20)) {
            queue.push(child);
          }
        }
      }
      return entries;
    })();
  `);
    if (!result.success)
        return [];
    return result.result || [];
}
async function captureTypographySpec(nodeId) {
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found");

      const entries = [];
      const queue = [node];

      while (queue.length > 0 && entries.length < 40) {
        const current = queue.shift();
        if (!current) break;

        if (current.type === "TEXT") {
          var fontFamily = current.fontName === figma.mixed ? "Mixed" : current.fontName.family;
          var fontStyle = current.fontName === figma.mixed ? "Mixed" : current.fontName.style;
          var fontSize = typeof current.fontSize === "number" ? current.fontSize : 0;
          var lineHeightPx = null;
          if (current.lineHeight && typeof current.lineHeight === "object" && current.lineHeight.unit === "PIXELS") {
            lineHeightPx = current.lineHeight.value;
          }
          var letterSpacing = 0;
          if (current.letterSpacing && typeof current.letterSpacing === "object" && current.letterSpacing.unit === "PIXELS") {
            letterSpacing = current.letterSpacing.value;
          }

          var tokenName = "";
          var bv = current.boundVariables || {};
          if (bv.fontFamily || bv.fontSize) {
            try {
              var varId = (bv.fontSize && bv.fontSize.id) || (bv.fontFamily && bv.fontFamily.id) || "";
              if (varId) {
                var v = await figma.variables.getVariableByIdAsync(varId);
                tokenName = v ? v.name : "";
              }
            } catch(e) {}
          }

          entries.push({
            element: current.name || "Text",
            characters: (current.characters || "").slice(0, 80),
            fontFamily: fontFamily,
            fontStyle: fontStyle,
            fontSize: fontSize,
            lineHeightPx: lineHeightPx,
            letterSpacing: letterSpacing,
            tokenName: tokenName,
          });
        }

        if ("children" in current && current.children.length > 0) {
          for (const child of current.children.slice(0, 20)) {
            queue.push(child);
          }
        }
      }
      return entries;
    })();
  `);
    if (!result.success)
        return [];
    return result.result || [];
}
// ─── Blueprint resolution ────────────────────────────────────────────────────
function resolveBlueprint(name) {
    // Exact match first
    const exact = (0, component_templates_js_1.getBlueprint)(name);
    if (exact)
        return exact;
    // Fuzzy match: strip common prefixes/suffixes and try again
    const stripped = name.replace(/^(ds|ui|app)[_\-/]*/i, "").replace(/[_\-/]*(component|widget|element)$/i, "");
    const fuzzy = (0, component_templates_js_1.getBlueprint)(stripped);
    if (fuzzy)
        return fuzzy;
    // Try each blueprint name as a substring match
    const lower = name.toLowerCase();
    return component_templates_js_1.COMPONENT_BLUEPRINTS.find((b) => lower.includes(b.name.toLowerCase()));
}
function collectBlueprintTokens(node) {
    const tokens = [];
    if (node.fillSemantic)
        tokens.push(node.fillSemantic);
    if (node.strokeSemantic)
        tokens.push(node.strokeSemantic);
    if (node.textFillSemantic)
        tokens.push(node.textFillSemantic);
    if (node.children) {
        for (const child of node.children) {
            tokens.push(...collectBlueprintTokens(child));
        }
    }
    return tokens;
}
function collectBlueprintChildren(node) {
    const children = [];
    if (node.children) {
        for (const child of node.children) {
            children.push(child);
            children.push(...collectBlueprintChildren(child));
        }
    }
    return children;
}
const COMPONENT_KNOWLEDGE = {
    button: {
        semanticElement: "<button>",
        ariaRole: "button",
        whenToUse: [
            "Use for primary actions that trigger an immediate operation such as form submission, record creation, or workflow progression.",
            "Use for destructive actions (delete, remove, revoke) that require a clear visual signal via the Destructive variant.",
            "Use for call-to-action elements that guide users through a multi-step flow — one Primary per visible region, supported by Secondary or Ghost variants.",
            "Use for toggle actions where pressed state feedback is needed (e.g., bold/italic in a toolbar) by combining with aria-pressed.",
            "Use for confirming or cancelling decisions inside modals, dialogs, and inline confirmation patterns.",
            "Use inside forms for submit and reset actions. Pair submit with Primary and reset with Ghost or Secondary.",
            "Use in toolbars and action bars where multiple actions share a row — apply the grouped placement rules from the Structure section.",
        ],
        whenNotToUse: [
            "Do not use for navigation to another page or URL — use a link (<a>) or a link styled as a button. Screen readers announce links differently from buttons, and mixing semantics confuses assistive technology users.",
            "Do not use multiple Primary buttons in the same visible region. If two actions compete for emphasis, demote one to Secondary.",
            "Do not use Button when the entire container is the click target (e.g., a clickable Card) — use the container's own interactive semantics instead.",
            "Do not use for inline text actions — use a link component for text-level navigation.",
            "Do not use a disabled button without a tooltip or adjacent text explaining why the action is unavailable. A disabled button with no explanation is a dead end for all users.",
            "Do not wrap a button inside another interactive element (link, button, or clickable container). Nested interactive elements are an HTML spec violation and break assistive technology.",
        ],
        purpose: "Button is the primary interactive control for triggering discrete, immediate actions. It converts user intent into system operations — submitting data, confirming decisions, opening overlays, or toggling state. Button exists as a distinct component because its emphasis hierarchy (Primary → Secondary → Ghost → Destructive) governs the visual weight of every action surface in the system.",
        behaviour: "On click or tap, the button triggers its associated action immediately. If the action is asynchronous (API call, file upload), the button transitions to Loading state: the label is replaced with a spinner, the button becomes non-interactive, and aria-busy is set to true. The button must not allow duplicate submissions — once Loading is active, pointer and keyboard activation are locked until the operation resolves or fails. On keyboard Enter or Space, the same action fires. The pressed state is visual only (background darkens) and lasts for the duration of the pointer-down or key-down event. Hover state applies on pointer-enter and removes on pointer-leave; it must not persist on touch devices. Disabled state removes the button from the tab order (tabindex=-1) and blocks all pointer events. Focus-visible state applies only on keyboard navigation, never on pointer focus.",
        interactionRules: "Keyboard: Enter and Space activate the button. Tab moves focus to the next focusable element; Shift+Tab moves backward. No arrow key navigation for standalone buttons. In a button group, arrow keys move between buttons and Tab exits the group (roving tabindex pattern). Pointer: click/tap triggers the action; long press has no additional behaviour. Hover shows the hover state layer; press shows the pressed state layer. Disabled: all pointer events are blocked (pointer-events: none); the button is removed from the tab order. Loading: the button is visually active but non-interactive; pointer and keyboard activation are locked; the spinner replaces the icon or label. Repeated rapid clicks must be debounced — only the first activation within the loading window takes effect.",
        contentGuidance: "Labels must be concise action verbs or verb phrases in sentence case: 'Save changes', 'Delete account', 'Add to cart'. Avoid vague labels like 'Submit', 'OK', 'Click here', or 'Go'. Maximum label length is 3-4 words; if more is needed, the action belongs in a different pattern (e.g., a confirmation dialog). Icons should reinforce the label meaning, not replace it — except for icon-only buttons, which require an aria-label. Icon-only buttons must use a Tooltip to surface the label on hover/focus. Truncation: button labels must never truncate. If the label does not fit, either shorten the text or use full-width mode. Localisation: allow 30-40% text expansion for translated labels; test with German and Finnish strings.",
        responsive: "On viewports below 768px, primary action buttons should expand to full-width (100% container width) for thumb-reachable targets. On desktop, buttons use intrinsic width determined by label + padding, with a minimum width of 120px to prevent undersized targets. Button groups stack vertically on mobile (<768px) with the primary action on top. In narrow containers (sidebars, panels), buttons may be full-width regardless of viewport. Touch targets expand to minimum 48px height on mobile (achieved via padding, not layout shift). Icon-only buttons retain their square aspect ratio across all breakpoints. On tablets (768px–1024px), buttons follow desktop sizing unless inside a mobile-style layout.",
        implementationNotes: "Use the native <button> element — never <div>, <span>, or <a> for button actions. For navigation that looks like a button, use <a> with button styling and role='link'. Support ref forwarding so parent components can manage focus programmatically. Implement loading state with aria-busy='true' on the button element and aria-live='polite' on an adjacent status region. Disabled buttons should use aria-disabled='true' rather than the HTML disabled attribute when the button needs to remain focusable (e.g., to show a tooltip explaining why it's disabled). Consume design tokens via CSS custom properties for background, text color, border, and radius — never hardcode hex values. Dark mode requires no component-level logic if semantic tokens are used correctly. Handle overflow by preventing label truncation; set white-space: nowrap and ensure the container grows. For analytics, fire a custom event on activation that includes the button variant, label text, and parent context.",
        keyboard: [
            { key: "Enter", action: "Activates the button" },
            { key: "Space", action: "Activates the button" },
            { key: "Tab", action: "Moves focus to the next focusable element" },
            { key: "Shift+Tab", action: "Moves focus to the previous focusable element" },
        ],
        focus: "The button is focusable by default via the native <button> element. Focus-visible ring appears only on keyboard navigation (not pointer click). Focus ring uses the color/semantic/border/focus token at 2px offset. When disabled, the button is removed from the tab order. After activation in a modal footer, focus should move to the next logical target (e.g., the new state or a success message). In button groups using roving tabindex, only the active button is in the tab order; arrow keys move between buttons.",
        screenReader: "The accessible name is computed from the visible text label. If an icon-only button has no visible text, it must have an aria-label or aria-labelledby pointing to a visually hidden element. Screen readers announce: role ('button'), name (label text), and state (disabled, pressed, expanded if applicable). Loading state is announced via aria-busy='true' and an adjacent aria-live region.",
        labels: "Accessible name is computed in this order: aria-labelledby > aria-label > visible text content > title attribute. For standard buttons, the visible label provides the accessible name — no additional ARIA is needed. For icon-only buttons, add aria-label with the action text (e.g., aria-label='Close'). For buttons with helper text or descriptions, use aria-describedby pointing to the description element. Never set aria-label and a visible label at the same time — they conflict.",
        stateAnnouncements: "Disabled: announced as 'dimmed' or 'unavailable' by screen readers via aria-disabled='true'. Pressed: for toggle buttons, use aria-pressed='true'/'false'. Expanded: for buttons controlling a disclosure (dropdown, accordion), use aria-expanded='true'/'false'. Loading: aria-busy='true' suppresses announcements until the operation completes; pair with an aria-live='polite' region for status updates.",
        contrast: "Button label text must meet WCAG 2.2 Level AA: 4.5:1 against the button background for normal text (14px medium), 3:1 for large text (18px+ or 14px bold). The button background must meet 3:1 non-text contrast against the surrounding surface. Focus ring must be visible against both the button background and the page background. Disabled buttons are exempt from contrast requirements but should maintain 3:1 for readability. Icon fills follow the same rules as text contrast.",
        touchTargets: "Minimum touch target is 44×44px (WCAG 2.5.8). The sm size (32px height) meets this only if horizontal padding provides sufficient width; pair with vertical padding or spacing to reach 44px effective target. In mobile contexts, prefer md (40px) or lg (48px) sizes. Spacing between adjacent buttons must be at least 8px to prevent accidental activation of the wrong target.",
    },
    input: {
        semanticElement: "<input>",
        ariaRole: "textbox",
        whenToUse: [
            "Use for collecting single-line text input: names, emails, phone numbers, search queries, short answers.",
            "Use inside forms where validation feedback is needed — the Input component supports Default, Focused, Error, and Disabled states.",
            "Use for search bars with a leading search icon and optional trailing clear action.",
            "Use for filtered lists where real-time text filtering narrows results.",
            "Use when the expected input is short (under ~80 characters). For longer content, use Textarea.",
        ],
        whenNotToUse: [
            "Do not use for multi-line content — use a Textarea component instead.",
            "Do not use without a visible label. Placeholder text is not a label substitute — it disappears on input and is not reliably announced by all screen readers.",
            "Do not use for selection from a known set of options — use Select, Radio, or Checkbox instead.",
            "Do not use for rich text entry — use a rich text editor component.",
            "Do not use for date, time, or numeric-only entry without an appropriate input type attribute (type='date', type='number').",
        ],
        purpose: "Input provides a single-line text entry point for capturing user data. It pairs a visible label with a constrained input field, supporting validation states (error, success), helper text, and leading/trailing icon slots. Input exists as a distinct component to standardize form field behaviour, spacing, and error handling across all product surfaces.",
        behaviour: "On focus (click or Tab), the field border transitions from default to focus color (color/semantic/field/border/focus) and the cursor appears at the end of any existing value. Placeholder text is visible only when the field is empty and not focused in some implementations, or remains until input begins. On input, real-time validation may run after a debounce period (300ms recommended). On blur, full validation triggers: if validation fails, the field transitions to Error state with a red border (color/semantic/feedback/danger/text) and an error message appears below the field via aria-describedby. Helper text below the field persists across all states except Error, where it is replaced by the error message. The trailing icon slot can host a clear button (×) that appears when the field has content.",
        interactionRules: "Keyboard: Tab focuses the field; Shift+Tab moves focus backward. Typing inserts characters at the cursor. Escape may clear the field or revert to the previous value (implementation-specific). Ctrl+A selects all text. Pointer: click focuses and places cursor at the click position. Double-click selects a word; triple-click selects all text. Focus ring must be visible at all times during keyboard navigation. For autocomplete inputs: arrow keys navigate suggestions, Enter selects the highlighted suggestion, Escape closes the suggestion list.",
        contentGuidance: "Labels must describe the expected input in sentence case ('Email address', not 'EMAIL ADDRESS' or 'Enter your email'). Placeholder text is optional supplementary guidance — never a label replacement. Use placeholder for format hints ('name@example.com') not instructions ('Enter your email'). Error messages must be specific: 'Email must contain @' not 'Invalid input'. Helper text appears below the field in the tertiary text color and persists across states. Maximum label length is ~40 characters; if more context is needed, use helper text.",
        responsive: "Fields stretch to fill their container width at all breakpoints. On mobile (<768px), labels stack above fields (never beside). Field groups in multi-column layouts collapse to single-column below 768px. Font size must be at least 16px on mobile to prevent iOS auto-zoom on focus. Touch targets: the entire field container (not just the text area) must be tappable. On desktop, fields may sit side-by-side in two or three-column form layouts with 16–24px gap.",
        implementationNotes: "Use the native <input> element with the appropriate type attribute (text, email, tel, url, search, number). Associate the label via htmlFor/id, never via wrapping or aria-label when a visible label exists. Error messages must be linked via aria-describedby so screen readers announce them on focus. Support both controlled and uncontrolled modes. Debounce onChange for real-time validation (300ms recommended). Consume field tokens: color/semantic/field/bg/default for background, color/semantic/field/border/default for border, color/semantic/field/border/focus for focus ring. Disabled fields use color/semantic/field/bg/disabled and remove from tab order.",
        keyboard: [
            { key: "Tab", action: "Moves focus into the field" },
            { key: "Shift+Tab", action: "Moves focus to the previous element" },
            { key: "Escape", action: "Clears field or closes autocomplete dropdown" },
            { key: "Enter", action: "Submits the form if inside a form context" },
            { key: "Arrow Down/Up", action: "Navigates autocomplete suggestions" },
        ],
        focus: "The field is focusable via native <input>. Focus ring uses color/semantic/field/border/focus at 2px weight. On focus, the border color transitions from default to focus. When disabled, the field is removed from the tab order. Focus order: Label → Field → Helper text (not focusable) → Error text (announced via aria-describedby, not separately focusable).",
        screenReader: "Announces: role ('textbox' or 'searchbox'), accessible name (from label via htmlFor), current value, and state (invalid via aria-invalid, disabled via aria-disabled, required via aria-required). Error messages are announced when the field receives focus if linked via aria-describedby.",
        labels: "Accessible name computed from: <label> element via htmlFor/id (preferred), then aria-labelledby, then aria-label. The visible label must always be present — placeholder alone is not sufficient. For fields with additional context, use aria-describedby to associate helper text and error messages. Required fields use aria-required='true' and a visual indicator (asterisk or 'Required' text in the label).",
        stateAnnouncements: "Error: aria-invalid='true' triggers 'invalid' announcement; error message announced via aria-describedby. Disabled: aria-disabled='true' triggers 'dimmed'/'unavailable'. Required: aria-required='true' triggers 'required'. Read-only: aria-readonly='true' for view-only fields.",
        contrast: "Label text: 4.5:1 against surface background. Field value text: 4.5:1 against field background. Placeholder text: 4.5:1 against field background (WCAG requires placeholder contrast). Field border: 3:1 non-text contrast against surrounding surface. Error text: 4.5:1 against surface; error border: 3:1 against surface. Helper text: 4.5:1 against surface.",
        touchTargets: "The entire field container (40px height at md size) is the touch target. Minimum target height is 44px — the md field at 40px should include surrounding padding to reach this. Trailing action icons (clear, toggle visibility) must have at least 44×44px target area, achieved via padding if the icon is smaller.",
    },
    select: {
        semanticElement: "<select> or <button> with listbox",
        ariaRole: "combobox or listbox",
        whenToUse: [
            "Use for selecting a single option from a predefined list of 5–15 options.",
            "Use when the options are mutually exclusive and only one can be chosen.",
            "Use in forms where space is constrained and a Radio group would take too much vertical space.",
            "Use for settings, filters, and configuration panels where the user picks from known values.",
        ],
        whenNotToUse: [
            "Do not use for fewer than 5 options — use a Radio group instead for better scannability.",
            "Do not use for more than 15–20 options without search/filter — use a Combobox with autocomplete.",
            "Do not use for multi-selection — use a Checkbox group or multi-select pattern.",
            "Do not use for navigation — use a Tabs or NavBar component.",
        ],
        purpose: "Select provides a space-efficient single-choice selector. It collapses a list of mutually exclusive options into a compact control that expands on interaction. It standardizes the dropdown pattern with consistent styling, keyboard navigation, and accessibility across products.",
        behaviour: "On click or Enter/Space, the dropdown opens below the field. The currently selected option is visually highlighted. Clicking an option selects it and closes the dropdown. Clicking outside or pressing Escape closes the dropdown without changing the selection. Arrow keys navigate options when the dropdown is open. The selected option's text replaces the placeholder in the field.",
        interactionRules: "Keyboard: Tab focuses the select trigger. Enter or Space opens the dropdown. Arrow Down/Up navigates options. Enter selects the highlighted option and closes. Escape closes without selecting. Home/End jump to first/last option. Type-ahead: typing characters jumps to matching options. Pointer: click opens the dropdown; click on an option selects and closes.",
        contentGuidance: "The label describes what is being selected in sentence case ('Country', 'Time zone'). Placeholder text shows a prompt ('Select an option') not a default value. Option text should be concise, consistent in format, and alphabetically or logically sorted. Avoid options longer than ~50 characters.",
        responsive: "Select fields stretch to fill container width. On mobile, consider using the native <select> element for OS-level dropdown rendering, which provides better scroll and touch behaviour. On desktop, custom dropdowns may overlay nearby content. Dropdown max-height should be ~300px with scroll.",
        implementationNotes: "For simple cases, use the native <select> element for best accessibility. For custom-styled dropdowns, use role='combobox' on the trigger and role='listbox' on the dropdown, with role='option' on each item. Manage aria-expanded on the trigger. Use aria-activedescendant to track the highlighted option. Consume field tokens for the trigger (same as Input). Dropdown surface uses color/semantic/surface/overlay with shadow.",
        keyboard: [
            { key: "Enter/Space", action: "Opens the dropdown" },
            { key: "Arrow Down/Up", action: "Navigates options" },
            { key: "Enter", action: "Selects highlighted option and closes" },
            { key: "Escape", action: "Closes dropdown without selecting" },
            { key: "Home/End", action: "Jumps to first/last option" },
            { key: "Tab", action: "Moves focus to next element; closes dropdown if open" },
        ],
        focus: "The select trigger is focusable. When the dropdown is open, focus remains on the trigger and aria-activedescendant tracks the highlighted option. Focus ring follows the same pattern as Input. On close, focus stays on the trigger.",
        screenReader: "Announces: role ('combobox'), name (from label), current value, expanded/collapsed state. Options announce as 'option, X of Y'. Selected option is announced as 'selected'.",
        labels: "Label via <label> htmlFor/id. If no visible label, use aria-label. The trigger displays the selected value or placeholder text.",
        stateAnnouncements: "Expanded: aria-expanded='true'. Collapsed: aria-expanded='false'. Disabled: aria-disabled='true'. Error: aria-invalid='true' with aria-describedby for error message. Required: aria-required='true'.",
        contrast: "Same contrast requirements as Input for the trigger field. Option text: 4.5:1 against dropdown background. Highlighted option: 3:1 non-text contrast for the highlight indicator.",
        touchTargets: "Trigger: same as Input (min 44px effective height). Each option in the dropdown: minimum 44px height for comfortable touch selection.",
    },
    checkbox: {
        semanticElement: "<input type='checkbox'>",
        ariaRole: "checkbox",
        whenToUse: [
            "Use for binary opt-in/out selections: agreeing to terms, enabling a feature, subscribing to notifications.",
            "Use for multi-select scenarios in forms where users can choose zero or more options from a group.",
            "Use for acknowledgement confirmations ('I have read and agree to the terms').",
            "Use with indeterminate state for parent checkboxes that represent a partially-selected child group.",
        ],
        whenNotToUse: [
            "Do not use for mutually exclusive choices — use Radio instead.",
            "Do not use for settings that take immediate effect — use Toggle instead. Checkbox implies a deferred save action.",
            "Do not use as a standalone on/off switch without a form context.",
        ],
        purpose: "Checkbox provides a binary or tri-state (indeterminate) selection control for form contexts. Unlike Toggle, Checkbox implies the selection will be applied when the form is submitted, not immediately. It supports grouped multi-selection with consistent spacing and label alignment.",
        behaviour: "On click or Space, the checkbox toggles between checked and unchecked. If the checkbox supports indeterminate state, cycling goes: unchecked → checked → indeterminate (or unchecked → checked only for simple use). The label is also a click target. Grouped checkboxes operate independently — selecting one does not deselect others. A parent checkbox with child checkboxes shows indeterminate when some children are checked.",
        interactionRules: "Keyboard: Space toggles the checkbox. Tab moves to the next focusable element. In a checkbox group, Tab moves between checkboxes (each is independently focusable). Pointer: click on the box or label toggles the state. Disabled: non-interactive, removed from tab order.",
        contentGuidance: "Labels must clearly describe what the checkbox controls in sentence case. Use positive framing ('Enable notifications') rather than negative ('Disable notifications'). Group labels should describe the category. Keep labels to one line when possible.",
        responsive: "Checkbox groups stack vertically at all breakpoints. On mobile, ensure the tap target (box + label) spans at least 44px height. In horizontal layouts (desktop), checkboxes may sit side-by-side with 24px+ gap, but vertical stacking is preferred for scannability.",
        implementationNotes: "Use native <input type='checkbox'> for best accessibility. The label must be associated via <label> htmlFor/id. For indeterminate state, set the indeterminate property via JavaScript (it cannot be set in HTML). For checkbox groups, wrap in a <fieldset> with a <legend>. Consume tokens: color/semantic/field/bg/default for unchecked box, color/semantic/actions/primary/bg/default for checked fill.",
        keyboard: [
            { key: "Space", action: "Toggles the checkbox" },
            { key: "Tab", action: "Moves to the next focusable element" },
        ],
        focus: "Each checkbox is independently focusable. Focus ring wraps the checkbox box (not the label). Focus-visible applies on keyboard navigation only.",
        screenReader: "Announces: role ('checkbox'), name (from label), state ('checked', 'not checked', 'mixed' for indeterminate). In a group, the fieldset legend provides the group name.",
        labels: "Label via <label> htmlFor/id. Group label via <fieldset><legend>. Indeterminate checkbox should have aria-checked='mixed'.",
        stateAnnouncements: "Checked: aria-checked='true'. Unchecked: aria-checked='false'. Indeterminate: aria-checked='mixed'. Disabled: aria-disabled='true'. Required: aria-required='true' on the group or individual checkbox.",
        contrast: "Checkbox border: 3:1 non-text contrast against surface. Checked fill: 3:1 against surface. Check mark: 4.5:1 against checked fill. Label text: 4.5:1 against surface.",
        touchTargets: "The combined box + label area must reach 44×44px minimum. The 16×16px box alone is too small — extend the target via padding or label proximity.",
    },
    radio: {
        semanticElement: "<input type='radio'>",
        ariaRole: "radio",
        whenToUse: [
            "Use for mutually exclusive choices where exactly one option must be selected from 2–7 visible options.",
            "Use when all options should be visible simultaneously for easy comparison.",
            "Use in forms where the selection will be submitted with other data.",
        ],
        whenNotToUse: [
            "Do not use for more than 7 options — use Select instead.",
            "Do not use for multi-selection — use Checkbox group.",
            "Do not use for binary on/off settings — use Toggle or Checkbox.",
            "Do not use a single radio button alone — radios always come in groups of 2+.",
        ],
        purpose: "Radio provides a mutually exclusive single-selection control for groups of 2–7 options. It ensures users can see and compare all options simultaneously, making the choice explicit. Radio groups are form controls that submit a single value.",
        behaviour: "Selecting one radio deselects all others in the same named group. Once a radio group has a selection, the user cannot deselect all options — one must always be selected (this differs from checkbox). Arrow keys navigate between radios in a group using roving tabindex.",
        interactionRules: "Keyboard: Arrow Up/Left moves to the previous radio; Arrow Down/Right moves to the next. Space selects the focused radio. Tab exits the radio group to the next focusable element (only the selected or first radio is in the tab order). Pointer: click selects the radio; the label is also a click target.",
        contentGuidance: "Option labels must be concise and parallel in structure. The group label (fieldset legend) describes the question or category. Keep to one line per option. Use sentence case.",
        responsive: "Radio groups stack vertically at all breakpoints for scannability. Horizontal layout is acceptable only for 2–3 short options on desktop. On mobile, each radio option must have 44px+ touch target height.",
        implementationNotes: "Use native <input type='radio'> with shared name attribute for grouping. Wrap in <fieldset> with <legend> for the group label. Only one radio in the group should be in the tab order (roving tabindex or native behaviour). Consume tokens: color/semantic/field/bg/default for unselected, color/semantic/actions/primary/bg/default for selected fill.",
        keyboard: [
            { key: "Arrow Down/Right", action: "Selects the next radio in the group" },
            { key: "Arrow Up/Left", action: "Selects the previous radio in the group" },
            { key: "Space", action: "Selects the focused radio" },
            { key: "Tab", action: "Exits the radio group to the next focusable element" },
        ],
        focus: "Only the selected radio (or the first if none selected) is in the tab order. Arrow keys move focus and selection together. Focus ring wraps the radio circle.",
        screenReader: "Announces: role ('radio'), name (from label), state ('selected'/'not selected'), position ('1 of 4'). Group name from <legend>.",
        labels: "Label via <label> htmlFor/id. Group via <fieldset><legend>.",
        stateAnnouncements: "Selected: aria-checked='true'. Not selected: aria-checked='false'. Disabled: aria-disabled='true'. Required: aria-required='true' on the group.",
        contrast: "Radio circle border: 3:1 against surface. Selected dot: 3:1 against surface. Label text: 4.5:1 against surface.",
        touchTargets: "Combined circle + label must reach 44×44px. Stack options with at least 8px gap between rows.",
    },
    toggle: {
        semanticElement: "<button> or <input type='checkbox' role='switch'>",
        ariaRole: "switch",
        whenToUse: [
            "Use for binary settings that take effect immediately without requiring a save action (e.g., dark mode, notifications, airplane mode).",
            "Use when the on/off nature of the setting is the primary information — the visual state of the toggle communicates the current value.",
            "Use for preferences and feature flags in settings panels.",
        ],
        whenNotToUse: [
            "Do not use when the change requires a save/submit action — use Checkbox instead.",
            "Do not use for multiple selections in a group — use Checkbox group.",
            "Do not use for actions (like 'Delete') — use Button.",
        ],
        purpose: "Toggle provides an immediate binary on/off switch. Unlike Checkbox, Toggle communicates that the state change takes effect instantly, without a form submission step. The visual metaphor (sliding thumb on track) reinforces the on/off nature.",
        behaviour: "On click, tap, or Space, the toggle immediately switches state. A brief transition animation (150–200ms) slides the thumb and transitions the track color. The state change is applied immediately — no save action is needed. Disabled toggles are non-interactive and show reduced opacity.",
        interactionRules: "Keyboard: Space toggles the switch. Enter may also toggle (implementation-specific). Tab moves to the next element. Pointer: click/tap anywhere on the track or thumb toggles. Disabled: non-interactive.",
        contentGuidance: "The toggle label should describe the setting being controlled, not the action. Use 'Notifications' not 'Enable notifications'. On/Off labels are optional — the visual state should be sufficient. If on/off labels are used, keep them to one word each.",
        responsive: "Toggle maintains its fixed size (40×24px at default) across all breakpoints. The label may wrap on narrow screens. Touch target should be at least 44×44px, achieved via surrounding padding.",
        implementationNotes: "Use role='switch' with aria-checked for the toggle state. A native <input type='checkbox' role='switch'> provides the best baseline. The transition animation should be 150–200ms ease. Consume tokens: color/semantic/border/default for off track, color/semantic/actions/primary/bg/default for on track, color/semantic/surface/default for thumb. Persist state changes immediately — no form submission.",
        keyboard: [
            { key: "Space", action: "Toggles the switch" },
            { key: "Tab", action: "Moves to the next focusable element" },
        ],
        focus: "Focusable via native element. Focus ring wraps the track. Focus-visible on keyboard only.",
        screenReader: "Announces: role ('switch'), name (from label), state ('on'/'off').",
        labels: "Label via <label> or aria-labelledby. The label should describe the setting, not the action.",
        stateAnnouncements: "On: aria-checked='true'. Off: aria-checked='false'. Disabled: aria-disabled='true'.",
        contrast: "Track: 3:1 against surface in both on and off states. Thumb: 3:1 against track. On-state track should be visually distinct from off-state (not just color — add a check mark or position change).",
        touchTargets: "The track (40×24px) plus surrounding padding should reach 44×44px minimum target.",
    },
    card: {
        semanticElement: "<article> or <div>",
        ariaRole: "article (if self-contained) or group",
        whenToUse: [
            "Use to group related content (title, description, media, actions) into a visually distinct container.",
            "Use for item displays in grids and lists: product cards, article previews, team members, project summaries.",
            "Use when content needs visual elevation (shadow or border) to distinguish it from the surface.",
            "Use for dashboard widgets that encapsulate a single metric or content area.",
        ],
        whenNotToUse: [
            "Do not nest cards within cards — this creates visual noise and confusing hierarchy.",
            "Do not use Card as a button. If the entire card is clickable, apply the clickable card pattern (single link wrapping) but do not add role='button' to the card.",
            "Do not use Card for inline content that doesn't need containment — use plain layout instead.",
            "Do not overload a card with more than 2 actions. If more are needed, use a menu or navigate to a detail page.",
        ],
        purpose: "Card groups related content and actions into a scannable, self-contained container. It creates visual separation between content blocks, enabling grid and list layouts where each item has its own boundary. Card is the primary container for browse, discovery, and dashboard patterns.",
        behaviour: "Cards are primarily passive containers. Interactive elements within the card (buttons, links) handle their own interactions. If the entire card is clickable, a single <a> element should wrap the card content, and the card shows hover state (subtle background shift) on pointer-over. The Elevated variant adds shadow for depth. Cards do not have focus, selected, or pressed states unless used in a selectable card pattern.",
        interactionRules: "Keyboard: Tab moves through interactive elements within the card in DOM order. The card itself is not focusable unless it is a clickable card (in which case the wrapping link is focusable). Pointer: hover shows a subtle surface shift on clickable cards; click on internal actions triggers those actions. Cards in a grid have no inter-card keyboard navigation — Tab walks through all focusable children across all cards.",
        contentGuidance: "Lead with the most important information (title, key metric). Body text should be scannable — 2–3 lines maximum. Use the Heading slot for the card title and Body slot for supporting text. Media slot appears at the top for visual impact. Action labels should be specific ('View details', 'Add to cart'), not generic ('Learn more').",
        responsive: "Cards in a grid reflow from multi-column to single-column below 768px. Card width is determined by the container grid, not the card itself. Card padding may reduce on mobile (16px → 12px) for density. Media within cards maintains aspect ratio. On mobile, full-bleed cards (edge-to-edge, no side padding) are acceptable for feed-style layouts.",
        implementationNotes: "Use <article> if the card is self-contained (could stand alone as content). Use <div> with role='group' for non-article cards. For clickable cards, wrap the title in an <a> and let the click area extend to the card boundary via CSS — avoid wrapping the entire card in <a> to prevent nested interactive elements. For elevated cards, use box-shadow controlled by a shadow token. Consume tokens: color/semantic/surface/raised for background, color/semantic/border/default for border, radius/semantic/surface/default for corner radius.",
        keyboard: [
            { key: "Tab", action: "Moves through interactive elements within the card" },
            { key: "Enter", action: "Activates the focused link or button within the card" },
        ],
        focus: "The card container is not focusable. Interactive children (links, buttons) within the card are individually focusable. For clickable cards, the wrapping link receives focus with a visible ring around the entire card.",
        screenReader: "If <article>, announced as 'article' with the heading as the name. If <div role='group'>, announced as 'group'. Internal headings, links, and buttons are announced individually. Media images need descriptive alt text or aria-hidden='true' if decorative.",
        labels: "The card's accessible name comes from its heading (via aria-labelledby pointing to the heading element). Group labels (for a set of cards) come from a section heading above the grid.",
        stateAnnouncements: "Cards have no state announcements unless used in a selectable pattern (aria-selected) or expandable pattern (aria-expanded).",
        contrast: "Card background: 3:1 against the page surface (or visually distinguished via border). Internal text and icons follow standard contrast ratios. Card border: 3:1 non-text contrast if the border is the only visual boundary.",
        touchTargets: "Internal action buttons/links follow standard 44×44px targets. For clickable cards, the entire card surface is the target. Spacing between cards in a grid: minimum 16px gap to prevent accidental taps on adjacent cards.",
    },
    modal: {
        semanticElement: "<dialog>",
        ariaRole: "dialog or alertdialog",
        whenToUse: [
            "Use for critical decisions that require immediate user attention before continuing: confirmations, destructive action approvals, license agreements.",
            "Use for focused tasks that should block interaction with the page behind: short forms, file uploads, configuration steps.",
            "Use for content that is contextually separate from the main page but too short for a full page navigation.",
        ],
        whenNotToUse: [
            "Do not use for informational content that doesn't require user action — use inline content or a Toast instead.",
            "Do not stack multiple modals. If a modal needs to open another, redesign the flow.",
            "Do not use for content that needs to be referenced alongside the main page — use a side panel or drawer instead.",
            "Do not use for simple confirmations that can be handled with inline UI (e.g., undo patterns).",
        ],
        purpose: "Modal presents focused content or decisions that require immediate user attention. It creates a blocking overlay that prevents interaction with the page behind, forcing the user to address the modal's content before continuing. Modal is the highest-priority interruptive pattern in the system.",
        behaviour: "Opens with a fade/scale transition (200–300ms). A backdrop overlay dims the page behind. Focus is immediately trapped inside the modal — Tab/Shift+Tab cycle through modal content only. Pressing Escape or clicking the backdrop closes the modal (unless it's a blocking modal requiring explicit action). On close, focus returns to the element that triggered the modal. Body scroll is locked while the modal is open.",
        interactionRules: "Keyboard: Tab/Shift+Tab cycle within modal content. Escape closes the modal (unless alertdialog). Focus trap: Tab from the last focusable element wraps to the first; Shift+Tab from the first wraps to the last. On open, focus moves to the first focusable element (typically the close button or the first form field). On close, focus returns to the trigger element. Pointer: clicking the backdrop closes (non-blocking modals). Clicking outside interactive elements has no effect. Scroll within the modal body if content overflows.",
        contentGuidance: "Modal title must clearly describe the purpose or question. Body text should be concise and scannable. Primary action label should be specific ('Delete account', 'Save changes'), not generic ('OK'). Secondary action is typically 'Cancel'. For destructive modals, the primary button uses the Destructive variant. Avoid paragraphs of text — if the modal needs extensive content, reconsider the pattern.",
        responsive: "On desktop, modals are centered horizontally and vertically with max-width (480px for sm, 640px for md, 800px for lg). On mobile (<768px), modals become full-width with bottom-sheet behaviour: they slide up from the bottom, cover ~80% of the screen, and have rounded top corners. The close button moves to the top-right. Footer buttons stack vertically on narrow screens, primary on top.",
        implementationNotes: "Use the native <dialog> element with showModal() for built-in backdrop and focus trapping. If native <dialog> is not supported, implement focus trap with sentinel elements at the start and end. Prevent body scroll with overflow:hidden on <body> or via the inert attribute on background content. Use role='alertdialog' for critical confirmations that should not be dismissed by Escape or backdrop click. Render via a portal for z-index management. Consume tokens: color/semantic/surface/overlay for modal background, drop shadow for elevation, color/semantic/actions/primary/bg/default for primary action button.",
        keyboard: [
            { key: "Tab", action: "Moves to the next focusable element within the modal" },
            { key: "Shift+Tab", action: "Moves to the previous focusable element within the modal" },
            { key: "Escape", action: "Closes the modal (unless alertdialog)" },
            { key: "Enter", action: "Activates the focused button" },
        ],
        focus: "On open, focus moves to the first focusable element (or the close button). Focus is trapped — it never leaves the modal while open. On close, focus returns to the triggering element. The modal container is focusable if no child is focusable (add tabindex='-1').",
        screenReader: "Announces: role ('dialog' or 'alertdialog'), accessible name (from aria-labelledby pointing to the title). When opened, the screen reader announces the dialog and its title. Content within the dialog is read in DOM order.",
        labels: "Title provides the accessible name via aria-labelledby. Additional description via aria-describedby pointing to the body text. The close button needs aria-label='Close' if icon-only.",
        stateAnnouncements: "Open/close: the dialog role handles this automatically. The screen reader announces when a dialog opens and reads the title. On close, the return of focus signals the dialog has been dismissed.",
        contrast: "Modal surface: must be visually distinguishable from the dimmed background. Title text: 4.5:1 against modal surface. Body text: 4.5:1. Button contrast follows Button component rules. Backdrop overlay should dim enough to clearly separate the modal from the page (typically 50–60% opacity black).",
        touchTargets: "Close button: 44×44px minimum. Footer action buttons follow Button touch target rules. The backdrop is a tap target for close — it must cover the entire area outside the modal.",
    },
    toast: {
        semanticElement: "<div> with role='status' or role='alert'",
        ariaRole: "status or alert",
        whenToUse: [
            "Use for brief, non-blocking feedback after a user action: 'Changes saved', 'Item deleted', 'Message sent'.",
            "Use for success confirmations, warnings, errors, and informational notifications that don't require user action.",
            "Use when the feedback should auto-dismiss after 5–8 seconds without blocking the user's workflow.",
        ],
        whenNotToUse: [
            "Do not use for critical errors that require user action — use inline error messages or a Modal instead.",
            "Do not use for content that needs to persist — use a Banner or inline alert.",
            "Do not stack more than 3 toasts simultaneously. If more feedback is needed, use a notification center pattern.",
            "Do not use for form validation errors — use inline field-level errors.",
        ],
        purpose: "Toast delivers brief, non-blocking status feedback to users about the result of an action. It appears temporarily, auto-dismisses, and does not interrupt the user's current task. Toast is the lightest feedback mechanism in the system, below Modal and inline alerts in severity.",
        behaviour: "Appears with a slide-in animation from the top-right (desktop) or bottom (mobile). Stays visible for 5–8 seconds (longer for error toasts). The user can dismiss early via the close button. Multiple toasts stack vertically with 8px gap, newest on top. Auto-dismiss timer pauses on hover/focus. The toast does not block any page interaction. On dismiss, the toast slides out and is removed from the DOM.",
        interactionRules: "Keyboard: Tab moves focus to the close button if the toast is focusable. Escape may dismiss the focused toast. The toast should not trap focus or interrupt keyboard navigation on the page. Pointer: hover pauses the auto-dismiss timer. Click on close button dismisses. The toast body is not interactive (no links or actions in the body — use a Banner for that).",
        contentGuidance: "Message text should be one sentence, 5–12 words: 'Changes saved successfully', 'Unable to delete item'. No periods at the end of short messages. The status icon (success/warning/error/info) reinforces the tone — don't repeat the tone in the text ('Error: An error occurred' is redundant). No action links in toast body — if action is needed, use a different pattern.",
        responsive: "Desktop: positioned top-right or bottom-right, 360px fixed width. Mobile: full-width at the bottom of the screen with 16px side margins. Toast width does not change with viewport. Stack position adjusts for safe areas on mobile.",
        implementationNotes: "Use role='status' for non-urgent feedback (success, info) and role='alert' for urgent messages (error, warning). This determines how aggressively screen readers announce the toast. Use aria-live='polite' for status, aria-live='assertive' for alert. Render via a portal to avoid z-index issues. Manage toast queue to limit visible toasts to 3. Auto-dismiss via setTimeout, paused on mouseenter/focusin. Consume tokens: color/semantic/feedback/success/bg for success, etc.",
        keyboard: [
            { key: "Tab", action: "Moves focus to the close button (if focusable)" },
            { key: "Escape", action: "Dismisses the focused toast" },
        ],
        focus: "Toasts are generally not focusable and do not steal focus from the user's current task. The close button is focusable if the user Tabs to it. Toast appearance should not move focus.",
        screenReader: "Announced via aria-live region when it appears. Success/info: announced politely (doesn't interrupt). Error/warning: announced assertively (interrupts current announcement). The status icon is decorative (aria-hidden) — the message text carries the meaning.",
        labels: "The toast's accessible name comes from its text content. The status icon should have aria-hidden='true'. Close button needs aria-label='Dismiss notification'.",
        stateAnnouncements: "Success/Warning/Error/Info: communicated via the aria-live urgency level and the visual icon/color, not via explicit ARIA state attributes.",
        contrast: "Toast background: 3:1 against page surface. Message text: 4.5:1 against toast background. Status icon: 3:1 against toast background. Close icon: 3:1 against toast background.",
        touchTargets: "Close button: 44×44px minimum target area. The toast body is not a touch target.",
    },
    badge: {
        semanticElement: "<span>",
        ariaRole: "status (if dynamic) or none (if static)",
        whenToUse: [
            "Use for status indicators: online/offline, active/inactive, published/draft.",
            "Use for counts: unread messages, notification counts, cart item counts.",
            "Use for categorical labels: 'New', 'Beta', 'Pro', 'Deprecated'.",
            "Use to add metadata to other components: status on table rows, counts on nav items, labels on cards.",
        ],
        whenNotToUse: [
            "Do not use for interactive elements — badges are read-only indicators. Use Tag for removable/filterable labels.",
            "Do not use for long text — badges should contain 1–3 words or a number.",
            "Do not use badge as a standalone element without context — it should always be associated with another component or content.",
        ],
        purpose: "Badge communicates status, count, or categorical metadata in a compact pill-shaped indicator. It is always subordinate to another component — it adds context to the element it's attached to, never stands alone as primary content.",
        behaviour: "Badges are non-interactive and have no states beyond their variant types (Default, Success, Warning, Error, Info). If a badge displays a dynamic count, the count updates in place without animation. Badges do not respond to hover, focus, or click.",
        interactionRules: "Badges are not interactive. They have no keyboard, pointer, or focus behaviour. They should not be focusable. Screen readers encounter them inline with the parent content.",
        contentGuidance: "Text must be ultra-concise: 1–3 words or a number. Use sentence case for text labels. For counts, show the number directly ('3', '99+'). Truncation: badges should never truncate — shorten the text instead. For status badges, use consistent vocabulary across the product ('Active' everywhere, not 'Active' in some places and 'Enabled' in others).",
        responsive: "Badges maintain their intrinsic size across all breakpoints. They do not reflow or stack. In narrow containers, the parent element may need to wrap or truncate, but the badge itself stays intact.",
        implementationNotes: "Use <span> with appropriate styling. For dynamic counts, update the text content and ensure a screen reader-accessible announcement if the count change is significant (aria-live region on the parent). Badge colors should come from semantic feedback tokens (success/warning/danger/info). The pill shape uses radius/semantic/pill (9999). Consume size tokens for sm (paddingX: 8, paddingY: 2) and md variants.",
        keyboard: [],
        focus: "Badges are not focusable. They have no tab stop.",
        screenReader: "Badge text is read inline with its parent content. For status badges on other elements, the badge text should be part of the element's accessible description (via aria-describedby or inline text).",
        labels: "No independent accessible name needed. The badge text is read as inline content. If the badge conveys critical status, ensure it's part of the parent element's accessible name or description.",
        stateAnnouncements: "No ARIA states. For dynamic counts, use aria-live='polite' on a containing region to announce changes.",
        contrast: "Badge background: 3:1 against the surface behind it. Badge text: 4.5:1 against badge background. The badge itself must be visible — don't rely solely on color to convey meaning (add text or icons).",
        touchTargets: "Not applicable — badges are not interactive.",
    },
    avatar: {
        semanticElement: "<img> or <span>",
        ariaRole: "img (if meaningful) or presentation (if decorative)",
        whenToUse: [
            "Use to represent a user or entity with a visual identifier in profiles, comment threads, team lists, and navigation headers.",
            "Use with the status dot to show online/offline/busy presence.",
            "Use in groups (avatar stack) to show multiple participants or team members.",
        ],
        whenNotToUse: [
            "Do not use as a button — if the avatar triggers a profile menu, wrap it in a button element.",
            "Do not use for non-user images — use a thumbnail or image component instead.",
            "Do not use without a fallback (initials or generic icon) for users without a profile photo.",
        ],
        purpose: "Avatar represents a user or entity with a visual identifier. It supports three display modes: image, initials, and fallback icon. The optional status dot communicates real-time presence. Avatar is used wherever a person or entity needs visual representation.",
        behaviour: "Avatar is a passive display element. It shows an image, initials, or fallback. The status dot updates independently to reflect real-time presence. If the image fails to load, the component falls back to initials, then to a generic person icon. Avatars do not have hover, focus, or interactive states unless wrapped in an interactive element (button, link).",
        interactionRules: "Avatars are not interactive by default. If an avatar is inside a button (for profile menus), the button handles all interaction. The avatar itself has no keyboard, pointer, or focus behaviour.",
        contentGuidance: "Initials should be 1–2 uppercase characters (first + last name initials). Alt text for images: use the person's name ('Photo of Jane Doe') or empty alt if the name is adjacent in text. Status dot colours must align with the design system's presence vocabulary (green = online, yellow = away, red = busy, grey = offline).",
        responsive: "Avatar sizes scale appropriately: sm (24px) for compact lists, md (40px) for standard UI, lg (56px) for profiles, xl (80px) for profile pages. Size choice depends on context, not viewport. In avatar stacks, overlap by 25% of the avatar diameter.",
        implementationNotes: "Use <img> with alt text for photo avatars. Use <span> with initials for text fallback. Wrap in role='img' with aria-label if the avatar is meaningful content. Implement image error handling to fall back to initials. Status dot is a child element positioned absolutely. Consume tokens: color/semantic/surface/subtle for fallback background.",
        keyboard: [],
        focus: "Avatars are not focusable unless inside a button or link.",
        screenReader: "For meaningful avatars: announce the person's name via alt text or aria-label. For decorative avatars (name is adjacent in text): use alt='' or aria-hidden='true'. Status dot should be announced as part of the parent's description if relevant.",
        labels: "Meaningful: <img alt='Jane Doe'> or <span role='img' aria-label='Jane Doe'>. Decorative: alt='' or aria-hidden='true'. Status: visually hidden text next to the status dot ('Online', 'Away') or aria-label on the dot.",
        stateAnnouncements: "No direct ARIA states. Presence status communicated via visually hidden text or the parent element's accessible description.",
        contrast: "Initials text: 4.5:1 against avatar background. Status dot: 3:1 against the avatar or surrounding surface. The dot should not rely solely on color — consider adding an icon inside the dot (checkmark for online, minus for busy).",
        touchTargets: "Not applicable unless the avatar is interactive. If inside a button, the button must meet 44×44px minimum.",
    },
    tooltip: {
        semanticElement: "<div> with role='tooltip'",
        ariaRole: "tooltip",
        whenToUse: [
            "Use to provide supplementary information on hover/focus for elements that need additional context.",
            "Use for icon-only buttons to reveal the button's label.",
            "Use for truncated text to show the full content on hover.",
        ],
        whenNotToUse: [
            "Do not use for critical information that users must see — tooltips are hidden by default.",
            "Do not use for interactive content (links, buttons) — use a Popover instead.",
            "Do not use on mobile-only interfaces — tooltips require hover, which is not available on touch.",
            "Do not use for form field instructions — use helper text instead.",
        ],
        purpose: "Tooltip provides supplementary, non-critical text that appears on hover or focus of a trigger element. It surfaces hidden labels (for icon-only controls) and additional context without cluttering the interface. Tooltip is a non-interactive overlay.",
        behaviour: "Appears after a short delay (300–500ms) on hover-in or immediate on focus. Disappears on hover-out, blur, Escape, or scroll. The tooltip positions itself automatically to avoid viewport overflow (flips direction). Content is text-only — no links, buttons, or interactive elements. The tooltip does not steal focus.",
        interactionRules: "Keyboard: tooltip appears when the trigger receives focus. Escape dismisses the tooltip. Tab moves focus away and dismisses. Pointer: hover triggers appearance after delay; moving the pointer to the tooltip keeps it visible (for readability); moving away dismisses. Touch: tooltip may appear on long-press or not at all — do not rely on tooltip for essential information on touch devices.",
        contentGuidance: "Text should be 1–2 short sentences maximum. Use sentence case. No rich formatting, links, or images. For icon-only buttons, the tooltip text should match the button's aria-label exactly. Keep it supplementary — if the user needs this information to complete a task, it should be visible inline.",
        responsive: "Tooltip position flips automatically based on available space. On narrow viewports, tooltips may need to be wider (max-width: 240px). On touch devices, tooltips should have a fallback (e.g., long-press trigger) or the information should be available inline.",
        implementationNotes: "Use role='tooltip' on the tooltip element. Associate via aria-describedby on the trigger pointing to the tooltip's id. The trigger must be focusable (native button, link, or tabindex='0'). Position with CSS (preferred) or JavaScript for viewport-aware flipping. Use color/semantic/surface/inverse for background, color/semantic/text/inverse for text. Arrow/caret pointing to the trigger is optional but improves clarity.",
        keyboard: [
            { key: "Escape", action: "Dismisses the tooltip" },
            { key: "Tab", action: "Moves focus away, dismissing the tooltip" },
        ],
        focus: "The tooltip itself is not focusable. The trigger element is focusable. Tooltip appears on trigger focus and disappears on blur.",
        screenReader: "The tooltip content is announced as a description of the trigger (via aria-describedby). It is not announced as a separate element. The tooltip role signals assistive tech that this is supplementary text.",
        labels: "Tooltip provides description, not name. Use aria-describedby (not aria-labelledby) to associate. For icon-only buttons, the button should have aria-label for the name, and the tooltip provides additional context via aria-describedby if needed.",
        stateAnnouncements: "No ARIA states on the tooltip itself. The trigger element may have aria-expanded but this is uncommon for tooltips (more appropriate for popovers).",
        contrast: "Tooltip background (inverse surface): 3:1 against the page surface. Tooltip text: 4.5:1 against tooltip background. The tooltip itself must be clearly visible against the content behind it.",
        touchTargets: "Not applicable — the tooltip itself is not a touch target. The trigger element must meet standard touch target requirements.",
    },
    tabs: {
        semanticElement: "<div> with role='tablist', role='tab', role='tabpanel'",
        ariaRole: "tablist",
        whenToUse: [
            "Use to organize related content into switchable panels within a single view, reducing page complexity.",
            "Use when users need to compare or switch between 2–7 related content sections.",
            "Use for settings pages, profile sections, dashboard views, or product detail tabs.",
        ],
        whenNotToUse: [
            "Do not use for primary navigation between different pages — use NavBar or links.",
            "Do not use when content sections are unrelated — use separate pages or sections.",
            "Do not use for more than 7 tabs — use a dropdown or navigation pattern instead.",
            "Do not use for sequential steps — use a Stepper or wizard pattern.",
        ],
        purpose: "Tabs organize content into parallel panels that share a single view. They reduce vertical scrolling by letting users switch between related content sections without page navigation. Only one panel is visible at a time.",
        behaviour: "Clicking a tab activates it and reveals its associated panel while hiding the previously active panel. The active tab is visually distinct (bottom border indicator, active text color). Tab panels load lazily or eagerly depending on implementation. Scrollable tab bars (when tabs overflow) show left/right scroll affordances.",
        interactionRules: "Keyboard: Arrow Left/Right moves between tabs. Home/End jump to first/last tab. Tab key moves focus from the active tab into the tab panel content, then continues through the panel. Only the active tab is in the Tab order (the rest are navigated via arrow keys). Enter/Space may activate a tab if using manual activation mode. Pointer: click activates a tab immediately.",
        contentGuidance: "Tab labels should be 1–2 words in sentence case ('Overview', 'Settings', 'Activity'). Labels must be parallel in structure and length. Avoid icons-only tabs — always include text. If tabs overflow, a 'More' dropdown collects the excess.",
        responsive: "On narrow viewports, tabs may become scrollable (horizontal scroll) or collapse into a Select dropdown. Never wrap tabs to multiple lines — this breaks the mental model. On mobile, consider bottom-tab navigation for primary app sections.",
        implementationNotes: "Use role='tablist' on the container, role='tab' on each tab, role='tabpanel' on each panel. Associate tabs with panels via aria-controls and aria-labelledby. Only the active tab has tabindex='0'; inactive tabs have tabindex='-1' (roving tabindex). Set aria-selected='true' on the active tab. Panel content can be lazy-loaded. The active indicator (bottom border) uses color/semantic/actions/primary/bg/default.",
        keyboard: [
            { key: "Arrow Left", action: "Moves to the previous tab" },
            { key: "Arrow Right", action: "Moves to the next tab" },
            { key: "Home", action: "Moves to the first tab" },
            { key: "End", action: "Moves to the last tab" },
            { key: "Tab", action: "Moves focus from tabs into the active panel" },
        ],
        focus: "Only the active tab is in the tab order. Arrow keys move focus and selection together (automatic activation). Focus ring wraps the individual tab. Focus does not enter inactive panels.",
        screenReader: "Announces: role ('tab'), name (from tab label), state ('selected'), position ('tab 2 of 5'). Panels announce as 'tabpanel' with name from aria-labelledby.",
        labels: "Each tab's accessible name comes from its text label. Each panel is labelled by its tab via aria-labelledby. The tablist itself can have a group name via aria-label.",
        stateAnnouncements: "Selected: aria-selected='true'. Not selected: aria-selected='false'. Disabled: aria-disabled='true' on individual tabs.",
        contrast: "Active tab indicator: 3:1 against the tab bar background. Active tab text: 4.5:1. Inactive tab text: 4.5:1 (may use secondary text color). The tab bar border: 3:1 against the surface.",
        touchTargets: "Each tab: minimum 44px height. Tab spacing: at least 8px between tabs to prevent misactivation.",
    },
    breadcrumb: {
        semanticElement: "<nav> with role='navigation' and aria-label='Breadcrumb'",
        ariaRole: "navigation",
        whenToUse: [
            "Use for hierarchical navigation showing the user's current location within a multi-level site structure.",
            "Use on pages deeper than 2 levels in the information architecture.",
            "Use in content-heavy applications: documentation sites, e-commerce categories, file managers.",
        ],
        whenNotToUse: [
            "Do not use for flat site structures with only 1–2 levels.",
            "Do not use as primary navigation — use NavBar for that.",
            "Do not use for sequential steps — use a Stepper.",
        ],
        purpose: "Breadcrumb provides a secondary navigation trail showing the user's position in the site hierarchy. It enables quick navigation to parent pages without using the browser back button. Breadcrumb reduces disorientation in deep site structures.",
        behaviour: "Each breadcrumb segment (except the current page) is a link to that level in the hierarchy. The current page is displayed as plain text (not a link). The separator (/ or >) is decorative and not interactive. Breadcrumbs do not change state — they reflect the current page hierarchy.",
        interactionRules: "Keyboard: Tab moves through breadcrumb links in sequence. Enter activates a link. Each link is individually focusable. Pointer: click on a breadcrumb link navigates to that page. The current page text is not clickable. Separators are not interactive.",
        contentGuidance: "Breadcrumb labels should match the page titles they link to. Keep labels concise — abbreviate if necessary, but maintain recognizability. The current page label must match the page heading. Use '/' or '>' as separators, never custom icons. For long paths (>5 levels), collapse middle items into an ellipsis ('...') menu.",
        responsive: "On narrow viewports, breadcrumbs may truncate middle segments with an ellipsis ('...'). Always show the first (home) and last (current page) segments. The full path may become a single 'Back to [parent]' link on mobile.",
        implementationNotes: "Wrap in <nav aria-label='Breadcrumb'>. Use an <ol> for the ordered list of segments. Each link is an <a>. The current page is marked with aria-current='page'. Separators are decorative — add them via CSS (::before) or with aria-hidden='true'. Do not use link-styled text for the current page.",
        keyboard: [
            { key: "Tab", action: "Moves through breadcrumb links" },
            { key: "Enter", action: "Navigates to the linked page" },
        ],
        focus: "Each link is focusable. The current page text is not focusable (it's not a link). Focus ring wraps individual links.",
        screenReader: "The <nav> with aria-label='Breadcrumb' announces as a navigation landmark. Links announce their text. The current page link has aria-current='page', announced as 'current page'. Separators are hidden via aria-hidden.",
        labels: "The <nav> has aria-label='Breadcrumb'. Each link is named by its text. The current page has aria-current='page'.",
        stateAnnouncements: "aria-current='page' on the current page element. No other states.",
        contrast: "Link text: 4.5:1 against surface. Current page text: 4.5:1 against surface (may use stronger weight or different color). Separator text: decorative, no strict contrast requirement.",
        touchTargets: "Each breadcrumb link: 44px height minimum (achieved via line-height + padding). Spacing between links: at least 8px.",
    },
    tag: {
        semanticElement: "<span> or <button> (if removable)",
        ariaRole: "none or button (if removable)",
        whenToUse: [
            "Use for user-generated or system-applied labels that can be filtered or removed.",
            "Use for filter chips in search results, applied filters, or content categories.",
            "Use for metadata labels on content items: categories, skills, technologies.",
            "Use when the label may need to be dismissed by the user (removable variant).",
        ],
        whenNotToUse: [
            "Do not use for status indicators — use Badge instead (Tag is interactive/removable, Badge is read-only).",
            "Do not use for navigation — use links or Tabs.",
            "Do not use for actions — use Button.",
        ],
        purpose: "Tag is a compact label for user-applied or system-applied metadata. Unlike Badge (read-only), Tag supports interaction: it can be removed (×), selected, or used as a filter chip. Tag bridges the gap between static labels and interactive controls.",
        behaviour: "Default Tags are non-interactive labels. Removable Tags have a close (×) button that removes the tag when clicked. Selectable Tags toggle between selected and unselected states on click. Tags wrap to the next line when they overflow their container.",
        interactionRules: "Keyboard: for removable tags, Tab focuses the remove button; Enter or Space removes the tag. For selectable tags, Enter or Space toggles selection. Backspace/Delete may also remove a focused tag. Pointer: click on the remove icon removes the tag; click on the tag body may select it (selectable variant).",
        contentGuidance: "Tag text should be 1–3 words in sentence case. Tags should use consistent vocabulary within a set. Truncation: tags may truncate with ellipsis if the container is very narrow, but prefer shorter text. Remove icon (×) is decorative — aria-label on the remove button provides the accessible action.",
        responsive: "Tags flow/wrap naturally within their container. On narrow viewports, tag groups may become scrollable horizontally or wrap to multiple lines. Tag size does not change with viewport. Ensure remove button touch targets are at least 44×44px on mobile.",
        implementationNotes: "For static tags: <span>. For removable tags: wrap in a container with a <button> for the remove action. For selectable tags: use <button> with aria-pressed. Tags wrap inside a flex container with gap (4–8px). Consume tokens: color/semantic/surface/subtle for background, color/semantic/border/default for border, color/semantic/text/primary for text.",
        keyboard: [
            { key: "Enter/Space", action: "Removes tag (removable) or toggles selection (selectable)" },
            { key: "Backspace/Delete", action: "Removes the focused removable tag" },
            { key: "Tab", action: "Moves between tags" },
        ],
        focus: "Static tags are not focusable. Removable tags: the remove button is focusable. Selectable tags: the tag itself is focusable. Focus ring wraps the focused element.",
        screenReader: "Static tags: read as inline text. Removable tags: the remove button announces 'Remove [tag text]'. Selectable tags: announce role ('button'), name (tag text), state ('pressed'/'not pressed').",
        labels: "Static: text content. Removable: remove button needs aria-label='Remove [tag text]'. Selectable: tag text is the name; aria-pressed communicates state.",
        stateAnnouncements: "Removable: announced via the remove button. Selectable: aria-pressed='true'/'false'. Disabled: aria-disabled='true'.",
        contrast: "Tag background: 3:1 against surface. Tag text: 4.5:1 against tag background. Tag border: 3:1 against surface. Remove icon: 3:1 against tag background.",
        touchTargets: "Remove button: 44×44px minimum (may need padding around the 12×12px icon). Selectable tag: entire tag surface is the target, minimum 44px height on mobile.",
    },
    navbar: {
        semanticElement: "<nav> with role='navigation'",
        ariaRole: "navigation",
        whenToUse: [
            "Use as the primary navigation header for the application.",
            "Use to provide consistent access to top-level sections across all pages.",
            "Use to house the logo, primary nav links, search, and user actions (avatar, settings).",
        ],
        whenNotToUse: [
            "Do not use for in-page section navigation — use Tabs or a sidebar.",
            "Do not use for breadcrumb-style hierarchical navigation.",
            "Do not use multiple NavBars on the same page.",
        ],
        purpose: "NavBar is the primary application header providing consistent top-level navigation. It anchors the user's orientation by showing the application identity (logo) and providing access to major sections. NavBar is a persistent landmark visible on every page.",
        behaviour: "NavBar is fixed or sticky at the top of the viewport. The active nav item is visually highlighted. On narrow viewports, nav items collapse into a hamburger menu. Clicking the logo navigates to the home page. User actions (avatar menu, notifications) sit in the right-aligned actions area.",
        interactionRules: "Keyboard: Tab moves through nav items (links, buttons) in DOM order. Enter activates a link. Arrow keys may navigate within a dropdown sub-menu. Escape closes dropdown menus. Pointer: click activates nav links; hover may open dropdown sub-menus. On mobile: hamburger button toggles the mobile menu; the menu slides in as an overlay.",
        contentGuidance: "Nav item labels should be 1–2 words matching the destination page titles. Use sentence case. Limit to 5–7 primary nav items. If more are needed, group under dropdown menus. The active item must be visually distinct. Logo should link to the home page.",
        responsive: "At ≥1024px: full horizontal nav. At 768–1023px: reduce item spacing or move less-used items into a 'More' menu. At <768px: collapse all nav items into a hamburger menu; keep logo and user avatar visible. Mobile menu opens as a full-screen or side-panel overlay.",
        implementationNotes: "Use <nav aria-label='Main navigation'>. Use <a> for nav links, <button> for dropdown triggers. The active item has aria-current='page'. Dropdown menus use role='menu' with role='menuitem' children. Consume tokens: color/semantic/surface/default for background, color/semantic/border/subtle for bottom border. NavBar height is 64px fixed. Logo area is 120×32px.",
        keyboard: [
            { key: "Tab", action: "Moves through nav items" },
            { key: "Enter", action: "Activates the focused link or button" },
            { key: "Escape", action: "Closes dropdown menus" },
            { key: "Arrow Down", action: "Opens dropdown and moves to first item" },
            { key: "Arrow Up/Down", action: "Navigates within a dropdown menu" },
        ],
        focus: "Nav items are focusable as links or buttons. The active item has visible active styling (not just focus styling). Dropdown menus: focus enters the menu on open and returns to the trigger on close.",
        screenReader: "The <nav> landmark announces as 'Main navigation'. Active item announced via aria-current='page'. Dropdown menus announce as 'menu' with items as 'menuitem'.",
        labels: "The <nav> has aria-label='Main navigation'. Nav links are named by their text. Logo image needs alt text ('Application name home'). Hamburger button needs aria-label='Menu' and aria-expanded.",
        stateAnnouncements: "Active: aria-current='page'. Dropdown open: aria-expanded='true'. Mobile menu open: aria-expanded='true' on the hamburger button.",
        contrast: "Nav text: 4.5:1 against nav background. Active indicator: 3:1 against nav background. Nav background: 3:1 against page surface (or visually separated via border). Logo must be visible against nav background.",
        touchTargets: "Nav items: 44px height minimum (the 64px nav height provides sufficient target). Hamburger button: 44×44px minimum. Avatar button: 44×44px minimum (32px avatar + surrounding padding).",
    },
    table: {
        semanticElement: "<table> with <thead>, <tbody>, <th>, <td>",
        ariaRole: "table (implicit from <table>)",
        whenToUse: [
            "Use for displaying structured data in rows and columns where comparison across items is the primary user task.",
            "Use for data-heavy interfaces: admin panels, dashboards, reports, user lists, order histories.",
            "Use when data has consistent fields across all items.",
        ],
        whenNotToUse: [
            "Do not use for layout — use CSS Grid or Flexbox.",
            "Do not use for small amounts of data (1–3 items) — use a list or cards.",
            "Do not use for data that doesn't share common fields across items — use cards instead.",
            "Do not use for mobile-first interfaces where horizontal scrolling would be required — consider cards or a different data presentation.",
        ],
        purpose: "Table presents structured, tabular data in rows and columns for comparison, scanning, and analysis. It is the primary data display component for information-dense interfaces where users need to compare fields across multiple items.",
        behaviour: "Rows are laid out vertically with consistent column widths. Header row is sticky on vertical scroll. Rows may have hover highlight. Clickable rows navigate to detail views. Sort icons on column headers indicate sortable columns. Zebra striping (alternating row backgrounds) improves scannability for dense data. Pagination or infinite scroll handles large datasets.",
        interactionRules: "Keyboard: Tab moves through interactive elements within cells (links, buttons). For sortable columns, the sort button receives focus and activates on Enter/Space. For selectable rows, checkboxes in the first column handle selection. Arrow keys may navigate cells if a grid pattern is implemented (role='grid'). Pointer: click on sort headers toggles sort direction; click on row may navigate to detail.",
        contentGuidance: "Column headers must clearly describe the data type in sentence case ('Full name', 'Created date'). Align numbers and dates to the right for easy scanning. Align text to the left. Empty cells should show '—' not blank. Status columns should use Badge for visual clarity. Action columns should be the rightmost column.",
        responsive: "On narrow viewports, tables may: (a) scroll horizontally with a sticky first column, (b) collapse into a card-per-row layout, or (c) hide less-important columns. Never wrap table cells to multiple lines if avoidable. Priority columns (name, status, primary action) should always be visible.",
        implementationNotes: "Use semantic <table>, <thead>, <tbody>, <th>, <td>. Use scope='col' on column headers. For sortable columns, use <button> inside <th> with aria-sort='ascending'/'descending'/'none'. For selectable rows, add a checkbox column with header checkbox for select-all. Consume tokens: color/semantic/surface/default for background, color/semantic/surface/subtle for header and alternating rows, color/semantic/border/subtle for row borders.",
        keyboard: [
            { key: "Tab", action: "Moves through interactive elements in cells" },
            { key: "Enter/Space", action: "Activates sort buttons or row links" },
            { key: "Arrow keys", action: "Navigates cells (if role='grid')" },
        ],
        focus: "Interactive elements within cells are focusable. The table itself is not focusable. Sort buttons in headers are focusable. Row checkboxes are focusable.",
        screenReader: "Announces as 'table' with caption as the name. Column headers are announced as the user navigates cells. Sort state announced via aria-sort. Selectable rows: checkbox state announced.",
        labels: "Table name via <caption> or aria-labelledby pointing to an external heading. Column headers provide context for each cell value.",
        stateAnnouncements: "Sort: aria-sort='ascending'/'descending'/'none' on <th>. Selectable: aria-checked on row checkboxes. Selected row: aria-selected='true' (if using role='grid').",
        contrast: "Header text: 4.5:1 against header background. Cell text: 4.5:1 against row background. Row border: 3:1 against row background. Status badges within cells follow Badge contrast rules.",
        touchTargets: "Interactive elements within cells: 44×44px minimum (may need larger cells on mobile). Row height: at least 44px for comfortable reading and interaction.",
    },
};
// ─── Spec builders ──────────────────────────────────────────────────────────
function buildOverview(snapshot) {
    const name = snapshot.name;
    const bp = resolveBlueprint(name);
    const knowledge = COMPONENT_KNOWLEDGE[name.toLowerCase()] || COMPONENT_KNOWLEDGE[bp?.name.toLowerCase() || ""];
    let description;
    if (snapshot.description) {
        description = snapshot.description;
    }
    else if (bp && knowledge) {
        const tokens = collectBlueprintTokens(bp.root);
        const uniqueTokens = [...new Set(tokens)];
        const variantAxes = bp.variantProperties.map((v) => `${v.name} (${v.values.join(", ")})`).join("; ");
        description = `${knowledge.purpose} The ${bp.name} component belongs to the "${bp.category}" category and supports ${bp.variantProperties.length} variant ${bp.variantProperties.length === 1 ? "axis" : "axes"}: ${variantAxes}. It consumes ${uniqueTokens.length} semantic tokens for consistent theming across light and dark modes. Layout uses ${bp.root.layoutMode?.toLowerCase() || "none"} auto layout with ${bp.root.children?.length || 0} child elements.`;
    }
    else {
        const type = snapshot.type.toLowerCase();
        const isComponentSet = snapshot.type === "COMPONENT_SET";
        const variantCount = snapshot.variants.length;
        description = `${name} is a ${type === "component_set" ? "component set" : type} ${isComponentSet ? `containing ${variantCount} variant${variantCount === 1 ? "" : "s"}` : "component"}. It uses ${snapshot.layoutMode === "NONE" ? "absolute positioning" : snapshot.layoutMode.toLowerCase() + " auto layout"} and has ${snapshot.childCount} direct child layer${snapshot.childCount === 1 ? "" : "s"}.`;
    }
    const whenToUse = knowledge?.whenToUse || inferWhenToUse(name);
    const whenNotToUse = knowledge?.whenNotToUse || inferWhenNotToUse(name);
    return { description, whenToUse, whenNotToUse };
}
function inferWhenToUse(name) {
    const n = name.toLowerCase();
    const bp = resolveBlueprint(name);
    const knowledge = COMPONENT_KNOWLEDGE[n] || COMPONENT_KNOWLEDGE[bp?.name.toLowerCase() || ""];
    if (knowledge)
        return knowledge.whenToUse;
    return [
        `Use ${name} when the design requires this specific component pattern.`,
        "Refer to the design system guidelines for approved usage contexts.",
    ];
}
function inferWhenNotToUse(name) {
    const n = name.toLowerCase();
    const bp = resolveBlueprint(name);
    const knowledge = COMPONENT_KNOWLEDGE[n] || COMPONENT_KNOWLEDGE[bp?.name.toLowerCase() || ""];
    if (knowledge)
        return knowledge.whenNotToUse;
    return [
        "Do not use outside of its intended context.",
        "Do not modify the component structure without updating the design system.",
    ];
}
function buildAnatomy(snapshot) {
    const bp = resolveBlueprint(snapshot.name);
    if (bp && bp.root.children) {
        return bp.root.children.map((child, i) => {
            const isRequired = !(/icon|media|badge|indicator|status/i.test(child.name));
            const hasA11y = /icon|label|close|action/i.test(child.name);
            let description = inferAnatomyDescription(child.name);
            description += isRequired ? " Required." : " Optional.";
            if (child.fillSemantic)
                description += ` Bound to token ${child.fillSemantic}.`;
            if (child.textPreset) {
                const preset = (0, typography_presets_js_1.getPreset)(child.textPreset);
                if (preset)
                    description += ` Typography: ${preset.name} (${preset.size}px ${preset.weight}).`;
            }
            if (hasA11y && /icon/i.test(child.name))
                description += " If icon-only (no adjacent label), requires aria-label for screen reader access.";
            return {
                index: i + 1,
                name: child.name,
                type: child.kind.toUpperCase(),
                description,
            };
        });
    }
    return snapshot.childNames.slice(0, 16).map((name, i) => ({
        index: i + 1,
        name,
        type: snapshot.scanNodes?.find((n) => n.name === name && n.depth === 1)?.type || "FRAME",
        description: inferAnatomyDescription(name),
    }));
}
function inferAnatomyDescription(name) {
    const n = name.toLowerCase();
    if (/^icon$|^leading.?icon$/i.test(n))
        return "Leading visual icon reinforcing the label or indicating the action type. Typically 16×16px.";
    if (/trailing.?icon/i.test(n))
        return "Trailing icon providing supplementary visual context or indicating expandable state (e.g., chevron).";
    if (/^icon/i.test(n))
        return "Visual icon element supporting the label or indicating an action.";
    if (/^label$|^title$/i.test(n))
        return "Primary text label communicating the component's purpose to the user. This is the accessible name source.";
    if (/heading/i.test(n))
        return "Section heading providing hierarchical structure and scannability.";
    if (/body|description|subtitle/i.test(n))
        return "Supporting text providing additional context, limited to 2–3 lines for scannability.";
    if (/value|placeholder/i.test(n))
        return "Text content area displaying the current value or placeholder guidance.";
    if (/image|thumbnail|media|photo/i.test(n))
        return "Visual media slot for images, illustrations, or video thumbnails. Requires alt text if meaningful.";
    if (/container|wrapper|frame|content/i.test(n))
        return "Layout container organizing child elements with auto-layout and consistent padding.";
    if (/divider|separator/i.test(n))
        return "Visual separator between content sections using border/subtle token.";
    if (/badge|indicator|status.?dot/i.test(n))
        return "Status or count indicator element communicating state metadata.";
    if (/field/i.test(n))
        return "Input field container with border, background, and focus state styling.";
    if (/button|btn|action|cta/i.test(n))
        return "Interactive action element triggering a specific operation.";
    if (/close|dismiss/i.test(n))
        return "Dismiss control allowing the user to close or remove the component. Requires aria-label='Close'.";
    if (/chevron|arrow|caret/i.test(n))
        return "Directional indicator showing expandable/collapsible state or navigation direction.";
    if (/header/i.test(n))
        return "Header region containing title and optional controls (close button, actions).";
    if (/footer/i.test(n))
        return "Footer region containing action buttons, typically right-aligned with primary action last.";
    if (/spacer/i.test(n))
        return "Layout spacer maintaining consistent spacing between elements.";
    if (/thumb/i.test(n))
        return "Draggable thumb element indicating and controlling the current state position.";
    if (/track/i.test(n))
        return "Track element providing the rail along which the thumb moves.";
    if (/box|circle/i.test(n))
        return "Visual indicator element showing the current selection state (checked/unchecked/selected).";
    if (/nav/i.test(n))
        return "Navigation items container holding the primary navigation links.";
    if (/logo/i.test(n))
        return "Brand identity element linking to the application's home page.";
    if (/avatar/i.test(n))
        return "User identity display showing photo, initials, or fallback icon.";
    if (/initials/i.test(n))
        return "Text fallback displaying 1–2 uppercase characters when no profile photo is available.";
    if (/remove/i.test(n))
        return "Remove action control for dismissible tags/chips. Requires aria-label='Remove [item name]'.";
    if (/row/i.test(n))
        return "Data row container holding cell values for a single data entry.";
    if (/col|cell/i.test(n))
        return "Data cell containing a single value within a table column.";
    if (/message/i.test(n))
        return "Message text area delivering the notification content.";
    return `Child element "${name}" — serves a specific structural or semantic purpose within the component.`;
}
function buildVariants(snapshot) {
    const variants = [];
    // First try blueprint variant properties for richer data
    const bp = resolveBlueprint(snapshot.name);
    if (bp && bp.variantProperties.length > 0) {
        for (const vp of bp.variantProperties) {
            variants.push({ property: vp.name, values: vp.values, defaultValue: vp.defaultValue });
        }
    }
    // Merge in snapshot variants that aren't already covered
    for (const [property, values] of Object.entries(snapshot.variantGroupProperties)) {
        if (!variants.some((v) => v.property === property)) {
            variants.push({ property, values, defaultValue: values[0] || "" });
        }
    }
    for (const prop of snapshot.componentProperties) {
        if (variants.some((v) => v.property === prop.name))
            continue;
        if (prop.options.length > 0) {
            variants.push({
                property: prop.name,
                values: prop.options,
                defaultValue: prop.value || prop.options[0] || "",
            });
        }
        else if (prop.type === "BOOLEAN") {
            variants.push({
                property: prop.name,
                values: ["true", "false"],
                defaultValue: prop.value || "false",
            });
        }
    }
    return variants;
}
function inferStatesFromSnapshot(snapshot) {
    const states = new Set();
    for (const [property, values] of Object.entries(snapshot.variantGroupProperties)) {
        if (/state|status|interaction/i.test(property)) {
            values.forEach((v) => states.add(v));
        }
    }
    for (const prop of snapshot.componentProperties) {
        if (/state|status|interaction/i.test(prop.name) && prop.options.length > 0) {
            prop.options.forEach((v) => states.add(v));
        }
    }
    // Fall back to blueprint states
    if (states.size === 0) {
        const bp = resolveBlueprint(snapshot.name);
        if (bp) {
            const stateAxis = bp.variantProperties.find((v) => /state/i.test(v.name));
            if (stateAxis) {
                stateAxis.values.forEach((v) => states.add(v));
            }
        }
    }
    if (states.size === 0) {
        const n = snapshot.name.toLowerCase();
        if (/button|btn|input|field|toggle|switch|checkbox|radio|tab|link|select/.test(n)) {
            return ["Default", "Hover", "Active", "Focus", "Disabled"];
        }
    }
    return Array.from(states);
}
function buildUsageGuidelines(snapshot) {
    const bp = resolveBlueprint(snapshot.name);
    const knowledge = COMPONENT_KNOWLEDGE[snapshot.name.toLowerCase()] || COMPONENT_KNOWLEDGE[bp?.name.toLowerCase() || ""];
    const dos = [];
    const donts = [];
    // Universal do's based on blueprint data
    dos.push("Always use design tokens for colors, spacing, and typography — never hardcode hex values, pixel measurements, or font families.");
    dos.push("Keep the component's semantic structure intact when customizing content. Do not remove required child elements.");
    if (bp) {
        const tokens = collectBlueprintTokens(bp.root);
        if (tokens.length > 0) {
            dos.push(`This component consumes ${[...new Set(tokens)].length} semantic tokens. Bind all fills, strokes, and text colors to the token system for automatic light/dark mode support.`);
        }
        if (bp.variantProperties.length > 0) {
            dos.push(`Use the provided variant axes (${bp.variantProperties.map(v => v.name).join(", ")}) instead of creating ad-hoc overrides or detaching the instance.`);
        }
    }
    if (knowledge) {
        // Component-specific knowledge provides detailed dos/donts
        const n = snapshot.name.toLowerCase();
        const k = knowledge;
        // Extract specific guidance from the knowledge base
        if (/button|btn|cta/.test(n) || bp?.name === "Button") {
            dos.push("Keep labels concise and action-oriented: 'Save changes', 'Delete item'. Use sentence case.");
            dos.push("Provide sufficient color contrast between label and background in all states — minimum 4.5:1 for text.");
            dos.push("Maintain visual hierarchy: one Primary per visible region, supported by Secondary or Ghost.");
            dos.push("For icon-only buttons, always provide an aria-label and a Tooltip showing the label on hover/focus.");
            donts.push("Don't wrap buttons in additional clickable containers — nested interactive elements break assistive technology.");
            donts.push("Don't use more than one Primary button per visible section. Demote competing actions to Secondary.");
            donts.push("Don't disable buttons without explaining why the action is unavailable — pair with a tooltip or adjacent text.");
            donts.push("Don't use buttons for navigation — use a link or anchor element with link semantics.");
            donts.push("Don't allow button labels to truncate. If the label doesn't fit, shorten the text or use full-width mode.");
            donts.push("Don't place destructive buttons adjacent to primary actions without clear visual separation.");
        }
        else if (/input|field|text.?field/.test(n) || bp?.name === "Input") {
            dos.push("Always pair inputs with a visible label positioned above the field — never beside or below.");
            dos.push("Show validation errors inline, directly below the field, linked via aria-describedby.");
            dos.push("Use specific error messages ('Email must contain @') not generic ones ('Invalid input').");
            dos.push("Set input type attribute correctly (email, tel, url, number, search) for mobile keyboard optimization.");
            donts.push("Don't use placeholder text as a substitute for a label — it disappears on input and is unreliable for screen readers.");
            donts.push("Don't remove the focus ring or focus indicator — it's required for keyboard navigation.");
            donts.push("Don't set font size below 16px on mobile inputs — iOS will auto-zoom, disrupting the layout.");
            donts.push("Don't place error messages above the field or inside the field container.");
        }
        else if (/select/.test(n) || bp?.name === "Select") {
            dos.push("Provide a clear label describing what is being selected.");
            dos.push("Sort options in a logical order (alphabetical, chronological, or by frequency).");
            dos.push("Show the currently selected option in the trigger field.");
            donts.push("Don't use Select for fewer than 5 options — use Radio for better scannability.");
            donts.push("Don't use Select for more than 15 options without search — use Combobox with autocomplete.");
            donts.push("Don't use Select for multi-selection — use Checkbox group.");
        }
        else if (/checkbox/.test(n) || bp?.name === "Checkbox") {
            dos.push("Group related checkboxes in a <fieldset> with a descriptive <legend>.");
            dos.push("Use positive framing: 'Enable notifications' rather than 'Disable notifications'.");
            dos.push("Support indeterminate state for parent checkboxes representing partial child selection.");
            donts.push("Don't use for mutually exclusive choices — use Radio instead.");
            donts.push("Don't use for immediate on/off settings — use Toggle instead (Checkbox implies deferred save).");
        }
        else if (/radio/.test(n) || bp?.name === "Radio") {
            dos.push("Always present in groups of 2+ with shared name attribute.");
            dos.push("Wrap in <fieldset> with <legend> for group labeling.");
            dos.push("Make option labels parallel in structure and length for easy scanning.");
            donts.push("Don't use a single radio button alone — radios always come in groups.");
            donts.push("Don't use for more than 7 options — use Select instead.");
        }
        else if (/toggle|switch/.test(n) || bp?.name === "Toggle") {
            dos.push("Use only for settings that take effect immediately without a save action.");
            dos.push("Label the setting being controlled, not the action ('Notifications' not 'Enable notifications').");
            donts.push("Don't use when changes require a save/submit action — use Checkbox instead.");
            donts.push("Don't rely on color alone to distinguish on/off states — position and optional icons help.");
        }
        else if (/card/.test(n) || bp?.name === "Card") {
            dos.push("Use consistent padding and spacing within all card instances across the product.");
            dos.push("Lead with the most important information — title first, then supporting text.");
            dos.push("Use the Elevated variant (shadow) for cards that need visual depth above the surface.");
            donts.push("Don't nest cards within cards — this creates confusing visual hierarchy.");
            donts.push("Don't overload cards with more than 2 actions — use a menu or navigate to a detail page.");
            donts.push("Don't vary card heights arbitrarily in a grid — use consistent content structure.");
        }
        else if (/modal|dialog/.test(n) || bp?.name === "Modal") {
            dos.push("Trap keyboard focus inside the modal while open — Tab must cycle within the modal only.");
            dos.push("Return focus to the triggering element when the modal closes.");
            dos.push("Provide a clear close action (close button, Cancel, or Escape key).");
            dos.push("Use role='alertdialog' for critical confirmations that must not be dismissed by Escape.");
            donts.push("Don't open modals without a clear trigger action from the user.");
            donts.push("Don't stack multiple modals — redesign the flow to avoid nested dialogs.");
            donts.push("Don't use modals for content that could be shown inline or in a side panel.");
        }
        else if (/toast|snackbar|notification/.test(n) || bp?.name === "Toast") {
            dos.push("Keep messages concise: one sentence, 5–12 words.");
            dos.push("Use role='alert' for error/warning toasts and role='status' for success/info.");
            dos.push("Allow user to dismiss early via close button.");
            donts.push("Don't use for critical errors requiring action — use inline errors or Modal.");
            donts.push("Don't stack more than 3 toasts simultaneously.");
            donts.push("Don't include interactive elements (links, buttons) in toast body.");
        }
        else if (/badge/.test(n) || bp?.name === "Badge") {
            dos.push("Use for read-only status indicators, counts, or categorical labels.");
            dos.push("Keep text ultra-concise: 1–3 words or a number.");
            donts.push("Don't use for interactive/removable labels — use Tag instead.");
            donts.push("Don't use badge as standalone content — always associate with another element.");
        }
        else if (/avatar/.test(n) || bp?.name === "Avatar") {
            dos.push("Provide alt text for meaningful avatar images ('Photo of Jane Doe').");
            dos.push("Implement image error fallback: photo → initials → generic icon.");
            donts.push("Don't use Avatar as a button — wrap it in a <button> if it triggers a profile menu.");
            donts.push("Don't display avatars without a size context appropriate to the layout.");
        }
        else if (/tooltip/.test(n) || bp?.name === "Tooltip") {
            dos.push("Use for supplementary, non-critical information that enhances understanding.");
            dos.push("Match tooltip text to aria-label for icon-only buttons.");
            donts.push("Don't use for critical information that users must see — it's hidden by default.");
            donts.push("Don't include interactive content (links, buttons) inside tooltips — use Popover.");
        }
        else if (/tab/.test(n) || bp?.name === "Tabs") {
            dos.push("Use roving tabindex: only the active tab is in the tab order.");
            dos.push("Keep tab labels to 1–2 words in sentence case.");
            donts.push("Don't use for more than 7 tabs — use dropdown or navigation.");
            donts.push("Don't wrap tabs to multiple lines — use scrollable or collapsed overflow.");
        }
        else if (/breadcrumb/.test(n) || bp?.name === "Breadcrumb") {
            dos.push("Match breadcrumb labels to the page titles they link to.");
            dos.push("Mark the current page with aria-current='page'.");
            donts.push("Don't use for flat site structures — Breadcrumb needs at least 3 levels.");
            donts.push("Don't make the current page a link — it should be plain text.");
        }
        else if (/nav/i.test(n) || bp?.name === "NavBar") {
            dos.push("Highlight the currently active item with aria-current='page' and visual indicator.");
            dos.push("Support keyboard navigation through all nav items.");
            dos.push("Keep primary nav items to 5–7 maximum.");
            donts.push("Don't nest more than two levels of navigation.");
            donts.push("Don't use multiple NavBars on the same page.");
        }
        else if (/table/.test(n) || bp?.name === "Table") {
            dos.push("Use semantic <table>, <thead>, <tbody>, <th>, <td> elements.");
            dos.push("Use scope='col' on column headers for proper screen reader association.");
            dos.push("Align numbers and dates to the right; text to the left.");
            donts.push("Don't use tables for layout — use CSS Grid or Flexbox.");
            donts.push("Don't use for mobile-primary interfaces without a responsive fallback (card layout or horizontal scroll).");
        }
        else {
            dos.push("Follow the design system's documented usage patterns for this component.");
            donts.push("Don't modify the component's internal structure without updating the design system.");
        }
    }
    donts.push("Don't detach the component instance unless absolutely necessary — use overrides instead.");
    return { dos, donts };
}
function buildPropsTable(snapshot) {
    const props = [];
    const bp = resolveBlueprint(snapshot.name);
    // Variant properties with rich descriptions from blueprint
    if (bp) {
        for (const vp of bp.variantProperties) {
            let description = "";
            const propName = vp.name.toLowerCase();
            if (propName === "state") {
                description = `Controls the visual and interactive state. Values: ${vp.values.join(", ")}. Default (${vp.defaultValue}) is the resting state. Each state maps to specific token overrides — see the States section for token details.`;
            }
            else if (propName === "size") {
                description = `Controls the component's dimensions, padding, and font size. Each size maps to the size scale: ${vp.values.map(v => { const so = token_override_maps_js_1.SIZE_OVERRIDES[v.toLowerCase()]; return so ? `${v} (${so.find(o => o.property === "height")?.rawValue || "?"}px)` : v; }).join(", ")}.`;
            }
            else if (propName === "type") {
                description = `Controls the visual emphasis and semantic meaning. ${vp.values.map(v => { const to = token_override_maps_js_1.TYPE_OVERRIDES[v.toLowerCase()]; return to ? `${v}: ${to.map(o => o.property).join(", ")}` : v; }).join(". ")}.`;
            }
            else {
                description = `Controls the ${vp.name.toLowerCase()} of the component. Accepted values: ${vp.values.join(", ")}.`;
            }
            props.push({ name: vp.name, type: "variant", values: vp.values, defaultValue: vp.defaultValue, description });
        }
    }
    // Add snapshot variant group properties not already covered
    for (const [property, values] of Object.entries(snapshot.variantGroupProperties)) {
        if (props.some((p) => p.name === property))
            continue;
        props.push({
            name: property,
            type: "variant",
            values,
            defaultValue: values[0] || "",
            description: `Controls the ${property.toLowerCase()} axis of the component. Accepted values: ${values.join(", ")}.`,
        });
    }
    for (const prop of snapshot.componentProperties) {
        if (props.some((p) => p.name === prop.name))
            continue;
        props.push({
            name: prop.name,
            type: prop.type.toLowerCase(),
            values: prop.options.length > 0 ? prop.options : [prop.value || ""],
            defaultValue: prop.value || "",
            description: `Component property: ${prop.name}. Type: ${prop.type.toLowerCase()}.`,
        });
    }
    return props;
}
// ─── Enhanced section builders ───────────────────────────────────────────────
function buildPurpose(snapshot) {
    const bp = resolveBlueprint(snapshot.name);
    const knowledge = COMPONENT_KNOWLEDGE[snapshot.name.toLowerCase()] || COMPONENT_KNOWLEDGE[bp?.name.toLowerCase() || ""];
    if (knowledge)
        return knowledge.purpose;
    if (bp)
        return bp.description;
    return `${snapshot.name} serves as a reusable UI element within the design system. Document its specific role and user-facing purpose.`;
}
function buildSizes(snapshot) {
    const sizes = [];
    const bp = resolveBlueprint(snapshot.name);
    // First try snapshot variant data
    for (const [property, values] of Object.entries(snapshot.variantGroupProperties)) {
        if (/size|scale|density/i.test(property)) {
            for (const val of values) {
                const v = val.toLowerCase();
                const override = token_override_maps_js_1.SIZE_OVERRIDES[v];
                const height = override?.find((o) => o.property === "height")?.rawValue;
                const paddingY = override?.find((o) => o.property === "paddingY")?.rawValue;
                const paddingX = override?.find((o) => o.property === "paddingX")?.rawValue;
                const fontSize = override?.find((o) => o.property === "fontSize")?.rawValue;
                let useCase = "General use.";
                let minTouchTarget = "44×44px (WCAG 2.5.8)";
                let context = "Standard contexts.";
                if (/xs|extra.?small/i.test(v)) {
                    useCase = `Dense data tables, compact toolbars, inline secondary actions. Height: ${height || 24}px, padding: ${paddingY || 2}/${paddingX || 4}px, font: ${fontSize || 12}px.`;
                    context = "Desktop-only, information-dense layouts. Do not use for primary CTAs or on mobile.";
                    minTouchTarget = "24×24px visual, but surrounding spacing must reach 44px effective target";
                }
                else if (/sm|small/i.test(v)) {
                    useCase = `Secondary actions, toolbar controls, table row actions. Height: ${height || 32}px, padding: ${paddingY || 4}/${paddingX || 8}px, font: ${fontSize || 14}px.`;
                    context = "Dense desktop layouts, data tables, toolbars, inline actions within larger components.";
                    minTouchTarget = "32×32px visual — pair with 8px+ spacing to approach 44px effective target on mobile";
                }
                else if (/md|medium|default/i.test(v)) {
                    useCase = `Standard UI interactions, form controls, primary buttons. Height: ${height || 40}px, padding: ${paddingY || 8}/${paddingX || 16}px, font: ${fontSize || 16}px.`;
                    context = "Most screens, forms, content areas, and modal actions. The default choice for most use cases.";
                    minTouchTarget = "40×40px visual — close to 44px target; ensure adequate touch padding";
                }
                else if (/lg|large/i.test(v)) {
                    useCase = `Primary mobile actions, hero CTAs, high-priority form submissions. Height: ${height || 48}px, padding: ${paddingY || 16}/${paddingX || 24}px, font: ${fontSize || 18}px.`;
                    context = "Mobile primary actions, landing page CTAs, prominent form submit buttons.";
                    minTouchTarget = "48×48px — exceeds WCAG minimum";
                }
                else if (/xl|extra.?large/i.test(v)) {
                    useCase = `Full-width mobile actions, hero sections, onboarding CTAs. Height: ${height || 56}px, padding: ${paddingY || 24}/${paddingX || 32}px, font: ${fontSize || 20}px.`;
                    context = "Mobile-first layouts, marketing pages, high-priority first-action surfaces.";
                    minTouchTarget = "56×56px — generous target for mobile";
                }
                sizes.push({ name: val, useCase, minTouchTarget, context });
            }
        }
    }
    // Fall back to blueprint sizes if no snapshot data
    if (sizes.length === 0 && bp) {
        const sizeAxis = bp.variantProperties.find((v) => /size/i.test(v.name));
        if (sizeAxis) {
            for (const val of sizeAxis.values) {
                const v = val.toLowerCase();
                const override = token_override_maps_js_1.SIZE_OVERRIDES[v];
                const height = override?.find((o) => o.property === "height")?.rawValue;
                sizes.push({
                    name: val,
                    useCase: height ? `Height: ${height}px.` : "Standard.",
                    minTouchTarget: "44×44px (WCAG 2.5.8)",
                    context: "See size guidelines above.",
                });
            }
        }
    }
    return sizes;
}
function buildBehaviour(snapshot) {
    const bp = resolveBlueprint(snapshot.name);
    const knowledge = COMPONENT_KNOWLEDGE[snapshot.name.toLowerCase()] || COMPONENT_KNOWLEDGE[bp?.name.toLowerCase() || ""];
    if (knowledge)
        return knowledge.behaviour;
    return "";
}
function buildInteractionRules(snapshot) {
    const bp = resolveBlueprint(snapshot.name);
    const knowledge = COMPONENT_KNOWLEDGE[snapshot.name.toLowerCase()] || COMPONENT_KNOWLEDGE[bp?.name.toLowerCase() || ""];
    if (knowledge)
        return knowledge.interactionRules;
    return "";
}
function buildContentGuidance(snapshot) {
    const bp = resolveBlueprint(snapshot.name);
    const knowledge = COMPONENT_KNOWLEDGE[snapshot.name.toLowerCase()] || COMPONENT_KNOWLEDGE[bp?.name.toLowerCase() || ""];
    if (knowledge)
        return knowledge.contentGuidance;
    if (bp) {
        const textChildren = collectBlueprintChildren(bp.root).filter((c) => c.kind === "text");
        if (textChildren.length > 0) {
            return `This component has ${textChildren.length} text element(s): ${textChildren.map(c => c.name).join(", ")}. Use sentence case for all text. Keep labels concise and descriptive. Do not truncate primary labels — adjust the container or shorten the text.`;
        }
    }
    return "";
}
function buildResponsive(snapshot) {
    const bp = resolveBlueprint(snapshot.name);
    const knowledge = COMPONENT_KNOWLEDGE[snapshot.name.toLowerCase()] || COMPONENT_KNOWLEDGE[bp?.name.toLowerCase() || ""];
    if (knowledge)
        return knowledge.responsive;
    if (bp) {
        const isFixedWidth = bp.root.primaryAxisSizing === "FIXED";
        const width = bp.root.width;
        if (isFixedWidth && width) {
            return `This component uses fixed primary axis sizing at ${width}px. On viewports narrower than the fixed width, the component should switch to full-width (100%) or be placed in a scrollable container. Touch targets must meet 44×44px minimum on mobile.`;
        }
        return `This component uses auto-sizing. It will stretch to fill its container width. On mobile viewports (<768px), ensure adequate padding and touch target sizes (44×44px minimum).`;
    }
    return "";
}
function buildImplementationNotes(snapshot) {
    const bp = resolveBlueprint(snapshot.name);
    const knowledge = COMPONENT_KNOWLEDGE[snapshot.name.toLowerCase()] || COMPONENT_KNOWLEDGE[bp?.name.toLowerCase() || ""];
    if (knowledge)
        return knowledge.implementationNotes;
    if (bp) {
        const tokens = [...new Set(collectBlueprintTokens(bp.root))];
        return `Consume ${tokens.length} semantic tokens for theming: ${tokens.slice(0, 5).join(", ")}${tokens.length > 5 ? ` (and ${tokens.length - 5} more)` : ""}. All token bindings support automatic light/dark mode switching when semantic tokens are used. Layout uses ${bp.root.layoutMode || "NONE"} auto layout. Corner radius: ${bp.root.cornerRadius || 0}px.`;
    }
    return "";
}
function buildQaChecklist(snapshot) {
    const bp = resolveBlueprint(snapshot.name);
    const knowledge = COMPONENT_KNOWLEDGE[snapshot.name.toLowerCase()] || COMPONENT_KNOWLEDGE[bp?.name.toLowerCase() || ""];
    const states = inferStatesFromSnapshot(snapshot);
    const checks = [];
    // Visual checks
    checks.push("Visual: Component matches design specs for padding, spacing, border radius, and alignment");
    if (bp) {
        checks.push(`Visual: Corner radius matches token (${bp.root.cornerRadius || 0}px)`);
        checks.push(`Visual: Internal spacing matches blueprint (paddingX: ${bp.root.paddingX || 0}px, paddingY: ${bp.root.paddingY || 0}px, gap: ${bp.root.itemSpacing || 0}px)`);
    }
    // State checks
    for (const state of states) {
        const overrides = token_override_maps_js_1.STATE_OVERRIDES[state.toLowerCase()];
        if (overrides && overrides.length > 0) {
            checks.push(`State: ${state} — verify ${overrides.map(o => o.property).join(", ")} change correctly`);
        }
        else {
            checks.push(`State: ${state} — verify visual treatment matches specification`);
        }
    }
    // Variant checks
    const variants = bp?.variantProperties || [];
    for (const v of variants) {
        if (/size/i.test(v.name)) {
            checks.push(`Size: Verify all size variants render correctly: ${v.values.join(", ")}`);
        }
        if (/type/i.test(v.name)) {
            checks.push(`Type: Verify all type variants render correctly: ${v.values.join(", ")}`);
        }
    }
    // Keyboard checks
    if (knowledge?.keyboard.length) {
        for (const k of knowledge.keyboard) {
            checks.push(`Keyboard: ${k.key} — ${k.action}`);
        }
    }
    else {
        checks.push("Keyboard: All interactive elements reachable and operable via keyboard");
    }
    // Screen reader checks
    if (knowledge) {
        checks.push(`Screen reader: Role announced as '${knowledge.ariaRole}'`);
        checks.push(`Screen reader: Accessible name computed correctly from ${knowledge.labels.includes("aria-label") ? "label or aria-label" : "visible label"}`);
    }
    else {
        checks.push("Screen reader: Correct role, name, and state announced");
    }
    // Contrast checks
    checks.push("Contrast: Text meets 4.5:1 ratio against background");
    checks.push("Contrast: Non-text elements (borders, icons, indicators) meet 3:1 against surface");
    if (knowledge?.contrast) {
        checks.push(`Contrast: ${knowledge.contrast.split(". ")[0]}`);
    }
    // Responsive checks
    checks.push("Responsive: Component renders correctly at 320px, 768px, 1024px, and 1440px widths");
    checks.push("Responsive: Touch targets meet 44×44px minimum on mobile viewports");
    // Edge case checks
    checks.push("Edge case: Component handles empty/missing content gracefully");
    checks.push("Edge case: Long text content does not break layout (truncation or wrapping behaves as specified)");
    checks.push("Theming: Component renders correctly in both light and dark modes");
    checks.push("RTL: Layout mirrors correctly in right-to-left languages");
    // Component-specific edge cases
    const n = snapshot.name.toLowerCase();
    if (/button|btn/.test(n) || bp?.name === "Button") {
        checks.push("Loading: Spinner displays and button becomes non-interactive during async operations");
        checks.push("Focus ring: Visible focus indicator appears on keyboard navigation in all states");
        checks.push("Icon-only: aria-label is set and Tooltip appears on hover/focus");
    }
    if (/input|field/.test(n) || bp?.name === "Input") {
        checks.push("Placeholder: Visible when empty, disappears on input, does not replace label");
        checks.push("Validation: Error message appears below field on blur with aria-describedby link");
        checks.push("iOS zoom: Font size ≥16px prevents unwanted zoom on focus");
    }
    if (/modal|dialog/.test(n) || bp?.name === "Modal") {
        checks.push("Focus trap: Tab key does not leave the modal while open");
        checks.push("Focus return: Focus returns to trigger element on close");
        checks.push("Escape: Modal closes and focus returns to trigger (non-alertdialog)");
        checks.push("Body scroll: Page scroll is locked while modal is open");
    }
    if (/toast/.test(n) || bp?.name === "Toast") {
        checks.push("Auto-dismiss: Toast disappears after 5–8 seconds");
        checks.push("Hover pause: Auto-dismiss timer pauses on hover");
        checks.push("Stacking: Multiple toasts stack without overlapping");
    }
    if (/table/.test(n) || bp?.name === "Table") {
        checks.push("Sort: Column sort toggles correctly and aria-sort updates");
        checks.push("Empty state: Table shows appropriate message when no data");
    }
    return checks;
}
// ─── New section builders ────────────────────────────────────────────────────
function buildHierarchyAndEmphasis(snapshot) {
    const bp = resolveBlueprint(snapshot.name);
    if (!bp)
        return "";
    const typeAxis = bp.variantProperties.find((v) => /type/i.test(v.name));
    if (!typeAxis) {
        // No type axis — describe the component's emphasis level in the system
        return `${bp.name} operates at a single emphasis level within the design system. It does not have variant-based hierarchy. Its visual weight is determined by its category ("${bp.category}") and placement context. When combining ${bp.name} with other components, use spatial grouping and sizing to establish hierarchy.`;
    }
    const typeOrder = ["Primary", "Secondary", "Ghost", "Destructive", "Outline", "Link"];
    const sortedTypes = typeAxis.values.sort((a, b) => {
        const ai = typeOrder.findIndex((t) => t.toLowerCase() === a.toLowerCase());
        const bi = typeOrder.findIndex((t) => t.toLowerCase() === b.toLowerCase());
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    const lines = [];
    lines.push(`The ${bp.name} component supports ${sortedTypes.length} emphasis levels, ordered from highest to lowest visual weight:\n`);
    for (const type of sortedTypes) {
        const overrides = token_override_maps_js_1.TYPE_OVERRIDES[type.toLowerCase()];
        if (!overrides)
            continue;
        const tokenList = overrides.map((o) => `${o.property}: ${o.token}`).join("; ");
        const t = type.toLowerCase();
        if (t === "primary") {
            lines.push(`**${type}** (highest emphasis): Solid filled background with on-color text. Use for the single most important action in a region. Tokens: ${tokenList}. Rule: never place more than one Primary ${bp.name} in the same visible area — demote competing actions to Secondary.`);
        }
        else if (t === "secondary") {
            lines.push(`**${type}** (medium emphasis): Bordered/outlined variant with primary text. Use for supporting actions that accompany a Primary. Tokens: ${tokenList}.`);
        }
        else if (t === "ghost") {
            lines.push(`**${type}** (low emphasis): Transparent background with primary-colored text. Use for tertiary actions, toolbar controls, or inline actions within content. Tokens: ${tokenList}. Caution: Ghost ${bp.name}s are less discoverable — use only when the interaction is reinforced by context.`);
        }
        else if (t === "destructive") {
            lines.push(`**${type}** (contextual): Danger-colored background with on-color text. Use exclusively for irreversible actions (delete, revoke, remove). Tokens: ${tokenList}. Rule: always pair with a confirmation step (modal or inline confirmation). Never use as the sole action — pair with a Cancel option.`);
        }
        else if (t === "outline") {
            lines.push(`**${type}** (medium-low emphasis): Transparent background with primary-colored border and text. Similar to Ghost but with a visible boundary. Tokens: ${tokenList}.`);
        }
        else if (t === "link") {
            lines.push(`**${type}** (lowest emphasis): Text-only with underline, no background or border. Use for inline actions that look like links. Tokens: ${tokenList}.`);
        }
        else {
            lines.push(`**${type}**: Custom emphasis level. Tokens: ${tokenList}.`);
        }
    }
    lines.push(`\nVisual hierarchy rule: in any visible region, the emphasis distribution should be: 1 Primary (max), 1–2 Secondary, and any number of Ghost/Link. If two actions feel equally important, the one that advances the user's primary task is Primary.`);
    return lines.join("\n");
}
function buildStructureAndSpacing(snapshot) {
    const bp = resolveBlueprint(snapshot.name);
    if (!bp)
        return "";
    const root = bp.root;
    const lines = [];
    lines.push(`**Layout mode:** ${root.layoutMode || "NONE"} auto layout`);
    lines.push(`**Primary axis alignment:** ${root.primaryAxisAlign || "MIN"} | **Counter axis alignment:** ${root.counterAxisAlign || "MIN"}`);
    lines.push(`**Primary axis sizing:** ${root.primaryAxisSizing || "AUTO"} | **Counter axis sizing:** ${root.counterAxisSizing || "AUTO"}`);
    if (root.paddingX || root.paddingY) {
        lines.push(`**Internal padding:** ${root.paddingY || 0}px vertical, ${root.paddingX || 0}px horizontal`);
    }
    if (root.itemSpacing) {
        lines.push(`**Item spacing:** ${root.itemSpacing}px between child elements`);
    }
    if (root.cornerRadius) {
        lines.push(`**Corner radius:** ${root.cornerRadius}px (token: ${root.cornerRadius <= 4 ? "radius/sm" : root.cornerRadius <= 8 ? "radius/md" : root.cornerRadius <= 12 ? "radius/lg" : root.cornerRadius <= 16 ? "radius/xl" : "radius/full"})`);
    }
    if (root.width) {
        lines.push(`**Default width:** ${root.width}px (${root.primaryAxisSizing === "FIXED" ? "fixed" : "auto, grows with content"})`);
    }
    if (root.height) {
        lines.push(`**Default height:** ${root.height}px (${root.counterAxisSizing === "FIXED" ? "fixed" : "auto, grows with content"})`);
    }
    // Token bindings table
    const tokens = bp.tokenBindings;
    const nodeTokens = [];
    // From explicit bindings
    for (const tb of tokens) {
        nodeTokens.push({ element: tb.nodePath || "Container", property: tb.property, token: tb.semanticToken });
    }
    // From node semantic fills
    if (root.fillSemantic)
        nodeTokens.push({ element: "Container", property: "fills", token: root.fillSemantic });
    if (root.strokeSemantic)
        nodeTokens.push({ element: "Container", property: "strokes", token: root.strokeSemantic });
    if (root.children) {
        for (const child of root.children) {
            if (child.fillSemantic)
                nodeTokens.push({ element: child.name, property: "fills", token: child.fillSemantic });
            if (child.strokeSemantic)
                nodeTokens.push({ element: child.name, property: "strokes", token: child.strokeSemantic });
            if (child.textFillSemantic)
                nodeTokens.push({ element: child.name, property: "text fills", token: child.textFillSemantic });
        }
    }
    // Deduplicate
    const unique = nodeTokens.filter((t, i, arr) => arr.findIndex((u) => u.element === t.element && u.property === t.property && u.token === t.token) === i);
    if (unique.length > 0) {
        lines.push(`\n**Token bindings (${unique.length}):**`);
        for (const t of unique) {
            lines.push(`- ${t.element} → ${t.property} → \`${t.token}\``);
        }
    }
    return lines.join("\n");
}
function buildStatesDetailed(snapshot) {
    const states = inferStatesFromSnapshot(snapshot);
    const bp = resolveBlueprint(snapshot.name);
    const knowledge = COMPONENT_KNOWLEDGE[snapshot.name.toLowerCase()] || COMPONENT_KNOWLEDGE[bp?.name.toLowerCase() || ""];
    return states.map((stateName) => {
        const overrides = token_override_maps_js_1.STATE_OVERRIDES[stateName.toLowerCase()];
        const tokenOverride = overrides && overrides.length > 0
            ? overrides.map((o) => `${o.property}: ${o.token || o.rawValue}`).join("; ")
            : "No token overrides — uses default tokens";
        let visualTreatment = "Default appearance.";
        let behaviourChange = "No behaviour change.";
        let trigger = "";
        let a11yImplication = "";
        const s = stateName.toLowerCase();
        if (s === "default") {
            visualTreatment = "Resting state appearance with base tokens applied.";
            behaviourChange = "Component is fully interactive and ready for user input.";
            trigger = "Initial render, after interaction completes.";
            a11yImplication = "No special ARIA attributes needed beyond base semantics.";
        }
        else if (s === "hover") {
            visualTreatment = "Background shifts to hover token. Cursor changes to pointer for interactive elements.";
            behaviourChange = "Visual feedback only — no functional change.";
            trigger = "Pointer enters the component boundary.";
            a11yImplication = "Not applicable to keyboard users. Must not be the sole way to reveal information.";
        }
        else if (s === "pressed" || s === "active") {
            visualTreatment = "Background darkens to pressed token. Visual compression effect.";
            behaviourChange = "Visual feedback during the press — the action fires on release (click event).";
            trigger = "Pointer down on the component or Enter/Space key held.";
            a11yImplication = "For toggle buttons, use aria-pressed to communicate toggle state.";
        }
        else if (s === "focused" || s === "focus") {
            visualTreatment = "Focus ring appears using color/semantic/border/focus at 2px width. Border may change color.";
            behaviourChange = "Component is the current keyboard navigation target. Focus-visible applies only on keyboard nav, not pointer.";
            trigger = "Tab navigation reaches the component, or programmatic focus.";
            a11yImplication = "Focus ring MUST be visible — WCAG 2.4.7. Never suppress the focus indicator.";
        }
        else if (s === "disabled") {
            visualTreatment = "Opacity reduces to 0.4. All interactive tokens are replaced with disabled variants.";
            behaviourChange = "Component is non-interactive. All pointer events are blocked. Removed from tab order.";
            trigger = "Programmatic: disabled attribute or aria-disabled set to true.";
            a11yImplication = "Use aria-disabled='true' instead of HTML disabled if the element needs to remain focusable (e.g., to show a tooltip explaining why it's disabled). Screen readers announce 'dimmed' or 'unavailable'.";
        }
        else if (s === "loading") {
            visualTreatment = "Label replaced with spinner icon. Background remains in default state.";
            behaviourChange = "Component is visually active but non-interactive. All activation is locked until loading completes.";
            trigger = "Programmatic: async operation in progress.";
            a11yImplication = "Set aria-busy='true' on the element. Use aria-live='polite' on adjacent status region for progress updates.";
        }
        else if (s === "error") {
            visualTreatment = "Border changes to danger color. Background may shift to danger/bg. Error icon or message appears.";
            behaviourChange = "Validation has failed. The user must correct the input before proceeding.";
            trigger = "Validation failure on blur, submit, or real-time check.";
            a11yImplication = "Set aria-invalid='true'. Link error message via aria-describedby. Error message should be announced via aria-live.";
        }
        else if (s === "success") {
            visualTreatment = "Border changes to success color. Success icon may appear.";
            behaviourChange = "Validation has passed or operation completed successfully.";
            trigger = "Validation success or operation completion.";
            a11yImplication = "Success state may be announced via aria-live='polite' if it's dynamic feedback.";
        }
        else if (s === "checked") {
            visualTreatment = "Checkbox/radio shows filled state with check mark. Background uses primary action token.";
            behaviourChange = "Selection is active. Form value reflects the checked state.";
            trigger = "User clicks/taps or presses Space on the control.";
            a11yImplication = "aria-checked='true' for checkboxes and radios. Screen readers announce 'checked'.";
        }
        else if (s === "indeterminate") {
            visualTreatment = "Checkbox shows a dash/minus indicator instead of a check mark.";
            behaviourChange = "Represents partial selection in a parent checkbox with mixed child states.";
            trigger = "Programmatic: some but not all child checkboxes are checked.";
            a11yImplication = "aria-checked='mixed'. Screen readers announce 'partially checked'.";
        }
        else if (s === "selected") {
            visualTreatment = "Visual emphasis showing this option is the active selection (primary color, indicator).";
            behaviourChange = "This is the active selection in a mutually exclusive group.";
            trigger = "User selects this option from a group.";
            a11yImplication = "aria-selected='true' (for tabs, options) or aria-checked='true' (for radios).";
        }
        else if (s === "on") {
            visualTreatment = "Toggle track fills with primary color. Thumb slides to the 'on' position.";
            behaviourChange = "Setting is active. Change takes effect immediately.";
            trigger = "User clicks/taps or presses Space.";
            a11yImplication = "aria-checked='true' for role='switch'. Screen readers announce 'on'.";
        }
        else if (s === "off") {
            visualTreatment = "Toggle track shows neutral/border color. Thumb sits in the 'off' position.";
            behaviourChange = "Setting is inactive.";
            trigger = "User clicks/taps or presses Space from 'on' state.";
            a11yImplication = "aria-checked='false'. Screen readers announce 'off'.";
        }
        else {
            visualTreatment = `${stateName} state — specific visual treatment to be documented.`;
            trigger = `Triggered when the component enters ${stateName} state.`;
        }
        return { name: stateName, visualTreatment, behaviourChange, trigger, tokenOverride, a11yImplication };
    });
}
function buildAccessibilityDeep(snapshot) {
    const bp = resolveBlueprint(snapshot.name);
    const knowledge = COMPONENT_KNOWLEDGE[snapshot.name.toLowerCase()] || COMPONENT_KNOWLEDGE[bp?.name.toLowerCase() || ""];
    if (knowledge) {
        return {
            semanticElement: knowledge.semanticElement,
            keyboard: knowledge.keyboard,
            focus: knowledge.focus,
            screenReader: knowledge.screenReader,
            labels: knowledge.labels,
            stateAnnouncements: knowledge.stateAnnouncements,
            contrast: knowledge.contrast,
            touchTargets: knowledge.touchTargets,
        };
    }
    return {
        semanticElement: "Use the most semantically appropriate HTML element. Prefer native elements over ARIA roles.",
        keyboard: [{ key: "Tab", action: "Moves focus to/from the component" }],
        focus: "The component should be focusable if interactive. Focus ring must be visible on keyboard navigation.",
        screenReader: "Ensure the component has an accessible name, role, and state announcements.",
        labels: "Provide an accessible name via visible label, aria-label, or aria-labelledby.",
        stateAnnouncements: "Communicate relevant states (disabled, expanded, selected, invalid) via ARIA attributes.",
        contrast: "Text: 4.5:1 against background. Non-text elements: 3:1 against adjacent surfaces.",
        touchTargets: "Interactive elements: 44×44px minimum target area (WCAG 2.5.8).",
    };
}
function buildRelatedComponents(snapshot) {
    const bp = resolveBlueprint(snapshot.name);
    if (!bp)
        return [];
    const related = [];
    const name = bp.name.toLowerCase();
    // Find same-category components
    const sameCategory = component_templates_js_1.COMPONENT_BLUEPRINTS.filter((b) => b.category === bp.category && b.name !== bp.name);
    for (const rel of sameCategory) {
        related.push({
            name: rel.name,
            relationship: `Same category ("${bp.category}"). Both serve ${bp.category === "core" ? "foundational UI" : bp.category === "forms" ? "form/input" : bp.category === "navigation" ? "navigation" : bp.category === "feedback" ? "feedback" : bp.category === "overlay" ? "overlay" : bp.category} purposes.`,
            whenToPrefer: `Use ${rel.name} when ${rel.description.toLowerCase()}.`,
        });
    }
    // Cross-category relationships
    if (name === "button") {
        related.push({ name: "Tag", relationship: "Tags can look like buttons but serve a labeling/filtering purpose, not an action purpose.", whenToPrefer: "Use Tag for removable labels and filter chips. Use Button for actions." });
    }
    if (name === "input") {
        related.push({ name: "Select", relationship: "Both are form controls but Input accepts free text while Select presents a fixed list.", whenToPrefer: "Use Select when options are known and limited (5–15). Use Input when the user types their own value." });
    }
    if (name === "checkbox") {
        related.push({ name: "Toggle", relationship: "Both handle boolean values but differ in when the change takes effect.", whenToPrefer: "Use Toggle when the change is immediate (no save action). Use Checkbox when changes are batched with form submission." });
        related.push({ name: "Radio", relationship: "Both are selection controls but Checkbox allows multiple selections.", whenToPrefer: "Use Radio for mutually exclusive single-select. Use Checkbox for multi-select." });
    }
    if (name === "toggle") {
        related.push({ name: "Checkbox", relationship: "Both handle boolean values but Toggle implies immediate effect.", whenToPrefer: "Use Checkbox when changes require a save/submit action." });
    }
    if (name === "radio") {
        related.push({ name: "Select", relationship: "Both are single-select controls but Radio shows all options upfront.", whenToPrefer: "Use Select for 5+ options where space is constrained. Use Radio for 2–7 options needing full visibility." });
    }
    if (name === "badge") {
        related.push({ name: "Tag", relationship: "Both display compact labels but Badge is read-only while Tag is interactive.", whenToPrefer: "Use Tag when the label can be removed, filtered, or selected by the user." });
    }
    if (name === "tag") {
        related.push({ name: "Badge", relationship: "Both display compact labels but Tag is interactive while Badge is read-only.", whenToPrefer: "Use Badge for static status indicators and counts that users cannot modify." });
    }
    if (name === "toast") {
        related.push({ name: "Modal", relationship: "Both deliver feedback but Toast is non-blocking while Modal requires user action.", whenToPrefer: "Use Modal for critical decisions. Use Toast for non-critical status feedback." });
    }
    if (name === "modal") {
        related.push({ name: "Toast", relationship: "Both deliver information but Modal blocks interaction while Toast does not.", whenToPrefer: "Use Toast for brief non-blocking feedback. Use Modal only when user action is required." });
    }
    if (name === "tabs") {
        related.push({ name: "NavBar", relationship: "Both organize content but Tabs switch panels within a page while NavBar navigates between pages.", whenToPrefer: "Use NavBar for top-level page navigation. Use Tabs for in-page content organization." });
    }
    return related;
}
function convertAccessibilityOverrides(a11y) {
    const sections = [];
    if (a11y.semanticRole)
        sections.push({ title: "Semantic Role", style: "bullets", items: [a11y.semanticRole] });
    if (a11y.ariaAttributes)
        sections.push({ title: "ARIA Attributes", style: "bullets", items: [a11y.ariaAttributes] });
    if (a11y.keyboardInteraction?.length) {
        sections.push({
            title: "Keyboard Interaction",
            style: "bullets",
            items: a11y.keyboardInteraction.map((k) => `${k.key}: ${k.action}`),
        });
    }
    if (a11y.focusManagement)
        sections.push({ title: "Focus Management", style: "bullets", items: [a11y.focusManagement] });
    if (a11y.screenReaderAnnouncements)
        sections.push({ title: "Screen Reader Announcements", style: "bullets", items: [a11y.screenReaderAnnouncements] });
    if (a11y.readingOrder)
        sections.push({ title: "Reading Order", style: "bullets", items: [a11y.readingOrder] });
    if (a11y.touchTargets)
        sections.push({ title: "Touch Targets", style: "bullets", items: [a11y.touchTargets] });
    if (a11y.colorContrast)
        sections.push({ title: "Color Contrast", style: "bullets", items: [a11y.colorContrast] });
    return sections;
}
// ─── Format the spec as a markdown report ───────────────────────────────────
function formatSpecAsReport(spec) {
    const lines = [];
    // 1. Title and short description
    lines.push(`# ${spec.componentName}`);
    lines.push("");
    lines.push(`> ${spec.purpose || spec.overview.description}`);
    lines.push("");
    lines.push("---");
    lines.push("");
    // 2. Overview
    lines.push("## Overview");
    lines.push(spec.overview.description);
    lines.push("");
    // 3. When to use
    lines.push("## When to Use");
    spec.overview.whenToUse.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
    // 4. When not to use
    lines.push("## When Not to Use");
    spec.overview.whenNotToUse.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
    // 5. Variants
    lines.push("## Variants");
    if (spec.variants.length > 0) {
        lines.push("| Property | Values | Default |");
        lines.push("|----------|--------|---------|");
        spec.variants.forEach((v) => {
            lines.push(`| ${v.property} | ${v.values.join(", ")} | ${v.defaultValue} |`);
        });
    }
    else {
        lines.push("No explicit variants detected.");
    }
    lines.push("");
    // 6. Hierarchy and emphasis
    if (spec.hierarchy) {
        lines.push("## Hierarchy and Emphasis");
        lines.push(spec.hierarchy);
        lines.push("");
    }
    // 7. Anatomy
    lines.push("## Anatomy");
    if (spec.anatomy.length > 0) {
        lines.push("| # | Element | Type | Description |");
        lines.push("|---|---------|------|-------------|");
        spec.anatomy.forEach((part) => {
            lines.push(`| ${part.index} | ${part.name} | ${part.type} | ${part.description} |`);
        });
    }
    lines.push("");
    // 8. Properties
    lines.push("## Properties");
    if (spec.props.length > 0) {
        lines.push("| Name | Type | Values | Default | Description |");
        lines.push("|------|------|--------|---------|-------------|");
        spec.props.forEach((p) => {
            lines.push(`| ${p.name} | ${p.type} | ${p.values.join(", ")} | ${p.defaultValue} | ${p.description} |`);
        });
    }
    else {
        lines.push("No component properties detected.");
    }
    lines.push("");
    // 9. Structure and spacing
    lines.push("## Structure and Spacing");
    if (spec.structureAndSpacing) {
        lines.push(spec.structureAndSpacing);
        lines.push("");
    }
    if (spec.spacing.length > 0) {
        lines.push("### Measured Spacing (from Figma)");
        lines.push("| Element | Layout | Padding (T/R/B/L) | Gap | Size (W×H) | Sizing |");
        lines.push("|---------|--------|-------------------|-----|------------|--------|");
        spec.spacing.slice(0, 20).forEach((s) => {
            lines.push(`| ${s.element} | ${s.layoutMode} | ${s.paddingTop}/${s.paddingRight}/${s.paddingBottom}/${s.paddingLeft} | ${s.itemSpacing} | ${s.width}×${s.height} | H:${s.layoutSizingH} V:${s.layoutSizingV} |`);
        });
        lines.push("");
    }
    if (spec.colorTokens.length > 0) {
        lines.push("### Color Tokens");
        lines.push("| Element | Property | Color | Token |");
        lines.push("|---------|----------|-------|-------|");
        spec.colorTokens.slice(0, 30).forEach((c) => {
            lines.push(`| ${c.element} | ${c.property} | ${c.colorHex} | ${c.tokenName || "—"} |`);
        });
        lines.push("");
    }
    if (spec.typography.length > 0) {
        lines.push("### Typography");
        lines.push("| Element | Font | Size | Weight | Line Height | Token |");
        lines.push("|---------|------|------|--------|-------------|-------|");
        spec.typography.slice(0, 20).forEach((t) => {
            const lh = t.lineHeightPx ? `${t.lineHeightPx}px` : "auto";
            lines.push(`| ${t.element} | ${t.fontFamily} | ${t.fontSize}px | ${t.fontStyle} | ${lh} | ${t.tokenName || "—"} |`);
        });
        lines.push("");
    }
    // 10. Sizes
    if (spec.sizes.length > 0) {
        lines.push("## Sizes");
        lines.push("| Size | Use Case | Min Touch Target | Context |");
        lines.push("|------|----------|------------------|---------|");
        spec.sizes.forEach((s) => {
            lines.push(`| ${s.name} | ${s.useCase} | ${s.minTouchTarget} | ${s.context} |`);
        });
        lines.push("");
    }
    // 11. States and behaviour
    lines.push("## States and Behaviour");
    if (spec.statesDetailed.length > 0) {
        lines.push("| State | Visual Treatment | Trigger | Token Override | Accessibility |");
        lines.push("|-------|-----------------|---------|---------------|---------------|");
        spec.statesDetailed.forEach((s) => {
            lines.push(`| **${s.name}** | ${s.visualTreatment} | ${s.trigger} | ${s.tokenOverride} | ${s.a11yImplication} |`);
        });
    }
    else if (spec.states.length > 0) {
        spec.states.forEach((s) => lines.push(`- ${s}`));
    }
    lines.push("");
    // 12. Interaction rules
    if (spec.interactionRules) {
        lines.push("## Interaction Rules");
        lines.push(spec.interactionRules);
        lines.push("");
    }
    // 13. Content guidance
    if (spec.contentGuidance) {
        lines.push("## Content Guidance");
        lines.push(spec.contentGuidance);
        lines.push("");
    }
    // 14. Responsive behaviour
    if (spec.responsive) {
        lines.push("## Responsive Behaviour");
        lines.push(spec.responsive);
        lines.push("");
    }
    // 15. Accessibility
    lines.push("## Accessibility");
    if (spec.accessibilityDeep) {
        const a = spec.accessibilityDeep;
        lines.push(`### Semantic Structure`);
        lines.push(`Preferred element: ${a.semanticElement}`);
        lines.push("");
        lines.push("### Keyboard Interaction");
        if (a.keyboard.length > 0) {
            lines.push("| Key | Action |");
            lines.push("|-----|--------|");
            a.keyboard.forEach((k) => lines.push(`| ${k.key} | ${k.action} |`));
        }
        lines.push("");
        lines.push("### Focus Management");
        lines.push(a.focus);
        lines.push("");
        lines.push("### Screen Reader Support");
        lines.push(a.screenReader);
        lines.push("");
        lines.push("### Labels and Descriptions");
        lines.push(a.labels);
        lines.push("");
        lines.push("### State Announcements");
        lines.push(a.stateAnnouncements);
        lines.push("");
        lines.push("### Color and Contrast");
        lines.push(a.contrast);
        lines.push("");
        lines.push("### Touch Targets");
        lines.push(a.touchTargets);
        lines.push("");
    }
    if (spec.accessibility.length > 0) {
        lines.push("### Additional Accessibility Notes (from APG)");
        spec.accessibility.forEach((section) => {
            lines.push(`#### ${section.title}`);
            section.items.forEach((item) => lines.push(`- ${item}`));
            lines.push("");
        });
    }
    // 16. Developer notes
    if (spec.implementationNotes) {
        lines.push("## Developer Notes");
        lines.push(spec.implementationNotes);
        lines.push("");
    }
    // 17. QA acceptance criteria
    if (spec.qaChecklist.length > 0) {
        lines.push("## QA Acceptance Criteria");
        lines.push("| Area | What to Verify |");
        lines.push("|------|---------------|");
        spec.qaChecklist.forEach((item) => {
            const [area, ...rest] = item.split(": ");
            if (rest.length > 0) {
                lines.push(`| ${area} | ${rest.join(": ")} |`);
            }
            else {
                lines.push(`| General | ${item} |`);
            }
        });
        lines.push("");
    }
    // 18. Do's and Don'ts
    lines.push("## Do's and Don'ts");
    lines.push("### Do");
    spec.usageGuidelines.dos.forEach((d) => lines.push(`- ${d}`));
    lines.push("");
    lines.push("### Don't");
    spec.usageGuidelines.donts.forEach((d) => lines.push(`- ${d}`));
    lines.push("");
    // 19. Related components
    if (spec.relatedComponents.length > 0) {
        lines.push("## Related Components");
        lines.push("| Component | Relationship | When to Prefer |");
        lines.push("|-----------|-------------|----------------|");
        spec.relatedComponents.forEach((r) => {
            lines.push(`| **${r.name}** | ${r.relationship} | ${r.whenToPrefer} |`);
        });
        lines.push("");
    }
    return lines.join("\n");
}
// ─── Visual documentation page renderer (Carbon/uSpec quality) ──────────────
function escStr(s) {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "");
}
async function createVisualDocPage(spec, nodeId, pageName) {
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    const variantsJson = JSON.stringify(spec.variants.slice(0, 12));
    const anatomyJson = JSON.stringify(spec.anatomy.slice(0, 12));
    const statesJson = JSON.stringify(spec.states.slice(0, 8));
    const dosJson = JSON.stringify(spec.usageGuidelines.dos.slice(0, 6));
    const dontsJson = JSON.stringify(spec.usageGuidelines.donts.slice(0, 6));
    const colorTokensJson = JSON.stringify(spec.colorTokens.slice(0, 24));
    const typographyJson = JSON.stringify(spec.typography.slice(0, 12));
    const spacingJson = JSON.stringify(spec.spacing.slice(0, 12));
    const propsJson = JSON.stringify(spec.props.slice(0, 16));
    const a11yJson = JSON.stringify(spec.accessibility.slice(0, 6));
    // ── SCRIPT 1: Page + Header + Overview + Types + Anatomy ──
    const result1 = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      var existing = figma.root.children.find(function(p) { return p.name === "${escStr(pageName)}"; });
      var page = existing || figma.createPage();
      page.name = "${escStr(pageName)}";
      await figma.setCurrentPageAsync(page);
      for (var ch of [...page.children]) { ch.remove(); }

      // Load fonts
      var fonts = [
        { family: "Inter", style: "Bold" },
        { family: "Inter", style: "Semi Bold" },
        { family: "Inter", style: "Medium" },
        { family: "Inter", style: "Regular" },
      ];
      for (var f of fonts) {
        try { await figma.loadFontAsync(f); } catch(e) {
          try { await figma.loadFontAsync({ family: "Roboto", style: f.style === "Semi Bold" ? "Medium" : f.style }); } catch(e2) {}
        }
      }

      var fontBold = { family: "Inter", style: "Bold" };
      var fontSemiBold = { family: "Inter", style: "Semi Bold" };
      var fontMedium = { family: "Inter", style: "Medium" };
      var fontRegular = { family: "Inter", style: "Regular" };

      var C = {
        bg: { r: 1, g: 1, b: 1 },
        cardBg: { r: 0.969, g: 0.969, b: 0.976 },
        text: { r: 0.13, g: 0.13, b: 0.13 },
        textMuted: { r: 0.35, g: 0.35, b: 0.4 },
        accent: { r: 0.75, g: 0.0, b: 0.45 },
        stroke: { r: 0.88, g: 0.88, b: 0.9 },
        green: { r: 0.13, g: 0.59, b: 0.33 },
        red: { r: 0.86, g: 0.15, b: 0.15 },
        marker: { r: 0.75, g: 0.0, b: 0.45 },
        badgeBg: { r: 0.2, g: 0.2, b: 0.22 },
        headerTint: { r: 0.95, g: 0.95, b: 0.96 },
        white: { r: 1, g: 1, b: 1 },
        specRed: { r: 0.85, g: 0.1, b: 0.3 },
      };

      var W = 1200;

      function T(chars, font, size, color, width) {
        var t = figma.createText();
        try { t.fontName = font; } catch(e) { t.fontName = { family: "Roboto", style: "Regular" }; }
        t.fontSize = size;
        t.lineHeight = { unit: "PIXELS", value: Math.round(size * 1.5) };
        t.characters = String(chars || "");
        t.fills = [{ type: "SOLID", color: color }];
        if (width) { t.resize(width, t.height); t.textAutoResize = "HEIGHT"; }
        else { t.textAutoResize = "WIDTH_AND_HEIGHT"; }
        return t;
      }

      function divider() {
        var d = figma.createFrame();
        d.resize(W - 80, 1);
        d.fills = [{ type: "SOLID", color: C.stroke }];
        d.layoutAlign = "STRETCH";
        return d;
      }

      function sectionTitle(title) {
        return T(title, fontBold, 28, C.text);
      }

      function makeMarker(letter, filled) {
        var m = figma.createFrame();
        m.resize(28, 28); m.cornerRadius = 14;
        m.layoutMode = "VERTICAL";
        m.primaryAxisAlignItems = "CENTER"; m.counterAxisAlignItems = "CENTER";
        m.primaryAxisSizingMode = "FIXED"; m.counterAxisSizingMode = "FIXED";
        if (filled) {
          m.fills = [{ type: "SOLID", color: C.marker }];
        } else {
          m.fills = [{ type: "SOLID", color: C.white }];
          m.strokes = [{ type: "SOLID", color: C.marker }]; m.strokeWeight = 2;
        }
        m.appendChild(T(letter, fontBold, 13, filled ? C.white : C.marker));
        return m;
      }

      function specBadge(text, bgColor) {
        var b = figma.createFrame();
        b.layoutMode = "HORIZONTAL";
        b.primaryAxisSizingMode = "AUTO"; b.counterAxisSizingMode = "AUTO";
        b.paddingLeft = 8; b.paddingRight = 8; b.paddingTop = 3; b.paddingBottom = 3;
        b.cornerRadius = 4;
        b.fills = [{ type: "SOLID", color: bgColor || C.specRed }];
        b.appendChild(T(text, fontMedium, 11, C.white));
        return b;
      }

      function tokenBadge(text) {
        var b = figma.createFrame();
        b.layoutMode = "HORIZONTAL";
        b.primaryAxisSizingMode = "AUTO"; b.counterAxisSizingMode = "AUTO";
        b.paddingLeft = 10; b.paddingRight = 10; b.paddingTop = 5; b.paddingBottom = 5;
        b.cornerRadius = 4;
        b.fills = [{ type: "SOLID", color: C.badgeBg }];
        b.appendChild(T(text, fontMedium, 12, C.white));
        return b;
      }

      function tableCell(text, w, isHeader, hasToken) {
        var cell = figma.createFrame();
        cell.layoutMode = "HORIZONTAL";
        cell.primaryAxisSizingMode = "FIXED"; cell.counterAxisSizingMode = "AUTO";
        cell.primaryAxisAlignItems = "MIN"; cell.counterAxisAlignItems = "CENTER";
        cell.paddingTop = 14; cell.paddingBottom = 14; cell.paddingLeft = 16; cell.paddingRight = 16;
        cell.fills = [{ type: "SOLID", color: isHeader ? C.headerTint : C.white }];
        cell.resize(w, 10);
        cell.clipsContent = true;
        cell.strokes = [{ type: "SOLID", color: C.stroke }];
        cell.strokeBottomWeight = 1; cell.strokeTopWeight = 0; cell.strokeLeftWeight = 0; cell.strokeRightWeight = 0;
        if (hasToken && text && text !== "\\u2014") {
          var badge = tokenBadge(String(text).slice(0, 40));
          badge.layoutSizingHorizontal = "FILL";
          cell.appendChild(badge);
        } else {
          cell.appendChild(T(text || "\\u2014", isHeader ? fontSemiBold : fontRegular, isHeader ? 14 : 13, isHeader ? C.text : C.textMuted, w - 32));
        }
        return cell;
      }

      function makeTable(colWidths, headers, rows, tokenColIndices) {
        var totalW = 0;
        for (var cw = 0; cw < colWidths.length; cw++) totalW += colWidths[cw];
        var table = figma.createFrame();
        table.layoutMode = "VERTICAL"; table.primaryAxisSizingMode = "AUTO";
        table.counterAxisSizingMode = "FIXED"; table.resize(totalW, 10);
        table.fills = []; table.itemSpacing = 0;
        table.cornerRadius = 8; table.clipsContent = true;
        table.strokes = [{ type: "SOLID", color: C.stroke }]; table.strokeWeight = 1;

        function makeRow(cells, isHeader) {
          var row = figma.createFrame();
          row.layoutMode = "HORIZONTAL"; row.primaryAxisSizingMode = "FIXED"; row.counterAxisSizingMode = "AUTO";
          row.resize(totalW, 10);
          row.fills = []; row.itemSpacing = 0;
          for (var i = 0; i < colWidths.length; i++) {
            var isTokenCol = !isHeader && tokenColIndices && tokenColIndices.indexOf(i) >= 0;
            row.appendChild(tableCell(cells[i] || "", colWidths[i], isHeader, isTokenCol));
          }
          return row;
        }

        table.appendChild(makeRow(headers, true));
        for (var r of rows) { table.appendChild(makeRow(r, false)); }
        return table;
      }

      // ── Resolve: INSTANCE → COMPONENT → COMPONENT_SET ──
      var rawNode = await figma.getNodeByIdAsync("${escStr(nodeId)}");
      var compSet = null;
      var singleComp = null;
      if (rawNode) {
        if (rawNode.type === "INSTANCE") {
          var mainComp = await rawNode.getMainComponentAsync();
          if (mainComp && mainComp.parent && mainComp.parent.type === "COMPONENT_SET") {
            compSet = mainComp.parent;
          } else if (mainComp) {
            singleComp = mainComp;
          }
        } else if (rawNode.type === "COMPONENT_SET") {
          compSet = rawNode;
        } else if (rawNode.type === "COMPONENT") {
          if (rawNode.parent && rawNode.parent.type === "COMPONENT_SET") {
            compSet = rawNode.parent;
          } else {
            singleComp = rawNode;
          }
        } else {
          singleComp = rawNode;
        }
      }
      var compNode = compSet || singleComp || rawNode;

      // ── ROOT FRAME ──
      var root = figma.createFrame();
      root.name = "${escStr(spec.componentName)} Documentation";
      root.layoutMode = "VERTICAL";
      root.primaryAxisSizingMode = "AUTO"; root.counterAxisSizingMode = "FIXED";
      root.resize(W, 100);
      root.paddingTop = 56; root.paddingBottom = 72; root.paddingLeft = 56; root.paddingRight = 56;
      root.itemSpacing = 48;
      root.fills = [{ type: "SOLID", color: C.bg }];
      root.x = 40; root.y = 40;

      // ── [1] HEADER ──
      var header = figma.createFrame();
      header.layoutMode = "VERTICAL"; header.primaryAxisSizingMode = "AUTO"; header.counterAxisSizingMode = "AUTO";
      header.itemSpacing = 8; header.fills = [];
      header.appendChild(T("${escStr(spec.componentName)} Documentation", fontBold, 40, C.text));
      header.appendChild(T("Design system specification", fontMedium, 16, C.accent));
      root.appendChild(header);
      root.appendChild(divider());

      // ── [2] OVERVIEW ──
      var overview = figma.createFrame();
      overview.layoutMode = "VERTICAL"; overview.primaryAxisSizingMode = "AUTO"; overview.counterAxisSizingMode = "AUTO";
      overview.itemSpacing = 20; overview.fills = [];
      overview.appendChild(sectionTitle("Overview"));
      overview.appendChild(T("${escStr(spec.overview.description)}", fontRegular, 15, C.textMuted, W - 160));

      // When to use / When not
      var whenFrame = figma.createFrame();
      whenFrame.layoutMode = "HORIZONTAL"; whenFrame.primaryAxisSizingMode = "AUTO"; whenFrame.counterAxisSizingMode = "AUTO";
      whenFrame.itemSpacing = 40; whenFrame.fills = [];
      var whenToUse = ${JSON.stringify(spec.overview.whenToUse.slice(0, 4))};
      var whenNotToUse = ${JSON.stringify(spec.overview.whenNotToUse.slice(0, 4))};
      var useCol = figma.createFrame();
      useCol.layoutMode = "VERTICAL"; useCol.primaryAxisSizingMode = "AUTO"; useCol.counterAxisSizingMode = "AUTO";
      useCol.itemSpacing = 8; useCol.fills = [];
      useCol.appendChild(T("When to use", fontSemiBold, 15, C.text));
      for (var wu of whenToUse) { useCol.appendChild(T("\\u2022  " + wu, fontRegular, 13, C.textMuted, (W - 200) / 2)); }
      whenFrame.appendChild(useCol);
      var notCol = figma.createFrame();
      notCol.layoutMode = "VERTICAL"; notCol.primaryAxisSizingMode = "AUTO"; notCol.counterAxisSizingMode = "AUTO";
      notCol.itemSpacing = 8; notCol.fills = [];
      notCol.appendChild(T("When not to use", fontSemiBold, 15, C.text));
      for (var wn of whenNotToUse) { notCol.appendChild(T("\\u2022  " + wn, fontRegular, 13, C.textMuted, (W - 200) / 2)); }
      whenFrame.appendChild(notCol);
      overview.appendChild(whenFrame);
      root.appendChild(overview);
      root.appendChild(divider());

      // ── [3] TYPES — live component instances ──
      if (compNode) {
        var typesSection = figma.createFrame();
        typesSection.layoutMode = "VERTICAL"; typesSection.primaryAxisSizingMode = "AUTO"; typesSection.counterAxisSizingMode = "AUTO";
        typesSection.itemSpacing = 24; typesSection.fills = [];
        typesSection.appendChild(sectionTitle("Types"));

        var typesRow = figma.createFrame();
        typesRow.layoutMode = "HORIZONTAL"; typesRow.primaryAxisSizingMode = "AUTO"; typesRow.counterAxisSizingMode = "AUTO";
        typesRow.itemSpacing = 40; typesRow.fills = [];
        typesRow.paddingTop = 20; typesRow.paddingBottom = 20;
        typesRow.counterAxisAlignItems = "CENTER";

        var variants = ${variantsJson};
        var typeAxis = variants.length > 0 ? variants[0] : null;
        var typeDescriptions = [];

        if (compSet && compSet.children.length > 0) {
          var shown = new Set();
          var typeIdx = 0;
          for (var child of compSet.children) {
            if (typeIdx >= 6) break;
            var firstProp = child.name.split(",")[0].trim();
            var propVal = firstProp.split("=");
            var label = propVal.length > 1 ? propVal[1].trim() : firstProp;
            if (shown.has(label)) continue;
            shown.add(label);
            var col = figma.createFrame();
            col.layoutMode = "VERTICAL"; col.primaryAxisSizingMode = "AUTO"; col.counterAxisSizingMode = "AUTO";
            col.itemSpacing = 10; col.fills = []; col.counterAxisAlignItems = "CENTER";
            try { col.appendChild(child.createInstance()); } catch(e) {}
            col.appendChild(T(label, fontMedium, 13, C.textMuted));
            typesRow.appendChild(col);
            typeDescriptions.push({ idx: typeIdx + 1, label: label });
            typeIdx++;
          }
        } else if (singleComp) {
          try { typesRow.appendChild(singleComp.createInstance()); } catch(e) {
            typesRow.appendChild(singleComp.clone());
          }
        }
        typesSection.appendChild(typesRow);

        // Numbered descriptions
        if (typeDescriptions.length > 1) {
          var descFrame = figma.createFrame();
          descFrame.layoutMode = "VERTICAL"; descFrame.primaryAxisSizingMode = "AUTO"; descFrame.counterAxisSizingMode = "AUTO";
          descFrame.itemSpacing = 8; descFrame.fills = [];
          for (var td of typeDescriptions) {
            descFrame.appendChild(T(td.idx + ". " + td.label, fontRegular, 14, C.textMuted, W - 160));
          }
          typesSection.appendChild(descFrame);
        }
        root.appendChild(typesSection);
        root.appendChild(divider());
      }

      // ── [4] ANATOMY — component diagram with markers + connector lines ──
      var anatomyParts = ${anatomyJson};
      if (anatomyParts.length > 0 && compNode) {
        var anatSection = figma.createFrame();
        anatSection.layoutMode = "VERTICAL"; anatSection.primaryAxisSizingMode = "AUTO"; anatSection.counterAxisSizingMode = "AUTO";
        anatSection.itemSpacing = 32; anatSection.fills = [];
        anatSection.appendChild(sectionTitle("Anatomy"));
        anatSection.appendChild(T("Elements that compose the ${escStr(spec.componentName)} component.", fontRegular, 15, C.textMuted, W - 160));

        var letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
        var markerColors = [
          { r: 0.75, g: 0.0, b: 0.45 },
          { r: 0.0, g: 0.47, b: 0.84 },
          { r: 0.13, g: 0.59, b: 0.33 },
          { r: 0.85, g: 0.55, b: 0.0 },
          { r: 0.58, g: 0.2, b: 0.78 },
          { r: 0.85, g: 0.1, b: 0.3 },
          { r: 0.0, g: 0.6, b: 0.55 },
          { r: 0.4, g: 0.4, b: 0.5 },
        ];

        // Helper: recursively find meaningful parts (TEXT, VECTOR, INSTANCE, small FRAME)
        function findParts(node, offX, offY, parts, depth) {
          if (depth <= 0 || parts.length >= 8) return;
          if (!("children" in node) || !node.children) return;
          for (var fi = 0; fi < node.children.length; fi++) {
            if (parts.length >= 8) break;
            var ch = node.children[fi];
            if (ch.width < 1 || ch.height < 1) continue;
            if ("visible" in ch && !ch.visible) continue;
            var absX = offX + ch.x;
            var absY = offY + ch.y;
            var isLeaf = ch.type === "TEXT" || ch.type === "VECTOR" || ch.type === "BOOLEAN_OPERATION" ||
              ch.type === "STAR" || ch.type === "ELLIPSE" || ch.type === "RECTANGLE" || ch.type === "LINE";
            var isSmallFrame = (ch.type === "FRAME" || ch.type === "GROUP" || ch.type === "INSTANCE") &&
              (!("children" in ch) || ch.children.length === 0 || (ch.width < 48 && ch.height < 48));
            if (isLeaf || isSmallFrame) {
              parts.push({ name: ch.name, x: absX, y: absY, w: ch.width, h: ch.height, type: ch.type });
            } else if ("children" in ch) {
              findParts(ch, absX, absY, parts, depth - 1);
            }
          }
        }

        // Helper: create a colored marker circle
        function colorMarker(letter, color) {
          var m = figma.createFrame();
          m.resize(28, 28); m.cornerRadius = 14;
          m.layoutMode = "VERTICAL";
          m.primaryAxisAlignItems = "CENTER"; m.counterAxisAlignItems = "CENTER";
          m.primaryAxisSizingMode = "FIXED"; m.counterAxisSizingMode = "FIXED";
          m.fills = [{ type: "SOLID", color: color }];
          m.appendChild(T(letter, fontBold, 13, C.white));
          return m;
        }

        // ── ANATOMY DIAGRAM: single large card with component + markers ──
        var anatSource = compSet ? compSet.children[0] : singleComp;
        var collectedParts = [];

        if (anatSource) {
          var anatCard = figma.createFrame();
          anatCard.name = "anatomy-diagram";
          anatCard.fills = [{ type: "SOLID", color: C.cardBg }];
          anatCard.cornerRadius = 12;
          anatCard.clipsContent = false;

          var anatInst;
          try { anatInst = anatSource.createInstance(); } catch(e) { anatInst = anatSource.clone(); }
          var instW = anatInst.width;
          var instH = anatInst.height;

          // Scale up small components for better visibility
          var scale = 1;
          if (instW < 120 || instH < 30) { scale = 2; anatInst.rescale(scale); instW = anatInst.width; instH = anatInst.height; }

          var padding = 100;
          var cardW = W - 160;
          var cardH = instH + padding * 2 + 60;
          anatCard.resize(cardW, cardH);

          var instX = (cardW - instW) / 2;
          var instY = padding + 20;
          anatInst.x = instX;
          anatInst.y = instY;
          anatCard.appendChild(anatInst);

          // Find all meaningful parts within the instance
          findParts(anatInst, instX, instY, collectedParts, 4);

          // Also add the container itself as a part
          if (collectedParts.length === 0) {
            collectedParts.push({ name: anatSource.name, x: instX, y: instY, w: instW, h: instH, type: "FRAME" });
          }

          // Place markers, highlight outlines, and connector lines for each part
          for (var pi = 0; pi < collectedParts.length && pi < 8; pi++) {
            var part = collectedParts[pi];
            var mColor = markerColors[pi % markerColors.length];
            var mk = colorMarker(letters[pi], mColor);

            // Highlight outline around the part
            var highlight = figma.createFrame();
            highlight.resize(part.w + 4, part.h + 4);
            highlight.x = part.x - 2; highlight.y = part.y - 2;
            highlight.fills = []; highlight.cornerRadius = 2;
            highlight.strokes = [{ type: "SOLID", color: mColor }];
            highlight.strokeWeight = 1.5; highlight.opacity = 0.5;
            highlight.dashPattern = [4, 3];
            anatCard.appendChild(highlight);

            // Position marker: alternate top/bottom/left/right
            var mkX, mkY, lineStartX, lineStartY, lineEndX, lineEndY;
            var partCX = part.x + part.w / 2;
            var partCY = part.y + part.h / 2;

            if (pi % 4 === 0) {
              // Above
              mkX = partCX - 14;
              mkY = Math.max(4, part.y - 50);
              lineStartX = mkX + 14; lineStartY = mkY + 28;
              lineEndX = partCX; lineEndY = part.y;
            } else if (pi % 4 === 1) {
              // Right
              mkX = Math.min(cardW - 36, part.x + part.w + 20);
              mkY = partCY - 14;
              lineStartX = part.x + part.w; lineStartY = partCY;
              lineEndX = mkX; lineEndY = mkY + 14;
            } else if (pi % 4 === 2) {
              // Below
              mkX = partCX - 14;
              mkY = Math.min(cardH - 36, part.y + part.h + 20);
              lineStartX = partCX; lineStartY = part.y + part.h;
              lineEndX = mkX + 14; lineEndY = mkY;
            } else {
              // Left
              mkX = Math.max(4, part.x - 50);
              mkY = partCY - 14;
              lineStartX = mkX + 28; lineStartY = mkY + 14;
              lineEndX = part.x; lineEndY = partCY;
            }
            mk.x = mkX; mk.y = mkY;
            anatCard.appendChild(mk);

            // Connector line (horizontal + vertical segments)
            var dx = lineEndX - lineStartX;
            var dy = lineEndY - lineStartY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
              if (Math.abs(dy) < Math.abs(dx) * 0.3) {
                // Nearly horizontal
                var hl = figma.createFrame();
                hl.resize(Math.max(1, Math.abs(dx)), 1.5);
                hl.x = Math.min(lineStartX, lineEndX); hl.y = lineStartY - 0.75;
                hl.fills = [{ type: "SOLID", color: mColor }]; hl.opacity = 0.6;
                anatCard.appendChild(hl);
              } else if (Math.abs(dx) < Math.abs(dy) * 0.3) {
                // Nearly vertical
                var vl = figma.createFrame();
                vl.resize(1.5, Math.max(1, Math.abs(dy)));
                vl.x = lineStartX - 0.75; vl.y = Math.min(lineStartY, lineEndY);
                vl.fills = [{ type: "SOLID", color: mColor }]; vl.opacity = 0.6;
                anatCard.appendChild(vl);
              } else {
                // L-shaped: horizontal then vertical
                var hl2 = figma.createFrame();
                hl2.resize(Math.max(1, Math.abs(dx)), 1.5);
                hl2.x = Math.min(lineStartX, lineEndX); hl2.y = lineStartY - 0.75;
                hl2.fills = [{ type: "SOLID", color: mColor }]; hl2.opacity = 0.6;
                anatCard.appendChild(hl2);
                var vl2 = figma.createFrame();
                vl2.resize(1.5, Math.max(1, Math.abs(dy)));
                vl2.x = lineEndX - 0.75; vl2.y = Math.min(lineStartY, lineEndY);
                vl2.fills = [{ type: "SOLID", color: mColor }]; vl2.opacity = 0.6;
                anatCard.appendChild(vl2);
              }
            }
          }

          anatSection.appendChild(anatCard);
        }

        // ── Legend row (horizontal, colored markers + labels) ──
        var legendRow = figma.createFrame();
        legendRow.layoutMode = "HORIZONTAL"; legendRow.primaryAxisSizingMode = "AUTO"; legendRow.counterAxisSizingMode = "AUTO";
        legendRow.itemSpacing = 20; legendRow.fills = []; legendRow.layoutWrap = "WRAP";
        for (var lgi = 0; lgi < collectedParts.length && lgi < 8; lgi++) {
          var legendItem = figma.createFrame();
          legendItem.layoutMode = "HORIZONTAL"; legendItem.primaryAxisSizingMode = "AUTO"; legendItem.counterAxisSizingMode = "AUTO";
          legendItem.itemSpacing = 8; legendItem.fills = []; legendItem.counterAxisAlignItems = "CENTER";
          legendItem.appendChild(colorMarker(letters[lgi], markerColors[lgi % markerColors.length]));
          legendItem.appendChild(T(collectedParts[lgi].name + " (" + collectedParts[lgi].type + ")", fontMedium, 14, C.text));
          legendRow.appendChild(legendItem);
        }
        anatSection.appendChild(legendRow);

        // ── Parts table ──
        var partsTableRows = collectedParts.slice(0, 8).map(function(p, idx) {
          var desc = "";
          for (var ai2 = 0; ai2 < anatomyParts.length; ai2++) {
            if (anatomyParts[ai2].name === p.name) { desc = anatomyParts[ai2].description; break; }
          }
          return [letters[idx], p.type, p.name, desc || "Component element"];
        });
        var partsTable = makeTable([60, 120, 240, 620], ["#", "Type", "Element", "Description"], partsTableRows, []);
        anatSection.appendChild(partsTable);
        root.appendChild(anatSection);
        root.appendChild(divider());

        // ── [4b] STRUCTURE — Spacing, Padding, Radius annotations ──
        if (anatSource) {
          var structSection = figma.createFrame();
          structSection.layoutMode = "VERTICAL"; structSection.primaryAxisSizingMode = "AUTO"; structSection.counterAxisSizingMode = "AUTO";
          structSection.itemSpacing = 24; structSection.fills = [];
          structSection.appendChild(sectionTitle("Structure"));
          structSection.appendChild(T("Spacing, padding, corner radius, and dimensions.", fontRegular, 15, C.textMuted, W - 160));

          var structCard = figma.createFrame();
          structCard.name = "structure-diagram";
          structCard.fills = [{ type: "SOLID", color: C.cardBg }];
          structCard.cornerRadius = 12;
          structCard.clipsContent = false;

          var sInst;
          try { sInst = anatSource.createInstance(); } catch(e) { sInst = anatSource.clone(); }
          var sW = sInst.width; var sH = sInst.height;
          if (sW < 120 || sH < 30) { sInst.rescale(2); sW = sInst.width; sH = sInst.height; }

          var sPad = 120;
          var sCardW = W - 160;
          var sCardH = sH + sPad * 2 + 40;
          structCard.resize(sCardW, sCardH);
          var sInstX = (sCardW - sW) / 2;
          var sInstY = sPad;
          sInst.x = sInstX; sInst.y = sInstY;
          structCard.appendChild(sInst);

          // Read spacing data from the source component
          var cPadTop = anatSource.paddingTop || 0;
          var cPadRight = anatSource.paddingRight || 0;
          var cPadBottom = anatSource.paddingBottom || 0;
          var cPadLeft = anatSource.paddingLeft || 0;
          var cGap = anatSource.itemSpacing || 0;
          var cRadius = anatSource.cornerRadius || 0;
          if (typeof cRadius !== "number") cRadius = 0;
          var cLayoutMode = anatSource.layoutMode || "NONE";
          var dimColor = C.specRed;

          // ── Padding annotations (red dimension lines with value badges) ──

          // Top padding
          if (cPadTop > 0) {
            // Vertical line on left showing top padding
            var ptLine = figma.createFrame();
            ptLine.resize(1.5, Math.max(1, cPadTop * (sH > 10 ? 1 : 2)));
            ptLine.x = sInstX + 12; ptLine.y = sInstY + 2;
            ptLine.fills = [{ type: "SOLID", color: dimColor }];
            structCard.appendChild(ptLine);
            // Top padding area fill
            var ptFill = figma.createFrame();
            ptFill.resize(sW - 4, Math.max(2, cPadTop * (sH > 10 ? 1 : 2)));
            ptFill.x = sInstX + 2; ptFill.y = sInstY + 2;
            ptFill.fills = [{ type: "SOLID", color: dimColor }]; ptFill.opacity = 0.1;
            structCard.appendChild(ptFill);
            // Badge
            var ptBadge = specBadge(cPadTop + "px top", dimColor);
            ptBadge.x = sInstX + sW + 16; ptBadge.y = sInstY + 2;
            structCard.appendChild(ptBadge);
          }

          // Bottom padding
          if (cPadBottom > 0) {
            var pbLine = figma.createFrame();
            pbLine.resize(1.5, Math.max(1, cPadBottom * (sH > 10 ? 1 : 2)));
            pbLine.x = sInstX + 12; pbLine.y = sInstY + sH - cPadBottom * (sH > 10 ? 1 : 2) - 2;
            pbLine.fills = [{ type: "SOLID", color: dimColor }];
            structCard.appendChild(pbLine);
            var pbFill = figma.createFrame();
            pbFill.resize(sW - 4, Math.max(2, cPadBottom * (sH > 10 ? 1 : 2)));
            pbFill.x = sInstX + 2; pbFill.y = sInstY + sH - cPadBottom * (sH > 10 ? 1 : 2) - 2;
            pbFill.fills = [{ type: "SOLID", color: dimColor }]; pbFill.opacity = 0.1;
            structCard.appendChild(pbFill);
            var pbBadge = specBadge(cPadBottom + "px bottom", dimColor);
            pbBadge.x = sInstX + sW + 16; pbBadge.y = sInstY + sH - 24;
            structCard.appendChild(pbBadge);
          }

          // Left padding
          if (cPadLeft > 0) {
            var plFill = figma.createFrame();
            plFill.resize(Math.max(2, cPadLeft * (sW > 40 ? 1 : 2)), sH - 4);
            plFill.x = sInstX + 2; plFill.y = sInstY + 2;
            plFill.fills = [{ type: "SOLID", color: dimColor }]; plFill.opacity = 0.1;
            structCard.appendChild(plFill);
            var plBadge = specBadge(cPadLeft + "px", dimColor);
            plBadge.x = sInstX + 2; plBadge.y = sInstY + sH + 12;
            structCard.appendChild(plBadge);
          }

          // Right padding
          if (cPadRight > 0) {
            var prFill = figma.createFrame();
            prFill.resize(Math.max(2, cPadRight * (sW > 40 ? 1 : 2)), sH - 4);
            prFill.x = sInstX + sW - cPadRight * (sW > 40 ? 1 : 2) - 2; prFill.y = sInstY + 2;
            prFill.fills = [{ type: "SOLID", color: dimColor }]; prFill.opacity = 0.1;
            structCard.appendChild(prFill);
            var prBadge = specBadge(cPadRight + "px", dimColor);
            prBadge.x = sInstX + sW - 40; prBadge.y = sInstY + sH + 12;
            structCard.appendChild(prBadge);
          }

          // Gap / item spacing
          if (cGap > 0) {
            var gapBadge = specBadge("gap: " + cGap + "px", { r: 0.0, g: 0.47, b: 0.84 });
            gapBadge.x = sInstX + sW / 2 - 30; gapBadge.y = sInstY + sH + 12;
            structCard.appendChild(gapBadge);
          }

          // Corner radius
          if (cRadius > 0) {
            // Small arc indicator at top-left corner
            var crFrame = figma.createFrame();
            crFrame.resize(20, 20); crFrame.cornerRadius = 10;
            crFrame.fills = []; crFrame.strokes = [{ type: "SOLID", color: dimColor }]; crFrame.strokeWeight = 1.5;
            crFrame.x = sInstX - 24; crFrame.y = sInstY - 4;
            structCard.appendChild(crFrame);
            var crBadge = specBadge("r=" + cRadius + "px", dimColor);
            crBadge.x = sInstX - 28; crBadge.y = sInstY - 30;
            structCard.appendChild(crBadge);
          }

          // Overall width dimension line (above component)
          var wLine = figma.createFrame();
          wLine.resize(sW, 1.5);
          wLine.x = sInstX; wLine.y = sInstY - 20;
          wLine.fills = [{ type: "SOLID", color: C.textMuted }];
          structCard.appendChild(wLine);
          // Width endpoints
          var wEnd1 = figma.createFrame(); wEnd1.resize(1.5, 10);
          wEnd1.x = sInstX; wEnd1.y = sInstY - 25;
          wEnd1.fills = [{ type: "SOLID", color: C.textMuted }];
          structCard.appendChild(wEnd1);
          var wEnd2 = figma.createFrame(); wEnd2.resize(1.5, 10);
          wEnd2.x = sInstX + sW - 1.5; wEnd2.y = sInstY - 25;
          wEnd2.fills = [{ type: "SOLID", color: C.textMuted }];
          structCard.appendChild(wEnd2);
          var wBadge = specBadge(Math.round(sW) + "px", C.textMuted);
          wBadge.x = sInstX + sW / 2 - 20; wBadge.y = sInstY - 44;
          structCard.appendChild(wBadge);

          // Overall height dimension line (left of component)
          var hLine = figma.createFrame();
          hLine.resize(1.5, sH);
          hLine.x = sInstX - 40; hLine.y = sInstY;
          hLine.fills = [{ type: "SOLID", color: C.textMuted }];
          structCard.appendChild(hLine);
          var hEnd1 = figma.createFrame(); hEnd1.resize(10, 1.5);
          hEnd1.x = sInstX - 45; hEnd1.y = sInstY;
          hEnd1.fills = [{ type: "SOLID", color: C.textMuted }];
          structCard.appendChild(hEnd1);
          var hEnd2 = figma.createFrame(); hEnd2.resize(10, 1.5);
          hEnd2.x = sInstX - 45; hEnd2.y = sInstY + sH - 1.5;
          hEnd2.fills = [{ type: "SOLID", color: C.textMuted }];
          structCard.appendChild(hEnd2);
          var hBadge = specBadge(Math.round(sH) + "px", C.textMuted);
          hBadge.x = sInstX - 80; hBadge.y = sInstY + sH / 2 - 10;
          structCard.appendChild(hBadge);

          // Layout mode badge
          if (cLayoutMode !== "NONE") {
            var layoutBadge = specBadge("Auto Layout: " + cLayoutMode, { r: 0.58, g: 0.2, b: 0.78 });
            layoutBadge.x = sInstX; layoutBadge.y = sInstY - 68;
            structCard.appendChild(layoutBadge);
          }

          structSection.appendChild(structCard);

          // Structure summary table
          var structRows = [];
          structRows.push(["Padding", cPadTop + " / " + cPadRight + " / " + cPadBottom + " / " + cPadLeft + " px", "Top / Right / Bottom / Left"]);
          if (cGap > 0) structRows.push(["Gap (itemSpacing)", cGap + " px", "Space between child elements"]);
          if (cRadius > 0) structRows.push(["Corner Radius", cRadius + " px", "Rounded corners"]);
          structRows.push(["Dimensions", Math.round(sW / (sW < 120 ? 2 : 1)) + " \\u00d7 " + Math.round(sH / (sH < 30 ? 2 : 1)) + " px", "Width \\u00d7 Height (unscaled)"]);
          structRows.push(["Layout", cLayoutMode, "Auto layout direction"]);
          var structTable = makeTable([200, 200, 640], ["Property", "Value", "Description"], structRows, []);
          structSection.appendChild(structTable);

          root.appendChild(structSection);
          root.appendChild(divider());
        }
      }

      // ── Normalize all root children to FILL width ──
      if ('children' in root) {
        for (var rc of root.children) {
          if ('layoutSizingHorizontal' in rc) {
            rc.layoutSizingHorizontal = 'FILL';
          }
          if ('layoutAlign' in rc) {
            rc.layoutAlign = 'STRETCH';
          }
        }
      }

      page.appendChild(root);
      return { pageId: page.id, rootId: root.id };
    })();
  `);
    if (!result1.success) {
        throw new Error(`figma_component_doc script 1 failed: ${result1.error}`);
    }
    const { pageId, rootId } = result1.result;
    // ── SCRIPT 2: States + Size Variations + Usage + Tables ──
    const result2 = await bridge.execute(`
    (async () => {
      var fonts = [
        { family: "Inter", style: "Bold" },
        { family: "Inter", style: "Semi Bold" },
        { family: "Inter", style: "Medium" },
        { family: "Inter", style: "Regular" },
      ];
      for (var f of fonts) {
        try { await figma.loadFontAsync(f); } catch(e) {
          try { await figma.loadFontAsync({ family: "Roboto", style: f.style === "Semi Bold" ? "Medium" : f.style }); } catch(e2) {}
        }
      }

      var fontBold = { family: "Inter", style: "Bold" };
      var fontSemiBold = { family: "Inter", style: "Semi Bold" };
      var fontMedium = { family: "Inter", style: "Medium" };
      var fontRegular = { family: "Inter", style: "Regular" };

      var C = {
        bg: { r: 1, g: 1, b: 1 },
        cardBg: { r: 0.969, g: 0.969, b: 0.976 },
        text: { r: 0.13, g: 0.13, b: 0.13 },
        textMuted: { r: 0.35, g: 0.35, b: 0.4 },
        accent: { r: 0.75, g: 0.0, b: 0.45 },
        stroke: { r: 0.88, g: 0.88, b: 0.9 },
        green: { r: 0.13, g: 0.59, b: 0.33 },
        red: { r: 0.86, g: 0.15, b: 0.15 },
        marker: { r: 0.75, g: 0.0, b: 0.45 },
        badgeBg: { r: 0.2, g: 0.2, b: 0.22 },
        headerTint: { r: 0.95, g: 0.95, b: 0.96 },
        white: { r: 1, g: 1, b: 1 },
        specRed: { r: 0.85, g: 0.1, b: 0.3 },
      };

      var W = 1200;

      function T(chars, font, size, color, width) {
        var t = figma.createText();
        try { t.fontName = font; } catch(e) { t.fontName = { family: "Roboto", style: "Regular" }; }
        t.fontSize = size;
        t.lineHeight = { unit: "PIXELS", value: Math.round(size * 1.5) };
        t.characters = String(chars || "");
        t.fills = [{ type: "SOLID", color: color }];
        if (width) { t.resize(width, t.height); t.textAutoResize = "HEIGHT"; }
        else { t.textAutoResize = "WIDTH_AND_HEIGHT"; }
        return t;
      }

      function divider() {
        var d = figma.createFrame();
        d.resize(W - 80, 1);
        d.fills = [{ type: "SOLID", color: C.stroke }];
        d.layoutAlign = "STRETCH";
        return d;
      }

      function sectionTitle(title) { return T(title, fontBold, 28, C.text); }

      function specBadge(text, bgColor) {
        var b = figma.createFrame();
        b.layoutMode = "HORIZONTAL";
        b.primaryAxisSizingMode = "AUTO"; b.counterAxisSizingMode = "AUTO";
        b.paddingLeft = 8; b.paddingRight = 8; b.paddingTop = 3; b.paddingBottom = 3;
        b.cornerRadius = 4;
        b.fills = [{ type: "SOLID", color: bgColor || C.specRed }];
        b.appendChild(T(text, fontMedium, 11, C.white));
        return b;
      }

      function tokenBadge(text) {
        var b = figma.createFrame();
        b.layoutMode = "HORIZONTAL";
        b.primaryAxisSizingMode = "AUTO"; b.counterAxisSizingMode = "AUTO";
        b.paddingLeft = 10; b.paddingRight = 10; b.paddingTop = 5; b.paddingBottom = 5;
        b.cornerRadius = 4;
        b.fills = [{ type: "SOLID", color: C.badgeBg }];
        b.appendChild(T(text, fontMedium, 12, C.white));
        return b;
      }

      function tableCell(text, w, isHeader, hasToken) {
        var cell = figma.createFrame();
        cell.layoutMode = "HORIZONTAL";
        cell.primaryAxisSizingMode = "FIXED"; cell.counterAxisSizingMode = "AUTO";
        cell.primaryAxisAlignItems = "MIN"; cell.counterAxisAlignItems = "CENTER";
        cell.paddingTop = 14; cell.paddingBottom = 14; cell.paddingLeft = 16; cell.paddingRight = 16;
        cell.fills = [{ type: "SOLID", color: isHeader ? C.headerTint : C.white }];
        cell.resize(w, 10);
        cell.clipsContent = true;
        cell.strokes = [{ type: "SOLID", color: C.stroke }];
        cell.strokeBottomWeight = 1; cell.strokeTopWeight = 0; cell.strokeLeftWeight = 0; cell.strokeRightWeight = 0;
        if (hasToken && text && text !== "\\u2014") {
          var badge = tokenBadge(String(text).slice(0, 40));
          badge.layoutSizingHorizontal = "FILL";
          cell.appendChild(badge);
        } else {
          cell.appendChild(T(text || "\\u2014", isHeader ? fontSemiBold : fontRegular, isHeader ? 14 : 13, isHeader ? C.text : C.textMuted, w - 32));
        }
        return cell;
      }

      function makeTable(colWidths, headers, rows, tokenColIndices) {
        var totalW = 0;
        for (var cw = 0; cw < colWidths.length; cw++) totalW += colWidths[cw];
        var table = figma.createFrame();
        table.layoutMode = "VERTICAL"; table.primaryAxisSizingMode = "AUTO";
        table.counterAxisSizingMode = "FIXED"; table.resize(totalW, 10);
        table.fills = []; table.itemSpacing = 0;
        table.cornerRadius = 8; table.clipsContent = true;
        table.strokes = [{ type: "SOLID", color: C.stroke }]; table.strokeWeight = 1;
        function makeRow(cells, isHeader) {
          var row = figma.createFrame();
          row.layoutMode = "HORIZONTAL"; row.primaryAxisSizingMode = "FIXED"; row.counterAxisSizingMode = "AUTO";
          row.resize(totalW, 10);
          row.fills = []; row.itemSpacing = 0;
          for (var i = 0; i < colWidths.length; i++) {
            var isTokenCol = !isHeader && tokenColIndices && tokenColIndices.indexOf(i) >= 0;
            row.appendChild(tableCell(cells[i] || "", colWidths[i], isHeader, isTokenCol));
          }
          return row;
        }
        table.appendChild(makeRow(headers, true));
        for (var r of rows) { table.appendChild(makeRow(r, false)); }
        return table;
      }

      var root = await figma.getNodeByIdAsync("${rootId}");
      if (!root) throw new Error("Root frame not found");

      // Resolve compNode again
      var rawNode = await figma.getNodeByIdAsync("${escStr(nodeId)}");
      var compSet = null; var singleComp = null;
      if (rawNode) {
        if (rawNode.type === "INSTANCE") {
          var mainComp = await rawNode.getMainComponentAsync();
          if (mainComp && mainComp.parent && mainComp.parent.type === "COMPONENT_SET") compSet = mainComp.parent;
          else if (mainComp) singleComp = mainComp;
        } else if (rawNode.type === "COMPONENT_SET") { compSet = rawNode; }
        else if (rawNode.type === "COMPONENT") {
          if (rawNode.parent && rawNode.parent.type === "COMPONENT_SET") compSet = rawNode.parent;
          else singleComp = rawNode;
        } else { singleComp = rawNode; }
      }
      var compNode = compSet || singleComp || rawNode;

      // ── [5] STATES AND BEHAVIOUR ──
      var states = ${statesJson};
      if (states.length > 0 && compNode) {
        var statesSection = figma.createFrame();
        statesSection.layoutMode = "VERTICAL"; statesSection.primaryAxisSizingMode = "AUTO"; statesSection.counterAxisSizingMode = "AUTO";
        statesSection.itemSpacing = 24; statesSection.fills = [];
        statesSection.appendChild(sectionTitle("States and Behaviour"));
        statesSection.appendChild(T("How the component appears in each interactive state.", fontRegular, 15, C.textMuted, W - 160));

        // Find state axis and ALL non-state axes
        var stateAxisName = null;
        var variants = ${variantsJson};
        if (compSet && compSet.variantGroupProperties) {
          for (var propName in compSet.variantGroupProperties) {
            if (/state|status|interaction/i.test(propName)) { stateAxisName = propName; break; }
          }
        }

        // Collect ALL non-state variant axes to show rows for each combination
        var groupAxes = [];
        for (var vi = 0; vi < variants.length; vi++) {
          var vProp = variants[vi].property;
          if (vProp !== stateAxisName && !/state|status|interaction/i.test(vProp)) {
            groupAxes.push(variants[vi]);
          }
        }

        // Column header row (state names)
        var headerRow = figma.createFrame();
        headerRow.layoutMode = "HORIZONTAL"; headerRow.primaryAxisSizingMode = "AUTO"; headerRow.counterAxisSizingMode = "AUTO";
        headerRow.itemSpacing = 20; headerRow.fills = [];
        headerRow.paddingLeft = 140;
        for (var sh = 0; sh < states.length; sh++) {
          var shFrame = figma.createFrame();
          shFrame.layoutMode = "VERTICAL"; shFrame.primaryAxisSizingMode = "AUTO"; shFrame.counterAxisSizingMode = "AUTO";
          shFrame.fills = []; shFrame.resize(100, 10); shFrame.counterAxisAlignItems = "CENTER";
          shFrame.appendChild(T(states[sh], fontSemiBold, 13, C.text));
          headerRow.appendChild(shFrame);
        }
        statesSection.appendChild(headerRow);

        if (compSet && stateAxisName) {
          // Build combinations of all non-state axes
          var combos = [{}];
          for (var ga = 0; ga < groupAxes.length && ga < 2; ga++) {
            var newCombos = [];
            var axValues = groupAxes[ga].values.slice(0, 6);
            for (var ci2 = 0; ci2 < combos.length; ci2++) {
              for (var avi = 0; avi < axValues.length; avi++) {
                var c = {};
                for (var k in combos[ci2]) c[k] = combos[ci2][k];
                c[groupAxes[ga].property] = axValues[avi];
                newCombos.push(c);
              }
            }
            combos = newCombos;
          }
          if (combos.length === 0 || (combos.length === 1 && Object.keys(combos[0]).length === 0)) {
            combos = [{}];
          }

          // Create one row per combination
          for (var ci3 = 0; ci3 < combos.length && ci3 < 12; ci3++) {
            var combo = combos[ci3];
            var rowFrame = figma.createFrame();
            rowFrame.layoutMode = "HORIZONTAL"; rowFrame.primaryAxisSizingMode = "AUTO"; rowFrame.counterAxisSizingMode = "AUTO";
            rowFrame.itemSpacing = 20; rowFrame.fills = [];
            rowFrame.paddingTop = 12; rowFrame.paddingBottom = 12;
            rowFrame.counterAxisAlignItems = "CENTER";

            // Row label (variant combination name)
            var rowLabel = Object.values(combo).join(" / ") || "Default";
            var labelFrame = figma.createFrame();
            labelFrame.layoutMode = "VERTICAL"; labelFrame.primaryAxisSizingMode = "FIXED"; labelFrame.counterAxisSizingMode = "AUTO";
            labelFrame.resize(120, 10); labelFrame.fills = [];
            labelFrame.appendChild(T(rowLabel, fontMedium, 13, C.accent));
            rowFrame.appendChild(labelFrame);

            for (var si = 0; si < states.length; si++) {
              var stateCol = figma.createFrame();
              stateCol.layoutMode = "VERTICAL"; stateCol.primaryAxisSizingMode = "AUTO"; stateCol.counterAxisSizingMode = "AUTO";
              stateCol.itemSpacing = 6; stateCol.fills = []; stateCol.counterAxisAlignItems = "CENTER";
              stateCol.resize(100, 10);

              var found = false;
              for (var sc of compSet.children) {
                if (!sc.variantProperties) continue;
                var matchState = sc.variantProperties[stateAxisName] && sc.variantProperties[stateAxisName].toLowerCase() === states[si].toLowerCase();
                if (!matchState) continue;
                var matchCombo = true;
                for (var ck in combo) {
                  if (!sc.variantProperties[ck] || sc.variantProperties[ck].toLowerCase() !== combo[ck].toLowerCase()) {
                    matchCombo = false; break;
                  }
                }
                if (matchState && matchCombo) {
                  try { stateCol.appendChild(sc.createInstance()); found = true; } catch(e) {}
                  break;
                }
              }
              if (!found) {
                // Fallback: find any variant matching just the state
                for (var sc2 of compSet.children) {
                  if (!sc2.variantProperties) continue;
                  if (sc2.variantProperties[stateAxisName] && sc2.variantProperties[stateAxisName].toLowerCase() === states[si].toLowerCase()) {
                    try { stateCol.appendChild(sc2.createInstance()); found = true; } catch(e) {}
                    break;
                  }
                }
              }
              if (!found) {
                try { stateCol.appendChild(compSet.children[0].createInstance()); } catch(e) {}
              }
              rowFrame.appendChild(stateCol);
            }
            statesSection.appendChild(rowFrame);

            // Thin separator between rows
            if (ci3 < combos.length - 1) {
              var sepLine = figma.createFrame();
              sepLine.resize(W - 200, 1);
              sepLine.fills = [{ type: "SOLID", color: C.stroke }]; sepLine.opacity = 0.5;
              statesSection.appendChild(sepLine);
            }
          }
        } else {
          // No state axis — show generic states row
          var genRow = figma.createFrame();
          genRow.layoutMode = "HORIZONTAL"; genRow.primaryAxisSizingMode = "AUTO"; genRow.counterAxisSizingMode = "AUTO";
          genRow.itemSpacing = 20; genRow.fills = []; genRow.counterAxisAlignItems = "CENTER";
          genRow.paddingLeft = 140;
          for (var si2 = 0; si2 < states.length; si2++) {
            var stCol2 = figma.createFrame();
            stCol2.layoutMode = "VERTICAL"; stCol2.primaryAxisSizingMode = "AUTO"; stCol2.counterAxisSizingMode = "AUTO";
            stCol2.itemSpacing = 6; stCol2.fills = []; stCol2.counterAxisAlignItems = "CENTER";
            stCol2.resize(100, 10);
            if (compSet && compSet.children[0]) {
              try { stCol2.appendChild(compSet.children[0].createInstance()); } catch(e) {}
            } else if (singleComp) {
              try { stCol2.appendChild(singleComp.createInstance()); } catch(e) {}
            }
            genRow.appendChild(stCol2);
          }
          statesSection.appendChild(genRow);
        }
        root.appendChild(statesSection);
        root.appendChild(divider());
      }

      // ── [6] SPECS — Size variations with measurement annotations ──
      var sizeAxis = null;
      for (var v of variants) {
        if (/size|scale|density/i.test(v.property)) { sizeAxis = v; break; }
      }
      if (sizeAxis && compSet) {
        var specsSection = figma.createFrame();
        specsSection.layoutMode = "VERTICAL"; specsSection.primaryAxisSizingMode = "AUTO"; specsSection.counterAxisSizingMode = "AUTO";
        specsSection.itemSpacing = 24; specsSection.fills = [];
        specsSection.appendChild(sectionTitle("Specs"));

        var specsGrid = figma.createFrame();
        specsGrid.layoutMode = "HORIZONTAL"; specsGrid.primaryAxisSizingMode = "AUTO"; specsGrid.counterAxisSizingMode = "AUTO";
        specsGrid.itemSpacing = 48; specsGrid.fills = [];
        specsGrid.counterAxisAlignItems = "MIN";

        for (var sv of sizeAxis.values.slice(0, 4)) {
          var specCol = figma.createFrame();
          specCol.layoutMode = "VERTICAL"; specCol.primaryAxisSizingMode = "AUTO"; specCol.counterAxisSizingMode = "AUTO";
          specCol.itemSpacing = 12; specCol.fills = []; specCol.counterAxisAlignItems = "CENTER";

          // Find variant matching this size
          for (var sch of compSet.children) {
            if (sch.variantProperties && sch.variantProperties[sizeAxis.property] &&
                sch.variantProperties[sizeAxis.property].toLowerCase() === sv.toLowerCase()) {
              // Container with measurement annotations
              var measContainer = figma.createFrame();
              measContainer.fills = []; measContainer.clipsContent = false;

              var sInst = sch.createInstance();
              var sW = sInst.width; var sH = sInst.height;
              measContainer.resize(sW + 100, sH + 80);
              sInst.x = 50; sInst.y = 20;
              measContainer.appendChild(sInst);

              // Min-width badge on top
              var minBadge = specBadge("min-width: " + Math.round(sW) + "px", C.specRed);
              minBadge.x = sInst.x; minBadge.y = 0;
              measContainer.appendChild(minBadge);

              // Height badge on right
              var hBadge = specBadge(Math.round(sH) + "", C.specRed);
              hBadge.x = sInst.x + sW + 6;
              hBadge.y = sInst.y + sH / 2 - 10;
              measContainer.appendChild(hBadge);

              // Padding badges
              if (sch.paddingLeft > 0) {
                var plBadge = specBadge(String(Math.round(sch.paddingLeft)), C.specRed);
                plBadge.x = sInst.x - 4;
                plBadge.y = sInst.y + sH + 4;
                measContainer.appendChild(plBadge);
              }
              if (sch.paddingRight > 0) {
                var prBadge = specBadge(String(Math.round(sch.paddingRight)), C.specRed);
                prBadge.x = sInst.x + sW - 24;
                prBadge.y = sInst.y + sH + 4;
                measContainer.appendChild(prBadge);
              }
              if (sch.itemSpacing > 0) {
                var gapBadge = specBadge(String(Math.round(sch.itemSpacing)), C.specRed);
                gapBadge.x = sInst.x + sW / 2 - 10;
                gapBadge.y = sInst.y + sH + 4;
                measContainer.appendChild(gapBadge);
              }

              specCol.appendChild(measContainer);
              break;
            }
          }
          specCol.appendChild(T(sv, fontMedium, 14, C.textMuted));
          specsGrid.appendChild(specCol);
        }
        specsSection.appendChild(specsGrid);
        root.appendChild(specsSection);
        root.appendChild(divider());
      }

      // ── [7] USAGE — Do's and Don'ts ──
      var dos = ${dosJson};
      var donts = ${dontsJson};
      var usageSection = figma.createFrame();
      usageSection.layoutMode = "VERTICAL"; usageSection.primaryAxisSizingMode = "AUTO"; usageSection.counterAxisSizingMode = "AUTO";
      usageSection.itemSpacing = 24; usageSection.fills = [];
      usageSection.appendChild(sectionTitle("Usage"));

      var usageRow = figma.createFrame();
      usageRow.layoutMode = "HORIZONTAL"; usageRow.primaryAxisSizingMode = "AUTO"; usageRow.counterAxisSizingMode = "AUTO";
      usageRow.itemSpacing = 32; usageRow.fills = [];

      var halfW = (W - 180) / 2;
      var doCard = figma.createFrame();
      doCard.layoutMode = "VERTICAL"; doCard.primaryAxisSizingMode = "AUTO"; doCard.counterAxisSizingMode = "FIXED";
      doCard.resize(halfW, 10);
      doCard.itemSpacing = 12; doCard.paddingTop = 24; doCard.paddingBottom = 24; doCard.paddingLeft = 24; doCard.paddingRight = 24;
      doCard.fills = [{ type: "SOLID", color: C.cardBg }]; doCard.cornerRadius = 8;
      doCard.strokes = [{ type: "SOLID", color: C.green }];
      doCard.strokeLeftWeight = 4; doCard.strokeTopWeight = 0; doCard.strokeRightWeight = 0; doCard.strokeBottomWeight = 0;
      doCard.appendChild(T("Do's", fontSemiBold, 18, C.green));
      for (var di of dos) { doCard.appendChild(T("\\u2713  " + di, fontRegular, 14, C.textMuted, halfW - 60)); }
      usageRow.appendChild(doCard);

      var dontCard = figma.createFrame();
      dontCard.layoutMode = "VERTICAL"; dontCard.primaryAxisSizingMode = "AUTO"; dontCard.counterAxisSizingMode = "FIXED";
      dontCard.resize(halfW, 10);
      dontCard.itemSpacing = 12; dontCard.paddingTop = 24; dontCard.paddingBottom = 24; dontCard.paddingLeft = 24; dontCard.paddingRight = 24;
      dontCard.fills = [{ type: "SOLID", color: C.cardBg }]; dontCard.cornerRadius = 8;
      dontCard.strokes = [{ type: "SOLID", color: C.red }];
      dontCard.strokeLeftWeight = 4; dontCard.strokeTopWeight = 0; dontCard.strokeRightWeight = 0; dontCard.strokeBottomWeight = 0;
      dontCard.appendChild(T("Don'ts", fontSemiBold, 18, C.red));
      for (var dni of donts) { dontCard.appendChild(T("\\u2717  " + dni, fontRegular, 14, C.textMuted, halfW - 60)); }
      usageRow.appendChild(dontCard);

      usageSection.appendChild(usageRow);
      root.appendChild(usageSection);
      root.appendChild(divider());

      // ── [8] COLOR TOKEN TABLE ──
      var colorTokens = ${colorTokensJson};
      if (colorTokens.length > 0) {
        var colorSection = figma.createFrame();
        colorSection.layoutMode = "VERTICAL"; colorSection.primaryAxisSizingMode = "AUTO"; colorSection.counterAxisSizingMode = "AUTO";
        colorSection.itemSpacing = 20; colorSection.fills = [];
        colorSection.appendChild(sectionTitle("Color Tokens"));
        var cRows = colorTokens.map(function(ct) { return [ct.element, ct.property, ct.colorHex, ct.tokenName || "\\u2014"]; });
        colorSection.appendChild(makeTable([260, 200, 200, 340], ["Element", "Property", "Color", "Token"], cRows, [3]));
        root.appendChild(colorSection);
        root.appendChild(divider());
      }

      // ── [9] SPACING TABLE ──
      var spacingData = ${spacingJson};
      if (spacingData.length > 0) {
        var spacingSection = figma.createFrame();
        spacingSection.layoutMode = "VERTICAL"; spacingSection.primaryAxisSizingMode = "AUTO"; spacingSection.counterAxisSizingMode = "AUTO";
        spacingSection.itemSpacing = 20; spacingSection.fills = [];
        spacingSection.appendChild(sectionTitle("Spacing & Structure"));
        var sRows = spacingData.map(function(sp) {
          return [sp.element, sp.layoutMode,
            sp.paddingTop + "/" + sp.paddingRight + "/" + sp.paddingBottom + "/" + sp.paddingLeft,
            String(sp.itemSpacing), sp.width + "\\u00d7" + sp.height,
            "H:" + sp.layoutSizingH + " V:" + sp.layoutSizingV];
        });
        spacingSection.appendChild(makeTable([220, 140, 220, 90, 160, 200], ["Element", "Layout", "Padding (T/R/B/L)", "Gap", "Size", "Sizing"], sRows, []));
        root.appendChild(spacingSection);
        root.appendChild(divider());
      }

      // ── [10] TYPOGRAPHY TABLE ──
      var typoData = ${typographyJson};
      if (typoData.length > 0) {
        var typoSection = figma.createFrame();
        typoSection.layoutMode = "VERTICAL"; typoSection.primaryAxisSizingMode = "AUTO"; typoSection.counterAxisSizingMode = "AUTO";
        typoSection.itemSpacing = 20; typoSection.fills = [];
        typoSection.appendChild(sectionTitle("Typography"));
        var tRows = typoData.map(function(tp) {
          return [tp.element, tp.fontFamily, tp.fontSize + "px", tp.fontStyle,
            tp.lineHeightPx ? tp.lineHeightPx + "px" : "auto", tp.tokenName || "\\u2014"];
        });
        typoSection.appendChild(makeTable([220, 180, 100, 120, 140, 280], ["Element", "Font", "Size", "Weight", "Line Height", "Token"], tRows, [5]));
        root.appendChild(typoSection);
        root.appendChild(divider());
      }

      // ── [11] ACCESSIBILITY ──
      var a11yData = ${a11yJson};
      if (a11yData.length > 0) {
        var a11ySection = figma.createFrame();
        a11ySection.layoutMode = "VERTICAL"; a11ySection.primaryAxisSizingMode = "AUTO"; a11ySection.counterAxisSizingMode = "AUTO";
        a11ySection.itemSpacing = 20; a11ySection.fills = [];
        a11ySection.appendChild(sectionTitle("Accessibility"));
        for (var a11ySec of a11yData) {
          a11ySection.appendChild(T(a11ySec.title, fontSemiBold, 18, C.text));
          var bulletFrame = figma.createFrame();
          bulletFrame.layoutMode = "VERTICAL"; bulletFrame.primaryAxisSizingMode = "AUTO"; bulletFrame.counterAxisSizingMode = "AUTO";
          bulletFrame.itemSpacing = 6; bulletFrame.fills = [];
          for (var ai = 0; ai < Math.min(a11ySec.items.length, 8); ai++) {
            bulletFrame.appendChild(T("\\u2022  " + a11ySec.items[ai], fontRegular, 14, C.textMuted, W - 160));
          }
          a11ySection.appendChild(bulletFrame);
        }
        root.appendChild(a11ySection);
        root.appendChild(divider());
      }

      // ── [12] PROPS / API TABLE ──
      var propsData = ${propsJson};
      if (propsData.length > 0) {
        var propsSection = figma.createFrame();
        propsSection.layoutMode = "VERTICAL"; propsSection.primaryAxisSizingMode = "AUTO"; propsSection.counterAxisSizingMode = "AUTO";
        propsSection.itemSpacing = 20; propsSection.fills = [];
        propsSection.appendChild(sectionTitle("API / Props"));
        var pRows = propsData.map(function(pp) { return [pp.name, pp.type, pp.values.join(", "), pp.defaultValue, pp.description]; });
        propsSection.appendChild(makeTable([180, 120, 280, 140, 320], ["Name", "Type", "Values", "Default", "Description"], pRows, []));
        root.appendChild(propsSection);
      }

      // ── Normalize all root children to FILL width ──
      if ('children' in root) {
        for (var rc of root.children) {
          if ('layoutSizingHorizontal' in rc) {
            rc.layoutSizingHorizontal = 'FILL';
          }
          if ('layoutAlign' in rc) {
            rc.layoutAlign = 'STRETCH';
          }
        }
      }

      figma.viewport.scrollAndZoomIntoView([root]);
      return "ok";
    })();
  `);
    if (!result2.success) {
        throw new Error(`figma_component_doc script 2 failed: ${result2.error}`);
    }
    // ── SCRIPT 3: Purpose + Variants + Compositions + Hierarchy + Structure + Behaviour + Interaction + Content + Responsive + Implementation + QA + Related ──
    const purposeStr = escStr((spec.purpose || "").slice(0, 3000));
    const behaviourStr = escStr((spec.behaviour || "").slice(0, 3000));
    const interactionStr = escStr((spec.interactionRules || "").slice(0, 3000));
    const contentGuideStr = escStr((spec.contentGuidance || "").slice(0, 3000));
    const responsiveStr = escStr((spec.responsive || "").slice(0, 3000));
    const implNotesStr = escStr((spec.implementationNotes || "").slice(0, 3000));
    const hierarchyStr = escStr((spec.hierarchy || "").slice(0, 3000));
    const structureStr = escStr((spec.structureAndSpacing || "").slice(0, 3000));
    const sizesJson = JSON.stringify(spec.sizes?.slice(0, 8) || []);
    const qaChecklistJson = JSON.stringify(spec.qaChecklist?.slice(0, 20) || []);
    const variantsDetailedJson = JSON.stringify(spec.variantsDetailed?.slice(0, 12) || []);
    const compositionsJson = JSON.stringify(spec.supportedCompositions?.slice(0, 10) || []);
    const relatedJson = JSON.stringify(spec.relatedComponents?.slice(0, 8) || []);
    const hasScript3Content = spec.purpose || spec.behaviour || spec.interactionRules ||
        spec.contentGuidance || spec.responsive || spec.implementationNotes ||
        spec.hierarchy || spec.structureAndSpacing ||
        (spec.variantsDetailed?.length ?? 0) > 0 || (spec.supportedCompositions?.length ?? 0) > 0 ||
        (spec.sizes?.length ?? 0) > 0 || (spec.qaChecklist?.length ?? 0) > 0 ||
        (spec.relatedComponents?.length ?? 0) > 0;
    if (hasScript3Content) {
        const result3 = await bridge.execute(`
      (async () => {
        var fonts = [
          { family: "Inter", style: "Bold" },
          { family: "Inter", style: "Semi Bold" },
          { family: "Inter", style: "Medium" },
          { family: "Inter", style: "Regular" },
        ];
        for (var f of fonts) {
          try { await figma.loadFontAsync(f); } catch(e) {
            try { await figma.loadFontAsync({ family: "Roboto", style: f.style === "Semi Bold" ? "Medium" : f.style }); } catch(e2) {}
          }
        }

        var fontBold = { family: "Inter", style: "Bold" };
        var fontSemiBold = { family: "Inter", style: "Semi Bold" };
        var fontMedium = { family: "Inter", style: "Medium" };
        var fontRegular = { family: "Inter", style: "Regular" };

        var C = {
          bg: { r: 1, g: 1, b: 1 },
          cardBg: { r: 0.969, g: 0.969, b: 0.976 },
          text: { r: 0.13, g: 0.13, b: 0.13 },
          textMuted: { r: 0.35, g: 0.35, b: 0.4 },
          accent: { r: 0.75, g: 0.0, b: 0.45 },
          stroke: { r: 0.88, g: 0.88, b: 0.9 },
          green: { r: 0.13, g: 0.59, b: 0.33 },
          white: { r: 1, g: 1, b: 1 },
          badgeBg: { r: 0.2, g: 0.2, b: 0.22 },
          headerTint: { r: 0.95, g: 0.95, b: 0.96 },
          codeBg: { r: 0.12, g: 0.12, b: 0.14 },
          checkGreen: { r: 0.18, g: 0.65, b: 0.35 },
        };

        var W = 1200;

        function T(chars, font, size, color, width) {
          var t = figma.createText();
          try { t.fontName = font; } catch(e) { t.fontName = { family: "Roboto", style: "Regular" }; }
          t.fontSize = size;
          t.lineHeight = { unit: "PIXELS", value: Math.round(size * 1.5) };
          t.characters = String(chars || "");
          t.fills = [{ type: "SOLID", color: color }];
          if (width) { t.resize(width, t.height); t.textAutoResize = "HEIGHT"; }
          else { t.textAutoResize = "WIDTH_AND_HEIGHT"; }
          return t;
        }

        function divider() {
          var d = figma.createFrame();
          d.resize(W - 80, 1);
          d.fills = [{ type: "SOLID", color: C.stroke }];
          d.layoutAlign = "STRETCH";
          return d;
        }

        function sectionTitle(title) { return T(title, fontBold, 28, C.text); }

        function tokenBadge(text) {
          var b = figma.createFrame();
          b.layoutMode = "HORIZONTAL";
          b.primaryAxisSizingMode = "AUTO"; b.counterAxisSizingMode = "AUTO";
          b.paddingLeft = 10; b.paddingRight = 10; b.paddingTop = 5; b.paddingBottom = 5;
          b.cornerRadius = 4;
          b.fills = [{ type: "SOLID", color: C.badgeBg }];
          b.appendChild(T(text, fontMedium, 12, C.white));
          return b;
        }

        function tableCell(text, w, isHeader, hasToken) {
          var cell = figma.createFrame();
          cell.layoutMode = "HORIZONTAL";
          cell.primaryAxisSizingMode = "FIXED"; cell.counterAxisSizingMode = "AUTO";
          cell.primaryAxisAlignItems = "MIN"; cell.counterAxisAlignItems = "CENTER";
          cell.paddingTop = 14; cell.paddingBottom = 14; cell.paddingLeft = 16; cell.paddingRight = 16;
          cell.fills = [{ type: "SOLID", color: isHeader ? C.headerTint : C.bg }];
          cell.resize(w, 10);
          cell.clipsContent = true;
          cell.strokes = [{ type: "SOLID", color: C.stroke }];
          cell.strokeBottomWeight = 1; cell.strokeTopWeight = 0; cell.strokeLeftWeight = 0; cell.strokeRightWeight = 0;
          if (hasToken && text && text !== "\\u2014") {
            var badge = tokenBadge(String(text).slice(0, 40));
            badge.layoutSizingHorizontal = "FILL";
            cell.appendChild(badge);
          } else {
            cell.appendChild(T(text || "\\u2014", isHeader ? fontSemiBold : fontRegular, isHeader ? 14 : 13, isHeader ? C.text : C.textMuted, w - 32));
          }
          return cell;
        }

        function makeTable(colWidths, headers, rows, tokenColIndices) {
          var totalW = 0;
          for (var cw = 0; cw < colWidths.length; cw++) totalW += colWidths[cw];
          var table = figma.createFrame();
          table.layoutMode = "VERTICAL"; table.primaryAxisSizingMode = "AUTO";
          table.counterAxisSizingMode = "FIXED"; table.resize(totalW, 10);
          table.fills = []; table.itemSpacing = 0;
          table.cornerRadius = 8; table.clipsContent = true;
          table.strokes = [{ type: "SOLID", color: C.stroke }]; table.strokeWeight = 1;
          function makeRow(cells, isHeader) {
            var row = figma.createFrame();
            row.layoutMode = "HORIZONTAL"; row.primaryAxisSizingMode = "FIXED"; row.counterAxisSizingMode = "AUTO";
            row.resize(totalW, 10);
            row.fills = []; row.itemSpacing = 0;
            for (var i = 0; i < colWidths.length; i++) {
              var isTokenCol = !isHeader && tokenColIndices && tokenColIndices.indexOf(i) >= 0;
              row.appendChild(tableCell(cells[i] || "", colWidths[i], isHeader, isTokenCol));
            }
            return row;
          }
          table.appendChild(makeRow(headers, true));
          for (var r of rows) { table.appendChild(makeRow(r, false)); }
          return table;
        }

        function makeCard(title, body, bgColor) {
          var card = figma.createFrame();
          card.layoutMode = "VERTICAL"; card.primaryAxisSizingMode = "AUTO"; card.counterAxisSizingMode = "AUTO";
          card.itemSpacing = 12;
          card.paddingTop = 24; card.paddingBottom = 24; card.paddingLeft = 28; card.paddingRight = 28;
          card.fills = [{ type: "SOLID", color: bgColor || C.cardBg }];
          card.cornerRadius = 8;
          if (title) card.appendChild(T(title, fontSemiBold, 18, C.text));
          card.appendChild(T(body, fontRegular, 14, C.textMuted, W - 220));
          return card;
        }

        var root = await figma.getNodeByIdAsync("${rootId}");
        if (!root) throw new Error("Root frame not found for script 3");

        // ── [13] PURPOSE ──
        var purposeText = "${purposeStr}";
        if (purposeText) {
          var purposeSection = figma.createFrame();
          purposeSection.layoutMode = "VERTICAL"; purposeSection.primaryAxisSizingMode = "AUTO"; purposeSection.counterAxisSizingMode = "AUTO";
          purposeSection.itemSpacing = 16; purposeSection.fills = [];
          purposeSection.appendChild(sectionTitle("Purpose"));
          purposeSection.appendChild(T(purposeText, fontRegular, 15, C.textMuted, W - 160));
          root.appendChild(purposeSection);
          root.appendChild(divider());
        }

        // ── [14a] VARIANTS DETAILED TABLE ──
        var variantsDetailedData = ${variantsDetailedJson};
        if (variantsDetailedData.length > 0) {
          var vdSection = figma.createFrame();
          vdSection.layoutMode = "VERTICAL"; vdSection.primaryAxisSizingMode = "AUTO"; vdSection.counterAxisSizingMode = "AUTO";
          vdSection.itemSpacing = 20; vdSection.fills = [];
          vdSection.appendChild(sectionTitle("Variants"));
          var vdRows = variantsDetailedData.map(function(v) { return [v.name, v.purpose, v.emphasis, v.whenToUse, v.whenNotToUse]; });
          vdSection.appendChild(makeTable([160, 240, 140, 280, 220], ["Variant", "Purpose", "Emphasis", "When to Use", "When Not to Use"], vdRows, []));
          root.appendChild(vdSection);
          root.appendChild(divider());
        }

        // ── [14b] SUPPORTED COMPOSITIONS TABLE ──
        var compositionsData = ${compositionsJson};
        if (compositionsData.length > 0) {
          var compSection = figma.createFrame();
          compSection.layoutMode = "VERTICAL"; compSection.primaryAxisSizingMode = "AUTO"; compSection.counterAxisSizingMode = "AUTO";
          compSection.itemSpacing = 20; compSection.fills = [];
          compSection.appendChild(sectionTitle("Supported Compositions"));
          var compRows = compositionsData.map(function(c) { return [c.name, c.parts.join(", "), c.whenToUse, c.constraints || "\\u2014"]; });
          compSection.appendChild(makeTable([200, 280, 340, 220], ["Composition", "Parts", "When to Use", "Constraints"], compRows, []));
          root.appendChild(compSection);
          root.appendChild(divider());
        }

        // ── [14c] HIERARCHY AND EMPHASIS ──
        var hierarchyText = "${hierarchyStr}";
        if (hierarchyText) {
          root.appendChild(makeCard("Hierarchy and Emphasis", hierarchyText, C.cardBg));
          root.appendChild(divider());
        }

        // ── [14d] STRUCTURE AND SPACING ──
        var structureText = "${structureStr}";
        if (structureText) {
          root.appendChild(makeCard("Structure and Spacing", structureText, C.cardBg));
          root.appendChild(divider());
        }

        // ── [14] SIZES TABLE ──
        var sizesData = ${sizesJson};
        if (sizesData.length > 0) {
          var sizesSection = figma.createFrame();
          sizesSection.layoutMode = "VERTICAL"; sizesSection.primaryAxisSizingMode = "AUTO"; sizesSection.counterAxisSizingMode = "AUTO";
          sizesSection.itemSpacing = 20; sizesSection.fills = [];
          sizesSection.appendChild(sectionTitle("Sizes"));
          var sRows = sizesData.map(function(s) { return [s.name, s.useCase, s.minTouchTarget, s.context]; });
          sizesSection.appendChild(makeTable([160, 320, 220, 340], ["Size", "Use Case", "Min Touch Target", "Context"], sRows, []));
          root.appendChild(sizesSection);
          root.appendChild(divider());
        }

        // ── [15] BEHAVIOUR ──
        var behaviourText = "${behaviourStr}";
        if (behaviourText) {
          root.appendChild(makeCard("Behaviour", behaviourText, C.cardBg));
          root.appendChild(divider());
        }

        // ── [16] INTERACTION RULES ──
        var interactionText = "${interactionStr}";
        if (interactionText) {
          root.appendChild(makeCard("Interaction Rules", interactionText, C.cardBg));
          root.appendChild(divider());
        }

        // ── [17] CONTENT GUIDANCE ──
        var contentGuideText = "${contentGuideStr}";
        if (contentGuideText) {
          root.appendChild(makeCard("Content Guidance", contentGuideText, C.cardBg));
          root.appendChild(divider());
        }

        // ── [18] RESPONSIVE ──
        var responsiveText = "${responsiveStr}";
        if (responsiveText) {
          root.appendChild(makeCard("Responsive Behaviour", responsiveText, C.cardBg));
          root.appendChild(divider());
        }

        // ── [19] IMPLEMENTATION NOTES ──
        var implText = "${implNotesStr}";
        if (implText) {
          var implCard = figma.createFrame();
          implCard.layoutMode = "VERTICAL"; implCard.primaryAxisSizingMode = "AUTO"; implCard.counterAxisSizingMode = "AUTO";
          implCard.itemSpacing = 12;
          implCard.paddingTop = 24; implCard.paddingBottom = 24; implCard.paddingLeft = 28; implCard.paddingRight = 28;
          implCard.fills = [{ type: "SOLID", color: C.codeBg }];
          implCard.cornerRadius = 8;
          implCard.appendChild(T("Implementation Notes", fontSemiBold, 18, C.white));
          implCard.appendChild(T(implText, fontRegular, 14, { r: 0.75, g: 0.75, b: 0.78 }, W - 220));
          root.appendChild(implCard);
          root.appendChild(divider());
        }

        // ── [20] QA CHECKLIST ──
        var qaItems = ${qaChecklistJson};
        if (qaItems.length > 0) {
          var qaSection = figma.createFrame();
          qaSection.layoutMode = "VERTICAL"; qaSection.primaryAxisSizingMode = "AUTO"; qaSection.counterAxisSizingMode = "AUTO";
          qaSection.itemSpacing = 16; qaSection.fills = [];
          qaSection.appendChild(sectionTitle("QA Checklist"));
          for (var qi = 0; qi < qaItems.length; qi++) {
            var checkRow = figma.createFrame();
            checkRow.layoutMode = "HORIZONTAL"; checkRow.primaryAxisSizingMode = "AUTO"; checkRow.counterAxisSizingMode = "AUTO";
            checkRow.itemSpacing = 10; checkRow.fills = [];
            checkRow.counterAxisAlignItems = "CENTER";
            // Checkbox square
            var cb = figma.createFrame();
            cb.resize(18, 18); cb.cornerRadius = 3;
            cb.fills = []; cb.strokes = [{ type: "SOLID", color: C.stroke }]; cb.strokeWeight = 2;
            checkRow.appendChild(cb);
            checkRow.appendChild(T(qaItems[qi], fontRegular, 14, C.textMuted, W - 200));
            qaSection.appendChild(checkRow);
          }
          root.appendChild(qaSection);
        }

        // ── [21] RELATED COMPONENTS TABLE ──
        var relatedData = ${relatedJson};
        if (relatedData.length > 0) {
          var relSection = figma.createFrame();
          relSection.layoutMode = "VERTICAL"; relSection.primaryAxisSizingMode = "AUTO"; relSection.counterAxisSizingMode = "AUTO";
          relSection.itemSpacing = 20; relSection.fills = [];
          relSection.appendChild(sectionTitle("Related Components"));
          var relRows = relatedData.map(function(r) { return [r.name, r.relationship, r.whenToPrefer]; });
          relSection.appendChild(makeTable([220, 400, 420], ["Component", "Relationship", "When to Prefer"], relRows, []));
          root.appendChild(relSection);
        }

        // ── Normalize all root children to FILL width ──
        if ('children' in root) {
          for (var rc of root.children) {
            if ('layoutSizingHorizontal' in rc) {
              rc.layoutSizingHorizontal = 'FILL';
            }
            if ('layoutAlign' in rc) {
              rc.layoutAlign = 'STRETCH';
            }
          }
        }

        // ── Auto-Layout Validator + Document Repair Pass ──
        ${(0, auto_layout_validator_js_1.generateValidatorScript)()}
        ${(0, auto_layout_validator_js_1.generateDocumentRepairScript)()}
        var _alv = validateAutoLayout(root);
        var _docRepair = repairDocumentLayout(root);

        figma.viewport.scrollAndZoomIntoView([root]);
        return "ok";
      })();
    `);
        if (!result3.success) {
            throw new Error(`figma_component_doc script 3 failed: ${result3.error}`);
        }
    }
    return pageId;
}
// ─── Main handler ───────────────────────────────────────────────────────────
async function componentDocHandler(args) {
    // 1. Resolve target node
    const nodeId = await (0, index_js_1.resolveTargetNodeId)({ nodeId: args.nodeId, outputFormat: args.outputFormat });
    // 2. Capture snapshot (reuse existing deep scanner)
    const snapshot = await (0, index_js_1.captureSnapshot)(nodeId);
    // 3. Extract deep data in parallel
    const [spacing, colorTokens, typography] = await Promise.all([
        captureSpacingStructure(nodeId),
        captureColorTokenMap(nodeId),
        captureTypographySpec(nodeId),
    ]);
    // 4. Build accessibility sections via APG doc if the component looks interactive
    let accessibilitySections = [];
    const isInteractive = /button|btn|input|field|toggle|switch|checkbox|radio|tab|link|menu|dialog|modal|combobox|select|slider|accordion/i.test(snapshot.name);
    if (isInteractive) {
        try {
            const apgResult = await (0, index_js_2.figmaApgDocHandler)({
                nodeId,
                outputFormat: "json",
                framework: args.framework,
            });
            if (apgResult.document?.sections) {
                accessibilitySections = apgResult.document.sections;
            }
        }
        catch {
            // APG doc is optional; fall back to empty
        }
    }
    // 5. Assemble the full design system spec (19 sections)
    const spec = {
        componentName: snapshot.name,
        nodeId: snapshot.id,
        nodeType: snapshot.type,
        overview: buildOverview(snapshot),
        purpose: buildPurpose(snapshot),
        anatomy: buildAnatomy(snapshot),
        variants: buildVariants(snapshot),
        states: inferStatesFromSnapshot(snapshot),
        statesDetailed: buildStatesDetailed(snapshot),
        sizes: buildSizes(snapshot),
        spacing,
        colorTokens,
        typography,
        usageGuidelines: buildUsageGuidelines(snapshot),
        hierarchy: buildHierarchyAndEmphasis(snapshot),
        structureAndSpacing: buildStructureAndSpacing(snapshot),
        behaviour: buildBehaviour(snapshot),
        interactionRules: buildInteractionRules(snapshot),
        contentGuidance: buildContentGuidance(snapshot),
        responsive: buildResponsive(snapshot),
        accessibility: accessibilitySections,
        accessibilityDeep: buildAccessibilityDeep(snapshot),
        implementationNotes: buildImplementationNotes(snapshot),
        qaChecklist: buildQaChecklist(snapshot),
        props: buildPropsTable(snapshot),
        relatedComponents: buildRelatedComponents(snapshot),
    };
    // 6. Apply content overrides from AI-enhanced phase 2
    if (args.contentOverrides) {
        const co = args.contentOverrides;
        if (co.overview)
            spec.overview.description = co.overview;
        if (co.purpose)
            spec.purpose = co.purpose;
        if (co.usage) {
            spec.overview.whenToUse = co.usage.whenToUse;
            spec.overview.whenNotToUse = co.usage.whenNotToUse;
        }
        if (co.anatomy)
            spec.anatomy = co.anatomy;
        if (co.properties)
            spec.props = co.properties;
        if (co.states)
            spec.states = co.states.map((s) => s.name);
        if (co.sizes)
            spec.sizes = co.sizes;
        if (co.dosAndDonts)
            spec.usageGuidelines = co.dosAndDonts;
        if (co.behaviour)
            spec.behaviour = co.behaviour;
        if (co.interactionRules)
            spec.interactionRules = co.interactionRules;
        if (co.contentGuidance)
            spec.contentGuidance = co.contentGuidance;
        if (co.responsive)
            spec.responsive = co.responsive;
        if (co.implementationNotes)
            spec.implementationNotes = co.implementationNotes;
        if (co.qaChecklist) {
            if (Array.isArray(co.qaChecklist) && co.qaChecklist.length > 0 && typeof co.qaChecklist[0] === "object") {
                spec.qaChecklist = co.qaChecklist
                    .map((q) => `[${q.area}] ${q.verify} → ${q.expected}`);
            }
            else {
                spec.qaChecklist = co.qaChecklist;
            }
        }
        if (co.hierarchy)
            spec.hierarchy = co.hierarchy;
        if (co.structureAndSpacing)
            spec.structureAndSpacing = co.structureAndSpacing;
        if (co.relatedComponents)
            spec.relatedComponents = co.relatedComponents;
        if (co.variants)
            spec.variantsDetailed = co.variants;
        if (co.supportedCompositions)
            spec.supportedCompositions = co.supportedCompositions;
        if (co.accessibility) {
            spec.accessibility = convertAccessibilityOverrides(co.accessibility);
        }
    }
    // 7. Generate report
    const report = formatSpecAsReport(spec);
    // 8. Create Figma documentation page if requested
    let figmaPageId;
    if (args.outputFormat === "figma-page" || args.outputFormat === "all") {
        const pageName = args.pageName || `${spec.componentName} Documentation`;
        figmaPageId = await createVisualDocPage(spec, nodeId, pageName);
    }
    // 9. Log to decision log
    const logEntry = await decision_log_js_1.decisionLog.log({
        tool: "figma_component_doc",
        nodeIds: figmaPageId ? [snapshot.id, figmaPageId] : [snapshot.id],
        rationale: `Generated comprehensive design system documentation for ${snapshot.name}. Sections: overview, anatomy (${spec.anatomy.length} parts), variants (${spec.variants.length}), states (${spec.states.length}), spacing (${spec.spacing.length} entries), color tokens (${spec.colorTokens.length}), typography (${spec.typography.length}), usage guidelines, accessibility, props (${spec.props.length}).`,
        tokens: spec.colorTokens.filter((c) => c.tokenName).map((c) => c.tokenName),
        reversible: true,
        metadata: {
            outputFormat: args.outputFormat,
            componentName: spec.componentName,
            variantCount: spec.variants.length,
            stateCount: spec.states.length,
            spacingEntries: spec.spacing.length,
            colorTokenEntries: spec.colorTokens.length,
            typographyEntries: spec.typography.length,
            propsCount: spec.props.length,
        },
    });
    return {
        spec,
        report: args.outputFormat === "json" || args.outputFormat === "figma-page" ? undefined : report,
        figmaPageId,
        logEntryId: logEntry.id,
        ...(args.outputFormat === "json" && !args.contentOverrides
            ? { hint: `CRITICAL: You are a Principal Design Systems Architect. Generate a PRODUCTION-GRADE component specification for the FULL COMPONENT FAMILY, not just the selected instance.

SCOPE RULE: Walk up from the selected node to the COMPONENT_SET level. Document ALL variants, sizes, states, and compositions in the family. The selected instance is only a seed reference.

ANATOMY vs STRUCTURE SEPARATION:
- Anatomy = what parts exist (letter markers A/B/C, required vs optional, callout diagrams). NO measurements.
- Structure & Spacing = how parts are measured (padding, gap, height, min-width, icon size). This is a SEPARATE section.

WRITING STYLE: Use the pattern: description → rule → rationale → implication. Be direct, precise, instructional. No generic filler like "ensure usability" or "follow best practices." Every rule must be specific and testable. Reference actual token names from the extracted data.

Generate content for ALL 21 sections in contentOverrides:

1. overview (string) — What it IS, what problem it solves, where it appears. 2-3 sentences, specific.
2. purpose (string) — The specific user need this component addresses.
3. usage — { whenToUse: string[], whenNotToUse: string[] } with specific alternatives and decision logic.
4. variants — Array<{ name, purpose, emphasis, whenToUse, whenNotToUse, misuse? }> for EVERY variant in the family. Include emphasis level, misuse risks.
5. hierarchy (string) — Which variant has highest emphasis, how many high-emphasis per area, action hierarchy rules.
6. supportedCompositions — Array<{ name, parts: string[], whenToUse, constraints? }> for text-only, icon+text, icon-only, loading, etc.
7. anatomy — Array<{ index, name, type, description }> using letter markers. Consistent marker meaning across compositions.
8. properties — Array<{ name, type, values: string[], defaultValue, description }> for the FULL family. Include dependency rules.
9. structureAndSpacing (string) — Padding, gap, height per size, min-width, icon size, truncation rules, corner radius. SEPARATE from anatomy.
10. sizes — Array<{ name, useCase, minTouchTarget, context }> with intended context, density suitability, when NOT to use.
11. states — Array<{ name, visualDescription, trigger, meaning }> for default, hover, focus-visible, active, disabled, loading, selected, error.
12. behaviour (string) — Click/tap, keyboard, loading lock, async feedback, disabled interaction, grouped behavior.
13. interactionRules (string) — Focus movement, selection logic, confirmation, open/close, repeated activation.
14. contentGuidance (string) — Label style, verbs, brevity, sentence case, truncation, icon-only naming, localization.
15. responsive (string) — Narrow containers, mobile stacking, full-width, icon retention, content priority.
16. accessibility — { semanticRole, ariaAttributes, keyboardInteraction: [{key, action}], focusManagement, screenReaderAnnouncements, readingOrder, touchTargets, colorContrast } — 8 subsections, all specific and testable.
17. implementationNotes (string) — Semantic HTML, ARIA, state modeling, token usage, dark mode, overflow, pitfalls.
18. qaChecklist — Array<{ area, verify, expected }> structured table: visual, keyboard, screen reader, contrast, responsive, edge cases.
19. dosAndDonts — { dos: string[], donts: string[] } — specific, testable, with WHY for each.
20. relatedComponents — Array<{ name, relationship, whenToPrefer }> for commonly confused components.

Then call figma_component_doc again with outputFormat: "figma-page" and the contentOverrides object.` }
            : {}),
    };
}
//# sourceMappingURL=index.js.map