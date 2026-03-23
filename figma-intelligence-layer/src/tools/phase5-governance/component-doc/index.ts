/**
 * figma_component_doc — Comprehensive design system documentation generator
 *
 * Produces Uber uSpec / Carbon Design System-quality documentation for a
 * selected Figma component or component set.  Sections: overview, anatomy,
 * variants, states, spacing & structure, color tokens, typography, usage
 * guidelines, accessibility (via APG doc), and API / props table.
 */

import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import {
  captureSnapshot,
  resolveTargetNodeId,
  NodeSnapshot,
  GeneratedDocumentSection,
} from "../spec-generator/index.js";
import { figmaApgDocHandler } from "../apg-doc/index.js";

// ─── Public interface ────────────────────────────────────────────────────────

export interface ContentOverrides {
  overview?: string;
  purpose?: string;
  usage?: { whenToUse: string[]; whenNotToUse: string[] };
  typesAndVariants?: string;
  anatomy?: Array<{ index: number; name: string; type: string; description: string }>;
  properties?: Array<{ name: string; type: string; values: string[]; defaultValue: string; description: string }>;
  states?: Array<{ name: string; visualDescription: string; trigger: string; meaning: string }>;
  sizes?: Array<{ name: string; useCase: string; minTouchTarget: string; context: string }>;
  behaviour?: string;
  interactionRules?: string;
  contentGuidance?: string;
  spacingAndLayout?: string;
  responsive?: string;
  accessibility?: {
    semanticRole?: string;
    ariaAttributes?: string;
    keyboardInteraction?: Array<{ key: string; action: string }>;
    focusManagement?: string;
    screenReaderAnnouncements?: string;
    readingOrder?: string;
    touchTargets?: string;
    colorContrast?: string;
  };
  dosAndDonts?: { dos: string[]; donts: string[] };
  implementationNotes?: string;
  qaChecklist?: string[];
}

export interface ComponentDocArgs {
  nodeId?: string;
  outputFormat: "json" | "report" | "figma-page" | "all";
  sections?: string[];
  includeVisualExamples?: boolean;
  framework?: "html" | "react" | "vue" | "angular";
  pageName?: string;
  contentOverrides?: ContentOverrides;
}

export interface SpacingEntry {
  element: string;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  itemSpacing: number;
  width: number;
  height: number;
  layoutMode: string;
  layoutSizingH: string;
  layoutSizingV: string;
}

export interface ColorTokenEntry {
  element: string;
  property: "fill" | "stroke";
  colorHex: string;
  tokenName: string;
  tokenId: string;
}

export interface TypographyEntry {
  element: string;
  characters: string;
  fontFamily: string;
  fontStyle: string;
  fontSize: number;
  lineHeightPx: number | null;
  letterSpacing: number;
  tokenName: string;
}

export interface PropsEntry {
  name: string;
  type: string;
  values: string[];
  defaultValue: string;
  description: string;
}

export interface DesignSystemSpec {
  componentName: string;
  nodeId: string;
  nodeType: string;
  overview: {
    description: string;
    whenToUse: string[];
    whenNotToUse: string[];
  };
  purpose: string;
  anatomy: Array<{ index: number; name: string; type: string; description: string }>;
  variants: Array<{ property: string; values: string[]; defaultValue: string }>;
  states: string[];
  sizes: Array<{ name: string; useCase: string; minTouchTarget: string; context: string }>;
  spacing: SpacingEntry[];
  colorTokens: ColorTokenEntry[];
  typography: TypographyEntry[];
  usageGuidelines: { dos: string[]; donts: string[] };
  behaviour: string;
  interactionRules: string;
  contentGuidance: string;
  responsive: string;
  accessibility: GeneratedDocumentSection[];
  implementationNotes: string;
  qaChecklist: string[];
  props: PropsEntry[];
}

export interface ComponentDocResult {
  spec: DesignSystemSpec;
  report?: string;
  figmaPageId?: string;
  logEntryId: string;
  hint?: string;
}

// ─── Deep data extraction via Figma Plugin API ──────────────────────────────

async function captureSpacingStructure(nodeId: string): Promise<SpacingEntry[]> {
  const bridge = await getBridge();
  const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found");

      const entries = [];
      const queue = [node];
      while (queue.length > 0 && entries.length < 80) {
        const current = queue.shift();
        if (!current) break;
        if ("layoutMode" in current && current.layoutMode && current.layoutMode !== "NONE") {
          entries.push({
            element: current.name || "Unnamed",
            paddingTop: current.paddingTop || 0,
            paddingRight: current.paddingRight || 0,
            paddingBottom: current.paddingBottom || 0,
            paddingLeft: current.paddingLeft || 0,
            itemSpacing: current.itemSpacing || 0,
            width: Math.round(current.width || 0),
            height: Math.round(current.height || 0),
            layoutMode: String(current.layoutMode),
            layoutSizingH: "layoutSizingHorizontal" in current ? String(current.layoutSizingHorizontal || "FIXED") : "FIXED",
            layoutSizingV: "layoutSizingVertical" in current ? String(current.layoutSizingVertical || "FIXED") : "FIXED",
          });
        }
        if ("children" in current && current.children.length > 0) {
          for (const child of current.children.slice(0, 20)) {
            queue.push(child);
          }
        }
      }
      return entries;
    })();
  `);

  if (!result.success) return [];
  return (result.result as SpacingEntry[]) || [];
}

async function captureColorTokenMap(nodeId: string): Promise<ColorTokenEntry[]> {
  const bridge = await getBridge();
  const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found");

      function rgbToHex(c) {
        var r = Math.round((c.r || 0) * 255);
        var g = Math.round((c.g || 0) * 255);
        var b = Math.round((c.b || 0) * 255);
        return "#" + [r, g, b].map(function(v) { return v.toString(16).padStart(2, "0"); }).join("");
      }

      const entries = [];
      const queue = [node];
      const varCache = {};

      while (queue.length > 0 && entries.length < 120) {
        const current = queue.shift();
        if (!current) break;

        async function processPaints(paints, boundVars, prop) {
          if (!Array.isArray(paints)) return;
          for (var i = 0; i < paints.length; i++) {
            var paint = paints[i];
            if (!paint || paint.type !== "SOLID") continue;
            var hex = paint.color ? rgbToHex(paint.color) : "#000000";
            var tokenName = "";
            var tokenId = "";
            if (boundVars && boundVars[prop]) {
              var binding = Array.isArray(boundVars[prop]) ? boundVars[prop][i] : boundVars[prop];
              if (binding && binding.id) {
                tokenId = binding.id;
                if (!varCache[tokenId]) {
                  try {
                    var v = await figma.variables.getVariableByIdAsync(tokenId);
                    varCache[tokenId] = v ? v.name : "";
                  } catch(e) { varCache[tokenId] = ""; }
                }
                tokenName = varCache[tokenId] || "";
              }
            }
            entries.push({
              element: current.name || "Unnamed",
              property: prop === "fills" ? "fill" : "stroke",
              colorHex: hex,
              tokenName: tokenName,
              tokenId: tokenId,
            });
          }
        }

        var bv = current.boundVariables || {};
        await processPaints(current.fills, bv, "fills");
        await processPaints(current.strokes, bv, "strokes");

        if ("children" in current && current.children.length > 0) {
          for (const child of current.children.slice(0, 20)) {
            queue.push(child);
          }
        }
      }
      return entries;
    })();
  `);

  if (!result.success) return [];
  return (result.result as ColorTokenEntry[]) || [];
}

