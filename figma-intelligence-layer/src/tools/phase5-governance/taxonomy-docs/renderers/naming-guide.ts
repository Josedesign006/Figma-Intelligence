/**
 * Naming Guide renderer for taxonomy documentation.
 * Generates a human-readable reference document that teaches contributors
 * how to name tokens from scratch — grammar rules, allowed values per segment,
 * worked examples per concept, and common mistakes to avoid.
 */

import {
  GRAMMAR,
  CONCEPT_TAXONOMY,
  generateTokenName,
  type ConceptDefinition,
} from "../../../../shared/concept-taxonomy.js";
import type { ConceptCoverage } from "../index.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Pick representative examples for a concept across its variants and states. */
function buildWorkedExamples(concept: ConceptDefinition): string[] {
  const examples: string[] = [];
  const conceptSlug = concept.id === "action" ? "actions" : concept.id;

  // 1. Basic default token
  const firstRole = concept.tokenRoles.find((r) => r.required);
  if (firstRole) {
    examples.push(
      generateTokenName(firstRole.category, conceptSlug, firstRole.property, undefined, "default"),
    );
  }

  // 2. With a variant (pick first non-default variant)
  const variant = concept.validVariants.find((v) => v !== "default");
  if (variant && firstRole) {
    examples.push(
      generateTokenName(firstRole.category, conceptSlug, firstRole.property, variant, "default"),
    );
  }

  // 3. With a non-default state
  const state = concept.validStates.find((s) => s !== "default");
  if (state && firstRole) {
    examples.push(
      generateTokenName(firstRole.category, conceptSlug, firstRole.property, undefined, state),
    );
  }

  // 4. Different property (secondary role)
  const secondRole = concept.tokenRoles.find(
    (r) => r !== firstRole && r.required,
  );
  if (secondRole) {
    examples.push(
      generateTokenName(secondRole.category, conceptSlug, secondRole.property, undefined, "default"),
    );
  }

  return examples;
}

/** Build a "wrong → right" pair for common mistakes. */
function buildMistakeExamples(concept: ConceptDefinition): Array<{ wrong: string; right: string; reason: string }> {
  const mistakes: Array<{ wrong: string; right: string; reason: string }> = [];
  const slug = concept.id === "action" ? "actions" : concept.id;
  const firstRole = concept.tokenRoles.find((r) => r.required);
  if (!firstRole) return mistakes;

  // Mistake: uppercase
  mistakes.push({
    wrong: `${firstRole.category}/${slug.charAt(0).toUpperCase() + slug.slice(1)}/${firstRole.property}/default`,
    right: `${firstRole.category}/${slug}/${firstRole.property}/default`,
    reason: "All segments must be lowercase",
  });

  // Mistake: using dots or dashes as separators
  mistakes.push({
    wrong: `${firstRole.category}.${slug}.${firstRole.property}.default`,
    right: `${firstRole.category}/${slug}/${firstRole.property}/default`,
    reason: `Use \`/\` as the separator, not \`.\` or \`-\``,
  });

  // Mistake: skipping category
  if (concept.validVariants.length > 0) {
    const v = concept.validVariants[0];
    mistakes.push({
      wrong: `${slug}/${v}/${firstRole.property}/default`,
      right: `${firstRole.category}/${slug}/${v}/${firstRole.property}/default`,
      reason: "Token names must start with a category segment",
    });
  }

  // Mistake: invalid state
  mistakes.push({
    wrong: `${firstRole.category}/${slug}/${firstRole.property}/highlighted`,
    right: `${firstRole.category}/${slug}/${firstRole.property}/hover`,
    reason: `"highlighted" is not a valid state — use one of: ${concept.validStates.join(", ")}`,
  });

  return mistakes;
}

// ─── Main Renderer ──────────────────────────────────────────────────────────

