"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Component Script Builder
// Takes a ComponentBlueprint + FontConfig → generates a complete Figma Plugin
// API script that creates the component with proper auto-layout, text nodes
// with typography presets, and semantic token bindings.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildComponentScript = buildComponentScript;
exports.buildAllComponentsScript = buildAllComponentsScript;
const font_config_js_1 = require("./font-config.js");
const typography_presets_js_1 = require("./typography-presets.js");
/**
 * Build a Figma Plugin API script for a single component blueprint.
 * The script creates the component as a Component node, recursively creates
 * children with auto-layout, and binds semantic tokens via variable lookup.
 *
 * @param blueprint - Component definition
 * @param fontConfig - Font configuration
 * @param collectionId - Optional variable collection ID for token binding
 * @returns Script string for bridge.execute()
 */
function buildComponentScript(blueprint, fontConfig, collectionId) {
    const fontLoads = (0, font_config_js_1.generateFontLoadScript)(fontConfig);
    const nodeCreation = buildNodeScript(blueprint.root, "comp", fontConfig, true);
    const bindingCode = collectionId
        ? buildTokenBindingBlock(blueprint, collectionId)
        : "";
    return `
(async () => {
${fontLoads}

  const comp = figma.createComponent();
  comp.name = ${JSON.stringify(blueprint.name)};
  ${nodeCreation}

  page.appendChild(comp);

  ${bindingCode}

  return { id: comp.id, name: comp.name };
})();
  `.trim();
}
/**
 * Build a batch script that creates ALL components for the given blueprints
 * on a new page.
 */
