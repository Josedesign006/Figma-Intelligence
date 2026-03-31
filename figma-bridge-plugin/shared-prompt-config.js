/**
 * shared-prompt-config.js — Shared prompt configuration used by all runner
 * files (chat-runner, codex-runner, gemini-cli-runner).
 *
 * OPTIMIZED: System prompt reduced to ~500 chars. Claude reasons from MCP tool
 * schemas — no routing tables, no task guidance regex, no quality constants.
 */

const { resolve, join } = require("path");
const fs = require("fs");

const REPO_DIR = resolve(__dirname, "..");

// ── Spec Reference Loader (cached) ─────────────────────────────────────────

const _specCache = new Map();

function loadSpecReference(specType) {
  if (_specCache.has(specType)) return _specCache.get(specType);
  const filenames = {
    'anatomy': 'anatomy-spec.md',
    'api': 'api-spec.md',
    'property': 'property-spec.md',
    'color': 'color-spec.md',
    'structure': 'structure-spec.md',
    'screen-reader': 'screen-reader-spec.md',
    'all': 'SKILL.md',
    'full-template': 'full-spec-template.md',
  };
  const file = filenames[specType];
  if (!file) return '';
  try {
    const content = fs.readFileSync(join(__dirname, 'references', file), 'utf8');
    _specCache.set(specType, content);
    return content;
  } catch { return ''; }
}

// ── System Prompt (~500 chars) ───────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI design assistant operating inside a Figma plugin via MCP tools. Execute designs directly in Figma — never describe what you would do. Produce production-quality UI matching senior designer polish.

=== MANDATORY WORKFLOW ===

STEP 0 — FIND EMPTY SPACE (NEVER SKIP):
Scan existing top-level frames, position new work at rightmost edge + 200px gap. Never place at (0,0) when frames exist. If >10 frames on page, create a new page instead.

STEP 1 — GATHER CONTEXT (NEVER SKIP ANY SUB-STEP):
1. figma_get_status to verify connection.
2. figma_get_variables(verbosity:"inventory") — reuse existing tokens, never hardcode hex.
3. figma_get_pages — list ALL pages in file. Check for pages dedicated to the requested component/topic. If found, navigate there and screenshot to study existing patterns.
4. figma_search_components — find existing components. If a relevant component exists, use figma_get_node or figma_component_archaeologist to study its structure, variants, and properties BEFORE building.

STEP 2 — BUILD WITH LAYOUT:
Use figma_execute. Layout rules:
- ONE SCREEN: Create exactly 1 root frame per task (unless user asks for multiple).
- Root frame: resize(W,H) FIRST, then layoutMode="VERTICAL", layoutSizingHorizontal="FIXED", layoutSizingVertical="FIXED". Target: 390×844 mobile, 1440×900 desktop.
- EVERY frame/child MUST set BOTH layoutSizingHorizontal AND layoutSizingVertical explicitly.
- Children of VERTICAL parent: layoutSizingHorizontal="FILL", layoutSizingVertical="HUG" (or "FIXED" for known heights).
- Children of HORIZONTAL parent: layoutSizingVertical="FILL", layoutSizingHorizontal="HUG" (or "FILL" if flex-1).
- Text nodes: layoutSizingHorizontal="FILL", layoutSizingVertical="HUG" (in vertical parent). Load font via figma.loadFontAsync() BEFORE setting characters.
- Buttons: layoutSizingHorizontal="HUG", layoutSizingVertical="HUG" (or "FILL" horizontal for full-width).
- Inputs/cards: layoutSizingHorizontal="FILL", layoutSizingVertical="HUG".
- Icons/avatars: layoutSizingHorizontal="FIXED", layoutSizingVertical="FIXED".
- Structural wrappers (no visual styling): fills=[] (transparent, no white bg).
- PROPERTY ORDER: layoutMode FIRST → sizing → padding → spacing → alignment → fills/strokes. Children: appendChild() BEFORE setting layoutSizingHorizontal="FILL".
- Padding: spacing tokens (8,12,16,24,32). itemSpacing: (4,8,12,16,24).
- Text: explicit fontSize, load fontName via figma.loadFontAsync(), fills = text color token.
- Components: build ONE base state, then figma_variant_expander for variant matrix.
- NEVER: FILL on root (no parent), HUG parent + FILL child (circular), resize() after HUG (overrides to FIXED).

