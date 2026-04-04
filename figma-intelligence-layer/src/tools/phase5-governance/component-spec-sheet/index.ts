/**
 * component-spec-sheet/index.ts
 *
 * Visual spec sheet generator — creates an on-canvas anatomy + properties
 * + spacing spec sheet in 3-5 seconds, similar to EightShapes Specs plugin.
 *
 * Pipeline: Extract (parallel) → Plan (CPU) → Render (1 execute call)
 */
import { getBridge } from "../../../shared/figma-bridge.js";
import { resolveTargetNodeId, captureSnapshot } from "../component-spec/extractors/snapshot.js";
import { extractAnatomy } from "../component-spec/extractors/anatomy.js";
import { extractSpacing } from "../component-spec/extractors/spacing.js";
import { computeMarkerPositions } from "../component-spec/renderers/anatomy-diagram.js";
import { buildSpecSheetScript } from "./renderer.js";
import type {
  SpecSheetArgs,
  SpecSheetResult,
  SpecSheetPlan,
  SpecSheetSection,
  PropertyAxisPlan,
  BooleanTogglePlan,
} from "./types.js";
import type { NodeSnapshot, AnatomyExtraction, SpacingEntry } from "../component-spec/types.js";

const DEFAULT_SECTIONS: SpecSheetSection[] = ["header", "anatomy", "properties", "spacing"];
const MAX_VARIANTS_DEFAULT = 6;
const MARKER_MARGIN = 60;

// ── Main handler ────────────────────────────────────────────────────────

export async function componentSpecSheetHandler(
  args: SpecSheetArgs,
): Promise<SpecSheetResult> {
  const bridge = await getBridge();

  // Phase 1: Extract (parallel)
  const nodeId = await resolveTargetNodeId(args);

  const [snapshot, anatomy, spacing] = await Promise.all([
    captureSnapshot(nodeId),
    extractAnatomy(nodeId),
    extractSpacing(nodeId),
  ]);

  // Phase 2: Plan
  const plan = buildPlan(nodeId, snapshot, anatomy, spacing, args);

  // Phase 3: Render
  const script = buildSpecSheetScript(plan);
  const result = await bridge.execute(script);

  if (!result.success) {
    throw new Error(`Spec sheet render failed: ${result.error}`);
  }

  const frameId = (result.result as { frameId: string })?.frameId || "";

  return {
    frameId,
    componentName: plan.componentName,
    sections: plan.sections,
    variantCount: plan.propertyAxes.reduce((sum, ax) => sum + ax.samples.length, 0),
    anatomyElementCount: plan.markers.length,
  };
}

// ── Plan builder ────────────────────────────────────────────────────────

function buildPlan(
  nodeId: string,
  snapshot: NodeSnapshot,
  anatomy: AnatomyExtraction,
  spacing: SpacingEntry[],
  args: SpecSheetArgs,
): SpecSheetPlan {
  const sections = args.sections ?? DEFAULT_SECTIONS;
  const maxVariants = args.maxVariantsPerAxis ?? MAX_VARIANTS_DEFAULT;
  const placement = args.placement ?? "right";

  const compW = anatomy.componentBounds?.w || snapshot.width || 200;
  const compH = anatomy.componentBounds?.h || snapshot.height || 60;

  // Variant label for header
  const variantLabel = Object.entries(snapshot.variantProperties || {})
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  // Anatomy: scale up small components (cap at 3x to avoid oversized previews)
  const MIN_DISPLAY = 120;
  const scale = Math.min(3, Math.max(1, MIN_DISPLAY / Math.min(compW, compH)));
  const displayW = Math.round(compW * scale);
  const displayH = Math.round(compH * scale);

  // Filter anatomy to direct children only (depth 1) for clean spec sheet
  const directChildren = anatomy.elements.filter(
    el => el.visible && el.position.w > 0 && el.position.h > 0 && (el.depth === undefined || el.depth === 1),
  );

  // Compute marker positions using scaled element positions
  const scaledElements = directChildren.map(el => ({
    ...el,
    position: {
      x: Math.round(el.position.x * scale),
      y: Math.round(el.position.y * scale),
      w: Math.round(el.position.w * scale),
      h: Math.round(el.position.h * scale),
    },
  }));

  // For the spec sheet, markers are placed OUTSIDE the component with leader lines.
  // Pass MARKER_MARGIN as offset so markers sit in the margin area around the clone.
  const markers = computeMarkerPositions(displayW, displayH, MARKER_MARGIN, MARKER_MARGIN, scaledElements);

  // Property axes from variantGroupProperties
  const propertyAxes: PropertyAxisPlan[] = [];
  const variantGroupProps = snapshot.variantGroupProperties || {};
  const defaultProps = snapshot.variants?.[0]?.properties || {};

  for (const [axisName, values] of Object.entries(variantGroupProps)) {
    const capped = values.slice(0, maxVariants);
    const samples = capped.map(val => {
      // Find the variant that matches this value (use defaults for other axes)
      const props = { ...defaultProps, [axisName]: val };
      const matchedVariant = snapshot.variants.find(v => {
        for (const [pk, pv] of Object.entries(props)) {
          if (v.properties[pk] !== pv) return false;
        }
        return true;
      });
      return {
        variantId: matchedVariant?.id || "",
        label: val,
        props,
      };
    });
    propertyAxes.push({ axisName, samples });
  }

  // Boolean toggles from componentProperties
  const booleanToggles: BooleanTogglePlan[] = [];
  for (const cp of snapshot.componentProperties || []) {
    if (cp.type === "BOOLEAN") {
      const cleanName = cp.name.replace(/#.*$/, "").trim();
      booleanToggles.push({
        name: cleanName,
        trueVariantId: null,
        falseVariantId: null,
      });
    }
  }

  // Placement coordinates
  const placementCoords = computePlacement(
    placement,
    snapshot.width || 200,
    snapshot.height || 200,
  );

  return {
    componentName: snapshot.name,
    variantLabel,
    sourceNodeId: nodeId,
    sourceType: snapshot.type,
    placement: placementCoords,
    componentBounds: { w: compW, h: compH },
    sections,
    anatomyElements: anatomy.elements,
    markers: markers.map(m => ({
      letter: m.letter,
      markerX: m.markerX,
      markerY: m.markerY,
      targetX: m.targetX,
      targetY: m.targetY,
      name: m.name,
      role: m.role,
    })),
    anatomyScale: scale,
    anatomyDisplayW: displayW,
    anatomyDisplayH: displayH,
    propertyAxes,
    booleanToggles,
    spacingEntries: spacing,
  };
}

function computePlacement(
  placement: string,
  sourceW: number,
  sourceH: number,
): { x: number; y: number } {
  switch (placement) {
    case "below":
      return { x: 0, y: sourceH + 100 };
    case "right":
    default:
      return { x: sourceW + 200, y: 0 };
  }
}
