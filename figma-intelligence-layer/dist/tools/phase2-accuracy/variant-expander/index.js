"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Variant Expander
// Generates a full set of component variants by taking a cartesian product of
// the requested dimension values, cloning the base component for each
// combination, applying per-dimension token overrides, and grouping everything
// into a Figma Component Set.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.variantExpanderHandler = variantExpanderHandler;
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
const font_config_js_1 = require("../../../shared/font-config.js");
const token_override_maps_js_1 = require("./token-override-maps.js");
// ─── Naming helpers ───────────────────────────────────────────────────────────
function toFigmaName(props) {
    // Figma convention: "Property=Value, Property2=Value2"
    return Object.entries(props)
        .map(([k, v]) => `${capitalize(k)}=${capitalize(v)}`)
        .join(", ");
}
function toStorybookName(props) {
    // Storybook convention: "componentName--size-state-theme-type"
    return Object.values(props)
        .map((v) => v.toLowerCase().replace(/\s+/g, "-"))
        .join("--");
}
function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
// ─── Cartesian product ────────────────────────────────────────────────────────
function cartesian(dimensions) {
    const entries = Object.entries(dimensions).filter(([, values]) => values && values.length > 0);
    if (entries.length === 0)
        return [{}];
    return entries.reduce((acc, [key, values]) => {
        const expanded = [];
        for (const existing of acc) {
            for (const value of values) {
                expanded.push({ ...existing, [key]: value });
            }
        }
        return expanded;
    }, [{}]);
}
// ─── Per-dimension token overrides ───────────────────────────────────────────
/**
 * Resolve token overrides from the unified DIMENSION_OVERRIDES maps.
 * This replaces the previous inline logic with a single source of truth.
 */