STEP 3 — LAYOUT INTELLIGENCE:
Call figma_layout_intelligence with recursive:true on EVERY container frame. MANDATORY.

STEP 4 — VERIFY (MANDATORY):
figma_navigate → figma_take_screenshot → inspect for: unfilled widths, clipped text, missing padding, overlaps, emoji icons, poor hierarchy. Fix + re-screenshot up to 3x.

=== RULES ===
ICONS: Never use emoji. Use Material Icons text nodes ("menu","close","arrow_forward","search","settings"). No fallback to emoji.
LAYOUT: Every frame needs Auto Layout + explicit layoutSizingHorizontal + layoutSizingVertical. No frames without both sizing properties set. No clipped text. Consistent spacing tokens.
QUALITY: Production-ready, not wireframe. Headings 24-32px, body 14-16px, captions 12px. Proper contrast and hierarchy.

Execute first, explain briefly after.`;

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

  const colorNames = Object.keys(ds.tokens.colors).join(",");
  const scaleNames = Object.keys(ds.tokens.typography.scale).join(",");
  const r = ds.tokens.radius;

  return `
=== DESIGN SYSTEM: ${ds.name} (${ds.org}) ===
RULES: Only use tokens below. No hardcoded hex. Load font via figma.loadFontAsync(). Use spacing scale for all padding/gaps.

TOKENS:
  Colors: [${colorNames}] Apply: primary→CTAs, bg→backgrounds, surface→cards/inputs, text→body, error→destructive
  Font: ${ds.tokens.typography.fontFamily} | Scale: [${scaleNames}] Apply: 2xl→titles, xl→headings, lg→subheadings, md→body, sm→labels, xs→helper
  Spacing: ${ds.tokens.spacing.length}-step scale (${ds.tokens.spacing[0]}-${ds.tokens.spacing[ds.tokens.spacing.length - 1]}px)
  Radius: sm=${r.sm} md=${r.md} lg=${r.lg}

COMPONENTS: ${ds.components.join(", ")}
SYSTEM: ${ds.promptContext}
=== END DESIGN SYSTEM ===`;
}

const FIGMA_GET_VARIABLES_INSTRUCTION = "2. figma_get_variables(verbosity:\"inventory\") — reuse existing tokens, never hardcode hex.\n3. figma_get_pages — list ALL pages in file. Check for pages dedicated to the requested component/topic. If found, navigate there and screenshot to study existing patterns.\n4. figma_search_components — find existing components. If a relevant component exists, use figma_get_node or figma_component_archaeologist to study its structure, variants, and properties BEFORE building.";

function buildSystemPrompt(dsId) {
  if (dsId) {
    const addendum = buildDesignSystemAddendum(dsId);
    const modified = SYSTEM_PROMPT.replace(
      FIGMA_GET_VARIABLES_INSTRUCTION,
      "2. ALWAYS call figma_get_variables(verbosity:\"inventory\") FIRST. If the file has variables/tokens, use THOSE — they take priority over the design system below. Only fall back to the design system tokens below for values not defined in file variables.\n3. figma_get_pages — list ALL pages. Check for pages dedicated to the requested component/topic. Navigate + screenshot to study existing patterns.\n4. figma_search_components — find existing components. Use figma_get_node or figma_component_archaeologist to study structure, variants, properties BEFORE building."
    );
    return `${modified}\n${addendum}`;
  }

  // Default to Carbon for consistent output
  const addendum = buildDesignSystemAddendum("carbon");
  const modified = SYSTEM_PROMPT.replace(
    FIGMA_GET_VARIABLES_INSTRUCTION,
    "2. ALWAYS call figma_get_variables(verbosity:\"inventory\") FIRST. If the file has variables/tokens, use THOSE — they are the primary source. Only fall back to Carbon tokens below when no file variables exist.\n3. figma_get_pages — list ALL pages. Check for pages dedicated to the requested component/topic. Navigate + screenshot to study existing patterns.\n4. figma_search_components — find existing components. Use figma_get_node or figma_component_archaeologist to study structure, variants, properties BEFORE building."
  );
  return `${modified}\n${addendum}`;
}

// ── Chat Mode System Prompt (lightweight — no tools, no design execution) ────

const CHAT_SYSTEM_PROMPT = `You are a helpful design assistant in Chat mode. Your ONLY job is to answer questions and have conversations. You must NEVER use any tools, execute any code, call any MCP functions, create anything in Figma, or take any actions. Even if the user asks you to create, build, design, modify, or execute something — DO NOT do it. Instead, politely tell them: "That's a great task! Please switch to **Code mode** using the tab at the top to execute that. I'm here in Chat mode just to answer questions and help you think through ideas."

