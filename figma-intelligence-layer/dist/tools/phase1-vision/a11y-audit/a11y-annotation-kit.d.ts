/**
 * Accessibility Annotation Kit — Constants & Types
 * Defines the visual specs for 7 annotation types: Focus Order, Reading Order,
 * Input, Landmark, Heading, Link, Button.
 *
 * Each type has 3 visual components:
 *   1. Stamp — pill badge pinned to element edge
 *   2. Lasso — dotted border rectangle highlighting the element
 *   3. Details Card — property table with type-specific fields
 */
export interface AnnotationColor {
    fill: {
        r: number;
        g: number;
        b: number;
    };
    text: {
        r: number;
        g: number;
        b: number;
    };
    stroke: {
        r: number;
        g: number;
        b: number;
    };
}
export declare const ANNOTATION_COLORS: Record<string, AnnotationColor>;
export interface AnnotationTypeDef {
    key: string;
    label: string;
    icon: string;
    showNumber: boolean;
    detailsTitle: string;
    detailsFields: string[];
}
export declare const ANNOTATION_TYPES: Record<string, AnnotationTypeDef>;
export declare const STAMP_SPECS: {
    height: number;
    paddingH: number;
    paddingV: number;
    cornerRadius: number;
    fontSize: number;
    fontFamily: string;
    fontFallback: string;
    gap: number;
    lassoPadding: number;
    lassoStrokeWidth: number;
    lassoDashPattern: number[];
    lassoCornerRadius: number;
    connectorStrokeWidth: number;
    connectorDashPattern: number[];
    markerSize: number;
    markerFontSize: number;
    markerColor: {
        r: number;
        g: number;
        b: number;
    };
    markerTextColor: {
        r: number;
        g: number;
        b: number;
    };
    markerStrokeColor: {
        r: number;
        g: number;
        b: number;
    };
    markerStrokeWeight: number;
};
export declare const DETAILS_CARD_SPECS: {
    width: number;
    headerHeight: number;
    rowHeight: number;
    padding: number;
    fontSize: number;
    fontSizeBold: number;
    fontFamily: string;
    fontFallback: string;
    cornerRadius: number;
    borderWidth: number;
    bgColor: {
        r: number;
        g: number;
        b: number;
    };
    textColor: {
        r: number;
        g: number;
        b: number;
    };
    labelColor: {
        r: number;
        g: number;
        b: number;
    };
    dividerColor: {
        r: number;
        g: number;
        b: number;
    };
    shadowColor: {
        r: number;
        g: number;
        b: number;
        a: number;
    };
};
export type AnnotationTypeKey = "focus-order" | "reading-order" | "input" | "landmark" | "heading" | "link" | "button";
/** Map inferred ARIA role to the annotation type(s) it triggers. */
export declare function roleToAnnotationType(role: string): AnnotationTypeKey | null;
/** Infer input sub-type from element name for Details card. */
export declare function inferInputType(name: string): string;
//# sourceMappingURL=a11y-annotation-kit.d.ts.map