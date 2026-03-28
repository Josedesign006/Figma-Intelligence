/**
 * component-schemas.js — Predefined JSON schemas for standard component types.
 *
 * When a user requests a standard component (button, card, input, etc.), the system
 * sends Claude a compact token manifest + schema prompt. Claude returns a ~60-token
 * JSON mapping instead of ~500+ tokens of prose. The resolver expands names to values.
 */

// Component schemas: each defines the token properties Claude must map
const COMPONENT_SCHEMAS = {
  button: {
    description: "Interactive button with hover and disabled states",
    required: ["bg", "bgHover", "bgDisabled", "text", "paddingX", "paddingY", "radius", "fontSize", "fontWeight", "shadow"],
  },
  card: {
    description: "Content card container",
    required: ["bg", "border", "radius", "paddingX", "paddingY", "shadow"],
  },
  input: {
    description: "Text input field with focus state",
    required: ["bg", "border", "borderFocus", "text", "placeholder", "radius", "paddingX", "paddingY", "fontSize"],
  },
  badge: {
    description: "Small status label",
    required: ["bg", "text", "paddingX", "paddingY", "radius", "fontSize"],
  },
  navbar: {
    description: "Top navigation bar",
    required: ["bg", "border", "text", "linkHover", "height", "paddingX", "shadow"],
  },
  modal: {
    description: "Dialog/modal overlay",
    required: ["bg", "border", "radius", "paddingX", "paddingY", "shadow", "overlayBg"],
  },
  toggle: {
    description: "Toggle/switch control",
    required: ["bgOff", "bgOn", "thumb", "radius"],
  },
  tooltip: {
    description: "Tooltip popup",
    required: ["bg", "text", "radius", "paddingX", "paddingY", "shadow", "fontSize"],
  },
  avatar: {
    description: "User avatar circle",
    required: ["bg", "border", "text", "radius", "fontSize"],
  },
  alert: {
    description: "Alert/notification banner",
    required: ["bg", "border", "text", "radius", "paddingX", "paddingY", "fontSize"],
  },
};

// Regex patterns to detect component type from user message
const SCHEMA_PATTERNS = [
  { type: "button", pattern: /\b(button|btn|cta)\b/i },
  { type: "card", pattern: /\b(card|tile)\b/i },
  { type: "input", pattern: /\b(input|text\s*field|textfield|text\s*input)\b/i },
  { type: "badge", pattern: /\b(badge|tag|chip|label|lozenge)\b/i },
  { type: "navbar", pattern: /\b(navbar|nav\s*bar|navigation\s*bar|top\s*nav|header\s*bar)\b/i },
  { type: "modal", pattern: /\b(modal|dialog|popup|overlay)\b/i },
  { type: "toggle", pattern: /\b(toggle|switch)\b/i },
  { type: "tooltip", pattern: /\b(tooltip|popover)\b/i },
  { type: "avatar", pattern: /\b(avatar)\b/i },
  { type: "alert", pattern: /\b(alert|toast|notification|snackbar|banner)\b/i },
];

/**
 * Detect if the user message is requesting a standard component.
 * Returns { type, schema } or null if no match.
 */
function detectComponentSchema(message) {
  if (!message) return null;

  // Only match if user is asking to CREATE a component
  const createPattern = /\b(create|make|build|design|add|generate)\b/i;
  if (!createPattern.test(message)) return null;

  for (const { type, pattern } of SCHEMA_PATTERNS) {
    if (pattern.test(message)) {
      return { type, schema: COMPONENT_SCHEMAS[type] };
    }
  }

  return null;
}

/**
 * Build a compact token-mapping prompt for a detected component schema.
 * This replaces verbose prose with a structured JSON request (~150 input tokens).
 */
function buildSchemaPrompt(componentType, schema, tokenManifest) {
  const shape = {};
  for (const prop of schema.required) {
    shape[prop] = "<token-name>";
  }

  return `Map tokens for a ${componentType.toUpperCase()} component (${schema.description}).
Available tokens: ${tokenManifest}

Return ONLY valid JSON matching this shape — no markdown, no explanation:
${JSON.stringify(shape, null, 2)}

Use only token names from the available list.`;
}

module.exports = {
  COMPONENT_SCHEMAS,
  detectComponentSchema,
  buildSchemaPrompt,
};