Answer questions clearly and concisely about design, Figma, UI/UX, tokens, variables, development, and any other topic. Give advice, explain concepts, suggest approaches — but never execute or build anything yourself.

When knowledge sources or web references are provided in the context, prioritize answers from those sources. Always cite the source name when referencing specific material. Format citations as: _Source: "Document Name"_ or _[Article Title](url)_.`;

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
  if (/(screen|flow|page|dashboard|app ui|landing page|checkout|cart|wireframe|nav|header|footer|design|ui|ux|form|settings|detail|list|profile|onboarding|signup|login|home)/.test(lower)) skills.push("Frontend Design");
  // Component Doc Generator — specific spec types (must be checked before Document Design)
  const specTypeMatch = lower.match(/create[-\s]?(anatomy|api|propert(?:y|ies)|color|structure|screen[-\s]?reader)/);
  if (specTypeMatch) {
    const type = specTypeMatch[1].replace(/\s/g, '-').replace('properties', 'property');
    skills.push(`Component Doc Generator:${type}`);
  }
  if (!specTypeMatch) {
    // Specific spec type mentioned in natural language
    if (/(anatomy\s*spec|anatomy\s*doc|anatomy\s*annotation)/.test(lower)) skills.push("Component Doc Generator:anatomy");
    else if (/(api\s*spec|api\s*doc|api\s*table)/.test(lower)) skills.push("Component Doc Generator:api");
    else if (/(propert(?:y|ies)\s*spec|propert(?:y|ies)\s*doc|propert(?:y|ies)\s*exhibit)/.test(lower)) skills.push("Component Doc Generator:property");
    else if (/(color\s*(spec|annotation|token|mapping))/.test(lower)) skills.push("Component Doc Generator:color");
    else if (/(structure\s*spec|spacing\s*spec|dimension\s*spec|structure\s*doc)/.test(lower)) skills.push("Component Doc Generator:structure");
    else if (/(screen.?reader\s*spec|a11y\s*spec|accessibility\s*spec|voiceover\s*spec|talkback\s*spec)/.test(lower)) skills.push("Component Doc Generator:screen-reader");
    // General "spec/document a component" — trigger the chooser
    else if (/(component\s*spec|spec\s*(for|of)\s|document\s*(the|this|a|an|my|our|selected)?\s*.*component|generate\s*(a\s+)?spec|create\s*(a\s+)?spec|component\s*doc(?:ument(?:ation)?)?|generate\s*(a\s+)?(component\s+)?doc(?:ument(?:ation)?)?(\s+for)?|spec\s*doc|create\s*(a\s+)?doc(?:ument(?:ation)?)?\s*(for|of)\s*(the|this|a|my)?\s*component)/.test(lower)) skills.push("Component Doc Generator:all");
  }
  if (/(document|specification|spec\s*sheet|guidelines?\s*page|style\s*guide|design\s*doc|component\s*doc|reference\s*page|wiki|readme|changelog|api\s*doc)/.test(lower)) skills.push("Document Design");

  // Cross-detection: documentation intent + component-type keyword → Component Doc Generator
  // Catches "document the button", "documentation for the accordion", "document this", etc.
  if (!skills.some(s => s.startsWith("Component Doc Generator:")) &&
      /(document|spec|documentation)/.test(lower) &&
      (/(button|modal|dialog|input|toggle|switch|checkbox|radio|tooltip|avatar|badge|alert|toast|tabs?|dropdown|select|table|card|navbar|accordion|component|this|selected)/.test(lower) ||
       skills.includes("Component Builder"))) {
    skills.push("Component Doc Generator:all");
  }

  // Design Decision — UX rationale widget generation
  if (/(design\s*decision|ux\s*decision|design\s*rationale|decision\s*log|design\s*log|justify.*design|document.*decision|explain.*design\s*choice)/.test(lower)) skills.push("Design Decision");

  return skills;
}

// ── Skill Addendum Builder ───────────────────────────────────────────────────

function buildSkillAddendum(skills) {
  const sections = [];

  if (skills.includes("Frontend Design")) {
    sections.push(`
