/**
 * figma_taxonomy_docs — Living concept taxonomy documentation
 *
 * Generates documentation for the semantic token naming convention by
 * cross-referencing the concept taxonomy with actual Figma variables.
 * Supports markdown, JSON, and Figma page output formats.
 *
 * The Figma page output supports auto-sync: when variables change in the
 * file, the documentation page updates automatically.
 */

import { getBridge } from "../../../shared/figma-bridge.js";
import {
  CONCEPT_TAXONOMY,
  GRAMMAR,
  getConceptById,
  getRequiredTokenPaths,
  getAllTokenPaths,
  type ConceptDefinition,
} from "../../../shared/concept-taxonomy.js";
import { renderMarkdown } from "./renderers/markdown.js";
import { renderJson } from "./renderers/json.js";
import { renderFigmaPage } from "./renderers/figma-page.js";
import { renderNamingGuide } from "./renderers/naming-guide.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TaxonomyDocsArgs {
  outputFormat: "markdown" | "json" | "figma" | "naming-guide";
  concepts?: string[];
  includeTokenAnatomy?: boolean;
  showCoverage?: boolean;
  autoSync?: boolean;
  pageName?: string;
}

export interface TaxonomyDocsResult {
  ok: boolean;
  format: TaxonomyDocsArgs["outputFormat"];
  conceptCount: number;
  tokenCount: number;
  output: string | TaxonomyDocsJsonOutput;
  coverage: ConceptCoverage[];
  notes: string[];
  autoSyncEnabled?: boolean;
  pageId?: string;
}

export interface ConceptCoverage {
  conceptId: string;
  conceptName: string;
  purpose: string;
  status: "full" | "partial" | "missing";
  expectedTokens: string[];
  foundTokens: string[];
  missingTokens: string[];
  /** Maps expected token path → actual file token name that matched (for fuzzy matches) */
  matchedFileTokens: Record<string, string>;
  typicalForms: string[];
  validStates: string[];
  validVariants: string[];
}

export interface TaxonomyDocsJsonOutput {
  generatedAt: string;
  grammar: typeof GRAMMAR;
  concepts: ConceptCoverage[];
  totalExpected: number;
  totalFound: number;
  totalMissing: number;
  tokenValues: Record<string, TokenValueSnapshot>;
}

export interface TokenValueSnapshot {
  name: string;
  type: string;
  collection: string;
  values: Record<string, unknown>;
}

// ─── Core Logic ─────────────────────────────────────────────────────────────

interface RawVariable {
  id: string;
  name: string;
  type: string;
  resolvedType?: string;
  description?: string;
  valuesByMode?: Record<string, unknown>;
}

interface RawCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  variables: RawVariable[];
}

/**
 * Build a set of all token names present in the Figma file.
 * Also builds a map of name → snapshot for value rendering.
 */
function indexFileTokens(collections: RawCollection[]): {
  tokenNames: Set<string>;
  snapshots: Record<string, TokenValueSnapshot>;
} {
  const tokenNames = new Set<string>();
  const snapshots: Record<string, TokenValueSnapshot> = {};

  for (const coll of collections) {
    for (const v of coll.variables) {
      const name = v.name;
      tokenNames.add(name);

      // Also index with common prefix variations for fuzzy matching
      const segments = name.split("/");
      if (segments.length > 2) {
        // Allow suffix matching: "actions/primary/bg/default" matches "color/semantic/actions/primary/bg/default"
        tokenNames.add(segments.slice(1).join("/"));
        tokenNames.add(segments.slice(2).join("/"));
      }

      snapshots[name] = {
        name,
        type: v.resolvedType ?? v.type,
        collection: coll.name,
        values: v.valuesByMode ?? {},
      };
    }
  }

  return { tokenNames, snapshots };
}

/**
 * Check which expected tokens exist for each concept.
 */
function computeCoverage(
  concepts: ConceptDefinition[],
  tokenNames: Set<string>,
): ConceptCoverage[] {
  return concepts.map((concept) => {
    const allPaths = getAllTokenPaths(concept.id);
    const requiredPaths = getRequiredTokenPaths(concept.id);

    const foundTokens: string[] = [];
    const missingTokens: string[] = [];
    const matchedFileTokens: Record<string, string> = {};

    for (const path of allPaths) {
      const match = tokenNameMatch(path, tokenNames);
      if (match) {
        foundTokens.push(path);
        if (match !== path) {
          matchedFileTokens[path] = match;
        }
      } else {
        missingTokens.push(path);
      }
    }

    // Coverage status based on required tokens
    const requiredFound = requiredPaths.filter((p) => tokenNameMatch(p, tokenNames) !== null);
    let status: ConceptCoverage["status"];
    if (requiredFound.length === requiredPaths.length) {
      status = "full";
    } else if (requiredFound.length > 0 || foundTokens.length > 0) {
      status = "partial";
    } else {
      status = "missing";
    }

    return {
      conceptId: concept.id,
      conceptName: concept.id.charAt(0).toUpperCase() + concept.id.slice(1),
      purpose: concept.purpose,
      status,
      expectedTokens: allPaths,
      foundTokens,
      missingTokens,
      matchedFileTokens,
      typicalForms: concept.typicalForms,
      validStates: concept.validStates,
      validVariants: concept.validVariants,
    };
  });
}

