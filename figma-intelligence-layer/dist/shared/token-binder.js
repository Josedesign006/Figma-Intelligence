"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Token Binder
// Central module that generates Figma Plugin API scripts to bind design-system
// variables to node properties. Used by Page Architect, Component Archaeologist,
// DS Scaffolder, and Intent Translator to enforce token binding.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTokenId = resolveTokenId;
exports.buildTokenIdMap = buildTokenIdMap;
exports.getTokenRolesForComponent = getTokenRolesForComponent;
exports.resolveTokenRefsForComponent = resolveTokenRefsForComponent;
exports.bindColorScript = bindColorScript;
exports.bindFloatScript = bindFloatScript;
exports.buildBindingScript = buildBindingScript;
exports.buildBatchBindingScript = buildBatchBindingScript;
exports.resolveDesignPalette = resolveDesignPalette;
exports.resolveFloatToken = resolveFloatToken;
// Semantic roles that map component types to the token groups they need
const COMPONENT_TOKEN_ROLES = {
    Button: ["color/semantic/actions/primary/bg/default", "color/semantic/text/on-color", "radius/semantic/control/default", "space/semantic/inset/control/md"],
    Modal: ["color/semantic/surface/overlay", "color/semantic/border/default", "radius/semantic/surface/default", "color/semantic/text/primary"],
    Card: ["color/semantic/surface/raised", "color/semantic/border/default", "radius/semantic/surface/default", "color/semantic/text/primary", "color/semantic/text/secondary"],
    Input: ["color/semantic/field/bg/default", "color/semantic/field/border/default", "radius/semantic/field/default", "color/semantic/text/primary", "color/semantic/text/disabled"],
    Select: ["color/semantic/field/bg/default", "color/semantic/field/border/default", "radius/semantic/field/default", "color/semantic/text/primary"],
    Checkbox: ["color/semantic/field/bg/default", "color/semantic/border/default", "color/semantic/text/primary"],
    Toggle: ["color/semantic/border/default", "color/semantic/surface/default", "color/semantic/actions/primary/bg/default"],
    Radio: ["color/semantic/field/bg/default", "color/semantic/border/default", "color/semantic/text/primary"],
    Toast: ["color/semantic/feedback/success/bg", "color/semantic/feedback/success/text", "radius/semantic/control/default"],
    NavBar: ["color/semantic/surface/default", "color/semantic/border/subtle", "color/semantic/text/primary"],
    Table: ["color/semantic/surface/default", "color/semantic/border/default", "color/semantic/text/primary", "color/semantic/surface/subtle"],
    Avatar: ["color/semantic/surface/subtle", "radius/semantic/pill"],
    Badge: ["color/semantic/actions/primary/bg/default", "color/semantic/text/on-color", "radius/semantic/pill"],
    Tooltip: ["color/semantic/surface/inverse", "color/semantic/text/inverse"],
    Tabs: ["color/semantic/border/subtle", "color/semantic/text/primary", "color/semantic/actions/primary/bg/default"],
    Breadcrumb: ["color/semantic/text/primary", "color/semantic/text/tertiary", "color/semantic/actions/primary/bg/default"],
    Tag: ["color/semantic/surface/subtle", "color/semantic/border/default", "color/semantic/text/primary"],
    Heading: ["color/semantic/text/primary"],
    Link: ["color/semantic/actions/primary/bg/default"],
};
// ─── Token resolution ────────────────────────────────────────────────────────
/**
 * Look up a Figma variable ID by token name from the available tokens.
 * Supports partial matching: "color/semantic/primary" matches token named
 * "color/semantic/primary" or "Brand Tokens/color/semantic/primary".
 */
function resolveTokenId(tokenName, tokens) {
    // Exact match first
    const exact = tokens.find((t) => t.name === tokenName);
    if (exact)
        return exact.id;
    // Suffix match (token name ends with the requested name)
    const suffix = tokens.find((t) => t.name.endsWith(`/${tokenName}`) || t.name.endsWith(tokenName));
    if (suffix)
        return suffix.id;
    // Normalized comparison (strip slashes and compare lowercase)
    const normalizedTarget = tokenName.toLowerCase().replace(/[\/\-_]/g, "");
    const normalized = tokens.find((t) => {
        const n = t.name.toLowerCase().replace(/[\/\-_]/g, "");
        return n === normalizedTarget || n.endsWith(normalizedTarget);
    });
    if (normalized)
        return normalized.id;
    return null;
}
/**
 * Build a map of semantic role → variable ID from the available tokens.
 * Used by tools that need to resolve multiple token references at once.
 */
