/**
 * component-spec/types.ts — All interfaces for the unified component spec tool
 */

// ─── Spec Sections ──────────────────────────────────────────────────────────

export type SpecSection =
  | "overview"
  | "anatomy"
  | "variants"
  | "states"
  | "properties"
  | "spacing"
  | "color-tokens"
  | "typography"
  | "accessibility"
  | "usage"
  | "related"
  | "size-specs"
  | "state-specs"
  | "design-tokens"
  | "interaction-rules"
  | "content-guidance"
  | "responsive"
  | "qa-criteria"
  | "type-hierarchy";

export const ALL_SECTIONS: SpecSection[] = [
  "overview",
  "variants",
  "anatomy",
  "states",
  "state-specs",
  "properties",
  "size-specs",
  "spacing",
  "color-tokens",
  "design-tokens",
  "typography",
  "type-hierarchy",
  "interaction-rules",
  "content-guidance",
  "responsive",
  "accessibility",
  "qa-criteria",
  "usage",
  "related",
];

// ─── Tool Input/Output ──────────────────────────────────────────────────────

export interface ComponentSpecArgs {
  nodeId?: string;
  outputFormat: "json" | "markdown" | "figma-page" | "all";
  sections?: SpecSection[];
  pageName?: string;
}

export interface ComponentSpecResult {
  spec: ComponentSpec;
  markdown?: string;
  figmaPageId?: string;
  logEntryId: string;
  warnings?: string[];
}

// ─── Node Snapshot (from Figma Plugin API) ──────────────────────────────────

export interface NodeSnapshot {
  id: string;
  name: string;
  type: string;
  description: string;
  width: number;
  height: number;
  layoutMode: string;
  itemSpacing: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  childCount: number;
  childNames: string[];
  textLayers: Array<{
    name: string;
    characters: string;
    fontFamily: string;
    fontStyle: string;
    fontSize: number;
    lineHeightPx: number | null;
  }>;
  fills: Array<{ type: string; label: string }>;
  strokes: Array<{ type: string; label: string }>;
  effects: Array<{ type: string; radius?: number; visible?: boolean }>;
  tokenAliases: string[];
  componentProperties: Array<{
    name: string;
    type: string;
    value: string;
    options: string[];
  }>;
  variantProperties: Record<string, string>;
  variantGroupProperties: Record<string, string[]>;
  variants: Array<{
    id: string;
    name: string;
    description: string;
    properties: Record<string, string>;
  }>;
  scanNodes?: SnapshotNode[];
}

export interface SnapshotNode {
  id: string;
  parentId: string | null;
  parentName: string | null;
  name: string;
  type: string;
  depth: number;
  visible: boolean;
  childCount: number;
  layoutMode: string;
  text: string;
  componentPropertyNames: string[];
  variantPropertyKeys: string[];
  variantPropertyValues: string[];
}

// ─── Anatomy Extraction ─────────────────────────────────────────────────────

export type ElementRole =
  | "content-element"
  | "optional-slot"
  | "fixed-sub-component"
  | "structural"
  | "decorative";

export interface ClassifiedElement {
  index: number;
  name: string;
  nodeType: string;
  role: ElementRole;
  visible: boolean;
  controlledByBoolean?: string;
  depth?: number;
  position: { x: number; y: number; w: number; h: number };
  absolutePosition?: { x: number; y: number; w: number; h: number };

  // TEXT nodes
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
  lineHeightPx?: number;
  tokenName?: string;
  characters?: string;

  // INSTANCE nodes
  componentName?: string;
  instanceOf?: string;
  variantProperties?: Record<string, string>;

  // FRAME/COMPONENT nodes
  layoutMode?: string;
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  layoutSizingH?: string;
  layoutSizingV?: string;

  // All nodes
  fills?: string[];
  strokes?: string[];
  cornerRadius?: number;
}

export interface AnatomyExtraction {
  elements: ClassifiedElement[];
  componentBounds?: { x: number; y: number; w: number; h: number };
}

// ─── Properties Extraction ──────────────────────────────────────────────────

export interface VariantAxis {
  name: string;
  values: string[];
  defaultValue: string;
}

export interface BooleanToggle {
  name: string;
  defaultValue: boolean;
  controlsElement?: string;
}

export interface InstanceSwap {
  name: string;
  currentComponentName: string;
}

