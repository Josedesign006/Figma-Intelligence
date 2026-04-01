/**
 * grid.ts — Gold-standard design knowledge for Grid layout components
 */
import type { ComponentKnowledge } from "../types.js";

export const gridKnowledge: ComponentKnowledge = {
  description:
    "CSS Grid-based layout container | Structures content in rows and columns | Purely presentational with no interactive states",

  stateSpecifications: [
    {
      state: "Default",
      visualChange: "Grid container renders its children according to the configured column, gap, and alignment properties; no visible chrome",
      opacity: "1",
      cursorWeb: "default",
      usage: "Only state — the grid is a passive structural container with no interactive or visual state changes",
    },
    {
      state: "Empty",
      visualChange: "Grid container renders with no children; may collapse to zero height or show a minimum height placeholder depending on implementation",
      opacity: "1",
      cursorWeb: "default",
      usage: "No content has been placed in the grid — container remains in the DOM for layout stability",
    },
    {
      state: "Loading",
      visualChange: "Grid cells display skeleton placeholders in the configured layout pattern to maintain visual structure during data fetch",
      opacity: "0.6",
      cursorWeb: "default",
      usage: "Child content is being loaded — skeleton cells preview the eventual layout",
    },
  ],

  propertyDescriptions: {
    columns: "Number of equal-width columns in the grid — integer from 1 to 12; maps to CSS grid-template-columns: repeat(N, 1fr)",
    gap: "Spacing between grid cells — Small (8px), Medium (16px), or Large (24px); applies equally to row and column gaps",
    rowGap: "Overrides the vertical gap between grid rows independently of the column gap; useful for asymmetric spacing",
    columnGap: "Overrides the horizontal gap between grid columns independently of the row gap",
    alignItems: "Vertical alignment of items within their grid cells — start, center, end, stretch (default stretch)",
    justifyItems: "Horizontal alignment of items within their grid cells — start, center, end, stretch (default stretch)",
    responsive: "When true the grid automatically reduces columns at smaller breakpoints following the responsive rules",
    minColumnWidth: "Minimum width for each column before the grid reflows to fewer columns — alternative to fixed column count",
    autoRows: "Height of implicitly created rows — 'auto' (content-sized) or a fixed value like '200px' or 'minmax(100px, auto)'",
    templateAreas: "Named grid areas for semantic placement of children — maps to CSS grid-template-areas property",
    fullBleed: "When true the grid spans the full viewport width, breaking out of its parent container constraints",
    dense: "When true enables CSS grid auto-flow: dense to fill gaps left by items spanning multiple columns",
  },

  sizeSpecifications: [
    {
      size: "Small Gap",
      height: "N/A (container)",
      paddingLR: "0px",
      fontSize: "N/A",
      iconSize: "N/A",
      borderRadius: "0px",
    },
    {
      size: "Medium Gap",
      height: "N/A (container)",
      paddingLR: "0px",
      fontSize: "N/A",
      iconSize: "N/A",
      borderRadius: "0px",
    },
    {
      size: "Large Gap",
      height: "N/A (container)",
      paddingLR: "0px",
      fontSize: "N/A",
      iconSize: "N/A",
      borderRadius: "0px",
    },
  ],

  designTokenBindings: [
    {
      property: "Gap Small",
      tokenName: "$spacing-sm",
      role: "8px gap between grid cells in the small gap preset",
      fallback: "8px",
    },
    {
      property: "Gap Medium",
      tokenName: "$spacing-md",
      role: "16px gap between grid cells in the medium gap preset",
      fallback: "16px",
    },
    {
      property: "Gap Large",
      tokenName: "$spacing-lg",
      role: "24px gap between grid cells in the large gap preset",
      fallback: "24px",
    },
    {
      property: "Gap Extra-Large",
      tokenName: "$spacing-xl",
      role: "32px gap between grid cells for wide-spacing layouts",
      fallback: "32px",
    },
    {
      property: "Page Margin",
      tokenName: "$grid-page-margin",
      role: "Horizontal margin between the grid container and the viewport edge",
      fallback: "24px",
    },
    {
      property: "Max Width",
      tokenName: "$grid-max-width",
      role: "Maximum width of the grid container — prevents overly wide layouts on ultra-wide screens",
      fallback: "1280px",
    },
    {
      property: "Breakpoint SM",
      tokenName: "$breakpoint-sm",
      role: "Small breakpoint threshold for responsive column reduction",
      fallback: "640px",
    },
    {
      property: "Breakpoint MD",
      tokenName: "$breakpoint-md",
      role: "Medium breakpoint threshold for responsive column reduction",
      fallback: "768px",
    },
    {
      property: "Breakpoint LG",
      tokenName: "$breakpoint-lg",
      role: "Large breakpoint threshold for responsive column count",
      fallback: "1024px",
    },
    {
      property: "Breakpoint XL",
      tokenName: "$breakpoint-xl",
      role: "Extra-large breakpoint threshold where the full column count applies",
      fallback: "1280px",
    },
  ],

  structureRules: [
    "Grid container is a block-level element using display: grid — never display: flex for grid layouts",
    "Columns are defined via grid-template-columns: repeat(N, 1fr) where N is the columns property value",
    "Gap applies to both row-gap and column-gap equally unless rowGap or columnGap overrides are provided",
    "Grid children can span multiple columns using gridColumn: span N — the grid adjusts row wrapping accordingly",
    "Page margin is applied as horizontal padding on the grid container — content stays within the maxWidth boundary",
    "The grid container centers itself within its parent when maxWidth is less than available width using margin: 0 auto",
    "Full-bleed items break out of the grid margin using negative margins equal to the page margin value",
    "When responsive is true, the grid uses CSS clamp() or media queries to reduce columns at smaller viewports",
    "Grid does not have visible borders, backgrounds, or decoration — it is purely a structural layout primitive",
  ],

  typeHierarchyRules: [
    "Grid does not impose typography rules — child components manage their own text styling",
    "Headings within grid cells should follow the page's heading hierarchy — do not skip levels (h1 > h2 > h3)",
    "Card titles in a grid should all be the same heading level for semantic consistency within the grid",
    "Text alignment within grid cells should align with the justifyItems property for visual consistency",
  ],

  interactionRules: [
    { event: "Resize Viewport", trigger: "Browser window resize event", action: "Reflow grid columns according to responsive breakpoint rules; gap values remain constant" },
    { event: "Content Overflow", trigger: "Child content exceeds cell bounds", action: "Cell stretches vertically to accommodate content; sibling cells in the same row align accordingly" },
    { event: "Column Span", trigger: "Child element specifies gridColumn: span N", action: "Item spans N columns; subsequent items reflow around it" },
    { event: "Dense Packing", trigger: "dense property enabled with variable-span items", action: "Grid auto-placement fills gaps left by spanning items, reducing whitespace" },
    { event: "Skeleton Load", trigger: "Data loading for grid children", action: "Skeleton placeholder cells render in the grid layout maintaining the expected visual structure" },
  ],

  contentGuidance: [
    "Use the grid for page-level layout, card grids, image galleries, and any repeating content arrangement",
    "Choose column counts that create comfortable reading widths — 3-4 columns for cards, 2 columns for content-heavy layouts",
    "Maintain consistent gap sizes across grids within the same page for visual rhythm",
    "Avoid deeply nesting grids inside grids — one level of nesting is acceptable; two levels indicate overengineering",
    "Use named grid areas (templateAreas) for complex page layouts where semantic placement is more readable than numeric spans",
    "Grid is a layout primitive — it should not contain application logic or manage component state",
    "For single-dimension layouts (a row of items or a column of items), prefer Flexbox over Grid",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<640px)", behavior: "Grid collapses to 1 column; all items stack vertically; gap remains consistent; page margin reduces to 16px" },
    { breakpoint: "Small Tablet (640-767px)", behavior: "Grid uses 2 columns for content that was 3+ columns; gap and alignment maintained" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Grid uses approximately half the desktop column count (e.g., 6-column becomes 3-column)" },
    { breakpoint: "Desktop (1024-1279px)", behavior: "Grid uses the full specified column count; page margins and max-width apply normally" },
    { breakpoint: "Ultra-wide (>=1280px)", behavior: "Grid container width capped at maxWidth; centered on the viewport with auto margins" },
  ],

  accessibilitySpec: {
    intro:
      "Grid is a purely structural layout component with no interactive role. Accessibility concerns are limited to ensuring the DOM order matches visual order and that grid children are properly accessible.",
    requirements: [
      { requirement: "No ARIA Role", level: "A", notes: "Grid containers should not use role='grid' — that ARIA role is for interactive data grids (tables); layout grids use no role" },
      { requirement: "DOM Order", level: "A", notes: "Visual order of grid items must match DOM order — CSS grid ordering (order property) must not break reading/tab sequence" },
      { requirement: "Heading Hierarchy", level: "A", notes: "Headings within grid cells must follow the page heading hierarchy — no skipping levels" },
      { requirement: "Landmark Nesting", level: "A", notes: "Grid cells containing landmarks (nav, main, aside) must follow proper landmark nesting rules" },
      { requirement: "Content Reflow", level: "AA", notes: "At 400% zoom grid must reflow to a single column without horizontal scrolling (WCAG 1.4.10)" },
      { requirement: "Focus Order", level: "A", notes: "Tab order through grid children must follow a logical reading sequence (left-to-right, top-to-bottom for LTR)" },
      { requirement: "Spacing for Readability", level: "AAA", notes: "Gap spacing should allow clear visual separation between items for users with cognitive disabilities" },
    ],
    outro: [
      "Verify that CSS grid ordering (order, grid-row, grid-column) does not create a disconnect between DOM and visual order",
      "Test at 200% and 400% zoom to ensure content reflows gracefully without overflow or overlap",
      "Ensure that screen readers traverse grid children in the intended reading order",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Column Count", platform: "Web", expectedResult: "Grid renders the specified number of equal-width columns with correct fr units" },
    { check: "Gap Spacing", platform: "Web", expectedResult: "Row and column gaps match the specified token value (8/16/24px)" },
    { check: "Responsive Reflow", platform: "Web", expectedResult: "Grid reduces columns at each breakpoint threshold; single column on mobile" },
    { check: "Column Span", platform: "Web", expectedResult: "Items with gridColumn: span N correctly span multiple columns and reflow neighbors" },
    { check: "Alignment", platform: "Web", expectedResult: "alignItems and justifyItems correctly position children within their cells" },
    { check: "Max Width", platform: "Web", expectedResult: "Grid container does not exceed maxWidth; centers within viewport on ultra-wide screens" },
    { check: "Dense Packing", platform: "Web", expectedResult: "With dense enabled, gaps left by spanning items are filled by subsequent items" },
    { check: "DOM Order", platform: "Web", expectedResult: "Tab order matches visual order — no visual/DOM order mismatch" },
    { check: "Zoom Reflow", platform: "Web", expectedResult: "At 400% zoom grid reflows to single column without horizontal scrollbar" },
    { check: "Skeleton Loading", platform: "Web", expectedResult: "Skeleton placeholders render in the correct grid layout positions" },
    { check: "RTL Support", platform: "Web", expectedResult: "Grid items flow right-to-left in RTL locales; alignment properties mirror correctly" },
    { check: "Empty State", platform: "Web", expectedResult: "Empty grid renders without errors; may show minimum height or collapse gracefully" },
    { check: "Visual Regression", platform: "All", expectedResult: "Grid layout renders pixel-perfect against baseline for each column/gap configuration" },
  ],

  dos: [
    "Use Grid for two-dimensional layouts — rows and columns working together",
    "Choose gap sizes from the spacing token scale for visual consistency with the rest of the design system",
    "Use responsive breakpoints to reduce column counts progressively on smaller screens",
    "Set a maxWidth on the grid container to prevent overly wide layouts on ultra-wide monitors",
    "Use named grid areas for complex page-level layouts with semantically meaningful region names",
    "Ensure DOM order matches visual order — avoid CSS order property when it breaks the reading sequence",
    "Constrain the grid container with page margins that follow the design system spacing scale",
  ],

  donts: [
    "Do not use role='grid' on layout grids — role='grid' is reserved for interactive data grids and tables",
    "Do not nest grids more than one level deep — flatten the layout or reconsider the information architecture",
    "Do not use CSS grid for simple single-row or single-column layouts — use Flexbox instead",
    "Do not use the CSS order property in ways that create a mismatch between visual and DOM/tab order",
    "Do not apply decorative styles (backgrounds, borders, shadows) to the grid container itself — it is invisible chrome",
    "Do not hardcode pixel widths for columns — use fractional units (1fr) for fluid, responsive behavior",
    "Do not allow grid content to cause horizontal scrolling at any supported viewport width or zoom level",
  ],
};
