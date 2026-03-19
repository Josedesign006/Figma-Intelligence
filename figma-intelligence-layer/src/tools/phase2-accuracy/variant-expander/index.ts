// ─────────────────────────────────────────────────────────────────────────────
// Variant Expander
// Generates a full set of component variants by taking a cartesian product of
// the requested dimension values, cloning the base component for each
// combination, applying per-dimension token overrides, and grouping everything
// into a Figma Component Set.
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface VariantDimensions {
  state?: string[];  // e.g. ["default","hover","pressed","disabled","loading"]
  size?: string[];
  theme?: string[];
  type?: string[];
}

export interface VariantExpanderArgs {
  nodeId: string;
  dimensions: VariantDimensions;
  namingConvention: "figma" | "storybook";
  autoApplyTokens: boolean;
  arrangeInGrid?: boolean;
}

export interface VariantCombination {
  key: string;                          // rendered name
  props: Record<string, string>;        // e.g. { state: "hover", size: "md" }
  clonedNodeId?: string;
  tokenOverrides: TokenOverride[];
}

export interface TokenOverride {
  property: string;
  value: string | number;
  description: string;
}

export interface CoverageReport {
  totalCombinations: number;
  created: number;
  failed: number;
  componentSetId: string | null;
  combinations: VariantCombination[];
  logEntryId: string;
}

// ─── Naming helpers ───────────────────────────────────────────────────────────

function toFigmaName(props: Record<string, string>): string {
  // Figma convention: "Property=Value, Property2=Value2"
  return Object.entries(props)
    .map(([k, v]) => `${capitalize(k)}=${capitalize(v)}`)
    .join(", ");
}

