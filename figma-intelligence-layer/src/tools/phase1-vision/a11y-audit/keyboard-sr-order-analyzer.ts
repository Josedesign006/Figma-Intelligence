/**
 * Keyboard & Screen Reader Order Analyzer
 * Pure analysis engine that extracts interactive elements from a Figma node tree,
 * infers ARIA roles/labels, computes keyboard tab order and screen reader reading
 * order, and produces all 10 annotation sections as structured data.
 */

import { FigmaNode, WCAGIssue } from "../../../shared/types.js";
import {
  checkMeaningfulSequence,
  checkFocusOrder,
  checkNameRoleValue,
  checkLabelsOrInstructions,
  extractSolidColor,
  findParentBgColor,
  checkTextContrast,
  checkTouchTarget,
  checkTargetSizeMinimum,
} from "./wcag-checker.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TabOrderEntry {
  order: number;
  elementDescription: string;
  role: string;
  label: string;
  notes: string;
  nodeId: string;
}

export interface ReadingOrderNode {
  landmarkRole?: string;
  landmarkLabel?: string;
  content: string;
  role?: string;
  depth: number;
  children?: ReadingOrderNode[];
  nodeId: string;
}

export interface FocusAnnouncement {
  element: string;
  announcement: string;
}

export interface StateChangeRule {
  trigger: string;
  behavior: string;
}

export interface FocusRule {
  scenario: string;
  rule: string;
}

export interface AriaReq {
  element: string;
  attribute: string;
  value: string;
}

export interface KBRule {
  component: string;
  key: string;
  action: string;
}

export interface Warning {
  id: number;
  severity: "Critical" | "Warning" | "Info";
  title: string;
  description: string;
}

export interface AuditSummaryRow {
  severity: string;
  count: number;
  category: string;
}

export interface A11yOrderAnalysis {
  header: { frameName: string; nodeId: string; date: string; standard: string };
  scope: string;
  assumptions: string[];
  keyboardTabOrder: TabOrderEntry[];
  screenReaderReadingOrder: ReadingOrderNode[];
  interactionAnnouncements: {
    onFocus: FocusAnnouncement[];
    stateChanges: StateChangeRule[];
  };
  focusManagement: FocusRule[];
  implementationNotes: {
    ariaTable: AriaReq[];
    keyboardBehavior: KBRule[];
    dosDonts: string[];
  };
  warnings: Warning[];
  auditSummary: AuditSummaryRow[];
}

// ─── Role Inference ─────────────────────────────────────────────────────────

const ROLE_PATTERNS: [RegExp, string][] = [
  [/\b(button|btn|cta)\b/i, "button"],
  [/\b(link|anchor|href)\b/i, "link"],
  [/\b(input|field|textbox|text[-_ ]?field)\b/i, "textbox"],
  [/\b(checkbox|check[-_ ]?box)\b/i, "checkbox"],
  [/\b(radio)\b/i, "radio"],
  [/\b(toggle|switch)\b/i, "switch"],
  [/\b(select|dropdown|combo[-_ ]?box)\b/i, "listbox"],
  [/\b(slider|range)\b/i, "slider"],
  [/\b(spinner|stepper|quantity)\b/i, "spinbutton"],
  [/\b(tab)\b/i, "tab"],
  [/\b(search)\b/i, "searchbox"],
  [/\b(menu[-_ ]?item)\b/i, "menuitem"],
  [/\b(menu)\b/i, "menu"],
  [/\b(modal|dialog)\b/i, "dialog"],
  [/\b(image|photo|avatar|thumbnail)\b/i, "img"],
];

const LANDMARK_PATTERNS: [RegExp, string, string][] = [
  [/\b(nav|navigation)\b/i, "navigation", "Navigation"],
  [/\b(header|top[-_ ]?bar|app[-_ ]?bar|navbar)\b/i, "banner", "Site header"],
  [/\b(footer|bottom[-_ ]?bar)\b/i, "contentinfo", "Site footer"],
  [/\b(sidebar|side[-_ ]?nav|drawer)\b/i, "complementary", "Sidebar"],
  [/\b(main|content|body)\b/i, "main", "Main content"],
  [/\b(banner|promo|offer|announcement)\b/i, "status", "Announcement"],
  [/\b(form)\b/i, "form", "Form"],
  [/\b(search)\b/i, "search", "Search"],
];

