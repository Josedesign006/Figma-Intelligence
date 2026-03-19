import { getBridge } from "../../../shared/figma-bridge";
import { analyzeTokenName } from "../../../shared/token-naming";

export type TokenMigrationAction = "scan" | "preview" | "apply";
export type TokenMigrationScope = "variables" | "styles" | "all";
export type TokenMigrationSchema = "compact" | "expanded";

export interface TokenMigrateArgs {
  action: TokenMigrationAction;
  scope?: TokenMigrationScope;
  collectionName?: string;
  canonicalSchema?: TokenMigrationSchema;
  renameInPlace?: boolean;
  createAliases?: boolean;
  dryRun?: boolean;
}

interface VariableCollectionSummary {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  variables: Array<{
    id: string;
    name: string;
    type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
    collectionId?: string;
  }>;
}

interface PaintStyleSummary {
  id: string;
  name: string;
  description?: string;
}

interface TextStyleSummary {
  id: string;
  name: string;
  description?: string;
}

interface EffectStyleSummary {
  id: string;
  name: string;
  description?: string;
}

interface StyleSummaryResult {
  paint?: PaintStyleSummary[];
  text?: TextStyleSummary[];
  effect?: EffectStyleSummary[];
}

export interface TokenMigrationItem {
  kind: "variable" | "style";
  subtype?: "paint" | "text" | "effect";
  id: string;
  collectionId?: string;
  collectionName?: string;
  originalName: string;
  normalizedName: string;
  suggestedName: string | null;
  confidence: number;
  safeToApply: boolean;
  reasons: string[];
  willRename: boolean;
}

export interface TokenMigrateResult {
  ok: boolean;
  action: TokenMigrationAction;
  scope: TokenMigrationScope;
  canonicalSchema: TokenMigrationSchema;
  scanned: {
    variables: number;
    styles: number;
  };
  summary: {
    proposed: number;
    safe: number;
    ambiguous: number;
    applied: number;
    aliased: number;
    skipped: number;
  };
  items: TokenMigrationItem[];
  appliedChanges: Array<{
    kind: "variable" | "style" | "variable-alias";
    id: string;
    from?: string;
    to: string;
  }>;
  notes: string[];
}

export function translateCanonicalName(name: string, schema: TokenMigrationSchema): {
  normalizedName: string;
  suggestedName: string | null;
  reasons: string[];
  confidence: number;
} {
  const analysis = analyzeTokenName(name);
  const normalizedName = analysis.normalizedName;
  let nextName = analysis.suggestedName ?? normalizedName;
  const reasons = analysis.issues.map((issue) => issue.message);
  let confidence = reasons.length > 0 ? 0.94 : 0.9;

  const transforms: Array<{ test: RegExp; replace: string; reason: string; confidence?: number }> =
    schema === "compact"
      ? [
          {
            test: /^color\/primitive\//,
            replace: "color/",
            reason: "Collapse primitive color namespace to the compact palette format.",
          },
          {
            test: /^semantic\/color\//,
            replace: "color/semantic/",
            reason: "Align semantic colors to the compact semantic color path.",
          },
          {
            test: /^typography\/size\//,
            replace: "typography/font-size/",
            reason: "Use explicit typography/font-size naming in the compact schema.",
          },
          {
            test: /^typography\/weight\//,
            replace: "typography/font-weight/",
            reason: "Use explicit typography/font-weight naming in the compact schema.",
          },
          {
            test: /^primitive\/color\//,
            replace: "color/",
            reason: "Lift legacy primitive/color tokens into the compact color namespace.",
          },
          {
            test: /^components\//,
            replace: "component/",
            reason: "Use a singular component prefix.",
          },
        ]
      : [
          {
            test: /^color\/(?!primitive\/|semantic\/)([^/]+\/.+)$/,
            replace: "color/primitive/$1",
            reason: "Expand compact color tokens into the primitive color namespace.",
          },
          {
            test: /^typography\/font-size\//,
            replace: "typography/size/",
            reason: "Use compact typography size slots in the expanded schema.",
          },
          {
            test: /^typography\/font-weight\//,
            replace: "typography/weight/",
            reason: "Use compact typography weight slots in the expanded schema.",
          },
          {
            test: /^primitive\/color\//,
            replace: "color/primitive/",
            reason: "Normalize legacy primitive/color tokens into expanded schema order.",
          },
          {
            test: /^components\//,
            replace: "component/",
            reason: "Use a singular component prefix.",
          },
        ];

  for (const transform of transforms) {
    if (!transform.test.test(nextName)) continue;
    const updated = nextName.replace(transform.test, transform.replace);
    if (updated !== nextName) {
      nextName = updated;
      reasons.push(transform.reason);
      confidence = Math.min(confidence, transform.confidence ?? 0.92);
    }
  }

  if (nextName === normalizedName) {
    return {
      normalizedName,
      suggestedName: null,
      reasons,
      confidence: Math.min(1, confidence),
    };
  }

  return {
    normalizedName,
    suggestedName: nextName,
    reasons,
    confidence: Math.min(1, confidence),
  };
}

