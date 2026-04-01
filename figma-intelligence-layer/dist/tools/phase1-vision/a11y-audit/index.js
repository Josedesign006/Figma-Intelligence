"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.a11yAuditHandler = a11yAuditHandler;
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
const token_utils_js_1 = require("../../../shared/token-utils.js");
const wcag_checker_js_1 = require("./wcag-checker.js");
const vpat_report_js_1 = require("./vpat-report.js");
const vpat_figma_page_js_1 = require("./vpat-figma-page.js");
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const MIN_TOUCH_TARGET = 44;
const CB_PROFILES = [
    "protanopia",
    "deuteranopia",
    "tritanopia",
    "achromatopsia",
];
// ─────────────────────────────────────────────────────────────────────────────
// Node tree helpers
// ─────────────────────────────────────────────────────────────────────────────
function collectNodes(node, predicate, acc = []) {
    if (predicate(node))
        acc.push(node);
    if (node.children) {
        for (const child of node.children) {
            collectNodes(child, predicate, acc);
        }
    }
    return acc;
}
// ─────────────────────────────────────────────────────────────────────────────
// Design context extraction for rich VPAT remarks
// ─────────────────────────────────────────────────────────────────────────────
const NAV_PATTERNS = /\b(nav|navigation|header|top[-_ ]?bar|app[-_ ]?bar|navbar|menu)\b/i;
const FORM_PATTERNS = /\b(input|field|textbox|text[-_ ]?field|checkbox|radio|toggle|select|dropdown|form)\b/i;
const HEADING_MIN_SIZE = 20;
const HEADING_MIN_WEIGHT = 700;
function buildDesignContext(rootNode, allNodes, textNodes, interactiveNodes, componentSetNodes, frameNodes) {
    // Detect landmarks
    const landmarkNames = [];
    for (const node of allNodes) {
        if (NAV_PATTERNS.test(node.name)) {
            const clean = node.name.replace(/[-_/]/g, " ").trim();
            if (!landmarkNames.includes(clean))
                landmarkNames.push(clean);
        }
    }
    // Detect images/vectors
    const imageNodes = allNodes.filter((n) => n.type === "VECTOR" || n.type === "BOOLEAN_OPERATION" ||
        (n.fills?.some((f) => f.type === "IMAGE")));
    // Detect headings
    const headingTexts = [];
    for (const node of textNodes) {
        const fontSize = node.style?.fontSize ?? 16;
        const fontWeight = node.style?.fontWeight ?? 400;
        if ((fontSize >= HEADING_MIN_SIZE || fontWeight >= HEADING_MIN_WEIGHT) && node.characters) {
            const text = node.characters.trim();
            if (text.length > 0 && text.length < 100 && headingTexts.length < 10) {
                headingTexts.push(text);
            }
        }
    }
    // Detect form inputs
    const hasFormInputs = interactiveNodes.some((n) => FORM_PATTERNS.test(n.name));
    // Detect navigation
    const hasNavigation = allNodes.some((n) => NAV_PATTERNS.test(n.name));
    // Detect auto-layout
    const hasAutoLayout = frameNodes.some((n) => n.layoutMode === "HORIZONTAL" || n.layoutMode === "VERTICAL");
    // Interactive labels (first N)
    const interactiveLabels = [];
    for (const node of interactiveNodes) {
        let label = "";
        // Try to get text content
        if (node.characters) {
            label = node.characters.trim();
        }
        else if (node.children) {
            const textChild = findFirstText(node);
            if (textChild)
                label = textChild;
        }
        if (!label)
            label = node.name.replace(/[-_/]/g, " ").trim();
        if (label && label.length < 60 && interactiveLabels.length < 15) {
            interactiveLabels.push(label);
        }
    }
    // Interactive breakdown by inferred type
    const interactiveBreakdown = {};
    for (const node of interactiveNodes) {
        const name = node.name.toLowerCase();
        let type = "interactive element";
        if (/button|btn|cta/i.test(name))
            type = "button";
        else if (/link|anchor/i.test(name))
            type = "link";
        else if (/input|field|textbox/i.test(name))
            type = "text input";
        else if (/checkbox/i.test(name))
            type = "checkbox";
        else if (/radio/i.test(name))
            type = "radio";
        else if (/toggle|switch/i.test(name))
            type = "toggle";
        else if (/select|dropdown/i.test(name))
            type = "dropdown";
        else if (/search/i.test(name))
            type = "search";
        else if (/tab/i.test(name))
            type = "tab";
        else if (/menu/i.test(name))
            type = "menu";
        else if (/modal|dialog/i.test(name))
            type = "modal";
        else if (/slider|range/i.test(name))
            type = "slider";
        interactiveBreakdown[type] = (interactiveBreakdown[type] || 0) + 1;
    }
    // Sample texts
    const sampleTexts = [];
    for (const node of textNodes) {
        if (node.characters && node.characters.trim().length > 2 && sampleTexts.length < 8) {
            sampleTexts.push(node.characters.trim().slice(0, 80));
        }
    }
    return {
        frameName: rootNode.name,
        totalNodes: allNodes.length,
        textNodeCount: textNodes.length,
        interactiveCount: interactiveNodes.length,
        imageCount: imageNodes.length,
        componentSetCount: componentSetNodes.length,
        frameCount: frameNodes.length,
        landmarkNames,
        interactiveLabels,
        hasFormInputs,
        hasNavigation,
        hasImages: imageNodes.length > 0,
        hasHeadings: headingTexts.length > 0,
        headingTexts,
        hasAutoLayout,
        sampleTexts,
        interactiveBreakdown,
    };
}
function findFirstText(node) {
    if (node.type === "TEXT" && node.characters)
        return node.characters.trim();
    if (node.children) {
        for (const child of node.children) {
            const text = findFirstText(child);
            if (text)
                return text;
        }
    }
    return null;
}
function extractSolidColor(node) {
    if (!node.fills || node.fills.length === 0)
        return null;
    const solid = node.fills.find((f) => f.type === "SOLID" && f.color);
    return solid?.color ?? null;
}
/** Walk up the node tree to find the nearest background color. */
function findParentBgColor(nodeId, allNodes) {
    // Build a parent lookup from the flat list
    function findParent(id, nodes) {
        for (const n of nodes) {
            if (n.children?.some((c) => c.id === id))
                return n;
            if (n.children) {
                const found = findParent(id, n.children);
                if (found)
                    return found;
            }
        }
        return null;
    }
    let current = nodeId;
    for (let depth = 0; depth < 12; depth++) {
        const parent = findParent(current, allNodes);
        if (!parent)
            break;
        const color = extractSolidColor(parent);
        if (color)
            return color;
        current = parent.id;
    }
    // Default to white if no bg found
    return { r: 1, g: 1, b: 1, a: 1 };
}
// ─────────────────────────────────────────────────────────────────────────────
// Audit checks
// ─────────────────────────────────────────────────────────────────────────────
function checkTextContrast(textNode, allNodes, wcagLevel, includeColorBlindSim) {
    const fgColor = extractSolidColor(textNode);
    if (!fgColor)
        return null;
    const bgColor = findParentBgColor(textNode.id, allNodes);
    if (!bgColor)
        return null;
    const fgHex = (0, token_utils_js_1.figmaRgbaToHex)(fgColor.r, fgColor.g, fgColor.b);
    const bgHex = (0, token_utils_js_1.figmaRgbaToHex)(bgColor.r, bgColor.g, bgColor.b);
    const fontSize = textNode.style?.fontSize ?? 16;
    const fontWeight = textNode.style?.fontWeight ?? 400;
    const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
    const ratio = (0, token_utils_js_1.computeContrastRatio)(fgHex, bgHex);
    // WCAG A uses AA thresholds for contrast; AAA uses higher thresholds
    const effectiveLevel = wcagLevel === "AAA" ? "AAA" : "AA";
    const passes = (0, token_utils_js_1.meetsWCAG)(ratio, effectiveLevel, isLargeText);
    if (passes)
        return null;
    const issue = {
        severity: ratio < 3.0 ? "error" : "warning",
        criterion: wcagLevel === "AAA" ? "1.4.6 Contrast (Enhanced)" : "1.4.3 Contrast (Minimum)",
        nodeId: textNode.id,
        nodeName: textNode.name,
        issue: `Text contrast ratio ${ratio.toFixed(2)}:1 is below the ${effectiveLevel} threshold (${isLargeText ? (effectiveLevel === "AAA" ? "4.5" : "3.0") : (effectiveLevel === "AAA" ? "7.0" : "4.5")}:1) for ${isLargeText ? "large" : "normal"} text`,
        currentValue: `${ratio.toFixed(2)}:1`,
        suggestedFix: `Increase contrast to at least ${isLargeText ? (effectiveLevel === "AAA" ? "4.5" : "3.0") : (effectiveLevel === "AAA" ? "7.0" : "4.5")}:1 by darkening text or lightening background`,
        autoFixAvailable: true,
    };
    if (includeColorBlindSim) {
        issue.colorBlindSims = CB_PROFILES.map((profile) => {
            const simFg = (0, token_utils_js_1.simulateColorBlindness)(fgHex, profile);
            const simBg = (0, token_utils_js_1.simulateColorBlindness)(bgHex, profile);
            const simRatio = (0, token_utils_js_1.computeContrastRatio)(simFg, simBg);
            const simPasses = (0, token_utils_js_1.meetsWCAG)(simRatio, effectiveLevel, isLargeText);
            return { profile, contrastRatio: simRatio, passes: simPasses };
        });
    }
    return issue;
}
function checkTouchTarget(node) {
    if (!node.absoluteBoundingBox)
        return null;
    if (!node.width || !node.height)
        return null;
    const w = node.width;
    const h = node.height;
    if (w < MIN_TOUCH_TARGET || h < MIN_TOUCH_TARGET) {
        return {
            severity: "error",
            criterion: "2.5.5 Target Size",
            nodeId: node.id,
            nodeName: node.name,
            issue: `Interactive element is ${w}×${h}px, below the minimum 44×44px touch target`,
            currentValue: `${w}×${h}px`,
            suggestedFix: `Resize to at least ${MIN_TOUCH_TARGET}×${MIN_TOUCH_TARGET}px or add invisible padding`,
            autoFixAvailable: true,
        };
    }
    return null;
}
function checkFocusState(node) {
    if (node.type !== "COMPONENT_SET")
        return null;
    const variantProps = node.variantProperties ?? {};
    const hasFocusVariant = Object.values(variantProps).some((v) => typeof v === "string" && v.toLowerCase().includes("focus"));
    const childFocus = node.children?.some((c) => c.name.toLowerCase().includes("focus") ||
        Object.values(c.variantProperties ?? {}).some((v) => typeof v === "string" && v.toLowerCase().includes("focus")));
    if (!hasFocusVariant && !childFocus) {
        return {
            severity: "warning",
            criterion: "2.4.7 Focus Visible",
            nodeId: node.id,
            nodeName: node.name,
            issue: "Component set has no focus state variant",
            currentValue: "No focus variant",
            suggestedFix: 'Add a "State=Focus" variant with a visible 2px focus ring',
            autoFixAvailable: false,
        };
    }
    return null;
}
function checkFixedHeightTextContainer(node) {
    if (!node.children)
        return null;
    const hasTextChild = node.children.some((c) => c.type === "TEXT");
    if (!hasTextChild)
        return null;
    const isFixedHeight = node.primaryAxisSizingMode === "FIXED" ||
        (node.height !== undefined && node.primaryAxisSizingMode !== "AUTO");
    if (isFixedHeight && node.layoutMode && node.layoutMode !== "NONE") {
        return {
            severity: "warning",
            criterion: "1.4.4 Resize Text",
            nodeId: node.id,
            nodeName: node.name,
            issue: "Text container has fixed height which may clip text when font size is increased",
            currentValue: `height: ${node.height}px (fixed)`,
            suggestedFix: 'Set vertical sizing to "Hug contents" (AUTO) so text can reflow',
            autoFixAvailable: true,
        };
    }
    return null;
}
// ─────────────────────────────────────────────────────────────────────────────
// Inline annotation script
// ─────────────────────────────────────────────────────────────────────────────
function buildAnnotationScript(issues) {
    return `
(async () => {
  const issues = ${JSON.stringify(issues)};
  const created = [];
  const severityColors = {
    error:      { r: 0.96, g: 0.26, b: 0.21 },
    warning:    { r: 1,    g: 0.76, b: 0    },
    suggestion: { r: 0.13, g: 0.59, b: 0.95 },
  };

  for (const issue of issues) {
    const target = await figma.getNodeByIdAsync(issue.nodeId);
    if (!target) continue;

    const sticky = figma.createSticky();
    sticky.text.characters =
      "[" + issue.criterion + "] " + issue.severity.toUpperCase() + "\\n" +
      issue.issue + "\\nFix: " + issue.suggestedFix;
    const color = severityColors[issue.severity] || severityColors.suggestion;
    sticky.fills = [{ type: "SOLID", color }];

    const bbox = target.absoluteBoundingBox;
    if (bbox) {
      sticky.x = bbox.x + bbox.width + 16;
      sticky.y = bbox.y;
    }
    figma.currentPage.appendChild(sticky);
    created.push(sticky.id);
  }

  return { count: created.length, ids: created };
})();
`;
}
// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
async function a11yAuditHandler(args) {
    const { nodeId, wcagLevel, includeColorBlindSim = false, outputFormat, autoSuggestFixes = false, reportFormat = "vpat", } = args;
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    // 1. Retrieve full node tree for the target node
    const treeScript = `
    function serialize(n, depth) {
      if (depth > 8) return null;
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
      } catch(e) { /* mixed fills */ }
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
      } catch(e) { /* mixed strokes */ }
      var effects = [];
      try {
        var rawEffects = n.effects || [];
        for (var ef = 0; ef < rawEffects.length; ef++) {
          var eff = rawEffects[ef];
          effects.push({
            type: eff.type,
            color: eff.color ? { r: eff.color.r, g: eff.color.g, b: eff.color.b, a: eff.color.a } : null,
            visible: eff.visible !== false,
          });
        }
      } catch(e) { /* effects */ }
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        width: n.width || null,
        height: n.height || null,
        layoutMode: n.layoutMode || null,
        primaryAxisSizingMode: n.primaryAxisSizingMode || null,
        counterAxisSizingMode: n.counterAxisSizingMode || null,
        variantProperties: n.variantProperties || null,
        absoluteBoundingBox: n.absoluteBoundingBox || null,
        characters: n.characters || null,
        description: n.description || null,
        style: n.style || null,
        fills: fills,
        strokes: strokes,
        effects: effects,
        children: kids,
      };
    }
    var root = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
    if (!root) throw new Error("Node not found: " + ${JSON.stringify(nodeId)});
    return serialize(root, 0);
  `;
    const treeResult = await bridge.execute(treeScript);
    if (!treeResult.success) {
        throw new Error(`a11yAuditHandler: could not retrieve node tree — ${treeResult.error}`);
    }
    const rootNode = treeResult.result;
    // 2. Collect all relevant node types
    const allNodes = [];
    collectNodes(rootNode, () => true, allNodes);
    const textNodes = allNodes.filter((n) => n.type === "TEXT");
    const interactiveNodes = allNodes.filter((n) => n.type === "INSTANCE" ||
        n.type === "COMPONENT" ||
        (n.name.toLowerCase().includes("button") ||
            n.name.toLowerCase().includes("link") ||
            n.name.toLowerCase().includes("input") ||
            n.name.toLowerCase().includes("checkbox") ||
            n.name.toLowerCase().includes("radio") ||
            n.name.toLowerCase().includes("toggle") ||
            n.name.toLowerCase().includes("select")));
    const componentSetNodes = allNodes.filter((n) => n.type === "COMPONENT_SET");
    const frameNodes = allNodes.filter((n) => n.type === "FRAME" || n.type === "GROUP");
    const issues = [];
    // 3. Text contrast checks
    for (const node of textNodes) {
        const issue = checkTextContrast(node, allNodes, wcagLevel, includeColorBlindSim);
        if (issue)
            issues.push(issue);
    }
    // 4. Touch target size checks (only for WCAG AA and AAA, as 2.5.5 is Level AAA in WCAG 2.1 but commonly applied)
    for (const node of interactiveNodes) {
        const issue = checkTouchTarget(node);
        if (issue) {
            // Level A: skip touch target (not required). AA+: include.
            if (wcagLevel !== "A")
                issues.push(issue);
        }
    }
    // 5. Focus state variant checks
    for (const node of componentSetNodes) {
        const issue = checkFocusState(node);
        if (issue)
            issues.push(issue);
    }
    // 6. Fixed-height text container checks
    for (const node of frameNodes) {
        const issue = checkFixedHeightTextContainer(node);
        if (issue)
            issues.push(issue);
    }
    // ─── New comprehensive checks ─────────────────────────────────────────────
    // SC 1.1.1 Non-text Content (Level A) – heuristic
    for (const node of allNodes) {
        const issue = (0, wcag_checker_js_1.checkNonTextContent)(node, allNodes);
        if (issue)
            issues.push(issue);
    }
    // SC 1.3.1 Info and Relationships (Level A) – heuristic
    issues.push(...(0, wcag_checker_js_1.checkInfoAndRelationships)(textNodes));
    // SC 1.3.2 Meaningful Sequence (Level A) – heuristic
    issues.push(...(0, wcag_checker_js_1.checkMeaningfulSequence)(allNodes));
    // SC 1.4.1 Use of Color (Level A) – heuristic
    issues.push(...(0, wcag_checker_js_1.checkUseOfColor)(componentSetNodes));
    // SC 3.3.1 Error Identification (Level A) – heuristic
    issues.push(...(0, wcag_checker_js_1.checkErrorIdentification)(componentSetNodes));
    // SC 3.3.2 Labels or Instructions (Level A) – heuristic
    issues.push(...(0, wcag_checker_js_1.checkLabelsOrInstructions)(interactiveNodes, allNodes));
    // SC 2.4.3 Focus Order (Level A) – heuristic
    issues.push(...(0, wcag_checker_js_1.checkFocusOrder)(interactiveNodes));
    // SC 2.4.4 Link Purpose (Level A) – heuristic
    issues.push(...(0, wcag_checker_js_1.checkLinkPurpose)(interactiveNodes));
    // SC 4.1.2 Name, Role, Value (Level A) – heuristic
    issues.push(...(0, wcag_checker_js_1.checkNameRoleValue)(interactiveNodes));
    // Level AA+ checks
    if (wcagLevel !== "A") {
        // SC 1.4.11 Non-text Contrast (Level AA) – automated
        for (const node of interactiveNodes) {
            const issue = (0, wcag_checker_js_1.checkNonTextContrast)(node, allNodes);
            if (issue)
                issues.push(issue);
        }
        // SC 1.4.12 Text Spacing (Level AA) – automated
        for (const node of textNodes) {
            const issue = (0, wcag_checker_js_1.checkTextSpacing)(node);
            if (issue)
                issues.push(issue);
        }
        // SC 1.4.10 Reflow (Level AA) – heuristic
        issues.push(...(0, wcag_checker_js_1.checkReflow)(frameNodes));
        // SC 1.4.5 Images of Text (Level AA) – heuristic
        issues.push(...(0, wcag_checker_js_1.checkImagesOfText)(allNodes));
        // SC 1.4.13 Content on Hover (Level AA) – heuristic
        issues.push(...(0, wcag_checker_js_1.checkContentOnHover)(componentSetNodes));
        // SC 2.4.6 Headings and Labels (Level AA) – heuristic
        issues.push(...(0, wcag_checker_js_1.checkHeadingsAndLabels)(frameNodes));
        // SC 2.4.11 Focus Not Obscured (Level AA) – heuristic
        issues.push(...(0, wcag_checker_js_1.checkFocusNotObscured)(componentSetNodes));
        // SC 2.5.8 Target Size Minimum 24px (Level AA) – automated
        for (const node of interactiveNodes) {
            const issue = (0, wcag_checker_js_1.checkTargetSizeMinimum)(node);
            if (issue)
                issues.push(issue);
        }
        // SC 1.3.5 Identify Input Purpose (Level AA) – heuristic
        issues.push(...(0, wcag_checker_js_1.checkIdentifyInputPurpose)(interactiveNodes));
    }
    // 7. Color blind simulation re-run on previously passed text nodes (if requested)
    if (includeColorBlindSim) {
        for (const node of textNodes) {
            const fgColor = extractSolidColor(node);
            if (!fgColor)
                continue;
            const bgColor = findParentBgColor(node.id, allNodes);
            if (!bgColor)
                continue;
            const fgHex = (0, token_utils_js_1.figmaRgbaToHex)(fgColor.r, fgColor.g, fgColor.b);
            const bgHex = (0, token_utils_js_1.figmaRgbaToHex)(bgColor.r, bgColor.g, bgColor.b);
            const fontSize = node.style?.fontSize ?? 16;
            const fontWeight = node.style?.fontWeight ?? 400;
            const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
            const effectiveLevel = wcagLevel === "AAA" ? "AAA" : "AA";
            // Check if any CB profile causes a failure not already caught
            for (const profile of CB_PROFILES) {
                const simFg = (0, token_utils_js_1.simulateColorBlindness)(fgHex, profile);
                const simBg = (0, token_utils_js_1.simulateColorBlindness)(bgHex, profile);
                const simRatio = (0, token_utils_js_1.computeContrastRatio)(simFg, simBg);
                const simPasses = (0, token_utils_js_1.meetsWCAG)(simRatio, effectiveLevel, isLargeText);
                if (!simPasses) {
                    // Only add if not already reported for this node
                    const alreadyReported = issues.some((i) => i.nodeId === node.id && i.criterion.includes("1.4.3"));
                    if (!alreadyReported) {
                        issues.push({
                            severity: "warning",
                            criterion: "1.4.3 Contrast (Minimum) — Color Vision",
                            nodeId: node.id,
                            nodeName: node.name,
                            issue: `Contrast ratio ${simRatio.toFixed(2)}:1 fails under ${profile} simulation`,
                            currentValue: `${simRatio.toFixed(2)}:1 (${profile})`,
                            suggestedFix: "Avoid relying solely on color to convey information; ensure contrast works for all vision types",
                            autoFixAvailable: false,
                            colorBlindSims: [{ profile, contrastRatio: simRatio, passes: simPasses }],
                        });
                    }
                }
            }
        }
    }
    // 8. Statistics
    const totalChecks = textNodes.length +
        (wcagLevel !== "A" ? interactiveNodes.length : 0) +
        componentSetNodes.length +
        frameNodes.length;
    const failed = issues.length;
    const passed = Math.max(0, totalChecks - failed);
    const passRate = totalChecks > 0 ? `${Math.round((passed / totalChecks) * 100)}%` : "100%";
    // 9. Add auto-fix suggestions where applicable
    if (autoSuggestFixes) {
        for (const issue of issues) {
            if (!issue.autoFixAvailable) {
                issue.suggestedFix += " (manual intervention required)";
            }
        }
    }
    // 10. Inline annotations in Figma
    let annotationsAdded = 0;
    if ((outputFormat === "inline" || outputFormat === "both") && issues.length > 0) {
        const annotScript = buildAnnotationScript(issues);
        const annotResult = await bridge.execute(annotScript);
        if (annotResult.success) {
            const data = annotResult.result;
            annotationsAdded = data.count;
        }
    }
    // 11. Log action
    await decision_log_js_1.decisionLog.log({
        tool: "figma_a11y_audit",
        nodeIds: [nodeId],
        rationale: `Accessibility audit at WCAG ${wcagLevel} level. Checked ${totalChecks} elements. Pass rate: ${passRate}. Found ${failed} issues across ${textNodes.length} text nodes, ${interactiveNodes.length} interactive elements, ${componentSetNodes.length} component sets.${includeColorBlindSim ? " Color blind simulation included." : ""}`,
        reversible: false,
        metadata: {
            wcagLevel,
            totalChecks,
            passed,
            failed,
            passRate,
            includeColorBlindSim,
            annotationsAdded,
        },
    });
    // 12. Build design context for rich VPAT remarks
    const designContext = buildDesignContext(rootNode, allNodes, textNodes, interactiveNodes, componentSetNodes, frameNodes);
    // 13. Build VPAT report
    let vpatReport;
    if (reportFormat === "vpat") {
        vpatReport = (0, vpat_report_js_1.buildVPATReport)(wcagLevel, nodeId, rootNode.name, issues, designContext);
        // 13. Render VPAT as a structured Figma page
        try {
            await (0, vpat_figma_page_js_1.renderVPATPage)(bridge, vpatReport);
        }
        catch (err) {
            // Non-fatal — the markdown report is still available
            console.error("VPAT Figma page render failed:", err);
        }
        // In VPAT mode, return the full conformance report as the primary output.
        return {
            nodeId,
            wcagLevel,
            totalChecks: vpatReport.summary.totalCriteria,
            passed: vpatReport.summary.supports,
            failed: vpatReport.summary.doesNotSupport,
            passRate: vpatReport.summary.totalCriteria > 0
                ? `${Math.round(((vpatReport.summary.supports + vpatReport.summary.partiallySupports) /
                    vpatReport.summary.totalCriteria) *
                    100)}%`
                : "100%",
            issues,
            annotationsAdded,
            vpatReport,
        };
    }
    return {
        nodeId,
        wcagLevel,
        totalChecks,
        passed,
        failed,
        passRate,
        issues,
        annotationsAdded,
    };
}
//# sourceMappingURL=index.js.map