function buildAllComponentsScript(blueprints, brandName, fontConfig, collectionId) {
    const fontLoads = (0, font_config_js_1.generateFontLoadScript)(fontConfig);
    const componentBlocks = [];
    let yOffset = 32;
    for (const bp of blueprints) {
        const varName = `comp_${bp.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
        const nodeCreation = buildNodeScript(bp.root, varName, fontConfig, true);
        componentBlocks.push(`
  // ── ${bp.name} ──
  {
    const ${varName} = figma.createComponent();
    ${varName}.name = ${JSON.stringify(bp.name)};
    ${nodeCreation}
    page.appendChild(${varName});
    ${varName}.x = 32;
    ${varName}.y = ${yOffset};
    componentIds.push(${varName}.id);
  }
    `);
        // Estimate height for next component placement
        const estHeight = bp.root.height ?? 80;
        yOffset += estHeight + 32;
    }
    const bindingCode = collectionId
        ? buildBatchTokenBindingBlock(blueprints, collectionId)
        : "";
    return `
(async () => {
${fontLoads}

  const page = figma.createPage();
  page.name = ${JSON.stringify(`${brandName} – Components`)};
  figma.currentPage = page;

  const componentIds = [];

  ${componentBlocks.join("\n")}

  ${bindingCode}

  return { pageId: page.id, componentCount: componentIds.length };
})();
  `.trim();
}
// ─── Internal helpers ───────────────────────────────────────────────────────
function buildNodeScript(node, parentVar, fontConfig, isRoot) {
    const lines = [];
    if (!isRoot) {
        // Create child node
        const createFn = getCreateFn(node.kind);
        lines.push(`const ${sanitize(node.name)} = ${createFn};`);
        lines.push(`${sanitize(node.name)}.name = ${JSON.stringify(node.name)};`);
    }
    const nv = isRoot ? parentVar : sanitize(node.name);
    // Size
    if (node.width && node.height) {
        lines.push(`${nv}.resize(${node.width}, ${node.height});`);
    }
    else if (node.width && node.kind !== "text") {
        lines.push(`${nv}.resize(${node.width}, ${node.height ?? 40});`);
    }
    // Auto-layout (frames only)
    if (node.layoutMode && node.layoutMode !== "NONE" && (node.kind === "frame" || isRoot)) {
        lines.push(`${nv}.layoutMode = ${JSON.stringify(node.layoutMode)};`);
        if (node.primaryAxisSizing)
            lines.push(`${nv}.primaryAxisSizingMode = ${JSON.stringify(node.primaryAxisSizing)};`);
        if (node.counterAxisSizing)
            lines.push(`${nv}.counterAxisSizingMode = ${JSON.stringify(node.counterAxisSizing)};`);
        if (node.primaryAxisAlign)
            lines.push(`${nv}.primaryAxisAlignItems = ${JSON.stringify(node.primaryAxisAlign)};`);
        if (node.counterAxisAlign)
            lines.push(`${nv}.counterAxisAlignItems = ${JSON.stringify(node.counterAxisAlign)};`);
        if (node.paddingX !== undefined) {
            lines.push(`${nv}.paddingLeft = ${nv}.paddingRight = ${node.paddingX};`);
        }
        if (node.paddingY !== undefined) {
            lines.push(`${nv}.paddingTop = ${nv}.paddingBottom = ${node.paddingY};`);
        }
        if (node.itemSpacing !== undefined) {
            lines.push(`${nv}.itemSpacing = ${node.itemSpacing};`);
        }
    }
    // Corner radius
    if (node.cornerRadius !== undefined) {
        lines.push(`${nv}.cornerRadius = ${node.cornerRadius};`);
    }
    // Fills (use semantic token name as comment, hardcode a placeholder color)
    if (node.fillSemantic) {
        const fallback = semanticToFallbackRgb(node.fillSemantic);
        lines.push(`${nv}.fills = [{ type: 'SOLID', color: ${fallback} }];`);
    }
    // Strokes
    if (node.strokeSemantic) {
        const fallback = semanticToFallbackRgb(node.strokeSemantic);
        lines.push(`${nv}.strokes = [{ type: 'SOLID', color: ${fallback} }];`);
        lines.push(`${nv}.strokeWeight = ${node.strokeWeight ?? 1};`);
        lines.push(`${nv}.strokeAlign = 'INSIDE';`);
    }
    // Effects
    if (node.effects && node.effects.length > 0) {
        const effectsJson = JSON.stringify(node.effects.map((e) => ({
            ...e,
            visible: true,
            blendMode: "NORMAL",
        })));
        lines.push(`${nv}.effects = ${effectsJson};`);
    }
    // Opacity
    if (node.opacity !== undefined) {
        lines.push(`${nv}.opacity = ${node.opacity};`);
    }
    // Icon slot annotation
    if (node.iconSlot) {
        const slot = node.iconSlot;
        const parts = [
            slot.defaultIcon ? `icon: ${JSON.stringify(slot.defaultIcon)}` : null,
            slot.size ? `size: ${JSON.stringify(slot.size)}` : null,
            slot.decorative !== undefined ? `decorative: ${slot.decorative}` : null,
            slot.colorToken ? `color: ${JSON.stringify(slot.colorToken)}` : null,
            `required: ${slot.required}`,
        ].filter(Boolean).join(", ");
        lines.push(`// Icon slot: { ${parts} }`);
        lines.push(`${nv}.setPluginData("iconSlot", ${JSON.stringify(JSON.stringify(slot))});`);
    }
    // Text-specific
    if (node.kind === "text") {
        if (node.textPreset) {
            lines.push((0, typography_presets_js_1.applyTextPresetScript)(nv, node.textPreset, fontConfig));
        }
        lines.push(`${nv}.characters = ${JSON.stringify(node.textContent ?? "")};`);
        if (node.textFillSemantic) {
            const fallback = semanticToFallbackRgb(node.textFillSemantic);
            lines.push(`${nv}.fills = [{ type: 'SOLID', color: ${fallback} }];`);
        }
    }
    // Append to parent (if not root)
    if (!isRoot) {
        lines.push(`${parentVar}.appendChild(${nv});`);
    }
    // Recurse children
    if (node.children) {
        for (const child of node.children) {
            lines.push(buildNodeScript(child, nv, fontConfig, false));
        }
    }
    return lines.join("\n    ");
}
function getCreateFn(kind) {
    switch (kind) {
        case "frame": return "figma.createFrame()";
        case "text": return "figma.createText()";
        case "rect": return "figma.createRectangle()";
        case "ellipse": return "figma.createEllipse()";
        case "vector": return "figma.createVector()";
        default: return "figma.createFrame()";
    }
}
function sanitize(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, "_");
}
/**
 * Map semantic token names to reasonable fallback RGB literals for initial
 * component creation. These are overridden by actual variable bindings.
 */
