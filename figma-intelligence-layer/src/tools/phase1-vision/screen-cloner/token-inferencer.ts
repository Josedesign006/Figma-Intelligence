// ─────────────────────────────────────────────────────────────────────────────
// Token Inferencer
// Takes raw pixel / color values from a ComponentManifest and snaps each
// to the nearest design-system token using the snap algorithms from
// token-utils.  This ensures generated frames use tokens, not raw values.
// ─────────────────────────────────────────────────────────────────────────────

import { ComponentManifest, TokenRef } from "../../../shared/types.js";
import { snapToSpacingToken, snapToRadiusToken, snapToTypeToken } from "../../../shared/token-utils.js";

export interface InferredTokens {
  spacing: TokenRef;
  radius?: TokenRef;
  fontSize?: TokenRef;
}

/**
 * Snap raw values from a component manifest to the nearest design tokens.
 *
 * Token inference algorithm (from plan):
 *   rawSpacing  → Math.round(raw / 4) * 4 → nearest spacing token
 *   rawRadius   → snap to [0, 2, 4, 8, 12, 16, 24, 32] → nearest token
 *   rawFontSize → snap to type scale tokens → nearest token
 */
export function inferTokens(manifest: ComponentManifest): InferredTokens {
  const spacing = snapToSpacingToken(manifest.estimatedSpacing ?? 8);

  const ext = manifest as unknown as Record<string, unknown>;

  return {
    spacing,
    radius: ext.estimatedRadius != null
      ? snapToRadiusToken(Number(ext.estimatedRadius))
      : undefined,
    fontSize: ext.estimatedFontSize != null
      ? snapToTypeToken(Number(ext.estimatedFontSize))
      : undefined,
  };
}
