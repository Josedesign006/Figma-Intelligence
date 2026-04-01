/**
 * treeview.ts — Gold-standard design knowledge for Treeview components
 */
import type { ComponentKnowledge } from "../types.js";

export const treeviewKnowledge: ComponentKnowledge = {
  description:
    "Hierarchical expandable tree | Displays nested parent-child relationships | Supports single and multi-selection with full keyboard navigation",

  stateSpecifications: [
    {
      state: "Expanded",
      visualChange: "Chevron icon rotates 90 degrees clockwise; child nodes are revealed with indented layout below the parent",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Parent node has been opened to show its children — aria-expanded='true'",
    },
    {
      state: "Collapsed",
      visualChange: "Chevron icon points to the right (0 degrees); child nodes are hidden from view",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Parent node is closed — its children are not rendered or are display-none; aria-expanded='false'",
    },
    {
      state: "Selected",
      visualChange: "Node row has a tinted background using $treeview-selected-bg; text may use primary accent color",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Node has been chosen by the user; in multi-select mode a checkbox indicator is shown",
    },
    {
      state: "Disabled",
      visualChange: "Node text and icons use muted/disabled tokens; expand/collapse still works but selection is blocked",
      opacity: "0.4",
      cursorWeb: "not-allowed",
      usage: "Individual node is non-selectable due to permissions or unavailability; children may still be accessible",
    },
    {
      state: "Focus",
      visualChange: "2px focus ring around the focused node row using $focus-ring token; background may subtly highlight",
      opacity: "1",
      cursorWeb: "pointer",
      usage: "Node receives keyboard focus via Tab entry or arrow key navigation within the tree",
    },
  ],

  propertyDescriptions: {
    data: "Nested array of tree node objects; each node has an id, label, optional icon, optional children array, and optional disabled flag",
    selection: "Selection mode — 'single' allows one node selected at a time, 'multi' allows multiple with checkboxes, 'none' disables selection entirely",
    expandedKeys: "Controlled array of node IDs that are currently expanded; used for controlled expand/collapse behavior",
    onExpand: "Callback fired when a node is expanded or collapsed; receives the node ID and new expanded state",
    onSelect: "Callback fired when a node is selected or deselected; receives the node ID and selection state",
    size: "Dimensional preset controlling node row height, indent depth, font-size, and icon-size (sm, md, lg)",
    defaultExpandedKeys: "Array of node IDs that should be expanded on initial render (uncontrolled mode)",
    draggable: "When true, nodes can be reordered via drag-and-drop; fires onMove callback with source and target",
    showLines: "When true, renders vertical indent guide lines connecting parent to children for visual hierarchy",
    loadOnExpand: "When true, children are loaded asynchronously on expand; shows a spinner in place of children while loading",
  },

  sizeSpecifications: [
    {
      size: "Small",
      height: "28px per node",
      paddingLR: "8px",
      fontSize: "12px",
      iconSize: "14px",
      borderRadius: "4px",
    },
    {
      size: "Medium",
      height: "36px per node",
      paddingLR: "12px",
      fontSize: "14px",
      iconSize: "18px",
      borderRadius: "6px",
    },
    {
      size: "Large",
      height: "44px per node",
      paddingLR: "16px",
      fontSize: "16px",
      iconSize: "22px",
      borderRadius: "8px",
    },
  ],

  designTokenBindings: [
    {
      property: "Node Background",
      tokenName: "$treeview-node-bg",
      role: "Default background for each tree node row",
      fallback: "transparent",
    },
    {
      property: "Hover Background",
      tokenName: "$treeview-hover-bg",
      role: "Background applied on hover for interactive nodes",
      fallback: "#F2F4F7",
    },
    {
      property: "Selected Background",
      tokenName: "$treeview-selected-bg",
      role: "Background tint for selected nodes",
      fallback: "#EFF8FF",
    },
    {
      property: "Node Text",
      tokenName: "$treeview-node-text",
      role: "Primary text color for node labels",
      fallback: "#101828",
    },
    {
      property: "Expand Icon",
      tokenName: "$treeview-expand-icon",
      role: "Color of the chevron/expand toggle icon",
      fallback: "#667085",
    },
    {
      property: "Indent Guide",
      tokenName: "$treeview-indent-line",
      role: "Color of the vertical indent guide lines between parent and children",
      fallback: "#E4E7EC",
    },
    {
      property: "Selected Accent",
      tokenName: "$treeview-selected-accent",
      role: "Accent color for selection indicator (checkmark or left border)",
      fallback: "#2563EB",
    },
    {
      property: "Focus Ring",
      tokenName: "$focus-ring",
      role: "Keyboard focus indicator ring on focused node",
      fallback: "0 0 0 2px #FFFFFF, 0 0 0 4px #2E90FA",
    },
    {
      property: "Indent Width",
      tokenName: "$treeview-indent",
      role: "Horizontal indent per nesting level",
      fallback: "24px",
    },
    {
      property: "Font Family",
      tokenName: "$font-family-sans",
      role: "Typeface for node labels",
      fallback: "Inter, system-ui, sans-serif",
    },
  ],

  structureRules: [
    "Root container has role='tree' and uses vertical Auto Layout with no gap — spacing is handled by node row padding",
    "Each node row is a horizontal Auto Layout: indent spacer, expand icon (if parent), optional node icon, label text, optional trailing content",
    "Indent spacer width equals nesting depth multiplied by the $treeview-indent token (e.g. depth 2 = 48px)",
    "Expand/collapse icon is only rendered for nodes with children; leaf nodes replace it with an equal-width spacer",
    "Child nodes are nested inside the parent's vertical stack and are conditionally rendered based on expanded state",
    "Multi-select mode adds a checkbox component before the node label; checkbox state mirrors selection state",
    "Indent guide lines are absolutely positioned 1px-wide vertical lines from parent expand icon to last child",
    "Drag handle appears as a leading grip icon when draggable is true; visible on hover only",
  ],

  typeHierarchyRules: [
    "Node labels use Regular (400) weight for all items; selected nodes may use Medium (500) for emphasis",
    "Font size is consistent across all nesting depths — do not reduce font-size for deeper nodes",
    "Labels truncate with ellipsis on overflow; tooltip shows full label on hover for truncated text",
    "Expand/collapse icon uses a consistent size regardless of the node label font-size",
  ],

  interactionRules: [
    { event: "Click Expand Icon", trigger: "pointerup on the chevron/expand toggle", action: "Toggle expanded state of the node; fire onExpand callback" },
    { event: "Click Node Label", trigger: "pointerup on the node label or row", action: "Select/deselect the node; fire onSelect callback (if selection != 'none')" },
    { event: "Hover", trigger: "pointerenter on a node row", action: "Apply hover background token to the full-width row" },
    { event: "Focus", trigger: "Tab enters the tree or arrow key moves focus", action: "Show focus ring on the focused node row" },
    { event: "Keydown Arrow Down", trigger: "Down arrow while a node is focused", action: "Move focus to the next visible node (skips collapsed children)" },
    { event: "Keydown Arrow Up", trigger: "Up arrow while a node is focused", action: "Move focus to the previous visible node" },
    { event: "Keydown Arrow Right", trigger: "Right arrow on a collapsed parent node", action: "Expand the node; if already expanded, move focus to first child" },
    { event: "Keydown Arrow Left", trigger: "Left arrow on an expanded parent node", action: "Collapse the node; if already collapsed or on leaf, move focus to parent" },
    { event: "Keydown Enter", trigger: "Enter key while a node is focused", action: "Select/activate the focused node (same as click on label)" },
    { event: "Keydown Space", trigger: "Space key while a node is focused", action: "Toggle selection on the focused node in multi-select mode" },
    { event: "Keydown Home", trigger: "Home key while in tree", action: "Move focus to the first visible node in the tree" },
    { event: "Keydown End", trigger: "End key while in tree", action: "Move focus to the last visible node in the tree" },
    { event: "Keydown Asterisk", trigger: "* key while a parent node is focused", action: "Expand all sibling nodes at the same level" },
  ],

  contentGuidance: [
    "Node labels should be concise and descriptive — represent the item clearly (file name, category, section title)",
    "Use icons consistently: either all nodes at a level have icons, or none do — avoid mixing",
    "Limit nesting depth to 4-5 levels for usability; deeper hierarchies become difficult to navigate",
    "Parent nodes with loadable children should show a loading indicator (spinner) during async fetch",
    "Use clear expand/collapse affordance — the chevron icon is the standard convention",
    "For file-tree patterns, use distinct icons for folders (parent nodes) and files (leaf nodes)",
    "Group related items under meaningful parent labels that describe the category or section",
  ],

  responsiveBehaviour: [
    { breakpoint: "Mobile (<768px)", behavior: "Consider replacing tree with a drill-down navigation pattern; if tree is used, reduce indent width and allow horizontal scroll" },
    { breakpoint: "Tablet (768-1023px)", behavior: "Tree fits in sidebar panels; ensure touch targets are at least 44px; indent guides help distinguish depth" },
    { breakpoint: "Desktop (1024-1439px)", behavior: "Full tree with standard indent width; ideal for file browsers, settings panels, and navigation sidebars" },
    { breakpoint: "Ultra-wide (>=1440px)", behavior: "Tree width should be constrained in a sidebar; do not allow the tree to stretch to fill wide content areas" },
  ],

  accessibilitySpec: {
    intro:
      "Treeview is one of the most complex ARIA patterns. It requires precise role assignment, keyboard navigation following the WAI-ARIA TreeView pattern, and correct state management for expanded, selected, and disabled nodes.",
    requirements: [
      { requirement: "Tree Role", level: "A", notes: "Root container must have role='tree'; each node must have role='treeitem'" },
      { requirement: "Expanded State", level: "A", notes: "Parent nodes must have aria-expanded='true' or 'false'; leaf nodes must not have aria-expanded" },
      { requirement: "Arrow Key Navigation", level: "A", notes: "Up/Down moves focus between visible nodes; Right expands or enters children; Left collapses or moves to parent" },
      { requirement: "Home/End Keys", level: "A", notes: "Home moves focus to first node; End moves to last visible node in the tree" },
      { requirement: "Selection State", level: "A", notes: "Selected nodes must have aria-selected='true'; multi-select trees use aria-multiselectable='true' on the root" },
      { requirement: "Nesting Structure", level: "A", notes: "Child nodes must be grouped in a role='group' container nested inside the parent treeitem" },
      { requirement: "Contrast Ratio", level: "AA", notes: "Node text: 4.5:1; expand icon: 3:1 non-text; selected indicator: 3:1 non-text contrast" },
      { requirement: "Touch Target", level: "AA", notes: "Each node row must have at least 44px height for touch interaction; expand icon target at least 24x24px" },
    ],
    outro: [
      "Focus must remain on the correct node after expand/collapse operations — do not reset focus to the root",
      "When nodes are loaded asynchronously, use aria-busy='true' on the parent node during loading",
      "Type-ahead is recommended: typing a character should move focus to the next node whose label starts with that character",
    ],
  },

  qaAcceptanceCriteria: [
    { check: "Visual Regression", platform: "All", expectedResult: "Tree renders pixel-perfect against baseline for each size variant and nesting depth" },
    { check: "Expand/Collapse", platform: "All", expectedResult: "Chevron rotates; children appear/disappear smoothly; aria-expanded updates correctly" },
    { check: "Selection State", platform: "All", expectedResult: "Selected nodes show tinted background; aria-selected is true; deselection works" },
    { check: "Multi-select", platform: "Web", expectedResult: "Checkboxes appear; Space toggles selection; Ctrl+Click extends selection" },
    { check: "Disabled Nodes", platform: "All", expectedResult: "Muted visuals; expand still works; selection is blocked; aria-disabled='true'" },
    { check: "Keyboard Down/Up", platform: "Web", expectedResult: "Arrow keys move focus to next/previous visible node; skips collapsed children" },
    { check: "Keyboard Right/Left", platform: "Web", expectedResult: "Right expands or enters children; Left collapses or moves to parent; works on all depths" },
    { check: "Keyboard Home/End", platform: "Web", expectedResult: "Home focuses first node; End focuses last visible node" },
    { check: "Focus Ring", platform: "Web", expectedResult: "Focus ring visible on keyboard navigation; hidden on mouse click (focus-visible)" },
    { check: "Screen Reader", platform: "Web", expectedResult: "Announces role 'tree'/'treeitem', expanded state, selected state, level, set size, and position" },
    { check: "Indent Guide Lines", platform: "All", expectedResult: "Lines connect parent to children when showLines=true; hidden when false" },
    { check: "Async Loading", platform: "Web", expectedResult: "Spinner shown while children load; aria-busy on parent; children appear after fetch" },
    { check: "RTL Support", platform: "Web", expectedResult: "Indent direction mirrors; chevron direction swaps; layout alignment correct" },
  ],

  dos: [
    "Use treeview for hierarchical data: file systems, nested categories, organizational structures",
    "Always provide the expand/collapse chevron affordance for parent nodes — do not rely on double-click alone",
    "Implement full WAI-ARIA TreeView keyboard pattern including arrow keys, Home, End, and type-ahead",
    "Use indent guide lines (showLines) for deep hierarchies to help users track parent-child relationships",
    "Pre-expand the most relevant branch on initial load so users see useful content immediately",
    "Keep node labels concise and scannable — the hierarchy itself provides context",
    "Use consistent icons across the same level of nesting",
  ],

  donts: [
    "Do not use treeview for flat lists — use a list or menu component instead",
    "Do not nest deeper than 5 levels — consider a different navigation pattern for deeply nested data",
    "Do not auto-collapse sibling nodes when expanding a node unless explicitly required (accordion tree)",
    "Do not use different font sizes for different nesting depths — keep typography consistent",
    "Do not render hundreds of nodes without virtualization — performance will degrade significantly",
    "Do not make leaf nodes appear as if they are expandable (no chevron on leaf nodes)",
    "Do not remove focus from the tree during expand/collapse transitions — focus must remain stable",
  ],
};