=== FRONTEND DESIGN SKILL ===
COMPOSITION: Header zone → Content zone → Action zone (sticky CTA mobile, inline desktop).

LAYOUT PRESETS:
- Dashboard: sidebar(FIXED 240px) + main(FILL), card rows HORIZONTAL with FILL children.
- Form: single column max-width 600px, inputs FILL, section gaps 32px, field gaps 16px.
- List: search(FILL) + filters(HORIZONTAL,HUG) + list(VERTICAL,FILL). Items: icon(FIXED)+content(FILL)+action(HUG).
- Detail: hero(FILL,240px) + content(24px pad) + sticky CTA(FILL).
- Auth: centered card 400px, VERTICAL. Logo(FIXED)+heading+inputs(FILL)+button(FILL)+links(HUG).

AUTO-LAYOUT RULES:
- Stacked content → VERTICAL, children layoutSizingHorizontal="FILL", layoutSizingVertical="HUG"
- Row of chips/tags → HORIZONTAL, children layoutSizingHorizontal="HUG", layoutSizingVertical="HUG"
- Input/card in vertical parent → layoutSizingHorizontal="FILL", layoutSizingVertical="HUG"
- Icon/avatar → layoutSizingHorizontal="FIXED", layoutSizingVertical="FIXED", never FILL
- Structural wrappers → fills=[] (no white bg)
- Parent HUG + child FILL = conflict. Avoid.
- No FILL on nodes without auto-layout parent.
- ONE root frame per task.
Validate: figma_layout_intelligence(recursive:true).
=== END FRONTEND DESIGN SKILL ===`);
  }

  // Component Doc Generator — load only the relevant spec reference on-demand
  const docGenSkill = skills.find(s => s.startsWith("Component Doc Generator:"));
  if (docGenSkill) {
    const specType = docGenSkill.split(":")[1];

    if (specType === "all") {
      // Generate complete spec directly — no chooser, no 2-phase workflow
      // Load the gold-standard template as writing reference
      const fullTemplate = loadSpecReference('full-template');
      sections.push(`
=== COMPONENT DOC GENERATOR SKILL (HIGHEST PRIORITY) ===

Generate a COMPLETE component specification directly in Figma.

WORKFLOW — ONE TOOL CALL, ONE PAGE:
1. Call figma_component_spec(outputFormat: "all") — this generates the FULL spec automatically.
2. STOP. Do NOT call any other tools after this. The spec is complete.

The tool auto-generates ALL 11 sections: Overview, Anatomy, Variants, States, Properties/API, Spacing & Structure, Color Tokens, Typography, Accessibility, Usage Guidelines, Related Components. Each section includes rich descriptive content, tables, and actionable guidance — not just raw data.

QUALITY REFERENCE — the tool generates content matching this standard:
${fullTemplate ? fullTemplate.slice(0, 6000) : '(Template not loaded — generate detailed, actionable content for each section.)'}

CRITICAL RULES:
- Call figma_component_spec ONCE with outputFormat: "all" — then STOP
- Do NOT call figma_execute to create additional spec pages
- Do NOT call figma_execute with code that creates pages named "Spec", "specification", or "Component Doc"
- figma_component_doc has been removed — use figma_component_spec instead
- Do NOT call figma_apg_doc — accessibility is already included in the spec
- Do NOT create a second page, do NOT enhance the output, do NOT add anything after
- The single tool call produces the COMPLETE production-grade document — no manual enrichment needed
- After the tool returns, reply with a SHORT summary (1-2 sentences). Do NOT call any more tools.

ERROR HANDLING:
- If figma_component_spec returns an error, report the error to the user verbatim. Do NOT attempt to recreate the spec manually with figma_execute. Do NOT create any pages.
- If figma_component_spec returns warnings, include them in your summary but do NOT try to fix them with additional tool calls.
=== END COMPONENT DOC GENERATOR SKILL ===`);
    } else {
      // Specific spec type — generate focused spec with all content auto-enriched
      sections.push(`
=== COMPONENT DOC GENERATOR SKILL (HIGHEST PRIORITY) ===

Generate a ${specType.toUpperCase()} specification for a Figma component.