function buildTokenIdMap(tokens) {
    const map = {};
    for (const token of tokens) {
        // Index by full name
        map[token.name] = token.id;
        // Also index by the last segment for quick lookup
        const parts = token.name.split("/");
        if (parts.length > 1) {
            const shortName = parts.slice(-2).join("/");
            if (!map[shortName]) {
                map[shortName] = token.id;
            }
        }
    }
    return map;
}
/**
 * Resolve which token names are relevant for a given component type.
 */
function getTokenRolesForComponent(componentType) {
    // Try exact match first
    if (COMPONENT_TOKEN_ROLES[componentType]) {
        return COMPONENT_TOKEN_ROLES[componentType];
    }
    // Try case-insensitive match
    const lower = componentType.toLowerCase();
    for (const [key, roles] of Object.entries(COMPONENT_TOKEN_ROLES)) {
        if (key.toLowerCase() === lower)
            return roles;
    }
    // Default roles for unknown components
    return ["color/surface/default", "color/text/primary", "color/border/default"];
}
/**
 * Given a component type and available tokens, resolve the relevant token names
 * to their variable IDs.
 */
function resolveTokenRefsForComponent(componentType, tokens) {
    const roles = getTokenRolesForComponent(componentType);
    const resolved = [];
    for (const role of roles) {
        const id = resolveTokenId(role, tokens);
        if (id) {
            // Return the token name (not the ID) for the tokenRefs field
            const token = tokens.find((t) => t.id === id);
            if (token)
                resolved.push(token.name);
        }
    }
    return resolved;
}
// ─── Script generators ───────────────────────────────────────────────────────
/**
 * Generate a Figma Plugin API script line that binds a color variable
 * to a paint fill on a node.
 *
 * Example output:
 *   const v = await figma.variables.getVariableByIdAsync("VariableID:1:2");
 *   if (v) node.setBoundVariable('fills', 0, v.id);
 */
function bindColorScript(nodeVar, fillIndex, variableId, paintType = "fills") {
    const varName = `__v_${fillIndex}_${paintType}`;
    return `
  {
    const ${varName} = await figma.variables.getVariableByIdAsync(${JSON.stringify(variableId)});
    if (${varName} && ${nodeVar}.${paintType} && ${nodeVar}.${paintType}.length > ${fillIndex}) {
      const paints = [...${nodeVar}.${paintType}];
      paints[${fillIndex}] = figma.variables.setBoundVariableForPaint(paints[${fillIndex}], 'color', ${varName});
      ${nodeVar}.${paintType} = paints;
    }
  }`;
}
/**
 * Generate a Figma Plugin API script line that binds a float variable
 * to a node property (spacing, radius, etc.).
 *
 * Example output:
 *   const v = await figma.variables.getVariableByIdAsync("VariableID:1:2");
 *   if (v) node.setBoundVariable('paddingLeft', v.id);
 */
function bindFloatScript(nodeVar, field, variableId) {
    const safeField = field.replace(/[^a-zA-Z0-9_]/g, "");
    const varName = `__v_${safeField}`;
    return `
  {
    const ${varName} = await figma.variables.getVariableByIdAsync(${JSON.stringify(variableId)});
    if (${varName}) ${nodeVar}.setBoundVariable('${field}', ${varName}.id);
  }`;
}
/**
 * Build a complete binding script for a single node, applying multiple
 * token bindings. Returns empty string if no bindings.
 */
function buildBindingScript(nodeId, bindings) {
    if (bindings.length === 0)
        return "";
    const lines = [];
    for (const binding of bindings) {
        if (binding.field === "fills" || binding.field === "strokes") {
            lines.push(bindColorScript(binding.nodeVar, binding.fillIndex ?? 0, binding.variableId, binding.field));
        }
        else {
            lines.push(bindFloatScript(binding.nodeVar, binding.field, binding.variableId));
        }
    }
    return `
// ── Token bindings ──
{
  const __bindTarget = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
  if (__bindTarget) {
    const ${bindings[0]?.nodeVar ?? "node"} = __bindTarget;
    ${lines.join("\n    ")}
  }
}`;
}
/**
 * Build a batch binding script that binds variables to multiple nodes
 * in a single execute call. Designed for use via bridge.execute().
 */
