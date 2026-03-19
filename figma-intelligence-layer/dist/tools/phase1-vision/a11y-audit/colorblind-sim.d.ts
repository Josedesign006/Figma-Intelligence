export type CBProfile = "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia";
export declare const CB_PROFILES: readonly CBProfile[];
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
export declare function simulateAndCheck(fgHex: string, bgHex: string, level: "AA" | "AAA", isLargeText: boolean): CBSimResult[];
/**
 * Return the profiles under which a colour pair becomes indistinguishable
 * (contrast ratio below 1.5:1).
 */
export declare function findIndistinguishableProfiles(hex1: string, hex2: string): CBProfile[];
//# sourceMappingURL=colorblind-sim.d.ts.map