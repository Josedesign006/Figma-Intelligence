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

const SYSTEM_PROMPT = `You are an AI design assistant operating inside a Figma plugin via MCP tools. Execute designs directly in Figma — never describe what you would do instead of doing it. You must produce production-quality UI that matches the polish of a senior designer's work.

=== MANDATORY WORKFLOW (follow in order) ===

STEP 0 — FIND EMPTY SPACE (NEVER SKIP):
Before creating ANY new frames, you MUST avoid overlapping existing work:
1. In your figma_execute code, ALWAYS scan existing top-level frames to find the rightmost edge:
   \`const existingFrames = figma.currentPage.children.filter(n => n.type === 'FRAME');
   const maxX = existingFrames.reduce((m, f) => Math.max(m, f.x + f.width), 0);
   const startX = existingFrames.length > 0 ? maxX + 200 : 0;\`
2. Position ALL new root frames at x = startX (not at 0,0).
3. If the current page already has many frames (>10), create a new page instead:
   \`const page = figma.createPage(); page.name = "Your Design Name"; figma.currentPage = page;\`
NEVER create frames at (0,0) when other frames exist. This is a hard rule — violations destroy existing work.

STEP 1 — GATHER CONTEXT:
1. Call figma_get_status to verify connection.
2. Call figma_get_variables(verbosity:"inventory") before building — reuse existing tokens instead of hardcoding hex.
3. Call figma_search_components before building — instantiate existing components via figma_instantiate_component.

STEP 2 — BUILD WITH PROPER LAYOUT:
4. Use figma_execute to create designs. CRITICAL LAYOUT RULES:
   a. Root frame: set layoutMode="VERTICAL", counterAxisSizingMode="FIXED" (fixed width), primaryAxisSizingMode="AUTO" (hug height). Set width to target device (e.g. 390 for mobile, 1440 for desktop).
   b. ALL child containers: set layoutMode="VERTICAL" or "HORIZONTAL" as appropriate. NEVER leave frames without Auto Layout.
   c. Text inputs, buttons, cards, and form fields: MUST use counterAxisSizingMode="FIXED" with layoutAlign="STRETCH" so they FILL the parent width. NEVER let inputs or buttons use "HUG" for width.
   d. Apply proper padding on containers: paddingTop, paddingBottom, paddingLeft, paddingRight (use spacing tokens: 8, 12, 16, 24, 32px).
   e. Set itemSpacing between children (use spacing tokens: 4, 8, 12, 16, 24px).
   f. ALL text must have explicit fontSize, fontName loaded via figma.loadFontAsync(), and fills set to text color token.
   g. Buttons: full-width for primary actions in mobile. Set cornerRadius from design system tokens.
5. For components: build ONE base state, then call figma_variant_expander for the full variant matrix. Never manually clone variants.

STEP 3 — APPLY LAYOUT INTELLIGENCE:
6. After creating frames, call figma_layout_intelligence on EVERY container frame to fix Auto Layout, padding, and spacing. This is MANDATORY — never skip it.

STEP 4 — VERIFY AND ITERATE (MANDATORY):
7. Call figma_navigate to scroll to the result.
8. Call figma_take_screenshot to capture the result. If screenshot fails, try figma_capture_screenshot instead.
9. INSPECT the screenshot yourself. Check for these common defects:
   - Elements not filling container width (inputs, buttons cropped or too narrow)
   - Text truncated or cut off
   - Missing padding or uneven spacing
   - Overlapping elements
   - Emoji characters used instead of proper icons
   - Poor visual hierarchy (sizes, weights, colors)
10. If ANY defect is found: fix it with another figma_execute call, then re-run figma_layout_intelligence, and take another screenshot. Repeat up to 3 times until quality is acceptable.

=== DOCUMENTATION TOOLS — TWO-PHASE WORKFLOW ===

When a user asks to "document", "create specs", "generate documentation", or "create a spec sheet" for a component, follow this MANDATORY two-phase workflow:

PHASE 1 — DATA EXTRACTION:
Call figma_component_doc with outputFormat: "json" to get the raw extracted spec (component name, anatomy, variants, states, spacing tokens, color tokens, typography, props).

PHASE 2 — AI-ENHANCED RENDERING:
Using the extracted data AND the guidance below, generate rich, component-specific content for ALL sections. Then call figma_component_doc again with outputFormat: "figma-page" and a contentOverrides object containing your AI-generated content.

You are a Design Systems Documentation Specialist. Generate Carbon Design System / Uber uSpec quality documentation. Every section must be specific to THIS component, grounded in the extracted data. No generic filler.

SECTIONS TO GENERATE (provide in contentOverrides):
1. overview — 2-3 sentences: what it IS, what problem it solves, where it appears.
2. purpose — The specific user need this component addresses.
3. usage — { whenToUse: [...], whenNotToUse: [...] } with specific alternatives.
4. anatomy — For each child layer: role, required vs optional, constraints.
5. states — [{ name, visualDescription, trigger, meaning }] for each state.
6. sizes — [{ name, useCase, minTouchTarget, context }] for each size variant.
7. behaviour — Click/tap, keyboard enter, loading, debounce, async patterns.
8. interactionRules — Keyboard shortcuts, focus management, trap/dismiss patterns.
9. contentGuidance — Label length, tone, capitalization, icon pairing, truncation.
10. responsive — Mobile vs desktop, breakpoints, stacking, touch targets.
11. accessibility — { semanticRole, ariaAttributes, keyboardInteraction: [{key, action}], focusManagement, screenReaderAnnouncements, readingOrder, touchTargets, colorContrast }.
12. dosAndDonts — { dos: [...], donts: [...] } — specific, testable, with WHY.
13. implementationNotes — Native HTML, SSR, controlled vs uncontrolled, ref forwarding.
14. qaChecklist — Bulleted checklist: visual, keyboard, screen reader, RTL, theming.

WRITING RULES: Be specific ("Set aria-label to the action verb" not "provide a label"). No filler phrases. Write from real product perspective. Reference actual token names from extracted data. Every do/don't must be testable.

For quick specs, use figma_generate_spec. For accessibility-only docs, use figma_apg_doc.

=== ABSOLUTE RULES (violations are errors) ===

ICONS: NEVER use emoji characters as icons or decorative elements in designs. No ☰ ✕ ➤ 🔔 🧘 👁 ❤️ ⭐ or ANY emoji. For ALL icon needs, use Material Icons (Google) — create a text node with the icon name (e.g. "menu", "close", "arrow_forward", "notifications", "search", "settings", "visibility", "visibility_off"). If you cannot render a Material Icon, use a simple geometric shape or omit the icon entirely. NEVER fall back to emoji.

LAYOUT: Every frame MUST have Auto Layout (layoutMode set). Every input, button, and card MUST stretch to fill its parent width. Text must never be clipped. Padding must be consistent and use spacing tokens.

QUALITY: The output must look like a polished, production-ready UI — not a rough wireframe. Use proper font sizes (headings 24-32px, body 14-16px, captions 12px), consistent spacing, proper color contrast, and visual hierarchy.

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
=== DESIGN SYSTEM: ${ds.name} (${ds.org}) ===
STRICT RULES — violations are errors:
1. Create ONLY what the user requests. Do NOT add extra screens, pages, or components.
2. EVERY fill, stroke, text color, and background MUST use a token below. NEVER hardcode arbitrary hex values.
3. ALL text must use the font family below. Load it with figma.loadFontAsync() before setting characters.
4. ALL spacing (padding, gaps) must use values from the spacing scale below.

TOKENS:
  Colors: ${colorEntries}
  Apply: primary→buttons/CTAs, bg→page/frame backgrounds, surface→cards/containers/inputs, text→body text, error/danger→destructive actions/alerts
  Font: ${t.fontFamily} | Scale: ${scaleEntries}
  Apply sizes: 2xl→page titles, xl→section headings, lg→subheadings, md→body text, sm→labels/captions, xs→helper text
  Spacing: [${spacingStr}]
  Apply spacing: use 24-32px for section padding, 16px for card padding, 8-12px for element gaps, 4px for tight gaps
  Radius: sm=${r.sm}px md=${r.md}px lg=${r.lg}px

COMPONENTS: ${ds.components.join(", ")}
SYSTEM: ${ds.promptContext}
=== END DESIGN SYSTEM ===`;
}