export interface PropertyExtraction {
  variantAxes: VariantAxis[];
  booleanToggles: BooleanToggle[];
  instanceSwaps: InstanceSwap[];
  textProperties: Array<{ name: string; value: string }>;
}

// ─── States Extraction ──────────────────────────────────────────────────────

export interface DetectedState {
  name: string;
  source: "variant-axis" | "component-property";
  axisName: string;
}

export interface StatesExtraction {
  states: DetectedState[];
  stateAxisName: string | null;
}

// ─── Spacing Extraction ─────────────────────────────────────────────────────

export interface SpacingChildEntry {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
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
  children?: SpacingChildEntry[];
}

// ─── Color Token Extraction ─────────────────────────────────────────────────

export interface ColorTokenEntry {
  element: string;
  property: "fill" | "stroke";
  colorHex: string;
  tokenName: string;
  tokenId: string;
}

// ─── Typography Extraction ──────────────────────────────────────────────────

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

// ─── Extraction Result (all data combined) ──────────────────────────────────

export interface ExtractionResult {
  snapshot: NodeSnapshot;
  anatomy: AnatomyExtraction;
  properties: PropertyExtraction;
  states: StatesExtraction;
  spacing: SpacingEntry[];
  colorTokens: ColorTokenEntry[];
  typography: TypographyEntry[];
  componentType?: string;
  typeGuidance?: ComponentTypeGuidance;
  knowledge?: ComponentKnowledge;
}

// ─── Component Knowledge (design intelligence) ────────────────────────────

export interface ComponentKnowledge {
  description: string;

  stateSpecifications: Array<{
    state: string;
    visualChange: string;
    opacity: string;
    cursorWeb: string;
    usage: string;
  }>;

  propertyDescriptions: Record<string, string>;

  sizeSpecifications: Array<{
    size: string;
    height: string;
    paddingLR: string;
    fontSize: string;
    iconSize: string;
    borderRadius: string;
  }>;

  designTokenBindings: Array<{
    property: string;
    tokenName: string;
    role: string;
    fallback: string;
  }>;

  structureRules: string[];
  typeHierarchyRules: string[];

  interactionRules: Array<{
    event: string;
    trigger: string;
    action: string;
  }>;

  contentGuidance: string[];

  responsiveBehaviour: Array<{
    breakpoint: string;
    behavior: string;
  }>;

  accessibilitySpec: {
    intro: string;
    requirements: Array<{
      requirement: string;
      level: "A" | "AA" | "AAA";
      notes: string;
    }>;
    outro: string[];
  };

  qaAcceptanceCriteria: Array<{
    check: string;
    platform: string;
    expectedResult: string;
  }>;

  dos: string[];
  donts: string[];
}

// ─── Component Type Guidance ────────────────────────────────────────────────

export interface ComponentTypeGuidance {
  expectedElements: string[];
  expectedVariantAxes: string[];
  expectedStates: string[];
  semanticRole: string;
  wcagPattern: string;
  minTouchTarget: number;
  contrastRequirement: string;
}

// ─── Section Output ─────────────────────────────────────────────────────────

export interface SpecSectionOutput {
  id: SpecSection;
  title: string;
  content: SpecSectionContent;
}

export type SpecSectionContent =
  | { kind: "key-value"; entries: Array<{ label: string; value: string }> }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "list"; items: string[] }
  | { kind: "do-dont"; dos: string[]; donts: string[] }
  | { kind: "paragraph"; text: string }
  | { kind: "mixed"; blocks: SpecSectionContent[] }
  | { kind: "structured-data"; columns: string[]; rows: Record<string, string>[] }
  | { kind: "rules"; items: string[] };

// ─── Full Component Spec ────────────────────────────────────────────────────

export interface ComponentSpec {
  componentName: string;
  description?: string;
  nodeId: string;
  nodeType: string;
  componentType?: string;
  sections: SpecSectionOutput[];
  extraction: ExtractionResult;
}

// ─── Legacy re-exports needed by apg-doc ────────────────────────────────────

export type DocumentationSectionStyle = "bullets" | "paragraph" | "checklist";

export interface GeneratedDocumentSection {
  title: string;
  style: DocumentationSectionStyle;
  items: string[];
}

export interface GeneratedDocument {
  type: "anatomy-usage" | "accessibility" | "accessibility-annotation";
  title: string;
  summary: string;
  sections: GeneratedDocumentSection[];
}