function resolveTokenOverrides(props) {
    const overrides = [];
    for (const [dimension, dimValue] of Object.entries(props)) {
        const dimKey = dimension.toLowerCase();
        const overrideMap = token_override_maps_js_1.DIMENSION_OVERRIDES[dimKey];
        if (!overrideMap)
            continue;
        const valueKey = dimValue.toLowerCase();
        const mapOverrides = overrideMap[valueKey];
        if (!mapOverrides)
            continue;
        for (const mo of mapOverrides) {
            // Convert override map entries to the TokenOverride format used by the expander
            if (mo.property === "background") {
                overrides.push({
                    property: "fills[0]",
                    value: mo.token,
                    description: `${dimension}:${dimValue} — background: ${mo.token}`,
                });
            }
            else if (mo.property === "textColor") {
                overrides.push({
                    property: "textFill",
                    value: mo.token,
                    description: `${dimension}:${dimValue} — text color: ${mo.token}`,
                });
            }
            else if (mo.property === "borderColor") {
                overrides.push({
                    property: "strokes[0]",
                    value: mo.token,
                    description: `${dimension}:${dimValue} — border: ${mo.token}`,
                });
            }
            else if (mo.property === "opacity") {
                overrides.push({
                    property: "opacity",
                    value: mo.rawValue ?? 1,
                    description: `${dimension}:${dimValue} — opacity: ${mo.rawValue}`,
                });
            }
            else if (mo.property === "fontSize") {
                overrides.push({
                    property: "style.fontSize",
                    value: mo.rawValue ?? 16,
                    description: `${dimension}:${dimValue} — fontSize: ${mo.rawValue}px`,
                });
            }
            else if (mo.property === "paddingX") {
                overrides.push({ property: "paddingLeft", value: mo.rawValue ?? 16, description: `${dimension}:${dimValue} — paddingX: ${mo.rawValue}px` }, { property: "paddingRight", value: mo.rawValue ?? 16, description: `${dimension}:${dimValue} — paddingX: ${mo.rawValue}px` });
            }
            else if (mo.property === "paddingY") {
                overrides.push({ property: "paddingTop", value: mo.rawValue ?? 8, description: `${dimension}:${dimValue} — paddingY: ${mo.rawValue}px` }, { property: "paddingBottom", value: mo.rawValue ?? 8, description: `${dimension}:${dimValue} — paddingY: ${mo.rawValue}px` });
            }
            else if (mo.property === "height") {
                overrides.push({
                    property: "height",
                    value: mo.rawValue ?? 40,
                    description: `${dimension}:${dimValue} — height: ${mo.rawValue}px`,
                });
            }
            else if (mo.property === "borderWidth") {
                overrides.push({
                    property: "strokeWeight",
                    value: mo.rawValue ?? 1,
                    description: `${dimension}:${dimValue} — borderWidth: ${mo.rawValue}`,
                });
            }
            else if (mo.property === "text") {
                overrides.push({
                    property: "characters",
                    value: mo.rawValue ?? "",
                    description: `${dimension}:${dimValue} — text: ${mo.rawValue}`,
                });
            }
        }
    }
    return overrides;
}
// ─── Figma script builders ────────────────────────────────────────────────────
function buildCloneScript(baseNodeId, variantName, overrides) {
    const overrideLines = [];
    for (const o of overrides) {
        if (o.property === "opacity") {
            overrideLines.push(`  clone.opacity = ${o.value};`);
        }
        else if (o.property === "characters") {
            overrideLines.push(`  const textNodes = clone.findAll ? clone.findAll(n => n.type === 'TEXT') : [];`, `  for (const t of textNodes) { t.characters = ${JSON.stringify(o.value)}; }`);
        }
        else if (o.property.startsWith("padding")) {
            const field = o.property; // e.g. "paddingLeft"
            overrideLines.push(`  if ('${field}' in clone) clone.${field} = ${o.value};`);
        }
        else if (o.property === "variableMode") {
            // Dark mode is set on the collection; we record it as a variant property here
            overrideLines.push(`  /* variableMode:${o.value} — handled by component set variant */`);
        }
        // fills and style overrides require variable binding; we annotate for now
    }
    const overrideBlock = overrideLines.join("\n") || "  /* no overrides */";
    return `
    (async () => {
      const base = await figma.getNodeByIdAsync(${JSON.stringify(baseNodeId)});
      if (!base) throw new Error('Base node not found: ${baseNodeId}');
      const clone = base.clone();
      clone.name = ${JSON.stringify(variantName)};
      ${overrideBlock}
      // Place clone next to base temporarily
      base.parent.appendChild(clone);
      return clone.id;
    })()
  `.trim();
}
function buildComponentSetScript(componentIds) {
    return `
    (async () => {
      const components = [];
      for (const id of ${JSON.stringify(componentIds)}) {
        const n = await figma.getNodeByIdAsync(id);
        if (n) components.push(n);
      }
      if (components.length === 0) throw new Error('No components found to group');
      const set = figma.combineAsVariants(components, figma.currentPage);
      return set.id;
    })()
  `.trim();
}
function buildGridArrangeScript(componentSetId, columnCount) {
    const COL_WIDTH = 200;
    const ROW_HEIGHT = 150;
    const GAP = 24;
    return `
    (async () => {
      const set = await figma.getNodeByIdAsync(${JSON.stringify(componentSetId)});
      if (!set || !set.children) throw new Error('Component set not found');
      const children = [...set.children];
      children.forEach((child, i) => {
        const col = i % ${columnCount};
        const row = Math.floor(i / ${columnCount});
        child.x = col * (${COL_WIDTH} + ${GAP});
        child.y = row * (${ROW_HEIGHT} + ${GAP});
      });
      return { arranged: children.length };
    })()
  `.trim();
}
// ─── Main handler ─────────────────────────────────────────────────────────────
async function variantExpanderHandler(args) {
    const { nodeId, dimensions, namingConvention, autoApplyTokens, arrangeInGrid = false, } = args;
    if (!nodeId)
        throw new Error("variantExpander: `nodeId` is required.");
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    // 1. Verify the base component node exists
    const baseNode = await bridge.getNode(nodeId);
    if (!baseNode)
        throw new Error(`variantExpander: Node "${nodeId}" not found.`);
    // 2. Generate all combinations
    const combinations = cartesian(dimensions).map((props) => {
        const key = namingConvention === "figma"
            ? toFigmaName(props)
            : toStorybookName(props);
        const tokenOverrides = autoApplyTokens ? resolveTokenOverrides(props) : [];
        return { key, props, tokenOverrides };
    });
    if (combinations.length === 0) {
        throw new Error("variantExpander: No combinations generated. Check `dimensions` input.");
    }
    // 3. Clone and apply overrides for each combination (batched in a single execute)
    let created = 0;
    let failed = 0;
    const clonedIds = [];
    // Build a single script that creates ALL clones at once
    const BATCH_SIZE = 25;
    for (let batchStart = 0; batchStart < combinations.length; batchStart += BATCH_SIZE) {
        const batch = combinations.slice(batchStart, batchStart + BATCH_SIZE);
        const cloneLines = [];
        for (const combo of batch) {
            const overrideLines = [];
            for (const o of combo.tokenOverrides) {
                if (o.property === "opacity") {
                    overrideLines.push(`clone.opacity = ${o.value};`);
                }
                else if (o.property === "characters") {
                    overrideLines.push(`var textNodes = clone.findAll(function(n) { return n.type === 'TEXT'; }); for (var ti = 0; ti < textNodes.length; ti++) { textNodes[ti].characters = ${JSON.stringify(o.value)}; }`);
                }
                else if (o.property.startsWith("padding") || o.property === "strokeWeight") {
                    overrideLines.push(`if ('${o.property}' in clone) clone.${o.property} = ${o.value};`);
                }
                else if (o.property === "height") {
                    overrideLines.push(`try { clone.resize(clone.width, ${o.value}); } catch(e) {}`);
                }
                else if (o.property === "style.fontSize") {
                    overrideLines.push(`var textNodes = clone.findAll(function(n) { return n.type === 'TEXT'; }); for (var ti = 0; ti < textNodes.length; ti++) { textNodes[ti].fontSize = ${o.value}; }`);
                }
            }
            cloneLines.push(`
        try {
          var clone = base.clone();
          clone.name = ${JSON.stringify(combo.key)};
          ${overrideLines.join("\n          ")}
          base.parent.appendChild(clone);
          ids.push(clone.id);
        } catch(e) { errors++; }
      `);
        }
        const fontConfig = (0, font_config_js_1.resolveFontConfig)(args.fonts);
        const fontLoads = (0, font_config_js_1.generateFontLoadScript)(fontConfig);
        const batchScript = `
      (async () => {
        ${fontLoads}
        var base = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
        if (!base) throw new Error('Base node not found');
        var ids = [];
        var errors = 0;
        ${cloneLines.join("\n")}
        return { ids: ids, errors: errors };
      })()
    `.trim();
        try {
            const batchResult = await bridge.execute(batchScript);
            if (batchResult.success && batchResult.result) {
                const { ids, errors } = batchResult.result;
                clonedIds.push(...ids);
                created += ids.length;
                failed += errors;
                // Assign clonedNodeId back to each combo
                for (let i = 0; i < batch.length && i < ids.length; i++) {
                    batch[i].clonedNodeId = ids[i];
                }
            }
            else {
                failed += batch.length;
            }
        }
        catch {
            failed += batch.length;
        }
    }
    // 4. Group into a Component Set
    let componentSetId = null;
    if (clonedIds.length > 0) {
        try {
            const setScript = buildComponentSetScript(clonedIds);
            const setResult = await bridge.execute(setScript);
            if (setResult.success && setResult.result) {
                componentSetId = setResult.result;
            }
            else {
                console.error(`variantExpander: combineAsVariants failed: ${setResult.error}`);
            }
        }
        catch (err) {
            console.error("variantExpander: Exception creating component set:", err);
        }
    }
    // 5. Arrange in grid if requested
    if (arrangeInGrid && componentSetId) {
        try {
            // Determine a sensible column count (square-ish grid)
            const cols = Math.ceil(Math.sqrt(clonedIds.length));
            const gridScript = buildGridArrangeScript(componentSetId, cols);
            await bridge.execute(gridScript);
        }
        catch (err) {
            console.error("variantExpander: Grid arrangement failed:", err);
        }
    }
    // 6. Log the decision
    const allTokenNames = combinations
        .flatMap((c) => c.tokenOverrides.map((o) => o.property))
        .filter((v, i, arr) => arr.indexOf(v) === i);
    const logEntry = await decision_log_js_1.decisionLog.log({
        tool: "variant-expander",
        nodeIds: [nodeId, ...(componentSetId ? [componentSetId] : [])],
        rationale: `Expanded "${baseNode.name}" into ${combinations.length} variants (${Object.keys(dimensions).join(", ")}). Created ${created}, failed ${failed}. ComponentSet: ${componentSetId ?? "none"}.`,
        tokens: allTokenNames,
        reversible: true,
        metadata: {
            baseNodeId: nodeId,
            namingConvention,
            autoApplyTokens,
            arrangeInGrid,
            totalCombinations: combinations.length,
            created,
            failed,
            componentSetId,
        },
    });
    return {
        totalCombinations: combinations.length,
        created,
        failed,
        componentSetId,
        combinations,
        logEntryId: logEntry.id,
    };
}
//# sourceMappingURL=index.js.map