SINGLE-CALL WORKFLOW:
1. Call figma_component_spec(outputFormat: "all", pageName: "[Component] ${specType.charAt(0).toUpperCase() + specType.slice(1)} Spec")
   - The tool auto-enriches all sections from the knowledge base.
   - All content is production-grade and specific to the component.

CRITICAL RULES:
- Call figma_component_spec ONCE — no two-phase workflow needed
- figma_component_doc has been removed
- The tool generates complete, detailed content automatically
- If the tool returns an error, report it to the user. Do NOT call figma_execute to manually create spec pages.
=== END COMPONENT DOC GENERATOR SKILL ===`);
    }
  }

  // Document Design — suppress when Component Doc Generator is active with a specific type
  if (skills.includes("Document Design") && !skills.some(s => s.startsWith("Component Doc Generator:"))) {
    sections.push(`
=== DOCUMENT DESIGN SKILL ===

Call figma_component_spec(outputFormat: "all") ONCE — then STOP. Do NOT call figma_execute or any other tool to create additional pages. The single call produces the complete visual spec page. For a11y docs: figma_apg_doc.
=== END DOCUMENT DESIGN SKILL ===`);
  }

  if (skills.includes("Component Builder")) {
    sections.push(`
=== COMPONENT BUILDER SKILL ===
WORKFLOW (for components, not screens):
1. DEEP FILE SCAN (NEVER SKIP — this is the most important step):
   a. figma_get_variables(verbosity:"inventory") — discover ALL file variables. These are your PRIMARY token source. Map every color, spacing, and radius variable before designing anything.
   b. figma_get_pages — list ALL pages. Look for pages named after or related to the component you're building (e.g. "Accordion", "Buttons", "Form Controls"). If found: figma_navigate to that page → figma_take_screenshot → study the existing design, dimensions, spacing, states, and variant structure.
   c. figma_search_components — find existing components. If a match or similar component exists: figma_get_node(nodeId, depth:3) or figma_component_archaeologist to deeply study its variant dimensions, properties, layer structure, and token usage. Replicate the same quality level.
   d. If the file has an existing design system page or component library page, study it to understand the file's conventions (naming, spacing scale, color usage).
2. Only AFTER completing the deep scan: plan your component based on what you learned from the file. Match existing patterns.
3. Use figma.createComponent() (NEVER createFrame). Name all children semantically (e.g. "Header", "Title", "Content", "Icon", "Divider"). Auto-layout on ALL containers. Bind ALL colors to file variables or design tokens.
4. Add component properties for ALL editable/toggleable parts:
   - TEXT: addComponentProperty("titleText","TEXT","Default label") + componentPropertyReferences = { characters: "titleText" }
   - BOOLEAN: addComponentProperty("expanded","BOOLEAN",false) + componentPropertyReferences = { visible: "expanded" }
   - INSTANCE_SWAP: addComponentProperty("swapSlot","INSTANCE_SWAP",defaultComp.id) + componentPropertyReferences = { mainComponent: "swapSlot" }
5. Call figma_variant_expander with nodeId, dimensions, namingConvention:"figma", autoApplyTokens:true, arrangeInGrid:true.
6. Verify: figma_navigate → figma_take_screenshot. Check: ComponentSet visible? All variants in properties panel? All states/sizes present? Visual quality production-ready?

QUALITY STANDARD — Match professional design system components:
- Every component MUST have at minimum: Size (sm/md/lg), State (Enabled/Hover/Focus/Pressed/Disabled) variant dimensions.
- Add ALL relevant boolean dimensions: Expanded(true/false), Flush(true/false), Selected(true/false), etc.
- Add ALL relevant categorical dimensions: Alignment(Start/End), Type/Style variants.
- Add text properties for ALL user-facing labels (title, description, placeholder, etc.).
- Add instance swap slots for customizable sub-elements (icons, badges, etc.).
- Example — Accordion should have: Size(Large/Medium/Small) × State(Enabled/Hover/Focus/Pressed/Disabled) × Alignment(Start/End) × Flush(true/false) × Expanded(true/false) + Slot(instance swap) + Title text + Content text.

