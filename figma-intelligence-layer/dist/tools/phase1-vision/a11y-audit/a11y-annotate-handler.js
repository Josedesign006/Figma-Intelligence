"use strict";
/**
 * Accessibility Annotation Handler
 * Analyzes a Figma frame and creates a new page with:
 *   1. A clone of the design with numbered circle markers on interactive elements
 *   2. A Tab Order Sequence table
 *   3. Implementation Notes
 *
 * Supports 7 annotation types: focus-order, reading-order, input,
 * landmark, heading, link, button.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.a11yAnnotateHandler = a11yAnnotateHandler;
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
const a11y_annotation_kit_js_1 = require("./a11y-annotation-kit.js");
const a11y_annotate_renderer_js_1 = require("./a11y-annotate-renderer.js");
// ─── Module-level root for navigation lookups ────────────────────────────
let _annotateRootNode = null;
// ─── Role / Landmark / Heading inference ───────────────────────────────────
const ROLE_PATTERNS = [
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
const LANDMARK_PATTERNS = [
    [/\b(nav|navigation)\b/i, "navigation", "Navigation"],
    [/\b(header|top[-_ ]?bar|app[-_ ]?bar|navbar)\b/i, "banner", "Site header"],
    [/\b(footer|bottom[-_ ]?bar)\b/i, "contentinfo", "Site footer"],
    [/\b(sidebar|side[-_ ]?nav|drawer)\b/i, "complementary", "Sidebar"],
    [/\b(main|content|body)\b/i, "main", "Main content"],
    [/\b(form)\b/i, "form", "Form"],
    [/\b(search)\b/i, "search", "Search"],
];
function inferRole(node) {
    const nameLower = node.name.toLowerCase();
    for (const [pattern, role] of ROLE_PATTERNS) {
        if (pattern.test(nameLower))
            return role;
    }
    return null;
}
function inferLandmark(node) {
    const nameLower = node.name.toLowerCase();
    for (const [pattern, role, label] of LANDMARK_PATTERNS) {
        if (pattern.test(nameLower))
            return { role, label };
    }
    return null;
}
function isHeading(node) {
    if (node.type !== "TEXT")
        return false;
    const fontSize = node.style?.fontSize ?? 16;
    const fontWeight = node.style?.fontWeight ?? 400;
    return fontSize >= 20 || fontWeight >= 700;
}
function estimateHeadingLevel(node) {
    const fontSize = node.style?.fontSize ?? 16;
    if (fontSize >= 32)
        return 1;
    if (fontSize >= 24)
        return 2;
    if (fontSize >= 20)
        return 3;
    if (fontSize >= 18)
        return 4;
    if (fontSize >= 16)
        return 5;
    return 6;
}
// ─── Navigation context detection ────────────────────────────────────────
function isInsideNavigation(node, rootNode) {
    function findParent(current, targetId) {
        if (current.children) {
            for (const child of current.children) {
                if (child.id === targetId)
                    return current;
                const found = findParent(child, targetId);
                if (found)
                    return found;
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
        if (!nextParent || nextParent.id === parentNode.id)
            break;
        parentNode = nextParent;
        depth++;
    }
    return false;
}
// ─── Interactive element helpers ─────────────────────────────────────────
function hasInteractiveDescendant(node) {
    if (!node.children)
        return false;
    for (const child of node.children) {
        const role = inferRole(child);
        if (role && !["img", "dialog", "menu"].includes(role) && child.type !== "TEXT")
            return true;
        if ((child.type === "INSTANCE" || child.type === "COMPONENT") &&
            /button|btn|link|cta|click/i.test(child.name))
            return true;
        if (hasInteractiveDescendant(child))
            return true;
    }
    return false;
}
function isInteractive(node) {
    // TEXT nodes are never independently interactive — they are labels/content.
    // Exception: text inside nav/banner landmarks acts as focusable links.
    if (node.type === "TEXT") {
        if (_annotateRootNode &&
            node.characters &&
            node.characters.trim().length > 0 &&
            node.characters.trim().length < 40 &&
            isInsideNavigation(node, _annotateRootNode)) {
            return true;
        }
        return false;
    }
    const role = inferRole(node);
    if (role && !["img", "dialog", "menu"].includes(role)) {
        // Skip containers (FRAME/GROUP) that wrap interactive children —
        // the children will be collected individually
        if ((node.type === "FRAME" || node.type === "GROUP") &&
            hasInteractiveDescendant(node)) {
            return false;
        }
        return true;
    }
    if ((node.type === "INSTANCE" || node.type === "COMPONENT") &&
        /button|btn|link|cta|click/i.test(node.name)) {
        // Skip component groups that contain interactive children
        if (hasInteractiveDescendant(node))
            return false;
        return true;
    }
    return false;
}
function findTextContent(node) {
    if (node.type === "TEXT" && node.characters)
        return node.characters.trim();
    if (!node.children)
        return "";
    const texts = [];
    for (const child of node.children) {
        const t = findTextContent(child);
        if (t)
            texts.push(t);
    }
    return texts.join(" ");
}
function cleanNodeName(name) {
    return name
        .replace(/^(icon|icn|ic)[-_ /]*/i, "")
        .replace(/[-_/]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
// ─── Adaptive row threshold ──────────────────────────────────────────────
const MIN_ROW_THRESHOLD = 15;
const MAX_ROW_THRESHOLD = 40;
function computeRowThreshold(rootNode) {
    const frameHeight = rootNode.absoluteBoundingBox?.height ?? 800;
    return Math.max(MIN_ROW_THRESHOLD, Math.min(MAX_ROW_THRESHOLD, Math.round(frameHeight * 0.025)));
}
// ─── Deduplication helper ────────────────────────────────────────────────
function isDescendantOf(potentialChild, potentialParent) {
    if (!potentialParent.children)
        return false;
    for (const child of potentialParent.children) {
        if (child.id === potentialChild.id)
            return true;
        if (isDescendantOf(potentialChild, child))
            return true;
    }
    return false;
}
function deduplicateElements(elements) {
    const deduped = [];
    for (const el of elements) {
        // If this element's node is a descendant of another collected element's node,
        // skip it — keep only the outermost interactive ancestor
        const isChildOfAnother = elements.some((other) => other.node.id !== el.node.id && isDescendantOf(el.node, other.node));
        if (!isChildOfAnother) {
            deduped.push(el);
        }
    }
    return deduped;
}
function collectAnnotatableElements(root, requestedTypes) {
    _annotateRootNode = root;
    const rowThreshold = computeRowThreshold(root);
    const elements = [];
    const allNodes = [];
    flattenAll(root, allNodes);
    for (const node of allNodes) {
        if (!node.absoluteBoundingBox)
            continue;
        // Heading check
        if (requestedTypes.includes("heading") &&
            isHeading(node)) {
            const level = estimateHeadingLevel(node);
            elements.push({
                node,
                type: "heading",
                role: `h${level}`,
                label: findTextContent(node) || node.name,
                headingLevel: level,
            });
            continue;
        }
        // Landmark check
        if (requestedTypes.includes("landmark")) {
            const lm = inferLandmark(node);
            if (lm) {
                elements.push({
                    node,
                    type: "landmark",
                    role: lm.role,
                    label: lm.label,
                    landmarkElement: inferLandmarkElement(lm.role),
                });
            }
        }
        // Interactive element check
        if (isInteractive(node)) {
            const role = inferRole(node) || (node.type === "TEXT" ? "link" : "button");
            const annotationType = (0, a11y_annotation_kit_js_1.roleToAnnotationType)(role);
            if (annotationType && requestedTypes.includes(annotationType)) {
                const label = findTextContent(node) || cleanNodeName(node.name) || node.name;
                elements.push({
                    node,
                    type: annotationType,
                    role,
                    label,
                    inputType: annotationType === "input" ? (0, a11y_annotation_kit_js_1.inferInputType)(node.name) : undefined,
                });
            }
            // Focus order and reading order include ALL interactive elements
            if (requestedTypes.includes("focus-order")) {
                const label = findTextContent(node) || cleanNodeName(node.name) || node.name;
                if (!annotationType || !requestedTypes.includes(annotationType)) {
                    elements.push({
                        node,
                        type: "focus-order",
                        role: role,
                        label,
                    });
                }
            }
        }
        // Reading order includes all visible text + interactive elements
        if (requestedTypes.includes("reading-order") &&
            node.type === "TEXT" &&
            node.characters &&
            node.characters.trim().length > 0) {
            elements.push({
                node,
                type: "reading-order",
                role: isHeading(node) ? `h${estimateHeadingLevel(node)}` : "text",
                label: node.characters.trim(),
            });
        }
    }
    // Deduplicate parent-child overlaps
    const deduped = deduplicateElements(elements);
    // Sort by visual position (top-to-bottom, left-to-right)
    deduped.sort((a, b) => {
        const ay = a.node.absoluteBoundingBox.y;
        const by = b.node.absoluteBoundingBox.y;
        if (Math.abs(ay - by) <= rowThreshold) {
            return a.node.absoluteBoundingBox.x - b.node.absoluteBoundingBox.x;
        }
        return ay - by;
    });
    return deduped;
}
function flattenAll(node, acc) {
    acc.push(node);
    if (node.children) {
        for (const child of node.children)
            flattenAll(child, acc);
    }
}
function inferLandmarkElement(role) {
    switch (role) {
        case "navigation":
            return "<nav>";
        case "banner":
            return "<header>";
        case "contentinfo":
            return "<footer>";
        case "complementary":
            return "<aside>";
        case "main":
            return "<main>";
        case "form":
            return "<form>";
        case "search":
            return "<search>";
        default:
            return "<div>";
    }
}
// ─── Build ARIA note for table ────────────────────────────────────────────
function buildAriaNote(el) {
    const role = el.role;
    const label = el.label;
    switch (el.type) {
        case "focus-order":
        case "button":
            if (role === "button")
                return `role="button"`;
            if (role === "link")
                return `role="link"`;
            if (role === "tab")
                return `role="tab"`;
            return `aria-label="${label}"`;
        case "input": {
            const inputType = el.inputType || "text";
            if (inputType === "checkbox")
                return `role="checkbox"`;
            if (inputType === "radio")
                return `role="radio"`;
            return `aria-label="${label}"`;
        }
        case "link":
            return `role="link"`;
        case "heading":
            return `aria-level="${el.headingLevel || 2}"`;
        case "landmark":
            return `role="${role}"`;
        case "reading-order":
            return role.startsWith("h") ? `aria-level="${role.slice(1)}"` : "";
        default:
            return `aria-label="${label}"`;
    }
}
// ─── Build Implementation Notes ───────────────────────────────────────────
function buildImplementationNotes(elements) {
    const notes = [];
    const count = elements.length;
    const roles = new Set(elements.map((e) => e.role));
    notes.push("Focus ring must be visible (2px solid, 3:1 contrast ratio minimum)");
    notes.push(`Tab moves forward through items 1\u2192${count}; Shift+Tab moves backward`);
    if (roles.has("checkbox")) {
        notes.push("Checkboxes toggle with Space key");
    }
    if (roles.has("button")) {
        const buttonIdxs = elements
            .map((e, i) => (e.role === "button" ? i + 1 : -1))
            .filter((i) => i > 0);
        if (buttonIdxs.length > 0) {
            notes.push(`Buttons (#${buttonIdxs.join(", #")}) activate with Enter or Space`);
        }
    }
    if (roles.has("link")) {
        const linkIdxs = elements
            .map((e, i) => (e.role === "link" ? i + 1 : -1))
            .filter((i) => i > 0);
        if (linkIdxs.length > 0) {
            notes.push(`Links (#${linkIdxs.join(", #")}) activate with Enter`);
        }
    }
    if (roles.has("textbox") || roles.has("searchbox")) {
        notes.push("Text inputs are focusable via Tab; ensure visible labels or aria-label");
    }
    if (roles.has("radio")) {
        notes.push("Radio buttons navigate within group using Arrow keys");
    }
    if (roles.has("spinbutton")) {
        notes.push("Spinbuttons adjust with Arrow Up/Down; announce current value");
    }
    if (roles.has("switch")) {
        notes.push("Toggle switches activate with Space key");
    }
    if (roles.has("listbox")) {
        notes.push("Dropdowns/listboxes navigate options with Arrow keys");
    }
    if (roles.has("tab")) {
        notes.push("Tabs switch with Arrow Left/Right; show associated panel");
    }
    if (count > 5) {
        notes.push("Skip navigation link recommended before item #1");
    }
    return notes;
}
// ─── Keyboard support helper ─────────────────────────────────────────────
function getKeyboardSupport(role) {
    switch (role) {
        case "button":
            return "Enter or Space to activate";
        case "link":
            return "Enter to follow link";
        case "textbox":
        case "searchbox":
            return "Focusable via Tab; editable";
        case "checkbox":
            return "Space to toggle";
        case "radio":
            return "Arrow keys to move within group";
        case "switch":
            return "Space to toggle";
        case "listbox":
            return "Arrow keys to navigate options";
        case "slider":
            return "Arrow keys to adjust value";
        case "spinbutton":
            return "Arrow Up/Down to adjust";
        case "tab":
            return "Arrow Left/Right to switch tabs";
        default:
            return "Focusable via Tab";
    }
}
// ─── Main Handler ──────────────────────────────────────────────────────────
async function a11yAnnotateHandler(args) {
    const { nodeId, annotationType, } = args;
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    // 1. Retrieve node tree
    const treeScript = `
    function serialize(n, depth) {
      if (depth > 12) return null;
      var fills = [];
      try {
        var rawFills = n.fills || [];
        for (var i = 0; i < rawFills.length; i++) {
          var f = rawFills[i];
          fills.push({
            type: f.type,
            color: f.color ? { r: f.color.r, g: f.color.g, b: f.color.b, a: f.color.a } : null,
            opacity: f.opacity || 1,
          });
        }
      } catch(e) {}
      var kids = [];
      var rawChildren = n.children || [];
      for (var j = 0; j < rawChildren.length; j++) {
        var child = serialize(rawChildren[j], depth + 1);
        if (child) kids.push(child);
      }
      var strokes = [];
      try {
        var rawStrokes = n.strokes || [];
        for (var s = 0; s < rawStrokes.length; s++) {
          var st = rawStrokes[s];
          strokes.push({
            type: st.type,
            color: st.color ? { r: st.color.r, g: st.color.g, b: st.color.b, a: st.color.a } : null,
            opacity: st.opacity || 1,
          });
        }
      } catch(e) {}
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        width: n.width || null,
        height: n.height || null,
        absoluteBoundingBox: n.absoluteBoundingBox || null,
        characters: n.characters || null,
        style: n.style || null,
        fills: fills,
        strokes: strokes,
        children: kids,
      };
    }
    var root = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
    if (!root) throw new Error("Node not found: " + ${JSON.stringify(nodeId)});
    return serialize(root, 0);
  `;
    const treeResult = await bridge.execute(treeScript);
    if (!treeResult.success) {
        throw new Error(`a11yAnnotateHandler: could not retrieve node tree — ${treeResult.error}`);
    }
    const rootNode = treeResult.result;
    // Set module-level root for navigation context lookups
    _annotateRootNode = rootNode;
    // 2. Determine which annotation types to generate
    const ALL_TYPES = [
        "focus-order",
        "reading-order",
        "input",
        "landmark",
        "heading",
        "link",
        "button",
    ];
    const requestedTypes = annotationType === "all" ? ALL_TYPES : [annotationType];
    // For focus-order, we want ALL interactive elements regardless of sub-type
    if (annotationType === "focus-order" && !requestedTypes.includes("input")) {
        requestedTypes.push("input", "button", "link");
    }
    // 3. Collect annotatable elements
    const allElements = collectAnnotatableElements(rootNode, requestedTypes);
    // For focus-order: merge all interactive into a single focus-order list
    let elements;
    if (annotationType === "focus-order") {
        // Re-collect with just focus-order to get all interactive elements in one list
        elements = collectFocusOrderElements(rootNode);
    }
    else {
        elements = allElements;
    }
    if (elements.length === 0) {
        return {
            pageId: "",
            annotationCount: 0,
            types: requestedTypes,
            summary: "No annotatable elements found in the selected frame.",
        };
    }
    // 4. Build markers, table rows, and implementation notes
    const markers = [];
    const tableRows = [];
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const bbox = el.node.absoluteBoundingBox;
        const num = i + 1;
        markers.push({
            number: num,
            elementX: bbox.x,
            elementY: bbox.y,
            elementW: bbox.width,
            elementH: bbox.height,
        });
        // Determine the display role for the table
        let displayRole = el.role;
        if (el.type === "input" && el.inputType) {
            displayRole = el.inputType;
        }
        tableRows.push({
            number: num,
            element: truncateLabel(el.label, 40),
            role: displayRole,
            ariaNote: buildAriaNote(el),
        });
    }
    const implNotes = buildImplementationNotes(elements);
    // 5. Render the annotation page
    const { pageId } = await (0, a11y_annotate_renderer_js_1.renderAnnotationPage)(bridge, {
        sourceNodeId: nodeId,
        frameName: rootNode.name,
        markers,
        tableRows,
        implNotes,
        annotationType: annotationType,
    });
    // 6. Log action
    const renderedTypes = annotationType === "all"
        ? ALL_TYPES.map(t => `${t}`)
        : [annotationType];
    await decision_log_js_1.decisionLog.log({
        tool: "figma_a11y_annotate",
        nodeIds: [nodeId],
        rationale: `Created Keyboard Focus Order page for "${rootNode.name}" with ${elements.length} annotated elements.`,
        reversible: false,
        metadata: {
            pageId,
            annotationCount: elements.length,
            types: renderedTypes,
        },
    });
    return {
        pageId,
        annotationCount: elements.length,
        types: renderedTypes,
        summary: `Created "Keyboard Focus Order — ${rootNode.name}" page with ${elements.length} numbered markers and Tab Order Sequence table.`,
    };
}
// ─── Focus Order: collect all interactive elements in tab order ────────────
function collectFocusOrderElements(root) {
    _annotateRootNode = root;
    const rowThreshold = computeRowThreshold(root);
    const elements = [];
    const allNodes = [];
    flattenAll(root, allNodes);
    for (const node of allNodes) {
        if (!node.absoluteBoundingBox)
            continue;
        if (!isInteractive(node))
            continue;
        const role = inferRole(node) || (node.type === "TEXT" ? "link" : "button");
        const label = findTextContent(node) || cleanNodeName(node.name) || node.name;
        const annotationType = (0, a11y_annotation_kit_js_1.roleToAnnotationType)(role);
        elements.push({
            node,
            type: annotationType || "focus-order",
            role,
            label,
            inputType: annotationType === "input" ? (0, a11y_annotation_kit_js_1.inferInputType)(node.name) : undefined,
        });
    }
    // Deduplicate parent-child overlaps
    const deduped = deduplicateElements(elements);
    // Sort by visual position (top-to-bottom, left-to-right)
    deduped.sort((a, b) => {
        const ay = a.node.absoluteBoundingBox.y;
        const by = b.node.absoluteBoundingBox.y;
        if (Math.abs(ay - by) <= rowThreshold) {
            return a.node.absoluteBoundingBox.x - b.node.absoluteBoundingBox.x;
        }
        return ay - by;
    });
    return deduped;
}
function truncateLabel(text, maxLen) {
    if (text.length <= maxLen)
        return text;
    return text.slice(0, maxLen - 3) + "...";
}
//# sourceMappingURL=a11y-annotate-handler.js.map