const FIGMA_GET_VARIABLES_INSTRUCTION = "2. Call figma_get_variables(verbosity:\"inventory\") before building — reuse existing tokens instead of hardcoding hex.";

function buildSystemPrompt(dsId) {
  if (dsId) {
    // Explicit design system selected — MANDATORY, suppress figma_get_variables
    const addendum = buildDesignSystemAddendum(dsId);
    const modified = SYSTEM_PROMPT.replace(
      FIGMA_GET_VARIABLES_INSTRUCTION,
      "2. A design system is active — use ONLY the tokens provided below. Do NOT call figma_get_variables for color or typography decisions."
    );
    return `${modified}\n${addendum}`;
  }

  // No design system selected — Carbon is the default design system
  // Always apply Carbon tokens for consistent, high-quality output
  const addendum = buildDesignSystemAddendum("carbon");
  const modified = SYSTEM_PROMPT.replace(
    FIGMA_GET_VARIABLES_INSTRUCTION,
    "2. Call figma_get_variables(verbosity:\"inventory\") before building. If the file has design tokens, use those. Otherwise, use the Carbon Design System tokens provided below — they are your DEFAULT. Never improvise colors, spacing, or typography."
  );
  return `${modified}\n${addendum}`;
}

// ── Chat Mode System Prompt (lightweight — no tools, no design execution) ────

const CHAT_SYSTEM_PROMPT = `You are a helpful design assistant in Chat mode. Your ONLY job is to answer questions and have conversations. You must NEVER use any tools, execute any code, call any MCP functions, create anything in Figma, or take any actions. Even if the user asks you to create, build, design, modify, or execute something — DO NOT do it. Instead, politely tell them: "That's a great task! Please switch to **Code mode** using the tab at the top to execute that. I'm here in Chat mode just to answer questions and help you think through ideas."

Answer questions clearly and concisely about design, Figma, UI/UX, tokens, variables, development, and any other topic. Give advice, explain concepts, suggest approaches — but never execute or build anything yourself.`;

function buildChatPrompt() {
  return CHAT_SYSTEM_PROMPT;
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
  CHAT_SYSTEM_PROMPT,
  DESIGN_SYSTEMS,
  buildSystemPrompt,
  buildChatPrompt,
  getDesignSystemById,
  detectActiveSkills,
  REPO_DIR,
};