function buildBatchBindingScript(bindings) {
    if (bindings.length === 0)
        return "";
    const bindingData = JSON.stringify(bindings);
    return `
(async () => {
  const bindings = ${bindingData};
  let bound = 0;

  for (const b of bindings) {
    const node = await figma.getNodeByIdAsync(b.nodeId);
    if (!node) continue;

    const variable = await figma.variables.getVariableByIdAsync(b.variableId);
    if (!variable) continue;

    if (b.field === 'fills' || b.field === 'strokes') {
      const idx = b.fillIndex ?? 0;
      if (node[b.field] && node[b.field].length > idx) {
        const paints = [...node[b.field]];
        paints[idx] = figma.variables.setBoundVariableForPaint(paints[idx], 'color', variable);
        node[b.field] = paints;
        bound++;
      }
    } else {
      try {
        node.setBoundVariable(b.field, variable.id);
        bound++;
      } catch (e) { /* skip unsupported fields */ }
    }
  }

  return { bound, total: bindings.length };
})();
`.trim();
}
const PALETTE_MAPPINGS = [
    { role: "primary", tokenNames: ["color/semantic/actions/primary/bg/default", "color/semantic/primary", "color/primary/500"], fallbackRgb: "{ r: 0.09, g: 0.09, b: 0.09 }" },
    { role: "primaryText", tokenNames: ["color/semantic/text/on-color", "color/text/on-primary", "color/semantic/primary-on"], fallbackRgb: "{ r: 1, g: 1, b: 1 }" },
    { role: "surface", tokenNames: ["color/semantic/surface/default", "color/surface/default", "color/neutral/50"], fallbackRgb: "{ r: 0.98, g: 0.98, b: 0.99 }" },
    { role: "border", tokenNames: ["color/semantic/border/default", "color/border/default", "color/neutral/200"], fallbackRgb: "{ r: 0.90, g: 0.91, b: 0.93 }" },
    { role: "muted", tokenNames: ["color/semantic/text/secondary", "color/text/secondary", "color/text/disabled"], fallbackRgb: "{ r: 0.45, g: 0.45, b: 0.50 }" },
    { role: "accent", tokenNames: ["color/semantic/actions/primary/bg/default", "color/semantic/primary", "color/primary/500"], fallbackRgb: "{ r: 0.22, g: 0.35, b: 0.96 }" },
];
/**
 * Convert a Figma color value (from a token) to an RGB string literal
 * for use in generated scripts.
 */
function tokenValueToRgbString(value) {
    if (!value || typeof value !== "object")
        return null;
    const v = value;
    if (typeof v.r !== "number" || typeof v.g !== "number" || typeof v.b !== "number")
        return null;
    return `{ r: ${v.r.toFixed(3)}, g: ${v.g.toFixed(3)}, b: ${v.b.toFixed(3)} }`;
}
function resolveDesignPalette(tokens) {
    const palette = {};
    for (const mapping of PALETTE_MAPPINGS) {
        let resolved = false;
        for (const tokenName of mapping.tokenNames) {
            const token = tokens.find((t) => t.type === "COLOR" && (t.name === tokenName || t.name.endsWith(`/${tokenName}`)));
            if (token) {
                const rgb = tokenValueToRgbString(token.value) ?? mapping.fallbackRgb;
                palette[mapping.role] = { rgb, variableId: token.id };
                resolved = true;
                break;
            }
        }
        if (!resolved) {
            palette[mapping.role] = { rgb: mapping.fallbackRgb, variableId: null };
        }
    }
    return palette;
}
/**
 * Resolve a float token (spacing, radius) value and variable ID.
 * Returns the numeric value and optionally the variable ID for binding.
 */
function resolveFloatToken(tokenName, tokens, fallback) {
    const token = tokens.find((t) => t.type === "FLOAT" && (t.name === tokenName || t.name.endsWith(`/${tokenName}`)));
    if (token && typeof token.value === "number") {
        return { value: token.value, variableId: token.id };
    }
    return { value: fallback, variableId: null };
}
//# sourceMappingURL=token-binder.js.map