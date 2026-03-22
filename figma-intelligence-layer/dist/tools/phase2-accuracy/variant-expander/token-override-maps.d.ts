export interface TokenOverride {
    property: string;
    token: string;
    rawValue?: string | number;
}
export type OverrideMap = Record<string, TokenOverride[]>;
/**
 * State dimension overrides.
 */
export declare const STATE_OVERRIDES: OverrideMap;
/**
 * Size dimension overrides.
 * All heights on 8px grid: xs=24, sm=32, md=40, lg=48, xl=56
 */
export declare const SIZE_OVERRIDES: OverrideMap;
/**
 * Theme dimension overrides.
 */
export declare const THEME_OVERRIDES: OverrideMap;
/**
 * Type / variant-purpose dimension overrides.
 */
export declare const TYPE_OVERRIDES: OverrideMap;
/** All dimension maps for convenient iteration. */
export declare const DIMENSION_OVERRIDES: {
    readonly state: OverrideMap;
    readonly size: OverrideMap;
    readonly theme: OverrideMap;
    readonly type: OverrideMap;
};
//# sourceMappingURL=token-override-maps.d.ts.map