#!/usr/bin/env node
/**
 * figma-intelligence-layer — MCP Server
 * 22 tools across 5 phases for pixel-accurate, bidirectional, context-aware AI ↔ Design collaboration.
 *
 * Architecture:
 *   Claude Desktop / Claude Code
 *     ↓  MCP protocol (stdio)
 *   This MCP server (figma-intelligence-layer)
 *     ↓  WebSocket
 *   Figma Desktop Bridge Plugin
 *     ↓  Plugin API
 *   Figma Electron App
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Phase 1: Visual Intelligence ───────────────────────────────────────────
import { screenClonerHandler } from "./tools/phase1-vision/screen-cloner/index.js";
import { visualAuditHandler } from "./tools/phase1-vision/visual-audit/index.js";
import { a11yAuditHandler } from "./tools/phase1-vision/a11y-audit/index.js";
import { sketchToDesignHandler } from "./tools/phase1-vision/sketch-to-design/index.js";
import { designFromRefHandler } from "./tools/phase1-vision/design-from-ref/index.js";

// ─── Phase 2: Design System Accuracy ────────────────────────────────────────
import { intentTranslatorHandler } from "./tools/phase2-accuracy/intent-translator/index.js";
import { layoutIntelligenceHandler } from "./tools/phase2-accuracy/layout-intelligence/index.js";
import { variantExpanderHandler } from "./tools/phase2-accuracy/variant-expander/index.js";
import { themeGeneratorHandler } from "./tools/phase2-accuracy/theme-generator/index.js";
import { lintRulesHandler } from "./tools/phase2-accuracy/lint-rules/index.js";
import { componentAuditHandler } from "./tools/phase2-accuracy/component-audit/index.js";

// ─── Phase 3: Generation & Scaffolding ──────────────────────────────────────
import { componentArchaeologistHandler } from "./tools/phase3-generation/component-archaeologist/index.js";
import { pageArchitectHandler } from "./tools/phase3-generation/page-architect/index.js";
import { generateImageAndInsertHandler } from "./tools/phase3-generation/ai-image-insert/index.js";
import { figmaUnsplashSearchHandler } from "./tools/phase3-generation/unsplash-search/index.js";
import { urlToFrameHandler } from "./tools/phase3-generation/url-to-frame/index.js";
import { systemDriftHandler } from "./tools/phase3-generation/system-drift/index.js";
import { prototypeMapHandler } from "./tools/phase3-generation/prototype-map/index.js";
import { animatedBuildHandler } from "./tools/phase3-generation/figma-animated-build.js";

// ─── Phase 4: Sync & Bidirectionality ───────────────────────────────────────
import { animationSpecifierHandler } from "./tools/phase4-sync/animation-specifier/index.js";
import { syncFromCodeHandler } from "./tools/phase4-sync/sync-from-code/index.js";
import { webhookListenerHandler } from "./tools/phase4-sync/webhook-listener/index.js";

// ─── Phase 5: Memory, Governance & Health ───────────────────────────────────
import { dsScaffolderHandler } from "./tools/phase5-governance/ds-scaffolder/index.js";
import { dsVariablesHandler } from "./tools/phase5-governance/ds-variables/index.js";
import { decisionLogToolHandler } from "./tools/phase5-governance/decision-log/index.js";
import { healthReportHandler } from "./tools/phase5-governance/health-report/index.js";
import { generateSpecHandler } from "./tools/phase5-governance/spec-generator/index.js";
import { figmaApgDocHandler } from "./tools/phase5-governance/apg-doc/index.js";
import { dsPrimitivesHandler } from "./tools/phase5-governance/ds-primitives/index.js";
import { tokenNamingHandler } from "./tools/phase5-governance/token-naming/index.js";
import { tokenMigrateHandler } from "./tools/phase5-governance/token-migrate/index.js";

// ─── Bridge (for direct execute) ────────────────────────────────────────────
import { ensureRelayServer, getBridge } from "./shared/figma-bridge.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tool registry — 22 tools
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  // ── Phase 1 ──────────────────────────────────────────────────────────────
  {
    name: "figma_screen_cloner",
    description:
      "Takes any screenshot or image and reconstructs it as a Figma frame using your real design system — components, tokens, Auto Layout. Three modes: pixel (exact replica), system (DS-enforced), adaptive (system clone + improvement suggestions).",
    inputSchema: {
      type: "object",
      properties: {
        image: { type: "string", description: "Base64 image, data URI, URL, or file path" },
        cloneMode: { type: "string", enum: ["pixel", "system", "adaptive"], description: "Clone fidelity mode" },
        frameWidth: { type: "number", description: "Output frame width in px (default 1440)" },
        targetPage: { type: "string", description: "Figma page name to place the output frame" },
        annotateUnmatched: { type: "boolean", description: "Add sticky notes for zones with no DS match" },
      },
      required: ["image", "cloneMode"],
    },
  },
  {
    name: "figma_visual_audit",
    description:
      "Vision-based UX quality audit. Takes a screenshot or Figma node, returns severity-ranked issues (hierarchy, contrast, density, brand alignment, consistency) as Figma annotations and/or a structured report.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Figma node ID to audit (will be screenshotted)" },
        imageInput: { type: "string", description: "External screenshot (base64 or URL)" },
        auditAreas: {
          type: "array",
          items: { type: "string", enum: ["hierarchy", "contrast", "density", "brand", "consistency"] },
          description: "Which audit dimensions to run",
        },
        outputFormat: { type: "string", enum: ["report", "annotations", "both"] },
      },
      required: ["auditAreas", "outputFormat"],
    },
  },
  {
    name: "figma_a11y_audit",
    description:
      "Automated WCAG 2.2 compliance audit. Checks text contrast, touch targets, focus indicators, reading order, and more. Optionally simulates 4 color-blindness profiles. Works without Figma Enterprise.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Figma node ID to audit" },
        wcagLevel: { type: "string", enum: ["A", "AA", "AAA"] },
        includeColorBlindSim: { type: "boolean" },
        outputFormat: { type: "string", enum: ["inline", "report", "both"] },
        autoSuggestFixes: { type: "boolean" },
      },
      required: ["nodeId", "wcagLevel", "outputFormat"],
    },
  },
  {
    name: "figma_sketch_to_design",
    description:
      "Upload a hand-drawn wireframe, whiteboard photo, or lo-fi sketch and receive a production-quality Figma frame using your design system components.",
    inputSchema: {
      type: "object",
      properties: {
        image: { type: "string", description: "Base64 sketch or whiteboard photo" },
        productContext: { type: "string", description: "e.g. 'mobile banking app checkout flow'" },
        strictDSOnly: { type: "boolean", description: "Error if no DS match found" },
        frameWidth: { type: "number" },
        annotateInterpretations: { type: "boolean" },
      },
      required: ["image"],
    },
  },
  {
    name: "figma_design_from_ref",
    description:
      "Provide reference images (competitor screenshots, mood boards) plus a prompt. Receive a new design built with YOUR design system — a re-interpretation, not a clone.",
    inputSchema: {
      type: "object",
      properties: {
        references: { type: "array", items: { type: "string" }, description: "Array of base64 images or URLs" },
        prompt: { type: "string", description: "e.g. 'Build something like this but for our fintech brand'" },
        extractOnly: {
          type: "array",
          items: { type: "string", enum: ["layout", "spacing", "color-palette", "typography"] },
        },
        designSystemContext: { type: "string" },
      },
      required: ["references", "prompt"],
    },
  },

  // ── Phase 2 ──────────────────────────────────────────────────────────────
  {
    name: "figma_intent_translator",
    description:
      "Translates vague natural language prompts into precise, design-system-aware creation instructions. Eliminates hallucinated components and hardcoded values before any figma_execute call.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Natural language design request" },
        context: { type: "string", description: "Current page/frame context" },
        strictMode: { type: "boolean", description: "Error instead of fallback if no DS match" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "figma_layout_intelligence",
    description:
      "Analyze any frame and apply production-ready Auto Layout settings with design token binding in one command. Detects container type and applies the optimal layout pattern.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        applyChanges: { type: "boolean", description: "false = preview/report only" },
        spacingTokenSet: { type: "string" },
        responsiveHints: { type: "boolean" },
        reportDiff: { type: "boolean" },
      },
      required: ["nodeId", "applyChanges"],
    },
  },
  {
    name: "figma_variant_expander",
    description:
      "Turn one component state into a complete, production-ready variant matrix — all states, sizes, and themes automatically.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        dimensions: {
          type: "object",
          properties: {
            state: { type: "array", items: { type: "string" } },
            size: { type: "array", items: { type: "string" } },
            theme: { type: "array", items: { type: "string" } },
            type: { type: "array", items: { type: "string" } },
          },
        },
        namingConvention: { type: "string", enum: ["figma", "storybook"] },
        autoApplyTokens: { type: "boolean" },
        arrangeInGrid: { type: "boolean" },
      },
      required: ["nodeId", "dimensions", "namingConvention", "autoApplyTokens"],
    },
  },
  {
    name: "figma_theme_generator",
    description:
      "Generate new color modes — dark mode, high contrast, brand variants — from an existing theme while preserving semantic intent and WCAG compliance.",
    inputSchema: {
      type: "object",
      properties: {
        sourceMode: { type: "string", description: "e.g. 'Light'" },
        newModeName: { type: "string", description: "e.g. 'Dark' or 'Brand Warm'" },
        strategy: { type: "string", enum: ["dark", "high-contrast", "brand-shift", "custom"] },
        brandDirection: { type: "string", description: "e.g. 'warmer and more approachable'" },
        wcagTarget: { type: "string", enum: ["AA", "AAA"] },
        previewBeforeApply: { type: "boolean" },
      },
      required: ["sourceMode", "newModeName", "strategy", "wcagTarget", "previewBeforeApply"],
    },
  },
  {
    name: "figma_lint_rules",
    description:
      "Define and enforce custom design system rules across an entire Figma file. Design-system ESLint — built-in rules for hardcoded colors, spacing grid violations, touch targets, and more.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["define", "run", "list", "delete"] },
        ruleFile: { type: "string", description: "Path to YAML rule definition file" },
        nodeId: { type: "string", description: "Scope to specific node (default: whole file)" },
        autoFix: { type: "boolean" },
        outputFormat: { type: "string", enum: ["inline", "report", "ci"] },
      },
      required: ["action", "outputFormat"],
    },
  },
  {
    name: "figma_component_audit",
    description:
      "Complete component usage analytics — which components are used, how often, orphaned components, detached instances, override hotspots, and duplicate patterns.",
    inputSchema: {
      type: "object",
      properties: {
        fileKey: { type: "string" },
        includeLibraryComponents: { type: "boolean" },
        detectOrphans: { type: "boolean" },
        groupBy: { type: "string", enum: ["page", "component", "team"] },
      },
    },
  },

  // ── Phase 3 ──────────────────────────────────────────────────────────────
  {
    name: "figma_component_archaeologist",
    description:
      "Reverse-engineer undocumented, legacy, or raw Figma frames into proper design system components. Fingerprints layer structure, maps hardcoded values to tokens, and creates library components.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        outputAs: { type: "string", enum: ["analysis", "component", "both"] },
        bindToExisting: { type: "boolean" },
        createLibraryComponent: { type: "boolean" },
        generateDocStub: { type: "boolean" },
      },
      required: ["nodeId", "outputAs"],
    },
  },
  {
    name: "figma_page_architect",
    description:
      "Generate complete, prototype-wired multi-screen flows from a plain-language product description using your real design system. Two weeks of wireframing in minutes.",
    inputSchema: {
      type: "object",
      properties: {
        productContext: { type: "string", description: "e.g. 'Fintech mobile app for expense tracking'" },
        flow: { type: "string", description: "e.g. 'Onboarding: email signup → OTP → profile → success'" },
        platform: { type: "string", enum: ["web", "mobile", "both"] },
        width: { type: "number" },
        wireframeMode: { type: "boolean" },
        includeFlowMap: { type: "boolean" },
        contentMode: { type: "string", enum: ["placeholder", "realistic"] },
        useStockImages: { type: "boolean", description: "Automatically pull Unsplash photos for image-heavy product flows" },
        imageQuery: { type: "string", description: "Optional image search phrase override for stock imagery" },
      },
      required: ["productContext", "flow", "platform", "contentMode"],
    },
  },
  {
    name: "figma_generate_image_and_insert",
    description:
      "Generate an AI image with Gemini and insert it into Figma. If targetNodeId is provided, fill that node when possible; otherwise create a new image-backed rectangle on the current page.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Image generation prompt" },
        targetNodeId: { type: "string", description: "Optional node ID to fill or place into" },
        width: { type: "number", description: "Inserted image width in px when creating a new node" },
        height: { type: "number", description: "Inserted image height in px when creating a new node" },
        style: { type: "string", description: "Optional visual style guidance appended to the prompt" },
        provider: { type: "string", enum: ["gemini", "automatic1111", "comfyui"], description: "Image provider" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "figma_unsplash_search",
    description:
      "Search Unsplash for production-ready photography to use in generated Figma screens. Best for ecommerce, travel, food, wellness, lifestyle, and other image-forward interfaces.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search phrase such as 'premium skincare product' or 'hotel lobby'" },
        count: { type: "number", description: "Number of photos to return (default 4, max 10)" },
        page: { type: "number", description: "Search result page" },
        orientation: { type: "string", enum: ["landscape", "portrait", "squarish"] },
        contentFilter: { type: "string", enum: ["low", "high"], description: "Filter mature content" },
        color: { type: "string", description: "Optional color filter such as 'black_and_white', 'blue', or 'green'" },
        trackDownloads: { type: "boolean", description: "When true, register returned images with Unsplash download tracking" },
      },
      required: ["query"],
    },
  },
  {
    name: "figma_url_to_frame",
    description:
      "Capture any live URL and convert it into responsive Figma frames at mobile, tablet, and desktop breakpoints — built with your design system.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        breakpoints: {
          type: "array",
          items: { type: "string", enum: ["mobile", "tablet", "desktop"] },
        },
        cloneMode: { type: "string", enum: ["pixel", "system", "adaptive"] },
        addCompetitorAnnotations: { type: "boolean" },
        dsGapReport: { type: "boolean" },
      },
      required: ["url", "breakpoints", "cloneMode"],
    },
  },
  {
    name: "figma_system_drift",
    description:
      "Compare design token snapshots across multiple Figma files and surface where teams are diverging from the canonical design system. Drift score: 0-5% healthy, 5-15% warning, 15%+ critical.",
    inputSchema: {
      type: "object",
      properties: {
        canonicalFileKey: { type: "string" },
        targetFileKeys: { type: "array", items: { type: "string" } },
        tokenTypes: { type: "array", items: { type: "string" } },
        threshold: { type: "number", description: "Drift % to trigger warning (default 5%)" },
        outputFormat: { type: "string", enum: ["report", "annotations", "pr-comment"] },
      },
      required: ["canonicalFileKey", "targetFileKeys", "outputFormat"],
    },
  },
  {
    name: "figma_prototype_map",
    description:
      "Extract all Figma prototype connections and return a navigable state machine — every screen, transition, trigger, and animation spec as JSON and/or a Mermaid diagram.",
    inputSchema: {
      type: "object",
      properties: {
        fileKey: { type: "string" },
        startFrameId: { type: "string" },
        includeAnimationSpecs: { type: "boolean" },
        outputFormat: { type: "string", enum: ["json", "mermaid", "both"] },
      },
      required: ["outputFormat"],
    },
  },

  {
    name: "figma_animated_build",
    description:
      "Simulates multi-agent collaborative design: two colored cursor overlays (Claude + Codex) move around the Figma canvas, show chat bubbles, and progressively build UI elements one-by-one — pencil.dev-style. Ships with a built-in iOS screen template. Pass agents/steps to fully customize.",
    inputSchema: {
      type: "object",
      properties: {
        agents: {
          type: "array",
          description: "Agent definitions (id, name, hex color). Defaults to Claude (#7C3AED) + Codex (#0EA5E9).",
          items: {
            type: "object",
            properties: {
              id:    { type: "string", description: "Unique agent identifier" },
              name:  { type: "string", description: "Display name shown in badge" },
              color: { type: "string", description: "Hex color, e.g. #7C3AED" },
            },
            required: ["id", "name", "color"],
          },
        },
        steps: {
          type: "array",
          description: "Ordered build steps. Omit to use the default iOS screen template.",
          items: {
            type: "object",
            properties: {
              type:     { type: "string", enum: ["moveCursor","showChat","hideChat","createFrame","createRect","createText","createEllipse","pause"] },
              agentId:  { type: "string" },
              x:        { type: "number" },
              y:        { type: "number" },
              text:     { type: "string" },
              name:     { type: "string" },
              w:        { type: "number" },
              h:        { type: "number" },
              color:    { type: "string" },
              radius:   { type: "number" },
              size:     { type: "number" },
              parentId: { type: "string" },
              ms:       { type: "number" },
            },
            required: ["type"],
          },
        },
        stepDelayMs: {
          type: "number",
          description: "Milliseconds between steps (default 600).",
        },
      },
    },
  },

  // ── Phase 4 ──────────────────────────────────────────────────────────────
  {
    name: "figma_animation_specifier",
    description:
      "Read Figma prototype transitions and output developer-ready animation code for Framer Motion, CSS, Swift, Android, or all frameworks at once.",
    inputSchema: {
      type: "object",
      properties: {
        fileKey: { type: "string" },
        frameNodeId: { type: "string" },
        outputFormat: {
          type: "string",
          enum: ["json", "framer-motion", "css", "swift", "android", "all"],
        },
      },
      required: ["outputFormat"],
    },
  },
  {
    name: "figma_sync_from_code",
    description:
      "Reconcile Storybook component APIs against Figma component properties. Surface mismatches (missing props, value differences) and optionally sync Figma to match code.",
    inputSchema: {
      type: "object",
      properties: {
        storybookUrl: { type: "string" },
        figmaLibraryFileKey: { type: "string" },
        components: { type: "array", items: { type: "string" } },
        syncDirection: { type: "string", enum: ["report", "update-figma", "update-code-stub"] },
      },
      required: ["storybookUrl", "figmaLibraryFileKey", "syncDirection"],
    },
  },
  {
    name: "figma_webhook_listener",
    description:
      "Subscribe to Figma file change events and trigger automated reactions: run lint on token changes, audit on component changes, health report on library publish, Slack/GitHub notifications.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["subscribe", "unsubscribe", "list", "test"] },
        fileKey: { type: "string" },
        events: {
          type: "array",
          items: { type: "string", enum: ["FILE_UPDATE", "LIBRARY_PUBLISH", "COMMENT_CREATED"] },
        },
        triggers: {
          type: "object",
          properties: {
            onTokenChange: { type: "string" },
            onComponentChange: { type: "string" },
            onLibraryPublish: { type: "string" },
          },
        },
        notificationChannels: {
          type: "object",
          properties: {
            slack: { type: "string" },
            github: { type: "string" },
            email: { type: "array", items: { type: "string" } },
          },
        },
      },
      required: ["action", "fileKey"],
    },
  },

  // ── Phase 5 ──────────────────────────────────────────────────────────────
  {
    name: "figma_design_system_scaffolder",
    description:
      "Bootstrap a complete, production-ready design system from just brand colors and product type. Generates full token system, component library, and page templates. Two weeks of work in three minutes.",
    inputSchema: {
      type: "object",
      properties: {
        brandColors: {
          type: "object",
          properties: {
            primary: { type: "string", description: "e.g. '#2563EB'" },
            secondary: { type: "string" },
            neutral: { type: "string" },
            accent: { type: "string" },
          },
          required: ["primary"],
        },
        productType: { type: "string", enum: ["web-app", "mobile-app", "both", "marketing"] },
        brandName: { type: "string" },
        includeComponents: {
          type: "array",
          items: { type: "string", enum: ["core", "forms", "navigation", "data", "feedback", "overlay"] },
        },
        generateDarkMode: { type: "boolean" },
        dtcgExport: { type: "boolean" },
      },
      required: ["brandColors", "productType", "brandName", "includeComponents", "generateDarkMode"],
    },
  },
  {
    name: "figma_design_system_primitives",
    description:
      "Diagnose Figma variable capability and create first-class design-system primitive variable collections for color, typography, spacing, radius, border, opacity, and elevation.",
    inputSchema: {
      type: "object",
      properties: {
        brandName: { type: "string", description: "Design system or brand name" },
        primaryColor: { type: "string", description: "Primary brand hex color" },
        secondaryColor: { type: "string", description: "Secondary brand hex color" },
        neutralColor: { type: "string", description: "Neutral base hex color" },
        accentColor: { type: "string", description: "Accent hex color" },
        createSemantics: { type: "boolean", description: "Also create semantic color aliases" },
        createDarkMode: { type: "boolean", description: "Create Light and Dark modes for color collections" },
      },
      required: ["brandName"],
    },
  },
  {
    name: "figma_design_system_variables",
    description:
      "Diagnose, scaffold, and manage design-system variable collections for primitives, semantics, and component tokens, including alias-based variable wiring.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "diagnose",
            "scaffold-primitives",
            "scaffold-semantics",
            "scaffold-components",
            "scaffold-all",
            "create-collections",
            "create-variables",
          ],
        },
        brandName: { type: "string" },
        primaryColor: { type: "string" },
        secondaryColor: { type: "string" },
        neutralColor: { type: "string" },
        accentColor: { type: "string" },
        createDarkMode: { type: "boolean" },
        createSemantics: { type: "boolean" },
        collections: { type: "array", items: { type: "object" } },
        variables: { type: "array", items: { type: "object" } },
        componentTemplates: { type: "array", items: { type: "object" } },
      },
      required: ["action"],
    },
  },
  {
    name: "figma_token_naming_convention",
    description:
      "Define, validate, and audit design-token naming conventions so primitive, semantic, and component token names stay accurate and consistent.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["define", "validate", "suggest-renames", "audit-current-file"],
        },
        names: {
          type: "array",
          items: { type: "string" },
          description: "Token names to validate or normalize.",
        },
        collectionName: {
          type: "string",
          description: "Optional collection name to audit when using audit-current-file.",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "figma_decision_log",
    description:
      "Persistent memory layer. Log every AI design action with rationale. Query past decisions ('why was --color-primary changed?'). Export complete history. No context is ever lost between sessions.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["log", "query", "export", "clear"] },
        entry: {
          type: "object",
          properties: {
            tool: { type: "string" },
            nodeIds: { type: "array", items: { type: "string" } },
            rationale: { type: "string" },
            tokens: { type: "array", items: { type: "string" } },
            reversible: { type: "boolean" },
          },
        },
        query: { type: "string" },
        exportFormat: { type: "string", enum: ["json", "markdown"] },
      },
      required: ["action"],
    },
  },
  {
    name: "figma_health_report",
    description:
      "Capstone governance tool. Runs all audits in sequence and returns a composite design system health score (0-100) across 6 dimensions: token coverage, accessibility, component adoption, documentation, lint, drift.",
    inputSchema: {
      type: "object",
      properties: {
        fileKey: { type: "string" },
        includeHistory: { type: "boolean" },
        outputFormat: { type: "string", enum: ["report", "figma-page", "slack-digest", "all"] },
        runAudits: {
          type: "array",
          items: { type: "string", enum: ["a11y", "lint", "tokens", "components", "drift", "all"] },
        },
      },
      required: ["outputFormat", "runAudits"],
    },
  },
  {
    name: "figma_generate_spec",
    description:
      "Generate design-system documentation for a selected Figma node or component. Supports classic specs plus AI-assisted anatomy/usage and accessibility documents, can render documentation pages back into Figma, and can auto-write a compact developer handoff summary to the target node description.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Optional target node. If omitted, the current Figma selection is used." },
        outputFormat: { type: "string", enum: ["json", "report", "figma-page", "all"] },
        documentType: {
          type: "string",
          enum: ["spec", "anatomy-usage", "accessibility", "accessibility-annotation", "full-documentation"],
          description: "Choose whether to generate the classic spec, an anatomy/usage doc, an accessibility doc, a screen-level accessibility annotation, or both documentation pages.",
        },
        includeTokens: { type: "boolean", description: "Include token aliases when detected." },
        includeAnnotations: { type: "boolean", description: "Reserved for future in-file callouts." },
        pageName: { type: "string", description: "Optional custom page name for the generated Figma spec." },
        writeToDescription: {
          type: "boolean",
          description: "When true, writes a compact developer handoff summary to the target node description. Defaults to true for figma-page/all output.",
        },
      },
      required: ["outputFormat"],
    },
  },
  {
    name: "figma_apg_doc",
    description:
      "Generate APG-backed accessibility documentation for a selected Figma component. Maps the node to a WAI-ARIA Authoring Practices pattern, then returns native-first guidance, naming rules, roles/states, keyboard/focus specs, QA checks, and optional implementation starters.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Optional target node. If omitted, the current Figma selection is used." },
        patternHint: { type: "string", description: "Optional hint such as button, tabs, dialog, combobox, or switch." },
        framework: { type: "string", enum: ["html", "react", "vue", "angular"] },
        outputFormat: { type: "string", enum: ["json", "report", "figma-page", "all"] },
        includeCodeExamples: { type: "boolean", description: "Include a starter implementation snippet aligned to the chosen framework." },
        writeToDescription: { type: "boolean", description: "Write the generated APG doc into the target node description." },
        descriptionMode: { type: "string", enum: ["replace", "append"], description: "How to write back into the node description when writeToDescription is enabled." },
        pageName: { type: "string", description: "Optional custom page name when rendering to Figma." },
      },
      required: ["outputFormat"],
    },
  },
  // ── Direct Execute ───────────────────────────────────────────────────────
  {
    name: "figma_execute",
    description:
      "Execute Figma Plugin API code directly in the connected Figma file. The code runs inside the plugin sandbox with full access to the Figma Plugin API. Use `return` to return a value. All Figma API calls must use async methods (e.g. getNodeByIdAsync, findAllAsync).",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Figma Plugin API code to execute. Use `return` to return results." },
      },
      required: ["code"],
    },
  },
  {
    name: "figma_token_migrate",
    description:
      "Scan variables and local styles, detect naming/schema drift, propose canonical names, and optionally rename in place with variable alias compatibility.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["scan", "preview", "apply"] },
        scope: { type: "string", enum: ["variables", "styles", "all"], description: "Which design assets to inspect." },
        collectionName: { type: "string", description: "Optional variable collection filter." },
        canonicalSchema: {
          type: "string",
          enum: ["compact", "expanded"],
          description: "compact matches names like color/brand/500; expanded matches color/primitive/brand/500.",
        },
        renameInPlace: { type: "boolean", description: "When true, safe rename suggestions are applied during apply." },
        createAliases: { type: "boolean", description: "Create variable aliases using the original names after rename." },
        dryRun: { type: "boolean", description: "Preview apply output without writing changes." },
      },
      required: ["action"],
    },
  },

  // ── Navigation & Status ────────────────────────────────────────────────
  {
    name: "figma_get_status",
    description: "Check Figma connection status. Returns file name, current page, page count, and WebSocket state.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "figma_navigate",
    description: "Scroll and zoom the Figma viewport to center on a specific node.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "The node ID to navigate to" },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "figma_get_selection",
    description: "Get the currently selected nodes in Figma.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "figma_take_screenshot",
    description: "Capture a screenshot of a specific node or the current page as a PNG image.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Node ID to screenshot. If omitted, captures the current page." },
        scale: { type: "number", description: "Export scale (default 2)" },
      },
    },
  },
  {
    name: "figma_get_node",
    description: "Get detailed information about a specific Figma node including fills, strokes, effects, layout, and children.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "The Figma node ID" },
      },
      required: ["nodeId"],
    },
  },

  // ── Variable Management ────────────────────────────────────────────────
  {
    name: "figma_create_variable_collection",
    description: "Create a new variable collection (e.g. 'Brand Colors', 'Spacing') with an optional initial mode name.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Collection name" },
        initialModeName: { type: "string", description: "Name for the first mode (default: 'Mode 1')" },
      },
      required: ["name"],
    },
  },
  {
    name: "figma_create_variable",
    description: "Create a new design variable/token in a collection. Supports COLOR, FLOAT, STRING, BOOLEAN types.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Variable name (e.g. 'primary/500')" },
        collectionId: { type: "string", description: "Target collection ID" },
        resolvedType: { type: "string", enum: ["COLOR", "FLOAT", "STRING", "BOOLEAN"], description: "Variable type" },
        valuesByMode: { type: "object", description: "Values keyed by mode ID. For COLOR: {r, g, b, a} with 0-1 range." },
        description: { type: "string", description: "Optional variable description" },
      },
      required: ["name", "collectionId", "resolvedType"],
    },
  },
  {
    name: "figma_update_variable",
    description: "Update the value of an existing variable in a specific mode.",
    inputSchema: {
      type: "object",
      properties: {
        variableId: { type: "string", description: "Variable ID to update" },
        modeId: { type: "string", description: "Mode ID to set the value for" },
        value: { description: "New value. For COLOR: {r, g, b, a} with 0-1 range. For FLOAT: number. For STRING: string." },
      },
      required: ["variableId", "modeId", "value"],
    },
  },
  {
    name: "figma_delete_variable",
    description: "Delete a variable by ID.",
    inputSchema: {
      type: "object",
      properties: {
        variableId: { type: "string", description: "Variable ID to delete" },
      },
      required: ["variableId"],
    },
  },
  {
    name: "figma_rename_variable",
    description: "Rename a variable while preserving its values.",
    inputSchema: {
      type: "object",
      properties: {
        variableId: { type: "string", description: "Variable ID" },
        newName: { type: "string", description: "New name for the variable" },
      },
      required: ["variableId", "newName"],
    },
  },
  {
    name: "figma_delete_variable_collection",
    description: "Delete a variable collection and all its variables.",
    inputSchema: {
      type: "object",
      properties: {
        collectionId: { type: "string", description: "Collection ID to delete" },
      },
      required: ["collectionId"],
    },
  },
  {
    name: "figma_add_mode",
    description: "Add a new mode to a variable collection (e.g. 'Dark', 'Mobile').",
    inputSchema: {
      type: "object",
      properties: {
        collectionId: { type: "string", description: "Collection ID" },
        modeName: { type: "string", description: "Name for the new mode" },
      },
      required: ["collectionId", "modeName"],
    },
  },
  {
    name: "figma_rename_mode",
    description: "Rename an existing mode in a variable collection.",
    inputSchema: {
      type: "object",
      properties: {
        collectionId: { type: "string", description: "Collection ID" },
        modeId: { type: "string", description: "Mode ID to rename" },
        newName: { type: "string", description: "New mode name" },
      },
      required: ["collectionId", "modeId", "newName"],
    },
  },
  {
    name: "figma_batch_create_variables",
    description: "Create up to 100 variables in one call. 10-50x faster than individual creates.",
    inputSchema: {
      type: "object",
      properties: {
        variables: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              collectionId: { type: "string" },
              resolvedType: { type: "string", enum: ["COLOR", "FLOAT", "STRING", "BOOLEAN"] },
              valuesByMode: { type: "object" },
              description: { type: "string" },
            },
            required: ["name", "collectionId", "resolvedType"],
          },
          description: "Array of variable specs to create",
        },
      },
      required: ["variables"],
    },
  },
  {
    name: "figma_batch_update_variables",
    description: "Update up to 100 variable values in one call. 10-50x faster than individual updates.",
    inputSchema: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              variableId: { type: "string" },
              modeId: { type: "string" },
              value: {},
            },
            required: ["variableId", "modeId", "value"],
          },
          description: "Array of {variableId, modeId, value} updates",
        },
      },
      required: ["updates"],
    },
  },
  {
    name: "figma_get_variables",
    description: "Get all design variables/tokens organized by collection. Supports verbosity levels: 'inventory' (names only), 'summary' (with values), 'full' (everything).",
    inputSchema: {
      type: "object",
      properties: {
        collectionId: { type: "string", description: "Filter to a specific collection" },
        verbosity: { type: "string", enum: ["inventory", "summary", "full"], description: "Detail level (default: summary)" },
      },
    },
  },

  // ── Node Operations ────────────────────────────────────────────────────
  {
    name: "figma_clone_node",
    description: "Clone/duplicate a node. Optionally position the clone.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Node ID to clone" },
        x: { type: "number", description: "X position for the clone" },
        y: { type: "number", description: "Y position for the clone" },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "figma_delete_node",
    description: "Delete a node from the Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Node ID to delete" },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "figma_move_node",
    description: "Move a node to new coordinates and/or reparent it to a different container.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Node ID to move" },
        x: { type: "number", description: "New X position" },
        y: { type: "number", description: "New Y position" },
        parentId: { type: "string", description: "New parent node ID (reparent)" },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "figma_resize_node",
    description: "Resize a node to new dimensions.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Node ID to resize" },
        width: { type: "number", description: "New width" },
        height: { type: "number", description: "New height" },
      },
      required: ["nodeId", "width", "height"],
    },
  },
  {
    name: "figma_rename_node",
    description: "Rename a node in Figma.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Node ID to rename" },
        newName: { type: "string", description: "New name" },
      },
      required: ["nodeId", "newName"],
    },
  },
  {
    name: "figma_set_fills",
    description: "Set the fill paints on a node. Accepts an array of Figma Paint objects.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Node ID" },
        fills: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["SOLID", "GRADIENT_LINEAR", "GRADIENT_RADIAL", "IMAGE"] },
              color: { type: "object", properties: { r: { type: "number" }, g: { type: "number" }, b: { type: "number" } } },
              opacity: { type: "number" },
            },
          },
          description: "Array of fill paints (e.g. [{type:'SOLID', color:{r:1,g:0,b:0}}])",
        },
      },
      required: ["nodeId", "fills"],
    },
  },
  {
    name: "figma_set_strokes",
    description: "Set strokes on a node. Accepts an array of Figma Paint objects and optional stroke weight.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Node ID" },
        strokes: { type: "array", description: "Array of stroke paints" },
        strokeWeight: { type: "number", description: "Stroke weight in pixels" },
      },
      required: ["nodeId", "strokes"],
    },
  },
  {
    name: "figma_set_text",
    description: "Set the text content of a text node. Automatically loads the required font.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Text node ID" },
        characters: { type: "string", description: "New text content" },
        fontSize: { type: "number", description: "Optional font size" },
      },
      required: ["nodeId", "characters"],
    },
  },

  // ── Component Operations ───────────────────────────────────────────────
  {
    name: "figma_search_components",
    description: "Search for components and component sets in the current page by name. Returns matching components with ID, name, type, and description.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (matched against component names)" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: ["query"],
    },
  },
  {
    name: "figma_instantiate_component",
    description: "Create an instance of a component or component set variant. For component sets, specify variant properties to pick a specific variant.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Component or ComponentSet node ID" },
        variant: { type: "object", description: "Variant properties to match (e.g. {size: 'large', state: 'hover'})" },
        x: { type: "number", description: "X position" },
        y: { type: "number", description: "Y position" },
        parentId: { type: "string", description: "Parent node to insert into" },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "figma_set_description",
    description: "Set the description on a component, component set, or style. Descriptions appear in Dev Mode.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Node ID" },
        description: { type: "string", description: "Description text (supports markdown)" },
      },
      required: ["nodeId", "description"],
    },
  },
  {
    name: "figma_get_styles",
    description: "Get all local paint, text, and effect styles from the current file.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "figma_create_child",
    description: "Create a new child node (FRAME, TEXT, RECTANGLE, ELLIPSE, LINE, COMPONENT, SECTION) inside a parent.",
    inputSchema: {
      type: "object",
      properties: {
        childType: { type: "string", enum: ["FRAME", "TEXT", "RECTANGLE", "ELLIPSE", "LINE", "COMPONENT", "SECTION"], description: "Type of node to create" },
        parentId: { type: "string", description: "Parent node ID (default: current page)" },
        name: { type: "string", description: "Node name" },
        width: { type: "number", description: "Width" },
        height: { type: "number", description: "Height" },
        x: { type: "number", description: "X position" },
        y: { type: "number", description: "Y position" },
        characters: { type: "string", description: "Text content (only for TEXT type)" },
      },
      required: ["childType"],
    },
  },
  {
    name: "figma_get_pages",
    description: "List all pages in the current Figma file.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "figma_create_page",
    description: "Create a new page in the Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Page name" },
      },
      required: ["name"],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tool handler dispatch
// ─────────────────────────────────────────────────────────────────────────────

type AnyArgs = Record<string, unknown>;

async function dispatch(name: string, args: AnyArgs): Promise<unknown> {
  switch (name) {
    // Phase 1
    case "figma_screen_cloner":        return screenClonerHandler(args as never);
    case "figma_visual_audit":         return visualAuditHandler(args as never);
    case "figma_a11y_audit":           return a11yAuditHandler(args as never);
    case "figma_sketch_to_design":     return sketchToDesignHandler(args as never);
    case "figma_design_from_ref":      return designFromRefHandler(args as never);
    // Phase 2
    case "figma_intent_translator":    return intentTranslatorHandler(args as never);
    case "figma_layout_intelligence":  return layoutIntelligenceHandler(args as never);
    case "figma_variant_expander":     return variantExpanderHandler(args as never);
    case "figma_theme_generator":      return themeGeneratorHandler(args as never);
    case "figma_lint_rules":           return lintRulesHandler(args as never);
    case "figma_component_audit":      return componentAuditHandler(args as never);
    // Phase 3
    case "figma_component_archaeologist": return componentArchaeologistHandler(args as never);
    case "figma_page_architect":       return pageArchitectHandler(args as never);
    case "figma_generate_image_and_insert": return generateImageAndInsertHandler(args as never);
    case "figma_unsplash_search":      return figmaUnsplashSearchHandler(args as never);
    case "figma_url_to_frame":         return urlToFrameHandler(args as never);
    case "figma_system_drift":         return systemDriftHandler(args as never);
    case "figma_prototype_map":        return prototypeMapHandler(args as never);
    case "figma_animated_build":       return animatedBuildHandler(args as never);
    // Phase 4
    case "figma_animation_specifier":  return animationSpecifierHandler(args as never);
    case "figma_sync_from_code":       return syncFromCodeHandler(args as never);
    case "figma_webhook_listener":     return webhookListenerHandler(args as never);
    // Phase 5
    case "figma_design_system_scaffolder": return dsScaffolderHandler(args as never);
    case "figma_design_system_primitives": return dsPrimitivesHandler(args as never);
    case "figma_design_system_variables": return dsVariablesHandler(args as never);
    case "figma_token_naming_convention": return tokenNamingHandler(args as never);
    case "figma_token_migrate":        return tokenMigrateHandler(args as never);
    case "figma_decision_log":         return decisionLogToolHandler(args as never);
    case "figma_health_report":        return healthReportHandler(args as never);
    case "figma_generate_spec":        return generateSpecHandler(args as never);
    case "figma_apg_doc":              return figmaApgDocHandler(args as never);
    // Direct execute
    case "figma_execute": {
      const bridge = await getBridge();
      const execResult = await bridge.execute((args as { code: string }).code);
      if (!execResult.success) throw new Error(execResult.error);
      return execResult.result;
    }

    // ── Navigation & Status ──────────────────────────────────────────────
    case "figma_get_status": {
      const bridge = await getBridge();
      return bridge.getStatus();
    }
    case "figma_navigate": {
      const bridge = await getBridge();
      return bridge.navigate((args as { nodeId: string }).nodeId);
    }
    case "figma_get_selection": {
      const bridge = await getBridge();
      return bridge.getSelection();
    }
    case "figma_take_screenshot": {
      const bridge = await getBridge();
      const a = args as { nodeId?: string; scale?: number };
      if (a.nodeId) {
        return bridge.takeScreenshot(a.nodeId);
      }
      // If no nodeId, screenshot the current page
      const status = await bridge.getStatus() as { currentPage?: { id: string } };
      if (status.currentPage?.id) {
        return bridge.takeScreenshot(status.currentPage.id);
      }
      throw new Error("No nodeId provided and could not determine current page");
    }
    case "figma_get_node": {
      const bridge = await getBridge();
      return bridge.getNode((args as { nodeId: string }).nodeId);
    }

    // ── Variable Management ──────────────────────────────────────────────
    case "figma_create_variable_collection": {
      const bridge = await getBridge();
      const a = args as { name: string; initialModeName?: string };
      return bridge.createVariableCollection(a.name, a.initialModeName);
    }
    case "figma_create_variable": {
      const bridge = await getBridge();
      const a = args as { name: string; collectionId: string; resolvedType: string; valuesByMode?: Record<string, unknown>; description?: string };
      return bridge.createVariable(a.name, a.collectionId, a.resolvedType, a.valuesByMode, a.description);
    }
    case "figma_update_variable": {
      const bridge = await getBridge();
      const a = args as { variableId: string; modeId: string; value: unknown };
      return bridge.updateVariable(a.variableId, a.modeId, a.value);
    }
    case "figma_delete_variable": {
      const bridge = await getBridge();
      return bridge.deleteVariable((args as { variableId: string }).variableId);
    }
    case "figma_rename_variable": {
      const bridge = await getBridge();
      const a = args as { variableId: string; newName: string };
      return bridge.renameVariable(a.variableId, a.newName);
    }
    case "figma_delete_variable_collection": {
      const bridge = await getBridge();
      return bridge.deleteVariableCollection((args as { collectionId: string }).collectionId);
    }
    case "figma_add_mode": {
      const bridge = await getBridge();
      const a = args as { collectionId: string; modeName: string };
      return bridge.addMode(a.collectionId, a.modeName);
    }
    case "figma_rename_mode": {
      const bridge = await getBridge();
      const a = args as { collectionId: string; modeId: string; newName: string };
      return bridge.renameMode(a.collectionId, a.modeId, a.newName);
    }
    case "figma_batch_create_variables": {
      const bridge = await getBridge();
      const a = args as { variables: Array<{ name: string; collectionId: string; resolvedType: string; valuesByMode?: Record<string, unknown>; description?: string }> };
      return bridge.batchCreateVariables(a.variables);
    }
    case "figma_batch_update_variables": {
      const bridge = await getBridge();
      const a = args as { updates: Array<{ variableId: string; modeId: string; value: unknown }> };
      return bridge.batchUpdateVariables(a.updates);
    }
    case "figma_get_variables": {
      const bridge = await getBridge();
      const a = args as { collectionId?: string; verbosity?: string };
      return bridge.getVariables(a.collectionId, a.verbosity);
    }

    // ── Node Operations ──────────────────────────────────────────────────
    case "figma_clone_node": {
      const bridge = await getBridge();
      const a = args as { nodeId: string; x?: number; y?: number };
      return bridge.cloneNode(a.nodeId, a.x, a.y);
    }
    case "figma_delete_node": {
      const bridge = await getBridge();
      return bridge.deleteNode((args as { nodeId: string }).nodeId);
    }
    case "figma_move_node": {
      const bridge = await getBridge();
      const a = args as { nodeId: string; x?: number; y?: number; parentId?: string };
      return bridge.moveNode(a.nodeId, a.x, a.y, a.parentId);
    }
    case "figma_resize_node": {
      const bridge = await getBridge();
      const a = args as { nodeId: string; width: number; height: number };
      return bridge.resizeNode(a.nodeId, a.width, a.height);
    }
    case "figma_rename_node": {
      const bridge = await getBridge();
      const a = args as { nodeId: string; newName: string };
      return bridge.renameNode(a.nodeId, a.newName);
    }
    case "figma_set_fills": {
      const bridge = await getBridge();
      const a = args as { nodeId: string; fills: unknown[] };
      return bridge.setFills(a.nodeId, a.fills);
    }
    case "figma_set_strokes": {
      const bridge = await getBridge();
      const a = args as { nodeId: string; strokes: unknown[]; strokeWeight?: number };
      return bridge.setStrokes(a.nodeId, a.strokes, a.strokeWeight);
    }
    case "figma_set_text": {
      const bridge = await getBridge();
      const a = args as { nodeId: string; characters: string; fontSize?: number };
      return bridge.setText(a.nodeId, a.characters, a.fontSize);
    }

    // ── Component Operations ─────────────────────────────────────────────
    case "figma_search_components": {
      const bridge = await getBridge();
      const a = args as { query: string; limit?: number };
      return bridge.searchComponents(a.query, a.limit);
    }
    case "figma_instantiate_component": {
      const bridge = await getBridge();
      const a = args as { nodeId: string; variant?: Record<string, string>; x?: number; y?: number; parentId?: string };
      return bridge.instantiateComponent(a.nodeId, a.variant, a.x, a.y, a.parentId);
    }
    case "figma_set_description": {
      const bridge = await getBridge();
      const a = args as { nodeId: string; description: string };
      return bridge.setDescription(a.nodeId, a.description);
    }
    case "figma_get_styles": {
      const bridge = await getBridge();
      return bridge.getStyles();
    }
    case "figma_create_child": {
      const bridge = await getBridge();
      const a = args as { childType: string; parentId?: string; name?: string; width?: number; height?: number; x?: number; y?: number; characters?: string };
      return bridge.createChild(a.childType, a.parentId, a.name, a.width, a.height, a.x, a.y, a.characters);
    }
    case "figma_get_pages": {
      const bridge = await getBridge();
      return bridge.getAllPages();
    }
    case "figma_create_page": {
      const bridge = await getBridge();
      return bridge.createPage((args as { name: string }).name);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP Server setup
// ─────────────────────────────────────────────────────────────────────────────

export function createMcpServer() {
  const server = new Server(
    {
      name: "figma-intelligence-layer",
      version: "1.0.0",
    },
    {
      capabilities: { tools: {} },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await dispatch(name, (args ?? {}) as AnyArgs);
      const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [];

      // Support tools returning images for the AI client to analyze
      if (result && typeof result === "object" && !Array.isArray(result)) {
        const obj = result as Record<string, unknown>;
        if (Array.isArray(obj.__images)) {
          for (const img of obj.__images as Array<{ data: string; mimeType: string }>) {
            content.push({ type: "image", data: img.data, mimeType: img.mimeType });
          }
          delete obj.__images;
        }
      }

      content.push({
        type: "text",
        text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
      });

      return { content };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error in ${name}: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  await ensureRelayServer();
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `figma-intelligence-layer MCP server running (${TOOLS.length} tools across 5 phases)\n`
  );
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`Fatal: ${err.message}\n`);
    process.exit(1);
  });
}