function semanticToFallbackRgb(semantic) {
    const s = semantic.toLowerCase();
    // Primary / brand actions
    if (s.includes("actions/primary/bg"))
        return "{ r: 0.15, g: 0.39, b: 0.92 }";
    if (s.includes("actions/destructive"))
        return "{ r: 0.86, g: 0.15, b: 0.15 }";
    if (s.includes("actions/secondary/bg"))
        return "{ r: 0.95, g: 0.95, b: 0.97 }";
    if (s.includes("actions/secondary/border"))
        return "{ r: 0.80, g: 0.80, b: 0.85 }";
    // Surface
    if (s.includes("surface/subtle"))
        return "{ r: 0.96, g: 0.96, b: 0.97 }";
    if (s.includes("surface/raised"))
        return "{ r: 1, g: 1, b: 1 }";
    if (s.includes("surface/overlay"))
        return "{ r: 1, g: 1, b: 1 }";
    if (s.includes("surface/inverse"))
        return "{ r: 0.10, g: 0.10, b: 0.12 }";
    if (s.includes("surface/disabled"))
        return "{ r: 0.95, g: 0.95, b: 0.96 }";
    if (s.includes("surface/default"))
        return "{ r: 1, g: 1, b: 1 }";
    // Text
    if (s.includes("text/on-color"))
        return "{ r: 1, g: 1, b: 1 }";
    if (s.includes("text/inverse"))
        return "{ r: 1, g: 1, b: 1 }";
    if (s.includes("text/primary"))
        return "{ r: 0.07, g: 0.09, b: 0.15 }";
    if (s.includes("text/secondary"))
        return "{ r: 0.37, g: 0.37, b: 0.42 }";
    if (s.includes("text/tertiary"))
        return "{ r: 0.55, g: 0.55, b: 0.60 }";
    if (s.includes("text/disabled"))
        return "{ r: 0.70, g: 0.70, b: 0.73 }";
    // Border
    if (s.includes("border/focus"))
        return "{ r: 0.15, g: 0.39, b: 0.92 }";
    if (s.includes("border/strong"))
        return "{ r: 0.70, g: 0.70, b: 0.73 }";
    if (s.includes("border/subtle"))
        return "{ r: 0.92, g: 0.92, b: 0.94 }";
    if (s.includes("border/default"))
        return "{ r: 0.82, g: 0.83, b: 0.86 }";
    // Field
    if (s.includes("field/bg"))
        return "{ r: 1, g: 1, b: 1 }";
    if (s.includes("field/border"))
        return "{ r: 0.80, g: 0.80, b: 0.85 }";
    // Feedback
    if (s.includes("feedback/success/bg"))
        return "{ r: 0.87, g: 0.95, b: 0.90 }";
    if (s.includes("feedback/success/text"))
        return "{ r: 0.09, g: 0.55, b: 0.29 }";
    if (s.includes("feedback/warning/bg"))
        return "{ r: 0.98, g: 0.93, b: 0.83 }";
    if (s.includes("feedback/warning/text"))
        return "{ r: 0.72, g: 0.49, b: 0.02 }";
    if (s.includes("feedback/danger/bg"))
        return "{ r: 0.97, g: 0.88, b: 0.88 }";
    if (s.includes("feedback/danger/text"))
        return "{ r: 0.73, g: 0.14, b: 0.14 }";
    if (s.includes("feedback/info/bg"))
        return "{ r: 0.87, g: 0.92, b: 0.98 }";
    if (s.includes("feedback/info/text"))
        return "{ r: 0.10, g: 0.36, b: 0.78 }";
    // Focus ring
    if (s.includes("focus/ring"))
        return "{ r: 0.15, g: 0.39, b: 0.92 }";
    // Default fallback
    return "{ r: 0.85, g: 0.85, b: 0.88 }";
}
/**
 * Generate token binding code that looks up variables from the collection
 * and binds them to component fills/strokes/radii.
 */
