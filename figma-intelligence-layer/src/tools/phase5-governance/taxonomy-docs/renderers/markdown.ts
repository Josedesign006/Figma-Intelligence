/**
 * Markdown renderer for taxonomy documentation.
 * Generates exportable markdown with concept table, naming grammar,
 * per-concept token anatomy, and coverage report.
 */

import { GRAMMAR } from "../../../../shared/concept-taxonomy.js";
import type { ConceptCoverage, TokenValueSnapshot } from "../index.js";

interface MarkdownOptions {
  includeTokenAnatomy: boolean;
  showCoverage: boolean;
}

function formatColorValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "r" in value) {
    const c = value as { r: number; g: number; b: number; a?: number };
    const r = Math.round(c.r * 255);
    const g = Math.round(c.g * 255);
    const b = Math.round(c.b * 255);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
  }
  return String(value ?? "—");
}

function statusEmoji(status: ConceptCoverage["status"]): string {
  if (status === "full") return "✅";
  if (status === "partial") return "🟡";
  return "❌";
}

export function renderMarkdown(
  coverage: ConceptCoverage[],
  snapshots: Record<string, TokenValueSnapshot>,
  options: MarkdownOptions,
): string {
  const lines: string[] = [];
  const now = new Date().toISOString().split("T")[0];

  // ── Header ──
  lines.push("# Token Taxonomy Documentation");
  lines.push("");
  lines.push(`> Generated ${now} from live Figma variables. Re-run \`figma_taxonomy_docs\` to refresh.`);
  lines.push("");

  // ── Naming Grammar ──
  lines.push("## Naming Grammar");
  lines.push("");
  lines.push("### Semantic Token Pattern");
  lines.push("```");
  lines.push(GRAMMAR.pattern);
  lines.push("```");
  lines.push("");
  lines.push("### Component Alias Pattern");
  lines.push("```");
  lines.push(GRAMMAR.componentPattern);
  lines.push("```");
  lines.push("");
  lines.push("| Segment | Description | Examples |");
  lines.push("|---------|-------------|----------|");
  lines.push(`| category | ${GRAMMAR.categories.join(", ")} | color, radius, space |`);
  lines.push(`| concept | UI concept from taxonomy | actions, surface, field |`);
  lines.push(`| variant | Optional variant | primary, secondary, sm, lg |`);
  lines.push(`| property | ${GRAMMAR.properties.slice(0, 6).join(", ")}... | background, text, border |`);
  lines.push(`| state | ${GRAMMAR.states.slice(0, 8).join(", ")}... | default, hover, disabled |`);
  lines.push("");

  // ── Coverage Summary ──
  if (options.showCoverage) {
    const full = coverage.filter((c) => c.status === "full").length;
    const partial = coverage.filter((c) => c.status === "partial").length;
    const missing = coverage.filter((c) => c.status === "missing").length;

    lines.push("## Coverage Summary");
    lines.push("");
    lines.push(`| Status | Count |`);
    lines.push(`|--------|-------|`);
    lines.push(`| ✅ Full | ${full} |`);
    lines.push(`| 🟡 Partial | ${partial} |`);
    lines.push(`| ❌ Missing | ${missing} |`);
    lines.push("");
  }

  // ── Concept Overview Table ──
  lines.push("## Concept Taxonomy");
  lines.push("");
  lines.push("| Concept | Purpose | Typical Forms | States | Variants | Coverage |");
  lines.push("|---------|---------|---------------|--------|----------|----------|");

  for (const c of coverage) {
    const forms = c.typicalForms.slice(0, 4).join(", ") + (c.typicalForms.length > 4 ? "..." : "");
    const states = c.validStates.slice(0, 4).join(", ") + (c.validStates.length > 4 ? "..." : "");
    const variants = c.validVariants.length > 0
      ? c.validVariants.slice(0, 3).join(", ") + (c.validVariants.length > 3 ? "..." : "")
      : "—";
    const cov = options.showCoverage ? `${statusEmoji(c.status)} ${c.foundTokens.length}/${c.expectedTokens.length}` : "";
    lines.push(`| **${c.conceptName}** | ${c.purpose} | ${forms} | ${states} | ${variants} | ${cov} |`);
  }
  lines.push("");

  // ── Per-Concept Token Anatomy ──
  if (options.includeTokenAnatomy) {
    lines.push("## Token Anatomy by Concept");
    lines.push("");

    for (const c of coverage) {
      if (c.expectedTokens.length === 0) continue;

      lines.push(`### ${c.conceptName}`);
      lines.push("");
      lines.push(`> ${c.purpose}`);
      lines.push("");

      if (c.typicalForms.length > 0) {
        lines.push(`**Components:** ${c.typicalForms.join(", ")}`);
        lines.push("");
      }

      lines.push("| Token Path | Status | File Token | Value |");
      lines.push("|------------|--------|------------|-------|");

      for (const token of c.expectedTokens) {
        const found = c.foundTokens.includes(token);
        const fileToken = c.matchedFileTokens[token];
        const status = found ? "✅" : "❌ missing";
        const fileCol = fileToken ? `\`${fileToken}\`` : (found ? "exact" : "—");

        let value = "—";
        // Try the file token name first for snapshot lookup, then fall back to expected path
        const snapKey = fileToken ?? token;
        const snap = snapshots[snapKey] ?? snapshots[token];
        if (snap?.values) {
          const firstValue = Object.values(snap.values)[0];
          if (firstValue !== undefined && firstValue !== null) {
            value = snap.type === "COLOR" ? formatColorValue(firstValue) : String(firstValue);
          }
        }

        lines.push(`| \`${token}\` | ${status} | ${fileCol} | ${value} |`);
      }

      lines.push("");

      // States and variants
      if (c.validStates.length > 0) {
        lines.push(`**Valid states:** ${c.validStates.join(", ")}`);
      }
      if (c.validVariants.length > 0) {
        lines.push(`**Valid variants:** ${c.validVariants.join(", ")}`);
      }
      lines.push("");
    }
  }

  // ── Missing Tokens Summary ──
  if (options.showCoverage) {
    const allMissing = coverage.flatMap((c) => c.missingTokens.map((t) => ({ concept: c.conceptName, token: t })));
    if (allMissing.length > 0) {
      lines.push("## Missing Tokens");
      lines.push("");
      lines.push("| Concept | Missing Token |");
      lines.push("|---------|---------------|");
      for (const { concept, token } of allMissing) {
        lines.push(`| ${concept} | \`${token}\` |`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
