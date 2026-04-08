#!/usr/bin/env node
/**
 * figma-intelligence-layer — MCP Server
 * 28 tools across 5 phases for pixel-accurate, bidirectional, context-aware AI ↔ Design collaboration.
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
import { keyboardSrOrderHandler } from "./tools/phase1-vision/a11y-audit/keyboard-sr-order-handler.js";
import { a11yAnnotateHandler } from "./tools/phase1-vision/a11y-audit/a11y-annotate-handler.js";
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
import { prototypeScanHandler, prototypeWireHandler } from "./tools/phase3-generation/prototype-wire/index.js";
import { animatedBuildHandler } from "./tools/phase3-generation/figma-animated-build.js";
import { compositionBuilderHandler } from "./tools/phase3-generation/composition-builder/index.js";
import { swarmBuildHandler } from "./tools/phase3-generation/swarm-build/index.js";

// ─── Phase 4: Sync & Bidirectionality ───────────────────────────────────────
import { animationSpecifierHandler } from "./tools/phase4-sync/animation-specifier/index.js";
import { syncFromCodeHandler } from "./tools/phase4-sync/sync-from-code/index.js";
import { exportTokensHandler } from "./tools/phase4-sync/export-tokens/index.js";
import { generateComponentCodeHandler } from "./tools/phase4-sync/generate-component-code/index.js";
import { webhookListenerHandler } from "./tools/phase4-sync/webhook-listener/index.js";
import { handoffSpecHandler } from "./tools/phase4-sync/handoff-spec/index.js";
import { ciCheckHandler } from "./tools/phase4-sync/ci-check/index.js";
import { watchDocsHandler } from "./tools/phase4-sync/watch-docs/index.js";
import { iconLibrarySyncHandler } from "./tools/phase4-sync/icon-library-sync/index.js";

// ─── Phase 5: Memory, Governance & Health ───────────────────────────────────
import { dsScaffolderHandler } from "./tools/phase5-governance/ds-scaffolder/index.js";
import { dsVariablesHandler } from "./tools/phase5-governance/ds-variables/index.js";
import { decisionLogToolHandler } from "./tools/phase5-governance/decision-log/index.js";
import { designDecisionLogHandler } from "./tools/phase5-governance/design-decision-log/index.js";
import { healthReportHandler } from "./tools/phase5-governance/health-report/index.js";
import { componentSpecHandler } from "./tools/phase5-governance/component-spec/index.js";
import { componentSpecSheetHandler } from "./tools/phase5-governance/component-spec-sheet/index.js";
import { figmaApgDocHandler } from "./tools/phase5-governance/apg-doc/index.js";
import { dsPrimitivesHandler } from "./tools/phase5-governance/ds-primitives/index.js";
import { tokenNamingHandler } from "./tools/phase5-governance/token-naming/index.js";
import { tokenMigrateHandler } from "./tools/phase5-governance/token-migrate/index.js";
import { tokenAnalyticsHandler } from "./tools/phase5-governance/token-analytics/index.js";
import { tokenDocsHandler } from "./tools/phase5-governance/token-docs/index.js";
import { taxonomyDocsHandler } from "./tools/phase5-governance/taxonomy-docs/index.js";
import { validateDtcg } from "./shared/dtcg-validator.js";
// component-doc removed — replaced by component-spec

// ─── Bridge (for direct execute) ────────────────────────────────────────────
import { ensureRelayServer, getBridge, BridgeError } from "./shared/figma-bridge.js";

// ─── P0: Response compression ───────────────────────────────────────────────
import { compressResponse } from "./shared/response-compression.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tool registry — 29 tools
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
      "Comprehensive WCAG 2.2 accessibility audit producing a VPAT-style conformance report by default. Covers ALL success criteria at the requested level (A = ~30 SC, AA = ~50+ SC, AAA = ~78 SC). Each criterion gets a conformance status: Supports, Partially Supports, Does Not Support, Not Applicable, or Not Evaluated. Automated checks for contrast, target size, text spacing, non-text contrast, focus states, heading hierarchy, reading order, accessible names, and more. Manual-review criteria include actionable guidance. The result includes a formattedReport field with the full VPAT markdown table.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Figma node ID to audit" },
        wcagLevel: { type: "string", enum: ["A", "AA", "AAA"], description: "WCAG conformance level. Level A checks ~30 criteria, AA checks ~50+, AAA checks all ~78." },
        includeColorBlindSim: { type: "boolean", description: "Simulate 4 color blindness profiles (protanopia, deuteranopia, tritanopia, achromatopsia)" },
        outputFormat: { type: "string", enum: ["inline", "report", "both"], description: "inline = Figma sticky notes, report = JSON, both = both" },
        autoSuggestFixes: { type: "boolean", description: "Include fix suggestions in results" },
        reportFormat: { type: "string", enum: ["issues-only", "vpat"], description: "vpat (default) returns a full VPAT-style conformance report with every SC at the requested level. issues-only returns only failing checks." },
      },
      required: ["nodeId", "wcagLevel", "outputFormat"],
    },
  },
  {
    name: "figma_a11y_keyboard_screenreader_order",
    description:
      "Generate a TEXT-BASED DOCUMENTATION PAGE (NO visual markers) with enterprise-level keyboard and screen reader order specifications. Creates a NEW Figma page containing 10 written sections: Header, Scope, Assumptions, Keyboard Tab Order table, Screen Reader Reading Order list, Interaction Announcements, Focus Management rules, Implementation Notes (ARIA table, Keyboard Behaviour, Do/Don't), Warnings, and Audit Summary. This is a reference document for developers — it does NOT place any visual numbered markers, stamps, or circle badges on the design canvas. If you need visual numbered circle markers on the design with a Tab Order Sequence chart, use figma_a11y_annotate instead.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Figma node ID of the frame/page to analyze" },
        pageName: { type: "string", description: "Optional custom name for the generated annotation page" },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "figma_a11y_annotate",
    description:
      "Place VISUAL numbered circle markers on a Figma design and generate a Tab Order Sequence chart. This is the tool for 'focus order annotation with markers', 'annotate focus order', 'tab order with markers', or 'add accessibility markers to my design'. Creates a NEW Figma page with: (1) a clone of the design showing numbered purple circle badges at each interactive element, (2) a Tab Order Sequence table with columns #, Element, Role, ARIA/Notes, and (3) Implementation Notes with keyboard behavior details. Supports 7 annotation types: focus-order (keyboard tab sequence), reading-order (screen reader sequence), input (form fields), landmark (ARIA landmarks), heading (heading levels H1-H6), link, button. Unlike figma_a11y_keyboard_screenreader_order which creates a text-only reference document, this tool places visual numbered markers directly on a design clone.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Figma node ID of the frame to annotate" },
        annotationType: {
          type: "string",
          enum: ["focus-order", "reading-order", "input", "landmark", "heading", "link", "button", "all"],
          description: "Which annotation type to render. Use 'all' for complete accessibility annotation.",
        },
        showDetails: { type: "boolean", description: "Whether to render details cards beside each element (default: false)" },
        showLasso: { type: "boolean", description: "Whether to draw dotted borders around target elements (default: true)" },
        placement: { type: "string", enum: ["left", "right", "auto"], description: "Stamp placement side relative to elements (default: left)" },
      },
      required: ["nodeId", "annotationType"],
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
      "Analyze any frame and apply production-ready Auto Layout settings with design token binding in one command. Detects container type (card, form, nav, modal, list, grid, section, document page, header/section/footer/table blocks) and applies the optimal layout pattern. For document pages, automatically recurses into all nested containers, applies per-container specs, runs validation, and repairs FILL/HUG issues. Call this on every container frame created by figma_execute to ensure professional spacing and padding.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        applyChanges: { type: "boolean", description: "false = preview/report only" },
        spacingTokenSet: { type: "string" },
        responsiveHints: { type: "boolean" },
        reportDiff: { type: "boolean" },
        recursive: { type: "boolean", description: "Validate entire subtree for auto-layout parent-child sizing compatibility (FILL/HUG safety). Fixes invalid combinations automatically." },
      },
      required: ["nodeId", "applyChanges"],
    },
  },
  {
    name: "figma_variant_expander",
    description:
      "Turn one component state into a complete, production-ready variant matrix — all states, sizes, and themes automatically. ALWAYS use this instead of manually cloning variants with figma_execute. Workflow: create one base component frame with figma_execute, then call this tool with that nodeId and your desired dimensions.",
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
      "Generate complete, prototype-wired multi-screen flows from a plain-language product description using your real design system. Two weeks of wireframing in minutes. Shows a shimmer skeleton immediately when each frame is created, then populates with full content. Automatically scrolls the viewport to the first created screen when done. Always prefer this over piecemeal figma_execute calls for screen creation.",
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
        fonts: {
          type: "object",
          description: "Optional font config: { heading, body, mono, ui } each with { family, styles[] }",
        },
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
    name: "figma_prototype_scan",
    description:
      "Scan Figma frames to discover all interactive elements (buttons, links, nav items, icons) with confidence scoring. Returns an inventory of wireable elements per screen. Use BEFORE figma_prototype_wire to understand what can be connected. Supports auto-discovery of all top-level frames or targeting specific frame IDs. The AI should use the scan results plus the user's journey description to plan which elements to wire to which destinations.",
    inputSchema: {
      type: "object",
      properties: {
        frameIds: {
          type: "array",
          items: { type: "string" },
          description: "Specific frame IDs to scan. Omit to auto-discover all top-level frames on the current page.",
        },
        journeyDescription: {
          type: "string",
          description: "Optional user journey text — echoed back for AI context when planning wiring.",
        },
        maxDepth: {
          type: "number",
          description: "Max node tree recursion depth (default 5, max 8).",
        },
      },
    },
  },

  {
    name: "figma_prototype_wire",
    description:
      "Create prototype connections between interactive elements and destination frames. Supports all Figma trigger types (ON_CLICK, ON_DRAG, ON_HOVER, AFTER_DELAY, MOUSE_ENTER, MOUSE_LEAVE) and animation types (SMART_ANIMATE, DISSOLVE, SLIDE_IN, SLIDE_OUT, PUSH, MOVE_IN, MOVE_OUT, INSTANT) with configurable duration, easing, and direction. Best used after figma_prototype_scan. Supports dry-run mode and clearing existing reactions. If only journeyDescription is provided (no connections), returns a scan for the AI to plan wiring.",
    inputSchema: {
      type: "object",
      properties: {
        connections: {
          type: "array",
          description: "Explicit wiring instructions. Each entry wires one interactive element to a destination frame.",
          items: {
            type: "object",
            properties: {
              fromElementId: { type: "string", description: "Node ID of the interactive element (button, link, etc.)" },
              toFrameId: { type: "string", description: "Destination frame ID" },
              trigger: { type: "string", enum: ["ON_CLICK", "ON_DRAG", "ON_HOVER", "AFTER_DELAY", "MOUSE_ENTER", "MOUSE_LEAVE"] },
              animation: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["SMART_ANIMATE", "DISSOLVE", "SLIDE_IN", "SLIDE_OUT", "PUSH", "MOVE_IN", "MOVE_OUT", "INSTANT"] },
                  direction: { type: "string", enum: ["LEFT", "RIGHT", "TOP", "BOTTOM"] },
                  duration: { type: "number", description: "Duration in seconds (default 0.3)" },
                  easing: { type: "string", enum: ["EASE_IN", "EASE_OUT", "EASE_IN_AND_OUT", "LINEAR"] },
                },
              },
              navigation: { type: "string", enum: ["NAVIGATE", "OVERLAY", "SWAP", "SCROLL_TO", "BACK", "CLOSE"] },
            },
            required: ["fromElementId", "toFrameId"],
          },
        },
        journeyDescription: { type: "string", description: "User journey text. Without connections, triggers scan mode — returns interactive element inventory for AI to plan wiring." },
        frameIds: { type: "array", items: { type: "string" }, description: "Frames to scan/wire (omit for auto-discover)." },
        defaultTrigger: { type: "string", enum: ["ON_CLICK", "ON_DRAG", "ON_HOVER", "AFTER_DELAY"] },
        defaultAnimation: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["SMART_ANIMATE", "DISSOLVE", "SLIDE_IN", "SLIDE_OUT", "PUSH", "MOVE_IN", "MOVE_OUT", "INSTANT"] },
            direction: { type: "string", enum: ["LEFT", "RIGHT", "TOP", "BOTTOM"] },
            duration: { type: "number" },
            easing: { type: "string", enum: ["EASE_IN", "EASE_OUT", "EASE_IN_AND_OUT", "LINEAR"] },
          },
        },
        clearExisting: { type: "boolean", description: "Remove existing reactions before wiring (default false)." },
        dryRun: { type: "boolean", description: "Return plan without executing (default false)." },
      },
    },
  },

  {
    name: "figma_animated_build",
    description:
      "Progressively builds UI elements on Figma canvas with a single cursor that tracks each creation step, showing real operation labels (e.g. '3/12 Creating: Nav Bar'). Ships with a built-in iOS screen template. Pass steps to fully customize.",
    inputSchema: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          description: "Ordered build steps. Omit to use the default iOS screen template.",
          items: {
            type: "object",
            properties: {
              type:     { type: "string", enum: ["createFrame","createRect","createText","createEllipse","pause"] },
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
        cursorName: {
          type: "string",
          description: "Name shown on cursor badge (default 'MCP Power').",
        },
        cursorColor: {
          type: "string",
          description: "Hex color for cursor (default '#6E5FD8').",
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
    name: "figma_export_tokens",
    description:
      "Export Figma design variables/tokens to 16 code-ready formats: CSS, CSS (rem), SCSS, Less, Tailwind v3, Tailwind v4, Style Dictionary, W3C DTCG v2025.10 (full compliance with composite types, $deprecated, $type inheritance), JavaScript ES module, TypeScript module, Swift, Kotlin, Flutter/Dart, Android XML, React Native, or raw JSON. Supports mode filtering, collection filtering, alias chains, color spaces (sRGB, Display P3, Oklch), and multi-format export in a single call.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["css", "css-rem", "scss", "less", "tailwind", "tailwind-v4", "style-dictionary", "dtcg", "js", "ts", "swift", "kotlin", "flutter", "android-xml", "react-native", "json", "all"],
          description: "Output format. Use 'all' to generate every format at once.",
        },
        collectionFilter: { type: "string", description: "Filter by collection name (substring match)" },
        tokenTypes: {
          type: "array",
          items: { type: "string", enum: ["COLOR", "FLOAT", "STRING", "BOOLEAN"] },
          description: "Filter by variable type",
        },
        mode: { type: "string", description: "Export a single mode only (e.g. 'Light' or 'Dark'). Omit for all modes." },
        includeAliasChains: { type: "boolean", description: "Add comments showing semantic → primitive → raw value chains" },
        cssSelector: { type: "string", description: "CSS selector for custom properties (default ':root')" },
        tailwindPrefix: { type: "string", description: "Tailwind namespace prefix (default 'ds')" },
        remBase: { type: "number", description: "Base font size for rem conversion (default 16)" },
        colorSpace: { type: "string", enum: ["srgb", "display-p3", "oklch"], description: "Color space for DTCG output (default srgb)" },
        deprecated: { type: "boolean", description: "Include $deprecated field in DTCG output (default true)" },
      },
      required: ["format"],
    },
  },
  {
    name: "figma_generate_component_code",
    description:
      "Generate production-ready component code from a Figma component or component set. Extracts real variant axes, states, spacing, color tokens, and typography, then outputs a typed component file + CSS Module + Storybook stories. Supports React TSX, Vue SFC, Svelte, and HTML. Falls back to built-in blueprints (52 components) when no Figma connection is available.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Figma node ID of the component/component set. Uses current selection if omitted." },
        componentName: { type: "string", description: "Fallback: match a built-in blueprint by name (Button, Input, Modal, etc.)" },
        framework: {
          type: "string",
          enum: ["react", "vue", "svelte", "html"],
          description: "Target framework",
        },
        includeStories: { type: "boolean", description: "Generate Storybook stories file (default true)" },
        includeStyles: { type: "boolean", description: "Generate CSS Module file (default true)" },
        cssStrategy: {
          type: "string",
          enum: ["css-modules", "tailwind", "styled-components"],
          description: "CSS approach (default css-modules)",
        },
        typescript: { type: "boolean", description: "Use TypeScript (default true for React/Vue)" },
        tokenImportPath: { type: "string", description: "Import path for design tokens CSS (default '../../tokens.css')" },
      },
      required: ["framework"],
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
        fonts: {
          type: "object",
          description: "Optional font config: { heading: { family, styles[] }, body: { family, styles[] }, mono: { family, styles[] }, ui: { family, styles[] } }",
          properties: {
            heading: { type: "object", properties: { family: { type: "string" }, styles: { type: "array", items: { type: "string" } } } },
            body: { type: "object", properties: { family: { type: "string" }, styles: { type: "array", items: { type: "string" } } } },
            mono: { type: "object", properties: { family: { type: "string" }, styles: { type: "array", items: { type: "string" } } } },
            ui: { type: "object", properties: { family: { type: "string" }, styles: { type: "array", items: { type: "string" } } } },
          },
        },
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
        fonts: {
          type: "object",
          description: "Optional font config override. Default: Inter for body/ui, JetBrains Mono for mono.",
          properties: {
            heading: { type: "object", properties: { family: { type: "string" }, styles: { type: "array", items: { type: "string" } } } },
            body: { type: "object", properties: { family: { type: "string" }, styles: { type: "array", items: { type: "string" } } } },
            mono: { type: "object", properties: { family: { type: "string" }, styles: { type: "array", items: { type: "string" } } } },
            ui: { type: "object", properties: { family: { type: "string" }, styles: { type: "array", items: { type: "string" } } } },
          },
        },
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
    name: "figma_design_decision_log",
    description:
      "Create a visual Design Decision Log frame in Figma documenting UX decisions for a screen. Generates a styled frame with header (status + category badges, title, description), metadata row, and numbered decision cards — each with a title, source badge, and rationale. Sources should cite UX research (NN Group, Baymard Institute, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Frame title (e.g. 'E-Commerce Checkout Flow')" },
        description: { type: "string", description: "Overview of the screen/flow and what decisions cover" },
        status: {
          type: "string",
          enum: ["Approved", "Under review", "Requires revisions", "Blocked", "In progress", "Info"],
          description: "Status badge. Defaults to 'Approved'.",
        },
        category: { type: "string", description: "Category badge text (e.g. 'Design Research', 'Accessibility', 'Interaction Design'). Defaults to 'Design Research'." },
        pageName: { type: "string", description: "Page context (e.g. 'prototype example')" },
        screenCount: { type: "number", description: "Number of screens covered" },
        decisions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Decision title (e.g. 'Linear Checkout Flow')" },
              rationale: { type: "string", description: "Detailed UX rationale explaining the decision" },
              source: { type: "string", description: "Attribution (e.g. 'NN Group', 'Baymard Institute', 'UX Best Practice', 'Conversion Research')" },
            },
            required: ["title", "rationale", "source"],
          },
          description: "Array of design decisions with titles, rationale, and sources",
        },
        nearNodeId: { type: "string", description: "Place the frame near this node ID" },
      },
      required: ["name", "description", "decisions"],
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
    name: "figma_component_spec",
    description:
      "Generate full component documentation — a comprehensive multi-section reference covering overview, states, interaction rules, accessibility (WCAG), QA acceptance criteria, responsive behaviour, usage guidelines (do/don't), design tokens, typography hierarchy, content guidance, and related components. Best for when the user wants a complete written specification, developer handoff document, or full design-system documentation page. Outputs as a Figma page, markdown, JSON, or all three. Use this when the user asks for 'full docs', 'complete specification', 'documentation', 'developer handoff', 'design system page', or 'all sections'.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Component or ComponentSet node ID. If omitted, uses current Figma selection." },
        outputFormat: { type: "string", enum: ["json", "markdown", "figma-page", "all"] },
        sections: {
          type: "array",
          items: {
            type: "string",
            enum: ["overview", "anatomy", "variants", "states", "properties", "spacing", "color-tokens", "typography", "accessibility", "usage", "related"],
          },
          description: "Optional filter to generate only specific sections. Default: all applicable sections.",
        },
        pageName: { type: "string", description: "Custom page name for the generated Figma spec page." },
      },
      required: ["outputFormat"],
    },
  },
  {
    name: "figma_component_spec_sheet",
    description:
      "Generate a quick visual spec sheet directly on the Figma canvas — a single frame showing the component's anatomy, properties, and spacing at a glance. Includes: (1) Header with component name and variant string, (2) Anatomy diagram with numbered colored callout markers and a legend identifying each sub-element, (3) Properties section with live variant instance previews for every value of each property (Type, Size, State, boolean toggles) with style annotations, (4) Layout & Spacing section with colored dimension overlays. This is the DEFAULT tool when a user asks to 'show me the anatomy', 'what are the properties', 'show spacing', 'spec sheet', 'component breakdown', 'variant overview', or 'inspect this component'. Select a component before calling.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Component, ComponentSet, or Instance node ID. If omitted, uses current Figma selection." },
        sections: {
          type: "array",
          items: { type: "string", enum: ["header", "anatomy", "properties", "spacing"] },
          description: "Which sections to include. Default: all four.",
        },
        maxVariantsPerAxis: { type: "number", description: "Max variant instances to show per property axis (default: 6)." },
        placement: { type: "string", enum: ["right", "below", "new-page"], description: "Where to place the spec sheet relative to the source component. Default: right." },
      },
      required: [],
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
      "Execute Figma Plugin API code directly in the connected Figma file. The code runs inside the plugin sandbox with full access to the Figma Plugin API. Use `return` to return a value. All Figma API calls must use async methods (e.g. getNodeByIdAsync, findAllAsync). CRITICAL POSITIONING RULE: NEVER create root frames at (0,0) — this overlaps existing work. ALWAYS start your code with: `const _frames = figma.currentPage.children.filter(n => n.type === 'FRAME'); const _startX = _frames.length > 0 ? _frames.reduce((m,f) => Math.max(m, f.x+f.width), 0) + 200 : 0;` then set every new root frame's x = _startX. If the page has >10 frames, create a new page first: `const pg = figma.createPage(); pg.name = 'Design Name'; figma.currentPage = pg;`. Other rules: (1) Always apply Auto Layout on container frames with proper padding (16-24px) and itemSpacing (8-16px). After building, call figma_layout_intelligence for production-quality layout. (2) For multi-screen flows, prefer figma_page_architect which handles positioning and layout automatically.",
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

  // ── Token Intelligence (New) ──────────────────────────────────────────
  {
    name: "figma_token_analytics",
    description:
      "Comprehensive design token usage analytics: usage counts per token, orphan/unused token detection, category coverage analysis, and adoption rate (% of nodes using tokens vs hardcoded values). Answers: which tokens are used, which are orphans, what's the token adoption rate?",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["usage", "orphans", "coverage", "adoption", "full-report"],
          description: "Analysis type. 'full-report' runs all analyses.",
        },
        collectionFilter: { type: "string", description: "Filter by collection name" },
        pageFilter: { type: "string", description: "Filter to a specific page" },
        includeHidden: { type: "boolean", description: "Include hidden nodes in analysis (default false)" },
      },
      required: ["action"],
    },
  },
  {
    name: "figma_token_docs",
    description:
      "Generate living token documentation: visual token catalog with color swatches, spacing visualizers, typography specimens, shadow previews. Outputs as Figma page, Markdown, JSON, or self-contained HTML with search/filter and dark mode toggle.",
    inputSchema: {
      type: "object",
      properties: {
        outputFormat: {
          type: "string",
          enum: ["figma", "markdown", "json", "html"],
          description: "Documentation output format.",
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description: "Filter to specific categories (e.g. ['colors', 'spacing'])",
        },
        collectionFilter: { type: "string", description: "Filter by collection name" },
        includeVisualSwatches: { type: "boolean", description: "Render color swatches in Figma output (default true)" },
        includeUsageExamples: { type: "boolean", description: "Add CSS/code usage examples" },
        includeAliasChains: { type: "boolean", description: "Show alias resolution chains" },
        pageName: { type: "string", description: "Figma page name (default 'Token Documentation')" },
      },
      required: ["outputFormat"],
    },
  },
  {
    name: "figma_taxonomy_docs",
    description:
      "Generate living concept taxonomy documentation. Cross-references ~25 UI concepts (action, surface, field, feedback, etc.) with actual Figma variables to produce a naming grammar reference, per-concept token anatomy, and coverage report. Use 'naming-guide' format for a standalone reference document that teaches how to name tokens from scratch — grammar rules, allowed values per segment, worked examples, and common mistakes. Supports auto-sync: the Figma page updates automatically when tokens change.",
    inputSchema: {
      type: "object",
      properties: {
        outputFormat: {
          type: "string",
          enum: ["markdown", "json", "figma", "naming-guide"],
          description: "Documentation output format. 'naming-guide' produces a human-readable naming convention reference with grammar rules, allowed values, worked examples per concept, and common mistakes to avoid.",
        },
        concepts: {
          type: "array",
          items: { type: "string" },
          description: "Filter to specific concepts (e.g. ['action', 'surface', 'field']). Omit for all.",
        },
        includeTokenAnatomy: { type: "boolean", description: "Show per-concept token breakdowns (default true)" },
        showCoverage: { type: "boolean", description: "Highlight missing tokens with coverage badges (default true)" },
        autoSync: { type: "boolean", description: "Enable auto-sync: Figma page updates when variables change (figma format only, default false)" },
        pageName: { type: "string", description: "Figma page name (default 'Token Taxonomy')" },
      },
      required: ["outputFormat"],
    },
  },
  {
    name: "figma_validate_dtcg",
    description:
      "Validate design token JSON against the W3C DTCG v2025.10 specification. Checks: $type correctness, $value structure per type (composite types, color spaces, dimensions), alias resolution, circular reference detection, $deprecated usage, and $type inheritance. Returns validation issues and statistics.",
    inputSchema: {
      type: "object",
      properties: {
        tokens: {
          type: "object",
          description: "DTCG token JSON object to validate. Can also pass a string to be parsed.",
        },
        strict: { type: "boolean", description: "Strict mode: treat warnings as errors (default false)" },
      },
      required: ["tokens"],
    },
  },
  {
    name: "figma_token_math",
    description:
      "Token math and scale generation: evaluate expressions ({spacing.base} * 2), generate modular type scales (major-third, golden-ratio, etc.), create spacing scales, generate responsive clamp() tokens, convert px to rem. Powers computed/derived token relationships.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["evaluate", "modular-scale", "spacing-scale", "clamp", "px-to-rem"],
          description: "Operation to perform.",
        },
        expression: { type: "string", description: "Math expression with token refs: '{spacing.base} * 2'" },
        scaleOptions: {
          type: "object",
          properties: {
            base: { type: "number", description: "Base size (default 16)" },
            ratio: { type: "string", description: "Named ratio or number: 'major-third', 1.25" },
            steps: { type: "number", description: "Steps above base (default 6)" },
            stepsBelow: { type: "number", description: "Steps below base (default 2)" },
          },
        },
        spacingOptions: {
          type: "object",
          properties: {
            base: { type: "number", description: "Base unit (default 4)" },
            steps: { type: "array", items: { type: "number" }, description: "Multipliers (default [0, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16])" },
          },
        },
        clampOptions: {
          type: "object",
          properties: {
            minValue: { type: "number" },
            maxValue: { type: "number" },
            minViewport: { type: "number", description: "Default 320" },
            maxViewport: { type: "number", description: "Default 1440" },
            unit: { type: "string", enum: ["px", "rem"] },
          },
        },
        value: { type: "number", description: "Value for px-to-rem conversion" },
        remBase: { type: "number", description: "Base font size for rem (default 16)" },
      },
      required: ["action"],
    },
  },
  {
    name: "figma_color_operations",
    description:
      "Color manipulation for design tokens: lighten, darken, mix, alpha, hue shift, saturate, desaturate, complement, invert. Also generates tint/shade scales (50-950), checks WCAG contrast, and suggests accessible color alternatives. Supports sRGB, Display P3, and Oklch color spaces.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["lighten", "darken", "mix", "alpha", "hue-shift", "saturate", "desaturate", "complement", "invert", "contrast-check", "suggest-accessible", "generate-scale", "tints", "shades", "format"],
          description: "Color operation to perform.",
        },
        color: { type: "string", description: "Hex color (#RRGGBB or #RRGGBBAA)" },
        color2: { type: "string", description: "Second color for mix/contrast operations" },
        amount: { type: "number", description: "Operation amount (0-1 for lighten/darken/alpha, degrees for hue-shift)" },
        steps: { type: "number", description: "Number of steps for scale generation (default 11)" },
        targetRatio: { type: "number", description: "Target contrast ratio for suggest-accessible (default 4.5)" },
        colorSpace: { type: "string", enum: ["srgb", "display-p3", "oklch"], description: "Output color space for format action" },
      },
      required: ["action", "color"],
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
    name: "figma_get_node_deep",
    description:
      "Get a node with full recursive child data up to maxDepth (default 10). Unlike figma_get_node which returns 1-level children, this returns the full property set for every descendant including fills, strokes, layout, typography, and variable bindings. Use for deep component analysis.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "The Figma node ID" },
        maxDepth: { type: "number", description: "Max recursion depth (default 10, max 20)" },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "figma_batch_get_nodes",
    description:
      "Read up to 200 nodes in a single round-trip. Returns a map of nodeId → serialized node data. 10-50x faster than calling figma_get_node individually.",
    inputSchema: {
      type: "object",
      properties: {
        nodeIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of node IDs to read (max 200)",
        },
        includeChildren: { type: "boolean", description: "Include 1-level child summaries (default true)" },
      },
      required: ["nodeIds"],
    },
  },
  {
    name: "figma_switch_mode",
    description:
      "Switch a frame's variable mode (theme switching). All children with bound variables will resolve to the new mode's values (e.g. switch from Light to Dark). Use figma_list_modes to discover available modes first.",
    inputSchema: {
      type: "object",
      properties: {
        frameId: { type: "string", description: "Frame node ID to set the mode on" },
        collectionId: { type: "string", description: "Variable collection ID" },
        modeId: { type: "string", description: "Mode ID to activate" },
      },
      required: ["frameId", "collectionId", "modeId"],
    },
  },
  {
    name: "figma_list_modes",
    description:
      "List all modes (e.g. Light, Dark) for a variable collection. Returns mode IDs and names. Use before figma_switch_mode to discover which modes are available.",
    inputSchema: {
      type: "object",
      properties: {
        collectionId: { type: "string", description: "Variable collection ID" },
      },
      required: ["collectionId"],
    },
  },
  {
    name: "figma_bind_variables_multi_mode",
    description:
      "Bind semantic variables to node properties AND set the explicit variable mode on a container frame. Unlike basic variable binding, this ensures components actually switch between Light/Dark themes. Binds semantic alias variables (which have per-mode values) and activates a specific mode on the target frame.",
    inputSchema: {
      type: "object",
      properties: {
        bindings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string", description: "Target node ID" },
              field: { type: "string", description: "Property to bind: fills, strokes, paddingLeft, cornerRadius, etc." },
              variableId: { type: "string", description: "Semantic variable ID (must have mode values)" },
              fillIndex: { type: "number", description: "Paint array index for fills/strokes (default 0)" },
            },
            required: ["nodeId", "field", "variableId"],
          },
        },
        targetFrameId: { type: "string", description: "Container frame to set the explicit mode on" },
        collectionId: { type: "string", description: "Variable collection ID" },
        activeModeId: { type: "string", description: "Mode ID to activate (e.g. Dark mode ID)" },
      },
      required: ["bindings", "targetFrameId", "collectionId", "activeModeId"],
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

  // ── Tier 2: Competitive tools ─────────────────────────────────────────────
  {
    name: "figma_handoff_spec",
    description:
      "Generate a developer-ready handoff specification for any component or frame. Produces measurements (width, height, padding, gap), token names mapped to every property, copy-paste CSS/SCSS snippets, redline annotations, asset export lists, and responsive notes. Outputs JSON, Markdown, or an annotated Figma page with visual redlines.",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Figma node ID of the component/frame to spec" },
        outputFormat: { type: "string", enum: ["json", "markdown", "figma-page", "all"], description: "Output format" },
        includeCss: { type: "boolean", description: "Include copy-paste CSS snippets (default true)" },
        includeAssets: { type: "boolean", description: "Include asset export list (default true)" },
        cssUnit: { type: "string", enum: ["px", "rem"], description: "CSS unit preference (default px)" },
        remBase: { type: "number", description: "Base size for rem conversion (default 16)" },
        maxDepth: { type: "number", description: "Max depth for element scanning (default 6)" },
      },
      required: ["nodeId", "outputFormat"],
    },
  },
  {
    name: "figma_ci_check",
    description:
      "CI/CD integration for design system governance. Runs lint-rules + health-report and produces CI-friendly output: GitHub Actions annotations (::error, ::warning), SARIF for Code Scanning, PR comment markdown, and threshold gates. Can also generate a ready-to-use GitHub Action YAML workflow file.",
    inputSchema: {
      type: "object",
      properties: {
        checks: {
          type: "array",
          items: { type: "string", enum: ["lint", "health", "tokens", "all"] },
          description: "Which checks to run",
        },
        outputFormat: { type: "string", enum: ["github-actions", "sarif", "pr-comment", "json", "all"], description: "Output format" },
        healthThreshold: { type: "number", description: "Minimum health score to pass (0-100, default 70)" },
        maxLintErrors: { type: "number", description: "Maximum allowed errors (default 0)" },
        maxLintWarnings: { type: "number", description: "Maximum allowed warnings (default unlimited)" },
        nodeId: { type: "string", description: "Scope to specific node (default: current page)" },
        generateWorkflow: { type: "boolean", description: "Generate a GitHub Action YAML workflow file" },
      },
      required: ["checks", "outputFormat"],
    },
  },
  {
    name: "figma_watch_docs",
    description:
      "Auto-updating documentation system. Monitors components for changes, detects documentation drift, auto-regenerates specs when stale, and produces changelogs. Actions: 'check' (compare current vs snapshot, find stale docs), 'regenerate' (force-rebuild specs), 'changelog' (generate human-readable change log), 'freshness' (report doc freshness scores), 'register-webhook' (configure automated updates).",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["check", "regenerate", "changelog", "freshness", "register-webhook"], description: "Action to perform" },
        nodeIds: { type: "array", items: { type: "string" }, description: "Component node IDs to watch (omit for all on current page)" },
        snapshotDir: { type: "string", description: "Path to store spec snapshots for comparison" },
        autoRegenerate: { type: "boolean", description: "Auto-regenerate specs that are stale (for check action)" },
        specFormat: { type: "string", enum: ["json", "markdown", "figma-page", "all"], description: "Output format for regenerated specs" },
        fileKey: { type: "string", description: "Figma file key (for webhook registration)" },
      },
      required: ["action"],
    },
  },
  {
    name: "figma_icon_library_sync",
    description:
      "Bidirectional icon library synchronization between Figma and code. Export: Figma icon components → SVG files + React/Vue/Svelte icon components with typed catalog. Diff: Compare Figma icon set against existing icons and report added/removed/modified. Catalog: Generate a typed icon catalog with categories.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["export", "diff", "catalog"], description: "Sync action" },
        sourceNodeId: { type: "string", description: "Figma page/frame containing icons (default: auto-detect)" },
        namePrefix: { type: "string", description: "Icon name prefix filter (e.g. 'icon/' or 'Icon/')" },
        framework: { type: "string", enum: ["react", "vue", "svelte", "svg-only"], description: "Output framework (default react)" },
        generateCatalog: { type: "boolean", description: "Generate TypeScript icon catalog (default true)" },
        exportSize: { type: "number", description: "Export size in px (default 24)" },
        includeSizeVariants: { type: "boolean", description: "Include size variants (16, 20, 24, 32)" },
        existingIcons: { type: "array", items: { type: "string" }, description: "Existing icon names for diff comparison" },
      },
      required: ["action"],
    },
  },
  {
    name: "figma_composition_builder",
    description:
      "Build composed multi-component patterns from natural language or explicit component lists. Examples: 'login form' → Modal + Inputs + Button, 'search with filters' → Search + Select + Button, 'card with actions' → Card + Image + Buttons. Supports 12 pre-built recipes plus custom compositions. Outputs a properly laid-out Figma frame with Auto Layout and token bindings.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Natural language pattern description (e.g. 'login form', 'nav bar', 'settings panel')" },
        components: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Component name from blueprint catalog" },
              props: { type: "object", description: "Variant properties to apply" },
              count: { type: "number", description: "How many instances (default 1)" },
            },
            required: ["name"],
          },
          description: "Explicit component list (overrides pattern matching)",
        },
        frameWidth: { type: "number", description: "Container width in px (default 400)" },
        layoutDirection: { type: "string", enum: ["VERTICAL", "HORIZONTAL"], description: "Layout direction (auto-detected if omitted)" },
        spacing: { type: "number", description: "Gap between components in px (default 16)" },
        padding: { type: "number", description: "Container padding in px (default 24)" },
        includeBackground: { type: "boolean", description: "Add a white background fill" },
        targetPage: { type: "string", description: "Figma page name to place the composition" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "figma_swarm_build",
    description:
      "Multi-agent orchestrated page builder. Decomposes a high-level brief (e.g. 'SaaS landing page with hero, features, pricing, and footer') into spatial zones, assigns each to a named AI agent (Layouter, Styler, Copywriter, Matcher), runs all preparation in TRUE PARALLEL, then builds with multiple visible cursors and inter-agent chat notes. 3-5x faster than sequential tool-by-tool building. Each agent has a unique colored cursor that moves to its work area. Agent chat bubbles appear as sticky notes showing collaboration.",
    inputSchema: {
      type: "object",
      properties: {
        brief: {
          type: "string",
          description: "High-level page description (e.g. 'SaaS landing page with hero, features, pricing, testimonials, and footer')",
        },
        platform: {
          type: "string",
          enum: ["web", "mobile"],
          description: "Target platform (default: web). Sets frame width automatically.",
        },
        width: {
          type: "number",
          description: "Override frame width in px (default: 1440 for web, 390 for mobile)",
        },
        showAgentChat: {
          type: "boolean",
          description: "Show agent collaboration chat notes on canvas (default: true)",
        },
        fonts: {
          type: "object",
          description: "Optional font configuration override",
          properties: {
            heading: { type: "string" },
            body: { type: "string" },
            ui: { type: "string" },
          },
        },
      },
      required: ["brief"],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tool handler dispatch
// ─────────────────────────────────────────────────────────────────────────────

type AnyArgs = Record<string, unknown>;

async function dispatch(name: string, args: AnyArgs): Promise<unknown> {
  // Log every tool call for debugging
  const fs = await import("fs");
  fs.appendFileSync("/tmp/figma-tool-calls.log", `[${new Date().toISOString()}] TOOL CALLED: ${name} | args: ${JSON.stringify(args).slice(0, 500)}\n`);
  switch (name) {
    // Phase 1
    case "figma_screen_cloner":        return screenClonerHandler(args as never);
    case "figma_visual_audit":         return visualAuditHandler(args as never);
    case "figma_a11y_audit": {
      const a11yResult = await a11yAuditHandler(args as never);
      // In VPAT mode, return the formatted markdown report directly as a string
      // so the LLM presents the full VPAT table rather than summarising raw JSON.
      if (a11yResult.vpatReport) {
        return a11yResult.vpatReport.formattedReport;
      }
      return a11yResult;
    }
    case "figma_a11y_keyboard_screenreader_order": return keyboardSrOrderHandler(args as never);
    case "figma_a11y_annotate": return a11yAnnotateHandler(args as never);
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
    case "figma_prototype_scan":       return prototypeScanHandler(args as never);
    case "figma_prototype_wire":       return prototypeWireHandler(args as never);
    case "figma_animated_build":       return animatedBuildHandler(args as never);
    // Phase 4
    case "figma_animation_specifier":  return animationSpecifierHandler(args as never);
    case "figma_sync_from_code":       return syncFromCodeHandler(args as never);
    case "figma_export_tokens":        return exportTokensHandler(args as never);
    case "figma_generate_component_code": return generateComponentCodeHandler(args as never);
    case "figma_webhook_listener":     return webhookListenerHandler(args as never);
    case "figma_handoff_spec":         return handoffSpecHandler(args as never);
    case "figma_ci_check":             return ciCheckHandler(args as never);
    case "figma_watch_docs":           return watchDocsHandler(args as never);
    case "figma_icon_library_sync":    return iconLibrarySyncHandler(args as never);
    // Phase 3 (Tier 2)
    case "figma_composition_builder":  return compositionBuilderHandler(args as never);
    case "figma_swarm_build":          return swarmBuildHandler(args as never);
    // Phase 5
    case "figma_design_system_scaffolder": return dsScaffolderHandler(args as never);
    case "figma_design_system_primitives": return dsPrimitivesHandler(args as never);
    case "figma_design_system_variables": return dsVariablesHandler(args as never);
    case "figma_token_naming_convention": return tokenNamingHandler(args as never);
    case "figma_token_migrate":        return tokenMigrateHandler(args as never);
    case "figma_token_analytics":      return tokenAnalyticsHandler(args as never);
    case "figma_token_docs":           return tokenDocsHandler(args as never);
    case "figma_taxonomy_docs":        return taxonomyDocsHandler(args as never);
    case "figma_validate_dtcg": {
      const dtcgArgs = args as { tokens: Record<string, unknown>; strict?: boolean };
      const result = validateDtcg(dtcgArgs.tokens);
      if (dtcgArgs.strict) {
        result.valid = result.issues.every(i => i.severity !== "error" && i.severity !== "warning");
      }
      return result;
    }
    case "figma_token_math": {
      const { evaluateExpression, generateModularScale, generateSpacingScale, generateClamp, pxToRem, SCALE_RATIOS } = await import("./shared/token-math.js");
      const mathArgs = args as { action: string; expression?: string; scaleOptions?: Record<string, unknown>; spacingOptions?: Record<string, unknown>; clampOptions?: Record<string, unknown>; value?: number; remBase?: number };
      switch (mathArgs.action) {
        case "evaluate": {
          if (!mathArgs.expression) throw new Error("expression is required");
          const bridge = await getBridge();
          const rawVars = (await bridge.getVariables(undefined, "full")) as unknown as { collections: Array<{ variables: Array<{ name: string; resolvedType: string; valuesByMode: Record<string, unknown> }> }> };
          const tokenMap = new Map<string, number>();
          for (const coll of rawVars?.collections ?? []) {
            for (const v of coll.variables) {
              if (v.resolvedType === "FLOAT") {
                const val = Object.values(v.valuesByMode)[0];
                if (typeof val === "number") tokenMap.set(v.name.replace(/\//g, "."), val);
              }
            }
          }
          const resolver = (path: string) => tokenMap.get(path);
          return { expression: mathArgs.expression, result: evaluateExpression(mathArgs.expression, resolver) };
        }
        case "modular-scale": {
          const opts = mathArgs.scaleOptions ?? {};
          const ratioStr = String(opts.ratio ?? "major-third");
          const ratio = SCALE_RATIOS[ratioStr] ?? (parseFloat(ratioStr) || 1.25);
          return generateModularScale({ base: Number(opts.base) || 16, ratio, steps: Number(opts.steps) || 6, stepsBelow: Number(opts.stepsBelow) || 2 });
        }
        case "spacing-scale": {
          const opts = mathArgs.spacingOptions ?? {};
          return generateSpacingScale({ base: Number(opts.base) || 4, steps: (opts.steps as number[]) ?? [0, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16] });
        }
        case "clamp": {
          const opts = mathArgs.clampOptions ?? {} as Record<string, unknown>;
          return { clamp: generateClamp({ minValue: Number(opts.minValue) || 16, maxValue: Number(opts.maxValue) || 24, minViewport: Number(opts.minViewport) || 320, maxViewport: Number(opts.maxViewport) || 1440, unit: (opts.unit as "px" | "rem") ?? "rem" }) };
        }
        case "px-to-rem":
          return { px: mathArgs.value, rem: pxToRem(mathArgs.value ?? 16, mathArgs.remBase) };
        default:
          throw new Error(`Unknown token_math action: ${mathArgs.action}`);
      }
    }
    case "figma_color_operations": {
      const colorOps = await import("./shared/color-operations.js");
      const colorArgs = args as { action: string; color: string; color2?: string; amount?: number; steps?: number; targetRatio?: number; colorSpace?: "srgb" | "display-p3" | "oklch" };
      switch (colorArgs.action) {
        case "lighten":       return { result: colorOps.lighten(colorArgs.color, colorArgs.amount ?? 0.1) };
        case "darken":        return { result: colorOps.darken(colorArgs.color, colorArgs.amount ?? 0.1) };
        case "mix":           return { result: colorOps.mix(colorArgs.color, colorArgs.color2 ?? "#FFFFFF", colorArgs.amount ?? 0.5) };
        case "alpha":         return { result: colorOps.setAlpha(colorArgs.color, colorArgs.amount ?? 0.5) };
        case "hue-shift":     return { result: colorOps.adjustHue(colorArgs.color, colorArgs.amount ?? 30) };
        case "saturate":      return { result: colorOps.saturate(colorArgs.color, colorArgs.amount ?? 0.1) };
        case "desaturate":    return { result: colorOps.desaturate(colorArgs.color, colorArgs.amount ?? 0.1) };
        case "complement":    return { result: colorOps.complement(colorArgs.color) };
        case "invert":        return { result: colorOps.invert(colorArgs.color) };
        case "contrast-check": return { ratio: colorOps.contrastRatio(colorArgs.color, colorArgs.color2 ?? "#FFFFFF"), meetsAA: colorOps.meetsWcagAA(colorArgs.color, colorArgs.color2 ?? "#FFFFFF"), meetsAAA: colorOps.meetsWcagAAA(colorArgs.color, colorArgs.color2 ?? "#FFFFFF") };
        case "suggest-accessible": return { result: colorOps.suggestAccessibleColor(colorArgs.color, colorArgs.color2 ?? "#000000", colorArgs.targetRatio ?? 4.5) };
        case "generate-scale": return { scale: colorOps.generateTintShadeScale(colorArgs.color, colorArgs.steps ?? 11) };
        case "tints":         return { tints: colorOps.generateTints(colorArgs.color, colorArgs.steps ?? 10) };
        case "shades":        return { shades: colorOps.generateShades(colorArgs.color, colorArgs.steps ?? 10) };
        case "format":        return { formatted: colorOps.formatCssColor(colorArgs.color, colorArgs.colorSpace ?? "srgb") };
        default: throw new Error(`Unknown color_operations action: ${colorArgs.action}`);
      }
    }
    case "figma_decision_log":         return decisionLogToolHandler(args as never);
    case "figma_design_decision_log":  return designDecisionLogHandler(args as never);
    case "figma_health_report":        return healthReportHandler(args as never);
    case "figma_component_spec":       return componentSpecHandler(args as never);
    case "figma_component_spec_sheet": return componentSpecSheetHandler(args as never);
    case "figma_apg_doc":              return figmaApgDocHandler(args as never);
    // Direct execute
    case "figma_execute": {
      const code = (args as { code: string }).code;
      // Soft guardrail: warn if figma_execute is being used to create spec pages
      const codeLC = code.toLowerCase();
      if (codeLC.includes("createpage") && /spec|specification|component\s*doc/i.test(code)) {
        return {
          warning: "Use figma_component_spec or figma_component_spec_sheet instead of manually creating spec pages with figma_execute. The spec tools handle page creation, deduplication, and rendering automatically.",
          blocked: true,
        };
      }
      const bridge = await getBridge();
      const execResult = await bridge.execute(code);
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
      let dataUri: string;
      if (a.nodeId) {
        dataUri = await bridge.takeScreenshot(a.nodeId);
      } else {
        const status = await bridge.getStatus() as { currentPage?: { id: string } };
        if (!status.currentPage?.id) {
          throw new Error("No nodeId provided and could not determine current page");
        }
        dataUri = await bridge.takeScreenshot(status.currentPage.id);
      }
      // Return as MCP image content block (not raw text)
      const base64 = dataUri.replace(/^data:image\/png;base64,/, "");
      return {
        __images: [{ data: base64, mimeType: "image/png" }],
        message: `Screenshot captured${a.nodeId ? ` for node ${a.nodeId}` : " of current page"}.`,
      };
    }
    case "figma_get_node": {
      const bridge = await getBridge();
      // P0+P1: Return enriched node data with resolved styles via cache
      return bridge.getNodeEnriched((args as { nodeId: string }).nodeId);
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
    case "figma_get_node_deep": {
      const bridge = await getBridge();
      const a = args as { nodeId: string; maxDepth?: number };
      return bridge.getNodeDeep(a.nodeId, a.maxDepth);
    }
    case "figma_batch_get_nodes": {
      const bridge = await getBridge();
      const a = args as { nodeIds: string[]; includeChildren?: boolean };
      return bridge.batchGetNodes(a.nodeIds, a.includeChildren);
    }
    case "figma_switch_mode": {
      const bridge = await getBridge();
      const a = args as { frameId: string; collectionId: string; modeId: string };
      return bridge.switchMode(a.frameId, a.collectionId, a.modeId);
    }
    case "figma_list_modes": {
      const bridge = await getBridge();
      const a = args as { collectionId: string };
      return bridge.listModes(a.collectionId);
    }
    case "figma_bind_variables_multi_mode": {
      const bridge = await getBridge();
      const a = args as {
        bindings: Array<{ nodeId: string; field: string; variableId: string; fillIndex?: number }>;
        targetFrameId: string;
        collectionId: string;
        activeModeId: string;
      };
      return bridge.bindVariablesMultiMode(a.bindings, a.targetFrameId, a.collectionId, a.activeModeId);
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

      // P0: Adaptive response compression — prevent context window overflow
      if (typeof result === "string") {
        content.push({ type: "text", text: result });
      } else {
        const compressed = compressResponse(result);
        if (compressed.tier === "full") {
          content.push({ type: "text", text: JSON.stringify(result, null, 2) });
        } else {
          // Include compression metadata so the AI knows data was truncated
          const envelope = {
            _compressed: {
              tier: compressed.tier,
              originalSizeKB: Math.round(compressed.originalSizeBytes / 1024),
              compressedSizeKB: Math.round(compressed.compressedSizeBytes / 1024),
              note: `Response was compressed from ${Math.round(compressed.originalSizeBytes / 1024)}KB to ${Math.round(compressed.compressedSizeBytes / 1024)}KB (tier: ${compressed.tier}). Use more specific queries or nodeIds to get full data.`,
            },
            data: compressed.data,
          };
          content.push({ type: "text", text: JSON.stringify(envelope, null, 2) });
        }
      }

      return { content };
    } catch (error) {
      // BridgeError provides structured diagnostics with per-layer status
      if (error instanceof BridgeError) {
        const diagnostic = JSON.stringify({
          status: "error",
          code: error.code,
          error: error.message,
          fix: error.fix,
        }, null, 2);
        return {
          content: [{ type: "text", text: diagnostic }],
          isError: true,
        };
      }
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
  // Connect MCP transport FIRST so Claude Code gets the handshake immediately
  // (relay/bridge startup must not delay the MCP initialize response)
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `figma-intelligence-layer MCP server running (${TOOLS.length} tools across 5 phases)\n`
  );

  // THEN connect to the bridge relay (non-blocking, fire-and-forget)
  ensureRelayServer().catch((err) => {
    process.stderr.write(`Relay server warning: ${err.message}\n`);
  });

  // Connect the bridge eagerly so the relay immediately sees an MCP socket
  // and reports "Connected" instead of "Relay only" in the plugin UI.
  getBridge().catch(() => {});
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`Fatal: ${err.message}\n`);
    process.exit(1);
  });
}
