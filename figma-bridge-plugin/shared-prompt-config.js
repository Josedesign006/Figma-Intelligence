/**
 * shared-prompt-config.js — Shared prompt configuration used by all runner
 * files (chat-runner, codex-runner, gemini-cli-runner).
 *
 * OPTIMIZED: System prompt reduced to ~500 chars. Claude reasons from MCP tool
 * schemas — no routing tables, no task guidance regex, no quality constants.
 */

const { resolve } = require("path");

const REPO_DIR = resolve(__dirname, "..");

// ── System Prompt (~500 chars) ───────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI design assistant operating inside a Figma plugin via MCP tools. Execute designs directly in Figma — never describe what you would do instead of doing it.

Key context (not in tool schemas):
1. Call figma_get_status first to verify connection.
2. Call figma_get_variables(verbosity:"inventory") before building — reuse existing tokens instead of hardcoding hex.
3. Call figma_search_components before building — instantiate existing components via figma_instantiate_component.
4. For components: build ONE base state with figma_execute, then call figma_variant_expander to generate the full variant matrix (sizes, states, themes). Never manually clone variants.
5. After building: figma_navigate to scroll to result, figma_take_screenshot to verify.
6. After creating frames with figma_execute, call figma_layout_intelligence on each container frame to apply proper Auto Layout, padding, and spacing.

Be direct and action-oriented. Execute first, explain briefly after.`;

// ── Active Skill Detection ───────────────────────────────────────────────────

function detectActiveSkills(text) {
  const lower = (text || "").toLowerCase();
  const skills = [];
  if (/(accessibility annotation|a11y annotation|focus order|aria annotation|accessible document)/.test(lower)) skills.push("A11y Annotator");
  if (/(accessible|accessibility|a11y|wcag|screen reader|keyboard navigation|aria)/.test(lower)) skills.push("Accessibility");
  if (/(design\s*system|design\s*tokens?|token\s*system|scaffol|primitives|variable\s*collection|ds\s*setup|ds\s*foundation)/.test(lower)) skills.push("Design System");
  if (/(component\s*set|component\s*library|componentset|\bbutton\s*component|\bmodal\s*component|\binput\s*component|\btoggle\s*component|\bcreate.*component|\bvariant\b.*\b(size|state|style)\b|(create|make|build|design|add)\s+(a\s+|an\s+)?(button|modal|dialog|input|toggle|switch|checkbox|radio|tooltip|avatar|badge|alert|toast|tabs?|dropdown|select|table|card|navbar)\s*$)/.test(lower)) skills.push("Component Builder");
  if (/(audit|health\s*report|lint|drift|governance|consistency\s*check|review\s*design|quality\s*check)/.test(lower)) skills.push("Auditor");
  if (/(prototype|prototyping|interaction|animate|animation|transition|flow connect|link screens)/.test(lower)) skills.push("Prototyping");
  if (/(sync.*code|code.*sync|handoff|spec|specification|developer handoff|generate spec)/.test(lower)) skills.push("Code Sync");
  if (/(theme|color|style|brand|dark mode|light mode|palette)/.test(lower)) skills.push("Theme Factory");
  if (skills.length === 0 && /(screen|flow|page|dashboard|app ui|landing page|checkout|cart|wireframe|nav|header|footer|design|ui|ux)/.test(lower)) skills.push("UI/UX Pro Max");
  return skills;
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  SYSTEM_PROMPT,
  detectActiveSkills,
  REPO_DIR,
};
