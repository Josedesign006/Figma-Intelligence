"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Color Blindness Simulator
// Simulates four color blindness profiles by applying colour-transformation
// matrices.  Re-runs contrast checks under each simulated palette.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.CB_PROFILES = void 0;
exports.simulateAndCheck = simulateAndCheck;
exports.findIndistinguishableProfiles = findIndistinguishableProfiles;
const token_utils_js_1 = require("../../../shared/token-utils.js");
exports.CB_PROFILES = [
    "protanopia",
    "deuteranopia",
    "tritanopia",
    "achromatopsia",
];
/**
 * Simulate colour blindness for a foreground/background pair and check
 * whether contrast still meets WCAG under each profile.
 */
function simulateAndCheck(fgHex, bgHex, level, isLargeText) {
    return exports.CB_PROFILES.map((profile) => {
        const simulatedFg = (0, token_utils_js_1.simulateColorBlindness)(fgHex, profile);
        const simulatedBg = (0, token_utils_js_1.simulateColorBlindness)(bgHex, profile);
        const ratio = (0, token_utils_js_1.computeContrastRatio)(simulatedFg, simulatedBg);
        const passes = (0, token_utils_js_1.meetsWCAG)(ratio, level, isLargeText);
        return { profile, simulatedFg, simulatedBg, contrastRatio: ratio, passes };
    });
}
/**
 * Return the profiles under which a colour pair becomes indistinguishable
 * (contrast ratio below 1.5:1).
 */
function findIndistinguishableProfiles(hex1, hex2) {
    return exports.CB_PROFILES.filter((profile) => {
        const sim1 = (0, token_utils_js_1.simulateColorBlindness)(hex1, profile);
        const sim2 = (0, token_utils_js_1.simulateColorBlindness)(hex2, profile);
        return (0, token_utils_js_1.computeContrastRatio)(sim1, sim2) < 1.5;
    });
}
//# sourceMappingURL=colorblind-sim.js.map