/**
 * component-spec-sheet/types.ts — Interfaces for the visual spec sheet tool
 */
import type {
  AnatomyExtraction,
  NodeSnapshot,
  SpacingEntry,
  ClassifiedElement,
} from "../component-spec/types.js";

// ─── Tool Input ────────────────────────────────────────────────────────────

export type SpecSheetSection = "header" | "anatomy" | "properties" | "spacing";

export interface SpecSheetArgs {
  nodeId?: string;
  sections?: SpecSheetSection[];
  maxVariantsPerAxis?: number;
  placement?: "right" | "below" | "new-page";
}

// ─── Planning ──────────────────────────────────────────────────────────────

export interface MarkerPlan {
  letter: string;
  markerX: number;
  markerY: number;
  targetX: number;
  targetY: number;
  name: string;
  role: string;
}

export interface VariantSample {
  variantId: string;
  label: string;
  props: Record<string, string>;
}

export interface PropertyAxisPlan {
  axisName: string;
  samples: VariantSample[];
}

export interface BooleanTogglePlan {
  name: string;
  trueVariantId: string | null;
  falseVariantId: string | null;
}

export interface SpecSheetPlan {
  componentName: string;
  variantLabel: string;
  sourceNodeId: string;
  sourceType: string;
  placement: { x: number; y: number };
  componentBounds: { w: number; h: number };

  sections: SpecSheetSection[];

  // Anatomy
  anatomyElements: ClassifiedElement[];
  markers: MarkerPlan[];
  anatomyScale: number;
  anatomyDisplayW: number;
  anatomyDisplayH: number;

  // Properties
  propertyAxes: PropertyAxisPlan[];
  booleanToggles: BooleanTogglePlan[];

  // Spacing
  spacingEntries: SpacingEntry[];
}

// ─── Tool Output ───────────────────────────────────────────────────────────

export interface SpecSheetResult {
  frameId: string;
  componentName: string;
  sections: SpecSheetSection[];
  variantCount: number;
  anatomyElementCount: number;
}

// ─── Re-exports for convenience ────────────────────────────────────────────

export type { AnatomyExtraction, NodeSnapshot, SpacingEntry, ClassifiedElement };