function toStorybookName(props: Record<string, string>): string {
  // Storybook convention: "componentName--size-state-theme-type"
  return Object.values(props)
    .map((v) => v.toLowerCase().replace(/\s+/g, "-"))
    .join("--");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Cartesian product ────────────────────────────────────────────────────────

function cartesian(dimensions: VariantDimensions): Array<Record<string, string>> {
  const entries = Object.entries(dimensions).filter(
    ([, values]) => values && values.length > 0
  ) as Array<[string, string[]]>;

  if (entries.length === 0) return [{}];

  return entries.reduce<Array<Record<string, string>>>(
    (acc, [key, values]) => {
      const expanded: Array<Record<string, string>> = [];
      for (const existing of acc) {
        for (const value of values) {
          expanded.push({ ...existing, [key]: value });
        }
      }
      return expanded;
    },
    [{}]
  );
}

// ─── Per-dimension token overrides ───────────────────────────────────────────

function resolveTokenOverrides(props: Record<string, string>): TokenOverride[] {
  const overrides: TokenOverride[] = [];

  const state = props["state"]?.toLowerCase();
  const size = props["size"]?.toLowerCase();
  const theme = props["theme"]?.toLowerCase();

  if (state === "hover") {
    overrides.push({
      property: "fills[0].variableId",
      value: "{{hover-background-token}}",
      description: "background uses hover token variant",
    });
  }

  if (state === "disabled") {
    overrides.push({
      property: "opacity",
      value: 0.4,
      description: "disabled state — opacity 0.4",
    });
  }

  if (state === "loading") {
    overrides.push({
      property: "characters",
      value: "Loading...",
      description: "replace visible text with Loading…",
    });
  }

  if (state === "pressed") {
    overrides.push({
      property: "fills[0].variableId",
      value: "{{pressed-background-token}}",
      description: "background uses pressed token variant",
    });
  }

  if (size === "sm") {
    overrides.push(
      {
        property: "paddingLeft",
        value: 4,  // --space-xs
        description: "size:sm — padding reduced to --space-xs (4px)",
      },
      {
        property: "paddingRight",
        value: 4,
        description: "size:sm — padding reduced to --space-xs (4px)",
      },
      {
        property: "paddingTop",
        value: 4,
        description: "size:sm — padding reduced to --space-xs (4px)",
      },
      {
        property: "paddingBottom",
        value: 4,
        description: "size:sm — padding reduced to --space-xs (4px)",
      },
      {
        property: "style.fontSize",
        value: 14,  // --text-sm
        description: "size:sm — font size reduced to --text-sm (14px)",
      }
    );
  }

  if (size === "lg") {
    overrides.push(
      {
        property: "paddingLeft",
        value: 24,  // --space-lg
        description: "size:lg — padding increased to --space-lg (24px)",
      },
      {
        property: "paddingRight",
        value: 24,
        description: "size:lg — padding increased to --space-lg (24px)",
      },
      {
        property: "paddingTop",
        value: 16,  // --space-md
        description: "size:lg — vertical padding set to --space-md (16px)",
      },
      {
        property: "paddingBottom",
        value: 16,
        description: "size:lg — vertical padding set to --space-md (16px)",
      }
    );
  }

  if (theme === "dark") {
    overrides.push({
      property: "variableMode",
      value: "dark",
      description: "theme:dark — swap to dark variable mode",
    });
  }

  return overrides;
}

// ─── Figma script builders ────────────────────────────────────────────────────

function buildCloneScript(
  baseNodeId: string,
  variantName: string,
  overrides: TokenOverride[]
): string {
  const overrideLines: string[] = [];

  for (const o of overrides) {
    if (o.property === "opacity") {
      overrideLines.push(`  clone.opacity = ${o.value};`);
    } else if (o.property === "characters") {
      overrideLines.push(
        `  const textNodes = clone.findAll ? clone.findAll(n => n.type === 'TEXT') : [];`,
        `  for (const t of textNodes) { t.characters = ${JSON.stringify(o.value)}; }`
      );
    } else if (o.property.startsWith("padding")) {
      const field = o.property; // e.g. "paddingLeft"
      overrideLines.push(`  if ('${field}' in clone) clone.${field} = ${o.value};`);
    } else if (o.property === "variableMode") {
      // Dark mode is set on the collection; we record it as a variant property here
      overrideLines.push(`  /* variableMode:${o.value} — handled by component set variant */`);
    }
    // fills and style overrides require variable binding; we annotate for now
  }

  const overrideBlock = overrideLines.join("\n") || "  /* no overrides */";

  return `
    (async () => {
      const base = await figma.getNodeByIdAsync(${JSON.stringify(baseNodeId)});
      if (!base) throw new Error('Base node not found: ${baseNodeId}');
      const clone = base.clone();
      clone.name = ${JSON.stringify(variantName)};
      ${overrideBlock}
      // Place clone next to base temporarily
      base.parent.appendChild(clone);
      return clone.id;
    })()
  `.trim();
}

function buildComponentSetScript(componentIds: string[]): string {
  return `
    (async () => {
      const components = [];
      for (const id of ${JSON.stringify(componentIds)}) {
        const n = await figma.getNodeByIdAsync(id);
        if (n) components.push(n);
      }
      if (components.length === 0) throw new Error('No components found to group');
      const set = figma.combineAsVariants(components, figma.currentPage);
      return set.id;
    })()
  `.trim();
}

function buildGridArrangeScript(componentSetId: string, columnCount: number): string {
  const COL_WIDTH = 200;
  const ROW_HEIGHT = 150;
  const GAP = 24;

  return `
    (async () => {
      const set = await figma.getNodeByIdAsync(${JSON.stringify(componentSetId)});
      if (!set || !set.children) throw new Error('Component set not found');
      const children = [...set.children];
      children.forEach((child, i) => {
        const col = i % ${columnCount};
        const row = Math.floor(i / ${columnCount});
        child.x = col * (${COL_WIDTH} + ${GAP});
        child.y = row * (${ROW_HEIGHT} + ${GAP});
      });
      return { arranged: children.length };
    })()
  `.trim();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function variantExpanderHandler(
  args: VariantExpanderArgs
): Promise<CoverageReport> {
  const {
    nodeId,
    dimensions,
    namingConvention,
    autoApplyTokens,
    arrangeInGrid = false,
  } = args;

  if (!nodeId) throw new Error("variantExpander: `nodeId` is required.");

  const bridge = await getBridge();

  // 1. Verify the base component node exists
  const baseNode = await bridge.getNode(nodeId);
  if (!baseNode) throw new Error(`variantExpander: Node "${nodeId}" not found.`);

  // 2. Generate all combinations
  const combinations: VariantCombination[] = cartesian(dimensions).map((props) => {
    const key =
      namingConvention === "figma"
        ? toFigmaName(props)
        : toStorybookName(props);

    const tokenOverrides = autoApplyTokens ? resolveTokenOverrides(props) : [];

    return { key, props, tokenOverrides };
  });

  if (combinations.length === 0) {
    throw new Error("variantExpander: No combinations generated. Check `dimensions` input.");
  }

  // 3. Clone and apply overrides for each combination (batched in a single execute)
  let created = 0;
  let failed = 0;
  const clonedIds: string[] = [];

  // Build a single script that creates ALL clones at once
  const BATCH_SIZE = 25;
  for (let batchStart = 0; batchStart < combinations.length; batchStart += BATCH_SIZE) {
    const batch = combinations.slice(batchStart, batchStart + BATCH_SIZE);
    const cloneLines: string[] = [];
    for (const combo of batch) {
      const overrideLines: string[] = [];
      for (const o of combo.tokenOverrides) {
        if (o.property === "opacity") {
          overrideLines.push(`clone.opacity = ${o.value};`);
        } else if (o.property === "characters") {
          overrideLines.push(`var textNodes = clone.findAll(function(n) { return n.type === 'TEXT'; }); for (var ti = 0; ti < textNodes.length; ti++) { textNodes[ti].characters = ${JSON.stringify(o.value)}; }`);
        } else if (o.property.startsWith("padding")) {
          overrideLines.push(`if ('${o.property}' in clone) clone.${o.property} = ${o.value};`);
        }
      }
      cloneLines.push(`
        try {
          var clone = base.clone();
          clone.name = ${JSON.stringify(combo.key)};
          ${overrideLines.join("\n          ")}
          base.parent.appendChild(clone);
          ids.push(clone.id);
        } catch(e) { errors++; }
      `);
    }

    const batchScript = `
      (async () => {
        var base = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
        if (!base) throw new Error('Base node not found');
        var ids = [];
        var errors = 0;
        ${cloneLines.join("\n")}
        return { ids: ids, errors: errors };
      })()
    `.trim();

    try {
      const batchResult = await bridge.execute(batchScript);
      if (batchResult.success && batchResult.result) {
        const { ids, errors } = batchResult.result as { ids: string[]; errors: number };
        clonedIds.push(...ids);
        created += ids.length;
        failed += errors;
        // Assign clonedNodeId back to each combo
        for (let i = 0; i < batch.length && i < ids.length; i++) {
          batch[i].clonedNodeId = ids[i];
        }
      } else {
        failed += batch.length;
      }
    } catch {
      failed += batch.length;
    }
  }

  // 4. Group into a Component Set
  let componentSetId: string | null = null;

  if (clonedIds.length > 0) {
    try {
      const setScript = buildComponentSetScript(clonedIds);
      const setResult = await bridge.execute(setScript);

      if (setResult.success && setResult.result) {
        componentSetId = setResult.result as string;
      } else {
        console.error(`variantExpander: combineAsVariants failed: ${setResult.error}`);
      }
    } catch (err) {
      console.error("variantExpander: Exception creating component set:", err);
    }
  }

  // 5. Arrange in grid if requested
  if (arrangeInGrid && componentSetId) {
    try {
      // Determine a sensible column count (square-ish grid)
      const cols = Math.ceil(Math.sqrt(clonedIds.length));
      const gridScript = buildGridArrangeScript(componentSetId, cols);
      await bridge.execute(gridScript);
    } catch (err) {
      console.error("variantExpander: Grid arrangement failed:", err);
    }
  }

  // 6. Log the decision
  const allTokenNames = combinations
    .flatMap((c) => c.tokenOverrides.map((o) => o.property))
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const logEntry = await decisionLog.log({
    tool: "variant-expander",
    nodeIds: [nodeId, ...(componentSetId ? [componentSetId] : [])],
    rationale: `Expanded "${baseNode.name}" into ${combinations.length} variants (${Object.keys(dimensions).join(", ")}). Created ${created}, failed ${failed}. ComponentSet: ${componentSetId ?? "none"}.`,
    tokens: allTokenNames,
    reversible: true,
    metadata: {
      baseNodeId: nodeId,
      namingConvention,
      autoApplyTokens,
      arrangeInGrid,
      totalCombinations: combinations.length,
      created,
      failed,
      componentSetId,
    },
  });

  return {
    totalCombinations: combinations.length,
    created,
    failed,
    componentSetId,
    combinations,
    logEntryId: logEntry.id,
  };
}
