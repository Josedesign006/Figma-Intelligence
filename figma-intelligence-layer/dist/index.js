#!/usr/bin/env node
"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMcpServer = createMcpServer;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
// ─── Phase 1: Visual Intelligence ───────────────────────────────────────────
const index_js_2 = require("./tools/phase1-vision/screen-cloner/index.js");
const index_js_3 = require("./tools/phase1-vision/visual-audit/index.js");
const index_js_4 = require("./tools/phase1-vision/a11y-audit/index.js");
const keyboard_sr_order_handler_js_1 = require("./tools/phase1-vision/a11y-audit/keyboard-sr-order-handler.js");
const a11y_annotate_handler_js_1 = require("./tools/phase1-vision/a11y-audit/a11y-annotate-handler.js");
const index_js_5 = require("./tools/phase1-vision/sketch-to-design/index.js");
const index_js_6 = require("./tools/phase1-vision/design-from-ref/index.js");
// ─── Phase 2: Design System Accuracy ────────────────────────────────────────
const index_js_7 = require("./tools/phase2-accuracy/intent-translator/index.js");
const index_js_8 = require("./tools/phase2-accuracy/layout-intelligence/index.js");
const index_js_9 = require("./tools/phase2-accuracy/variant-expander/index.js");
const index_js_10 = require("./tools/phase2-accuracy/theme-generator/index.js");
const index_js_11 = require("./tools/phase2-accuracy/lint-rules/index.js");
const index_js_12 = require("./tools/phase2-accuracy/component-audit/index.js");
// ─── Phase 3: Generation & Scaffolding ──────────────────────────────────────
const index_js_13 = require("./tools/phase3-generation/component-archaeologist/index.js");
const index_js_14 = require("./tools/phase3-generation/page-architect/index.js");
const index_js_15 = require("./tools/phase3-generation/ai-image-insert/index.js");
const index_js_16 = require("./tools/phase3-generation/unsplash-search/index.js");
const index_js_17 = require("./tools/phase3-generation/url-to-frame/index.js");
const index_js_18 = require("./tools/phase3-generation/system-drift/index.js");
const index_js_19 = require("./tools/phase3-generation/prototype-map/index.js");
const index_js_20 = require("./tools/phase3-generation/prototype-wire/index.js");
const figma_animated_build_js_1 = require("./tools/phase3-generation/figma-animated-build.js");
const index_js_21 = require("./tools/phase3-generation/composition-builder/index.js");
// ─── Phase 4: Sync & Bidirectionality ───────────────────────────────────────
const index_js_22 = require("./tools/phase4-sync/animation-specifier/index.js");
const index_js_23 = require("./tools/phase4-sync/sync-from-code/index.js");
const index_js_24 = require("./tools/phase4-sync/export-tokens/index.js");
const index_js_25 = require("./tools/phase4-sync/generate-component-code/index.js");
const index_js_26 = require("./tools/phase4-sync/webhook-listener/index.js");
const index_js_27 = require("./tools/phase4-sync/handoff-spec/index.js");
const index_js_28 = require("./tools/phase4-sync/ci-check/index.js");
const index_js_29 = require("./tools/phase4-sync/watch-docs/index.js");
const index_js_30 = require("./tools/phase4-sync/icon-library-sync/index.js");
// ─── Phase 5: Memory, Governance & Health ───────────────────────────────────
const index_js_31 = require("./tools/phase5-governance/ds-scaffolder/index.js");
const index_js_32 = require("./tools/phase5-governance/ds-variables/index.js");
const index_js_33 = require("./tools/phase5-governance/decision-log/index.js");
const index_js_34 = require("./tools/phase5-governance/design-decision-log/index.js");
const index_js_35 = require("./tools/phase5-governance/health-report/index.js");
const index_js_36 = require("./tools/phase5-governance/component-spec/index.js");
const index_js_37 = require("./tools/phase5-governance/apg-doc/index.js");
const index_js_38 = require("./tools/phase5-governance/ds-primitives/index.js");
const index_js_39 = require("./tools/phase5-governance/token-naming/index.js");
const index_js_40 = require("./tools/phase5-governance/token-migrate/index.js");
// component-doc removed — replaced by component-spec
// ─── Bridge (for direct execute) ────────────────────────────────────────────
const figma_bridge_js_1 = require("./shared/figma-bridge.js");
// ─── P0: Response compression ───────────────────────────────────────────────
const response_compression_js_1 = require("./shared/response-compression.js");
// ─────────────────────────────────────────────────────────────────────────────
// Tool registry — 29 tools
// ─────────────────────────────────────────────────────────────────────────────
const TOOLS = [
    // ── Phase 1 ──────────────────────────────────────────────────────────────
    {
        name: "figma_screen_cloner",
        description: "Takes any screenshot or image and reconstructs it as a Figma frame using your real design system — components, tokens, Auto Layout. Three modes: pixel (exact replica), system (DS-enforced), adaptive (system clone + improvement suggestions).",
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
        description: "Vision-based UX quality audit. Takes a screenshot or Figma node, returns severity-ranked issues (hierarchy, contrast, density, brand alignment, consistency) as Figma annotations and/or a structured report.",
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
        description: "Comprehensive WCAG 2.2 accessibility audit producing a VPAT-style conformance report by default. Covers ALL success criteria at the requested level (A = ~30 SC, AA = ~50+ SC, AAA = ~78 SC). Each criterion gets a conformance status: Supports, Partially Supports, Does Not Support, Not Applicable, or Not Evaluated. Automated checks for contrast, target size, text spacing, non-text contrast, focus states, heading hierarchy, reading order, accessible names, and more. Manual-review criteria include actionable guidance. The result includes a formattedReport field with the full VPAT markdown table.",
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
        description: "Generate a TEXT-BASED DOCUMENTATION PAGE (NO visual markers) with enterprise-level keyboard and screen reader order specifications. Creates a NEW Figma page containing 10 written sections: Header, Scope, Assumptions, Keyboard Tab Order table, Screen Reader Reading Order list, Interaction Announcements, Focus Management rules, Implementation Notes (ARIA table, Keyboard Behaviour, Do/Don't), Warnings, and Audit Summary. This is a reference document for developers — it does NOT place any visual numbered markers, stamps, or circle badges on the design canvas. If you need visual numbered circle markers on the design with a Tab Order Sequence chart, use figma_a11y_annotate instead.",
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
        description: "Place VISUAL numbered circle markers on a Figma design and generate a Tab Order Sequence chart. This is the tool for 'focus order annotation with markers', 'annotate focus order', 'tab order with markers', or 'add accessibility markers to my design'. Creates a NEW Figma page with: (1) a clone of the design showing numbered purple circle badges at each interactive element, (2) a Tab Order Sequence table with columns #, Element, Role, ARIA/Notes, and (3) Implementation Notes with keyboard behavior details. Supports 7 annotation types: focus-order (keyboard tab sequence), reading-order (screen reader sequence), input (form fields), landmark (ARIA landmarks), heading (heading levels H1-H6), link, button. Unlike figma_a11y_keyboard_screenreader_order which creates a text-only reference document, this tool places visual numbered markers directly on a design clone.",
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
        description: "Upload a hand-drawn wireframe, whiteboard photo, or lo-fi sketch and receive a production-quality Figma frame using your design system components.",
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
        description: "Provide reference images (competitor screenshots, mood boards) plus a prompt. Receive a new design built with YOUR design system — a re-interpretation, not a clone.",
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
        description: "Translates vague natural language prompts into precise, design-system-aware creation instructions. Eliminates hallucinated components and hardcoded values before any figma_execute call.",
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
        description: "Analyze any frame and apply production-ready Auto Layout settings with design token binding in one command. Detects container type (card, form, nav, modal, list, grid, section, document page, header/section/footer/table blocks) and applies the optimal layout pattern. For document pages, automatically recurses into all nested containers, applies per-container specs, runs validation, and repairs FILL/HUG issues. Call this on every container frame created by figma_execute to ensure professional spacing and padding.",
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
        description: "Turn one component state into a complete, production-ready variant matrix — all states, sizes, and themes automatically. ALWAYS use this instead of manually cloning variants with figma_execute. Workflow: create one base component frame with figma_execute, then call this tool with that nodeId and your desired dimensions.",
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
        description: "Generate new color modes — dark mode, high contrast, brand variants — from an existing theme while preserving semantic intent and WCAG compliance.",
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
        description: "Define and enforce custom design system rules across an entire Figma file. Design-system ESLint — built-in rules for hardcoded colors, spacing grid violations, touch targets, and more.",
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
        description: "Complete component usage analytics — which components are used, how often, orphaned components, detached instances, override hotspots, and duplicate patterns.",
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
        description: "Reverse-engineer undocumented, legacy, or raw Figma frames into proper design system components. Fingerprints layer structure, maps hardcoded values to tokens, and creates library components.",
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
        description: "Generate complete, prototype-wired multi-screen flows from a plain-language product description using your real design system. Two weeks of wireframing in minutes. Shows a shimmer skeleton immediately when each frame is created, then populates with full content. Automatically scrolls the viewport to the first created screen when done. Always prefer this over piecemeal figma_execute calls for screen creation.",
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
        description: "Generate an AI image with Gemini and insert it into Figma. If targetNodeId is provided, fill that node when possible; otherwise create a new image-backed rectangle on the current page.",
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
        description: "Search Unsplash for production-ready photography to use in generated Figma screens. Best for ecommerce, travel, food, wellness, lifestyle, and other image-forward interfaces.",
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
        description: "Capture any live URL and convert it into responsive Figma frames at mobile, tablet, and desktop breakpoints — built with your design system.",
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
        description: "Compare design token snapshots across multiple Figma files and surface where teams are diverging from the canonical design system. Drift score: 0-5% healthy, 5-15% warning, 15%+ critical.",
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
        description: "Extract all Figma prototype connections and return a navigable state machine — every screen, transition, trigger, and animation spec as JSON and/or a Mermaid diagram.",
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
        description: "Scan Figma frames to discover all interactive elements (buttons, links, nav items, icons) with confidence scoring. Returns an inventory of wireable elements per screen. Use BEFORE figma_prototype_wire to understand what can be connected. Supports auto-discovery of all top-level frames or targeting specific frame IDs. The AI should use the scan results plus the user's journey description to plan which elements to wire to which destinations.",
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
        description: "Create prototype connections between interactive elements and destination frames. Supports all Figma trigger types (ON_CLICK, ON_DRAG, ON_HOVER, AFTER_DELAY, MOUSE_ENTER, MOUSE_LEAVE) and animation types (SMART_ANIMATE, DISSOLVE, SLIDE_IN, SLIDE_OUT, PUSH, MOVE_IN, MOVE_OUT, INSTANT) with configurable duration, easing, and direction. Best used after figma_prototype_scan. Supports dry-run mode and clearing existing reactions. If only journeyDescription is provided (no connections), returns a scan for the AI to plan wiring.",
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
        description: "Simulates multi-agent collaborative design: two colored cursor overlays (Claude + Codex) move around the Figma canvas, show chat bubbles, and progressively build UI elements one-by-one — pencil.dev-style. Ships with a built-in iOS screen template. Pass agents/steps to fully customize.",
        inputSchema: {
            type: "object",
            properties: {
                agents: {
                    type: "array",
                    description: "Agent definitions (id, name, hex color). Defaults to Claude (#7C3AED) + Codex (#0EA5E9).",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string", description: "Unique agent identifier" },
                            name: { type: "string", description: "Display name shown in badge" },
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
                            type: { type: "string", enum: ["moveCursor", "showChat", "hideChat", "createFrame", "createRect", "createText", "createEllipse", "pause"] },
                            agentId: { type: "string" },
                            x: { type: "number" },
                            y: { type: "number" },
                            text: { type: "string" },
                            name: { type: "string" },
                            w: { type: "number" },
                            h: { type: "number" },
                            color: { type: "string" },
                            radius: { type: "number" },
                            size: { type: "number" },
                            parentId: { type: "string" },
                            ms: { type: "number" },
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
        description: "Read Figma prototype transitions and output developer-ready animation code for Framer Motion, CSS, Swift, Android, or all frameworks at once.",
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
        description: "Reconcile Storybook component APIs against Figma component properties. Surface mismatches (missing props, value differences) and optionally sync Figma to match code.",
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
        description: "Export Figma design variables/tokens to code-ready formats: CSS custom properties, SCSS, Tailwind config, Style Dictionary JSON, W3C DTCG JSON, Swift, Kotlin, or raw JSON. Reads live variables from the connected Figma file. Supports mode filtering (Light/Dark), collection filtering, alias chain comments, and multi-format export in a single call. Falls back to the built-in semantic token catalog when offline.",
        inputSchema: {
            type: "object",
            properties: {
                format: {
                    type: "string",
                    enum: ["css", "scss", "tailwind", "style-dictionary", "dtcg", "swift", "kotlin", "json", "all"],
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
            },
            required: ["format"],
        },
    },
    {
        name: "figma_generate_component_code",
        description: "Generate production-ready component code from a Figma component or component set. Extracts real variant axes, states, spacing, color tokens, and typography, then outputs a typed component file + CSS Module + Storybook stories. Supports React TSX, Vue SFC, Svelte, and HTML. Falls back to built-in blueprints (52 components) when no Figma connection is available.",
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
        description: "Subscribe to Figma file change events and trigger automated reactions: run lint on token changes, audit on component changes, health report on library publish, Slack/GitHub notifications.",
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
        description: "Bootstrap a complete, production-ready design system from just brand colors and product type. Generates full token system, component library, and page templates. Two weeks of work in three minutes.",
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
        description: "Diagnose Figma variable capability and create first-class design-system primitive variable collections for color, typography, spacing, radius, border, opacity, and elevation.",
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
        description: "Diagnose, scaffold, and manage design-system variable collections for primitives, semantics, and component tokens, including alias-based variable wiring.",
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
        description: "Define, validate, and audit design-token naming conventions so primitive, semantic, and component token names stay accurate and consistent.",
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
        description: "Persistent memory layer. Log every AI design action with rationale. Query past decisions ('why was --color-primary changed?'). Export complete history. No context is ever lost between sessions.",
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
        description: "Create a visual Design Decision Log frame in Figma documenting UX decisions for a screen. Generates a styled frame with header (status + category badges, title, description), metadata row, and numbered decision cards — each with a title, source badge, and rationale. Sources should cite UX research (NN Group, Baymard Institute, etc.).",
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
        description: "Capstone governance tool. Runs all audits in sequence and returns a composite design system health score (0-100) across 6 dimensions: token coverage, accessibility, component adoption, documentation, lint, drift.",
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
        description: "Generate comprehensive, production-quality component specification documentation. Extracts real data from the Figma component (anatomy, properties, variants, states, spacing, color tokens, typography) and structures it into spec sections. Outputs as a visual Figma page, markdown, JSON, or all three. Content is always extracted from the actual component — never fabricated.",
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
        name: "figma_apg_doc",
        description: "Generate APG-backed accessibility documentation for a selected Figma component. Maps the node to a WAI-ARIA Authoring Practices pattern, then returns native-first guidance, naming rules, roles/states, keyboard/focus specs, QA checks, and optional implementation starters.",
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
        description: "Execute Figma Plugin API code directly in the connected Figma file. The code runs inside the plugin sandbox with full access to the Figma Plugin API. Use `return` to return a value. All Figma API calls must use async methods (e.g. getNodeByIdAsync, findAllAsync). CRITICAL POSITIONING RULE: NEVER create root frames at (0,0) — this overlaps existing work. ALWAYS start your code with: `const _frames = figma.currentPage.children.filter(n => n.type === 'FRAME'); const _startX = _frames.length > 0 ? _frames.reduce((m,f) => Math.max(m, f.x+f.width), 0) + 200 : 0;` then set every new root frame's x = _startX. If the page has >10 frames, create a new page first: `const pg = figma.createPage(); pg.name = 'Design Name'; figma.currentPage = pg;`. Other rules: (1) Always apply Auto Layout on container frames with proper padding (16-24px) and itemSpacing (8-16px). After building, call figma_layout_intelligence for production-quality layout. (2) For multi-screen flows, prefer figma_page_architect which handles positioning and layout automatically.",
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
        description: "Scan variables and local styles, detect naming/schema drift, propose canonical names, and optionally rename in place with variable alias compatibility.",
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
        name: "figma_get_node_deep",
        description: "Get a node with full recursive child data up to maxDepth (default 10). Unlike figma_get_node which returns 1-level children, this returns the full property set for every descendant including fills, strokes, layout, typography, and variable bindings. Use for deep component analysis.",
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
        description: "Read up to 200 nodes in a single round-trip. Returns a map of nodeId → serialized node data. 10-50x faster than calling figma_get_node individually.",
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
        description: "Switch a frame's variable mode (theme switching). All children with bound variables will resolve to the new mode's values (e.g. switch from Light to Dark). Use figma_list_modes to discover available modes first.",
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
        description: "List all modes (e.g. Light, Dark) for a variable collection. Returns mode IDs and names. Use before figma_switch_mode to discover which modes are available.",
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
        description: "Bind semantic variables to node properties AND set the explicit variable mode on a container frame. Unlike basic variable binding, this ensures components actually switch between Light/Dark themes. Binds semantic alias variables (which have per-mode values) and activates a specific mode on the target frame.",
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
        description: "Generate a developer-ready handoff specification for any component or frame. Produces measurements (width, height, padding, gap), token names mapped to every property, copy-paste CSS/SCSS snippets, redline annotations, asset export lists, and responsive notes. Outputs JSON, Markdown, or an annotated Figma page with visual redlines.",
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
        description: "CI/CD integration for design system governance. Runs lint-rules + health-report and produces CI-friendly output: GitHub Actions annotations (::error, ::warning), SARIF for Code Scanning, PR comment markdown, and threshold gates. Can also generate a ready-to-use GitHub Action YAML workflow file.",
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
        description: "Auto-updating documentation system. Monitors components for changes, detects documentation drift, auto-regenerates specs when stale, and produces changelogs. Actions: 'check' (compare current vs snapshot, find stale docs), 'regenerate' (force-rebuild specs), 'changelog' (generate human-readable change log), 'freshness' (report doc freshness scores), 'register-webhook' (configure automated updates).",
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
        description: "Bidirectional icon library synchronization between Figma and code. Export: Figma icon components → SVG files + React/Vue/Svelte icon components with typed catalog. Diff: Compare Figma icon set against existing icons and report added/removed/modified. Catalog: Generate a typed icon catalog with categories.",
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
        description: "Build composed multi-component patterns from natural language or explicit component lists. Examples: 'login form' → Modal + Inputs + Button, 'search with filters' → Search + Select + Button, 'card with actions' → Card + Image + Buttons. Supports 12 pre-built recipes plus custom compositions. Outputs a properly laid-out Figma frame with Auto Layout and token bindings.",
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
];
async function dispatch(name, args) {
    // Log every tool call for debugging
    const fs = await Promise.resolve().then(() => __importStar(require("fs")));
    fs.appendFileSync("/tmp/figma-tool-calls.log", `[${new Date().toISOString()}] TOOL CALLED: ${name} | args: ${JSON.stringify(args).slice(0, 500)}\n`);
    switch (name) {
        // Phase 1
        case "figma_screen_cloner": return (0, index_js_2.screenClonerHandler)(args);
        case "figma_visual_audit": return (0, index_js_3.visualAuditHandler)(args);
        case "figma_a11y_audit": {
            const a11yResult = await (0, index_js_4.a11yAuditHandler)(args);
            // In VPAT mode, return the formatted markdown report directly as a string
            // so the LLM presents the full VPAT table rather than summarising raw JSON.
            if (a11yResult.vpatReport) {
                return a11yResult.vpatReport.formattedReport;
            }
            return a11yResult;
        }
        case "figma_a11y_keyboard_screenreader_order": return (0, keyboard_sr_order_handler_js_1.keyboardSrOrderHandler)(args);
        case "figma_a11y_annotate": return (0, a11y_annotate_handler_js_1.a11yAnnotateHandler)(args);
        case "figma_sketch_to_design": return (0, index_js_5.sketchToDesignHandler)(args);
        case "figma_design_from_ref": return (0, index_js_6.designFromRefHandler)(args);
        // Phase 2
        case "figma_intent_translator": return (0, index_js_7.intentTranslatorHandler)(args);
        case "figma_layout_intelligence": return (0, index_js_8.layoutIntelligenceHandler)(args);
        case "figma_variant_expander": return (0, index_js_9.variantExpanderHandler)(args);
        case "figma_theme_generator": return (0, index_js_10.themeGeneratorHandler)(args);
        case "figma_lint_rules": return (0, index_js_11.lintRulesHandler)(args);
        case "figma_component_audit": return (0, index_js_12.componentAuditHandler)(args);
        // Phase 3
        case "figma_component_archaeologist": return (0, index_js_13.componentArchaeologistHandler)(args);
        case "figma_page_architect": return (0, index_js_14.pageArchitectHandler)(args);
        case "figma_generate_image_and_insert": return (0, index_js_15.generateImageAndInsertHandler)(args);
        case "figma_unsplash_search": return (0, index_js_16.figmaUnsplashSearchHandler)(args);
        case "figma_url_to_frame": return (0, index_js_17.urlToFrameHandler)(args);
        case "figma_system_drift": return (0, index_js_18.systemDriftHandler)(args);
        case "figma_prototype_map": return (0, index_js_19.prototypeMapHandler)(args);
        case "figma_prototype_scan": return (0, index_js_20.prototypeScanHandler)(args);
        case "figma_prototype_wire": return (0, index_js_20.prototypeWireHandler)(args);
        case "figma_animated_build": return (0, figma_animated_build_js_1.animatedBuildHandler)(args);
        // Phase 4
        case "figma_animation_specifier": return (0, index_js_22.animationSpecifierHandler)(args);
        case "figma_sync_from_code": return (0, index_js_23.syncFromCodeHandler)(args);
        case "figma_export_tokens": return (0, index_js_24.exportTokensHandler)(args);
        case "figma_generate_component_code": return (0, index_js_25.generateComponentCodeHandler)(args);
        case "figma_webhook_listener": return (0, index_js_26.webhookListenerHandler)(args);
        case "figma_handoff_spec": return (0, index_js_27.handoffSpecHandler)(args);
        case "figma_ci_check": return (0, index_js_28.ciCheckHandler)(args);
        case "figma_watch_docs": return (0, index_js_29.watchDocsHandler)(args);
        case "figma_icon_library_sync": return (0, index_js_30.iconLibrarySyncHandler)(args);
        // Phase 3 (Tier 2)
        case "figma_composition_builder": return (0, index_js_21.compositionBuilderHandler)(args);
        // Phase 5
        case "figma_design_system_scaffolder": return (0, index_js_31.dsScaffolderHandler)(args);
        case "figma_design_system_primitives": return (0, index_js_38.dsPrimitivesHandler)(args);
        case "figma_design_system_variables": return (0, index_js_32.dsVariablesHandler)(args);
        case "figma_token_naming_convention": return (0, index_js_39.tokenNamingHandler)(args);
        case "figma_token_migrate": return (0, index_js_40.tokenMigrateHandler)(args);
        case "figma_decision_log": return (0, index_js_33.decisionLogToolHandler)(args);
        case "figma_design_decision_log": return (0, index_js_34.designDecisionLogHandler)(args);
        case "figma_health_report": return (0, index_js_35.healthReportHandler)(args);
        case "figma_component_spec": return (0, index_js_36.componentSpecHandler)(args);
        case "figma_apg_doc": return (0, index_js_37.figmaApgDocHandler)(args);
        // Direct execute
        case "figma_execute": {
            const code = args.code;
            // Soft guardrail: warn if figma_execute is being used to create spec pages
            const codeLC = code.toLowerCase();
            if (codeLC.includes("createpage") && /spec|specification|component\s*doc/i.test(code)) {
                return {
                    warning: "Use figma_component_spec instead of manually creating spec pages with figma_execute. The spec tool handles page creation, deduplication, and rendering automatically.",
                    blocked: true,
                };
            }
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const execResult = await bridge.execute(code);
            if (!execResult.success)
                throw new Error(execResult.error);
            return execResult.result;
        }
        // ── Navigation & Status ──────────────────────────────────────────────
        case "figma_get_status": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            return bridge.getStatus();
        }
        case "figma_navigate": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            return bridge.navigate(args.nodeId);
        }
        case "figma_get_selection": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            return bridge.getSelection();
        }
        case "figma_take_screenshot": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            let dataUri;
            if (a.nodeId) {
                dataUri = await bridge.takeScreenshot(a.nodeId);
            }
            else {
                const status = await bridge.getStatus();
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
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            // P0+P1: Return enriched node data with resolved styles via cache
            return bridge.getNodeEnriched(args.nodeId);
        }
        // ── Variable Management ──────────────────────────────────────────────
        case "figma_create_variable_collection": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.createVariableCollection(a.name, a.initialModeName);
        }
        case "figma_create_variable": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.createVariable(a.name, a.collectionId, a.resolvedType, a.valuesByMode, a.description);
        }
        case "figma_update_variable": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.updateVariable(a.variableId, a.modeId, a.value);
        }
        case "figma_delete_variable": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            return bridge.deleteVariable(args.variableId);
        }
        case "figma_rename_variable": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.renameVariable(a.variableId, a.newName);
        }
        case "figma_delete_variable_collection": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            return bridge.deleteVariableCollection(args.collectionId);
        }
        case "figma_add_mode": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.addMode(a.collectionId, a.modeName);
        }
        case "figma_rename_mode": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.renameMode(a.collectionId, a.modeId, a.newName);
        }
        case "figma_batch_create_variables": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.batchCreateVariables(a.variables);
        }
        case "figma_batch_update_variables": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.batchUpdateVariables(a.updates);
        }
        case "figma_get_variables": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.getVariables(a.collectionId, a.verbosity);
        }
        // ── Node Operations ──────────────────────────────────────────────────
        case "figma_clone_node": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.cloneNode(a.nodeId, a.x, a.y);
        }
        case "figma_delete_node": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            return bridge.deleteNode(args.nodeId);
        }
        case "figma_move_node": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.moveNode(a.nodeId, a.x, a.y, a.parentId);
        }
        case "figma_resize_node": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.resizeNode(a.nodeId, a.width, a.height);
        }
        case "figma_rename_node": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.renameNode(a.nodeId, a.newName);
        }
        case "figma_set_fills": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.setFills(a.nodeId, a.fills);
        }
        case "figma_set_strokes": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.setStrokes(a.nodeId, a.strokes, a.strokeWeight);
        }
        case "figma_set_text": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.setText(a.nodeId, a.characters, a.fontSize);
        }
        // ── Component Operations ─────────────────────────────────────────────
        case "figma_search_components": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.searchComponents(a.query, a.limit);
        }
        case "figma_instantiate_component": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.instantiateComponent(a.nodeId, a.variant, a.x, a.y, a.parentId);
        }
        case "figma_set_description": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.setDescription(a.nodeId, a.description);
        }
        case "figma_get_styles": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            return bridge.getStyles();
        }
        case "figma_create_child": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.createChild(a.childType, a.parentId, a.name, a.width, a.height, a.x, a.y, a.characters);
        }
        case "figma_get_node_deep": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.getNodeDeep(a.nodeId, a.maxDepth);
        }
        case "figma_batch_get_nodes": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.batchGetNodes(a.nodeIds, a.includeChildren);
        }
        case "figma_switch_mode": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.switchMode(a.frameId, a.collectionId, a.modeId);
        }
        case "figma_list_modes": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.listModes(a.collectionId);
        }
        case "figma_bind_variables_multi_mode": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const a = args;
            return bridge.bindVariablesMultiMode(a.bindings, a.targetFrameId, a.collectionId, a.activeModeId);
        }
        case "figma_get_pages": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            return bridge.getAllPages();
        }
        case "figma_create_page": {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            return bridge.createPage(args.name);
        }
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// MCP Server setup
// ─────────────────────────────────────────────────────────────────────────────
function createMcpServer() {
    const server = new index_js_1.Server({
        name: "figma-intelligence-layer",
        version: "1.0.0",
    }, {
        capabilities: { tools: {} },
    });
    server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
        tools: TOOLS,
    }));
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            const result = await dispatch(name, (args ?? {}));
            const content = [];
            // Support tools returning images for the AI client to analyze
            if (result && typeof result === "object" && !Array.isArray(result)) {
                const obj = result;
                if (Array.isArray(obj.__images)) {
                    for (const img of obj.__images) {
                        content.push({ type: "image", data: img.data, mimeType: img.mimeType });
                    }
                    delete obj.__images;
                }
            }
            // P0: Adaptive response compression — prevent context window overflow
            if (typeof result === "string") {
                content.push({ type: "text", text: result });
            }
            else {
                const compressed = (0, response_compression_js_1.compressResponse)(result);
                if (compressed.tier === "full") {
                    content.push({ type: "text", text: JSON.stringify(result, null, 2) });
                }
                else {
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
        }
        catch (error) {
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
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`figma-intelligence-layer MCP server running (${TOOLS.length} tools across 5 phases)\n`);
    // THEN connect to the bridge relay (non-blocking, fire-and-forget)
    (0, figma_bridge_js_1.ensureRelayServer)().catch((err) => {
        process.stderr.write(`Relay server warning: ${err.message}\n`);
    });
    // Connect the bridge eagerly so the relay immediately sees an MCP socket
    // and reports "Connected" instead of "Relay only" in the plugin UI.
    (0, figma_bridge_js_1.getBridge)().catch(() => { });
}
if (require.main === module) {
    main().catch((err) => {
        process.stderr.write(`Fatal: ${err.message}\n`);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map