// ─── Semantic keyword synonyms for fuzzy role matching ────────────────────
// Maps each semantic keyword to a set of equivalent terms found in real
// design-system token names (Carbon, MUI, Ant, Fluent, Polaris, etc.).

const KEYWORD_SYNONYMS: Record<string, string[]> = {
  // Concept synonyms
  actions:    ["action", "actions", "btn", "button", "cta", "link"],
  field:      ["field", "input", "text-input", "textfield", "form", "select", "textarea"],
  surface:    ["surface", "card", "panel", "container", "paper", "well", "layer", "bg"],
  navigation: ["nav", "navigation", "tab", "tabs", "breadcrumb", "sidebar", "appbar", "navbar"],
  feedback:   ["feedback", "alert", "toast", "banner", "snackbar", "notification", "callout", "message"],
  // Property synonyms
  bg:         ["bg", "background", "fill", "surface", "base"],
  text:       ["text", "label", "foreground", "fg", "content", "on"],
  icon:       ["icon", "glyph", "symbol"],
  border:     ["border", "stroke", "outline", "divider", "separator", "edge"],
  ring:       ["ring", "focus-ring", "outline", "focus"],
  shadow:     ["shadow", "elevation", "drop-shadow", "box-shadow"],
  inset:      ["inset", "padding", "pad", "spacing", "inner"],
  gap:        ["gap", "gutter", "stack", "spacing"],
  // State synonyms
  hover:      ["hover", "hovered", "over"],
  active:     ["active", "pressed", "down", "tap"],
  focus:      ["focus", "focused", "keyboard"],
  disabled:   ["disabled", "inactive", "muted", "dimmed"],
  // Variant synonyms
  primary:    ["primary", "main", "brand", "accent", "key"],
  secondary:  ["secondary", "subtle", "alt", "alternative"],
  ghost:      ["ghost", "text", "plain", "minimal", "bare", "link"],
  destructive:["destructive", "danger", "error", "critical", "negative", "red"],
};

/**
 * Extract semantic keywords from a token path.
 * E.g. "color/semantic/actions/primary/bg/default" → ["color","semantic","actions","primary","bg","default"]
 */
function extractKeywords(path: string): string[] {
  return path
    .toLowerCase()
    .split(/[\/\-_.]+/)
    .filter(Boolean);
}

/**
 * Check if a candidate token matches the semantic role described by `path`
 * by checking whether the candidate contains synonyms for the key segments.
 */
function semanticKeywordMatch(expectedPath: string, candidateName: string): boolean {
  const expectedKw = extractKeywords(expectedPath);
  const candidateNorm = candidateName.toLowerCase().replace(/[\/\-_.]+/g, " ");

  // Identify the "meaningful" keywords from the expected path —
  // skip structural words like "semantic", "default", "control"
  const STRUCTURAL = new Set(["semantic", "default", "control", "md", "sm", "lg"]);
  const meaningfulKw = expectedKw.filter((kw) => !STRUCTURAL.has(kw));

  if (meaningfulKw.length === 0) return false;

  // For each meaningful keyword, check if the candidate contains
  // that keyword or any of its synonyms
  let matchCount = 0;
  for (const kw of meaningfulKw) {
    const synonyms = KEYWORD_SYNONYMS[kw] ?? [kw];
    const allTerms = [kw, ...synonyms];
    if (allTerms.some((term) => candidateNorm.includes(term))) {
      matchCount++;
    }
  }

  // Require at least 2 meaningful keyword matches (or all if fewer than 2)
  const threshold = Math.min(2, meaningfulKw.length);
  return matchCount >= threshold;
}

/**
 * Check if a token name exists in the file tokens.
 * Uses three strategies in order:
 * 1. Exact match
 * 2. Suffix / normalized match
 * 3. Semantic keyword match (catches tokens named differently but serving the same role)
 *
 * Returns the matched file token name, or null if no match.
 */
