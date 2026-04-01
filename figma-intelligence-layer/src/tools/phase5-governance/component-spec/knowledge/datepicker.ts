/**
 * datepicker.ts — Gold-standard design knowledge for DatePicker components
 */
import type { ComponentKnowledge } from "../types.js";

export const datepickerKnowledge: ComponentKnowledge = {
  description:
    "Date selection compound component | Input trigger with calendar popup | Supports single date and date range selection",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Trigger input shows placeholder text with calendar icon; border uses default token",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Resting state — no date selected, calendar is closed",
    },
    {
      state: "Open",
      visualChange: "Calendar dropdown is visible below the trigger; trigger border switches to active/focus token; selected day highlighted",
      opacity: "1",
      cursorWeb: "default",
      usage: "User has clicked the trigger or pressed Enter/Space to open the calendar popup",
    },
    {
      state: "Focused",
      visualChange: "2px focus ring offset by 2px from the trigger edge, using $focus-ring token; calendar remains closed until activated",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Trigger receives keyboard focus via Tab key or programmatic focus call",
    },
    {
      state: "Error",
      visualChange: "Trigger border switches to $color-error; error icon appears; error message text displayed below the trigger",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Selected date is outside min/max bounds, format is invalid, or required field is empty on validation",
    },
    {
      state: "Disabled",
      visualChange: "Trigger background and text switch to muted/disabled tokens; calendar icon is desaturated; click does not open calendar",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "Date selection is unavailable due to form state or permissions",
    },
  ],

  propertyDescriptions: {
    label: "Visible label text rendered above or beside the trigger; identifies the date field purpose (e.g. 'Start date')",
    value: "Currently selected date value in ISO 8601 format (YYYY-MM-DD) or null when no date is selected",
    placeholder: "Hint text shown in the trigger when no date is selected; should reflect the expected format (e.g. 'mm/dd/yyyy')",
    minDate: "Earliest selectable date; days before this date are rendered as disabled in the calendar grid",
    maxDate: "Latest selectable date; days after this date are rendered as disabled in the calendar grid",
    format: "Display format string for the selected date (e.g. 'MM/DD/YYYY', 'DD.MM.YYYY', 'YYYY-MM-DD')",
    type: "Selection mode — 'single' for one date or 'range' for a start-and-end date pair",
    locale: "BCP 47 locale tag controlling day/month names, first day of week, and number formatting (e.g. 'en-US', 'de-DE')",
    size: "Dimensional preset controlling trigger height, padding, font-size, and icon-size (Small, Medium, Large)",
    required: "When true the field must have a value before form submission; adds required indicator to the label",
    helperText: "Supplementary guidance text rendered below the trigger in default state (e.g. 'Select your preferred date')",
    errorMessage: "Validation error text rendered below the trigger in error state, replacing helper text",
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
      property: "Trigger Background",
      tokenName: "$datepicker-trigger-bg",
      role: "Background fill for the input trigger area",
      fallback: "#FFFFFF",
    },
    {
      property: "Trigger Border",
      tokenName: "$datepicker-trigger-border",
      role: "Border color for the input trigger in default state",
      fallback: "#D0D5DD",
    },
    {
      property: "Calendar Background",
      tokenName: "$datepicker-calendar-bg",
      role: "Background fill for the calendar dropdown panel",
      fallback: "#FFFFFF",
    },
    {
      property: "Calendar Shadow",
      tokenName: "$datepicker-calendar-shadow",
      role: "Elevation shadow on the calendar dropdown panel",
      fallback: "0 4px 16px rgba(0,0,0,0.12)",
    },
    {
      property: "Day Default",
      tokenName: "$datepicker-day-text",
      role: "Text color for selectable day cells in their default state",
      fallback: "#344054",
    },
    {
      property: "Day Hover",
      tokenName: "$datepicker-day-hover-bg",
      role: "Background fill when a selectable day cell is hovered",
      fallback: "#F2F4F7",
    },
    {
      property: "Day Selected",
      tokenName: "$datepicker-day-selected-bg",
      role: "Background fill for the currently selected day cell",
      fallback: "#2563EB",
    },
    {
      property: "Day Today",
      tokenName: "$datepicker-day-today-border",
      role: "Border or underline indicator on today's date cell",
      fallback: "#2563EB",
    },
    {
      property: "Day Range",
      tokenName: "$datepicker-day-range-bg",
      role: "Background fill for days within a selected date range (between start and end)",
      fallback: "#EFF6FF",
    },
    {
      property: "Day Disabled",
      tokenName: "$datepicker-day-disabled-text",
      role: "Text color for days outside the min/max bounds or other months",
      fallback: "#98A2B3",
    },
    {
      property: "Month Nav Arrows",
      tokenName: "$datepicker-nav-icon",
      role: "Icon color for previous/next month navigation arrows",
      fallback: "#667085",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Keyboard focus indicator ring on the trigger and individual day cells",
      fallback: "0 0 0 2px #FFFFFF, 0 0 0 4px #2E90FA",
    },
  ],

  structureRules: [
    "Component is a compound structure: input trigger + calendar dropdown overlay",
    "Trigger uses horizontal Auto Layout with center vertical alignment; contains placeholder/value text and calendar icon",
    "Calendar dropdown is positioned absolutely below the trigger with a 4px gap",
    "Calendar grid header row contains abbreviated day-of-week names (Su, Mo, Tu, etc.) based on locale",
    "Calendar grid body contains 6 rows x 7 columns of day cells; days from adjacent months are visible but dimmed",
    "Navigation row at the top of the calendar contains previous/next month arrows and current month-year label",
    "Range mode renders a highlighted band across all days between the start and end selection",
    "Calendar dropdown should flip above the trigger when insufficient viewport space exists below",
    "Touch target for each day cell is at least 44x44px; grid cells may use transparent padding to meet this",
    "Trigger width defaults to 280px but stretches to fill-container in full-width mode",
  ],

  typeHierarchyRules: [
    "Trigger value text uses the field's fontSize token — matches the size preset (12/14/16px)",
    "Calendar month-year header uses font-weight Medium (500) at one step larger than day cell text",
    "Day-of-week abbreviations use font-weight Medium (500) at the same size as day cell text",
    "Day cell numbers use font-weight Regular (400); selected day uses font-weight Medium (500)",
    "Label text uses sentence case; helper and error text use sentence case at one step smaller than the trigger text",
  ],

  interactionRules: [
    { event: "Click Trigger", trigger: "pointerup on trigger", action: "Toggle calendar open/closed; focus the currently selected or today's date cell" },
    { event: "Click Day", trigger: "pointerup on a day cell", action: "Select the date, update the trigger value, close the calendar (single mode)" },
    { event: "Click Range Start", trigger: "pointerup on first day cell (range mode)", action: "Set range start; keep calendar open awaiting end date selection" },
    { event: "Click Range End", trigger: "pointerup on second day cell (range mode)", action: "Set range end; highlight range band; close calendar" },
    { event: "Click Nav Arrow", trigger: "pointerup on prev/next arrow", action: "Navigate to previous or next month; do not close calendar" },
    { event: "Keyboard Enter/Space", trigger: "Enter or Space on trigger", action: "Open calendar and focus the currently selected or today's day cell" },
    { event: "Arrow Keys", trigger: "Arrow keys while calendar is open", action: "Move focus between day cells: Left/Right by 1 day, Up/Down by 1 week" },
    { event: "Page Up/Down", trigger: "Page Up or Page Down while calendar is open", action: "Navigate to the same day in the previous or next month" },
    { event: "Home/End", trigger: "Home or End key while calendar is open", action: "Move focus to the first or last day of the current month" },
    { event: "Escape", trigger: "Escape key while calendar is open", action: "Close the calendar without changing the selected value; return focus to the trigger" },
    { event: "Tab", trigger: "Tab key while calendar is open", action: "Close calendar and move focus to the next focusable element in the page" },
    { event: "Outside Click", trigger: "pointerdown outside the component", action: "Close the calendar dropdown without changing selection" },
  ],

  contentGuidance: [
    "Labels should clearly describe which date is expected: 'Start date', 'Date of birth', 'Departure date'",
    "Placeholder text should reflect the display format: 'mm/dd/yyyy' or 'dd.mm.yyyy' per locale",
    "Helper text may describe constraints: 'Must be a future date' or 'Select a weekday only'",
    "Error messages should be specific: 'Date must be after Jan 1, 2024' rather than 'Invalid date'",
    "For range selection, use paired labels: 'Start date' and 'End date' rather than a single ambiguous label",
    "Month and day names must respect the locale prop — never hardcode English names",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Calendar opens as a full-width bottom sheet or modal overlay; trigger stretches to full width; day cells are 48px touch targets" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Calendar opens as a dropdown below trigger; trigger may be full-width or fixed-width depending on form layout" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Standard dropdown calendar positioned below the trigger; trigger width follows form column grid" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Calendar size remains capped at standard dimensions — does not scale with viewport" },
  ],

  accessibilitySpec: {
    intro:
      "Date pickers are complex widgets requiring careful ARIA markup and full keyboard navigation to be usable by screen reader and keyboard-only users.",
    requirements: [
      { requirement: "Calendar Grid Role", level: "A", notes: "Calendar uses role='grid' with role='row' for each week and role='gridcell' for each day" },
      { requirement: "Day Cell Selection", level: "A", notes: "Selected day cell has aria-selected='true'; all other cells have aria-selected='false'" },
      { requirement: "Roving Tabindex", level: "A", notes: "Only the focused day cell has tabindex='0'; all others have tabindex='-1' for roving focus" },
      { requirement: "Arrow Key Navigation", level: "A", notes: "Left/Right moves by day, Up/Down by week; Page Up/Down navigates months; Home/End jump to month boundaries" },
      { requirement: "Live Region", level: "A", notes: "Month changes announced via aria-live='polite' region: 'March 2024' when navigating months" },
      { requirement: "Trigger Label", level: "A", notes: "Trigger input has aria-label or aria-labelledby pointing to the visible label; describes the field purpose" },
      { requirement: "Expanded State", level: "A", notes: "Trigger has aria-expanded='true' when calendar is open, 'false' when closed; aria-haspopup='dialog'" },
      { requirement: "Contrast Ratio", level: "AA", notes: "Day text to background: 4.5:1 minimum; selected day indicator to calendar background: 3:1 minimum" },
      { requirement: "Error Association", level: "A", notes: "Error message linked via aria-describedby on the trigger; aria-invalid='true' in error state" },
      { requirement: "Touch Target", level: "AA", notes: "Each day cell provides at least 44x44px touch target per WCAG 2.5.5" },
    ],
    outro: [
      "Ensure focus returns to the trigger when the calendar is dismissed via Escape or outside click",
      "Screen readers should announce the full date when a day cell receives focus: 'Tuesday, March 15, 2024'",
      "Disabled dates must be announced as unavailable: 'March 20, 2024, not available'",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Visual Regression", platform: "All", expectedResult: "Trigger and calendar render pixel-perfect against baseline for each size and state" },
    { check: "Calendar Open", platform: "Web", expectedResult: "Calendar dropdown appears below trigger on click; positioned correctly relative to viewport edges" },
    { check: "Date Selection", platform: "Web", expectedResult: "Clicking a day cell updates the trigger value and closes the calendar (single mode)" },
    { check: "Range Selection", platform: "Web", expectedResult: "First click sets start, second click sets end; range band highlights correctly between dates" },
    { check: "Min/Max Bounds", platform: "All", expectedResult: "Days outside minDate–maxDate are visually disabled and not selectable" },
    { check: "Keyboard Navigation", platform: "Web", expectedResult: "Arrow keys, Page Up/Down, Home/End navigate the calendar grid correctly" },
    { check: "Escape to Close", platform: "Web", expectedResult: "Escape closes calendar without changing value; focus returns to trigger" },
    { check: "Focus State", platform: "Web", expectedResult: "Focus ring visible on trigger via Tab; focus-visible hides ring on mouse click" },
    { check: "Error State", platform: "All", expectedResult: "Error border, icon, and message appear; aria-invalid='true' and aria-describedby set" },
    { check: "Disabled State", platform: "All", expectedResult: "Muted visuals; click does not open calendar; aria-disabled='true'" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces trigger label, expanded state, grid role, and selected date correctly" },
    { check: "Locale Support", platform: "All", expectedResult: "Day/month names, first day of week, and date format change correctly per locale prop" },
    { check: "Touch Target Size", platform: "Mobile", expectedResult: "Day cells and navigation arrows are at least 44x44px" },
    { check: "Contrast", platform: "All", expectedResult: "All text passes 4.5:1 contrast; selected/today indicators pass 3:1 non-text contrast" },
    { check: "RTL Support", platform: "Web", expectedResult: "Calendar grid, navigation arrows, and trigger layout mirror correctly in RTL locales" },
  ],

  dos: [
    "Use the DatePicker for dates that benefit from a visual calendar context (e.g. scheduling, booking)",
    "Provide clear min/max date constraints and communicate them through helper text",
    "Use locale-appropriate date formatting — never hardcode a single format for international audiences",
    "Show today's date with a visual indicator (border or dot) so users can orient themselves",
    "Pre-populate the value when a sensible default exists (e.g. today's date for 'start date')",
    "Use range mode for selecting date spans rather than two separate single-date pickers",
    "Ensure the calendar flips above the trigger when near the bottom of the viewport",
  ],

  donts: [
    "Do not use a DatePicker for known dates like birthdays — a simple text input with masking is faster",
    "Do not allow selection of dates outside the valid min/max range — disable them visually",
    "Do not close the calendar on month navigation — only close on date selection or explicit dismissal",
    "Do not remove the focus ring from day cells — keyboard users rely on it for orientation",
    "Do not hardcode English day/month names — always derive them from the locale prop",
    "Do not render the calendar inline by default — use the dropdown pattern to conserve space",
    "Do not override calendar shadow or elevation tokens with hardcoded values",
  ],
};
