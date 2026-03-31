/**
 * Deterministic property extraction — variant axes, booleans, instance swaps, text properties
 */
import type { NodeSnapshot, PropertyExtraction, VariantAxis, BooleanToggle, InstanceSwap } from "../types.js";

export function extractProperties(snapshot: NodeSnapshot): PropertyExtraction {
  const variantAxes: VariantAxis[] = [];
  const booleanToggles: BooleanToggle[] = [];
  const instanceSwaps: InstanceSwap[] = [];
  const textProperties: Array<{ name: string; value: string }> = [];

  // Extract variant axes from variantGroupProperties (COMPONENT_SET)
  for (const [property, values] of Object.entries(snapshot.variantGroupProperties)) {
    variantAxes.push({
      name: property,
      values,
      defaultValue: values[0] || "",
    });
  }

  // Process component properties
  for (const prop of snapshot.componentProperties) {
    const cleanName = prop.name.replace(/#.*$/, "").trim();

    if (prop.type === "VARIANT" && prop.options.length > 0) {
      // Only add if not already covered by variantGroupProperties
      if (!variantAxes.some((v) => v.name === prop.name)) {
        variantAxes.push({
          name: cleanName,
          values: prop.options,
          defaultValue: prop.value || prop.options[0] || "",
        });
      }
    } else if (prop.type === "BOOLEAN") {
      booleanToggles.push({
        name: cleanName,
        defaultValue: prop.value === "true",
        controlsElement: cleanName.replace(/^(show|has|is|with)\s*/i, ""),
      });
    } else if (prop.type === "INSTANCE_SWAP") {
      instanceSwaps.push({
        name: cleanName,
        currentComponentName: prop.value || "",
      });
    } else if (prop.type === "TEXT") {
      textProperties.push({
        name: cleanName,
        value: prop.value || "",
      });
    }
  }

  return { variantAxes, booleanToggles, instanceSwaps, textProperties };
}