function inferRole(node: FigmaNode): string | null {
  const nameLower = node.name.toLowerCase();

  // Check name-based patterns
  for (const [pattern, role] of ROLE_PATTERNS) {
    if (pattern.test(nameLower)) return role;
  }

  // INSTANCE/COMPONENT nodes: only assign a role if the name strongly
  // indicates interactivity.  Decorative icons (heart, percent, trailing
  // icon, etc.) must NOT be promoted to "button" just because they are
  // component instances.
  return null;
}

function inferLandmark(node: FigmaNode): { role: string; label: string } | null {
  const nameLower = node.name.toLowerCase();
  for (const [pattern, role, label] of LANDMARK_PATTERNS) {
    if (pattern.test(nameLower)) return { role, label };
  }
  return null;
}

// ─── Label Inference ────────────────────────────────────────────────────────

function hasTextChild(node: FigmaNode): boolean {
  if (node.type === "TEXT" && node.characters) return true;
  return node.children?.some((c) => hasTextChild(c)) ?? false;
}

function findTextContent(node: FigmaNode): string {
  if (node.type === "TEXT" && node.characters) return node.characters.trim();
  if (!node.children) return "";
  const texts: string[] = [];
  for (const child of node.children) {
    const t = findTextContent(child);
    if (t) texts.push(t);
  }
  return texts.join(" ");
}