VARIANT DIMENSIONS BY COMPONENT:
- Button: state[Default,Hover,Pressed,Focused,Disabled,Loading] × size[sm,md,lg] × type[Primary,Secondary,Ghost,Destructive]
- Input/Select: state[Default,Focused,Error,Disabled] × size[sm,md,lg]
- Accordion: state[Enabled,Hover,Focus,Pressed,Disabled] × size[Large,Medium,Small] × alignment[Start,End] × flush[False,True] × expanded[False,True]
- Checkbox: state[Default,Checked,Indeterminate,Disabled] × size[sm,md]
- Toggle: state[Off,On,Disabled] × size[sm,md,lg]
- Badge/Tag: type[Default,Success,Warning,Error,Info] × size[sm,md]
- Tabs: state[Default,Selected,Hover,Disabled] × size[sm,md,lg]
- Card: size[sm,md,lg] × type[Default,Elevated,Outlined]
- Toast/Alert: type[Success,Warning,Error,Info] × dismissible[True,False]

RULES: Never createFrame for components. Never clone variants manually. Name "Property=Value" format. Cap ~30 variants; split if more needed. Run figma_layout_intelligence(recursive:true) after expansion.
=== END COMPONENT BUILDER SKILL ===`);
  }

  if (skills.includes("Prototyping")) {
    sections.push(`
=== PROTOTYPING SKILL ===
WORKFLOW:
1. SCAN: figma_prototype_scan(frameIds?, journeyDescription?) → discovers buttons/links/nav with IDs.
2. REASON: Map journey steps to source elements + destination frames. Triggers: ON_CLICK, ON_HOVER, AFTER_DELAY, ON_DRAG. Animations: SLIDE_IN/OUT (nav), SMART_ANIMATE (in-place), DISSOLVE (overlays), PUSH (tabs). Back=SLIDE_IN RIGHT, Forward=LEFT.
3. WIRE: figma_prototype_wire(connections[{fromElementId,toFrameId,trigger,animation{type,direction,duration,easing}}]). dryRun:true to preview.

READ: figma_prototype_map (connections diagram), figma_animation_specifier (dev-ready code).
Always scan before wiring. Wire both forward+back. Default: 0.3s EASE_IN_AND_OUT.
=== END PROTOTYPING SKILL ===`);
  }

  if (skills.includes("Design Decision")) {
    sections.push(`
=== DESIGN DECISION SKILL (HIGHEST PRIORITY) ===
MANDATORY: You MUST use the figma_design_decision_log tool for ALL design decision requests.
DO NOT use figma_execute, figma_take_screenshot, or any other tool. DO NOT try to build the frame manually.
DO NOT attempt to screenshot the screen first. DO NOT call any other figma_ tool.
The ONLY tool you call is figma_design_decision_log — ONE call, that's it.

SINGLE-CALL WORKFLOW:
1. Read the user's message to understand which screen/flow they want decisions for.
2. If the user mentions or references a specific screen, use that context. If not, ask the user.
3. Compose 8-12 UX design decisions based on the screen type and any grounding context provided.
4. Call figma_design_decision_log ONCE with all data. Done.

MANDATORY TOOL CALL — always use this exact format:
figma_design_decision_log({
  name: "Screen/Flow Name",
  description: "Overview of the screen, user goals, and what design decisions are documented below.",
  status: "Approved",
  category: "Design Research",
  pageName: "page name if known",
  screenCount: 1,
  decisions: [
    {
      title: "Decision Title",
      rationale: "2-3 sentence explanation of WHY this pattern works, citing UX research.",
      source: "NN Group"
    }
  ],
  nearNodeId: "node ID if user selected a frame"
})