async function captureTypographySpec(nodeId: string): Promise<TypographyEntry[]> {
  const bridge = await getBridge();
  const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      const node = await figma.getNodeByIdAsync(${JSON.stringify(nodeId)});
      if (!node) throw new Error("Node not found");

      const entries = [];
      const queue = [node];

      while (queue.length > 0 && entries.length < 40) {
        const current = queue.shift();
        if (!current) break;

        if (current.type === "TEXT") {
          var fontFamily = current.fontName === figma.mixed ? "Mixed" : current.fontName.family;
          var fontStyle = current.fontName === figma.mixed ? "Mixed" : current.fontName.style;
          var fontSize = typeof current.fontSize === "number" ? current.fontSize : 0;
          var lineHeightPx = null;
          if (current.lineHeight && typeof current.lineHeight === "object" && current.lineHeight.unit === "PIXELS") {
            lineHeightPx = current.lineHeight.value;
          }
          var letterSpacing = 0;
          if (current.letterSpacing && typeof current.letterSpacing === "object" && current.letterSpacing.unit === "PIXELS") {
            letterSpacing = current.letterSpacing.value;
          }

          var tokenName = "";
          var bv = current.boundVariables || {};
          if (bv.fontFamily || bv.fontSize) {
            try {
              var varId = (bv.fontSize && bv.fontSize.id) || (bv.fontFamily && bv.fontFamily.id) || "";
              if (varId) {
                var v = await figma.variables.getVariableByIdAsync(varId);
                tokenName = v ? v.name : "";
              }
            } catch(e) {}
          }

          entries.push({
            element: current.name || "Text",
            characters: (current.characters || "").slice(0, 80),
            fontFamily: fontFamily,
            fontStyle: fontStyle,
            fontSize: fontSize,
            lineHeightPx: lineHeightPx,
            letterSpacing: letterSpacing,
            tokenName: tokenName,
          });
        }

        if ("children" in current && current.children.length > 0) {
          for (const child of current.children.slice(0, 20)) {
            queue.push(child);
          }
        }
      }
      return entries;
    })();
  `);

  if (!result.success) return [];
  return (result.result as TypographyEntry[]) || [];
}

// ─── Spec builders ──────────────────────────────────────────────────────────

function buildOverview(snapshot: NodeSnapshot): DesignSystemSpec["overview"] {
  const name = snapshot.name;
  const type = snapshot.type.toLowerCase();
  const isComponentSet = snapshot.type === "COMPONENT_SET";
  const variantCount = snapshot.variants.length;

  const description = snapshot.description
    ? snapshot.description
    : `${name} is a ${type === "component_set" ? "component set" : type} ${isComponentSet ? `containing ${variantCount} variant${variantCount === 1 ? "" : "s"}` : "component"}. It uses ${snapshot.layoutMode === "NONE" ? "absolute positioning" : snapshot.layoutMode.toLowerCase() + " auto layout"} and has ${snapshot.childCount} direct child layer${snapshot.childCount === 1 ? "" : "s"}.`;

  const whenToUse = inferWhenToUse(name);
  const whenNotToUse = inferWhenNotToUse(name);

  return { description, whenToUse, whenNotToUse };
}

function inferWhenToUse(name: string): string[] {
  const n = name.toLowerCase();
  if (/button|btn|cta/.test(n)) return [
    "Use for primary actions that trigger an immediate operation.",
    "Use for form submissions, confirmations, and destructive action confirmations.",
    "Use for call-to-action elements that guide users through a flow.",
  ];
  if (/input|field|text.?field/.test(n)) return [
    "Use when collecting short-form text input from users.",
    "Use for form fields requiring validation feedback.",
    "Use for search bars and filter inputs.",
  ];
  if (/card/.test(n)) return [
    "Use to group related content and actions into a single container.",
    "Use for displaying items in a grid or list layout.",
    "Use when content needs an elevated or bordered container.",
  ];
  if (/tab/.test(n)) return [
    "Use to organize content into separate views within the same context.",
    "Use when users need to switch between related content sections.",
  ];
  if (/modal|dialog/.test(n)) return [
    "Use for critical decisions or confirmations that require user attention.",
    "Use for focused tasks that should block interaction with the page behind.",
  ];
  if (/toggle|switch/.test(n)) return [
    "Use for binary on/off settings that take effect immediately.",
    "Use when the setting change does not require a save action.",
  ];
  if (/checkbox/.test(n)) return [
    "Use for multi-select options within a form.",
    "Use when users need to opt in or acknowledge terms.",
  ];
  if (/nav|menu|sidebar/.test(n)) return [
    "Use for primary site or app navigation.",
    "Use to group related navigation links hierarchically.",
  ];
  if (/avatar/.test(n)) return [
    "Use to represent a user or entity with a visual identifier.",
    "Use in headers, comments, and user lists.",
  ];
  if (/badge|chip|tag/.test(n)) return [
    "Use for status indicators, counts, or categorical labels.",
    "Use to add metadata or filtering options to content.",
  ];
  if (/toast|snackbar|notification/.test(n)) return [
    "Use for brief, non-blocking feedback messages.",
    "Use after an action to confirm success, warn about issues, or report errors.",
  ];
  return [
    `Use ${name} when the design requires this specific component pattern.`,
    "Refer to the design system guidelines for approved usage contexts.",
  ];
}

function inferWhenNotToUse(name: string): string[] {
  const n = name.toLowerCase();
  if (/button|btn|cta/.test(n)) return [
    "Do not use for navigation — use a link or anchor instead.",
    "Do not use multiple primary buttons in the same view.",
  ];
  if (/input|field|text.?field/.test(n)) return [
    "Do not use for long-form content — use a textarea instead.",
    "Do not use without a visible label or accessible name.",
  ];
  if (/card/.test(n)) return [
    "Do not nest cards within cards.",
    "Do not use as a button — if the entire card is clickable, ensure proper semantics.",
  ];
  if (/tab/.test(n)) return [
    "Do not use when content sections are unrelated.",
    "Do not use for primary navigation between pages.",
  ];
  if (/modal|dialog/.test(n)) return [
    "Do not use for non-critical information — use inline content instead.",
    "Do not stack multiple modals.",
  ];
  if (/toggle|switch/.test(n)) return [
    "Do not use when a save action is required — use a checkbox instead.",
    "Do not use for multiple selections in a group.",
  ];
  return [
    "Do not use outside of its intended context.",
    "Do not modify the component structure without updating the design system.",
  ];
}

function buildAnatomy(snapshot: NodeSnapshot): DesignSystemSpec["anatomy"] {
  return snapshot.childNames.slice(0, 16).map((name, i) => ({
    index: i + 1,
    name,
    type: snapshot.scanNodes?.find((n) => n.name === name && n.depth === 1)?.type || "FRAME",
    description: inferAnatomyDescription(name),
  }));
}

function inferAnatomyDescription(name: string): string {
  const n = name.toLowerCase();
  if (/icon|ico/.test(n)) return "Visual icon element supporting the label or indicating an action.";
  if (/label|title|heading/.test(n)) return "Primary text label that communicates the purpose.";
  if (/text|body|description|subtitle/.test(n)) return "Supporting text content providing additional context.";
  if (/image|thumbnail|avatar|photo/.test(n)) return "Visual media element.";
  if (/container|wrapper|frame/.test(n)) return "Layout container organizing child elements.";
  if (/divider|separator/.test(n)) return "Visual separator between content sections.";
  if (/badge|indicator|dot/.test(n)) return "Status or count indicator element.";
  if (/input|field/.test(n)) return "Text input field for user data entry.";
  if (/button|btn|action|cta/.test(n)) return "Interactive action element.";
  if (/background|bg/.test(n)) return "Background layer providing visual foundation.";
  if (/border|stroke|outline/.test(n)) return "Border or outline decoration.";
  if (/shadow|elevation/.test(n)) return "Elevation or depth visual treatment.";
  if (/spacer/.test(n)) return "Layout spacer for consistent spacing.";
  if (/close|dismiss|x/.test(n)) return "Dismiss or close action control.";
  return `Child element "${name}" — document its purpose in the component.`;
}

function buildVariants(snapshot: NodeSnapshot): DesignSystemSpec["variants"] {
  const variants: DesignSystemSpec["variants"] = [];

  for (const [property, values] of Object.entries(snapshot.variantGroupProperties)) {
    variants.push({ property, values, defaultValue: values[0] || "" });
  }

  for (const prop of snapshot.componentProperties) {
    if (variants.some((v) => v.property === prop.name)) continue;
    if (prop.options.length > 0) {
      variants.push({
        property: prop.name,
        values: prop.options,
        defaultValue: prop.value || prop.options[0] || "",
      });
    } else if (prop.type === "BOOLEAN") {
      variants.push({
        property: prop.name,
        values: ["true", "false"],
        defaultValue: prop.value || "false",
      });
    }
  }

  return variants;
}

function inferStatesFromSnapshot(snapshot: NodeSnapshot): string[] {
  const states = new Set<string>();

  for (const [property, values] of Object.entries(snapshot.variantGroupProperties)) {
    if (/state|status|interaction/i.test(property)) {
      values.forEach((v) => states.add(v));
    }
  }

  for (const prop of snapshot.componentProperties) {
    if (/state|status|interaction/i.test(prop.name) && prop.options.length > 0) {
      prop.options.forEach((v) => states.add(v));
    }
  }

  if (states.size === 0) {
    const n = snapshot.name.toLowerCase();
    if (/button|btn|input|field|toggle|switch|checkbox|radio|tab|link/.test(n)) {
      return ["Default", "Hover", "Active", "Focus", "Disabled"];
    }
  }

  return Array.from(states);
}

function buildUsageGuidelines(snapshot: NodeSnapshot): DesignSystemSpec["usageGuidelines"] {
  const n = snapshot.name.toLowerCase();
  const dos: string[] = [];
  const donts: string[] = [];

  // Universal do's
  dos.push("Always use design tokens for colors, spacing, and typography — never hardcode values.");
  dos.push("Keep the component's semantic structure intact when customizing content.");

  if (/button|btn|cta/.test(n)) {
    dos.push("Keep button labels concise and action-oriented (e.g. 'Save changes', not 'Click here').");
    dos.push("Provide sufficient color contrast between label and background in all states.");
    donts.push("Don't wrap buttons in additional clickable containers.");
    donts.push("Don't use more than one primary button per section.");
    donts.push("Don't disable buttons without explaining why the action is unavailable.");
  } else if (/input|field|text.?field/.test(n)) {
    dos.push("Always pair inputs with a visible label above or beside the field.");
    dos.push("Show validation errors inline, directly below the field.");
    donts.push("Don't use placeholder text as a substitute for a label.");
    donts.push("Don't remove the focus ring or focus indicator.");
  } else if (/card/.test(n)) {
    dos.push("Use consistent padding and spacing within all card instances.");
    dos.push("Keep card content scannable — lead with the most important information.");
    donts.push("Don't overload cards with too many actions.");
    donts.push("Don't vary card heights arbitrarily in a grid layout.");
  } else if (/modal|dialog/.test(n)) {
    dos.push("Trap keyboard focus inside the modal while open.");
    dos.push("Provide a clear close action (button or Escape key).");
    donts.push("Don't open modals without a clear trigger action from the user.");
    donts.push("Don't use modals for content that could be shown inline.");
  } else if (/nav|menu/.test(n)) {
    dos.push("Highlight the currently active item clearly.");
    dos.push("Support keyboard navigation across all menu items.");
    donts.push("Don't nest more than two levels of navigation.");
    donts.push("Don't mix navigation and action items without clear visual separation.");
  } else {
    dos.push("Follow the design system's documented usage patterns for this component.");
    donts.push("Don't modify the component's internal structure without updating the design system.");
    donts.push("Don't introduce ad-hoc variants that aren't in the component set.");
  }

  donts.push("Don't detach the component instance unless absolutely necessary.");

  return { dos, donts };
}

function buildPropsTable(snapshot: NodeSnapshot): PropsEntry[] {
  const props: PropsEntry[] = [];

  for (const [property, values] of Object.entries(snapshot.variantGroupProperties)) {
    props.push({
      name: property,
      type: "variant",
      values,
      defaultValue: values[0] || "",
      description: `Controls the ${property.toLowerCase()} of the component.`,
    });
  }

  for (const prop of snapshot.componentProperties) {
    if (props.some((p) => p.name === prop.name)) continue;
    props.push({
      name: prop.name,
      type: prop.type.toLowerCase(),
      values: prop.options.length > 0 ? prop.options : [prop.value || ""],
      defaultValue: prop.value || "",
      description: `Component property: ${prop.name}.`,
    });
  }

  return props;
}

// ─── New section builders ────────────────────────────────────────────────────

function buildPurpose(snapshot: NodeSnapshot): string {
  const n = snapshot.name.toLowerCase();
  if (/button|btn|cta/.test(n)) return "Allows users to trigger a single, immediate action such as submitting a form, confirming a decision, or navigating to the next step.";
  if (/input|field|text.?field/.test(n)) return "Provides a text entry point for users to input short-form data such as names, emails, or search queries.";
  if (/card/.test(n)) return "Groups related content and actions into a visually distinct, scannable container.";
  if (/modal|dialog/.test(n)) return "Presents focused content or decisions that require immediate user attention, blocking interaction with the page behind.";
  if (/toggle|switch/.test(n)) return "Enables users to instantly turn a setting on or off without requiring a save action.";
  if (/checkbox/.test(n)) return "Allows users to select one or more options from a set, typically within a form context.";
  if (/tab/.test(n)) return "Organizes content into switchable panels within a single view, reducing page complexity.";
  if (/nav|menu|sidebar/.test(n)) return "Provides the primary navigation structure for the application, helping users move between sections.";
  if (/toast|snackbar|notification/.test(n)) return "Delivers brief, non-blocking feedback to users about the result of an action.";
  if (/avatar/.test(n)) return "Represents a user or entity with a visual identifier, commonly used in profiles and comment threads.";
  if (/badge|chip|tag/.test(n)) return "Communicates status, count, or categorical metadata in a compact visual form.";
  return `${snapshot.name} serves as a reusable UI element within the design system. Document its specific role and user-facing purpose.`;
}

function buildSizes(snapshot: NodeSnapshot): DesignSystemSpec["sizes"] {
  const sizes: DesignSystemSpec["sizes"] = [];
  for (const [property, values] of Object.entries(snapshot.variantGroupProperties)) {
    if (/size|scale|density/i.test(property)) {
      for (const val of values) {
        const v = val.toLowerCase();
        let useCase = "General use.";
        let minTouchTarget = "44×44px (iOS), 48×48dp (Android)";
        let context = "Standard contexts.";
        if (/xs|extra.?small|tiny/.test(v)) { useCase = "Dense data tables, compact toolbars."; context = "Desktop-only, information-dense layouts."; minTouchTarget = "24×24px minimum"; }
        else if (/sm|small/.test(v)) { useCase = "Secondary actions, inline controls."; context = "Dense layouts, data tables, toolbars."; minTouchTarget = "32×32px minimum"; }
        else if (/md|medium|default|regular/.test(v)) { useCase = "Primary UI interactions."; context = "Most screens, forms, and content areas."; }
        else if (/lg|large/.test(v)) { useCase = "Primary mobile actions, hero CTAs."; context = "Mobile primary actions, prominent areas."; minTouchTarget = "48×48px recommended"; }
        else if (/xl|extra.?large/.test(v)) { useCase = "Full-width mobile actions, hero sections."; context = "Mobile-first layouts, high-priority actions."; minTouchTarget = "56×56px recommended"; }
        sizes.push({ name: val, useCase, minTouchTarget, context });
      }
    }
  }
  return sizes;
}

function buildBehaviour(snapshot: NodeSnapshot): string {
  const n = snapshot.name.toLowerCase();
  if (/button|btn|cta/.test(n)) return "On click/tap, the button triggers its associated action immediately. During async operations, show a loading spinner and disable the button to prevent duplicate submissions. On keyboard Enter or Space, the same action fires. Long press has no additional behaviour.";
  if (/input|field|text.?field/.test(n)) return "On focus, the field shows a focus ring and optional placeholder text fades. On input, real-time validation runs after a debounce period. On blur, full validation triggers and error messages appear inline. Tab moves to the next field; Shift+Tab moves backward.";
  if (/toggle|switch/.test(n)) return "On click/tap, the toggle immediately switches state and applies the change without a save action. A brief transition animation indicates the state change. Keyboard Space toggles the value.";
  if (/modal|dialog/.test(n)) return "Opens with a fade/scale transition. Focus is trapped inside the modal. Pressing Escape or clicking the backdrop dismisses it. On close, focus returns to the triggering element.";
  return "";
}

function buildInteractionRules(snapshot: NodeSnapshot): string {
  const n = snapshot.name.toLowerCase();
  if (/button|btn|cta/.test(n)) return "Keyboard: Enter and Space activate the button. Tab moves focus to the next focusable element. No focus trap. Pointer: click/tap triggers the action. Disabled state prevents all interaction and removes from tab order.";
  if (/input|field|text.?field/.test(n)) return "Keyboard: Tab focuses the field; typing inserts text; Escape clears or reverts. Pointer: click focuses and places cursor. Focus ring must be visible at all times. Autocomplete: arrow keys navigate suggestions, Enter selects.";
  if (/modal|dialog/.test(n)) return "Keyboard: Tab/Shift+Tab cycle within modal; Escape closes. Focus trap: focus must not leave the modal while open. On open, focus moves to the first focusable element or close button. On close, focus returns to the trigger.";
  if (/tab/.test(n)) return "Keyboard: Arrow Left/Right moves between tabs; Home goes to first tab; End goes to last. Tab key moves focus into the tab panel content. Only the active tab is in the tab order.";
  return "";
}

function buildContentGuidance(snapshot: NodeSnapshot): string {
  const n = snapshot.name.toLowerCase();
  if (/button|btn|cta/.test(n)) return "Labels should be concise (1-3 words), action-oriented verbs or verb phrases in sentence case (e.g., 'Save changes', 'Delete item'). Avoid vague labels like 'Click here' or 'Submit'. Icons should reinforce the label meaning, not replace it. Truncation: labels must not truncate — resize the button or shorten the text.";
  if (/input|field|text.?field/.test(n)) return "Labels must describe the expected input in sentence case. Placeholder text is optional help text — never a substitute for a label. Error messages should be specific ('Email must contain @') not generic ('Invalid input'). Helper text appears below the field and persists across states.";
  return "";
}

function buildResponsive(snapshot: NodeSnapshot): string {
  const n = snapshot.name.toLowerCase();
  if (/button|btn|cta/.test(n)) return "On mobile (< 768px), primary buttons should be full-width. On desktop, buttons use intrinsic width with minimum width of 120px. Button groups stack vertically on mobile. Touch targets expand to 48px minimum height on mobile.";
  if (/input|field|text.?field/.test(n)) return "Fields stretch to fill container width at all breakpoints. On mobile, labels stack above fields. Field groups may stack vertically below 768px. Font size should be at least 16px on mobile to prevent iOS zoom.";
  if (/card/.test(n)) return "Cards in a grid should reflow from multi-column to single-column below 768px. Card padding may reduce on smaller screens. Images within cards should maintain aspect ratio.";
  return "";
}

function buildImplementationNotes(snapshot: NodeSnapshot): string {
  const n = snapshot.name.toLowerCase();
  if (/button|btn|cta/.test(n)) return "Use native <button> element, not <div> or <a>. For link-style navigation, use <a> styled as button. Support ref forwarding for parent focus management. Handle loading state with aria-busy='true'. Disabled buttons should use aria-disabled='true' rather than the disabled attribute if you need to keep them focusable for tooltip explanations.";
  if (/input|field|text.?field/.test(n)) return "Use native <input> or <textarea>. Associate label with htmlFor/id. Error messages linked via aria-describedby. Support controlled and uncontrolled modes. Debounce onChange for validation (300ms recommended).";
  if (/modal|dialog/.test(n)) return "Use native <dialog> element where supported. Implement focus trap with a sentinel approach. Restore focus on close. Prevent body scroll with overflow:hidden on body. Portal rendering recommended for z-index management.";
  return "";
}

function buildQaChecklist(snapshot: NodeSnapshot): string[] {
  const checks: string[] = [
    "Visual: Component matches design specs in all states and sizes",
    "Keyboard: All interactive elements reachable and operable via keyboard",
    "Screen reader: Correct role, name, and state announced",
    "Contrast: Text meets 4.5:1 ratio; non-text elements meet 3:1",
    "Responsive: Component behaves correctly at mobile, tablet, and desktop widths",
    "RTL: Layout mirrors correctly in right-to-left languages",
    "Theming: Component respects light/dark mode tokens",
    "Error states: Validation errors display correctly with accessible announcements",
  ];
  const n = snapshot.name.toLowerCase();
  if (/button|btn|cta/.test(n)) {
    checks.push("Loading: Spinner displays and button is disabled during async operations");
    checks.push("Focus ring: Visible focus indicator in all states");
  }
  if (/input|field|text.?field/.test(n)) {
    checks.push("Placeholder: Disappears on input, does not replace label");
    checks.push("Validation: Error messages appear inline on blur");
  }
  if (/modal|dialog/.test(n)) {
    checks.push("Focus trap: Tab key does not leave the modal");
    checks.push("Escape: Modal closes and focus returns to trigger");
  }
  return checks;
}

function convertAccessibilityOverrides(
  a11y: NonNullable<ContentOverrides["accessibility"]>,
): GeneratedDocumentSection[] {
  const sections: GeneratedDocumentSection[] = [];
  if (a11y.semanticRole) sections.push({ title: "Semantic Role", style: "bullets", items: [a11y.semanticRole] });
  if (a11y.ariaAttributes) sections.push({ title: "ARIA Attributes", style: "bullets", items: [a11y.ariaAttributes] });
  if (a11y.keyboardInteraction?.length) {
    sections.push({
      title: "Keyboard Interaction",
      style: "bullets",
      items: a11y.keyboardInteraction.map((k) => `${k.key}: ${k.action}`),
    });
  }
  if (a11y.focusManagement) sections.push({ title: "Focus Management", style: "bullets", items: [a11y.focusManagement] });
  if (a11y.screenReaderAnnouncements) sections.push({ title: "Screen Reader Announcements", style: "bullets", items: [a11y.screenReaderAnnouncements] });
  if (a11y.readingOrder) sections.push({ title: "Reading Order", style: "bullets", items: [a11y.readingOrder] });
  if (a11y.touchTargets) sections.push({ title: "Touch Targets", style: "bullets", items: [a11y.touchTargets] });
  if (a11y.colorContrast) sections.push({ title: "Color Contrast", style: "bullets", items: [a11y.colorContrast] });
  return sections;
}

// ─── Format the spec as a markdown report ───────────────────────────────────

function formatSpecAsReport(spec: DesignSystemSpec): string {
  const lines: string[] = [];

  lines.push(`# ${spec.componentName} — Design System Documentation`);
  lines.push(`Node: ${spec.nodeId} | Type: ${spec.nodeType}`);
  lines.push("");

  // Overview
  lines.push("## Overview");
  lines.push(spec.overview.description);
  lines.push("");
  lines.push("### When to use");
  spec.overview.whenToUse.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("### When not to use");
  spec.overview.whenNotToUse.forEach((item) => lines.push(`- ${item}`));
  lines.push("");

  // Anatomy
  lines.push("## Anatomy");
  spec.anatomy.forEach((part) => {
    lines.push(`${part.index}. **${part.name}** (${part.type}) — ${part.description}`);
  });
  lines.push("");

  // Variants
  lines.push("## Variants");
  if (spec.variants.length > 0) {
    lines.push("| Property | Values | Default |");
    lines.push("|----------|--------|---------|");
    spec.variants.forEach((v) => {
      lines.push(`| ${v.property} | ${v.values.join(", ")} | ${v.defaultValue} |`);
    });
  } else {
    lines.push("No explicit variants detected.");
  }
  lines.push("");

  // States
  lines.push("## States");
  if (spec.states.length > 0) {
    spec.states.forEach((s) => lines.push(`- ${s}`));
  } else {
    lines.push("No explicit states detected. Document expected states manually.");
  }
  lines.push("");

  // Spacing & Structure
  lines.push("## Spacing & Structure");
  if (spec.spacing.length > 0) {
    lines.push("| Element | Layout | Padding (T/R/B/L) | Gap | Size (W×H) | Sizing |");
    lines.push("|---------|--------|-------------------|-----|------------|--------|");
    spec.spacing.slice(0, 20).forEach((s) => {
      lines.push(`| ${s.element} | ${s.layoutMode} | ${s.paddingTop}/${s.paddingRight}/${s.paddingBottom}/${s.paddingLeft} | ${s.itemSpacing} | ${s.width}×${s.height} | H:${s.layoutSizingH} V:${s.layoutSizingV} |`);
    });
  } else {
    lines.push("No auto-layout spacing data detected.");
  }
  lines.push("");

  // Color Tokens
  lines.push("## Color Tokens");
  if (spec.colorTokens.length > 0) {
    lines.push("| Element | Property | Color | Token |");
    lines.push("|---------|----------|-------|-------|");
    spec.colorTokens.slice(0, 30).forEach((c) => {
      lines.push(`| ${c.element} | ${c.property} | ${c.colorHex} | ${c.tokenName || "—"} |`);
    });
  } else {
    lines.push("No color token data detected.");
  }
  lines.push("");

  // Typography
  lines.push("## Typography");
  if (spec.typography.length > 0) {
    lines.push("| Element | Font | Size | Weight | Line Height | Token |");
    lines.push("|---------|------|------|--------|-------------|-------|");
    spec.typography.slice(0, 20).forEach((t) => {
      const lh = t.lineHeightPx ? `${t.lineHeightPx}px` : "auto";
      lines.push(`| ${t.element} | ${t.fontFamily} | ${t.fontSize}px | ${t.fontStyle} | ${lh} | ${t.tokenName || "—"} |`);
    });
  } else {
    lines.push("No typography data detected.");
  }
  lines.push("");

  // Usage Guidelines
  lines.push("## Usage Guidelines");
  lines.push("### Do's");
  spec.usageGuidelines.dos.forEach((d) => lines.push(`- ${d}`));
  lines.push("");
  lines.push("### Don'ts");
  spec.usageGuidelines.donts.forEach((d) => lines.push(`- ${d}`));
  lines.push("");

  // Accessibility
  lines.push("## Accessibility");
  if (spec.accessibility.length > 0) {
    spec.accessibility.forEach((section) => {
      lines.push(`### ${section.title}`);
      section.items.forEach((item) => lines.push(`- ${item}`));
      lines.push("");
    });
  } else {
    lines.push("Run figma_apg_doc for detailed accessibility documentation.");
  }
  lines.push("");

  // Props / API
  lines.push("## API / Props");
  if (spec.props.length > 0) {
    lines.push("| Name | Type | Values | Default | Description |");
    lines.push("|------|------|--------|---------|-------------|");
    spec.props.forEach((p) => {
      lines.push(`| ${p.name} | ${p.type} | ${p.values.join(", ")} | ${p.defaultValue} | ${p.description} |`);
    });
  } else {
    lines.push("No component properties detected.");
  }
  lines.push("");

  // Purpose
  if (spec.purpose) {
    lines.push("## Purpose");
    lines.push(spec.purpose);
    lines.push("");
  }

  // Sizes
  if (spec.sizes.length > 0) {
    lines.push("## Sizes");
    lines.push("| Size | Use Case | Min Touch Target | Context |");
    lines.push("|------|----------|-----------------|---------|");
    spec.sizes.forEach((s) => {
      lines.push(`| ${s.name} | ${s.useCase} | ${s.minTouchTarget} | ${s.context} |`);
    });
    lines.push("");
  }

  // Behaviour
  if (spec.behaviour) {
    lines.push("## Behaviour");
    lines.push(spec.behaviour);
    lines.push("");
  }

  // Interaction Rules
  if (spec.interactionRules) {
    lines.push("## Interaction Rules");
    lines.push(spec.interactionRules);
    lines.push("");
  }

  // Content Guidance
  if (spec.contentGuidance) {
    lines.push("## Content Guidance");
    lines.push(spec.contentGuidance);
    lines.push("");
  }

  // Responsive
  if (spec.responsive) {
    lines.push("## Responsive Behaviour");
    lines.push(spec.responsive);
    lines.push("");
  }

  // Implementation Notes
  if (spec.implementationNotes) {
    lines.push("## Implementation Notes");
    lines.push(spec.implementationNotes);
    lines.push("");
  }

  // QA Checklist
  if (spec.qaChecklist.length > 0) {
    lines.push("## QA Checklist");
    spec.qaChecklist.forEach((item) => lines.push(`- [ ] ${item}`));
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Visual documentation page renderer (Carbon/uSpec quality) ──────────────

function escStr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "");
}

