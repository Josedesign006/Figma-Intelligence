/**
 * search.ts — Gold-standard design knowledge for Search input components
 */
import type { ComponentKnowledge } from "../types.js";

export const searchKnowledge: ComponentKnowledge = {
  description:
    "Search input with clear and results | Filters content in real-time | Supports debounce, suggestions, and loading states",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Field displays search icon on the left and placeholder text in muted color",
      opacity: "1",
      cursorWeb: "text",
      usage: "Resting state — search field is interactive and ready for query input",
    },
    {
      state: "Focused",
      visualChange: "Border transitions to focus color; 2px focus ring appears; cursor blinks inside the field",
      opacity: "1",
      cursorWeb: "text",
      usage: "User clicks into the field or navigates via Tab key",
    },
    {
      state: "Searching",
      visualChange: "Search icon replaced by a loading spinner; field remains interactive for query refinement",
      opacity: "1",
      cursorWeb: "text",
      usage: "Query has been submitted and results are being fetched or filtered",
    },
    {
      state: "Results",
      visualChange: "Suggestion dropdown appears below the field showing matching results; clear button visible",
      opacity: "1",
      cursorWeb: "text",
      usage: "Search has returned matching results displayed in a dropdown or inline list",
    },
    {
      state: "NoResults",
      visualChange: "Dropdown shows an empty-state message; field retains query text with clear button visible",
      opacity: "1",
      cursorWeb: "text",
      usage: "Search query returned zero matching results",
    },
    {
      state: "Disabled",
      visualChange: "Background and border switch to disabled tokens; search icon is muted; no interaction possible",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "Search functionality is unavailable due to permissions or system state",
    },
  ],

  propertyDescriptions: {
    placeholder: "Hint text displayed when the field is empty; typically 'Search...' or a context-specific prompt like 'Search components'",
    value: "The current search query string; controlled or uncontrolled depending on framework usage",
    size: "Dimensional preset controlling height, padding, font-size, and icon-size (Small, Medium, Large)",
    onSearch: "Callback fired when the user submits a search query via Enter key or after debounce completes",
    debounceMs: "Delay in milliseconds before onSearch fires after the user stops typing; default is 300ms",
    clearable: "When true, a clear button (X icon) appears on the right side when the field has a value",
    loading: "When true, the search icon is replaced by a spinner to indicate an in-progress query",
    suggestions: "Array of suggestion items displayed in a dropdown below the field when results are available",
  },

  sizeSpecifications: [
    {
      size: "Small",
      height: "32px",
      paddingLR: "12px",
      fontSize: "12px",
      iconSize: "16px",
      borderRadius: "6px",
    },
    {
      size: "Medium",
      height: "40px",
      paddingLR: "16px",
      fontSize: "14px",
      iconSize: "20px",
      borderRadius: "8px",
    },
    {
      size: "Large",
      height: "48px",
      paddingLR: "20px",
      fontSize: "16px",
      iconSize: "24px",
      borderRadius: "10px",
    },
  ],

  designTokenBindings: [
    {
      property: "Background",
      tokenName: "$field-bg",
      role: "Default field background color",
      fallback: "#FFFFFF",
    },
    {
      property: "Border",
      tokenName: "$field-border",
      role: "Default field border color",
      fallback: "#D0D5DD",
    },
    {
      property: "Search Icon",
      tokenName: "$icon-secondary",
      role: "Magnifying glass icon color in default state",
      fallback: "#667085",
    },
    {
      property: "Clear Icon",
      tokenName: "$icon-tertiary",
      role: "Clear (X) button icon color",
      fallback: "#98A2B3",
    },
    {
      property: "Loading Indicator",
      tokenName: "$icon-interactive",
      role: "Spinner color during searching state",
      fallback: "#2E90FA",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Keyboard and click focus indicator ring",
      fallback: "0 0 0 2px #FFFFFF, 0 0 0 4px #2E90FA",
    },
    {
      property: "Text Color",
      tokenName: "$field-text",
      role: "User-entered query text color",
      fallback: "#1D2939",
    },
    {
      property: "Placeholder",
      tokenName: "$field-placeholder",
      role: "Placeholder hint text color",
      fallback: "#98A2B3",
    },
    {
      property: "Dropdown Background",
      tokenName: "$overlay-bg",
      role: "Suggestion dropdown background color",
      fallback: "#FFFFFF",
    },
    {
      property: "Dropdown Shadow",
      tokenName: "$shadow-lg",
      role: "Elevation shadow on the suggestion dropdown",
      fallback: "0 4px 16px rgba(0,0,0,0.12)",
    },
  ],

  structureRules: [
    "Container uses horizontal Auto Layout with center vertical alignment",
    "Search icon is the first child, followed by the text input, then optional clear button or spinner",
    "Spacing between icon and input uses the $spacing-xs token (4px default)",
    "Clear button appears only when the field has a non-empty value; it replaces the spinner when both could apply",
    "Suggestion dropdown is absolutely positioned below the field with a 4px gap ($spacing-xs)",
    "Dropdown uses vertical Auto Layout; each suggestion item is a full-width row with horizontal padding matching the field",
    "Touch target for the clear button is at least 44x44px regardless of visual icon size",
    "Field width defaults to fill-container; a max-width of 600px is recommended for standalone search bars",
  ],

  typeHierarchyRules: [
    "Query text uses Regular (400) weight at the size-appropriate font size",
    "Placeholder text uses the same font size and weight as query text but in the placeholder color token",
    "Suggestion items use Regular (400) weight; matched query substring is highlighted with Medium (500) weight",
    "Empty-state message ('No results found') uses Regular (400) weight in the secondary text color",
  ],

  interactionRules: [
    { event: "Click", trigger: "pointerdown inside field bounds", action: "Place cursor at click position; enter focused state" },
    { event: "Focus", trigger: "Tab key or focus()", action: "Show focus ring; place cursor at end of query text" },
    { event: "Blur", trigger: "Focus moves away from field and dropdown", action: "Remove focus ring; close suggestion dropdown after a short delay" },
    { event: "Input", trigger: "Keypress while focused", action: "Update value; reset debounce timer; show clear button if value is non-empty" },
    { event: "Debounce Complete", trigger: "No input for debounceMs duration", action: "Fire onSearch handler; enter searching state if async" },
    { event: "Enter Key", trigger: "Enter key while focused", action: "Immediately fire onSearch handler bypassing debounce; select highlighted suggestion if dropdown is open" },
    { event: "Clear Click", trigger: "Click on clear (X) button", action: "Reset value to empty string; fire onSearch with empty value; return focus to input" },
    { event: "Escape Key", trigger: "Escape key while focused", action: "Close suggestion dropdown; if no dropdown, clear the field value" },
    { event: "Arrow Down", trigger: "ArrowDown while dropdown is open", action: "Move highlight to the next suggestion item; wrap to first item at end" },
    { event: "Arrow Up", trigger: "ArrowUp while dropdown is open", action: "Move highlight to the previous suggestion item; wrap to last item at start" },
  ],

  contentGuidance: [
    "Placeholder should indicate what can be searched: 'Search components...', 'Find a team member...'",
    "Keep placeholder text concise — no more than 4-5 words",
    "Empty-state message should be helpful: 'No results for \"query\" — try a different search term'",
    "Suggestion items should highlight the matching substring to help users scan results quickly",
    "Avoid instructional text like 'Type to search' — the search icon already communicates the purpose",
    "If the search scope is limited, indicate it in the placeholder: 'Search in Documents'",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Search field expands to full width; may collapse to an icon-only trigger that expands on tap" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Search field uses a constrained width within the header or toolbar; dropdown matches field width" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Standard sizing; dropdown may extend wider than the field to accommodate longer suggestion text" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Max-width cap of 600px prevents overly wide search fields; dropdown width matches field" },
  ],

  accessibilitySpec: {
    intro:
      "Search inputs must be discoverable and operable for all users. Proper ARIA roles, autocomplete semantics, and keyboard navigation are essential for suggestion dropdowns.",
    requirements: [
      { requirement: "Role", level: "A", notes: "Use role='searchbox' on the input element or type='search' on a native <input> element" },
      { requirement: "Autocomplete", level: "A", notes: "Set aria-autocomplete='list' when suggestions are provided; 'none' when there are no suggestions" },
      { requirement: "Expanded State", level: "A", notes: "Set aria-expanded='true' on the input when the suggestion dropdown is visible; 'false' when closed" },
      { requirement: "Active Descendant", level: "A", notes: "Use aria-activedescendant to indicate the currently highlighted suggestion for screen readers" },
      { requirement: "Clear Button Label", level: "A", notes: "Clear button must have aria-label='Clear search' since it uses only an icon with no visible text" },
      { requirement: "Focusable", level: "A", notes: "Field must be reachable via Tab key; disabled state removes from tab order" },
      { requirement: "Contrast Ratio", level: "AA", notes: "Text-to-background: 4.5:1 minimum; icons must meet 3:1 non-text contrast" },
      { requirement: "Keyboard Navigation", level: "A", notes: "ArrowUp/Down navigates suggestions; Enter selects; Escape closes dropdown" },
    ],
    outro: [
      "Ensure the suggestion dropdown is announced by screen readers when it appears and when results change",
      "Use aria-live='polite' on a status region to announce result counts: '5 results available'",
      "Never trap keyboard focus inside the search field — Tab must always move to the next interactive element",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Visual Regression", platform: "All", expectedResult: "Search field renders pixel-perfect against baseline for each size and state" },
    { check: "Focus State", platform: "Web", expectedResult: "Focus ring visible on Tab; cursor blinks inside field; hidden on mouse click (focus-visible)" },
    { check: "Searching State", platform: "Web", expectedResult: "Spinner replaces search icon; field remains editable; spinner animates smoothly" },
    { check: "Clear Button", platform: "Web", expectedResult: "X button appears when value is non-empty; clicking clears value and returns focus to input" },
    { check: "Debounce", platform: "Web", expectedResult: "onSearch fires only after debounceMs of inactivity; rapid typing does not trigger multiple calls" },
    { check: "Suggestion Dropdown", platform: "Web", expectedResult: "Dropdown appears with results; keyboard navigation works; Enter selects item" },
    { check: "No Results", platform: "Web", expectedResult: "Empty-state message displays in dropdown; field retains query text" },
    { check: "Disabled State", platform: "All", expectedResult: "Muted visuals; pointer-events none; aria-disabled='true'; not focusable via Tab" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces role 'searchbox', accessible name, expanded state, and active suggestion" },
    { check: "Keyboard Shortcuts", platform: "Web", expectedResult: "Enter submits; Escape closes dropdown or clears; ArrowUp/Down navigates suggestions" },
    { check: "Touch Target", platform: "Mobile", expectedResult: "Clear button hit area is at least 44x44px; field height meets minimum touch target" },
    { check: "Contrast", platform: "All", expectedResult: "All text passes 4.5:1 contrast; icons pass 3:1 non-text contrast" },
    { check: "RTL Support", platform: "Web", expectedResult: "Search icon moves to right; clear button moves to left; text aligns right" },
  ],

  dos: [
    "Use a visible search icon to clearly communicate the field's purpose",
    "Provide a clear button when the field has a value so users can easily reset",
    "Use debouncing to prevent excessive API calls during rapid typing",
    "Show a loading indicator when search results are being fetched asynchronously",
    "Highlight matching text within suggestion items to aid scanning",
    "Use an appropriate placeholder that indicates the search scope",
    "Ensure the suggestion dropdown is dismissible via Escape key and clicking outside",
  ],

  donts: [
    "Do not require the user to press Enter to initiate a search — support live filtering with debounce",
    "Do not show a suggestion dropdown with zero items — show an empty-state message instead",
    "Do not hide the search icon in the default state — it is the primary affordance for the field's purpose",
    "Do not use a search field for navigation — use a navigation menu or command palette instead",
    "Do not fire search on every keystroke without debouncing — this causes performance issues and excessive API calls",
    "Do not override design token colors with hard-coded hex values",
    "Do not make the suggestion dropdown wider than the viewport on mobile — constrain to field width",
  ],
};
