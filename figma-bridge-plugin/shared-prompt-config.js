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

// ── Design Systems (full token data) ─────────────────────────────────────

const DESIGN_SYSTEMS = [
  {
    id: "mui",
    name: "Material UI",
    org: "Google",
    tokens: {
      colors: { primary: "#1976D2", secondary: "#9C27B0", error: "#D32F2F", success: "#2E7D32", warning: "#ED6C02", info: "#0288D1", bg: "#ffffff", surface: "#F5F5F5", text: "#212121" },
      typography: { fontFamily: "Roboto", scale: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, "2xl": 34 } },
      spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
      radius: { sm: 4, md: 8, lg: 16 },
    },
    components: ["Button", "TextField", "Select", "Card", "Dialog", "Snackbar", "Chip", "Avatar", "AppBar", "Drawer", "Tabs", "DataGrid"],
    promptContext: "Material Design 3 (MUI). 8px grid. Elevation via shadows (0dp–24dp). Rounded corners (4–16px). Typography: Roboto. Use Material component names exactly. Surfaces use tonal color mapping.",
  },
  {
    id: "carbon",
    name: "IBM Carbon",
    org: "IBM",
    tokens: {
      colors: { primary: "#0F62FE", danger: "#DA1E28", success: "#24A148", warning: "#F1C21B", info: "#4589FF", bg: "#ffffff", surface: "#F4F4F4", text: "#161616" },
      typography: { fontFamily: "IBM Plex Sans", scale: { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, "2xl": 32 } },
      spacing: [0, 2, 4, 8, 12, 16, 24, 32, 48, 64, 96],
      radius: { sm: 0, md: 0, lg: 0 },
    },
    components: ["Button", "TextInput", "Dropdown", "Modal", "DataTable", "Notification", "Tag", "Tile", "Accordion", "Breadcrumb", "Toggle", "NumberInput"],
    promptContext: "IBM Carbon Design System. 2x grid (mini-unit: 8px). Sharp corners (0px radius). Dense information layouts. Typography: IBM Plex Sans. Always include focus states. Use Carbon component names exactly.",
  },
  {
    id: "atlassian",
    name: "Atlassian DS",
    org: "Atlassian",
    tokens: {
      colors: { primary: "#0052CC", danger: "#DE350B", success: "#00875A", warning: "#FF991F", info: "#0065FF", bg: "#ffffff", surface: "#FAFBFC", text: "#172B4D" },
      typography: { fontFamily: "Inter", scale: { xs: 11, sm: 14, md: 16, lg: 20, xl: 24, "2xl": 29 } },
      spacing: [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48],
      radius: { sm: 3, md: 3, lg: 3 },
    },
    components: ["Button", "Textfield", "Select", "Modal", "DynamicTable", "Flag", "Lozenge", "Banner", "Tabs", "Breadcrumbs", "Toggle", "Checkbox"],
    promptContext: "Atlassian Design System. 8px grid. Consistent 3px border radius. Typography: Inter (previously -apple-system). Lozenges for status, Flags for notifications. Use Atlassian component names exactly.",
  },
  {
    id: "polaris",
    name: "Polaris",
    org: "Shopify",
    tokens: {
      colors: { primary: "#008060", critical: "#D72C0D", success: "#008060", warning: "#FFC453", highlight: "#5C6AC4", bg: "#FFFFFF", surface: "#F6F6F7", text: "#202223" },
      typography: { fontFamily: "Inter", scale: { xs: 12, sm: 13, md: 14, lg: 16, xl: 20, "2xl": 26 } },
      spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
      radius: { sm: 4, md: 8, lg: 12 },
    },
    components: ["Button", "TextField", "Select", "Modal", "DataTable", "Banner", "Badge", "Card", "Tabs", "Navigation", "ResourceList", "IndexTable"],
    promptContext: "Shopify Polaris Design System. 4px base unit. Commerce-focused patterns. Typography: Inter. Cards are primary containers. Use Polaris component names exactly. Resource-oriented layouts.",
  },
  {
    id: "fluent",
    name: "Fluent UI",
    org: "Microsoft",
    tokens: {
      colors: { primary: "#0078D4", danger: "#D13438", success: "#107C10", warning: "#FFB900", info: "#0078D4", bg: "#FFFFFF", surface: "#F5F5F5", text: "#242424" },
      typography: { fontFamily: "Segoe UI", scale: { xs: 10, sm: 12, md: 14, lg: 16, xl: 20, "2xl": 28 } },
      spacing: [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32],
      radius: { sm: 2, md: 4, lg: 8 },
    },
    components: ["Button", "Input", "Dropdown", "Dialog", "DataGrid", "MessageBar", "Badge", "Card", "Pivot", "Breadcrumb", "Toggle", "SpinButton"],
    promptContext: "Microsoft Fluent UI 2. 4px grid. Subtle rounded corners (2–8px). Typography: Segoe UI. Layered depth via shadow tokens. Use Fluent UI component names exactly. Follow Windows/Office visual patterns.",
  },
  {
    id: "antd",
    name: "Ant Design",
    org: "Ant Group",
    tokens: {
      colors: { primary: "#1677FF", error: "#FF4D4F", success: "#52C41A", warning: "#FAAD14", info: "#1677FF", bg: "#FFFFFF", surface: "#F5F5F5", text: "#000000E0" },
      typography: { fontFamily: "system-ui", scale: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, "2xl": 30 } },
      spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
      radius: { sm: 4, md: 6, lg: 8 },
    },
    components: ["Button", "Input", "Select", "Modal", "Table", "Notification", "Tag", "Card", "Tabs", "Breadcrumb", "Switch", "InputNumber"],
    promptContext: "Ant Design 5. 4px grid. Enterprise-grade data-heavy interfaces. Typography: system-ui stack. Dense forms and tables. Use Ant Design component names exactly. Token-based theming with CSS variables.",
  },
  {
    id: "shadcn",
    name: "shadcn/ui",
    org: "Community",
    tokens: {
      colors: { primary: "#18181B", secondary: "#F4F4F5", accent: "#F4F4F5", destructive: "#EF4444", muted: "#F4F4F5", bg: "#FFFFFF", surface: "#FAFAFA", text: "#09090B", border: "#E4E4E7" },
      typography: { fontFamily: "Inter", scale: { xs: 12, sm: 14, md: 16, lg: 18, xl: 24, "2xl": 30 } },
      spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
      radius: { sm: 6, md: 8, lg: 12 },
    },
    components: ["Button", "Input", "Select", "Dialog", "DataTable", "Toast", "Badge", "Card", "Tabs", "Breadcrumb", "Switch", "Separator"],
    promptContext: "shadcn/ui (Radix primitives + Tailwind CSS). CSS custom properties for theming. Copy-paste component model. Typography: Inter or Geist Sans. Use shadcn/ui component names exactly. Minimalist, developer-focused aesthetic.",
  },
  {
    id: "primer",
    name: "Primer",
    org: "GitHub",
    tokens: {
      colors: { primary: "#0969DA", danger: "#CF222E", success: "#1A7F37", attention: "#BF8700", accent: "#8250DF", bg: "#FFFFFF", surface: "#F6F8FA", text: "#1F2328", border: "#D0D7DE" },
      typography: { fontFamily: "system-ui", scale: { xs: 12, sm: 14, md: 16, lg: 20, xl: 26, "2xl": 32 } },
      spacing: [0, 4, 8, 16, 24, 32, 40, 48, 64, 80, 96],
      radius: { sm: 3, md: 6, lg: 12 },
    },
    components: ["Button", "TextInput", "Select", "Dialog", "DataTable", "Flash", "Label", "Box", "UnderlineNav", "Breadcrumbs", "ToggleSwitch", "ActionMenu"],
    promptContext: "GitHub Primer Design System. 8px grid. Functional, developer-tool aesthetic. Typography: system-ui (-apple-system). Use Primer component names exactly. Flash for alerts, Labels for status. Subtle borders over shadows.",
  },
];

