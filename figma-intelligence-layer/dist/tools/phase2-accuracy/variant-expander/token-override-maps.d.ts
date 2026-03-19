export interface TokenOverride {
    property: string;
    token: string;
    rawValue?: string | number;
}
export type OverrideMap = Record<string, TokenOverride[]>;
/**
 * State dimension overrides.
 *
 * From the plan:
 *   hover    → background: --color-primary-hover
 *   disabled → opacity: 0.4, pointer-events: none
 *   loading  → icon: Spinner, text: "Loading..."
 */
export declare const STATE_OVERRIDES: OverrideMap;
/**
 * Size dimension overrides.
 *
 * From the plan:
 *   sm → padding: --space-xs --space-sm, fontSize: --text-sm
 *   md → defaults
 *   lg → padding: --space-md --space-lg, fontSize: --text-lg
 */
export declare const SIZE_OVERRIDES: OverrideMap;
/**
 * Theme dimension overrides.
 *
 * From the plan:
 *   dark → background: --color-surface-dark, text: --color-text-dark
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