function isAmbiguousName(name: string): string[] {
  const reasons: string[] = [];
  if (/^primitive\/color\/[^/]+\/0$/.test(name) || /^color\/[^/]+\/0$/.test(name)) {
    reasons.push("Scale value '0' is ambiguous across token systems and should be reviewed manually.");
  }
  return reasons;
}

function buildVariableConflictMap(collections: VariableCollectionSummary[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const collection of collections) {
    for (const variable of collection.variables) {
      map.set(`${collection.id}::${variable.name}`, variable.id);
    }
  }
  return map;
}

function planVariableItems(
  collections: VariableCollectionSummary[],
  schema: TokenMigrationSchema
): TokenMigrationItem[] {
  const items: TokenMigrationItem[] = [];
  const byName = buildVariableConflictMap(collections);

  for (const collection of collections) {
    for (const variable of collection.variables) {
      const translated = translateCanonicalName(variable.name, schema);
      if (!translated.suggestedName) continue;

      const ambiguityReasons = isAmbiguousName(translated.normalizedName);
      const conflictId = byName.get(`${collection.id}::${translated.suggestedName}`);
      const conflictReasons =
        conflictId && conflictId !== variable.id
          ? [`Target name '${translated.suggestedName}' already exists in collection '${collection.name}'.`]
          : [];

      const reasons = [...translated.reasons, ...ambiguityReasons, ...conflictReasons];
      items.push({
        kind: "variable",
        id: variable.id,
        collectionId: collection.id,
        collectionName: collection.name,
        originalName: variable.name,
        normalizedName: translated.normalizedName,
        suggestedName: translated.suggestedName,
        confidence: conflictReasons.length || ambiguityReasons.length ? 0.45 : translated.confidence,
        safeToApply: conflictReasons.length === 0 && ambiguityReasons.length === 0,
        reasons,
        willRename: true,
      });
    }
  }

  return items;
}

function planStyleItems(styles: StyleSummaryResult, schema: TokenMigrationSchema): TokenMigrationItem[] {
  const items: TokenMigrationItem[] = [];
  const groups: Array<["paint" | "text" | "effect", Array<{ id: string; name: string }>]> = [
    ["paint", styles.paint ?? []],
    ["text", styles.text ?? []],
    ["effect", styles.effect ?? []],
  ];

  for (const [subtype, list] of groups) {
    for (const style of list) {
      const translated = translateCanonicalName(style.name, schema);
      if (!translated.suggestedName) continue;

      const ambiguityReasons = isAmbiguousName(translated.normalizedName);
      items.push({
        kind: "style",
        subtype,
        id: style.id,
        originalName: style.name,
        normalizedName: translated.normalizedName,
        suggestedName: translated.suggestedName,
        confidence: ambiguityReasons.length ? 0.45 : translated.confidence,
        safeToApply: ambiguityReasons.length === 0,
        reasons: [...translated.reasons, ...ambiguityReasons],
        willRename: true,
      });
    }
  }

  return items;
}

async function renameStyles(
  styleItems: TokenMigrationItem[]
): Promise<Array<{ kind: "style"; id: string; from: string; to: string }>> {
  if (styleItems.length === 0) return [];

  const bridge = await getBridge();
  const payload = styleItems.map((item) => ({
    id: item.id,
    from: item.originalName,
    to: item.suggestedName,
  }));

  const exec = await bridge.execute(`
    const renames = ${JSON.stringify(payload)};
    const allStyles = [
      ...(await figma.getLocalPaintStylesAsync()),
      ...(await figma.getLocalTextStylesAsync()),
      ...(await figma.getLocalEffectStylesAsync()),
    ];
    const renamed = [];
    const skipped = [];
    for (const entry of renames) {
      const style = allStyles.find((item) => item.id === entry.id);
      if (!style || !entry.to) {
        skipped.push(entry);
        continue;
      }
      style.name = entry.to;
      renamed.push(entry);
    }
    return { renamed, skipped };
  `);

  if (!exec.success) {
    throw new Error(exec.error);
  }

  const result = exec.result as { renamed?: Array<{ id: string; from: string; to: string }> };
  return (result.renamed ?? []).map((item) => ({
    kind: "style" as const,
    id: item.id,
    from: item.from,
    to: item.to,
  }));
}