function tokenNameMatch(path: string, tokenNames: Set<string>): string | null {
  // 1. Exact match
  if (tokenNames.has(path)) return path;

  // 2. Suffix match — some files prefix with collection name
  for (const existing of tokenNames) {
    if (existing.endsWith(`/${path}`) || existing.endsWith(path)) return existing;
  }

  // 3. Normalized comparison
  const normalized = path.toLowerCase().replace(/[\/\-_]/g, "");
  for (const existing of tokenNames) {
    const n = existing.toLowerCase().replace(/[\/\-_]/g, "");
    if (n === normalized || n.endsWith(normalized)) return existing;
  }

  // 4. Semantic keyword matching — find a token that semantically serves the same role
  for (const existing of tokenNames) {
    if (semanticKeywordMatch(path, existing)) return existing;
  }

  return null;
}

/**
 * Check if a token name exists in the file tokens, with fuzzy matching.
 */
function tokenNameExists(path: string, tokenNames: Set<string>): boolean {
  return tokenNameMatch(path, tokenNames) !== null;
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function taxonomyDocsHandler(args: TaxonomyDocsArgs): Promise<TaxonomyDocsResult> {
  const bridge = await getBridge();
  const notes: string[] = [];

  // Fetch actual tokens from the Figma file
  let collections: RawCollection[] = [];
  try {
    collections = (await bridge.getVariables(undefined, "full")) as unknown as RawCollection[];
  } catch {
    notes.push("Could not fetch Figma variables — coverage report will show all tokens as missing.");
  }

  const { tokenNames, snapshots } = indexFileTokens(collections);
  notes.push(`Indexed ${tokenNames.size} token names from ${collections.length} collections.`);

  // Filter concepts if requested
  let concepts = CONCEPT_TAXONOMY;
  if (args.concepts?.length) {
    const filter = new Set(args.concepts.map((c) => c.toLowerCase()));
    concepts = concepts.filter((c) => filter.has(c.id));
    if (concepts.length === 0) {
      return {
        ok: false,
        format: args.outputFormat,
        conceptCount: 0,
        tokenCount: 0,
        output: "No matching concepts found. Available: " + CONCEPT_TAXONOMY.map((c) => c.id).join(", "),
        coverage: [],
        notes: ["Filter matched 0 concepts."],
      };
    }
  }

  // Compute coverage
  const coverage = computeCoverage(concepts, tokenNames);
  const totalExpected = coverage.reduce((sum, c) => sum + c.expectedTokens.length, 0);
  const totalFound = coverage.reduce((sum, c) => sum + c.foundTokens.length, 0);

  // Render based on format
  let output: string | TaxonomyDocsJsonOutput;
  let pageId: string | undefined;
  let autoSyncEnabled = false;

  switch (args.outputFormat) {
    case "markdown":
      output = renderMarkdown(coverage, snapshots, {
        includeTokenAnatomy: args.includeTokenAnatomy ?? true,
        showCoverage: args.showCoverage ?? true,
      });
      break;

    case "json":
      output = renderJson(coverage, snapshots, totalExpected, totalFound);
      break;

    case "naming-guide":
      output = renderNamingGuide(coverage);
      break;

    case "figma": {
      const figmaOpts = {
        pageName: args.pageName ?? "Token Taxonomy",
        includeTokenAnatomy: args.includeTokenAnatomy ?? true,
        showCoverage: args.showCoverage ?? true,
        autoSync: args.autoSync ?? false,
      };
      const result = await renderFigmaPage(bridge, coverage, snapshots, figmaOpts);
      pageId = result.pageId;
      autoSyncEnabled = result.autoSyncEnabled;
      output = `Figma page "${figmaOpts.pageName}" created with ${concepts.length} concepts. Page ID: ${pageId}`;

      // Register auto-sync handler on the bridge
      if (autoSyncEnabled && "setTaxonomyAutoSyncHandler" in bridge) {
        const syncBridge = bridge as unknown as { setTaxonomyAutoSyncHandler: (h: (() => Promise<void>) | null) => void };
        syncBridge.setTaxonomyAutoSyncHandler(async () => {
          // Re-fetch tokens, recompute coverage, re-render page
          let freshCollections: RawCollection[] = [];
          try {
            freshCollections = (await bridge.getVariables(undefined, "full")) as unknown as RawCollection[];
          } catch { /* ignore — page will show all missing */ }
          const fresh = indexFileTokens(freshCollections);
          const freshCoverage = computeCoverage(concepts, fresh.tokenNames);
          await renderFigmaPage(bridge, freshCoverage, fresh.snapshots, figmaOpts);
        });
        notes.push("Auto-sync enabled: documentation will update when variables change.");
      }
      break;
    }
  }

  return {
    ok: true,
    format: args.outputFormat,
    conceptCount: concepts.length,
    tokenCount: totalFound,
    output,
    coverage,
    notes,
    autoSyncEnabled,
    pageId,
  };
}
