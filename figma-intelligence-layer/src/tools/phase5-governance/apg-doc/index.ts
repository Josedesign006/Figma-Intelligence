import { decisionLog } from "../../../shared/decision-log.js";
import { getBridge } from "../../../shared/figma-bridge.js";
import {
  captureSnapshot,
  createDocumentationPages,
  formatDocumentReport,
  resolveTargetNodeId,
} from "../component-spec/index.js";
import type {
  GeneratedDocument,
  NodeSnapshot,
} from "../component-spec/types.js";

export interface FigmaApgDocArgs {
  nodeId?: string;
  patternHint?: string;
  framework?: "html" | "react" | "vue" | "angular";
  outputFormat: "json" | "report" | "figma-page" | "all";
  includeCodeExamples?: boolean;
  writeToDescription?: boolean;
  descriptionMode?: "replace" | "append";
  pageName?: string;
}

type ApgPatternId =
  | "button"
  | "menu-button"
  | "dialog-modal"
  | "tabs"
  | "accordion"
  | "combobox"
  | "listbox"
  | "checkbox"
  | "radio-group"
  | "switch"
  | "slider"
  | "toolbar"
  | "grid"
  | "treeview";

interface ApgPatternDefinition {
  id: ApgPatternId;
  title: string;
  aliases: string[];
  url: string;
  summary: string;
  nativeFirst: string[];
  accessibleName: string[];
  roles: string[];
  requiredStates: string[];
  optionalStates: string[];
  forbiddenPatterns: string[];
  keyboard: string[];
  focus: string[];
  implementationNotes: string[];
  testing: string[];
  exampleSnippets: Partial<Record<NonNullable<FigmaApgDocArgs["framework"]>, string>>;
}

export interface FigmaApgDocResult {
  pattern: {
    id: ApgPatternId;
    title: string;
    url: string;
    confidence: number;
    matchedBy: string[];
  };
  target: {
    nodeId: string;
    name: string;
    type: string;
  };
  report?: string;
  figmaPageId?: string;
  descriptionUpdated?: boolean;
  warnings?: string[];
  document: GeneratedDocument;
  implementationSnippet?: string;
  logEntryId: string;
}

const GENERAL_REFERENCES = [
  "APG names and descriptions: https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/",
  "ARIA in HTML: https://www.w3.org/TR/aria-in-html/",
  "Using ARIA: https://www.w3.org/TR/using-aria/",
];

