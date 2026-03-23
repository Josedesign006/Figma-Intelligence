/**
 * figma_component_doc — Comprehensive design system documentation generator
 *
 * Produces Uber uSpec / Carbon Design System-quality documentation for a
 * selected Figma component or component set.  Sections: overview, anatomy,
 * variants, states, spacing & structure, color tokens, typography, usage
 * guidelines, accessibility (via APG doc), and API / props table.
 */
import { GeneratedDocumentSection } from "../spec-generator/index.js";
export interface ContentOverrides {
    overview?: string;
    purpose?: string;
    usage?: {
        whenToUse: string[];
        whenNotToUse: string[];
    };
    typesAndVariants?: string;
    variants?: Array<{
        name: string;
        purpose: string;
        emphasis: string;
        whenToUse: string;
        whenNotToUse: string;
        misuse?: string;
    }>;
    supportedCompositions?: Array<{
        name: string;
        parts: string[];
        whenToUse: string;
        constraints?: string;
    }>;
    anatomy?: Array<{
        index: number;
        name: string;
        type: string;
        description: string;
    }>;
    properties?: Array<{
        name: string;
        type: string;
        values: string[];
        defaultValue: string;
        description: string;
    }>;
    states?: Array<{
        name: string;
        visualDescription: string;
        trigger: string;
        meaning: string;
    }>;
    sizes?: Array<{
        name: string;
        useCase: string;
        minTouchTarget: string;
        context: string;
    }>;
    behaviour?: string;
    interactionRules?: string;
    contentGuidance?: string;
    spacingAndLayout?: string;
    responsive?: string;
    accessibility?: {
        semanticRole?: string;
        ariaAttributes?: string;
        keyboardInteraction?: Array<{
            key: string;
            action: string;
        }>;
        focusManagement?: string;
        screenReaderAnnouncements?: string;
        readingOrder?: string;
        touchTargets?: string;
        colorContrast?: string;
    };
    dosAndDonts?: {
        dos: string[];
        donts: string[];
    };
    implementationNotes?: string;
    qaChecklist?: string[] | Array<{
        area: string;
        verify: string;
        expected: string;
    }>;
    hierarchy?: string;
    structureAndSpacing?: string;
    relatedComponents?: Array<{
        name: string;
        relationship: string;
        whenToPrefer: string;
    }>;
}
export interface ComponentDocArgs {
    nodeId?: string;
    outputFormat: "json" | "report" | "figma-page" | "all";
    sections?: string[];
    includeVisualExamples?: boolean;
    framework?: "html" | "react" | "vue" | "angular";
    pageName?: string;
    contentOverrides?: ContentOverrides;
}
export interface SpacingEntry {
    element: string;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    itemSpacing: number;
    width: number;
    height: number;
    layoutMode: string;
    layoutSizingH: string;
    layoutSizingV: string;
}
export interface ColorTokenEntry {
    element: string;
    property: "fill" | "stroke";
    colorHex: string;
    tokenName: string;
    tokenId: string;
}
export interface TypographyEntry {
    element: string;
    characters: string;
    fontFamily: string;
    fontStyle: string;
    fontSize: number;
    lineHeightPx: number | null;
    letterSpacing: number;
    tokenName: string;
}
export interface PropsEntry {
    name: string;
    type: string;
    values: string[];
    defaultValue: string;
    description: string;
}
export interface DetailedState {
    name: string;
    visualTreatment: string;
    behaviourChange: string;
    trigger: string;
    tokenOverride: string;
    a11yImplication: string;
}
export interface AccessibilityDeep {
    semanticElement: string;
    keyboard: Array<{
        key: string;
        action: string;
    }>;
    focus: string;
    screenReader: string;
    labels: string;
    stateAnnouncements: string;
    contrast: string;
    touchTargets: string;
}
export interface RelatedComponent {
    name: string;
    relationship: string;
    whenToPrefer: string;
}
export interface DesignSystemSpec {
    componentName: string;
    nodeId: string;
    nodeType: string;
    overview: {
        description: string;
        whenToUse: string[];
        whenNotToUse: string[];
    };
    purpose: string;
    anatomy: Array<{
        index: number;
        name: string;
        type: string;
        description: string;
    }>;
    variants: Array<{
        property: string;
        values: string[];
        defaultValue: string;
    }>;
    variantsDetailed?: Array<{
        name: string;
        purpose: string;
        emphasis: string;
        whenToUse: string;
        whenNotToUse: string;
        misuse?: string;
    }>;
    supportedCompositions?: Array<{
        name: string;
        parts: string[];
        whenToUse: string;
        constraints?: string;
    }>;
    states: string[];
    statesDetailed: DetailedState[];
    sizes: Array<{
        name: string;
        useCase: string;
        minTouchTarget: string;
        context: string;
    }>;
    spacing: SpacingEntry[];
    colorTokens: ColorTokenEntry[];
    typography: TypographyEntry[];
    usageGuidelines: {
        dos: string[];
        donts: string[];
    };
    hierarchy: string;
    structureAndSpacing: string;
    behaviour: string;
    interactionRules: string;
    contentGuidance: string;
    responsive: string;
    accessibility: GeneratedDocumentSection[];
    accessibilityDeep: AccessibilityDeep;
    implementationNotes: string;
    qaChecklist: string[];
    props: PropsEntry[];
    relatedComponents: RelatedComponent[];
}
export interface ComponentDocResult {
    spec: DesignSystemSpec;
    report?: string;
    figmaPageId?: string;
    logEntryId: string;
    hint?: string;
}
export declare function componentDocHandler(args: ComponentDocArgs): Promise<ComponentDocResult>;
//# sourceMappingURL=index.d.ts.map