function cleanNodeName(name: string): string {
  return name
    .replace(/^(icon|icn|ic)[-_ /]*/i, "")
    .replace(/[-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findParentContext(
  nodeId: string,
  allNodes: FigmaNode[],
  depth: number = 0
): string | null {
  if (depth > 6) return null;
  for (const n of allNodes) {
    if (n.children?.some((c) => c.id === nodeId)) {
      // Look for a text child that could be a product/item name
      const nameText = n.children?.find(
        (c) =>
          c.type === "TEXT" &&
          c.characters &&
          c.characters.length > 2 &&
          c.characters.length < 80
      );
      if (nameText?.characters) return nameText.characters.trim();
      // Walk further up
      return findParentContext(n.id, allNodes, depth + 1);
    }
    if (n.children) {
      const found = findParentContext(nodeId, n.children, depth);
      if (found) return found;
    }
  }
  return null;
}

function inferLabel(
  node: FigmaNode,
  role: string,
  allNodes: FigmaNode[]
): string {
  // Text content inside the element
  const textContent = findTextContent(node);

  // For elements with text, use it
  if (textContent && textContent.length < 80) {
    // Enhance with context for actions
    if (
      role === "button" &&
      /^(remove|delete|close|add|minus|plus|decrease|increase)$/i.test(
        textContent
      )
    ) {
      const context = findParentContext(node.id, allNodes);
      if (context) {
        const action = textContent.toLowerCase();
        if (/remove|delete/i.test(action)) return `Remove ${context} from cart`;
        if (/decrease|minus/i.test(action))
          return `Decrease quantity for ${context}`;
        if (/increase|plus|add/i.test(action))
          return `Increase quantity for ${context}`;
      }
    }
    return textContent;
  }

  // Icon-only elements: clean up name
  if (role === "button" || role === "link") {
    const cleaned = cleanNodeName(node.name);
    if (cleaned) {
      // Capitalize first letter
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }

  // Use node name as fallback
  return cleanNodeName(node.name) || node.name;
}

// ─── Node Collection Helpers ────────────────────────────────────────────────

function collectAll(node: FigmaNode, acc: FigmaNode[] = []): FigmaNode[] {
  acc.push(node);
  if (node.children) {
    for (const child of node.children) collectAll(child, acc);
  }
  return acc;
}

function isInsideNavigation(node: FigmaNode, rootNode: FigmaNode): boolean {
  // Walk up parent chain to check if this node is inside a navigation landmark
  function findParent(current: FigmaNode, targetId: string): FigmaNode | null {
    if (current.children) {
      for (const child of current.children) {
        if (child.id === targetId) return current;
        const found = findParent(child, targetId);
        if (found) return found;
      }
    }
    return null;
  }

  let parentNode = findParent(rootNode, node.id);
  let depth = 0;
  while (parentNode && depth < 8) {
    if (inferLandmark(parentNode)?.role === "navigation" ||
        inferLandmark(parentNode)?.role === "banner") {
      return true;
    }
    const nextParent = findParent(rootNode, parentNode.id);
    if (!nextParent || nextParent.id === parentNode.id) break;
    parentNode = nextParent;
    depth++;
  }
  return false;
}

// Cache root node for navigation lookups in isInteractive
let _analysisRootNode: FigmaNode | null = null;

function isInteractive(node: FigmaNode): boolean {
  const role = inferRole(node);
  if (role && !["img", "dialog", "menu"].includes(role)) return true;

  // INSTANCE/COMPONENT with explicitly interactive names only.
  // DO NOT treat all leaf instances as interactive — many are decorative
  // icons (heart, star, percent, trailing icon, etc.).
  if (
    (node.type === "INSTANCE" || node.type === "COMPONENT") &&
    /button|btn|link|cta|click/i.test(node.name)
  )
    return true;

  // TEXT nodes inside navigation/banner landmarks are likely links
  if (
    node.type === "TEXT" &&
    node.characters &&
    node.characters.trim().length > 0 &&
    node.characters.trim().length < 40 &&
    _analysisRootNode &&
    isInsideNavigation(node, _analysisRootNode)
  ) {
    return true;
  }

  return false;
}

function hasInteractiveDescendant(node: FigmaNode): boolean {
  if (!node.children) return false;
  for (const child of node.children) {
    const role = inferRole(child);
    if (role && !["img", "dialog", "menu"].includes(role)) return true;
    if (
      (child.type === "INSTANCE" || child.type === "COMPONENT") &&
      /button|btn|link|cta|click/i.test(child.name)
    )
      return true;
    if (hasInteractiveDescendant(child)) return true;
  }
  return false;
}

function isHeading(node: FigmaNode): boolean {
  if (node.type !== "TEXT") return false;
  const fontSize = node.style?.fontSize ?? 16;
  const fontWeight = node.style?.fontWeight ?? 400;
  return fontSize >= 20 || fontWeight >= 700;
}

// ─── Tab Order Computation ──────────────────────────────────────────────────

const ROW_THRESHOLD = 10; // px tolerance for same-row grouping

function computeTabOrder(
  interactiveNodes: FigmaNode[],
  allNodes: FigmaNode[]
): TabOrderEntry[] {
  // Filter nodes with bounding boxes
  const withBounds = interactiveNodes.filter((n) => n.absoluteBoundingBox);

  // Sort by visual position: row-group by Y, then left-to-right within row
  withBounds.sort((a, b) => {
    const ay = a.absoluteBoundingBox!.y;
    const by = b.absoluteBoundingBox!.y;
    if (Math.abs(ay - by) <= ROW_THRESHOLD) {
      return a.absoluteBoundingBox!.x - b.absoluteBoundingBox!.x;
    }
    return ay - by;
  });

  return withBounds.map((node, idx) => {
    let role = inferRole(node) || (node.type === "TEXT" ? "link" : "button");
    const label = inferLabel(node, role, allNodes);
    const notes = generateNotes(node, role);

    return {
      order: idx + 1,
      elementDescription: generateElementDescription(node),
      role,
      label,
      notes,
      nodeId: node.id,
    };
  });
}

function generateElementDescription(node: FigmaNode): string {
  let name = node.name;
  // Clean up Figma-style naming
  name = name.replace(/^(component|instance|frame)[-_ /]*/i, "");
  name = name.replace(/[-_/]/g, " ").replace(/\s+/g, " ").trim();
  return name || node.name;
}

function generateNotes(node: FigmaNode, role: string): string {
  const notes: string[] = [];

  if (role === "spinbutton") {
    notes.push('aria-valuenow required; keyboard: Arrow Up/Down to adjust');
  }
  if (role === "textbox") {
    notes.push("Pair with visible label or aria-label");
  }
  if (role === "link" && node.name.toLowerCase().includes("logo")) {
    notes.push("Navigates to homepage");
  }
  if (role === "button" && /search/i.test(node.name)) {
    notes.push("Opens search overlay; announce expanded/collapsed state");
  }
  if (role === "button" && /menu|hamburger|nav/i.test(node.name)) {
    notes.push("Opens navigation menu; see Focus Management for trap behavior");
  }
  if (role === "button" && /remove|delete/i.test(node.name)) {
    notes.push("See Focus Management for post-removal focus");
  }
  if (role === "button" && /decrease|minus/i.test(node.name)) {
    notes.push("Disabled when qty = 1; announce current qty on activation");
  }
  if (role === "button" && /increase|plus/i.test(node.name)) {
    notes.push("Announce new qty on activation");
  }

  // Touch target warning
  if (node.width && node.height && (node.width < 44 || node.height < 44)) {
    notes.push(`Touch target ${node.width}x${node.height}px below 44x44px minimum`);
  }

  return notes.join("; ") || "\u2014";
}

// ─── Screen Reader Reading Order ────────────────────────────────────────────

function buildReadingOrder(
  node: FigmaNode,
  depth: number = 0
): ReadingOrderNode[] {
  const results: ReadingOrderNode[] = [];

  // Check if this node is a landmark
  const landmark = inferLandmark(node);

  if (node.type === "TEXT" && node.characters) {
    results.push({
      content: node.characters.trim(),
      role: isHeading(node)
        ? `heading (h${estimateHeadingLevel(node)})`
        : "text",
      depth,
      nodeId: node.id,
    });
    return results;
  }

  // Interactive leaf nodes
  const role = inferRole(node);
  if (role && !node.children?.length) {
    const label = inferLabel(node, role, []);
    results.push({
      content: `${label} (${role})`,
      role,
      depth,
      nodeId: node.id,
    });
    return results;
  }

  // Container/group nodes
  if (node.children && node.children.length > 0) {
    // Sort children by visual position (top-to-bottom, left-to-right)
    // instead of relying on Figma's layer order which may be inverted
    const sortedChildren = [...node.children].sort((a, b) => {
      const ay = a.absoluteBoundingBox?.y ?? 0;
      const by = b.absoluteBoundingBox?.y ?? 0;
      if (Math.abs(ay - by) <= ROW_THRESHOLD) {
        return (a.absoluteBoundingBox?.x ?? 0) - (b.absoluteBoundingBox?.x ?? 0);
      }
      return ay - by;
    });

    const childResults: ReadingOrderNode[] = [];
    for (const child of sortedChildren) {
      childResults.push(...buildReadingOrder(child, depth + 1));
    }

    if (landmark) {
      // Wrap children in landmark
      results.push({
        landmarkRole: landmark.role,
        landmarkLabel: landmark.label,
        content: node.name,
        depth,
        children: childResults,
        nodeId: node.id,
      });
    } else if (
      role === "dialog" ||
      (node.name.toLowerCase().includes("product") &&
        childResults.length > 0)
    ) {
      // Group container
      results.push({
        content: node.name,
        role: role || "group",
        depth,
        children: childResults,
        nodeId: node.id,
      });
    } else {
      // Flatten into parent
      results.push(...childResults);
    }
  }

  return results;
}

function estimateHeadingLevel(node: FigmaNode): number {
  const fontSize = node.style?.fontSize ?? 16;
  if (fontSize >= 32) return 1;
  if (fontSize >= 24) return 2;
  if (fontSize >= 20) return 3;
  if (fontSize >= 18) return 4;
  if (fontSize >= 16) return 5;
  return 6;
}

// ─── Interaction Announcements ──────────────────────────────────────────────

function generateFocusAnnouncements(
  tabOrder: TabOrderEntry[]
): FocusAnnouncement[] {
  return tabOrder.map((entry) => {
    let announcement = `${entry.label}, ${entry.role}`;

    // Add state info
    if (entry.notes.includes("Disabled")) {
      announcement += ", disabled";
    }
    if (entry.notes.includes("current page")) {
      announcement += ", current page";
    }
    if (entry.role === "textbox") {
      announcement += ", edit text, blank";
    }
    if (entry.role === "spinbutton") {
      announcement += ", spin button, 1";
    }

    return { element: entry.elementDescription, announcement };
  });
}

function generateStateChanges(
  tabOrder: TabOrderEntry[]
): StateChangeRule[] {
  const rules: StateChangeRule[] = [];

  // Quantity controls
  const hasSpinbutton = tabOrder.some((e) => e.role === "spinbutton");
  if (hasSpinbutton) {
    rules.push({
      trigger: "Quantity change (spinbutton / button activation)",
      behavior:
        'Announce via aria-live="assertive": "Quantity updated to [N] for [Product Name]". Update order summary total via aria-live="polite".',
    });
    rules.push({
      trigger: "Decrease at minimum quantity",
      behavior:
        '"Minimum quantity reached" — button becomes aria-disabled="true"',
    });
  }

  // Remove actions
  const hasRemove = tabOrder.some((e) =>
    /remove|delete/i.test(e.elementDescription)
  );
  if (hasRemove) {
    rules.push({
      trigger: "Item removed",
      behavior:
        'Announce "[Item Name] removed from cart". Update item count via aria-live="polite". Update order summary.',
    });
  }

  // Form submission
  const hasTextbox = tabOrder.some((e) => e.role === "textbox");
  if (hasTextbox) {
    rules.push({
      trigger: "Form validation error",
      behavior:
        'Announce error via role="alert" or aria-live="assertive". Input receives aria-invalid="true" and aria-describedby pointing to error.',
    });
    rules.push({
      trigger: "Form submission success",
      behavior:
        'Announce success via aria-live="polite". Focus remains on input or moves to success message.',
    });
  }

  // Navigation
  const hasPrimaryCTA = tabOrder.some(
    (e) =>
      e.role === "button" &&
      /proceed|checkout|submit|continue|next/i.test(e.elementDescription)
  );
  if (hasPrimaryCTA) {
    rules.push({
      trigger: "Primary CTA activation",
      behavior:
        'Announce "Navigating to [destination]". Standard page navigation.',
    });
  }

  // Toggle/switch
  const hasSwitch = tabOrder.some((e) => e.role === "switch");
  if (hasSwitch) {
    rules.push({
      trigger: "Toggle state change",
      behavior: 'Announce new state: "[Label], switch, on/off"',
    });
  }

  return rules;
}

// ─── Focus Management ───────────────────────────────────────────────────────

function generateFocusRules(tabOrder: TabOrderEntry[]): FocusRule[] {
  const rules: FocusRule[] = [];

  rules.push({
    scenario: "Initial page load",
    rule: "Focus on the <main> landmark or the primary heading (<h1>).",
  });

  const hasSpinbutton = tabOrder.some((e) => e.role === "spinbutton");
  if (hasSpinbutton) {
    rules.push({
      scenario: "After quantity change",
      rule: "Focus stays on the activated button (plus or minus). Do NOT move focus.",
    });
  }

  const hasRemove = tabOrder.some((e) =>
    /remove|delete/i.test(e.elementDescription)
  );
  if (hasRemove) {
    rules.push({
      scenario: "After item removal",
      rule: "If items remain: move focus to the next item's name. If removed item was last: move to previous item's name. If list empty: move to empty state message or \"Continue Shopping\" link.",
    });
  }

  const hasMenu = tabOrder.some(
    (e) => e.role === "button" && /menu|hamburger|nav/i.test(e.elementDescription)
  );
  if (hasMenu) {
    rules.push({
      scenario: "Menu/drawer activation",
      rule: 'Focus traps inside the drawer. Escape closes and returns focus to the menu button. Drawer has role="dialog", aria-modal="true".',
    });
  }

  const hasSearch = tabOrder.some(
    (e) => e.role === "button" && /search/i.test(e.elementDescription)
  );
  if (hasSearch) {
    rules.push({
      scenario: "Search overlay activation",
      rule: "Focus moves to the search input. Escape closes and returns focus to the search button.",
    });
  }

  const hasTextbox = tabOrder.some((e) => e.role === "textbox");
  if (hasTextbox) {
    rules.push({
      scenario: "Form validation failure",
      rule: 'Focus moves to the input. Input marked aria-invalid="true". Error associated via aria-describedby.',
    });
  }

  return rules;
}

// ─── Implementation Notes ───────────────────────────────────────────────────

const APG_KEYBOARD_MAP: Record<string, KBRule[]> = {
  button: [
    { component: "Button", key: "Enter / Space", action: "Activate" },
  ],
  link: [{ component: "Link", key: "Enter", action: "Navigate" }],
  textbox: [
    { component: "Text input", key: "Enter", action: "Submit (if applicable)" },
  ],
  spinbutton: [
    { component: "Spinbutton", key: "Arrow Up", action: "Increment value" },
    {
      component: "Spinbutton",
      key: "Arrow Down",
      action: "Decrement value (min bound)",
    },
    { component: "Spinbutton", key: "Home", action: "Set to minimum" },
    { component: "Spinbutton", key: "End", action: "Set to maximum" },
  ],
  checkbox: [
    { component: "Checkbox", key: "Space", action: "Toggle checked state" },
  ],
  radio: [
    {
      component: "Radio",
      key: "Arrow Up/Down",
      action: "Move within radio group",
    },
    { component: "Radio", key: "Space", action: "Select focused option" },
  ],
  switch: [
    { component: "Switch", key: "Space", action: "Toggle on/off" },
  ],
  listbox: [
    {
      component: "Listbox",
      key: "Arrow Up/Down",
      action: "Navigate options",
    },
    { component: "Listbox", key: "Enter", action: "Select option" },
    { component: "Listbox", key: "Escape", action: "Close dropdown" },
  ],
  slider: [
    {
      component: "Slider",
      key: "Arrow Left/Right",
      action: "Adjust value",
    },
    { component: "Slider", key: "Home", action: "Set to minimum" },
    { component: "Slider", key: "End", action: "Set to maximum" },
  ],
  tab: [
    {
      component: "Tab",
      key: "Arrow Left/Right",
      action: "Move between tabs",
    },
  ],
  dialog: [
    {
      component: "Dialog",
      key: "Escape",
      action: "Close dialog, return focus to trigger",
    },
  ],
  menuitem: [
    {
      component: "Menu item",
      key: "Arrow Up/Down",
      action: "Navigate items",
    },
    { component: "Menu item", key: "Enter", action: "Activate item" },
    { component: "Menu item", key: "Escape", action: "Close menu" },
  ],
};

function generateAriaRequirements(
  tabOrder: TabOrderEntry[],
  readingOrder: ReadingOrderNode[]
): AriaReq[] {
  const reqs: AriaReq[] = [];
  const seenElements = new Set<string>();

  for (const entry of tabOrder) {
    const key = `${entry.role}-${entry.elementDescription}`;
    if (seenElements.has(key)) continue;
    seenElements.add(key);

    // Icon-only buttons need aria-label
    if (
      (entry.role === "button" || entry.role === "link") &&
      /icon|search|cart|menu|hamburger|close|minus|plus|heart/i.test(
        entry.elementDescription
      )
    ) {
      reqs.push({
        element: entry.elementDescription,
        attribute: "aria-label",
        value: entry.label,
      });
    }

    // Spinbutton requirements
    if (entry.role === "spinbutton") {
      reqs.push({
        element: entry.elementDescription,
        attribute: "role",
        value: "spinbutton",
      });
      reqs.push({
        element: entry.elementDescription,
        attribute: "aria-valuenow",
        value: "current quantity",
      });
      reqs.push({
        element: entry.elementDescription,
        attribute: "aria-valuemin",
        value: '"1"',
      });
    }

    // Current page indicator
    if (/cart/i.test(entry.elementDescription) && entry.role === "link") {
      reqs.push({
        element: entry.elementDescription,
        attribute: "aria-current",
        value: '"page"',
      });
    }
  }

  // Landmark regions
  for (const rNode of readingOrder) {
    if (rNode.landmarkRole) {
      reqs.push({
        element: rNode.content || rNode.landmarkLabel || "",
        attribute: "role",
        value: rNode.landmarkRole,
      });
      if (rNode.landmarkLabel) {
        reqs.push({
          element: rNode.content || rNode.landmarkLabel,
          attribute: "aria-label",
          value: rNode.landmarkLabel,
        });
      }
    }
  }

  // Live regions
  const hasQuantity = tabOrder.some((e) => e.role === "spinbutton");
  if (hasQuantity) {
    reqs.push({
      element: "Item count text",
      attribute: "aria-live",
      value: '"polite"',
    });
    reqs.push({
      element: "Total amount",
      attribute: "aria-live",
      value: '"polite"',
    });
  }

  // Decorative dividers
  reqs.push({
    element: "Decorative dividers",
    attribute: "aria-hidden",
    value: '"true"',
  });

  return reqs;
}

function generateKeyboardBehavior(tabOrder: TabOrderEntry[]): KBRule[] {
  const rules: KBRule[] = [];
  const seenRoles = new Set<string>();

  // Global navigation
  rules.push({
    component: "Entire page",
    key: "Tab",
    action: "Move to next focusable element",
  });
  rules.push({
    component: "Entire page",
    key: "Shift+Tab",
    action: "Move to previous focusable element",
  });

  for (const entry of tabOrder) {
    if (seenRoles.has(entry.role)) continue;
    seenRoles.add(entry.role);

    const apgRules = APG_KEYBOARD_MAP[entry.role];
    if (apgRules) {
      rules.push(...apgRules);
    }
  }

  return rules;
}

function generateDosDonts(tabOrder: TabOrderEntry[]): string[] {
  const rules: string[] = [];

  // Dos
  rules.push(
    'Do: Use <button> for all action elements (submit, remove, toggle, increase/decrease)'
  );
  rules.push(
    'Do: Use <a> for elements that navigate to other pages (product links, logo)'
  );

  const hasTextbox = tabOrder.some((e) => e.role === "textbox");
  if (hasTextbox) {
    rules.push(
      'Do: Use <input type="text"> with a visible <label> for text inputs'
    );
  }

  const hasSpinbutton = tabOrder.some((e) => e.role === "spinbutton");
  if (hasSpinbutton) {
    rules.push(
      'Do: Group quantity controls (minus, value, plus) in a <div role="group" aria-label="Quantity for [Item]">'
    );
  }

  rules.push(
    'Do: Use aria-live="polite" on elements that update dynamically (counts, totals)'
  );
  rules.push(
    "Do: Provide aria-label on icon-only buttons and links"
  );

  // Don'ts
  rules.push(
    "Don't: Use <div> or <span> for interactive elements -- always use semantic HTML"
  );
  rules.push(
    "Don't: Rely on color alone for conveying status or state changes"
  );
  if (hasTextbox) {
    rules.push(
      "Don't: Use placeholder as the only label for inputs"
    );
  }
  rules.push(
    "Don't: Remove focus outline on any interactive element"
  );
  rules.push(
    "Don't: Use tabindex values greater than 0 -- let DOM order control tab sequence"
  );
  rules.push(
    "Don't: Make decorative dividers or purely decorative images focusable"
  );

  return rules;
}

// ─── Warnings & Audit Summary ───────────────────────────────────────────────

function generateWarnings(
  allNodes: FigmaNode[],
  interactiveNodes: FigmaNode[],
  textNodes: FigmaNode[]
): { warnings: Warning[]; summary: AuditSummaryRow[] } {
  const warnings: Warning[] = [];
  const issues: WCAGIssue[] = [];
  let warnId = 1;

  // Contrast checks
  for (const node of textNodes) {
    const issue = checkTextContrast(node, allNodes, "AA");
    if (issue) issues.push(issue);
  }

  // Touch target checks
  for (const node of interactiveNodes) {
    const ttIssue = checkTouchTarget(node);
    if (ttIssue) issues.push(ttIssue);
    const tsIssue = checkTargetSizeMinimum(node);
    if (tsIssue) issues.push(tsIssue);
  }

  // Reading/focus order checks
  issues.push(...checkMeaningfulSequence(allNodes));
  issues.push(...checkFocusOrder(interactiveNodes));
  issues.push(...checkNameRoleValue(interactiveNodes));
  issues.push(...checkLabelsOrInstructions(interactiveNodes, allNodes));

  // Group issues into warnings
  const contrastErrors = issues.filter(
    (i) => i.criterion.includes("1.4.3") && i.severity === "error"
  );
  const contrastWarnings = issues.filter(
    (i) => i.criterion.includes("1.4.3") && i.severity === "warning"
  );
  const touchTargetIssues = issues.filter(
    (i) =>
      i.criterion.includes("2.5.5") || i.criterion.includes("2.5.8")
  );
  const nameRoleIssues = issues.filter((i) =>
    i.criterion.includes("4.1.2")
  );
  const focusOrderIssues = issues.filter((i) =>
    i.criterion.includes("2.4.3")
  );

  if (contrastErrors.length > 0) {
    warnings.push({
      id: warnId++,
      severity: "Critical",
      title: `Contrast failures (${contrastErrors.length} elements)`,
      description: `${contrastErrors.length} text elements fail WCAG AA contrast minimum. Fix by darkening text or lightening background to achieve at least 4.5:1 ratio.`,
    });
  }

  if (touchTargetIssues.length > 0) {
    warnings.push({
      id: warnId++,
      severity: "Critical",
      title: `Touch target violations (${touchTargetIssues.length} elements)`,
      description: `${touchTargetIssues.length} interactive elements are below the 44x44px minimum. Apply invisible padding to achieve compliant tap zones.`,
    });
  }

  if (nameRoleIssues.length > 0) {
    warnings.push({
      id: warnId++,
      severity: "Critical",
      title: `Missing accessible names (${nameRoleIssues.length} elements)`,
      description: `${nameRoleIssues.length} interactive elements lack unique accessible names. Screen readers cannot distinguish them. Add aria-label with contextual information.`,
    });
  }

  if (contrastWarnings.length > 0) {
    warnings.push({
      id: warnId++,
      severity: "Warning",
      title: `Contrast near-misses (${contrastWarnings.length} elements)`,
      description: `${contrastWarnings.length} text elements have contrast between 3:1 and 4.5:1. While they pass for large text, they fail for normal text.`,
    });
  }

  if (focusOrderIssues.length > 0) {
    warnings.push({
      id: warnId++,
      severity: "Warning",
      title: `Focus order mismatches (${focusOrderIssues.length})`,
      description: `${focusOrderIssues.length} interactive elements have a tab order that does not match visual layout. Verify DOM order matches intended reading order.`,
    });
  }

  // Build summary
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const suggestionCount = issues.filter(
    (i) => i.severity === "suggestion"
  ).length;

  const summary: AuditSummaryRow[] = [];
  if (errorCount > 0) {
    summary.push({
      severity: "Error",
      count: errorCount,
      category: `Critical issues (contrast, touch targets, missing names)`,
    });
  }
  if (warningCount > 0) {
    summary.push({
      severity: "Warning",
      count: warningCount,
      category: `Potential issues (near-miss contrast, focus order, fixed containers)`,
    });
  }
  if (suggestionCount > 0) {
    summary.push({
      severity: "Suggestion",
      count: suggestionCount,
      category: `Improvement opportunities`,
    });
  }

  const totalIssues = errorCount + warningCount + suggestionCount;
  const totalChecks = allNodes.length;
  const passRate =
    totalChecks > 0
      ? Math.round(
          ((totalChecks - totalIssues) / totalChecks) * 100
        )
      : 100;
  summary.push({
    severity: "Total",
    count: totalIssues,
    category: `issues across ${totalChecks} checks (${passRate}% pass rate)`,
  });

  return { warnings, summary };
}

// ─── Scope & Assumptions Generation ─────────────────────────────────────────

function generateScope(
  node: FigmaNode,
  interactiveNodes: FigmaNode[],
  landmarks: ReadingOrderNode[]
): string {
  const parts: string[] = [];
  parts.push(`Complete ${node.name} page including:`);

  const landmarkNames = landmarks
    .filter((l) => l.landmarkRole)
    .map((l) => l.landmarkLabel || l.content);
  if (landmarkNames.length > 0) {
    parts.push(landmarkNames.join(", "));
  }

  const roleGroups = new Map<string, number>();
  for (const n of interactiveNodes) {
    const role = inferRole(n) || "interactive element";
    roleGroups.set(role, (roleGroups.get(role) || 0) + 1);
  }

  const roleSummary = Array.from(roleGroups.entries())
    .map(([role, count]) => `${count} ${role}${count > 1 ? "s" : ""}`)
    .join(", ");
  if (roleSummary) parts.push(roleSummary);

  return parts.join(" ");
}

function generateAssumptions(node: FigmaNode): string[] {
  return [
    `Page is in default/resting state`,
    `No validation errors are visible`,
    `No modal dialogs are open`,
    `All interactive elements are enabled unless noted`,
    `Content matches the current Figma frame "${node.name}"`,
  ];
}

// ─── Main Analysis Function ─────────────────────────────────────────────────

export function analyzeKeyboardAndScreenReaderOrder(
  rootNode: FigmaNode,
  nodeId: string
): A11yOrderAnalysis {
  // Set root node for navigation context lookups
  _analysisRootNode = rootNode;

  // Collect all nodes
  const allNodes = collectAll(rootNode);
  const textNodes = allNodes.filter((n) => n.type === "TEXT");
  const interactiveNodes = allNodes.filter((n) => isInteractive(n));

  // Compute tab order
  const keyboardTabOrder = computeTabOrder(interactiveNodes, allNodes);

  // Build reading order
  const screenReaderReadingOrder = buildReadingOrder(rootNode);

  // Generate interaction announcements
  const onFocus = generateFocusAnnouncements(keyboardTabOrder);
  const stateChanges = generateStateChanges(keyboardTabOrder);

  // Focus management rules
  const focusManagement = generateFocusRules(keyboardTabOrder);

  // Implementation notes
  const ariaTable = generateAriaRequirements(
    keyboardTabOrder,
    screenReaderReadingOrder
  );
  const keyboardBehavior = generateKeyboardBehavior(keyboardTabOrder);
  const dosDonts = generateDosDonts(keyboardTabOrder);

  // Warnings & audit summary
  const { warnings, summary } = generateWarnings(
    allNodes,
    interactiveNodes,
    textNodes
  );

  // Scope & assumptions
  const scope = generateScope(
    rootNode,
    interactiveNodes,
    screenReaderReadingOrder
  );
  const assumptions = generateAssumptions(rootNode);

  const today = new Date().toISOString().split("T")[0];

  return {
    header: {
      frameName: rootNode.name,
      nodeId,
      date: today,
      standard: "WAI-ARIA APG + WCAG 2.1 AA",
    },
    scope,
    assumptions,
    keyboardTabOrder,
    screenReaderReadingOrder,
    interactionAnnouncements: { onFocus, stateChanges },
    focusManagement,
    implementationNotes: { ariaTable, keyboardBehavior, dosDonts },
    warnings,
    auditSummary: summary,
  };
}