const APG_PATTERNS: ApgPatternDefinition[] = [
  {
    id: "button",
    title: "Button",
    aliases: ["button", "cta", "action", "icon button"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/button/",
    summary: "Button triggers an action immediately and should use the native button element whenever possible.",
    nativeFirst: [
      "Use a native <button> element for actions instead of a generic container with role=button.",
      "Use a native <a> only when the control navigates to a new location rather than triggering an in-place action.",
    ],
    accessibleName: [
      "Prefer visible button text as the accessible name.",
      "For icon-only buttons, provide an accessible name with aria-label or aria-labelledby.",
      "Keep the accessible name stable across loading and pressed states unless the action meaning changes.",
    ],
    roles: ["button"],
    requiredStates: ["Disabled state should map to the native disabled attribute when applicable."],
    optionalStates: ["aria-pressed for toggle buttons only."],
    forbiddenPatterns: [
      "Do not use role=button on a div when a native button is available.",
      "Do not add aria-pressed to a command button that is not toggleable.",
    ],
    keyboard: ["Tab moves focus to the button.", "Space and Enter activate the button."],
    focus: [
      "Focus stays on the button after activation unless the action opens a new context such as a dialog.",
      "Document the visible focus ring and make sure it survives all themes and densities.",
    ],
    implementationNotes: [
      "Support disabled, loading, and pressed states without changing semantics unexpectedly.",
      "Decorative icons should be hidden from assistive technologies when the visible label already communicates meaning.",
    ],
    testing: [
      "Verify activation with Enter and Space.",
      "Check that icon-only variants expose a meaningful accessible name.",
      "Confirm disabled buttons are announced correctly and cannot be activated.",
    ],
    exampleSnippets: {
      html: `<button type="button" aria-label="Save changes">\n  <svg aria-hidden="true" focusable="false"></svg>\n</button>`,
      react: `<button type="button" aria-label="Save changes">\n  <SaveIcon aria-hidden="true" focusable="false" />\n</button>`,
    },
  },
  {
    id: "menu-button",
    title: "Menu Button",
    aliases: ["menu button", "overflow menu", "kebab", "more", "actions menu"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/",
    summary: "Menu button opens a menu of commands and needs explicit expanded state and menu ownership wiring.",
    nativeFirst: [
      "Use a native <button> as the trigger and layer ARIA on top for the popup relationship.",
      "If the popup is simple site navigation, consider a disclosure pattern before reaching for menu semantics.",
    ],
    accessibleName: [
      "The trigger needs a clear action-oriented name such as More actions or Column options.",
      "Reference visible text with aria-labelledby when available instead of duplicating with aria-label.",
    ],
    roles: ["button trigger", "menu", "menuitem"],
    requiredStates: ["aria-haspopup=menu", "aria-expanded on the trigger", "aria-controls when you reference the popup element"],
    optionalStates: ["aria-disabled on menuitem when an item is unavailable."],
    forbiddenPatterns: [
      "Do not use menu semantics for a list of page links that behaves like ordinary navigation.",
      "Do not leave focus behind on the trigger once the menu is open.",
    ],
    keyboard: [
      "Enter or Space opens the menu and moves focus into the first menu item.",
      "Arrow Down typically opens the menu and places focus on the first item.",
      "Escape closes the menu and returns focus to the trigger.",
    ],
    focus: [
      "When the menu opens, move focus into the menu.",
      "When it closes, restore focus to the trigger unless another user action moved it elsewhere.",
    ],
    implementationNotes: [
      "Keep the trigger label stable while expanded state changes are conveyed through aria-expanded.",
      "Use roving tabindex or managed focus for menu items; avoid leaving every item in the tab order.",
    ],
    testing: [
      "Verify focus return on Escape and item selection.",
      "Check arrow-key navigation across all menu items.",
      "Confirm screen readers announce the trigger as a menu button with expanded/collapsed state.",
    ],
    exampleSnippets: {
      html: `<button aria-haspopup="menu" aria-expanded="false" aria-controls="actions-menu">\n  More actions\n</button>\n<ul id="actions-menu" role="menu" hidden>\n  <li role="menuitem" tabindex="-1">Rename</li>\n</ul>`,
      react: `<button aria-haspopup="menu" aria-expanded={open} aria-controls="actions-menu">\n  More actions\n</button>`,
    },
  },
  {
    id: "dialog-modal",
    title: "Dialog (Modal)",
    aliases: ["dialog", "modal", "sheet", "drawer", "popover dialog"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/",
    summary: "Modal dialog interrupts the current workflow and must manage initial focus, containment, and focus return.",
    nativeFirst: [
      "Prefer a native dialog implementation when your platform support and framework abstractions are mature enough.",
      "Use ARIA dialog semantics only when you also implement the required focus management behavior.",
    ],
    accessibleName: [
      "Dialogs need an accessible name, usually from the visible title via aria-labelledby.",
      "Use aria-describedby for supporting context when the dialog body provides essential orientation or warning text.",
    ],
    roles: ["dialog"],
    requiredStates: ["aria-modal=true", "Accessible name via aria-labelledby or aria-label"],
    optionalStates: ["aria-describedby when there is critical supporting text to announce."],
    forbiddenPatterns: [
      "Do not leave keyboard focus outside the modal while it is open.",
      "Do not mark a dialog modal if background content remains interactive.",
    ],
    keyboard: [
      "Tab and Shift+Tab cycle within the dialog.",
      "Escape closes the dialog when the workflow allows cancellation.",
    ],
    focus: [
      "Move focus to the most appropriate element when the dialog opens.",
      "Return focus to the invoking control when the dialog closes unless the workflow dictates a better destination.",
    ],
    implementationNotes: [
      "Choose the initial focus target intentionally: title, first field, or least destructive action depending on the task.",
      "Alert dialogs often need a stronger announcement and tighter action choices than standard dialogs.",
    ],
    testing: [
      "Verify background content is inert to keyboard and pointer interaction while the dialog is open.",
      "Check that focus never escapes the modal until it closes.",
      "Confirm the dialog title and description are announced once on open.",
    ],
    exampleSnippets: {
      html: `<div role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-body">\n  <h2 id="dialog-title">Delete file</h2>\n  <p id="dialog-body">This action cannot be undone.</p>\n</div>`,
      react: `<div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}>\n  ...\n</div>`,
    },
  },
  {
    id: "tabs",
    title: "Tabs",
    aliases: ["tabs", "tab", "segmented control", "tablist"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/tabs/",
    summary: "Tabs organize sibling panels and require tab, tablist, and tabpanel relationships with keyboard navigation.",
    nativeFirst: [
      "If the UI is effectively page navigation, prefer links and headings over tab semantics.",
      "Use button elements for tabs when you need in-place panel switching.",
    ],
    accessibleName: [
      "Each tab needs a concise visible label that also serves as the accessible name.",
      "The tablist itself may need an accessible name when multiple tablists exist on the same view.",
    ],
    roles: ["tablist", "tab", "tabpanel"],
    requiredStates: ["aria-selected on the active tab", "aria-controls linking each tab to its panel"],
    optionalStates: ["aria-orientation when the tablist is vertical."],
    forbiddenPatterns: [
      "Do not place every tab panel in the tab order when hidden.",
      "Do not use tabs when panels are not siblings in the same context.",
    ],
    keyboard: [
      "Tab enters or exits the tablist depending on the current focus model.",
      "Arrow keys move focus between tabs.",
      "Enter or Space activates a tab in manual activation models.",
      "Home and End optionally jump to the first and last tabs.",
    ],
    focus: [
      "Use roving tabindex so only one tab is tabbable at a time.",
      "Keep focus on the active tab unless activation explicitly moves focus into the panel.",
    ],
    implementationNotes: [
      "Document whether the component uses automatic or manual tab activation.",
      "Ensure hidden panels are not reachable by screen reader cursor navigation in ways that confuse context.",
    ],
    testing: [
      "Verify arrow-key navigation wraps or clamps consistently with the documented behavior.",
      "Check that the active tab exposes aria-selected=true and its panel is correctly linked.",
      "Confirm hidden panels are not announced as active content.",
    ],
    exampleSnippets: {
      html: `<div role="tablist" aria-label="Billing views">\n  <button role="tab" aria-selected="true" aria-controls="panel-overview" id="tab-overview">Overview</button>\n</div>\n<section id="panel-overview" role="tabpanel" aria-labelledby="tab-overview"></section>`,
      react: `<div role="tablist" aria-label="Billing views">{tabs.map(...)}</div>`,
    },
  },
  {
    id: "accordion",
    title: "Accordion",
    aliases: ["accordion", "disclosure", "expand", "collapse"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/accordion/",
    summary: "Accordion reveals and hides related sections with header buttons that control associated panels.",
    nativeFirst: [
      "Use a real button for each accordion header trigger.",
      "Consider native details/summary when the simpler browser behavior fits the product and design constraints.",
    ],
    accessibleName: [
      "The header button should use its visible heading text as the accessible name.",
      "Avoid repeating the expanded or collapsed state in the accessible name; that belongs in aria-expanded.",
    ],
    roles: ["button", "region when appropriate"],
    requiredStates: ["aria-expanded on each trigger", "aria-controls linking trigger to panel"],
    optionalStates: ["role=region on panels when doing so improves structure and does not create landmark overload."],
    forbiddenPatterns: [
      "Do not use non-focusable text as the disclosure trigger.",
      "Do not duplicate state words like expanded in the accessible name.",
    ],
    keyboard: [
      "Tab moves between accordion headers and any focusable content inside expanded panels.",
      "Enter and Space toggle the current header.",
      "Optional arrow-key navigation may move between headers.",
    ],
    focus: [
      "Activation typically leaves focus on the header button.",
      "If only one panel may stay open, document what happens to focus when another panel closes.",
    ],
    implementationNotes: [
      "Decide whether multiple sections may be open at once and document that behavior clearly.",
      "If panel content starts with a form field or destructive action, consider whether focus should remain on the header or move intentionally.",
    ],
    testing: [
      "Check that aria-expanded changes on every toggle.",
      "Verify each header is keyboard-operable and exposes a clear accessible name.",
      "Confirm collapsed content is not reachable unexpectedly.",
    ],
    exampleSnippets: {
      html: `<h3>\n  <button aria-expanded="false" aria-controls="faq-panel-1" id="faq-trigger-1">Shipping details</button>\n</h3>\n<div id="faq-panel-1" aria-labelledby="faq-trigger-1" hidden></div>`,
    },
  },
  {
    id: "combobox",
    title: "Combobox",
    aliases: ["combobox", "autocomplete", "typeahead", "search select", "picker"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/combobox/",
    summary: "Combobox combines text input or selection with a popup and needs explicit relationships between the field and popup.",
    nativeFirst: [
      "Prefer native select for simple one-of-many selection when freeform input is not needed.",
      "Use a real input element when users type to filter or search options.",
    ],
    accessibleName: [
      "Use a visible label associated with the input whenever possible.",
      "Use aria-describedby for helper or validation text instead of packing everything into the accessible name.",
    ],
    roles: ["combobox", "listbox or grid popup", "option"],
    requiredStates: ["aria-expanded", "aria-controls", "Accessible name via label, aria-labelledby, or aria-label"],
    optionalStates: ["aria-activedescendant when focus remains on the input while highlighting popup options.", "aria-autocomplete when the behavior matches inline, list, or both."],
    forbiddenPatterns: [
      "Do not replace a simple select with a complex combobox unless the product needs it.",
      "Do not move DOM focus into the popup if your implementation model relies on aria-activedescendant.",
    ],
    keyboard: [
      "Typing updates the input and may filter options.",
      "Arrow Down opens the popup or moves through available options.",
      "Enter commits the active option when appropriate.",
      "Escape closes the popup and may clear the current pending selection depending on the design.",
    ],
    focus: [
      "Choose one focus model and document it: DOM focus on the input with aria-activedescendant, or managed focus in the popup.",
      "Ensure focus return and screen reader announcements stay consistent when the popup opens and closes.",
    ],
    implementationNotes: [
      "Combobox is one of the most failure-prone ARIA patterns; use it only when native controls do not meet the requirement.",
      "Validation, loading, no-results, and async states need explicit announcements and documentation.",
    ],
    testing: [
      "Verify label association, expanded state, and popup ownership.",
      "Check arrow-key navigation, selection, and screen reader announcements in both collapsed and expanded states.",
      "Test loading, empty, and error states with assistive technologies.",
    ],
    exampleSnippets: {
      html: `<label for="city">City</label>\n<input id="city" role="combobox" aria-expanded="false" aria-controls="city-listbox" aria-autocomplete="list" />\n<ul id="city-listbox" role="listbox" hidden></ul>`,
      react: `<input role="combobox" aria-expanded={open} aria-controls={listboxId} aria-activedescendant={activeId} />`,
    },
  },
  {
    id: "listbox",
    title: "Listbox",
    aliases: ["listbox", "select", "single select", "multi select", "picker list"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/listbox/",
    summary: "Listbox presents a set of selectable options and is best reserved for custom selection UIs that cannot use native select.",
    nativeFirst: [
      "Use native select whenever browser behavior is acceptable.",
      "Only use listbox semantics for truly custom selection experiences.",
    ],
    accessibleName: [
      "The listbox itself needs an accessible name from a visible label, aria-labelledby, or aria-label.",
      "Option text should be concise and stable so the selected item is announced clearly.",
    ],
    roles: ["listbox", "option"],
    requiredStates: ["aria-selected on selected options when the pattern requires it."],
    optionalStates: ["aria-multiselectable=true for multi-select listboxes."],
    forbiddenPatterns: [
      "Do not put unrelated interactive elements inside options.",
      "Do not create a custom listbox when a simple select meets the requirement.",
    ],
    keyboard: [
      "Arrow keys move focus between options.",
      "Space may toggle selection in multi-select models.",
      "Typeahead is recommended for longer option lists.",
    ],
    focus: [
      "Use a documented focus model: roving tabindex or aria-activedescendant.",
      "The selected option should remain discoverable and consistently announced.",
    ],
    implementationNotes: [
      "Document single-select versus multi-select behavior explicitly.",
      "Large or virtualized lists need extra care so assistive technologies still perceive the active option correctly.",
    ],
    testing: [
      "Verify label announcement, option navigation, and selected state announcements.",
      "Check multi-select shortcuts if supported.",
      "Confirm virtualized options remain understandable to assistive technologies.",
    ],
    exampleSnippets: {
      html: `<label id="assignee-label">Assignee</label>\n<ul role="listbox" aria-labelledby="assignee-label">\n  <li role="option" aria-selected="true">Alex</li>\n</ul>`,
    },
  },
  {
    id: "checkbox",
    title: "Checkbox",
    aliases: ["checkbox", "check box", "tick"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/",
    summary: "Checkbox represents an independent on/off choice and should generally stay native.",
    nativeFirst: [
      "Use a native input type=checkbox whenever possible.",
      "If you create a custom visual wrapper, keep the real checkbox in the accessibility tree.",
    ],
    accessibleName: [
      "Associate the checkbox with visible label text.",
      "Keep the label focused on the option meaning rather than the state.",
    ],
    roles: ["checkbox"],
    requiredStates: ["aria-checked when not using a native checkbox element."],
    optionalStates: ["Mixed state when the control genuinely represents a partial selection."],
    forbiddenPatterns: [
      "Do not use checkbox for mutually exclusive options.",
      "Do not hide the label and rely on title text alone.",
    ],
    keyboard: ["Tab moves focus to the checkbox.", "Space toggles checked state."],
    focus: [
      "Focus remains on the checkbox after toggle.",
      "Document the visual focus indicator separately from the checked state styling.",
    ],
    implementationNotes: [
      "If the checkbox drives nested selections, document when a mixed state appears.",
      "Errors and required state belong to the form-field contract, not the checkbox label.",
    ],
    testing: [
      "Verify checked, unchecked, and mixed announcements if applicable.",
      "Check Space activation and label click behavior.",
      "Confirm helper and error text are programmatically associated when present.",
    ],
    exampleSnippets: {
      html: `<label>\n  <input type="checkbox" name="updates" />\n  Email me product updates\n</label>`,
    },
  },
  {
    id: "radio-group",
    title: "Radio Group",
    aliases: ["radio", "radio group", "option set", "single choice"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/radio/",
    summary: "Radio group represents a single required or optional choice from a fixed set.",
    nativeFirst: [
      "Use native radio inputs grouped by name whenever possible.",
      "Wrap the set in fieldset/legend when that gives you the right semantics.",
    ],
    accessibleName: [
      "The group needs a clear label, often from legend or aria-labelledby.",
      "Each radio option should expose the visible option label as its accessible name.",
    ],
    roles: ["radiogroup", "radio"],
    requiredStates: ["aria-checked on radios when not using native radio inputs."],
    optionalStates: ["aria-describedby on the group for helper or validation text."],
    forbiddenPatterns: [
      "Do not use checkboxes when only one option may be selected.",
      "Do not leave every radio in the tab order when using custom widgets.",
    ],
    keyboard: [
      "Tab enters and exits the group.",
      "Arrow keys move selection within the group in custom radio implementations.",
      "Space checks the focused radio when it is not already selected.",
    ],
    focus: [
      "Custom radios commonly use roving tabindex so only one option is tabbable.",
      "Focus should land on the selected radio when entering a preselected group.",
    ],
    implementationNotes: [
      "Document default selection behavior and what happens when no option is selected initially.",
      "Keep helper and error messaging associated with the group, not individual decorative wrappers.",
    ],
    testing: [
      "Verify group label announcement and arrow-key movement.",
      "Check that only one radio can be selected at a time.",
      "Confirm validation messaging is announced when present.",
    ],
    exampleSnippets: {
      html: `<fieldset>\n  <legend>Notification frequency</legend>\n  <label><input type="radio" name="frequency" value="daily" /> Daily</label>\n</fieldset>`,
    },
  },
  {
    id: "switch",
    title: "Switch",
    aliases: ["switch", "toggle", "toggle switch"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/switch/",
    summary: "Switch communicates an on/off setting and should read like a persistent state, not a one-time action.",
    nativeFirst: [
      "Use a native checkbox when the UI does not require explicit switch semantics.",
      "Reserve role=switch for controls that users naturally understand as on/off settings.",
    ],
    accessibleName: [
      "Label the setting being controlled, not the current state.",
      "Let checked state communicate on/off rather than adding those words into the accessible name.",
    ],
    roles: ["switch"],
    requiredStates: ["aria-checked when not using a native checkbox under the hood."],
    optionalStates: ["aria-describedby for supporting helper or caution text."],
    forbiddenPatterns: [
      "Do not use a switch for immediate actions like Save or Delete.",
      "Do not duplicate on/off inside the accessible name if state already exposes it.",
    ],
    keyboard: ["Tab moves focus to the switch.", "Space toggles the switch."],
    focus: [
      "Focus remains on the switch after toggling.",
      "Document the distinction between focus styling and checked styling.",
    ],
    implementationNotes: [
      "Switches should feel like persistent settings; if the control triggers navigation or submit behavior, use a different pattern.",
      "Helper or warning text may be important when toggling has wider consequences.",
    ],
    testing: [
      "Verify on/off announcements with major screen readers.",
      "Check Space activation and focus visibility.",
      "Confirm helper or caution text is associated when relevant.",
    ],
    exampleSnippets: {
      html: `<button type="button" role="switch" aria-checked="false" aria-labelledby="wifi-label"></button>\n<span id="wifi-label">Wi-Fi</span>`,
    },
  },
  {
    id: "slider",
    title: "Slider",
    aliases: ["slider", "range", "seekbar", "progress control", "scrubber"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/slider/",
    summary: "Slider lets users set a value within a range and needs an accessible name plus accurate current, min, and max values.",
    nativeFirst: [
      "Use native input type=range whenever the browser control is acceptable.",
      "Reach for custom slider semantics only when the product needs visuals or interaction beyond the native control.",
    ],
    accessibleName: [
      "The slider needs a visible label or equivalent accessible name that describes the controlled value.",
      "Use aria-valuetext when the spoken value should be more descriptive than the raw numeric value.",
    ],
    roles: ["slider"],
    requiredStates: ["aria-valuemin", "aria-valuemax", "aria-valuenow when not using a native range input"],
    optionalStates: ["aria-orientation when vertical", "aria-valuetext for formatted output such as volume or percentage labels."],
    forbiddenPatterns: [
      "Do not use slider semantics for a one-time action button.",
      "Do not expose stale aria-valuenow or valuetext while the visual thumb moves.",
    ],
    keyboard: [
      "Arrow keys adjust the current value.",
      "Home and End typically move to the minimum and maximum values.",
      "Page Up and Page Down may optionally adjust by a larger step.",
    ],
    focus: [
      "Focus stays on the thumb while the value changes.",
      "Make sure the focus indicator remains visible at every thumb position.",
    ],
    implementationNotes: [
      "Document the step size, min/max range, and whether the value updates continuously or only on commit.",
      "For dual-thumb range sliders, document separate names and collision behavior for each thumb.",
    ],
    testing: [
      "Verify keyboard adjustment across the full range.",
      "Check value announcements with screen readers, including formatted aria-valuetext when used.",
      "Confirm touch and pointer interaction do not break keyboard semantics.",
    ],
    exampleSnippets: {
      html: `<label for="volume">Volume</label>\n<input id="volume" type="range" min="0" max="100" value="40" />`,
    },
  },
  {
    id: "toolbar",
    title: "Toolbar",
    aliases: ["toolbar", "format bar", "editor controls", "action bar"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/",
    summary: "Toolbar groups related controls and typically uses one tab stop plus arrow-key movement between internal controls.",
    nativeFirst: [
      "Use ordinary grouped buttons when a toolbar-specific keyboard model is unnecessary.",
      "Use toolbar semantics only when the grouped controls are meant to behave as one composite widget.",
    ],
    accessibleName: [
      "The toolbar needs an accessible name when more than one toolbar is present or the purpose is not obvious from surrounding context.",
      "Individual controls inside the toolbar still need their own labels.",
    ],
    roles: ["toolbar"],
    requiredStates: ["A labeled container and a documented keyboard model for internal navigation."],
    optionalStates: ["aria-orientation when vertical."],
    forbiddenPatterns: [
      "Do not turn unrelated page actions into a toolbar just for styling.",
      "Do not leave every internal control in the tab order if you document a composite arrow-key model.",
    ],
    keyboard: [
      "Tab enters and exits the toolbar.",
      "Arrow keys move focus between supported controls inside the toolbar.",
      "Activation keys remain those of the individual control types.",
    ],
    focus: [
      "On entry, focus should land on the last-focused or first enabled control according to the documented behavior.",
      "Disabled controls should not trap focus unexpectedly.",
    ],
    implementationNotes: [
      "Mixed control types inside a toolbar still need their own APG behavior, such as button, menu button, or radio group.",
      "Document whether focus memory is preserved when users leave and return to the toolbar.",
    ],
    testing: [
      "Verify one clean tab stop for the toolbar if that is the documented behavior.",
      "Check arrow-key navigation and wrapping rules.",
      "Confirm embedded composite controls do not create conflicting keyboard models.",
    ],
    exampleSnippets: {
      html: `<div role="toolbar" aria-label="Text formatting">\n  <button type="button" aria-pressed="false">Bold</button>\n</div>`,
    },
  },
  {
    id: "grid",
    title: "Grid",
    aliases: ["grid", "data grid", "table grid", "spreadsheet", "calendar grid"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/grid/",
    summary: "Grid is a composite widget for two-dimensional navigation and should only be used when interactive cell navigation is required.",
    nativeFirst: [
      "Prefer native table markup for read-only tabular data.",
      "Use grid semantics only when users need active cell-by-cell keyboard navigation or interactive descendants inside cells.",
    ],
    accessibleName: [
      "The grid needs an accessible name that describes the dataset or task.",
      "Rows, columns, and interactive cells should expose stable labels so position and meaning are clear.",
    ],
    roles: ["grid", "row", "gridcell", "columnheader", "rowheader"],
    requiredStates: ["A documented cell focus model and correct row/cell roles."],
    optionalStates: ["aria-rowcount, aria-colcount, aria-rowindex, and aria-colindex when virtualization or partial rendering requires them."],
    forbiddenPatterns: [
      "Do not use grid just to style a collection into columns.",
      "Do not leave both the grid container and every interactive cell fully tabbable without a clear focus model.",
    ],
    keyboard: [
      "Arrow keys move focus by cell.",
      "Home, End, Page Up, and Page Down often have grid-specific navigation behavior.",
      "Enter or F2 may switch between navigation mode and cell interaction mode depending on the design.",
    ],
    focus: [
      "Document whether focus sits on the grid container with aria-activedescendant or moves into cells directly.",
      "Virtualized grids need stable focus and announcement behavior while rows mount and unmount.",
    ],
    implementationNotes: [
      "Grid is advanced and easy to get wrong; use it only when a table, list, or listbox cannot meet the requirement.",
      "If cells contain buttons, checkboxes, or links, document when arrow keys navigate versus when inner controls take over.",
    ],
    testing: [
      "Verify row and column announcements, active cell movement, and virtualization announcements.",
      "Check keyboard entry and exit from interactive cells.",
      "Confirm sorting, selection, and edit states are announced where applicable.",
    ],
    exampleSnippets: {
      html: `<div role="grid" aria-label="Orders">\n  <div role="row">\n    <div role="gridcell" tabindex="0">#1024</div>\n  </div>\n</div>`,
    },
  },
  {
    id: "treeview",
    title: "Treeview",
    aliases: ["tree", "treeview", "file tree", "navigation tree", "nested list"],
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/treeview/",
    summary: "Treeview presents a hierarchical collection with expand/collapse behavior and structured keyboard navigation.",
    nativeFirst: [
      "Use nested lists and disclosure buttons when users do not need a full treeview interaction model.",
      "Reserve treeview for true hierarchical navigation that benefits from arrow-key traversal and selection state.",
    ],
    accessibleName: [
      "The tree needs a clear label describing the hierarchy being browsed.",
      "Each treeitem should expose a concise visible label; expanded state should come from aria-expanded, not label text.",
    ],
    roles: ["tree", "treeitem", "group"],
    requiredStates: ["aria-expanded on parent treeitems that can open or close children."],
    optionalStates: ["aria-selected when the tree includes selection semantics.", "aria-level, aria-posinset, and aria-setsize when DOM structure does not express hierarchy clearly."],
    forbiddenPatterns: [
      "Do not use treeview for a flat list of links.",
      "Do not duplicate expanded/collapsed wording in the accessible name of every item.",
    ],
    keyboard: [
      "Arrow Right expands a closed parent or moves to its first child.",
      "Arrow Left collapses an open parent or moves to its parent.",
      "Arrow Up and Arrow Down move between visible treeitems.",
      "Home and End move to the first and last visible items.",
    ],
    focus: [
      "Only one treeitem should usually be tabbable at a time.",
      "Selection and focus may be separate; document whether moving focus also changes selection.",
    ],
    implementationNotes: [
      "Document whether the tree is navigation-only, selection-based, or both.",
      "Async loading and lazy expansion need announcements so new children are understandable.",
    ],
    testing: [
      "Verify parent/child navigation and expansion behavior with keyboard only.",
      "Check that expanded state and item position are announced correctly.",
      "Confirm selection behavior matches the documented contract.",
    ],
    exampleSnippets: {
      html: `<ul role="tree" aria-label="Project files">\n  <li role="treeitem" aria-expanded="false" tabindex="0">src</li>\n</ul>`,
    },
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function collectSnapshotTerms(snapshot: NodeSnapshot): string[] {
  return [
    snapshot.name,
    snapshot.description,
    snapshot.type,
    ...snapshot.childNames,
    ...snapshot.textLayers.map((layer) => layer.name),
    ...snapshot.textLayers.map((layer) => layer.characters),
    ...snapshot.componentProperties.map((prop) => prop.name),
    ...snapshot.componentProperties.flatMap((prop) => prop.options),
    ...Object.keys(snapshot.variantProperties || {}),
    ...Object.values(snapshot.variantProperties || {}),
    ...Object.keys(snapshot.variantGroupProperties || {}),
    ...Object.values(snapshot.variantGroupProperties || {}).flat(),
  ]
    .map(normalize)
    .filter(Boolean);
}

export function guessPattern(snapshot: NodeSnapshot, hint?: string): { definition: ApgPatternDefinition; confidence: number; matchedBy: string[] } {
  const terms = collectSnapshotTerms(snapshot);
  const haystack = new Set(terms);
  const hintNormalized = hint ? normalize(hint) : "";
  let best = APG_PATTERNS[0];
  let bestScore = -1;
  let bestMatches: string[] = [];

  for (const pattern of APG_PATTERNS) {
    const matches = new Set<string>();
    let score = 0;

    for (const alias of pattern.aliases) {
      const normalizedAlias = normalize(alias);
      if (hintNormalized && (hintNormalized.includes(normalizedAlias) || normalizedAlias.includes(hintNormalized))) {
        score += 5;
        matches.add(`hint:${alias}`);
      }

      for (const term of haystack) {
        if (term.includes(normalizedAlias) || normalizedAlias.includes(term)) {
          score += normalizedAlias === term ? 4 : 2;
          matches.add(`node:${alias}`);
        }
      }
    }

    if (pattern.id === "dialog-modal" && snapshot.height >= 240 && /modal|dialog|sheet|drawer/.test(normalize(snapshot.name))) {
      score += 3;
      matches.add("heuristic:overlay-shell");
    }
    if (pattern.id === "tabs" && Object.keys(snapshot.variantGroupProperties).some((key) => /tab|selected|active/.test(normalize(key)))) {
      score += 2;
      matches.add("heuristic:tab-variants");
    }
    if (pattern.id === "button" && /button|cta|action/.test(normalize(snapshot.name))) {
      score += 2;
      matches.add("heuristic:button-name");
    }
    if (pattern.id === "switch" && /\b(on|off)\b/.test(terms.join(" "))) {
      score += 1;
      matches.add("heuristic:on-off-copy");
    }

    if (score > bestScore) {
      best = pattern;
      bestScore = score;
      bestMatches = Array.from(matches);
    }
  }

  const confidence = Math.max(0.34, Math.min(0.96, 0.34 + bestScore * 0.08));
  return { definition: best, confidence, matchedBy: bestMatches.length > 0 ? bestMatches : ["fallback:best-name-match"] };
}

function summarizeTarget(snapshot: NodeSnapshot): string {
  const size = `${Math.round(snapshot.width)} x ${Math.round(snapshot.height)} px`;
  const variants = Object.keys(snapshot.variantGroupProperties).length > 0
    ? `Variants: ${Object.keys(snapshot.variantGroupProperties).join(", ")}.`
    : "No explicit variant groups detected.";

  return `${snapshot.name} is a ${snapshot.type.toLowerCase()} target sized ${size}. ${variants}`;
}

function buildImplementationSnippet(
  pattern: ApgPatternDefinition,
  framework: NonNullable<FigmaApgDocArgs["framework"]>,
  includeCodeExamples: boolean
): string | undefined {
  if (!includeCodeExamples) return undefined;
  return pattern.exampleSnippets[framework] || pattern.exampleSnippets.html;
}

function inferVariantA11yRules(snapshot: NodeSnapshot, pattern: ApgPatternDefinition): string[] {
  const rules: string[] = [];
  const groups = Object.entries(snapshot.variantGroupProperties);
  const allEntries = [
    ...groups.map(([name, values]) => ({ name, values })),
    ...snapshot.componentProperties
      .filter((prop) => prop.options.length > 0)
      .map((prop) => ({ name: prop.name, values: prop.options })),
  ];

  for (const entry of allEntries) {
    const key = normalize(entry.name);
    const values = entry.values.map((value) => normalize(value));

    if (/state|status/.test(key)) {
      if (values.some((value) => /disabled/.test(value))) {
        rules.push("Disabled variants must remove or suppress activation while preserving a clear disabled semantic state.");
      }
      if (values.some((value) => /focus|focused/.test(value))) {
        rules.push("Focus variants are documentation artifacts only; the rendered component still needs a real visible focus indicator triggered by keyboard focus.");
      }
      if (values.some((value) => /error|invalid/.test(value))) {
        rules.push("Error variants should pair visual styling with programmatic invalid state, descriptive error text, and helper/error association.");
      }
      if (values.some((value) => /loading|progress/.test(value))) {
        rules.push("Loading variants should preserve an accessible name and announce busy/progress state when user feedback changes materially.");
      }
      if (values.some((value) => /selected|active|checked|on/.test(value))) {
        rules.push(`Selected or active variants should map to the ${pattern.optionalStates[0] || "documented state"} only when the APG pattern actually supports it.`);
      }
    }

    if (/size/.test(key)) {
      rules.push("Size variants must keep touch target, focus ring visibility, and label readability intact at every size.");
    }

    if (/icon/.test(key) || values.some((value) => /icon only|icon/.test(value))) {
      rules.push("Icon-only variants need an explicit accessible name because the visual label may be absent.");
    }

    if (/theme|tone|intent|kind|priority|appearance/.test(key)) {
      rules.push("Visual tone variants must not be the only channel for meaning; preserve semantics and contrast across every appearance.");
    }
  }

  return Array.from(new Set(rules)).slice(0, 8);
}

async function writeDescriptionToNode(nodeId: string, document: GeneratedDocument, mode: NonNullable<FigmaApgDocArgs["descriptionMode"]>): Promise<void> {
  const bridge = await getBridge();
  const report = formatDocumentReport(document);
  const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found");
      const existing = "description" in node && typeof node.description === "string" ? node.description : "";
      const nextDescription = ${JSON.stringify(mode)} === "append" && existing.trim().length > 0
        ? existing + "\\n\\n---\\n\\n" + ${JSON.stringify(report)}
        : ${JSON.stringify(report)};
      if (!("description" in node)) {
        throw new Error("Target node does not support description updates.");
      }
      node.description = nextDescription;
      return { nodeId: node.id, descriptionLength: nextDescription.length };
    })();
  `);

  if (!result.success) {
    throw new Error(`figma_apg_doc: failed to update node description: ${result.error}`);
  }
}

export function shouldFallbackToGeneratedPage(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  return normalized.includes("failed to update node description")
    || normalized.includes("does not support description updates")
    || (normalized.includes("plugin") && normalized.includes("write"))
    || (normalized.includes("internal") && normalized.includes("write"));
}

function buildApgDocument(
  snapshot: NodeSnapshot,
  match: { definition: ApgPatternDefinition; confidence: number; matchedBy: string[] },
  snippet?: string
): GeneratedDocument {
  const pattern = match.definition;
  const variantSummary = Object.entries(snapshot.variantGroupProperties)
    .map(([key, values]) => `${key}: ${values.join(", ")}`)
    .slice(0, 5);
  const namingHints = snapshot.textLayers
    .map((layer) => layer.characters.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((text) => `Visible copy detected: "${text.length > 70 ? `${text.slice(0, 69)}...` : text}"`);
  const variantA11yRules = inferVariantA11yRules(snapshot, pattern);

  const sections: GeneratedDocument["sections"] = [
    {
      title: "APG pattern mapping",
      style: "bullets" as const,
      items: [
        `Matched pattern: ${pattern.title}`,
        `Source: ${pattern.url}`,
        `Confidence: ${Math.round(match.confidence * 100)}%`,
        `Matched by: ${match.matchedBy.join(", ")}`,
      ],
    },
    {
      title: "Target summary",
      style: "bullets" as const,
      items: [
        summarizeTarget(snapshot),
        snapshot.description ? `Figma description: ${snapshot.description}` : "Figma description is missing or too short; add usage context for stronger docs.",
        ...(variantSummary.length > 0 ? variantSummary : ["No explicit variant groups found in this node."]),
      ],
    },
    {
      title: "Native-first recommendation",
      style: "checklist" as const,
      items: pattern.nativeFirst,
    },
    {
      title: "Accessible name and descriptions",
      style: "bullets" as const,
      items: pattern.accessibleName.concat(
        namingHints.length > 0 ? namingHints : ["No visible text was detected. Icon-only or abstract variants need an explicit accessible naming rule."]
      ),
    },
    {
      title: "Roles, states, and properties",
      style: "bullets" as const,
      items: [
        `Roles: ${pattern.roles.join(", ")}`,
        `Required states/properties: ${pattern.requiredStates.join(" | ")}`,
        `Optional states/properties: ${pattern.optionalStates.join(" | ")}`,
      ],
    },
    {
      title: "Variant-specific accessibility rules",
      style: "bullets" as const,
      items: variantA11yRules.length > 0
        ? variantA11yRules
        : ["No stateful variant metadata was detected; document disabled, error, selected, loading, and icon-only behavior explicitly if the code component supports them."],
    },
    {
      title: "Keyboard and focus contract",
      style: "checklist" as const,
      items: pattern.keyboard.concat(pattern.focus),
    },
    {
      title: "Authoring rules and anti-patterns",
      style: "bullets" as const,
      items: pattern.implementationNotes.concat(pattern.forbiddenPatterns.map((item) => `Avoid: ${item}`)),
    },
    {
      title: "QA checklist",
      style: "checklist" as const,
      items: pattern.testing,
    },
    {
      title: "References",
      style: "bullets" as const,
      items: [pattern.url].concat(GENERAL_REFERENCES),
    },
  ];

  if (snippet) {
    sections.push({
      title: "Implementation starter",
      style: "paragraph" as const,
      items: [snippet],
    });
  }

  return {
    type: "accessibility",
    title: `${snapshot.name} APG Accessibility Spec`,
    summary: `${pattern.summary} This documentation is grounded in the WAI-ARIA APG pattern and tailored to the inspected Figma component.`,
    sections,
  };
}

export async function figmaApgDocHandler(args: FigmaApgDocArgs): Promise<FigmaApgDocResult> {
  const framework = args.framework || "html";
  const nodeId = await resolveTargetNodeId({ nodeId: args.nodeId });
  const snapshot = await captureSnapshot(nodeId);
  const match = guessPattern(snapshot, args.patternHint);
  const snippet = buildImplementationSnippet(match.definition, framework, args.includeCodeExamples ?? true);
  const document = buildApgDocument(snapshot, match, snippet);
  const report = formatDocumentReport(document);
  const warnings: string[] = [];

  if (match.confidence < 0.55) {
    warnings.push(`APG pattern match confidence is only ${Math.round(match.confidence * 100)}%. Review the mapped pattern before treating this document as canonical.`);
  }

  let figmaPageId: string | undefined;
  if (args.outputFormat === "figma-page" || args.outputFormat === "all") {
    figmaPageId = await createDocumentationPages([document], args.pageName || `APG Doc - ${snapshot.name}`);
  }
  let descriptionUpdated = false;
  if (args.writeToDescription) {
    try {
      await writeDescriptionToNode(snapshot.id, document, args.descriptionMode || "replace");
      descriptionUpdated = true;
    } catch (error) {
      const canFallbackToPage = args.outputFormat === "figma-page" || args.outputFormat === "all";
      if (!figmaPageId && canFallbackToPage) {
        figmaPageId = await createDocumentationPages([document], args.pageName || `APG Doc - ${snapshot.name}`);
      }

      if (figmaPageId && shouldFallbackToGeneratedPage(error)) {
        warnings.push("Skipped writing to the node description after a Figma plugin write failure; generated a standalone accessibility doc page instead.");
      } else {
        throw error;
      }
    }
  }

  const logEntry = await decisionLog.log({
    tool: "figma_apg_doc",
    nodeIds: figmaPageId ? [snapshot.id, figmaPageId] : [snapshot.id],
    rationale: `Generated APG-backed documentation for ${snapshot.name} using ${match.definition.title} guidance at ${Math.round(match.confidence * 100)}% confidence.`,
    reversible: true,
    metadata: {
      outputFormat: args.outputFormat,
      patternId: match.definition.id,
      confidence: match.confidence,
      framework,
      includeCodeExamples: args.includeCodeExamples ?? true,
      writeToDescription: args.writeToDescription ?? false,
      descriptionMode: args.descriptionMode || "replace",
    },
  });

  return {
    pattern: {
      id: match.definition.id,
      title: match.definition.title,
      url: match.definition.url,
      confidence: match.confidence,
      matchedBy: match.matchedBy,
    },
    target: {
      nodeId: snapshot.id,
      name: snapshot.name,
      type: snapshot.type,
    },
    report: args.outputFormat === "json" || args.outputFormat === "figma-page" ? undefined : report,
    figmaPageId,
    descriptionUpdated,
    warnings: warnings.length > 0 ? warnings : undefined,
    document,
    implementationSnippet: snippet,
    logEntryId: logEntry.id,
  };
}
