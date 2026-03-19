export type ContainerKind = "navigation bar" | "card" | "form" | "button" | "grid" | "list item" | "modal" | "section";
export interface AutoLayoutSpec {
    direction: "HORIZONTAL" | "VERTICAL" | "WRAP";
    primaryAxisSizingMode: "FIXED" | "AUTO";
    counterAxisSizingMode: "FIXED" | "AUTO";
    paddingToken: string;
    gapToken: string;
    paddingValue: number;
    gapValue: number;
}
/** Spacing token name → px */
export declare const SPACE: Record<string, number>;
/**
 * Container type → recommended Auto Layout + token settings.
 *
 * From the plan:
 *   Navigation bar  → Horizontal, Fill W / Hug H, --space-md
 *   Card            → Vertical,   Fill W / Hug H, --space-lg
 *   Form            → Vertical,   Fill W / Hug H, --space-md gap
 *   Button          → Horizontal, Hug W / Hug H,  --space-sm × --space-md
 *   Grid container  → Wrap,       Fill W / Hug H, --space-md gap
 *   List item       → Horizontal, Fill W / Hug H, --space-sm gap
 *   Modal           → Vertical,   Fixed W / Hug H, --space-xl padding
 *   Page section    → Vertical,   Fill W / Hug H, --space-2xl padding
 */
export declare const CONTAINER_SPECS: Record<ContainerKind, AutoLayoutSpec>;
//# sourceMappingURL=container-patterns.d.ts.map