function buildTokenBindingBlock(blueprint, collectionId) {
    if (blueprint.tokenBindings.length === 0)
        return "";
    return `
  // ── Token binding for ${blueprint.name} ──
  try {
    const cols = await figma.variables.getLocalVariableCollectionsAsync();
    const col = cols.find(c => c.id === ${JSON.stringify(collectionId)});
    if (col) {
      const vars = [];
      for (const vid of col.variableIds) {
        const v = await figma.variables.getVariableByIdAsync(vid);
        if (v) vars.push(v);
      }
      const findVar = (suffix) => vars.find(v => v.name.endsWith(suffix) || v.name === suffix);
      const bindFill = (node, variable) => {
        if (!variable || !node.fills || node.fills.length === 0) return;
        const p = [...node.fills];
        if (p[0].type === 'SOLID') { p[0] = figma.variables.setBoundVariableForPaint(p[0], 'color', variable); node.fills = p; }
      };
      const bindStroke = (node, variable) => {
        if (!variable || !node.strokes || node.strokes.length === 0) return;
        const p = [...node.strokes];
        if (p[0].type === 'SOLID') { p[0] = figma.variables.setBoundVariableForPaint(p[0], 'color', variable); node.strokes = p; }
      };
      const bindRadius = (node, variable) => {
        if (!variable) return;
        try { node.setBoundVariable('topLeftRadius', variable.id); } catch {}
        try { node.setBoundVariable('topRightRadius', variable.id); } catch {}
        try { node.setBoundVariable('bottomLeftRadius', variable.id); } catch {}
        try { node.setBoundVariable('bottomRightRadius', variable.id); } catch {}
      };

      ${blueprint.tokenBindings.map((tb) => {
        const targetExpr = tb.nodePath
            ? `comp.findOne(n => n.name === ${JSON.stringify(tb.nodePath)})`
            : "comp";
        const varExpr = `findVar(${JSON.stringify(tb.semanticToken)})`;
        if (tb.property === "fills")
            return `bindFill(${targetExpr} || comp, ${varExpr});`;
        if (tb.property === "strokes")
            return `bindStroke(${targetExpr} || comp, ${varExpr});`;
        if (tb.property === "cornerRadius")
            return `bindRadius(${targetExpr} || comp, ${varExpr});`;
        return `/* unsupported binding: ${tb.property} */`;
    }).join("\n      ")}
    }
  } catch (e) { /* token binding is best-effort */ }
  `;
}
function buildBatchTokenBindingBlock(blueprints, collectionId) {
    const bindableBlueprints = blueprints.filter((bp) => bp.tokenBindings.length > 0);
    if (bindableBlueprints.length === 0)
        return "";
    return `
  // ── Batch token binding ──
  try {
    const cols = await figma.variables.getLocalVariableCollectionsAsync();
    const col = cols.find(c => c.id === ${JSON.stringify(collectionId)});
    if (col) {
      const vars = [];
      for (const vid of col.variableIds) {
        const v = await figma.variables.getVariableByIdAsync(vid);
        if (v) vars.push(v);
      }
      const findVar = (suffix) => vars.find(v => v.name.endsWith(suffix) || v.name === suffix);
      const bindFill = (node, variable) => {
        if (!variable || !node || !node.fills || node.fills.length === 0) return;
        const p = [...node.fills];
        if (p[0].type === 'SOLID') { p[0] = figma.variables.setBoundVariableForPaint(p[0], 'color', variable); node.fills = p; }
      };
      const bindStroke = (node, variable) => {
        if (!variable || !node || !node.strokes || node.strokes.length === 0) return;
        const p = [...node.strokes];
        if (p[0].type === 'SOLID') { p[0] = figma.variables.setBoundVariableForPaint(p[0], 'color', variable); node.strokes = p; }
      };
      const bindRadius = (node, variable) => {
        if (!variable || !node) return;
        try { node.setBoundVariable('topLeftRadius', variable.id); } catch {}
        try { node.setBoundVariable('topRightRadius', variable.id); } catch {}
        try { node.setBoundVariable('bottomLeftRadius', variable.id); } catch {}
        try { node.setBoundVariable('bottomRightRadius', variable.id); } catch {}
      };

      const allComponents = page.findAll(n => n.type === 'COMPONENT');
      for (const comp of allComponents) {
        const nameLower = comp.name.toLowerCase();
        ${bindableBlueprints.map((bp) => {
        const bindings = bp.tokenBindings.map((tb) => {
            const targetExpr = tb.nodePath
                ? `comp.findOne(n => n.name === ${JSON.stringify(tb.nodePath)})`
                : "comp";
            const varExpr = `findVar(${JSON.stringify(tb.semanticToken)})`;
            if (tb.property === "fills")
                return `  bindFill(${targetExpr} || comp, ${varExpr});`;
            if (tb.property === "strokes")
                return `  bindStroke(${targetExpr} || comp, ${varExpr});`;
            if (tb.property === "cornerRadius")
                return `  bindRadius(${targetExpr} || comp, ${varExpr});`;
            return "";
        }).filter(Boolean).join("\n          ");
        return `if (nameLower === ${JSON.stringify(bp.name.toLowerCase())}) {\n          ${bindings}\n        }`;
    }).join(" else ")}
      }
    }
  } catch (e) { /* token binding is best-effort */ }
  `;
}
//# sourceMappingURL=component-script-builder.js.map