async function createVariableAliases(
  collections: VariableCollectionSummary[],
  items: TokenMigrationItem[]
): Promise<Array<{ kind: "variable-alias"; id: string; to: string }>> {
  const bridge = await getBridge();
  const collectionMap = new Map(collections.map((collection) => [collection.id, collection]));
  const aliases: Array<{ kind: "variable-alias"; id: string; to: string }> = [];

  for (const item of items) {
    if (item.kind !== "variable" || !item.collectionId) continue;
    const collection = collectionMap.get(item.collectionId);
    if (!collection || !item.suggestedName) continue;
    const variable = collection.variables.find((entry) => entry.id === item.id);
    if (!variable) continue;

    const valuesByMode = Object.fromEntries(
      collection.modes.map((mode) => [
        mode.modeId,
        { type: "VARIABLE_ALIAS", variableId: item.id },
      ])
    );

    const created = await bridge.createVariable(
      item.originalName,
      collection.id,
      variable.type,
      valuesByMode,
      `Alias created by figma_token_migrate for ${item.suggestedName}`
    ) as { id: string };

    aliases.push({
      kind: "variable-alias",
      id: created.id,
      to: item.originalName,
    });
  }

  return aliases;
}

export async function tokenMigrateHandler(args: TokenMigrateArgs): Promise<TokenMigrateResult> {
  const scope = args.scope ?? "all";
  const canonicalSchema = args.canonicalSchema ?? "compact";
  const renameInPlace = args.renameInPlace ?? args.action === "apply";
  const createAliases = args.createAliases ?? false;
  const dryRun = args.dryRun ?? args.action !== "apply";
  const bridge = await getBridge();

  const collections =
    scope === "styles"
      ? []
      : (await bridge.getVariables(undefined, "full") as VariableCollectionSummary[]).filter(
          (collection) => !args.collectionName || collection.name === args.collectionName
        );
  const styles =
    scope === "variables"
      ? {}
      : (await bridge.getStyles() as StyleSummaryResult);

  const variableItems = scope === "styles" ? [] : planVariableItems(collections, canonicalSchema);
  const styleItems = scope === "variables" ? [] : planStyleItems(styles, canonicalSchema);
  const items = [...variableItems, ...styleItems];

  const safeItems = items.filter((item) => item.safeToApply && item.suggestedName);
  const ambiguousItems = items.filter((item) => !item.safeToApply);
  const appliedChanges: Array<{ kind: "variable" | "style" | "variable-alias"; id: string; from?: string; to: string }> = [];
  const notes: string[] = [];

  if (args.action === "apply" && renameInPlace && !dryRun) {
    for (const item of safeItems.filter((entry) => entry.kind === "variable")) {
      await bridge.renameVariable(item.id, item.suggestedName!);
      appliedChanges.push({
        kind: "variable",
        id: item.id,
        from: item.originalName,
        to: item.suggestedName!,
      });
    }

    const renamedStyles = await renameStyles(safeItems.filter((entry) => entry.kind === "style"));
    appliedChanges.push(...renamedStyles);

    if (createAliases) {
      const aliases = await createVariableAliases(collections, safeItems.filter((entry) => entry.kind === "variable"));
      appliedChanges.push(...aliases);
      if (styleItems.length > 0) {
        notes.push("Style aliases are not supported; style migrations rename in place only.");
      }
    }
  } else if (args.action === "apply" && dryRun) {
    notes.push("Apply requested with dryRun enabled, so no changes were written.");
  }

  if (!renameInPlace) {
    notes.push("renameInPlace is disabled, so the result is preview-only.");
  }
  if (ambiguousItems.length > 0) {
    notes.push("Some names were flagged as ambiguous and were left for manual review.");
  }
  if (scope !== "variables" && !createAliases) {
    notes.push("Style migration currently supports rename-in-place only; alias-style compatibility is not available.");
  }

  const scannedStyleCount = (styles.paint?.length ?? 0) + (styles.text?.length ?? 0) + (styles.effect?.length ?? 0);

  return {
    ok: true,
    action: args.action,
    scope,
    canonicalSchema,
    scanned: {
      variables: collections.reduce((count, collection) => count + collection.variables.length, 0),
      styles: scannedStyleCount,
    },
    summary: {
      proposed: items.length,
      safe: safeItems.length,
      ambiguous: ambiguousItems.length,
      applied: appliedChanges.filter((change) => change.kind !== "variable-alias").length,
      aliased: appliedChanges.filter((change) => change.kind === "variable-alias").length,
      skipped: items.length - safeItems.length,
    },
    items,
    appliedChanges,
    notes,
  };
}