async function createVisualDocPage(spec: DesignSystemSpec, nodeId: string, pageName: string): Promise<string> {
  const bridge = await getBridge();

  const variantsJson = JSON.stringify(spec.variants.slice(0, 12));
  const anatomyJson = JSON.stringify(spec.anatomy.slice(0, 12));
  const statesJson = JSON.stringify(spec.states.slice(0, 8));
  const dosJson = JSON.stringify(spec.usageGuidelines.dos.slice(0, 6));
  const dontsJson = JSON.stringify(spec.usageGuidelines.donts.slice(0, 6));
  const colorTokensJson = JSON.stringify(spec.colorTokens.slice(0, 24));
  const typographyJson = JSON.stringify(spec.typography.slice(0, 12));
  const spacingJson = JSON.stringify(spec.spacing.slice(0, 12));
  const propsJson = JSON.stringify(spec.props.slice(0, 16));
  const a11yJson = JSON.stringify(spec.accessibility.slice(0, 6));

  // ── SCRIPT 1: Page + Header + Overview + Types + Anatomy ──
  const result1 = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      var existing = figma.root.children.find(function(p) { return p.name === "${escStr(pageName)}"; });
      var page = existing || figma.createPage();
      page.name = "${escStr(pageName)}";
      await figma.setCurrentPageAsync(page);
      for (var ch of [...page.children]) { ch.remove(); }

      // Load fonts
      var fonts = [
        { family: "Inter", style: "Bold" },
        { family: "Inter", style: "Semi Bold" },
        { family: "Inter", style: "Medium" },
        { family: "Inter", style: "Regular" },
      ];
      for (var f of fonts) {
        try { await figma.loadFontAsync(f); } catch(e) {
          try { await figma.loadFontAsync({ family: "Roboto", style: f.style === "Semi Bold" ? "Medium" : f.style }); } catch(e2) {}
        }
      }

      var fontBold = { family: "Inter", style: "Bold" };
      var fontSemiBold = { family: "Inter", style: "Semi Bold" };
      var fontMedium = { family: "Inter", style: "Medium" };
      var fontRegular = { family: "Inter", style: "Regular" };

      var C = {
        bg: { r: 1, g: 1, b: 1 },
        cardBg: { r: 0.969, g: 0.969, b: 0.976 },
        text: { r: 0.13, g: 0.13, b: 0.13 },
        textMuted: { r: 0.35, g: 0.35, b: 0.4 },
        accent: { r: 0.75, g: 0.0, b: 0.45 },
        stroke: { r: 0.88, g: 0.88, b: 0.9 },
        green: { r: 0.13, g: 0.59, b: 0.33 },
        red: { r: 0.86, g: 0.15, b: 0.15 },
        marker: { r: 0.75, g: 0.0, b: 0.45 },
        badgeBg: { r: 0.2, g: 0.2, b: 0.22 },
        headerTint: { r: 0.95, g: 0.95, b: 0.96 },
        white: { r: 1, g: 1, b: 1 },
        specRed: { r: 0.85, g: 0.1, b: 0.3 },
      };

      var W = 1200;

      function T(chars, font, size, color, width) {
        var t = figma.createText();
        try { t.fontName = font; } catch(e) { t.fontName = { family: "Roboto", style: "Regular" }; }
        t.fontSize = size;
        t.lineHeight = { unit: "PIXELS", value: Math.round(size * 1.5) };
        t.characters = String(chars || "");
        t.fills = [{ type: "SOLID", color: color }];
        if (width) { t.resize(width, t.height); t.textAutoResize = "HEIGHT"; }
        else { t.textAutoResize = "WIDTH_AND_HEIGHT"; }
        return t;
      }

      function divider() {
        var d = figma.createFrame();
        d.resize(W - 80, 1);
        d.fills = [{ type: "SOLID", color: C.stroke }];
        d.layoutAlign = "STRETCH";
        return d;
      }

      function sectionTitle(title) {
        return T(title, fontBold, 28, C.text);
      }

      function makeMarker(letter, filled) {
        var m = figma.createFrame();
        m.resize(28, 28); m.cornerRadius = 14;
        m.layoutMode = "VERTICAL";
        m.primaryAxisAlignItems = "CENTER"; m.counterAxisAlignItems = "CENTER";
        m.primaryAxisSizingMode = "FIXED"; m.counterAxisSizingMode = "FIXED";
        if (filled) {
          m.fills = [{ type: "SOLID", color: C.marker }];
        } else {
          m.fills = [{ type: "SOLID", color: C.white }];
          m.strokes = [{ type: "SOLID", color: C.marker }]; m.strokeWeight = 2;
        }
        m.appendChild(T(letter, fontBold, 13, filled ? C.white : C.marker));
        return m;
      }

      function specBadge(text, bgColor) {
        var b = figma.createFrame();
        b.layoutMode = "HORIZONTAL";
        b.primaryAxisSizingMode = "AUTO"; b.counterAxisSizingMode = "AUTO";
        b.paddingLeft = 8; b.paddingRight = 8; b.paddingTop = 3; b.paddingBottom = 3;
        b.cornerRadius = 4;
        b.fills = [{ type: "SOLID", color: bgColor || C.specRed }];
        b.appendChild(T(text, fontMedium, 11, C.white));
        return b;
      }

      function tokenBadge(text) {
        var b = figma.createFrame();
        b.layoutMode = "HORIZONTAL";
        b.primaryAxisSizingMode = "AUTO"; b.counterAxisSizingMode = "AUTO";
        b.paddingLeft = 10; b.paddingRight = 10; b.paddingTop = 5; b.paddingBottom = 5;
        b.cornerRadius = 4;
        b.fills = [{ type: "SOLID", color: C.badgeBg }];
        b.appendChild(T(text, fontMedium, 12, C.white));
        return b;
      }

      function tableCell(text, w, isHeader, hasToken) {
        var cell = figma.createFrame();
        cell.layoutMode = "HORIZONTAL";
        cell.primaryAxisSizingMode = "FIXED"; cell.counterAxisSizingMode = "AUTO";
        cell.primaryAxisAlignItems = "MIN"; cell.counterAxisAlignItems = "CENTER";
        cell.paddingTop = 14; cell.paddingBottom = 14; cell.paddingLeft = 16; cell.paddingRight = 16;
        cell.fills = [{ type: "SOLID", color: isHeader ? C.headerTint : C.white }];
        cell.resize(w, 10);
        cell.clipsContent = true;
        cell.strokes = [{ type: "SOLID", color: C.stroke }];
        cell.strokeBottomWeight = 1; cell.strokeTopWeight = 0; cell.strokeLeftWeight = 0; cell.strokeRightWeight = 0;
        if (hasToken && text && text !== "\\u2014") {
          var badge = tokenBadge(String(text).slice(0, 40));
          badge.layoutSizingHorizontal = "FILL";
          cell.appendChild(badge);
        } else {
          cell.appendChild(T(text || "\\u2014", isHeader ? fontSemiBold : fontRegular, isHeader ? 14 : 13, isHeader ? C.text : C.textMuted, w - 32));
        }
        return cell;
      }

      function makeTable(colWidths, headers, rows, tokenColIndices) {
        var totalW = 0;
        for (var cw = 0; cw < colWidths.length; cw++) totalW += colWidths[cw];
        var table = figma.createFrame();
        table.layoutMode = "VERTICAL"; table.primaryAxisSizingMode = "AUTO";
        table.counterAxisSizingMode = "FIXED"; table.resize(totalW, 10);
        table.fills = []; table.itemSpacing = 0;
        table.cornerRadius = 8; table.clipsContent = true;
        table.strokes = [{ type: "SOLID", color: C.stroke }]; table.strokeWeight = 1;

        function makeRow(cells, isHeader) {
          var row = figma.createFrame();
          row.layoutMode = "HORIZONTAL"; row.primaryAxisSizingMode = "FIXED"; row.counterAxisSizingMode = "AUTO";
          row.resize(totalW, 10);
          row.fills = []; row.itemSpacing = 0;
          for (var i = 0; i < colWidths.length; i++) {
            var isTokenCol = !isHeader && tokenColIndices && tokenColIndices.indexOf(i) >= 0;
            row.appendChild(tableCell(cells[i] || "", colWidths[i], isHeader, isTokenCol));
          }
          return row;
        }

        table.appendChild(makeRow(headers, true));
        for (var r of rows) { table.appendChild(makeRow(r, false)); }
        return table;
      }

      // ── Resolve: INSTANCE → COMPONENT → COMPONENT_SET ──
      var rawNode = await figma.getNodeByIdAsync("${escStr(nodeId)}");
      var compSet = null;
      var singleComp = null;
      if (rawNode) {
        if (rawNode.type === "INSTANCE") {
          var mainComp = await rawNode.getMainComponentAsync();
          if (mainComp && mainComp.parent && mainComp.parent.type === "COMPONENT_SET") {
            compSet = mainComp.parent;
          } else if (mainComp) {
            singleComp = mainComp;
          }
        } else if (rawNode.type === "COMPONENT_SET") {
          compSet = rawNode;
        } else if (rawNode.type === "COMPONENT") {
          if (rawNode.parent && rawNode.parent.type === "COMPONENT_SET") {
            compSet = rawNode.parent;
          } else {
            singleComp = rawNode;
          }
        } else {
          singleComp = rawNode;
        }
      }
      var compNode = compSet || singleComp || rawNode;

      // ── ROOT FRAME ──
      var root = figma.createFrame();
      root.name = "${escStr(spec.componentName)} Documentation";
      root.layoutMode = "VERTICAL";
      root.primaryAxisSizingMode = "AUTO"; root.counterAxisSizingMode = "FIXED";
      root.resize(W, 100);
      root.paddingTop = 56; root.paddingBottom = 72; root.paddingLeft = 56; root.paddingRight = 56;
      root.itemSpacing = 48;
      root.fills = [{ type: "SOLID", color: C.bg }];
      root.x = 40; root.y = 40;

      // ── [1] HEADER ──
      var header = figma.createFrame();
      header.layoutMode = "VERTICAL"; header.primaryAxisSizingMode = "AUTO"; header.counterAxisSizingMode = "AUTO";
      header.itemSpacing = 8; header.fills = [];
      header.appendChild(T("${escStr(spec.componentName)} Documentation", fontBold, 40, C.text));
      header.appendChild(T("Design system specification", fontMedium, 16, C.accent));
      root.appendChild(header);
      root.appendChild(divider());

      // ── [2] OVERVIEW ──
      var overview = figma.createFrame();
      overview.layoutMode = "VERTICAL"; overview.primaryAxisSizingMode = "AUTO"; overview.counterAxisSizingMode = "AUTO";
      overview.itemSpacing = 20; overview.fills = [];
      overview.appendChild(sectionTitle("Overview"));
      overview.appendChild(T("${escStr(spec.overview.description)}", fontRegular, 15, C.textMuted, W - 160));

      // When to use / When not
      var whenFrame = figma.createFrame();
      whenFrame.layoutMode = "HORIZONTAL"; whenFrame.primaryAxisSizingMode = "AUTO"; whenFrame.counterAxisSizingMode = "AUTO";
      whenFrame.itemSpacing = 40; whenFrame.fills = [];
      var whenToUse = ${JSON.stringify(spec.overview.whenToUse.slice(0, 4))};
      var whenNotToUse = ${JSON.stringify(spec.overview.whenNotToUse.slice(0, 4))};
      var useCol = figma.createFrame();
      useCol.layoutMode = "VERTICAL"; useCol.primaryAxisSizingMode = "AUTO"; useCol.counterAxisSizingMode = "AUTO";
      useCol.itemSpacing = 8; useCol.fills = [];
      useCol.appendChild(T("When to use", fontSemiBold, 15, C.text));
      for (var wu of whenToUse) { useCol.appendChild(T("\\u2022  " + wu, fontRegular, 13, C.textMuted, (W - 200) / 2)); }
      whenFrame.appendChild(useCol);
      var notCol = figma.createFrame();
      notCol.layoutMode = "VERTICAL"; notCol.primaryAxisSizingMode = "AUTO"; notCol.counterAxisSizingMode = "AUTO";
      notCol.itemSpacing = 8; notCol.fills = [];
      notCol.appendChild(T("When not to use", fontSemiBold, 15, C.text));
      for (var wn of whenNotToUse) { notCol.appendChild(T("\\u2022  " + wn, fontRegular, 13, C.textMuted, (W - 200) / 2)); }
      whenFrame.appendChild(notCol);
      overview.appendChild(whenFrame);
      root.appendChild(overview);
      root.appendChild(divider());

      // ── [3] TYPES — live component instances ──
      if (compNode) {
        var typesSection = figma.createFrame();
        typesSection.layoutMode = "VERTICAL"; typesSection.primaryAxisSizingMode = "AUTO"; typesSection.counterAxisSizingMode = "AUTO";
        typesSection.itemSpacing = 24; typesSection.fills = [];
        typesSection.appendChild(sectionTitle("Types"));

        var typesRow = figma.createFrame();
        typesRow.layoutMode = "HORIZONTAL"; typesRow.primaryAxisSizingMode = "AUTO"; typesRow.counterAxisSizingMode = "AUTO";
        typesRow.itemSpacing = 40; typesRow.fills = [];
        typesRow.paddingTop = 20; typesRow.paddingBottom = 20;
        typesRow.counterAxisAlignItems = "CENTER";

        var variants = ${variantsJson};
        var typeAxis = variants.length > 0 ? variants[0] : null;
        var typeDescriptions = [];

        if (compSet && compSet.children.length > 0) {
          var shown = new Set();
          var typeIdx = 0;
          for (var child of compSet.children) {
            if (typeIdx >= 6) break;
            var firstProp = child.name.split(",")[0].trim();
            var propVal = firstProp.split("=");
            var label = propVal.length > 1 ? propVal[1].trim() : firstProp;
            if (shown.has(label)) continue;
            shown.add(label);
            var col = figma.createFrame();
            col.layoutMode = "VERTICAL"; col.primaryAxisSizingMode = "AUTO"; col.counterAxisSizingMode = "AUTO";
            col.itemSpacing = 10; col.fills = []; col.counterAxisAlignItems = "CENTER";
            try { col.appendChild(child.createInstance()); } catch(e) {}
            col.appendChild(T(label, fontMedium, 13, C.textMuted));
            typesRow.appendChild(col);
            typeDescriptions.push({ idx: typeIdx + 1, label: label });
            typeIdx++;
          }
        } else if (singleComp) {
          try { typesRow.appendChild(singleComp.createInstance()); } catch(e) {
            typesRow.appendChild(singleComp.clone());
          }
        }
        typesSection.appendChild(typesRow);

        // Numbered descriptions
        if (typeDescriptions.length > 1) {
          var descFrame = figma.createFrame();
          descFrame.layoutMode = "VERTICAL"; descFrame.primaryAxisSizingMode = "AUTO"; descFrame.counterAxisSizingMode = "AUTO";
          descFrame.itemSpacing = 8; descFrame.fills = [];
          for (var td of typeDescriptions) {
            descFrame.appendChild(T(td.idx + ". " + td.label, fontRegular, 14, C.textMuted, W - 160));
          }
          typesSection.appendChild(descFrame);
        }
        root.appendChild(typesSection);
        root.appendChild(divider());
      }

      // ── [4] ANATOMY — component diagram with markers + connector lines ──
      var anatomyParts = ${anatomyJson};
      if (anatomyParts.length > 0 && compNode) {
        var anatSection = figma.createFrame();
        anatSection.layoutMode = "VERTICAL"; anatSection.primaryAxisSizingMode = "AUTO"; anatSection.counterAxisSizingMode = "AUTO";
        anatSection.itemSpacing = 32; anatSection.fills = [];
        anatSection.appendChild(sectionTitle("Anatomy"));
        anatSection.appendChild(T("Elements that compose the ${escStr(spec.componentName)} component.", fontRegular, 15, C.textMuted, W - 160));

        var letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
        var markerColors = [
          { r: 0.75, g: 0.0, b: 0.45 },
          { r: 0.0, g: 0.47, b: 0.84 },
          { r: 0.13, g: 0.59, b: 0.33 },
          { r: 0.85, g: 0.55, b: 0.0 },
          { r: 0.58, g: 0.2, b: 0.78 },
          { r: 0.85, g: 0.1, b: 0.3 },
          { r: 0.0, g: 0.6, b: 0.55 },
          { r: 0.4, g: 0.4, b: 0.5 },
        ];

        // Helper: recursively find meaningful parts (TEXT, VECTOR, INSTANCE, small FRAME)
        function findParts(node, offX, offY, parts, depth) {
          if (depth <= 0 || parts.length >= 8) return;
          if (!("children" in node) || !node.children) return;
          for (var fi = 0; fi < node.children.length; fi++) {
            if (parts.length >= 8) break;
            var ch = node.children[fi];
            if (ch.width < 1 || ch.height < 1) continue;
            if ("visible" in ch && !ch.visible) continue;
            var absX = offX + ch.x;
            var absY = offY + ch.y;
            var isLeaf = ch.type === "TEXT" || ch.type === "VECTOR" || ch.type === "BOOLEAN_OPERATION" ||
              ch.type === "STAR" || ch.type === "ELLIPSE" || ch.type === "RECTANGLE" || ch.type === "LINE";
            var isSmallFrame = (ch.type === "FRAME" || ch.type === "GROUP" || ch.type === "INSTANCE") &&
              (!("children" in ch) || ch.children.length === 0 || (ch.width < 48 && ch.height < 48));
            if (isLeaf || isSmallFrame) {
              parts.push({ name: ch.name, x: absX, y: absY, w: ch.width, h: ch.height, type: ch.type });
            } else if ("children" in ch) {
              findParts(ch, absX, absY, parts, depth - 1);
            }
          }
        }

        // Helper: create a colored marker circle
        function colorMarker(letter, color) {
          var m = figma.createFrame();
          m.resize(28, 28); m.cornerRadius = 14;
          m.layoutMode = "VERTICAL";
          m.primaryAxisAlignItems = "CENTER"; m.counterAxisAlignItems = "CENTER";
          m.primaryAxisSizingMode = "FIXED"; m.counterAxisSizingMode = "FIXED";
          m.fills = [{ type: "SOLID", color: color }];
          m.appendChild(T(letter, fontBold, 13, C.white));
          return m;
        }

        // ── ANATOMY DIAGRAM: single large card with component + markers ──
        var anatSource = compSet ? compSet.children[0] : singleComp;
        var collectedParts = [];

        if (anatSource) {
          var anatCard = figma.createFrame();
          anatCard.name = "anatomy-diagram";
          anatCard.fills = [{ type: "SOLID", color: C.cardBg }];
          anatCard.cornerRadius = 12;
          anatCard.clipsContent = false;

          var anatInst;
          try { anatInst = anatSource.createInstance(); } catch(e) { anatInst = anatSource.clone(); }
          var instW = anatInst.width;
          var instH = anatInst.height;

          // Scale up small components for better visibility
          var scale = 1;
          if (instW < 120 || instH < 30) { scale = 2; anatInst.rescale(scale); instW = anatInst.width; instH = anatInst.height; }

          var padding = 100;
          var cardW = W - 160;
          var cardH = instH + padding * 2 + 60;
          anatCard.resize(cardW, cardH);

          var instX = (cardW - instW) / 2;
          var instY = padding + 20;
          anatInst.x = instX;
          anatInst.y = instY;
          anatCard.appendChild(anatInst);

          // Find all meaningful parts within the instance
          findParts(anatInst, instX, instY, collectedParts, 4);

          // Also add the container itself as a part
          if (collectedParts.length === 0) {
            collectedParts.push({ name: anatSource.name, x: instX, y: instY, w: instW, h: instH, type: "FRAME" });
          }

          // Place markers, highlight outlines, and connector lines for each part
          for (var pi = 0; pi < collectedParts.length && pi < 8; pi++) {
            var part = collectedParts[pi];
            var mColor = markerColors[pi % markerColors.length];
            var mk = colorMarker(letters[pi], mColor);

            // Highlight outline around the part
            var highlight = figma.createFrame();
            highlight.resize(part.w + 4, part.h + 4);
            highlight.x = part.x - 2; highlight.y = part.y - 2;
            highlight.fills = []; highlight.cornerRadius = 2;
            highlight.strokes = [{ type: "SOLID", color: mColor }];
            highlight.strokeWeight = 1.5; highlight.opacity = 0.5;
            highlight.dashPattern = [4, 3];
            anatCard.appendChild(highlight);

            // Position marker: alternate top/bottom/left/right
            var mkX, mkY, lineStartX, lineStartY, lineEndX, lineEndY;
            var partCX = part.x + part.w / 2;
            var partCY = part.y + part.h / 2;

            if (pi % 4 === 0) {
              // Above
              mkX = partCX - 14;
              mkY = Math.max(4, part.y - 50);
              lineStartX = mkX + 14; lineStartY = mkY + 28;
              lineEndX = partCX; lineEndY = part.y;
            } else if (pi % 4 === 1) {
              // Right
              mkX = Math.min(cardW - 36, part.x + part.w + 20);
              mkY = partCY - 14;
              lineStartX = part.x + part.w; lineStartY = partCY;
              lineEndX = mkX; lineEndY = mkY + 14;
            } else if (pi % 4 === 2) {
              // Below
              mkX = partCX - 14;
              mkY = Math.min(cardH - 36, part.y + part.h + 20);
              lineStartX = partCX; lineStartY = part.y + part.h;
              lineEndX = mkX + 14; lineEndY = mkY;
            } else {
              // Left
              mkX = Math.max(4, part.x - 50);
              mkY = partCY - 14;
              lineStartX = mkX + 28; lineStartY = mkY + 14;
              lineEndX = part.x; lineEndY = partCY;
            }
            mk.x = mkX; mk.y = mkY;
            anatCard.appendChild(mk);

            // Connector line (horizontal + vertical segments)
            var dx = lineEndX - lineStartX;
            var dy = lineEndY - lineStartY;
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
              if (Math.abs(dy) < Math.abs(dx) * 0.3) {
                // Nearly horizontal
                var hl = figma.createFrame();
                hl.resize(Math.max(1, Math.abs(dx)), 1.5);
                hl.x = Math.min(lineStartX, lineEndX); hl.y = lineStartY - 0.75;
                hl.fills = [{ type: "SOLID", color: mColor }]; hl.opacity = 0.6;
                anatCard.appendChild(hl);
              } else if (Math.abs(dx) < Math.abs(dy) * 0.3) {
                // Nearly vertical
                var vl = figma.createFrame();
                vl.resize(1.5, Math.max(1, Math.abs(dy)));
                vl.x = lineStartX - 0.75; vl.y = Math.min(lineStartY, lineEndY);
                vl.fills = [{ type: "SOLID", color: mColor }]; vl.opacity = 0.6;
                anatCard.appendChild(vl);
              } else {
                // L-shaped: horizontal then vertical
                var hl2 = figma.createFrame();
                hl2.resize(Math.max(1, Math.abs(dx)), 1.5);
                hl2.x = Math.min(lineStartX, lineEndX); hl2.y = lineStartY - 0.75;
                hl2.fills = [{ type: "SOLID", color: mColor }]; hl2.opacity = 0.6;
                anatCard.appendChild(hl2);
                var vl2 = figma.createFrame();
                vl2.resize(1.5, Math.max(1, Math.abs(dy)));
                vl2.x = lineEndX - 0.75; vl2.y = Math.min(lineStartY, lineEndY);
                vl2.fills = [{ type: "SOLID", color: mColor }]; vl2.opacity = 0.6;
                anatCard.appendChild(vl2);
              }
            }
          }

          anatSection.appendChild(anatCard);
        }

        // ── Legend row (horizontal, colored markers + labels) ──
        var legendRow = figma.createFrame();
        legendRow.layoutMode = "HORIZONTAL"; legendRow.primaryAxisSizingMode = "AUTO"; legendRow.counterAxisSizingMode = "AUTO";
        legendRow.itemSpacing = 20; legendRow.fills = []; legendRow.layoutWrap = "WRAP";
        for (var lgi = 0; lgi < collectedParts.length && lgi < 8; lgi++) {
          var legendItem = figma.createFrame();
          legendItem.layoutMode = "HORIZONTAL"; legendItem.primaryAxisSizingMode = "AUTO"; legendItem.counterAxisSizingMode = "AUTO";
          legendItem.itemSpacing = 8; legendItem.fills = []; legendItem.counterAxisAlignItems = "CENTER";
          legendItem.appendChild(colorMarker(letters[lgi], markerColors[lgi % markerColors.length]));
          legendItem.appendChild(T(collectedParts[lgi].name + " (" + collectedParts[lgi].type + ")", fontMedium, 14, C.text));
          legendRow.appendChild(legendItem);
        }
        anatSection.appendChild(legendRow);

        // ── Parts table ──
        var partsTableRows = collectedParts.slice(0, 8).map(function(p, idx) {
          var desc = "";
          for (var ai2 = 0; ai2 < anatomyParts.length; ai2++) {
            if (anatomyParts[ai2].name === p.name) { desc = anatomyParts[ai2].description; break; }
          }
          return [letters[idx], p.type, p.name, desc || "Component element"];
        });
        var partsTable = makeTable([60, 120, 240, 620], ["#", "Type", "Element", "Description"], partsTableRows, []);
        anatSection.appendChild(partsTable);
        root.appendChild(anatSection);
        root.appendChild(divider());

        // ── [4b] STRUCTURE — Spacing, Padding, Radius annotations ──
        if (anatSource) {
          var structSection = figma.createFrame();
          structSection.layoutMode = "VERTICAL"; structSection.primaryAxisSizingMode = "AUTO"; structSection.counterAxisSizingMode = "AUTO";
          structSection.itemSpacing = 24; structSection.fills = [];
          structSection.appendChild(sectionTitle("Structure"));
          structSection.appendChild(T("Spacing, padding, corner radius, and dimensions.", fontRegular, 15, C.textMuted, W - 160));

          var structCard = figma.createFrame();
          structCard.name = "structure-diagram";
          structCard.fills = [{ type: "SOLID", color: C.cardBg }];
          structCard.cornerRadius = 12;
          structCard.clipsContent = false;

          var sInst;
          try { sInst = anatSource.createInstance(); } catch(e) { sInst = anatSource.clone(); }
          var sW = sInst.width; var sH = sInst.height;
          if (sW < 120 || sH < 30) { sInst.rescale(2); sW = sInst.width; sH = sInst.height; }

          var sPad = 120;
          var sCardW = W - 160;
          var sCardH = sH + sPad * 2 + 40;
          structCard.resize(sCardW, sCardH);
          var sInstX = (sCardW - sW) / 2;
          var sInstY = sPad;
          sInst.x = sInstX; sInst.y = sInstY;
          structCard.appendChild(sInst);

          // Read spacing data from the source component
          var cPadTop = anatSource.paddingTop || 0;
          var cPadRight = anatSource.paddingRight || 0;
          var cPadBottom = anatSource.paddingBottom || 0;
          var cPadLeft = anatSource.paddingLeft || 0;
          var cGap = anatSource.itemSpacing || 0;
          var cRadius = anatSource.cornerRadius || 0;
          if (typeof cRadius !== "number") cRadius = 0;
          var cLayoutMode = anatSource.layoutMode || "NONE";
          var dimColor = C.specRed;

          // ── Padding annotations (red dimension lines with value badges) ──

          // Top padding
          if (cPadTop > 0) {
            // Vertical line on left showing top padding
            var ptLine = figma.createFrame();
            ptLine.resize(1.5, Math.max(1, cPadTop * (sH > 10 ? 1 : 2)));
            ptLine.x = sInstX + 12; ptLine.y = sInstY + 2;
            ptLine.fills = [{ type: "SOLID", color: dimColor }];
            structCard.appendChild(ptLine);
            // Top padding area fill
            var ptFill = figma.createFrame();
            ptFill.resize(sW - 4, Math.max(2, cPadTop * (sH > 10 ? 1 : 2)));
            ptFill.x = sInstX + 2; ptFill.y = sInstY + 2;
            ptFill.fills = [{ type: "SOLID", color: dimColor }]; ptFill.opacity = 0.1;
            structCard.appendChild(ptFill);
            // Badge
            var ptBadge = specBadge(cPadTop + "px top", dimColor);
            ptBadge.x = sInstX + sW + 16; ptBadge.y = sInstY + 2;
            structCard.appendChild(ptBadge);
          }

          // Bottom padding
          if (cPadBottom > 0) {
            var pbLine = figma.createFrame();
            pbLine.resize(1.5, Math.max(1, cPadBottom * (sH > 10 ? 1 : 2)));
            pbLine.x = sInstX + 12; pbLine.y = sInstY + sH - cPadBottom * (sH > 10 ? 1 : 2) - 2;
            pbLine.fills = [{ type: "SOLID", color: dimColor }];
            structCard.appendChild(pbLine);
            var pbFill = figma.createFrame();
            pbFill.resize(sW - 4, Math.max(2, cPadBottom * (sH > 10 ? 1 : 2)));
            pbFill.x = sInstX + 2; pbFill.y = sInstY + sH - cPadBottom * (sH > 10 ? 1 : 2) - 2;
            pbFill.fills = [{ type: "SOLID", color: dimColor }]; pbFill.opacity = 0.1;
            structCard.appendChild(pbFill);
            var pbBadge = specBadge(cPadBottom + "px bottom", dimColor);
            pbBadge.x = sInstX + sW + 16; pbBadge.y = sInstY + sH - 24;
            structCard.appendChild(pbBadge);
          }

          // Left padding
          if (cPadLeft > 0) {
            var plFill = figma.createFrame();
            plFill.resize(Math.max(2, cPadLeft * (sW > 40 ? 1 : 2)), sH - 4);
            plFill.x = sInstX + 2; plFill.y = sInstY + 2;
            plFill.fills = [{ type: "SOLID", color: dimColor }]; plFill.opacity = 0.1;
            structCard.appendChild(plFill);
            var plBadge = specBadge(cPadLeft + "px", dimColor);
            plBadge.x = sInstX + 2; plBadge.y = sInstY + sH + 12;
            structCard.appendChild(plBadge);
          }

          // Right padding
          if (cPadRight > 0) {
            var prFill = figma.createFrame();
            prFill.resize(Math.max(2, cPadRight * (sW > 40 ? 1 : 2)), sH - 4);
            prFill.x = sInstX + sW - cPadRight * (sW > 40 ? 1 : 2) - 2; prFill.y = sInstY + 2;
            prFill.fills = [{ type: "SOLID", color: dimColor }]; prFill.opacity = 0.1;
            structCard.appendChild(prFill);
            var prBadge = specBadge(cPadRight + "px", dimColor);
            prBadge.x = sInstX + sW - 40; prBadge.y = sInstY + sH + 12;
            structCard.appendChild(prBadge);
          }

          // Gap / item spacing
          if (cGap > 0) {
            var gapBadge = specBadge("gap: " + cGap + "px", { r: 0.0, g: 0.47, b: 0.84 });
            gapBadge.x = sInstX + sW / 2 - 30; gapBadge.y = sInstY + sH + 12;
            structCard.appendChild(gapBadge);
          }

          // Corner radius
          if (cRadius > 0) {
            // Small arc indicator at top-left corner
            var crFrame = figma.createFrame();
            crFrame.resize(20, 20); crFrame.cornerRadius = 10;
            crFrame.fills = []; crFrame.strokes = [{ type: "SOLID", color: dimColor }]; crFrame.strokeWeight = 1.5;
            crFrame.x = sInstX - 24; crFrame.y = sInstY - 4;
            structCard.appendChild(crFrame);
            var crBadge = specBadge("r=" + cRadius + "px", dimColor);
            crBadge.x = sInstX - 28; crBadge.y = sInstY - 30;
            structCard.appendChild(crBadge);
          }

          // Overall width dimension line (above component)
          var wLine = figma.createFrame();
          wLine.resize(sW, 1.5);
          wLine.x = sInstX; wLine.y = sInstY - 20;
          wLine.fills = [{ type: "SOLID", color: C.textMuted }];
          structCard.appendChild(wLine);
          // Width endpoints
          var wEnd1 = figma.createFrame(); wEnd1.resize(1.5, 10);
          wEnd1.x = sInstX; wEnd1.y = sInstY - 25;
          wEnd1.fills = [{ type: "SOLID", color: C.textMuted }];
          structCard.appendChild(wEnd1);
          var wEnd2 = figma.createFrame(); wEnd2.resize(1.5, 10);
          wEnd2.x = sInstX + sW - 1.5; wEnd2.y = sInstY - 25;
          wEnd2.fills = [{ type: "SOLID", color: C.textMuted }];
          structCard.appendChild(wEnd2);
          var wBadge = specBadge(Math.round(sW) + "px", C.textMuted);
          wBadge.x = sInstX + sW / 2 - 20; wBadge.y = sInstY - 44;
          structCard.appendChild(wBadge);

          // Overall height dimension line (left of component)
          var hLine = figma.createFrame();
          hLine.resize(1.5, sH);
          hLine.x = sInstX - 40; hLine.y = sInstY;
          hLine.fills = [{ type: "SOLID", color: C.textMuted }];
          structCard.appendChild(hLine);
          var hEnd1 = figma.createFrame(); hEnd1.resize(10, 1.5);
          hEnd1.x = sInstX - 45; hEnd1.y = sInstY;
          hEnd1.fills = [{ type: "SOLID", color: C.textMuted }];
          structCard.appendChild(hEnd1);
          var hEnd2 = figma.createFrame(); hEnd2.resize(10, 1.5);
          hEnd2.x = sInstX - 45; hEnd2.y = sInstY + sH - 1.5;
          hEnd2.fills = [{ type: "SOLID", color: C.textMuted }];
          structCard.appendChild(hEnd2);
          var hBadge = specBadge(Math.round(sH) + "px", C.textMuted);
          hBadge.x = sInstX - 80; hBadge.y = sInstY + sH / 2 - 10;
          structCard.appendChild(hBadge);

          // Layout mode badge
          if (cLayoutMode !== "NONE") {
            var layoutBadge = specBadge("Auto Layout: " + cLayoutMode, { r: 0.58, g: 0.2, b: 0.78 });
            layoutBadge.x = sInstX; layoutBadge.y = sInstY - 68;
            structCard.appendChild(layoutBadge);
          }

          structSection.appendChild(structCard);

          // Structure summary table
          var structRows = [];
          structRows.push(["Padding", cPadTop + " / " + cPadRight + " / " + cPadBottom + " / " + cPadLeft + " px", "Top / Right / Bottom / Left"]);
          if (cGap > 0) structRows.push(["Gap (itemSpacing)", cGap + " px", "Space between child elements"]);
          if (cRadius > 0) structRows.push(["Corner Radius", cRadius + " px", "Rounded corners"]);
          structRows.push(["Dimensions", Math.round(sW / (sW < 120 ? 2 : 1)) + " \\u00d7 " + Math.round(sH / (sH < 30 ? 2 : 1)) + " px", "Width \\u00d7 Height (unscaled)"]);
          structRows.push(["Layout", cLayoutMode, "Auto layout direction"]);
          var structTable = makeTable([200, 200, 640], ["Property", "Value", "Description"], structRows, []);
          structSection.appendChild(structTable);

          root.appendChild(structSection);
          root.appendChild(divider());
        }
      }

      page.appendChild(root);
      return { pageId: page.id, rootId: root.id };
    })();
  `);

  if (!result1.success) {
    throw new Error(`figma_component_doc script 1 failed: ${result1.error}`);
  }
  const { pageId, rootId } = result1.result as { pageId: string; rootId: string };

  // ── SCRIPT 2: States + Size Variations + Usage + Tables ──
  const result2 = await bridge.execute(`
    (async () => {
      var fonts = [
        { family: "Inter", style: "Bold" },
        { family: "Inter", style: "Semi Bold" },
        { family: "Inter", style: "Medium" },
        { family: "Inter", style: "Regular" },
      ];
      for (var f of fonts) {
        try { await figma.loadFontAsync(f); } catch(e) {
          try { await figma.loadFontAsync({ family: "Roboto", style: f.style === "Semi Bold" ? "Medium" : f.style }); } catch(e2) {}
        }
      }

      var fontBold = { family: "Inter", style: "Bold" };
      var fontSemiBold = { family: "Inter", style: "Semi Bold" };
      var fontMedium = { family: "Inter", style: "Medium" };
      var fontRegular = { family: "Inter", style: "Regular" };

      var C = {
        bg: { r: 1, g: 1, b: 1 },
        cardBg: { r: 0.969, g: 0.969, b: 0.976 },
        text: { r: 0.13, g: 0.13, b: 0.13 },
        textMuted: { r: 0.35, g: 0.35, b: 0.4 },
        accent: { r: 0.75, g: 0.0, b: 0.45 },
        stroke: { r: 0.88, g: 0.88, b: 0.9 },
        green: { r: 0.13, g: 0.59, b: 0.33 },
        red: { r: 0.86, g: 0.15, b: 0.15 },
        marker: { r: 0.75, g: 0.0, b: 0.45 },
        badgeBg: { r: 0.2, g: 0.2, b: 0.22 },
        headerTint: { r: 0.95, g: 0.95, b: 0.96 },
        white: { r: 1, g: 1, b: 1 },
        specRed: { r: 0.85, g: 0.1, b: 0.3 },
      };

      var W = 1200;

      function T(chars, font, size, color, width) {
        var t = figma.createText();
        try { t.fontName = font; } catch(e) { t.fontName = { family: "Roboto", style: "Regular" }; }
        t.fontSize = size;
        t.lineHeight = { unit: "PIXELS", value: Math.round(size * 1.5) };
        t.characters = String(chars || "");
        t.fills = [{ type: "SOLID", color: color }];
        if (width) { t.resize(width, t.height); t.textAutoResize = "HEIGHT"; }
        else { t.textAutoResize = "WIDTH_AND_HEIGHT"; }
        return t;
      }

      function divider() {
        var d = figma.createFrame();
        d.resize(W - 80, 1);
        d.fills = [{ type: "SOLID", color: C.stroke }];
        d.layoutAlign = "STRETCH";
        return d;
      }

      function sectionTitle(title) { return T(title, fontBold, 28, C.text); }

      function specBadge(text, bgColor) {
        var b = figma.createFrame();
        b.layoutMode = "HORIZONTAL";
        b.primaryAxisSizingMode = "AUTO"; b.counterAxisSizingMode = "AUTO";
        b.paddingLeft = 8; b.paddingRight = 8; b.paddingTop = 3; b.paddingBottom = 3;
        b.cornerRadius = 4;
        b.fills = [{ type: "SOLID", color: bgColor || C.specRed }];
        b.appendChild(T(text, fontMedium, 11, C.white));
        return b;
      }

      function tokenBadge(text) {
        var b = figma.createFrame();
        b.layoutMode = "HORIZONTAL";
        b.primaryAxisSizingMode = "AUTO"; b.counterAxisSizingMode = "AUTO";
        b.paddingLeft = 10; b.paddingRight = 10; b.paddingTop = 5; b.paddingBottom = 5;
        b.cornerRadius = 4;
        b.fills = [{ type: "SOLID", color: C.badgeBg }];
        b.appendChild(T(text, fontMedium, 12, C.white));
        return b;
      }

      function tableCell(text, w, isHeader, hasToken) {
        var cell = figma.createFrame();
        cell.layoutMode = "HORIZONTAL";
        cell.primaryAxisSizingMode = "FIXED"; cell.counterAxisSizingMode = "AUTO";
        cell.primaryAxisAlignItems = "MIN"; cell.counterAxisAlignItems = "CENTER";
        cell.paddingTop = 14; cell.paddingBottom = 14; cell.paddingLeft = 16; cell.paddingRight = 16;
        cell.fills = [{ type: "SOLID", color: isHeader ? C.headerTint : C.white }];
        cell.resize(w, 10);
        cell.clipsContent = true;
        cell.strokes = [{ type: "SOLID", color: C.stroke }];
        cell.strokeBottomWeight = 1; cell.strokeTopWeight = 0; cell.strokeLeftWeight = 0; cell.strokeRightWeight = 0;
        if (hasToken && text && text !== "\\u2014") {
          var badge = tokenBadge(String(text).slice(0, 40));
          badge.layoutSizingHorizontal = "FILL";
          cell.appendChild(badge);
        } else {
          cell.appendChild(T(text || "\\u2014", isHeader ? fontSemiBold : fontRegular, isHeader ? 14 : 13, isHeader ? C.text : C.textMuted, w - 32));
        }
        return cell;
      }

      function makeTable(colWidths, headers, rows, tokenColIndices) {
        var totalW = 0;
        for (var cw = 0; cw < colWidths.length; cw++) totalW += colWidths[cw];
        var table = figma.createFrame();
        table.layoutMode = "VERTICAL"; table.primaryAxisSizingMode = "AUTO";
        table.counterAxisSizingMode = "FIXED"; table.resize(totalW, 10);
        table.fills = []; table.itemSpacing = 0;
        table.cornerRadius = 8; table.clipsContent = true;
        table.strokes = [{ type: "SOLID", color: C.stroke }]; table.strokeWeight = 1;
        function makeRow(cells, isHeader) {
          var row = figma.createFrame();
          row.layoutMode = "HORIZONTAL"; row.primaryAxisSizingMode = "FIXED"; row.counterAxisSizingMode = "AUTO";
          row.resize(totalW, 10);
          row.fills = []; row.itemSpacing = 0;
          for (var i = 0; i < colWidths.length; i++) {
            var isTokenCol = !isHeader && tokenColIndices && tokenColIndices.indexOf(i) >= 0;
            row.appendChild(tableCell(cells[i] || "", colWidths[i], isHeader, isTokenCol));
          }
          return row;
        }
        table.appendChild(makeRow(headers, true));
        for (var r of rows) { table.appendChild(makeRow(r, false)); }
        return table;
      }

      var root = await figma.getNodeByIdAsync("${rootId}");
      if (!root) throw new Error("Root frame not found");

      // Resolve compNode again
      var rawNode = await figma.getNodeByIdAsync("${escStr(nodeId)}");
      var compSet = null; var singleComp = null;
      if (rawNode) {
        if (rawNode.type === "INSTANCE") {
          var mainComp = await rawNode.getMainComponentAsync();
          if (mainComp && mainComp.parent && mainComp.parent.type === "COMPONENT_SET") compSet = mainComp.parent;
          else if (mainComp) singleComp = mainComp;
        } else if (rawNode.type === "COMPONENT_SET") { compSet = rawNode; }
        else if (rawNode.type === "COMPONENT") {
          if (rawNode.parent && rawNode.parent.type === "COMPONENT_SET") compSet = rawNode.parent;
          else singleComp = rawNode;
        } else { singleComp = rawNode; }
      }
      var compNode = compSet || singleComp || rawNode;

      // ── [5] STATES AND BEHAVIOUR ──
      var states = ${statesJson};
      if (states.length > 0 && compNode) {
        var statesSection = figma.createFrame();
        statesSection.layoutMode = "VERTICAL"; statesSection.primaryAxisSizingMode = "AUTO"; statesSection.counterAxisSizingMode = "AUTO";
        statesSection.itemSpacing = 24; statesSection.fills = [];
        statesSection.appendChild(sectionTitle("States and Behaviour"));
        statesSection.appendChild(T("How the component appears in each interactive state.", fontRegular, 15, C.textMuted, W - 160));

        // Find state axis and ALL non-state axes
        var stateAxisName = null;
        var variants = ${variantsJson};
        if (compSet && compSet.variantGroupProperties) {
          for (var propName in compSet.variantGroupProperties) {
            if (/state|status|interaction/i.test(propName)) { stateAxisName = propName; break; }
          }
        }

        // Collect ALL non-state variant axes to show rows for each combination
        var groupAxes = [];
        for (var vi = 0; vi < variants.length; vi++) {
          var vProp = variants[vi].property;
          if (vProp !== stateAxisName && !/state|status|interaction/i.test(vProp)) {
            groupAxes.push(variants[vi]);
          }
        }

        // Column header row (state names)
        var headerRow = figma.createFrame();
        headerRow.layoutMode = "HORIZONTAL"; headerRow.primaryAxisSizingMode = "AUTO"; headerRow.counterAxisSizingMode = "AUTO";
        headerRow.itemSpacing = 20; headerRow.fills = [];
        headerRow.paddingLeft = 140;
        for (var sh = 0; sh < states.length; sh++) {
          var shFrame = figma.createFrame();
          shFrame.layoutMode = "VERTICAL"; shFrame.primaryAxisSizingMode = "AUTO"; shFrame.counterAxisSizingMode = "AUTO";
          shFrame.fills = []; shFrame.resize(100, 10); shFrame.counterAxisAlignItems = "CENTER";
          shFrame.appendChild(T(states[sh], fontSemiBold, 13, C.text));
          headerRow.appendChild(shFrame);
        }
        statesSection.appendChild(headerRow);

        if (compSet && stateAxisName) {
          // Build combinations of all non-state axes
          var combos = [{}];
          for (var ga = 0; ga < groupAxes.length && ga < 2; ga++) {
            var newCombos = [];
            var axValues = groupAxes[ga].values.slice(0, 6);
            for (var ci2 = 0; ci2 < combos.length; ci2++) {
              for (var avi = 0; avi < axValues.length; avi++) {
                var c = {};
                for (var k in combos[ci2]) c[k] = combos[ci2][k];
                c[groupAxes[ga].property] = axValues[avi];
                newCombos.push(c);
              }
            }
            combos = newCombos;
          }
          if (combos.length === 0 || (combos.length === 1 && Object.keys(combos[0]).length === 0)) {
            combos = [{}];
          }

          // Create one row per combination
          for (var ci3 = 0; ci3 < combos.length && ci3 < 12; ci3++) {
            var combo = combos[ci3];
            var rowFrame = figma.createFrame();
            rowFrame.layoutMode = "HORIZONTAL"; rowFrame.primaryAxisSizingMode = "AUTO"; rowFrame.counterAxisSizingMode = "AUTO";
            rowFrame.itemSpacing = 20; rowFrame.fills = [];
            rowFrame.paddingTop = 12; rowFrame.paddingBottom = 12;
            rowFrame.counterAxisAlignItems = "CENTER";

            // Row label (variant combination name)
            var rowLabel = Object.values(combo).join(" / ") || "Default";
            var labelFrame = figma.createFrame();
            labelFrame.layoutMode = "VERTICAL"; labelFrame.primaryAxisSizingMode = "FIXED"; labelFrame.counterAxisSizingMode = "AUTO";
            labelFrame.resize(120, 10); labelFrame.fills = [];
            labelFrame.appendChild(T(rowLabel, fontMedium, 13, C.accent));
            rowFrame.appendChild(labelFrame);

            for (var si = 0; si < states.length; si++) {
              var stateCol = figma.createFrame();
              stateCol.layoutMode = "VERTICAL"; stateCol.primaryAxisSizingMode = "AUTO"; stateCol.counterAxisSizingMode = "AUTO";
              stateCol.itemSpacing = 6; stateCol.fills = []; stateCol.counterAxisAlignItems = "CENTER";
              stateCol.resize(100, 10);

              var found = false;
              for (var sc of compSet.children) {
                if (!sc.variantProperties) continue;
                var matchState = sc.variantProperties[stateAxisName] && sc.variantProperties[stateAxisName].toLowerCase() === states[si].toLowerCase();
                if (!matchState) continue;
                var matchCombo = true;
                for (var ck in combo) {
                  if (!sc.variantProperties[ck] || sc.variantProperties[ck].toLowerCase() !== combo[ck].toLowerCase()) {
                    matchCombo = false; break;
                  }
                }
                if (matchState && matchCombo) {
                  try { stateCol.appendChild(sc.createInstance()); found = true; } catch(e) {}
                  break;
                }
              }
              if (!found) {
                // Fallback: find any variant matching just the state
                for (var sc2 of compSet.children) {
                  if (!sc2.variantProperties) continue;
                  if (sc2.variantProperties[stateAxisName] && sc2.variantProperties[stateAxisName].toLowerCase() === states[si].toLowerCase()) {
                    try { stateCol.appendChild(sc2.createInstance()); found = true; } catch(e) {}
                    break;
                  }
                }
              }
              if (!found) {
                try { stateCol.appendChild(compSet.children[0].createInstance()); } catch(e) {}
              }
              rowFrame.appendChild(stateCol);
            }
            statesSection.appendChild(rowFrame);

            // Thin separator between rows
            if (ci3 < combos.length - 1) {
              var sepLine = figma.createFrame();
              sepLine.resize(W - 200, 1);
              sepLine.fills = [{ type: "SOLID", color: C.stroke }]; sepLine.opacity = 0.5;
              statesSection.appendChild(sepLine);
            }
          }
        } else {
          // No state axis — show generic states row
          var genRow = figma.createFrame();
          genRow.layoutMode = "HORIZONTAL"; genRow.primaryAxisSizingMode = "AUTO"; genRow.counterAxisSizingMode = "AUTO";
          genRow.itemSpacing = 20; genRow.fills = []; genRow.counterAxisAlignItems = "CENTER";
          genRow.paddingLeft = 140;
          for (var si2 = 0; si2 < states.length; si2++) {
            var stCol2 = figma.createFrame();
            stCol2.layoutMode = "VERTICAL"; stCol2.primaryAxisSizingMode = "AUTO"; stCol2.counterAxisSizingMode = "AUTO";
            stCol2.itemSpacing = 6; stCol2.fills = []; stCol2.counterAxisAlignItems = "CENTER";
            stCol2.resize(100, 10);
            if (compSet && compSet.children[0]) {
              try { stCol2.appendChild(compSet.children[0].createInstance()); } catch(e) {}
            } else if (singleComp) {
              try { stCol2.appendChild(singleComp.createInstance()); } catch(e) {}
            }
            genRow.appendChild(stCol2);
          }
          statesSection.appendChild(genRow);
        }
        root.appendChild(statesSection);
        root.appendChild(divider());
      }

      // ── [6] SPECS — Size variations with measurement annotations ──
      var sizeAxis = null;
      for (var v of variants) {
        if (/size|scale|density/i.test(v.property)) { sizeAxis = v; break; }
      }
      if (sizeAxis && compSet) {
        var specsSection = figma.createFrame();
        specsSection.layoutMode = "VERTICAL"; specsSection.primaryAxisSizingMode = "AUTO"; specsSection.counterAxisSizingMode = "AUTO";
        specsSection.itemSpacing = 24; specsSection.fills = [];
        specsSection.appendChild(sectionTitle("Specs"));

        var specsGrid = figma.createFrame();
        specsGrid.layoutMode = "HORIZONTAL"; specsGrid.primaryAxisSizingMode = "AUTO"; specsGrid.counterAxisSizingMode = "AUTO";
        specsGrid.itemSpacing = 48; specsGrid.fills = [];
        specsGrid.counterAxisAlignItems = "MIN";

        for (var sv of sizeAxis.values.slice(0, 4)) {
          var specCol = figma.createFrame();
          specCol.layoutMode = "VERTICAL"; specCol.primaryAxisSizingMode = "AUTO"; specCol.counterAxisSizingMode = "AUTO";
          specCol.itemSpacing = 12; specCol.fills = []; specCol.counterAxisAlignItems = "CENTER";

          // Find variant matching this size
          for (var sch of compSet.children) {
            if (sch.variantProperties && sch.variantProperties[sizeAxis.property] &&
                sch.variantProperties[sizeAxis.property].toLowerCase() === sv.toLowerCase()) {
              // Container with measurement annotations
              var measContainer = figma.createFrame();
              measContainer.fills = []; measContainer.clipsContent = false;

              var sInst = sch.createInstance();
              var sW = sInst.width; var sH = sInst.height;
              measContainer.resize(sW + 100, sH + 80);
              sInst.x = 50; sInst.y = 20;
              measContainer.appendChild(sInst);

              // Min-width badge on top
              var minBadge = specBadge("min-width: " + Math.round(sW) + "px", C.specRed);
              minBadge.x = sInst.x; minBadge.y = 0;
              measContainer.appendChild(minBadge);

              // Height badge on right
              var hBadge = specBadge(Math.round(sH) + "", C.specRed);
              hBadge.x = sInst.x + sW + 6;
              hBadge.y = sInst.y + sH / 2 - 10;
              measContainer.appendChild(hBadge);

              // Padding badges
              if (sch.paddingLeft > 0) {
                var plBadge = specBadge(String(Math.round(sch.paddingLeft)), C.specRed);
                plBadge.x = sInst.x - 4;
                plBadge.y = sInst.y + sH + 4;
                measContainer.appendChild(plBadge);
              }
              if (sch.paddingRight > 0) {
                var prBadge = specBadge(String(Math.round(sch.paddingRight)), C.specRed);
                prBadge.x = sInst.x + sW - 24;
                prBadge.y = sInst.y + sH + 4;
                measContainer.appendChild(prBadge);
              }
              if (sch.itemSpacing > 0) {
                var gapBadge = specBadge(String(Math.round(sch.itemSpacing)), C.specRed);
                gapBadge.x = sInst.x + sW / 2 - 10;
                gapBadge.y = sInst.y + sH + 4;
                measContainer.appendChild(gapBadge);
              }

              specCol.appendChild(measContainer);
              break;
            }
          }
          specCol.appendChild(T(sv, fontMedium, 14, C.textMuted));
          specsGrid.appendChild(specCol);
        }
        specsSection.appendChild(specsGrid);
        root.appendChild(specsSection);
        root.appendChild(divider());
      }

      // ── [7] USAGE — Do's and Don'ts ──
      var dos = ${dosJson};
      var donts = ${dontsJson};
      var usageSection = figma.createFrame();
      usageSection.layoutMode = "VERTICAL"; usageSection.primaryAxisSizingMode = "AUTO"; usageSection.counterAxisSizingMode = "AUTO";
      usageSection.itemSpacing = 24; usageSection.fills = [];
      usageSection.appendChild(sectionTitle("Usage"));

      var usageRow = figma.createFrame();
      usageRow.layoutMode = "HORIZONTAL"; usageRow.primaryAxisSizingMode = "AUTO"; usageRow.counterAxisSizingMode = "AUTO";
      usageRow.itemSpacing = 32; usageRow.fills = [];

      var halfW = (W - 180) / 2;
      var doCard = figma.createFrame();
      doCard.layoutMode = "VERTICAL"; doCard.primaryAxisSizingMode = "AUTO"; doCard.counterAxisSizingMode = "FIXED";
      doCard.resize(halfW, 10);
      doCard.itemSpacing = 12; doCard.paddingTop = 24; doCard.paddingBottom = 24; doCard.paddingLeft = 24; doCard.paddingRight = 24;
      doCard.fills = [{ type: "SOLID", color: C.cardBg }]; doCard.cornerRadius = 8;
      doCard.strokes = [{ type: "SOLID", color: C.green }];
      doCard.strokeLeftWeight = 4; doCard.strokeTopWeight = 0; doCard.strokeRightWeight = 0; doCard.strokeBottomWeight = 0;
      doCard.appendChild(T("Do's", fontSemiBold, 18, C.green));
      for (var di of dos) { doCard.appendChild(T("\\u2713  " + di, fontRegular, 14, C.textMuted, halfW - 60)); }
      usageRow.appendChild(doCard);

      var dontCard = figma.createFrame();
      dontCard.layoutMode = "VERTICAL"; dontCard.primaryAxisSizingMode = "AUTO"; dontCard.counterAxisSizingMode = "FIXED";
      dontCard.resize(halfW, 10);
      dontCard.itemSpacing = 12; dontCard.paddingTop = 24; dontCard.paddingBottom = 24; dontCard.paddingLeft = 24; dontCard.paddingRight = 24;
      dontCard.fills = [{ type: "SOLID", color: C.cardBg }]; dontCard.cornerRadius = 8;
      dontCard.strokes = [{ type: "SOLID", color: C.red }];
      dontCard.strokeLeftWeight = 4; dontCard.strokeTopWeight = 0; dontCard.strokeRightWeight = 0; dontCard.strokeBottomWeight = 0;
      dontCard.appendChild(T("Don'ts", fontSemiBold, 18, C.red));
      for (var dni of donts) { dontCard.appendChild(T("\\u2717  " + dni, fontRegular, 14, C.textMuted, halfW - 60)); }
      usageRow.appendChild(dontCard);

      usageSection.appendChild(usageRow);
      root.appendChild(usageSection);
      root.appendChild(divider());

      // ── [8] COLOR TOKEN TABLE ──
      var colorTokens = ${colorTokensJson};
      if (colorTokens.length > 0) {
        var colorSection = figma.createFrame();
        colorSection.layoutMode = "VERTICAL"; colorSection.primaryAxisSizingMode = "AUTO"; colorSection.counterAxisSizingMode = "AUTO";
        colorSection.itemSpacing = 20; colorSection.fills = [];
        colorSection.appendChild(sectionTitle("Color Tokens"));
        var cRows = colorTokens.map(function(ct) { return [ct.element, ct.property, ct.colorHex, ct.tokenName || "\\u2014"]; });
        colorSection.appendChild(makeTable([260, 200, 200, 340], ["Element", "Property", "Color", "Token"], cRows, [3]));
        root.appendChild(colorSection);
        root.appendChild(divider());
      }

      // ── [9] SPACING TABLE ──
      var spacingData = ${spacingJson};
      if (spacingData.length > 0) {
        var spacingSection = figma.createFrame();
        spacingSection.layoutMode = "VERTICAL"; spacingSection.primaryAxisSizingMode = "AUTO"; spacingSection.counterAxisSizingMode = "AUTO";
        spacingSection.itemSpacing = 20; spacingSection.fills = [];
        spacingSection.appendChild(sectionTitle("Spacing & Structure"));
        var sRows = spacingData.map(function(sp) {
          return [sp.element, sp.layoutMode,
            sp.paddingTop + "/" + sp.paddingRight + "/" + sp.paddingBottom + "/" + sp.paddingLeft,
            String(sp.itemSpacing), sp.width + "\\u00d7" + sp.height,
            "H:" + sp.layoutSizingH + " V:" + sp.layoutSizingV];
        });
        spacingSection.appendChild(makeTable([220, 140, 220, 90, 160, 200], ["Element", "Layout", "Padding (T/R/B/L)", "Gap", "Size", "Sizing"], sRows, []));
        root.appendChild(spacingSection);
        root.appendChild(divider());
      }

      // ── [10] TYPOGRAPHY TABLE ──
      var typoData = ${typographyJson};
      if (typoData.length > 0) {
        var typoSection = figma.createFrame();
        typoSection.layoutMode = "VERTICAL"; typoSection.primaryAxisSizingMode = "AUTO"; typoSection.counterAxisSizingMode = "AUTO";
        typoSection.itemSpacing = 20; typoSection.fills = [];
        typoSection.appendChild(sectionTitle("Typography"));
        var tRows = typoData.map(function(tp) {
          return [tp.element, tp.fontFamily, tp.fontSize + "px", tp.fontStyle,
            tp.lineHeightPx ? tp.lineHeightPx + "px" : "auto", tp.tokenName || "\\u2014"];
        });
        typoSection.appendChild(makeTable([220, 180, 100, 120, 140, 280], ["Element", "Font", "Size", "Weight", "Line Height", "Token"], tRows, [5]));
        root.appendChild(typoSection);
        root.appendChild(divider());
      }

      // ── [11] ACCESSIBILITY ──
      var a11yData = ${a11yJson};
      if (a11yData.length > 0) {
        var a11ySection = figma.createFrame();
        a11ySection.layoutMode = "VERTICAL"; a11ySection.primaryAxisSizingMode = "AUTO"; a11ySection.counterAxisSizingMode = "AUTO";
        a11ySection.itemSpacing = 20; a11ySection.fills = [];
        a11ySection.appendChild(sectionTitle("Accessibility"));
        for (var a11ySec of a11yData) {
          a11ySection.appendChild(T(a11ySec.title, fontSemiBold, 18, C.text));
          var bulletFrame = figma.createFrame();
          bulletFrame.layoutMode = "VERTICAL"; bulletFrame.primaryAxisSizingMode = "AUTO"; bulletFrame.counterAxisSizingMode = "AUTO";
          bulletFrame.itemSpacing = 6; bulletFrame.fills = [];
          for (var ai = 0; ai < Math.min(a11ySec.items.length, 8); ai++) {
            bulletFrame.appendChild(T("\\u2022  " + a11ySec.items[ai], fontRegular, 14, C.textMuted, W - 160));
          }
          a11ySection.appendChild(bulletFrame);
        }
        root.appendChild(a11ySection);
        root.appendChild(divider());
      }

      // ── [12] PROPS / API TABLE ──
      var propsData = ${propsJson};
      if (propsData.length > 0) {
        var propsSection = figma.createFrame();
        propsSection.layoutMode = "VERTICAL"; propsSection.primaryAxisSizingMode = "AUTO"; propsSection.counterAxisSizingMode = "AUTO";
        propsSection.itemSpacing = 20; propsSection.fills = [];
        propsSection.appendChild(sectionTitle("API / Props"));
        var pRows = propsData.map(function(pp) { return [pp.name, pp.type, pp.values.join(", "), pp.defaultValue, pp.description]; });
        propsSection.appendChild(makeTable([180, 120, 280, 140, 320], ["Name", "Type", "Values", "Default", "Description"], pRows, []));
        root.appendChild(propsSection);
      }

      figma.viewport.scrollAndZoomIntoView([root]);
      return "ok";
    })();
  `);

  if (!result2.success) {
    throw new Error(`figma_component_doc script 2 failed: ${result2.error}`);
  }

  // ── SCRIPT 3: Purpose + Behaviour + Interaction + Content + Responsive + Implementation + QA ──
  const purposeStr = escStr((spec.purpose || "").slice(0, 3000));
  const behaviourStr = escStr((spec.behaviour || "").slice(0, 3000));
  const interactionStr = escStr((spec.interactionRules || "").slice(0, 3000));
  const contentGuideStr = escStr((spec.contentGuidance || "").slice(0, 3000));
  const responsiveStr = escStr((spec.responsive || "").slice(0, 3000));
  const implNotesStr = escStr((spec.implementationNotes || "").slice(0, 3000));
  const sizesJson = JSON.stringify(spec.sizes?.slice(0, 8) || []);
  const qaChecklistJson = JSON.stringify(spec.qaChecklist?.slice(0, 20) || []);

  const hasScript3Content = spec.purpose || spec.behaviour || spec.interactionRules ||
    spec.contentGuidance || spec.responsive || spec.implementationNotes ||
    (spec.sizes?.length ?? 0) > 0 || (spec.qaChecklist?.length ?? 0) > 0;

  if (hasScript3Content) {
    const result3 = await bridge.execute(`
      (async () => {
        var fonts = [
          { family: "Inter", style: "Bold" },
          { family: "Inter", style: "Semi Bold" },
          { family: "Inter", style: "Medium" },
          { family: "Inter", style: "Regular" },
        ];
        for (var f of fonts) {
          try { await figma.loadFontAsync(f); } catch(e) {
            try { await figma.loadFontAsync({ family: "Roboto", style: f.style === "Semi Bold" ? "Medium" : f.style }); } catch(e2) {}
          }
        }

        var fontBold = { family: "Inter", style: "Bold" };
        var fontSemiBold = { family: "Inter", style: "Semi Bold" };
        var fontMedium = { family: "Inter", style: "Medium" };
        var fontRegular = { family: "Inter", style: "Regular" };

        var C = {
          bg: { r: 1, g: 1, b: 1 },
          cardBg: { r: 0.969, g: 0.969, b: 0.976 },
          text: { r: 0.13, g: 0.13, b: 0.13 },
          textMuted: { r: 0.35, g: 0.35, b: 0.4 },
          accent: { r: 0.75, g: 0.0, b: 0.45 },
          stroke: { r: 0.88, g: 0.88, b: 0.9 },
          green: { r: 0.13, g: 0.59, b: 0.33 },
          white: { r: 1, g: 1, b: 1 },
          badgeBg: { r: 0.2, g: 0.2, b: 0.22 },
          headerTint: { r: 0.95, g: 0.95, b: 0.96 },
          codeBg: { r: 0.12, g: 0.12, b: 0.14 },
          checkGreen: { r: 0.18, g: 0.65, b: 0.35 },
        };

        var W = 1200;

        function T(chars, font, size, color, width) {
          var t = figma.createText();
          try { t.fontName = font; } catch(e) { t.fontName = { family: "Roboto", style: "Regular" }; }
          t.fontSize = size;
          t.lineHeight = { unit: "PIXELS", value: Math.round(size * 1.5) };
          t.characters = String(chars || "");
          t.fills = [{ type: "SOLID", color: color }];
          if (width) { t.resize(width, t.height); t.textAutoResize = "HEIGHT"; }
          else { t.textAutoResize = "WIDTH_AND_HEIGHT"; }
          return t;
        }

        function divider() {
          var d = figma.createFrame();
          d.resize(W - 80, 1);
          d.fills = [{ type: "SOLID", color: C.stroke }];
          d.layoutAlign = "STRETCH";
          return d;
        }

        function sectionTitle(title) { return T(title, fontBold, 28, C.text); }

        function tokenBadge(text) {
          var b = figma.createFrame();
          b.layoutMode = "HORIZONTAL";
          b.primaryAxisSizingMode = "AUTO"; b.counterAxisSizingMode = "AUTO";
          b.paddingLeft = 10; b.paddingRight = 10; b.paddingTop = 5; b.paddingBottom = 5;
          b.cornerRadius = 4;
          b.fills = [{ type: "SOLID", color: C.badgeBg }];
          b.appendChild(T(text, fontMedium, 12, C.white));
          return b;
        }

        function tableCell(text, w, isHeader, hasToken) {
          var cell = figma.createFrame();
          cell.layoutMode = "HORIZONTAL";
          cell.primaryAxisSizingMode = "FIXED"; cell.counterAxisSizingMode = "AUTO";
          cell.primaryAxisAlignItems = "MIN"; cell.counterAxisAlignItems = "CENTER";
          cell.paddingTop = 14; cell.paddingBottom = 14; cell.paddingLeft = 16; cell.paddingRight = 16;
          cell.fills = [{ type: "SOLID", color: isHeader ? C.headerTint : C.bg }];
          cell.resize(w, 10);
          cell.clipsContent = true;
          cell.strokes = [{ type: "SOLID", color: C.stroke }];
          cell.strokeBottomWeight = 1; cell.strokeTopWeight = 0; cell.strokeLeftWeight = 0; cell.strokeRightWeight = 0;
          if (hasToken && text && text !== "\\u2014") {
            var badge = tokenBadge(String(text).slice(0, 40));
            badge.layoutSizingHorizontal = "FILL";
            cell.appendChild(badge);
          } else {
            cell.appendChild(T(text || "\\u2014", isHeader ? fontSemiBold : fontRegular, isHeader ? 14 : 13, isHeader ? C.text : C.textMuted, w - 32));
          }
          return cell;
        }

        function makeTable(colWidths, headers, rows, tokenColIndices) {
          var totalW = 0;
          for (var cw = 0; cw < colWidths.length; cw++) totalW += colWidths[cw];
          var table = figma.createFrame();
          table.layoutMode = "VERTICAL"; table.primaryAxisSizingMode = "AUTO";
          table.counterAxisSizingMode = "FIXED"; table.resize(totalW, 10);
          table.fills = []; table.itemSpacing = 0;
          table.cornerRadius = 8; table.clipsContent = true;
          table.strokes = [{ type: "SOLID", color: C.stroke }]; table.strokeWeight = 1;
          function makeRow(cells, isHeader) {
            var row = figma.createFrame();
            row.layoutMode = "HORIZONTAL"; row.primaryAxisSizingMode = "FIXED"; row.counterAxisSizingMode = "AUTO";
            row.resize(totalW, 10);
            row.fills = []; row.itemSpacing = 0;
            for (var i = 0; i < colWidths.length; i++) {
              var isTokenCol = !isHeader && tokenColIndices && tokenColIndices.indexOf(i) >= 0;
              row.appendChild(tableCell(cells[i] || "", colWidths[i], isHeader, isTokenCol));
            }
            return row;
          }
          table.appendChild(makeRow(headers, true));
          for (var r of rows) { table.appendChild(makeRow(r, false)); }
          return table;
        }

        function makeCard(title, body, bgColor) {
          var card = figma.createFrame();
          card.layoutMode = "VERTICAL"; card.primaryAxisSizingMode = "AUTO"; card.counterAxisSizingMode = "AUTO";
          card.itemSpacing = 12;
          card.paddingTop = 24; card.paddingBottom = 24; card.paddingLeft = 28; card.paddingRight = 28;
          card.fills = [{ type: "SOLID", color: bgColor || C.cardBg }];
          card.cornerRadius = 8;
          if (title) card.appendChild(T(title, fontSemiBold, 18, C.text));
          card.appendChild(T(body, fontRegular, 14, C.textMuted, W - 220));
          return card;
        }

        var root = await figma.getNodeByIdAsync("${rootId}");
        if (!root) throw new Error("Root frame not found for script 3");

        // ── [13] PURPOSE ──
        var purposeText = "${purposeStr}";
        if (purposeText) {
          var purposeSection = figma.createFrame();
          purposeSection.layoutMode = "VERTICAL"; purposeSection.primaryAxisSizingMode = "AUTO"; purposeSection.counterAxisSizingMode = "AUTO";
          purposeSection.itemSpacing = 16; purposeSection.fills = [];
          purposeSection.appendChild(sectionTitle("Purpose"));
          purposeSection.appendChild(T(purposeText, fontRegular, 15, C.textMuted, W - 160));
          root.appendChild(purposeSection);
          root.appendChild(divider());
        }

        // ── [14] SIZES TABLE ──
        var sizesData = ${sizesJson};
        if (sizesData.length > 0) {
          var sizesSection = figma.createFrame();
          sizesSection.layoutMode = "VERTICAL"; sizesSection.primaryAxisSizingMode = "AUTO"; sizesSection.counterAxisSizingMode = "AUTO";
          sizesSection.itemSpacing = 20; sizesSection.fills = [];
          sizesSection.appendChild(sectionTitle("Sizes"));
          var sRows = sizesData.map(function(s) { return [s.name, s.useCase, s.minTouchTarget, s.context]; });
          sizesSection.appendChild(makeTable([160, 320, 220, 340], ["Size", "Use Case", "Min Touch Target", "Context"], sRows, []));
          root.appendChild(sizesSection);
          root.appendChild(divider());
        }

        // ── [15] BEHAVIOUR ──
        var behaviourText = "${behaviourStr}";
        if (behaviourText) {
          root.appendChild(makeCard("Behaviour", behaviourText, C.cardBg));
          root.appendChild(divider());
        }

        // ── [16] INTERACTION RULES ──
        var interactionText = "${interactionStr}";
        if (interactionText) {
          root.appendChild(makeCard("Interaction Rules", interactionText, C.cardBg));
          root.appendChild(divider());
        }

        // ── [17] CONTENT GUIDANCE ──
        var contentGuideText = "${contentGuideStr}";
        if (contentGuideText) {
          root.appendChild(makeCard("Content Guidance", contentGuideText, C.cardBg));
          root.appendChild(divider());
        }

        // ── [18] RESPONSIVE ──
        var responsiveText = "${responsiveStr}";
        if (responsiveText) {
          root.appendChild(makeCard("Responsive Behaviour", responsiveText, C.cardBg));
          root.appendChild(divider());
        }

        // ── [19] IMPLEMENTATION NOTES ──
        var implText = "${implNotesStr}";
        if (implText) {
          var implCard = figma.createFrame();
          implCard.layoutMode = "VERTICAL"; implCard.primaryAxisSizingMode = "AUTO"; implCard.counterAxisSizingMode = "AUTO";
          implCard.itemSpacing = 12;
          implCard.paddingTop = 24; implCard.paddingBottom = 24; implCard.paddingLeft = 28; implCard.paddingRight = 28;
          implCard.fills = [{ type: "SOLID", color: C.codeBg }];
          implCard.cornerRadius = 8;
          implCard.appendChild(T("Implementation Notes", fontSemiBold, 18, C.white));
          implCard.appendChild(T(implText, fontRegular, 14, { r: 0.75, g: 0.75, b: 0.78 }, W - 220));
          root.appendChild(implCard);
          root.appendChild(divider());
        }

        // ── [20] QA CHECKLIST ──
        var qaItems = ${qaChecklistJson};
        if (qaItems.length > 0) {
          var qaSection = figma.createFrame();
          qaSection.layoutMode = "VERTICAL"; qaSection.primaryAxisSizingMode = "AUTO"; qaSection.counterAxisSizingMode = "AUTO";
          qaSection.itemSpacing = 16; qaSection.fills = [];
          qaSection.appendChild(sectionTitle("QA Checklist"));
          for (var qi = 0; qi < qaItems.length; qi++) {
            var checkRow = figma.createFrame();
            checkRow.layoutMode = "HORIZONTAL"; checkRow.primaryAxisSizingMode = "AUTO"; checkRow.counterAxisSizingMode = "AUTO";
            checkRow.itemSpacing = 10; checkRow.fills = [];
            checkRow.counterAxisAlignItems = "CENTER";
            // Checkbox square
            var cb = figma.createFrame();
            cb.resize(18, 18); cb.cornerRadius = 3;
            cb.fills = []; cb.strokes = [{ type: "SOLID", color: C.stroke }]; cb.strokeWeight = 2;
            checkRow.appendChild(cb);
            checkRow.appendChild(T(qaItems[qi], fontRegular, 14, C.textMuted, W - 200));
            qaSection.appendChild(checkRow);
          }
          root.appendChild(qaSection);
        }

        figma.viewport.scrollAndZoomIntoView([root]);
        return "ok";
      })();
    `);

    if (!result3.success) {
      throw new Error(`figma_component_doc script 3 failed: ${result3.error}`);
    }
  }

  return pageId;
}

// ─── Main handler ───────────────────────────────────────────────────────────

export async function componentDocHandler(args: ComponentDocArgs): Promise<ComponentDocResult> {
  // 1. Resolve target node
  const nodeId = await resolveTargetNodeId({ nodeId: args.nodeId, outputFormat: args.outputFormat });

  // 2. Capture snapshot (reuse existing deep scanner)
  const snapshot = await captureSnapshot(nodeId);

  // 3. Extract deep data in parallel
  const [spacing, colorTokens, typography] = await Promise.all([
    captureSpacingStructure(nodeId),
    captureColorTokenMap(nodeId),
    captureTypographySpec(nodeId),
  ]);

  // 4. Build accessibility sections via APG doc if the component looks interactive
  let accessibilitySections: GeneratedDocumentSection[] = [];
  const isInteractive = /button|btn|input|field|toggle|switch|checkbox|radio|tab|link|menu|dialog|modal|combobox|select|slider|accordion/i.test(snapshot.name);
  if (isInteractive) {
    try {
      const apgResult = await figmaApgDocHandler({
        nodeId,
        outputFormat: "json",
        framework: args.framework,
      });
      if (apgResult.document?.sections) {
        accessibilitySections = apgResult.document.sections;
      }
    } catch {
      // APG doc is optional; fall back to empty
    }
  }

  // 5. Assemble the full design system spec
  const spec: DesignSystemSpec = {
    componentName: snapshot.name,
    nodeId: snapshot.id,
    nodeType: snapshot.type,
    overview: buildOverview(snapshot),
    purpose: buildPurpose(snapshot),
    anatomy: buildAnatomy(snapshot),
    variants: buildVariants(snapshot),
    states: inferStatesFromSnapshot(snapshot),
    sizes: buildSizes(snapshot),
    spacing,
    colorTokens,
    typography,
    usageGuidelines: buildUsageGuidelines(snapshot),
    behaviour: buildBehaviour(snapshot),
    interactionRules: buildInteractionRules(snapshot),
    contentGuidance: buildContentGuidance(snapshot),
    responsive: buildResponsive(snapshot),
    accessibility: accessibilitySections,
    implementationNotes: buildImplementationNotes(snapshot),
    qaChecklist: buildQaChecklist(snapshot),
    props: buildPropsTable(snapshot),
  };

  // 6. Apply content overrides from AI-enhanced phase 2
  if (args.contentOverrides) {
    const co = args.contentOverrides;
    if (co.overview) spec.overview.description = co.overview;
    if (co.purpose) spec.purpose = co.purpose;
    if (co.usage) {
      spec.overview.whenToUse = co.usage.whenToUse;
      spec.overview.whenNotToUse = co.usage.whenNotToUse;
    }
    if (co.anatomy) spec.anatomy = co.anatomy;
    if (co.properties) spec.props = co.properties;
    if (co.states) spec.states = co.states.map((s) => s.name);
    if (co.sizes) spec.sizes = co.sizes;
    if (co.dosAndDonts) spec.usageGuidelines = co.dosAndDonts;
    if (co.behaviour) spec.behaviour = co.behaviour;
    if (co.interactionRules) spec.interactionRules = co.interactionRules;
    if (co.contentGuidance) spec.contentGuidance = co.contentGuidance;
    if (co.responsive) spec.responsive = co.responsive;
    if (co.implementationNotes) spec.implementationNotes = co.implementationNotes;
    if (co.qaChecklist) spec.qaChecklist = co.qaChecklist;
    if (co.accessibility) {
      spec.accessibility = convertAccessibilityOverrides(co.accessibility);
    }
  }

  // 7. Generate report
  const report = formatSpecAsReport(spec);

  // 8. Create Figma documentation page if requested
  let figmaPageId: string | undefined;
  if (args.outputFormat === "figma-page" || args.outputFormat === "all") {
    const pageName = args.pageName || `${spec.componentName} Documentation`;
    figmaPageId = await createVisualDocPage(spec, nodeId, pageName);
  }

  // 9. Log to decision log
  const logEntry = await decisionLog.log({
    tool: "figma_component_doc",
    nodeIds: figmaPageId ? [snapshot.id, figmaPageId] : [snapshot.id],
    rationale: `Generated comprehensive design system documentation for ${snapshot.name}. Sections: overview, anatomy (${spec.anatomy.length} parts), variants (${spec.variants.length}), states (${spec.states.length}), spacing (${spec.spacing.length} entries), color tokens (${spec.colorTokens.length}), typography (${spec.typography.length}), usage guidelines, accessibility, props (${spec.props.length}).`,
    tokens: spec.colorTokens.filter((c) => c.tokenName).map((c) => c.tokenName),
    reversible: true,
    metadata: {
      outputFormat: args.outputFormat,
      componentName: spec.componentName,
      variantCount: spec.variants.length,
      stateCount: spec.states.length,
      spacingEntries: spec.spacing.length,
      colorTokenEntries: spec.colorTokens.length,
      typographyEntries: spec.typography.length,
      propsCount: spec.props.length,
    },
  });

  return {
    spec,
    report: args.outputFormat === "json" || args.outputFormat === "figma-page" ? undefined : report,
    figmaPageId,
    logEntryId: logEntry.id,
    ...(args.outputFormat === "json" && !args.contentOverrides
      ? { hint: "Use this extracted data to generate rich, component-specific content for all 18 documentation sections. Then call figma_component_doc again with outputFormat 'figma-page' and a contentOverrides object containing your AI-generated content for each section." }
      : {}),
  };
}
