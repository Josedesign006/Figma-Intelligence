"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Token Inferencer
// Takes raw pixel / color values from a ComponentManifest and snaps each
// to the nearest design-system token using the snap algorithms from
// token-utils.  This ensures generated frames use tokens, not raw values.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.inferTokens = inferTokens;
const token_utils_js_1 = require("../../../shared/token-utils.js");
/**
 * Snap raw values from a component manifest to the nearest design tokens.
 *
 * Token inference algorithm (from plan):
 *   rawSpacing  → Math.round(raw / 4) * 4 → nearest spacing token
 *   rawRadius   → snap to [0, 2, 4, 8, 12, 16, 24, 32] → nearest token
 *   rawFontSize → snap to type scale tokens → nearest token
 */
function inferTokens(manifest) {
    const spacing = (0, token_utils_js_1.snapToSpacingToken)(manifest.estimatedSpacing ?? 8);
    const ext = manifest;
    return {
        spacing,
        radius: ext.estimatedRadius != null
            ? (0, token_utils_js_1.snapToRadiusToken)(Number(ext.estimatedRadius))
            : undefined,
        fontSize: ext.estimatedFontSize != null
            ? (0, token_utils_js_1.snapToTypeToken)(Number(ext.estimatedFontSize))
            : undefined,
    };
}
//# sourceMappingURL=token-inferencer.js.map