function getDesignSystemById(id) {
  if (!id) return null;
  return DESIGN_SYSTEMS.find((ds) => ds.id === id) || null;
}

function buildDesignSystemAddendum(dsId) {
  const ds = getDesignSystemById(dsId);
  if (!ds) return "";

  const c = ds.tokens.colors;
  const t = ds.tokens.typography;
  const colorEntries = Object.entries(c).map(([k, v]) => `${k}: ${v}`).join(", ");
  const scaleEntries = Object.entries(t.scale).map(([k, v]) => `${k}: ${v}px`).join(", ");
  const spacingStr = ds.tokens.spacing.join(", ");
  const r = ds.tokens.radius;

  return `
=== MANDATORY DESIGN SYSTEM: ${ds.name} (${ds.org}) ===
STRICT RULES — violations are errors:
1. Create ONLY what the user requests. Do NOT add extra screens, pages, or components.
2. Do NOT call figma_get_variables for color or typography — use ONLY the tokens below.
3. EVERY fill, stroke, text color, and background MUST use a token below. NEVER hardcode hex outside this set.

TOKENS:
  Colors: ${colorEntries}
  Apply: primary→buttons/links, bg→frame backgrounds, surface→cards/containers, text→body text, error/danger→alerts
  Font: ${t.fontFamily} | Scale: ${scaleEntries}
  Spacing: [${spacingStr}]
  Radius: sm=${r.sm}px md=${r.md}px lg=${r.lg}px

COMPONENTS: ${ds.components.join(", ")}
SYSTEM: ${ds.promptContext}
=== END DESIGN SYSTEM ===`;
}

function buildSystemPrompt(dsId) {
  const addendum = buildDesignSystemAddendum(dsId);
  if (!addendum) return SYSTEM_PROMPT;

  // When a design system is active, override instruction #2 to prevent
  // figma_get_variables from overriding our design system tokens
  const modified = SYSTEM_PROMPT.replace(
    "2. Call figma_get_variables(verbosity:\"inventory\") before building — reuse existing tokens instead of hardcoding hex.",
    "2. A design system is active — use ONLY the tokens provided below. Do NOT call figma_get_variables for color or typography decisions."
  );

  return `${modified}\n${addendum}`;
}

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
  DESIGN_SYSTEMS,
  buildSystemPrompt,
  getDesignSystemById,
  detectActiveSkills,
  REPO_DIR,
};