export function renderNamingGuide(coverage: ConceptCoverage[]): string {
  const lines: string[] = [];
  const now = new Date().toISOString().split("T")[0];

  // ── Title ──
  lines.push("# Token Naming Convention Reference");
  lines.push("");
  lines.push(`> A practical guide for designers and developers to name semantic tokens correctly.`);
  lines.push(`> Generated ${now}. Re-run \`figma_taxonomy_docs\` with \`outputFormat: "naming-guide"\` to refresh.`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── 1. Grammar Rules ──
  lines.push("## 1. Grammar Rules");
  lines.push("");
  lines.push("Every semantic token follows a strict slash-delimited grammar. There are two patterns:");
  lines.push("");
  lines.push("### Semantic Token");
  lines.push("```");
  lines.push(GRAMMAR.pattern);
  lines.push("```");
  lines.push("");
  lines.push("### Component Alias Token");
  lines.push("```");
  lines.push(GRAMMAR.componentPattern);
  lines.push("```");
  lines.push("");
  lines.push("**Rules:**");
  lines.push("- All segments are **lowercase**, **kebab-case** where multi-word");
  lines.push("- The separator is always `/` (forward slash)");
  lines.push("- Segments in `[brackets]` are optional — omit them entirely, don't leave blanks");
  lines.push("- A `semantic` prefix between category and concept is used in file organization (e.g. `color/semantic/actions/...`)");
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── 2. Allowed Values ──
  lines.push("## 2. Allowed Values per Segment");
  lines.push("");

  // Categories
  lines.push("### Categories");
  lines.push("");
  lines.push("| Category | When to use |");
  lines.push("|----------|-------------|");
  lines.push("| `color` | Fill, text, icon, border, and ring colors |");
  lines.push("| `radius` | Corner rounding |");
  lines.push("| `space` | Padding (inset) and gap between elements |");
  lines.push("| `shadow` | Box shadow / elevation |");
  lines.push("| `border` | Border shorthand (color + width combined) |");
  lines.push("| `border-width` | Stroke thickness only |");
  lines.push("| `opacity` | Transparency levels |");
  lines.push("| `typography` | Font size, weight, line-height, letter-spacing |");
  lines.push("| `motion` | Duration and easing curves |");
  lines.push("| `z-index` | Stacking order |");
  lines.push("| `icon-size` | Icon dimensions |");
  lines.push("");

  // Properties
  lines.push("### Properties");
  lines.push("");
  lines.push("| Property | Typical categories | Meaning |");
  lines.push("|----------|--------------------|---------|");
  lines.push("| `background` / `bg` | color | Fill color |");
  lines.push("| `text` | color | Text / label color |");
  lines.push("| `icon` | color | Icon foreground color |");
  lines.push("| `border` | color, border | Border / stroke color |");
  lines.push("| `ring` | color | Focus ring color |");
  lines.push("| `shadow` | shadow | Box shadow value |");
  lines.push("| `inset` | space | Inner padding |");
  lines.push("| `gap` | space | Spacing between children |");
  lines.push("| `corner-radius` | radius | Border radius |");
  lines.push("| `font-size` | typography | Type scale |");
  lines.push("| `font-weight` | typography | Weight (regular, bold, etc.) |");
  lines.push("| `line-height` | typography | Leading |");
  lines.push("| `letter-spacing` | typography | Tracking |");
  lines.push("| `duration` | motion | Animation / transition time |");
  lines.push("| `easing` | motion | Timing function |");
  lines.push("| `foreground` | color | General foreground (icons, illustrations) |");
  lines.push("| `indicator` | color | Active/progress indicator |");
  lines.push("| `backdrop` | opacity | Overlay backdrop opacity |");
  lines.push("");

  // States
  lines.push("### States");
  lines.push("");
  lines.push("| State | Meaning |");
  lines.push("|-------|---------|");
  lines.push("| `default` | Resting / idle state |");
  lines.push("| `hover` | Pointer over the element |");
  lines.push("| `active` / `pressed` | During click or tap |");
  lines.push("| `focus` | Keyboard or programmatic focus |");
  lines.push("| `disabled` | Non-interactive |");
  lines.push("| `selected` | Chosen item in a group |");
  lines.push("| `checked` | Toggle / checkbox is on |");
  lines.push("| `indeterminate` | Partially checked |");
  lines.push("| `on` / `off` | Binary switch state |");
  lines.push("| `error` | Validation failure |");
  lines.push("| `success` | Validation pass or positive feedback |");
  lines.push("| `warning` | Caution state |");
  lines.push("| `loading` | In-progress / skeleton |");
  lines.push("| `visited` | Previously followed link |");
  lines.push("");

  // Concepts
  lines.push("### Concepts");
  lines.push("");
  lines.push("| Concept | Purpose | Example components |");
  lines.push("|---------|---------|-------------------|");
  for (const concept of CONCEPT_TAXONOMY) {
    const forms = concept.typicalForms.slice(0, 4).join(", ") || "—";
    lines.push(`| \`${concept.id}\` | ${concept.purpose.split("—")[0].trim()} | ${forms} |`);
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── 3. Worked Examples by Concept ──
  lines.push("## 3. Worked Examples by Concept");
  lines.push("");

  // Group concepts by category for readability
  const conceptGroups: Record<string, ConceptDefinition[]> = {
    "Interactive": CONCEPT_TAXONOMY.filter((c) => ["action", "field", "selection"].includes(c.id)),
    "Containers": CONCEPT_TAXONOMY.filter((c) => ["surface", "float", "modal"].includes(c.id)),
    "Feedback": CONCEPT_TAXONOMY.filter((c) => ["feedback", "progress", "status"].includes(c.id)),
    "Navigation": CONCEPT_TAXONOMY.filter((c) => ["navigation", "chip", "badge"].includes(c.id)),
    "Content": CONCEPT_TAXONOMY.filter((c) => ["text", "icon", "data-display", "profile"].includes(c.id)),
    "Overlay & System": CONCEPT_TAXONOMY.filter((c) => ["tooltip", "focus", "elevation", "layout", "motion", "skeleton", "toggles", "utility", "decorative"].includes(c.id)),
  };

  for (const [groupName, concepts] of Object.entries(conceptGroups)) {
    lines.push(`### ${groupName}`);
    lines.push("");

    for (const concept of concepts) {
      const examples = buildWorkedExamples(concept);
      if (examples.length === 0) continue;

      lines.push(`#### \`${concept.id}\``);
      lines.push("");

      // States and variants available
      if (concept.validVariants.length > 0) {
        lines.push(`- **Variants:** ${concept.validVariants.join(", ")}`);
      }
      if (concept.validStates.length > 0) {
        lines.push(`- **States:** ${concept.validStates.join(", ")}`);
      }
      lines.push("");

      lines.push("```");
      for (const ex of examples) {
        lines.push(ex);
      }
      lines.push("```");
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");

  // ── 4. Component Alias Examples ──
  lines.push("## 4. Component Alias Tokens");
  lines.push("");
  lines.push("Component aliases map a specific component to an underlying semantic token.");
  lines.push("They follow the component pattern:");
  lines.push("");
  lines.push("```");
  lines.push(GRAMMAR.componentPattern);
  lines.push("```");
  lines.push("");
  lines.push("**Examples:**");
  lines.push("");
  lines.push("```");
  lines.push("component/button/color/background/default          → resolves to color/semantic/actions/primary/bg/default");
  lines.push("component/button/icon-slot/color/icon/default      → resolves to color/semantic/icon/on-color");
  lines.push("component/button/primary/color/background/hover    → resolves to color/semantic/actions/primary/bg/hover");
  lines.push("component/button/radius/corner-radius/default      → resolves to radius/semantic/control/default");
  lines.push("component/input/color/border/focus                 → resolves to color/semantic/border/focus");
  lines.push("component/card/shadow/shadow/default               → resolves to elevation/semantic/shadow/md");
  lines.push("```");
  lines.push("");
  lines.push("**Rules for component aliases:**");
  lines.push("- Always start with `component/`");
  lines.push("- Use the component name in lowercase (e.g. `button`, `input`, `card`)");
  lines.push("- Optional `<part>` for sub-elements (e.g. `icon-slot`, `label`, `thumb`)");
  lines.push("- The rest follows the same `<category>/<property>[/<state>]` structure");
  lines.push("- Every component alias should resolve to a semantic token — never to a primitive");
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── 5. Common Mistakes ──
  lines.push("## 5. Common Mistakes");
  lines.push("");

  // Pick a few representative concepts for mistake examples
  const mistakeConcepts = ["action", "field", "surface"];
  const allMistakes: Array<{ concept: string; wrong: string; right: string; reason: string }> = [];

  for (const id of mistakeConcepts) {
    const concept = CONCEPT_TAXONOMY.find((c) => c.id === id);
    if (!concept) continue;
    const mistakes = buildMistakeExamples(concept);
    for (const m of mistakes) {
      allMistakes.push({ concept: id, ...m });
    }
  }

  // Deduplicate by reason
  const seenReasons = new Set<string>();
  const uniqueMistakes = allMistakes.filter((m) => {
    if (seenReasons.has(m.reason)) return false;
    seenReasons.add(m.reason);
    return true;
  });

  lines.push("| # | Wrong | Right | Why |");
  lines.push("|---|-------|-------|-----|");
  uniqueMistakes.forEach((m, i) => {
    lines.push(`| ${i + 1} | \`${m.wrong}\` | \`${m.right}\` | ${m.reason} |`);
  });
  lines.push("");
  lines.push("**Additional pitfalls:**");
  lines.push("- Do not use a primitive token directly in a component — always alias through a semantic token");
  lines.push("- Do not invent new states — use only the states listed in this guide for each concept");
  lines.push("- Do not combine variant and state in one segment (e.g. `primary-hover`) — they are separate segments");
  lines.push("- Do not add sizing (sm/md/lg) as a variant for color tokens — sizing belongs in `space` or `typography` categories");
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── 6. Your File's Token Coverage ──
  lines.push("## 6. Your File's Token Coverage");
  lines.push("");

  // Detect if the file uses a different convention
  const totalExpected = coverage.reduce((sum, c) => sum + c.expectedTokens.length, 0);
  const totalFound = coverage.reduce((sum, c) => sum + c.foundTokens.length, 0);
  const totalFuzzy = coverage.reduce((sum, c) => sum + Object.keys(c.matchedFileTokens).length, 0);

  if (totalFuzzy > 0) {
    lines.push(`> Your file uses a different naming convention than the grammar above. ${totalFuzzy} token(s) were matched by semantic role rather than exact name.`);
    lines.push("");
  }

  lines.push(`**Coverage:** ${totalFound} / ${totalExpected} token roles covered`);
  lines.push("");

  // Show per-concept coverage with matched file tokens
  for (const c of coverage) {
    if (c.expectedTokens.length === 0) continue;

    const icon = c.status === "full" ? "✅" : c.status === "partial" ? "🟡" : "❌";
    lines.push(`### ${icon} ${c.conceptName} (${c.foundTokens.length}/${c.expectedTokens.length})`);
    lines.push("");

    if (c.expectedTokens.length > 0) {
      lines.push("| Role (expected path) | Status | Your file token |");
      lines.push("|----------------------|--------|-----------------|");

      for (const token of c.expectedTokens) {
        const found = c.foundTokens.includes(token);
        const fileToken = c.matchedFileTokens[token];
        const status = found ? "✅" : "❌";
        const fileCol = fileToken ? `\`${fileToken}\`` : (found ? "exact match" : "—");
        lines.push(`| \`${token}\` | ${status} | ${fileCol} |`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");

  // ── 7. Quick Decision Tree ──
  lines.push("## 7. Quick Decision Tree");
  lines.push("");
  lines.push("Use this flowchart when naming a new token:");
  lines.push("");
  lines.push("```");
  lines.push("1. What TYPE of value is it?");
  lines.push("   → color, radius, space, shadow, etc.            → that's your CATEGORY");
  lines.push("");
  lines.push("2. What UI CONCEPT does it serve?");
  lines.push("   → button = action, input = field, card = surface → that's your CONCEPT");
  lines.push("");
  lines.push("3. Is there a visual VARIANT?");
  lines.push("   → primary, secondary, ghost, outlined           → add as VARIANT segment");
  lines.push("   → no variant                                    → skip this segment");
  lines.push("");
  lines.push("4. What PART of the component?");
  lines.push("   → background, text, icon, border, ring          → that's your PROPERTY");
  lines.push("");
  lines.push("5. What interaction STATE?");
  lines.push("   → default, hover, focus, disabled               → add as STATE segment");
  lines.push("   → resting / no specific state                   → use 'default' or omit");
  lines.push("```");
  lines.push("");
  lines.push("**Result:** `<category>/<concept>[/<variant>]/<property>[/<state>]`");
  lines.push("");

  return lines.join("\n");
}
