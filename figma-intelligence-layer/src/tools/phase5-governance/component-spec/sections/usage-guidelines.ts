/**
 * Usage Guidelines section — do's and don'ts derived from component structure
 */
import type { ExtractionResult, SpecSectionOutput, SpecSectionContent } from "../types.js";

export function buildUsageSection(data: ExtractionResult): SpecSectionOutput {
  const { snapshot, properties, anatomy, states, colorTokens, knowledge } = data;

  // If knowledge provides curated dos/donts, use those as the base
  const dos: string[] = knowledge?.dos ? [...knowledge.dos] : [];
  const donts: string[] = knowledge?.donts ? [...knowledge.donts] : [];

  // Only add generated guidance when knowledge doesn't provide curated content
  if (!knowledge?.dos || knowledge.dos.length === 0) {
    // Token-based guidance
    const hasTokens = colorTokens.some((t) => t.tokenName);
    if (hasTokens) {
      dos.push("Use the bound design tokens for all colors — never hardcode hex values.");
    } else if (colorTokens.length > 0) {
      donts.push("Hardcoded colors detected — bind all fills and strokes to design tokens before publishing.");
    }

    // Variant-based guidance
    if (properties.variantAxes.length > 0) {
      dos.push(`Use the variant properties (${properties.variantAxes.map((a) => a.name).join(", ")}) to configure the component. Don't detach instances to create custom variations.`);
    }

    // Boolean toggle guidance
    if (properties.booleanToggles.length > 0) {
      dos.push(`Use boolean toggles (${properties.booleanToggles.map((t) => t.name).join(", ")}) to show/hide optional elements instead of deleting layers.`);
    }

    // Anatomy-based guidance
    const requiredElements = anatomy.elements.filter((e) => e.role === "content-element");
    if (requiredElements.length > 0) {
      dos.push(`Keep required elements intact: ${requiredElements.map((e) => e.name).join(", ")}.`);
      donts.push("Don't remove or hide required child elements — this breaks the component's semantic structure.");
    }

    const optionalSlots = anatomy.elements.filter((e) => e.role === "optional-slot");
    if (optionalSlots.length > 0) {
      dos.push(`Toggle optional elements (${optionalSlots.map((e) => e.name).join(", ")}) via boolean properties instead of deleting them.`);
    }

    // State-based guidance
    if (states.states.length > 0) {
      dos.push(`Support all defined states (${states.states.map((s) => s.name).join(", ")}) in your implementation.`);
      donts.push("Don't create undocumented state variations — extend the variant set formally if new states are needed.");
    }

    // Layout-based guidance
    if (snapshot.layoutMode !== "NONE") {
      dos.push("Preserve auto layout settings when overriding content — don't switch to absolute positioning.");
      dos.push(`Maintain the ${snapshot.itemSpacing}px gap between child elements.`);
    }

    // Instance swap guidance
    if (properties.instanceSwaps.length > 0) {
      dos.push(`Use instance swap properties for ${properties.instanceSwaps.map((s) => s.name).join(", ")} — only swap in compatible component types.`);
      donts.push("Don't replace swap slots with unrelated components that break the visual or semantic contract.");
    }

    // General best practices
    dos.push("Test the component in both light and dark themes before publishing.");
    donts.push("Don't override internal padding or spacing values — use the component's built-in sizing properties.");
  }

  return {
    id: "usage",
    title: "Usage Guidelines",
    content: { kind: "do-dont", dos, donts },
  };
}
