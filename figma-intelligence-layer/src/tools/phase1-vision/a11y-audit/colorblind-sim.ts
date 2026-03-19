// ─────────────────────────────────────────────────────────────────────────────
// Color Blindness Simulator
// Simulates four color blindness profiles by applying colour-transformation
// matrices.  Re-runs contrast checks under each simulated palette.
// ─────────────────────────────────────────────────────────────────────────────

import {
  simulateColorBlindness,
  computeContrastRatio,
  meetsWCAG,
} from "../../../shared/token-utils.js";

export type CBProfile =
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "achromatopsia";

export const CB_PROFILES: readonly CBProfile[] = [
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "achromatopsia",
];

export interface CBSimResult {
  profile: CBProfile;
  simulatedFg: string;
  simulatedBg: string;
  contrastRatio: number;
  passes: boolean;
}

/**
 * Simulate colour blindness for a foreground/background pair and check
 * whether contrast still meets WCAG under each profile.
 */
export function simulateAndCheck(
  fgHex: string,
  bgHex: string,
  level: "AA" | "AAA",
  isLargeText: boolean
): CBSimResult[] {
  return CB_PROFILES.map((profile) => {
    const simulatedFg = simulateColorBlindness(fgHex, profile);
    const simulatedBg = simulateColorBlindness(bgHex, profile);
    const ratio = computeContrastRatio(simulatedFg, simulatedBg);
    const passes = meetsWCAG(ratio, level, isLargeText);
    return { profile, simulatedFg, simulatedBg, contrastRatio: ratio, passes };
  });
}

/**
 * Return the profiles under which a colour pair becomes indistinguishable
 * (contrast ratio below 1.5:1).
 */
export function findIndistinguishableProfiles(
  hex1: string,
  hex2: string
): CBProfile[] {
  return CB_PROFILES.filter((profile) => {
    const sim1 = simulateColorBlindness(hex1, profile);
    const sim2 = simulateColorBlindness(hex2, profile);
    return computeContrastRatio(sim1, sim2) < 1.5;
  });
}
