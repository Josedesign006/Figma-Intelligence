"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Layout Intelligence
// Analyses a Figma node's container type and recommends (or applies) optimal
// Auto-Layout settings drawn from a built-in container → settings lookup table.
// All spacing values are snapped to the nearest spacing token.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.layoutIntelligenceHandler = layoutIntelligenceHandler;
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
const token_utils_js_1 = require("../../../shared/token-utils.js");
const auto_layout_validator_js_1 = require("../../../shared/auto-layout-validator.js");
// ─── Spacing token name → px value ───────────────────────────────────────────
const SPACE = {
    "--space-xs": 4,
    "--space-sm": 8,
    "--space-md": 16,
    "--space-lg": 24,
    "--space-xl": 32,
    "--space-2xl": 48,
    "--space-3xl": 56,
    "--space-4xl": 64,
};
// ─── Container → Auto-Layout mapping table ────────────────────────────────────
// direction          / primaryAxis (W) / counterAxis (H) / padding token    / gap token
const CONTAINER_SPECS = {
    "navigation bar": {
        direction: "HORIZONTAL",
        primaryAxisSizingMode: "AUTO", // Fill W
        counterAxisSizingMode: "AUTO", // Hug H
        paddingToken: "--space-md",
        gapToken: "--space-md",
        paddingValue: SPACE["--space-md"],
        gapValue: SPACE["--space-md"],
    },
    card: {
        direction: "VERTICAL",
        primaryAxisSizingMode: "AUTO", // Fill W
        counterAxisSizingMode: "AUTO", // Hug H
        paddingToken: "--space-lg",
        gapToken: "--space-lg",
        paddingValue: SPACE["--space-lg"],
        gapValue: SPACE["--space-lg"],
    },
    form: {
        direction: "VERTICAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-md",
        gapToken: "--space-md",
        paddingValue: SPACE["--space-md"],
        gapValue: SPACE["--space-md"],
    },
    button: {
        direction: "HORIZONTAL",
        primaryAxisSizingMode: "AUTO", // Hug W
        counterAxisSizingMode: "AUTO", // Hug H
        paddingToken: "--space-sm",
        gapToken: "--space-sm",
        paddingValue: SPACE["--space-sm"],
        gapValue: SPACE["--space-sm"],
    },
    grid: {
        direction: "WRAP",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-md",
        gapToken: "--space-md",
        paddingValue: SPACE["--space-md"],
        gapValue: SPACE["--space-md"],
    },
    "list item": {
        direction: "HORIZONTAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-sm",
        gapToken: "--space-sm",
        paddingValue: SPACE["--space-sm"],
        gapValue: SPACE["--space-sm"],
    },
    modal: {
        direction: "VERTICAL",
        primaryAxisSizingMode: "FIXED", // Fixed W
        counterAxisSizingMode: "AUTO", // Hug H
        paddingToken: "--space-xl",
        gapToken: "--space-xl",
        paddingValue: SPACE["--space-xl"],
        gapValue: SPACE["--space-xl"],
    },
    section: {
        direction: "VERTICAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-2xl",
        gapToken: "--space-2xl",
        paddingValue: SPACE["--space-2xl"],
        gapValue: SPACE["--space-2xl"],
    },
    // ─── Document layout primitives ───────────────────────────────────────────
    document_page: {
        direction: "VERTICAL",
        primaryAxisSizingMode: "AUTO", // Hug H (page grows with content)
        counterAxisSizingMode: "FIXED", // Fixed W (document width)
        paddingToken: "--space-3xl",
        gapToken: "--space-2xl",
        paddingValue: SPACE["--space-3xl"],
        gapValue: SPACE["--space-2xl"],
    },
    header_block: {
        direction: "VERTICAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-xs",
        gapToken: "--space-sm",
        paddingValue: 0,
        gapValue: SPACE["--space-sm"],
    },
    section_block: {
        direction: "VERTICAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-xs",
        gapToken: "--space-lg",
        paddingValue: 0,
        gapValue: SPACE["--space-lg"],
    },
    toc_row: {
        direction: "HORIZONTAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-xs",
        gapToken: "--space-sm",
        paddingValue: 0,
        gapValue: SPACE["--space-sm"],
    },
    paragraph_group: {
        direction: "VERTICAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-xs",
        gapToken: "--space-sm",
        paddingValue: 0,
        gapValue: SPACE["--space-sm"],
    },
    divider: {
        direction: "HORIZONTAL",
        primaryAxisSizingMode: "FIXED",
        counterAxisSizingMode: "FIXED",
        paddingToken: "--space-xs",
        gapToken: "--space-xs",
        paddingValue: 0,
        gapValue: 0,
    },
    footer_block: {
        direction: "HORIZONTAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-xs",
        gapToken: "--space-md",
        paddingValue: 0,
        gapValue: SPACE["--space-md"],
    },
    table_block: {
        direction: "VERTICAL",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        paddingToken: "--space-xs",
        gapToken: "--space-xs",
        paddingValue: 0,
        gapValue: 0,
    },
};
// ─── Container-kind detection heuristics ─────────────────────────────────────
function detectContainerKind(node) {
    const name = node.name.toLowerCase();
    const childCount = node.children?.length ?? 0;
    const w = node.absoluteBoundingBox?.width ?? 0;
    const h = node.absoluteBoundingBox?.height ?? 0;
    const aspectRatio = h > 0 ? w / h : 1;
    // Document layout primitives (highest priority — checked first)
    if (/doc(ument)?[\s_-]?page|spec[\s_-]?page|guide(line)?[\s_-]?page/.test(name))
        return "document_page";
    if (/header[\s_-]?block|doc[\s_-]?header|page[\s_-]?title[\s_-]?block/.test(name))
        return "header_block";
    if (/section[\s_-]?block|content[\s_-]?section/.test(name))
        return "section_block";
    if (/toc[\s_-]?row|table[\s_-]?of[\s_-]?contents/.test(name))
        return "toc_row";
    if (/paragraph[\s_-]?group|body[\s_-]?text[\s_-]?block|text[\s_-]?block/.test(name))
        return "paragraph_group";
    if (/\bdivider\b|\bseparator\b|\bhr\b/.test(name))
        return "divider";
    if (/footer[\s_-]?block|doc[\s_-]?footer/.test(name))
        return "footer_block";
    if (/table[\s_-]?block|spec[\s_-]?table|data[\s_-]?table/.test(name))
        return "table_block";
    // Name-based detection for UI containers
    if (/nav(igation)?\s*(bar)?|navbar|top\s*bar|header\s*bar/.test(name))
        return "navigation bar";
    if (/\bmodal\b|\bdialog\b|\bdrawer\b|\bpopup\b/.test(name))
        return "modal";
    if (/\bcard\b|\btile\b|\bpanel\b/.test(name))
        return "card";
    if (/\bform\b|\binput\s*group\b/.test(name))
        return "form";
    if (/\bbtn\b|\bbutton\b|\bcta\b/.test(name))
        return "button";
    if (/\bgrid\b|\bmasonry\b|\bgallery\b/.test(name))
        return "grid";
    if (/\blist\s*item\b|\brow\b|\bcell\b/.test(name))
        return "list item";
    if (/\bsection\b|\bhero\b|\bfooter\b|\bpage\b/.test(name))
        return "section";
    // Geometry-based fallback: document page (wide, vertical, many children)
    if (w >= 1000 && w <= 1400 && node.layoutMode === "VERTICAL" && childCount > 5)
        return "document_page";
    // Geometry-based fallback for UI containers
    if (w > 0 && h <= 80 && aspectRatio > 5)
        return "navigation bar"; // very wide & short
    if (w <= 120 && h <= 60 && childCount <= 3)
        return "button"; // small & few children
    if (childCount > 6 && node.layoutMode === "NONE")
        return "grid"; // many children, no layout
    if (h > 300 && w < 600 && childCount > 2)
        return "modal"; // tall-ish popup sized box
    if (childCount > 0 && node.layoutMode === "VERTICAL")
        return "card";
    if (aspectRatio > 4 && childCount <= 5)
        return "list item";
    return "unknown";
}
// ─── Diff builder ─────────────────────────────────────────────────────────────
function buildDiff(node, spec) {
    const diffs = [];
    const currentLayoutMode = node.layoutMode ?? "NONE";
    const targetLayoutMode = spec.direction === "WRAP" ? "HORIZONTAL" : spec.direction;
    if (currentLayoutMode !== targetLayoutMode) {
        diffs.push({ property: "layoutMode", before: currentLayoutMode, after: targetLayoutMode });
    }
    // WRAP is represented via layoutWrap which we handle separately
    if (spec.direction === "WRAP") {
        diffs.push({ property: "layoutWrap", before: "NO_WRAP", after: "WRAP" });
    }
    const spacingFields = [
        "paddingLeft",
        "paddingRight",
        "paddingTop",
        "paddingBottom",
    ];
    for (const field of spacingFields) {
        const current = node[field];
        const snapped = (0, token_utils_js_1.snapToSpacingToken)(spec.paddingValue);
        if (current !== snapped.tokenValue) {
            diffs.push({
                property: field,
                before: current,
                after: snapped.tokenValue,
                tokenName: snapped.tokenName,
            });
        }
    }
    const currentGap = node.itemSpacing ?? 0;
    const snappedGap = (0, token_utils_js_1.snapToSpacingToken)(spec.gapValue);
    if (currentGap !== snappedGap.tokenValue) {
        diffs.push({
            property: "itemSpacing",
            before: currentGap,
            after: snappedGap.tokenValue,
            tokenName: snappedGap.tokenName,
        });
    }
    if (node.primaryAxisSizingMode !== spec.primaryAxisSizingMode) {
        diffs.push({
            property: "primaryAxisSizingMode",
            before: node.primaryAxisSizingMode,
            after: spec.primaryAxisSizingMode,
        });
    }
    if (node.counterAxisSizingMode !== spec.counterAxisSizingMode) {
        diffs.push({
            property: "counterAxisSizingMode",
            before: node.counterAxisSizingMode,
            after: spec.counterAxisSizingMode,
        });
    }
    return diffs;
}
// ─── Figma script builder ─────────────────────────────────────────────────────
function buildApplyScript(nodeId, spec, paddingPx, gapPx) {
    const layoutMode = spec.direction === "WRAP" ? "HORIZONTAL" : spec.direction;
    const wrapLine = spec.direction === "WRAP"
        ? `node.layoutWrap = 'WRAP';`
        : `node.layoutWrap = 'NO_WRAP';`;
    return `
    const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
    if (!node) throw new Error('Node not found: ${nodeId}');
    if (!('layoutMode' in node)) throw new Error('Node does not support Auto Layout');
    node.layoutMode = ${JSON.stringify(layoutMode)};
    ${wrapLine}
    node.primaryAxisSizingMode = ${JSON.stringify(spec.primaryAxisSizingMode)};
    node.counterAxisSizingMode = ${JSON.stringify(spec.counterAxisSizingMode)};
    node.paddingLeft   = ${paddingPx};
    node.paddingRight  = ${paddingPx};
    node.paddingTop    = ${paddingPx};
    node.paddingBottom = ${paddingPx};
    node.itemSpacing   = ${gapPx};

    // ── Deep recursive FILL enforcement ──
    function isAL(n) { return n.layoutMode === 'HORIZONTAL' || n.layoutMode === 'VERTICAL'; }
    function isDocContainer(name) {
      return /section|header|footer|table|paragraph|toc|block|overview|anatomy|content|divider/i.test(name);
    }
    function enforceChildFill(parent, depth) {
      if (depth > 20 || !('children' in parent)) return;
      const dir = parent.layoutMode;
      const parentIsAL = isAL(parent);
      if (!parentIsAL) return;

      for (const child of parent.children) {
        if (!('layoutAlign' in child)) continue;
        const cName = (child.name || '').toLowerCase();
        const cType = child.type;

        // Skip small fixed elements (icons ≤48px) unless they're semantic containers
        const isSmallFixed = child.width && child.height && child.width <= 48 && child.height <= 48;
        if (isSmallFixed && !isDocContainer(cName) &&
            !/input|field|button|btn|bar|card|container|wrapper|form/.test(cName)) {
          continue;
        }

        if (dir === 'VERTICAL') {
          // VERTICAL parent → children fill width
          if (cType === 'FRAME' || cType === 'COMPONENT' || cType === 'INSTANCE' ||
              cType === 'RECTANGLE' || cType === 'GROUP' || cType === 'TEXT') {
            child.layoutAlign = 'STRETCH';
            if ('layoutSizingHorizontal' in child) child.layoutSizingHorizontal = 'FILL';
          }
        } else if (dir === 'HORIZONTAL') {
          // HORIZONTAL parent → grow content children, fill height on frames
          if (cType === 'FRAME' || cType === 'COMPONENT' || cType === 'INSTANCE') {
            if (/input|field|search|content|main|body|spacer/.test(cName) || isDocContainer(cName)) {
              child.layoutGrow = 1;
            }
          }
        }

        // Recurse into child frames
        if ('children' in child && isAL(child)) {
          enforceChildFill(child, depth + 1);
        }
      }
    }
    enforceChildFill(node, 0);

    return { success: true };
  `.trim();
}
// ─── Responsive hints ─────────────────────────────────────────────────────────
function generateResponsiveHints(kind, spec) {
    const hints = [];
    if (kind === "navigation bar") {
        hints.push("On mobile (<768px): switch to VERTICAL and collapse secondary items into a hamburger menu.");
        hints.push("Ensure flex-shrink is applied to label text so icons stay visible at small widths.");
    }
    else if (kind === "card") {
        hints.push("In a responsive grid, let cards stretch to Fill-W; avoid Fixed widths.");
        hints.push("Increase padding to --space-xl on desktop for breathing room.");
    }
    else if (kind === "modal") {
        hints.push("On mobile: set width to Fill-W and reduce padding to --space-md.");
        hints.push("Use max-height: 90vh with scrollable content area to prevent overflow.");
    }
    else if (kind === "grid") {
        hints.push("Use Constraints → Scale on children so grid items resize proportionally.");
        hints.push("Reduce gap to --space-sm on mobile breakpoints.");
    }
    else if (kind === "form") {
        hints.push("Stack label + input vertically on mobile; use horizontal layout on desktop.");
    }
    else if (kind === "section") {
        hints.push("Reduce padding from --space-2xl to --space-xl on tablet and --space-lg on mobile.");
    }
    else if (kind === "document_page") {
        hints.push("On mobile: reduce page width to 100vw, padding to --space-lg, section gap to --space-xl.");
        hints.push("Consider collapsible TOC on narrow viewports.");
    }
    else if (kind === "section_block" || kind === "paragraph_group") {
        hints.push("Keep FILL width at all breakpoints for readable line lengths.");
    }
    if (spec.direction === "HORIZONTAL") {
        hints.push("If children need to wrap at narrow viewports, enable layoutWrap = WRAP.");
    }
    return hints;
}
// ─── Document container kinds (used to auto-enable recursive validation) ─────
const DOCUMENT_KINDS = new Set([
    "document_page", "header_block", "section_block", "toc_row",
    "paragraph_group", "divider", "footer_block", "table_block",
]);
function isDocumentKind(kind) {
    return DOCUMENT_KINDS.has(kind);
}
// ─── Recursive spec application for nested document containers ───────────────
function buildRecursiveSpecScript(nodeId) {
    // Serialize the detection patterns and specs as inline JS so they run inside
    // the Figma Plugin API context (bridge.execute).
    return `
(async () => {
  const root = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
  if (!root) throw new Error('Node not found');

  const SPECS = {
    document_page:   { dir: 'VERTICAL',   pw: 'AUTO',  cw: 'FIXED', pad: 56, gap: 48 },
    header_block:    { dir: 'VERTICAL',   pw: 'AUTO',  cw: 'AUTO',  pad: 0,  gap: 8  },
    section_block:   { dir: 'VERTICAL',   pw: 'AUTO',  cw: 'AUTO',  pad: 0,  gap: 24 },
    toc_row:         { dir: 'HORIZONTAL', pw: 'AUTO',  cw: 'AUTO',  pad: 0,  gap: 8  },
    paragraph_group: { dir: 'VERTICAL',   pw: 'AUTO',  cw: 'AUTO',  pad: 0,  gap: 8  },
    divider:         { dir: 'HORIZONTAL', pw: 'FIXED', cw: 'FIXED', pad: 0,  gap: 0  },
    footer_block:    { dir: 'HORIZONTAL', pw: 'AUTO',  cw: 'AUTO',  pad: 0,  gap: 16 },
    table_block:     { dir: 'VERTICAL',   pw: 'AUTO',  cw: 'AUTO',  pad: 0,  gap: 0  },
  };

  const DETECT = [
    [/doc(ument)?[\\s_-]?page|spec[\\s_-]?page|guide(line)?[\\s_-]?page/i, 'document_page'],
    [/header[\\s_-]?block|doc[\\s_-]?header|page[\\s_-]?title[\\s_-]?block/i, 'header_block'],
    [/section[\\s_-]?block|content[\\s_-]?section/i, 'section_block'],
    [/toc[\\s_-]?row|table[\\s_-]?of[\\s_-]?contents/i, 'toc_row'],
    [/paragraph[\\s_-]?group|body[\\s_-]?text[\\s_-]?block|text[\\s_-]?block/i, 'paragraph_group'],
    [/\\bdivider\\b|\\bseparator\\b|\\bhr\\b/i, 'divider'],
    [/footer[\\s_-]?block|doc[\\s_-]?footer/i, 'footer_block'],
    [/table[\\s_-]?block|spec[\\s_-]?table|data[\\s_-]?table/i, 'table_block'],
  ];

  function detectKind(node) {
    const n = (node.name || '').toLowerCase();
    for (const [re, kind] of DETECT) {
      if (re.test(n)) return kind;
    }
    return null;
  }

  function isAL(n) { return n.layoutMode === 'HORIZONTAL' || n.layoutMode === 'VERTICAL'; }

  let applied = 0;

  function applySpec(node, spec) {
    if (!('layoutMode' in node)) return;
    node.layoutMode = spec.dir;
    node.layoutWrap = 'NO_WRAP';
    node.primaryAxisSizingMode = spec.pw;
    node.counterAxisSizingMode = spec.cw;
    node.paddingLeft = spec.pad;
    node.paddingRight = spec.pad;
    node.paddingTop = spec.pad;
    node.paddingBottom = spec.pad;
    node.itemSpacing = spec.gap;
    applied++;
  }

  function walkAndApply(node, depth) {
    if (depth > 20 || !('children' in node)) return;
    for (const child of node.children) {
      const kind = detectKind(child);
      if (kind && SPECS[kind]) {
        applySpec(child, SPECS[kind]);
      }

      // Enforce FILL on children of VERTICAL auto-layout containers
      if (isAL(node) && node.layoutMode === 'VERTICAL' && 'layoutAlign' in child) {
        const cType = child.type;
        if (cType === 'FRAME' || cType === 'COMPONENT' || cType === 'INSTANCE' ||
            cType === 'RECTANGLE' || cType === 'GROUP' || cType === 'TEXT') {
          // Skip small icons
          const isSmall = child.width && child.height && child.width <= 48 && child.height <= 48;
          if (!isSmall) {
            child.layoutAlign = 'STRETCH';
            if ('layoutSizingHorizontal' in child) child.layoutSizingHorizontal = 'FILL';
          }
        }
      }

      walkAndApply(child, depth + 1);
    }
  }

  // Don't re-apply to root (already done by buildApplyScript), only children
  walkAndApply(root, 0);
  return { applied: applied };
})();
  `.trim();
}
// ─── Main handler ─────────────────────────────────────────────────────────────
async function layoutIntelligenceHandler(args) {
    const { nodeId, applyChanges, spacingTokenSet, // reserved for future token-set override
    responsiveHints = false, reportDiff = true, } = args;
    if (!nodeId)
        throw new Error("layoutIntelligence: `nodeId` is required.");
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    // 1. Fetch the node tree
    const node = await bridge.getNode(nodeId);
    // 2. Detect container type
    const detectedKind = detectContainerKind(node);
    // 3. Resolve spec (fall back to "card" for unknown containers)
    const resolvedKind = detectedKind === "unknown" ? "card" : detectedKind;
    const spec = CONTAINER_SPECS[resolvedKind];
    // Override spacing if spacingTokenSet is provided and matches a known token
    if (spacingTokenSet && SPACE[spacingTokenSet] !== undefined) {
        spec.paddingValue = SPACE[spacingTokenSet];
        spec.paddingToken = spacingTokenSet;
    }
    // 4. Snap spacing values
    const snappedPadding = (0, token_utils_js_1.snapToSpacingToken)(spec.paddingValue);
    const snappedGap = (0, token_utils_js_1.snapToSpacingToken)(spec.gapValue);
    // 5. Build diff
    const diff = reportDiff ? buildDiff(node, spec) : [];
    // 6. Apply if requested
    let applied = false;
    if (applyChanges) {
        const script = buildApplyScript(nodeId, spec, snappedPadding.tokenValue, snappedGap.tokenValue);
        const execResult = await bridge.execute(script);
        if (!execResult.success) {
            throw new Error(`layoutIntelligence: Failed to apply changes — ${execResult.error}`);
        }
        applied = true;
        // 6b. For document containers: recursively apply specs to nested children
        if (isDocumentKind(detectedKind)) {
            const recursiveScript = buildRecursiveSpecScript(nodeId);
            await bridge.execute(recursiveScript);
        }
    }
    // 7. Log the decision
    const logEntry = await decision_log_js_1.decisionLog.log({
        tool: "layout-intelligence",
        nodeIds: [nodeId],
        rationale: `Detected container kind "${detectedKind}" on node "${node.name}". Recommended spec: ${spec.direction}, padding=${snappedPadding.tokenName}, gap=${snappedGap.tokenName}. Applied: ${applied}. Diff properties changed: ${diff.length}.`,
        tokens: [snappedPadding.tokenName, snappedGap.tokenName],
        reversible: applied,
        metadata: { detectedKind, resolvedKind, spec, diffCount: diff.length },
    });
    // 8. Auto-layout validation + document repair
    //    Auto-enabled for document containers; also runs when recursive=true
    const shouldValidate = args.recursive || isDocumentKind(detectedKind);
    let validationFixes = 0;
    if (shouldValidate && applied) {
        const validatorScript = `
(async () => {
  ${(0, auto_layout_validator_js_1.generateValidatorScript)()}
  ${(0, auto_layout_validator_js_1.generateDocumentRepairScript)()}
  const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
  if (!node) throw new Error('Node not found: ${nodeId}');
  const valResult = validateAutoLayout(node);
  ${(0, auto_layout_validator_js_1.generateDocumentRepairCall)('node')}
  const totalFixes = valResult.fixes + (_docRepair ? _docRepair.repairs : 0);
  return { fixes: totalFixes, valDetails: valResult.details, repairDetails: _docRepair ? _docRepair.details : [] };
})();
    `.trim();
        const valResult = await bridge.execute(validatorScript);
        if (valResult.success && valResult.result) {
            validationFixes = valResult.result.fixes;
        }
    }
    const result = {
        nodeId,
        nodeName: node.name,
        detectedKind,
        spec,
        diff,
        applied,
        logEntryId: logEntry.id,
        ...(shouldValidate ? { validationFixes } : {}),
    };
    if (responsiveHints) {
        result.responsiveHints = generateResponsiveHints(detectedKind, spec);
    }
    return result;
}
//# sourceMappingURL=index.js.map