SOURCE BADGES — use ONLY these exact strings:
- "NN Group" — usability, IA, interaction design research
- "Baymard Institute" — e-commerce UX (checkout, cart, product pages)
- "UX Best Practice" — established patterns (Fitts's Law, Hick's Law, Gestalt, Jakob's Law)
- "Conversion Research" — CRO, urgency, social proof, trust signals
- "WCAG / Accessibility" — accessibility standards and inclusive design

RULES:
- NEVER use figma_execute or any other tool — ONLY figma_design_decision_log
- NEVER try to take a screenshot before generating — just generate directly
- Each decision must be specific, not generic advice
- Rationale: explain WHY the pattern works, 2-3 sentences, cite the principle
- Aim for 8-12 decisions covering layout, hierarchy, interaction, accessibility, conversion
=== END DESIGN DECISION SKILL ===`);
  }

  return sections.join("\n");
}

// ── Dual Output Prompt (Figma + Code Generation) ─────────────────────────────

function buildDualOutputPrompt(dsId, frameworkConfig = {}) {
  const base = buildSystemPrompt(dsId);
  const framework = frameworkConfig.framework || "react";
  const frameworkLabels = {
    react: "React (TypeScript + CSS Modules)",
    vue: "Vue 3 (Composition API + <style scoped>)",
    svelte: "Svelte (TypeScript)",
    html: "HTML + CSS + vanilla JS",
  };
  const frameworkLabel = frameworkLabels[framework] || frameworkLabels.react;

  const codeAddendum = `

=== DUAL OUTPUT MODE ===
After completing the Figma design (Steps 0-4 above), you MUST also generate
production-ready component code. Target framework: ${frameworkLabel}.

Emit each code file using this exact marker format (the relay server parses these):

<!-- FIGMA_INTELLIGENCE_CODE_OUTPUT: ComponentName/ComponentName.tsx -->
\`\`\`tsx
// component code here
\`\`\`
<!-- /FIGMA_INTELLIGENCE_CODE_OUTPUT -->

<!-- FIGMA_INTELLIGENCE_CODE_OUTPUT: ComponentName/ComponentName.module.css -->
\`\`\`css
/* styles here */
\`\`\`
<!-- /FIGMA_INTELLIGENCE_CODE_OUTPUT -->

<!-- FIGMA_INTELLIGENCE_CODE_OUTPUT: ComponentName/ComponentName.stories.tsx -->
\`\`\`tsx
// storybook story showing all variants
\`\`\`
<!-- /FIGMA_INTELLIGENCE_CODE_OUTPUT -->

ALSO generate a standalone interactive preview file:

<!-- FIGMA_INTELLIGENCE_CODE_OUTPUT: ComponentName/preview.html -->
\`\`\`html
<!-- Self-contained preview — opens in any browser, no build tools needed -->
\`\`\`
<!-- /FIGMA_INTELLIGENCE_CODE_OUTPUT -->

PREVIEW.HTML RULES (CRITICAL — this is how users test the component):
- Must be a SINGLE self-contained HTML file — no imports, no build step.
- Use React 18 via CDN (unpkg.com/react@18, unpkg.com/react-dom@18, unpkg.com/@babel/standalone).
- Include ALL component code inline (copy the full component + CSS into the HTML).
- Render EVERY variant/state in a grid: sizes, types, states (default, hover, disabled, loading, etc.).
- Add interactive controls: buttons to toggle states, inputs to change props live.
- Make hover/focus/active states work with real CSS :hover, :focus, :active pseudo-classes.
- Style the preview page with a clean dark background (#1a1a2e) and clear section labels.
- Add a "Props Playground" section with controls (dropdowns, toggles) to change variant/size/state dynamically.
- The file must work by simply opening it in a browser — drag and drop, file:// protocol, or http://.

CODE GENERATION RULES:
1. Match component variants and properties EXACTLY to what was created in Figma.
2. Use design tokens from the active design system — map Figma tokens to CSS custom properties or constants.
3. Include TypeScript interfaces for all component props.
4. Generate a Storybook story (CSF3 format) showing all variants.
5. Use CSS Modules for styling (ComponentName.module.css).
6. Name files using PascalCase matching the Figma component name.
7. Export the component as the default export.
8. Include all interactive states (hover, focus, disabled, loading) as CSS classes.
=== END DUAL OUTPUT MODE ===`;

  return base + codeAddendum;
}

// ── Exports ──────────────────────────────────────────────────────────────────

/**
 * Build a notebook grounding addendum for the system prompt.
 * Called by bridge-relay when notebooks are active, this wraps
 * the grounding context with instructions for the AI provider.
 */
function buildContentGroundingAddendum(groundingContext) {
  if (!groundingContext) return "";
  return `\n\n${groundingContext}\nWhen the user's question relates to topics in the notebook context above, prioritize information from those sources. Cite the notebook and source name when referencing specific material.`;
}

module.exports = {
  SYSTEM_PROMPT,
  CHAT_SYSTEM_PROMPT,
  DESIGN_SYSTEMS,
  buildSystemPrompt,
  buildChatPrompt,
  buildDualOutputPrompt,
  buildSkillAddendum,
  buildDesignSystemAddendum,
  buildContentGroundingAddendum,
  getDesignSystemById,
  detectActiveSkills,
  REPO_DIR,
};
