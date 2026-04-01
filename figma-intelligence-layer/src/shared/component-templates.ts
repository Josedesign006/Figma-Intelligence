// ─────────────────────────────────────────────────────────────────────────────
// Component Templates (Blueprints)
// Data-driven definitions for 51 professional component stubs with internal
// node trees, auto-layout, variant properties, and semantic token bindings.
// All dimensions on 4px/8px grid.
// ─────────────────────────────────────────────────────────────────────────────

export type NodeKind = "frame" | "text" | "rect" | "ellipse" | "vector";

export interface BlueprintNode {
  name: string;
  kind: NodeKind;
  width?: number;
  height?: number;

  // Auto-layout
  layoutMode?: "HORIZONTAL" | "VERTICAL" | "NONE";
  paddingX?: number;
  paddingY?: number;
  itemSpacing?: number;
  primaryAxisAlign?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlign?: "MIN" | "CENTER" | "MAX";
  primaryAxisSizing?: "AUTO" | "FIXED";
  counterAxisSizing?: "AUTO" | "FIXED";

  // Appearance
  cornerRadius?: number;
  fillSemantic?: string;       // semantic token name for fill
  strokeSemantic?: string;     // semantic token name for stroke
  strokeWeight?: number;
  opacity?: number;
  effects?: Array<{
    type: "DROP_SHADOW";
    color: { r: number; g: number; b: number; a: number };
    offset: { x: number; y: number };
    radius: number;
    spread: number;
  }>;

  // Text-specific
  textContent?: string;
  textPreset?: string;          // typography preset name (e.g. "label/md")
  textFillSemantic?: string;    // semantic token for text fill

  // Children
  children?: BlueprintNode[];
}

export interface VariantProperty {
  name: string;
  values: string[];
  defaultValue: string;
}

export interface ComponentBlueprint {
  name: string;
  category: "core" | "forms" | "navigation" | "data" | "feedback" | "overlay" | "layout";
  description: string;
  root: BlueprintNode;
  variantProperties: VariantProperty[];
  tokenBindings: Array<{
    nodePath: string;       // dot-separated path to child (e.g. "label")
    property: "fills" | "strokes" | "cornerRadius" | "paddingLeft";
    semanticToken: string;
  }>;
}

// ─── Component definitions ──────────────────────────────────────────────────

const BUTTON: ComponentBlueprint = {
  name: "Button",
  category: "core",
  description: "Primary interactive button with icon slot and label",
  root: {
    name: "Button",
    kind: "frame",
    width: 120,
    height: 40,
    layoutMode: "HORIZONTAL",
    primaryAxisAlign: "CENTER",
    counterAxisAlign: "CENTER",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    paddingX: 16,
    paddingY: 8,
    itemSpacing: 8,
    cornerRadius: 8,
    fillSemantic: "color/semantic/actions/primary/bg/default",
    children: [
      {
        name: "Icon",
        kind: "frame",
        width: 16,
        height: 16,
        fillSemantic: "color/semantic/text/on-color",
      },
      {
        name: "Label",
        kind: "text",
        textContent: "Button",
        textPreset: "label/md",
        textFillSemantic: "color/semantic/text/on-color",
      },
    ],
  },
  variantProperties: [
    { name: "State",  values: ["Default", "Hover", "Pressed", "Focused", "Disabled", "Loading"], defaultValue: "Default" },
    { name: "Size",   values: ["sm", "md", "lg"], defaultValue: "md" },
    { name: "Type",   values: ["Primary", "Secondary", "Ghost", "Destructive"], defaultValue: "Primary" },
  ],
  tokenBindings: [
    { nodePath: "",      property: "fills",        semanticToken: "color/semantic/actions/primary/bg/default" },
    { nodePath: "",      property: "cornerRadius",  semanticToken: "radius/semantic/control/default" },
    { nodePath: "Label", property: "fills",         semanticToken: "color/semantic/text/on-color" },
  ],
};

const INPUT: ComponentBlueprint = {
  name: "Input",
  category: "forms",
  description: "Text input field with label, icon slot, and trailing action",
  root: {
    name: "Input",
    kind: "frame",
    width: 280,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 4,
    children: [
      {
        name: "Label",
        kind: "text",
        textContent: "Label",
        textPreset: "label/sm",
        textFillSemantic: "color/semantic/text/primary",
      },
      {
        name: "Field",
        kind: "frame",
        height: 40,
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "MIN",
        counterAxisAlign: "CENTER",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "FIXED",
        paddingX: 12,
        paddingY: 8,
        itemSpacing: 8,
        cornerRadius: 6,
        fillSemantic: "color/semantic/field/bg/default",
        strokeSemantic: "color/semantic/field/border/default",
        strokeWeight: 1,
        children: [
          {
            name: "LeadingIcon",
            kind: "frame",
            width: 16,
            height: 16,
            fillSemantic: "color/semantic/text/tertiary",
          },
          {
            name: "Value",
            kind: "text",
            textContent: "Placeholder text",
            textPreset: "body/md",
            textFillSemantic: "color/semantic/text/tertiary",
          },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "State", values: ["Default", "Focused", "Error", "Disabled"], defaultValue: "Default" },
    { name: "Size",  values: ["sm", "md", "lg"], defaultValue: "md" },
  ],
  tokenBindings: [
    { nodePath: "Field", property: "fills",       semanticToken: "color/semantic/field/bg/default" },
    { nodePath: "Field", property: "strokes",     semanticToken: "color/semantic/field/border/default" },
    { nodePath: "Field", property: "cornerRadius", semanticToken: "radius/semantic/field/default" },
  ],
};

const SELECT: ComponentBlueprint = {
  name: "Select",
  category: "forms",
  description: "Dropdown select with chevron indicator",
  root: {
    name: "Select",
    kind: "frame",
    width: 280,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 4,
    children: [
      {
        name: "Label",
        kind: "text",
        textContent: "Label",
        textPreset: "label/sm",
        textFillSemantic: "color/semantic/text/primary",
      },
      {
        name: "Field",
        kind: "frame",
        height: 40,
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "SPACE_BETWEEN",
        counterAxisAlign: "CENTER",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "FIXED",
        paddingX: 12,
        paddingY: 8,
        cornerRadius: 6,
        fillSemantic: "color/semantic/field/bg/default",
        strokeSemantic: "color/semantic/field/border/default",
        strokeWeight: 1,
        children: [
          {
            name: "Value",
            kind: "text",
            textContent: "Select option",
            textPreset: "body/md",
            textFillSemantic: "color/semantic/text/tertiary",
          },
          {
            name: "Chevron",
            kind: "frame",
            width: 16,
            height: 16,
            fillSemantic: "color/semantic/text/tertiary",
          },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "State", values: ["Default", "Focused", "Error", "Disabled"], defaultValue: "Default" },
    { name: "Size",  values: ["sm", "md", "lg"], defaultValue: "md" },
  ],
  tokenBindings: [],
};

const CHECKBOX: ComponentBlueprint = {
  name: "Checkbox",
  category: "forms",
  description: "Checkbox with label",
  root: {
    name: "Checkbox",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    itemSpacing: 8,
    counterAxisAlign: "CENTER",
    children: [
      {
        name: "Box",
        kind: "frame",
        width: 16,
        height: 16,
        cornerRadius: 4,
        strokeSemantic: "color/semantic/border/default",
        strokeWeight: 1.5,
        fillSemantic: "color/semantic/field/bg/default",
      },
      {
        name: "Label",
        kind: "text",
        textContent: "Checkbox label",
        textPreset: "body/md",
        textFillSemantic: "color/semantic/text/primary",
      },
    ],
  },
  variantProperties: [
    { name: "State", values: ["Default", "Checked", "Indeterminate", "Disabled"], defaultValue: "Default" },
  ],
  tokenBindings: [],
};

const TOGGLE: ComponentBlueprint = {
  name: "Toggle",
  category: "forms",
  description: "Toggle switch with track and thumb",
  root: {
    name: "Toggle",
    kind: "frame",
    width: 40,
    height: 24,
    cornerRadius: 12,
    fillSemantic: "color/semantic/border/default",
    children: [
      {
        name: "Thumb",
        kind: "ellipse",
        width: 20,
        height: 20,
        fillSemantic: "color/semantic/surface/default",
      },
    ],
  },
  variantProperties: [
    { name: "State", values: ["Off", "On", "Disabled"], defaultValue: "Off" },
  ],
  tokenBindings: [],
};

const RADIO: ComponentBlueprint = {
  name: "Radio",
  category: "forms",
  description: "Radio button with label",
  root: {
    name: "Radio",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    itemSpacing: 8,
    counterAxisAlign: "CENTER",
    children: [
      {
        name: "Circle",
        kind: "ellipse",
        width: 16,
        height: 16,
        strokeSemantic: "color/semantic/border/default",
        strokeWeight: 1.5,
        fillSemantic: "color/semantic/field/bg/default",
      },
      {
        name: "Label",
        kind: "text",
        textContent: "Radio label",
        textPreset: "body/md",
        textFillSemantic: "color/semantic/text/primary",
      },
    ],
  },
  variantProperties: [
    { name: "State", values: ["Default", "Selected", "Disabled"], defaultValue: "Default" },
  ],
  tokenBindings: [],
};

const CARD: ComponentBlueprint = {
  name: "Card",
  category: "core",
  description: "Content card with media slot, heading, body, and footer",
  root: {
    name: "Card",
    kind: "frame",
    width: 320,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    cornerRadius: 12,
    fillSemantic: "color/semantic/surface/raised",
    strokeSemantic: "color/semantic/border/default",
    strokeWeight: 1,
    children: [
      {
        name: "Media",
        kind: "rect",
        width: 320,
        height: 180,
        fillSemantic: "color/semantic/surface/subtle",
      },
      {
        name: "Content",
        kind: "frame",
        layoutMode: "VERTICAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        paddingX: 16,
        paddingY: 16,
        itemSpacing: 8,
        children: [
          {
            name: "Heading",
            kind: "text",
            textContent: "Card Title",
            textPreset: "heading/h4",
            textFillSemantic: "color/semantic/text/primary",
          },
          {
            name: "Body",
            kind: "text",
            textContent: "Card description text goes here with supporting details.",
            textPreset: "body/md",
            textFillSemantic: "color/semantic/text/secondary",
          },
        ],
      },
      {
        name: "Footer",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        paddingX: 16,
        paddingY: 12,
        itemSpacing: 8,
        primaryAxisAlign: "MAX",
        children: [
          {
            name: "Action",
            kind: "text",
            textContent: "Learn more",
            textPreset: "label/md",
            textFillSemantic: "color/semantic/actions/primary/bg/default",
          },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "Size",     values: ["sm", "md", "lg"], defaultValue: "md" },
    { name: "Elevated", values: ["true", "false"], defaultValue: "false" },
  ],
  tokenBindings: [
    { nodePath: "",        property: "fills",        semanticToken: "color/semantic/surface/raised" },
    { nodePath: "",        property: "strokes",      semanticToken: "color/semantic/border/default" },
    { nodePath: "",        property: "cornerRadius",  semanticToken: "radius/semantic/surface/default" },
  ],
};

const MODAL: ComponentBlueprint = {
  name: "Modal",
  category: "overlay",
  description: "Dialog modal with header, content, and footer buttons",
  root: {
    name: "Modal",
    kind: "frame",
    width: 480,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    cornerRadius: 16,
    fillSemantic: "color/semantic/surface/overlay",
    effects: [{
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.12 },
      offset: { x: 0, y: 8 },
      radius: 24,
      spread: 0,
    }],
    children: [
      {
        name: "Header",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        paddingX: 24,
        paddingY: 20,
        primaryAxisAlign: "SPACE_BETWEEN",
        counterAxisAlign: "CENTER",
        children: [
          {
            name: "Title",
            kind: "text",
            textContent: "Modal Title",
            textPreset: "heading/h4",
            textFillSemantic: "color/semantic/text/primary",
          },
          {
            name: "CloseBtn",
            kind: "frame",
            width: 24,
            height: 24,
            cornerRadius: 4,
            fillSemantic: "color/semantic/surface/subtle",
          },
        ],
      },
      {
        name: "Content",
        kind: "frame",
        layoutMode: "VERTICAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        paddingX: 24,
        paddingY: 16,
        itemSpacing: 12,
        children: [
          {
            name: "Body",
            kind: "text",
            textContent: "Modal content goes here. This is a placeholder for the dialog body.",
            textPreset: "body/md",
            textFillSemantic: "color/semantic/text/secondary",
          },
        ],
      },
      {
        name: "Footer",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        paddingX: 24,
        paddingY: 16,
        itemSpacing: 12,
        primaryAxisAlign: "MAX",
        children: [
          {
            name: "SecondaryBtn",
            kind: "frame",
            width: 80,
            height: 36,
            cornerRadius: 8,
            layoutMode: "HORIZONTAL",
            primaryAxisAlign: "CENTER",
            counterAxisAlign: "CENTER",
            strokeSemantic: "color/semantic/border/default",
            strokeWeight: 1,
            fillSemantic: "color/semantic/surface/default",
            children: [{
              name: "SecondaryLabel",
              kind: "text",
              textContent: "Cancel",
              textPreset: "label/md",
              textFillSemantic: "color/semantic/text/primary",
            }],
          },
          {
            name: "PrimaryBtn",
            kind: "frame",
            width: 80,
            height: 36,
            cornerRadius: 8,
            layoutMode: "HORIZONTAL",
            primaryAxisAlign: "CENTER",
            counterAxisAlign: "CENTER",
            fillSemantic: "color/semantic/actions/primary/bg/default",
            children: [{
              name: "PrimaryLabel",
              kind: "text",
              textContent: "Confirm",
              textPreset: "label/md",
              textFillSemantic: "color/semantic/text/on-color",
            }],
          },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
  ],
  tokenBindings: [],
};

const TOAST: ComponentBlueprint = {
  name: "Toast",
  category: "feedback",
  description: "Notification toast with status icon, message, and close button",
  root: {
    name: "Toast",
    kind: "frame",
    width: 360,
    height: 56,
    layoutMode: "HORIZONTAL",
    primaryAxisAlign: "MIN",
    counterAxisAlign: "CENTER",
    primaryAxisSizing: "FIXED",
    counterAxisSizing: "FIXED",
    paddingX: 16,
    paddingY: 12,
    itemSpacing: 12,
    cornerRadius: 8,
    fillSemantic: "color/semantic/feedback/success/bg",
    children: [
      {
        name: "StatusIcon",
        kind: "frame",
        width: 20,
        height: 20,
        fillSemantic: "color/semantic/feedback/success/text",
      },
      {
        name: "Message",
        kind: "text",
        textContent: "Operation completed successfully.",
        textPreset: "body/sm",
        textFillSemantic: "color/semantic/feedback/success/text",
      },
      {
        name: "CloseIcon",
        kind: "frame",
        width: 16,
        height: 16,
        fillSemantic: "color/semantic/text/tertiary",
      },
    ],
  },
  variantProperties: [
    { name: "Type", values: ["Success", "Warning", "Error", "Info"], defaultValue: "Success" },
  ],
  tokenBindings: [],
};

const BADGE: ComponentBlueprint = {
  name: "Badge",
  category: "core",
  description: "Status badge with label",
  root: {
    name: "Badge",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    paddingX: 8,
    paddingY: 2,
    cornerRadius: 9999,
    fillSemantic: "color/semantic/actions/primary/bg/default",
    primaryAxisAlign: "CENTER",
    counterAxisAlign: "CENTER",
    children: [
      {
        name: "Label",
        kind: "text",
        textContent: "Badge",
        textPreset: "label/sm",
        textFillSemantic: "color/semantic/text/on-color",
      },
    ],
  },
  variantProperties: [
    { name: "Type", values: ["Default", "Success", "Warning", "Error", "Info"], defaultValue: "Default" },
    { name: "Size", values: ["sm", "md"], defaultValue: "sm" },
  ],
  tokenBindings: [],
};

const AVATAR: ComponentBlueprint = {
  name: "Avatar",
  category: "core",
  description: "Avatar with image placeholder and status indicator",
  root: {
    name: "Avatar",
    kind: "frame",
    width: 40,
    height: 40,
    cornerRadius: 9999,
    fillSemantic: "color/semantic/surface/subtle",
    children: [
      {
        name: "Initials",
        kind: "text",
        textContent: "AB",
        textPreset: "label/md",
        textFillSemantic: "color/semantic/text/secondary",
      },
      {
        name: "StatusDot",
        kind: "ellipse",
        width: 10,
        height: 10,
        fillSemantic: "color/semantic/feedback/success/text",
      },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md", "lg", "xl"], defaultValue: "md" },
  ],
  tokenBindings: [],
};

const TOOLTIP: ComponentBlueprint = {
  name: "Tooltip",
  category: "overlay",
  description: "Tooltip with content text and arrow",
  root: {
    name: "Tooltip",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    paddingX: 12,
    paddingY: 8,
    cornerRadius: 6,
    fillSemantic: "color/semantic/surface/inverse",
    children: [
      {
        name: "Content",
        kind: "text",
        textContent: "Tooltip text",
        textPreset: "body/sm",
        textFillSemantic: "color/semantic/text/inverse",
      },
    ],
  },
  variantProperties: [],
  tokenBindings: [],
};

const TABS: ComponentBlueprint = {
  name: "Tabs",
  category: "navigation",
  description: "Tab bar with active indicator",
  root: {
    name: "Tabs",
    kind: "frame",
    width: 400,
    height: 40,
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "FIXED",
    counterAxisSizing: "FIXED",
    itemSpacing: 0,
    strokeSemantic: "color/semantic/border/subtle",
    strokeWeight: 1,
    children: [
      {
        name: "Tab1",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        paddingX: 16,
        paddingY: 8,
        primaryAxisAlign: "CENTER",
        counterAxisAlign: "CENTER",
        children: [{
          name: "Tab1Label",
          kind: "text",
          textContent: "Tab One",
          textPreset: "label/md",
          textFillSemantic: "color/semantic/actions/primary/bg/default",
        }],
      },
      {
        name: "Tab2",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        paddingX: 16,
        paddingY: 8,
        primaryAxisAlign: "CENTER",
        counterAxisAlign: "CENTER",
        children: [{
          name: "Tab2Label",
          kind: "text",
          textContent: "Tab Two",
          textPreset: "label/md",
          textFillSemantic: "color/semantic/text/secondary",
        }],
      },
      {
        name: "Tab3",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        paddingX: 16,
        paddingY: 8,
        primaryAxisAlign: "CENTER",
        counterAxisAlign: "CENTER",
        children: [{
          name: "Tab3Label",
          kind: "text",
          textContent: "Tab Three",
          textPreset: "label/md",
          textFillSemantic: "color/semantic/text/secondary",
        }],
      },
    ],
  },
  variantProperties: [],
  tokenBindings: [],
};

const BREADCRUMB: ComponentBlueprint = {
  name: "Breadcrumb",
  category: "navigation",
  description: "Breadcrumb navigation with separator",
  root: {
    name: "Breadcrumb",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    itemSpacing: 8,
    counterAxisAlign: "CENTER",
    children: [
      {
        name: "Crumb1",
        kind: "text",
        textContent: "Home",
        textPreset: "body/sm",
        textFillSemantic: "color/semantic/actions/primary/bg/default",
      },
      {
        name: "Sep1",
        kind: "text",
        textContent: "/",
        textPreset: "body/sm",
        textFillSemantic: "color/semantic/text/tertiary",
      },
      {
        name: "Crumb2",
        kind: "text",
        textContent: "Category",
        textPreset: "body/sm",
        textFillSemantic: "color/semantic/actions/primary/bg/default",
      },
      {
        name: "Sep2",
        kind: "text",
        textContent: "/",
        textPreset: "body/sm",
        textFillSemantic: "color/semantic/text/tertiary",
      },
      {
        name: "Current",
        kind: "text",
        textContent: "Current Page",
        textPreset: "body/sm",
        textFillSemantic: "color/semantic/text/primary",
      },
    ],
  },
  variantProperties: [],
  tokenBindings: [],
};

const TAG: ComponentBlueprint = {
  name: "Tag",
  category: "core",
  description: "Tag/chip with optional icon and remove button",
  root: {
    name: "Tag",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    paddingX: 8,
    paddingY: 4,
    itemSpacing: 4,
    cornerRadius: 6,
    counterAxisAlign: "CENTER",
    fillSemantic: "color/semantic/surface/subtle",
    strokeSemantic: "color/semantic/border/default",
    strokeWeight: 1,
    children: [
      {
        name: "Label",
        kind: "text",
        textContent: "Tag",
        textPreset: "label/sm",
        textFillSemantic: "color/semantic/text/primary",
      },
      {
        name: "RemoveIcon",
        kind: "frame",
        width: 12,
        height: 12,
        fillSemantic: "color/semantic/text/tertiary",
      },
    ],
  },
  variantProperties: [
    { name: "Type", values: ["Default", "Success", "Warning"], defaultValue: "Default" },
    { name: "Removable", values: ["true", "false"], defaultValue: "true" },
  ],
  tokenBindings: [],
};

const NAVBAR: ComponentBlueprint = {
  name: "NavBar",
  category: "navigation",
  description: "Top navigation bar with logo, nav items, and actions",
  root: {
    name: "NavBar",
    kind: "frame",
    width: 1440,
    height: 64,
    layoutMode: "HORIZONTAL",
    primaryAxisAlign: "SPACE_BETWEEN",
    counterAxisAlign: "CENTER",
    primaryAxisSizing: "FIXED",
    counterAxisSizing: "FIXED",
    paddingX: 32,
    paddingY: 16,
    fillSemantic: "color/semantic/surface/default",
    strokeSemantic: "color/semantic/border/subtle",
    strokeWeight: 1,
    children: [
      {
        name: "Logo",
        kind: "frame",
        width: 120,
        height: 32,
        fillSemantic: "color/semantic/actions/primary/bg/default",
        cornerRadius: 4,
      },
      {
        name: "NavItems",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        itemSpacing: 24,
        children: [
          { name: "Nav1", kind: "text", textContent: "Dashboard", textPreset: "label/md", textFillSemantic: "color/semantic/text/primary" },
          { name: "Nav2", kind: "text", textContent: "Projects", textPreset: "label/md", textFillSemantic: "color/semantic/text/secondary" },
          { name: "Nav3", kind: "text", textContent: "Settings", textPreset: "label/md", textFillSemantic: "color/semantic/text/secondary" },
        ],
      },
      {
        name: "Actions",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        itemSpacing: 12,
        counterAxisAlign: "CENTER",
        children: [
          {
            name: "AvatarSlot",
            kind: "ellipse",
            width: 32,
            height: 32,
            fillSemantic: "color/semantic/surface/subtle",
          },
        ],
      },
    ],
  },
  variantProperties: [],
  tokenBindings: [],
};

const TABLE: ComponentBlueprint = {
  name: "Table",
  category: "data",
  description: "Data table with header row and body rows",
  root: {
    name: "Table",
    kind: "frame",
    width: 800,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    cornerRadius: 8,
    fillSemantic: "color/semantic/surface/default",
    strokeSemantic: "color/semantic/border/default",
    strokeWeight: 1,
    children: [
      {
        name: "HeaderRow",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        paddingX: 16,
        paddingY: 12,
        fillSemantic: "color/semantic/surface/subtle",
        children: [
          { name: "Col1H", kind: "text", textContent: "Name", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary", width: 200 },
          { name: "Col2H", kind: "text", textContent: "Status", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary", width: 120 },
          { name: "Col3H", kind: "text", textContent: "Date", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary", width: 120 },
          { name: "Col4H", kind: "text", textContent: "Actions", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary", width: 100 },
        ],
      },
      {
        name: "Row1",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        paddingX: 16,
        paddingY: 12,
        strokeSemantic: "color/semantic/border/subtle",
        strokeWeight: 1,
        children: [
          { name: "Col1R1", kind: "text", textContent: "Item name", textPreset: "body/sm", textFillSemantic: "color/semantic/text/primary", width: 200 },
          { name: "Col2R1", kind: "text", textContent: "Active", textPreset: "body/sm", textFillSemantic: "color/semantic/feedback/success/text", width: 120 },
          { name: "Col3R1", kind: "text", textContent: "Mar 21, 2026", textPreset: "body/sm", textFillSemantic: "color/semantic/text/secondary", width: 120 },
          { name: "Col4R1", kind: "text", textContent: "Edit", textPreset: "body/sm", textFillSemantic: "color/semantic/actions/primary/bg/default", width: 100 },
        ],
      },
      {
        name: "Row2",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        paddingX: 16,
        paddingY: 12,
        fillSemantic: "color/semantic/surface/subtle",
        children: [
          { name: "Col1R2", kind: "text", textContent: "Another item", textPreset: "body/sm", textFillSemantic: "color/semantic/text/primary", width: 200 },
          { name: "Col2R2", kind: "text", textContent: "Pending", textPreset: "body/sm", textFillSemantic: "color/semantic/feedback/warning/text", width: 120 },
          { name: "Col3R2", kind: "text", textContent: "Mar 20, 2026", textPreset: "body/sm", textFillSemantic: "color/semantic/text/secondary", width: 120 },
          { name: "Col4R2", kind: "text", textContent: "Edit", textPreset: "body/sm", textFillSemantic: "color/semantic/actions/primary/bg/default", width: 100 },
        ],
      },
    ],
  },
  variantProperties: [],
  tokenBindings: [],
};

// ─── Batch 1: Gap-fill blueprints ───────────────────────────────────────────

const ACCORDION: ComponentBlueprint = {
  name: "Accordion",
  category: "data",
  description: "Expandable content sections with header triggers",
  root: {
    name: "Accordion",
    kind: "frame",
    width: 400,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    cornerRadius: 8,
    strokeSemantic: "color/semantic/border/default",
    strokeWeight: 1,
    children: [
      {
        name: "Item1",
        kind: "frame",
        layoutMode: "VERTICAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        children: [
          {
            name: "Header",
            kind: "frame",
            layoutMode: "HORIZONTAL",
            primaryAxisAlign: "SPACE_BETWEEN",
            counterAxisAlign: "CENTER",
            primaryAxisSizing: "AUTO",
            counterAxisSizing: "FIXED",
            height: 48,
            paddingX: 16,
            paddingY: 12,
            fillSemantic: "color/semantic/surface/default",
            children: [
              { name: "Title", kind: "text", textContent: "Section title", textPreset: "label/md", textFillSemantic: "color/semantic/text/primary" },
              { name: "Chevron", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/secondary" },
            ],
          },
          {
            name: "Content",
            kind: "frame",
            layoutMode: "VERTICAL",
            primaryAxisSizing: "AUTO",
            counterAxisSizing: "AUTO",
            paddingX: 16,
            paddingY: 12,
            children: [
              { name: "Body", kind: "text", textContent: "Accordion content goes here. This area expands and collapses.", textPreset: "body/sm", textFillSemantic: "color/semantic/text/secondary" },
            ],
          },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "State", values: ["Collapsed", "Expanded"], defaultValue: "Collapsed" },
    { name: "Type", values: ["Default", "Bordered", "Flush"], defaultValue: "Default" },
  ],
  tokenBindings: [
    { nodePath: "Item1.Header", property: "fills", semanticToken: "color/semantic/surface/default" },
    { nodePath: "Item1.Header.Title", property: "fills", semanticToken: "color/semantic/text/primary" },
  ],
};

const SLIDER: ComponentBlueprint = {
  name: "Slider",
  category: "forms",
  description: "Range input control with track, fill, and draggable thumb",
  root: {
    name: "Slider",
    kind: "frame",
    width: 280,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 8,
    children: [
      {
        name: "LabelRow",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "SPACE_BETWEEN",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        children: [
          { name: "Label", kind: "text", textContent: "Volume", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary" },
          { name: "Value", kind: "text", textContent: "50", textPreset: "label/sm", textFillSemantic: "color/semantic/text/secondary" },
        ],
      },
      {
        name: "TrackContainer",
        kind: "frame",
        height: 24,
        layoutMode: "HORIZONTAL",
        counterAxisAlign: "CENTER",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "FIXED",
        children: [
          { name: "Track", kind: "rect", width: 280, height: 4, cornerRadius: 2, fillSemantic: "color/semantic/border/default" },
          { name: "Fill", kind: "rect", width: 140, height: 4, cornerRadius: 2, fillSemantic: "color/semantic/actions/primary/bg/default" },
          { name: "Thumb", kind: "ellipse", width: 20, height: 20, fillSemantic: "color/semantic/surface/default", strokeSemantic: "color/semantic/actions/primary/bg/default", strokeWeight: 2 },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md"], defaultValue: "md" },
    { name: "State", values: ["Default", "Hover", "Active", "Disabled"], defaultValue: "Default" },
  ],
  tokenBindings: [
    { nodePath: "TrackContainer.Fill", property: "fills", semanticToken: "color/semantic/actions/primary/bg/default" },
    { nodePath: "TrackContainer.Thumb", property: "strokes", semanticToken: "color/semantic/actions/primary/bg/default" },
    { nodePath: "TrackContainer.Track", property: "fills", semanticToken: "color/semantic/border/default" },
  ],
};

const ALERT: ComponentBlueprint = {
  name: "Alert",
  category: "feedback",
  description: "Contextual feedback message with icon, title, body, and actions",
  root: {
    name: "Alert",
    kind: "frame",
    width: 400,
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    paddingX: 16,
    paddingY: 12,
    itemSpacing: 12,
    cornerRadius: 8,
    fillSemantic: "color/semantic/feedback/info/bg",
    strokeSemantic: "color/semantic/border/default",
    strokeWeight: 1,
    children: [
      { name: "Icon", kind: "frame", width: 20, height: 20, fillSemantic: "color/semantic/feedback/info/text" },
      {
        name: "Content",
        kind: "frame",
        layoutMode: "VERTICAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        itemSpacing: 4,
        children: [
          { name: "Title", kind: "text", textContent: "Information", textPreset: "label/md", textFillSemantic: "color/semantic/feedback/info/text" },
          { name: "Message", kind: "text", textContent: "This is an informational alert message.", textPreset: "body/sm", textFillSemantic: "color/semantic/text/primary" },
        ],
      },
      { name: "Close", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/tertiary" },
    ],
  },
  variantProperties: [
    { name: "Type", values: ["info", "success", "warning", "error"], defaultValue: "info" },
    { name: "Dismissible", values: ["true", "false"], defaultValue: "true" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/feedback/info/bg" },
    { nodePath: "Content.Title", property: "fills", semanticToken: "color/semantic/feedback/info/text" },
    { nodePath: "Icon", property: "fills", semanticToken: "color/semantic/feedback/info/text" },
  ],
};

const CHIP: ComponentBlueprint = {
  name: "Chip",
  category: "core",
  description: "Compact interactive element for filtering, selection, or metadata display",
  root: {
    name: "Chip",
    kind: "frame",
    height: 32,
    layoutMode: "HORIZONTAL",
    primaryAxisAlign: "CENTER",
    counterAxisAlign: "CENTER",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    paddingX: 12,
    itemSpacing: 6,
    cornerRadius: 16,
    fillSemantic: "color/semantic/surface/subtle",
    children: [
      { name: "Icon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/secondary" },
      { name: "Label", kind: "text", textContent: "Chip label", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary" },
      { name: "Close", kind: "frame", width: 14, height: 14, fillSemantic: "color/semantic/text/tertiary" },
    ],
  },
  variantProperties: [
    { name: "Type", values: ["Filter", "Input", "Suggestion"], defaultValue: "Filter" },
    { name: "Size", values: ["sm", "md"], defaultValue: "md" },
    { name: "State", values: ["Default", "Selected", "Hover", "Disabled"], defaultValue: "Default" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/surface/subtle" },
    { nodePath: "", property: "cornerRadius", semanticToken: "radius/semantic/pill" },
    { nodePath: "Label", property: "fills", semanticToken: "color/semantic/text/primary" },
  ],
};

const PROGRESS: ComponentBlueprint = {
  name: "Progress",
  category: "feedback",
  description: "Determinate or indeterminate progress indicator",
  root: {
    name: "Progress",
    kind: "frame",
    width: 280,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 4,
    children: [
      {
        name: "LabelRow",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "SPACE_BETWEEN",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        children: [
          { name: "Label", kind: "text", textContent: "Uploading...", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary" },
          { name: "Percentage", kind: "text", textContent: "65%", textPreset: "label/sm", textFillSemantic: "color/semantic/text/secondary" },
        ],
      },
      {
        name: "Track",
        kind: "rect",
        width: 280,
        height: 8,
        cornerRadius: 4,
        fillSemantic: "color/semantic/surface/subtle",
      },
      {
        name: "Fill",
        kind: "rect",
        width: 182,
        height: 8,
        cornerRadius: 4,
        fillSemantic: "color/semantic/actions/primary/bg/default",
      },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
    { name: "Type", values: ["linear", "circular"], defaultValue: "linear" },
  ],
  tokenBindings: [
    { nodePath: "Track", property: "fills", semanticToken: "color/semantic/surface/subtle" },
    { nodePath: "Fill", property: "fills", semanticToken: "color/semantic/actions/primary/bg/default" },
  ],
};

const SIDENAVIGATION: ComponentBlueprint = {
  name: "SideNavigation",
  category: "navigation",
  description: "Vertical sidebar navigation with collapsible sections",
  root: {
    name: "SideNavigation",
    kind: "frame",
    width: 240,
    height: 600,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "FIXED",
    counterAxisSizing: "FIXED",
    paddingY: 16,
    itemSpacing: 4,
    fillSemantic: "color/semantic/surface/default",
    strokeSemantic: "color/semantic/border/subtle",
    strokeWeight: 1,
    children: [
      {
        name: "SectionHeader",
        kind: "text",
        textContent: "MAIN",
        textPreset: "label/sm",
        textFillSemantic: "color/semantic/text/tertiary",
      },
      {
        name: "NavItem1",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        height: 40,
        paddingX: 12,
        counterAxisAlign: "CENTER",
        itemSpacing: 8,
        cornerRadius: 8,
        fillSemantic: "color/semantic/actions/primary/bg/default",
        children: [
          { name: "Icon", kind: "frame", width: 20, height: 20, fillSemantic: "color/semantic/text/on-color" },
          { name: "Label", kind: "text", textContent: "Dashboard", textPreset: "label/md", textFillSemantic: "color/semantic/text/on-color" },
        ],
      },
      {
        name: "NavItem2",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        height: 40,
        paddingX: 12,
        counterAxisAlign: "CENTER",
        itemSpacing: 8,
        cornerRadius: 8,
        children: [
          { name: "Icon", kind: "frame", width: 20, height: 20, fillSemantic: "color/semantic/text/secondary" },
          { name: "Label", kind: "text", textContent: "Projects", textPreset: "label/md", textFillSemantic: "color/semantic/text/primary" },
        ],
      },
      {
        name: "NavItem3",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        height: 40,
        paddingX: 12,
        counterAxisAlign: "CENTER",
        itemSpacing: 8,
        cornerRadius: 8,
        children: [
          { name: "Icon", kind: "frame", width: 20, height: 20, fillSemantic: "color/semantic/text/secondary" },
          { name: "Label", kind: "text", textContent: "Settings", textPreset: "label/md", textFillSemantic: "color/semantic/text/primary" },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "State", values: ["Expanded", "Collapsed"], defaultValue: "Expanded" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/surface/default" },
    { nodePath: "NavItem1", property: "fills", semanticToken: "color/semantic/actions/primary/bg/default" },
  ],
};

const ICON: ComponentBlueprint = {
  name: "Icon",
  category: "core",
  description: "Vector graphic primitive for visual communication and UI affordances",
  root: {
    name: "Icon",
    kind: "frame",
    width: 24,
    height: 24,
    primaryAxisAlign: "CENTER",
    counterAxisAlign: "CENTER",
    children: [
      { name: "Vector", kind: "vector", width: 20, height: 20, fillSemantic: "color/semantic/text/primary" },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["xs", "sm", "md", "lg", "xl"], defaultValue: "md" },
    { name: "Type", values: ["Filled", "Outlined"], defaultValue: "Filled" },
  ],
  tokenBindings: [
    { nodePath: "Vector", property: "fills", semanticToken: "color/semantic/text/primary" },
  ],
};

const LINK: ComponentBlueprint = {
  name: "Link",
  category: "core",
  description: "Navigational text element for routing between pages or external resources",
  root: {
    name: "Link",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    itemSpacing: 4,
    counterAxisAlign: "CENTER",
    children: [
      { name: "Label", kind: "text", textContent: "Learn more", textPreset: "body/md", textFillSemantic: "color/semantic/actions/primary/bg/default" },
      { name: "ExternalIcon", kind: "frame", width: 14, height: 14, fillSemantic: "color/semantic/actions/primary/bg/default", opacity: 0 },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
    { name: "Type", values: ["Standalone", "Inline"], defaultValue: "Standalone" },
    { name: "External", values: ["true", "false"], defaultValue: "false" },
  ],
  tokenBindings: [
    { nodePath: "Label", property: "fills", semanticToken: "color/semantic/actions/primary/bg/default" },
    { nodePath: "ExternalIcon", property: "fills", semanticToken: "color/semantic/actions/primary/bg/default" },
  ],
};

const MENU: ComponentBlueprint = {
  name: "Menu",
  category: "overlay",
  description: "Contextual action list triggered by a button or right-click",
  root: {
    name: "Menu",
    kind: "frame",
    width: 200,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    paddingY: 4,
    cornerRadius: 8,
    fillSemantic: "color/semantic/surface/raised",
    strokeSemantic: "color/semantic/border/subtle",
    strokeWeight: 1,
    effects: [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.12 }, offset: { x: 0, y: 4 }, radius: 16, spread: -2 }],
    children: [
      {
        name: "MenuItem1",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "MIN",
        counterAxisAlign: "CENTER",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "FIXED",
        height: 36,
        paddingX: 12,
        itemSpacing: 8,
        children: [
          { name: "Icon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/secondary" },
          { name: "Label", kind: "text", textContent: "Edit", textPreset: "body/sm", textFillSemantic: "color/semantic/text/primary" },
          { name: "Shortcut", kind: "text", textContent: "⌘E", textPreset: "body/sm", textFillSemantic: "color/semantic/text/tertiary" },
        ],
      },
      {
        name: "Divider",
        kind: "rect",
        height: 1,
        fillSemantic: "color/semantic/border/subtle",
      },
      {
        name: "MenuItem2",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "MIN",
        counterAxisAlign: "CENTER",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "FIXED",
        height: 36,
        paddingX: 12,
        itemSpacing: 8,
        children: [
          { name: "Icon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/secondary" },
          { name: "Label", kind: "text", textContent: "Delete", textPreset: "body/sm", textFillSemantic: "color/semantic/feedback/danger/text" },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/surface/raised" },
    { nodePath: "", property: "cornerRadius", semanticToken: "radius/semantic/surface/default" },
  ],
};

const SPINNER: ComponentBlueprint = {
  name: "Spinner",
  category: "feedback",
  description: "Indeterminate loading indicator with circular animation",
  root: {
    name: "Spinner",
    kind: "frame",
    width: 32,
    height: 32,
    primaryAxisAlign: "CENTER",
    counterAxisAlign: "CENTER",
    children: [
      { name: "Track", kind: "ellipse", width: 32, height: 32, strokeSemantic: "color/semantic/border/default", strokeWeight: 3 },
      { name: "Indicator", kind: "ellipse", width: 32, height: 32, strokeSemantic: "color/semantic/actions/primary/bg/default", strokeWeight: 3 },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["xs", "sm", "md", "lg", "xl"], defaultValue: "md" },
  ],
  tokenBindings: [
    { nodePath: "Track", property: "strokes", semanticToken: "color/semantic/border/default" },
    { nodePath: "Indicator", property: "strokes", semanticToken: "color/semantic/actions/primary/bg/default" },
  ],
};

// ─── Batch 2: Tier 2 Forms ──────────────────────────────────────────────────

const TEXTAREA: ComponentBlueprint = {
  name: "Textarea",
  category: "forms",
  description: "Multi-line text input with label, helper text, and character counter",
  root: {
    name: "Textarea",
    kind: "frame",
    width: 320,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 4,
    children: [
      { name: "Label", kind: "text", textContent: "Description", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary" },
      {
        name: "Field",
        kind: "frame",
        height: 120,
        layoutMode: "VERTICAL",
        primaryAxisAlign: "MIN",
        primaryAxisSizing: "FIXED",
        counterAxisSizing: "AUTO",
        paddingX: 12,
        paddingY: 8,
        cornerRadius: 6,
        fillSemantic: "color/semantic/field/bg/default",
        strokeSemantic: "color/semantic/field/border/default",
        strokeWeight: 1,
        children: [
          { name: "Value", kind: "text", textContent: "Enter your message here...", textPreset: "body/md", textFillSemantic: "color/semantic/text/tertiary" },
        ],
      },
      {
        name: "Footer",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "SPACE_BETWEEN",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        children: [
          { name: "HelperText", kind: "text", textContent: "Optional helper text", textPreset: "body/sm", textFillSemantic: "color/semantic/text/tertiary" },
          { name: "Counter", kind: "text", textContent: "0/500", textPreset: "body/sm", textFillSemantic: "color/semantic/text/tertiary" },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "State", values: ["Default", "Focused", "Filled", "Error", "Disabled", "ReadOnly"], defaultValue: "Default" },
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
  ],
  tokenBindings: [
    { nodePath: "Field", property: "fills", semanticToken: "color/semantic/field/bg/default" },
    { nodePath: "Field", property: "strokes", semanticToken: "color/semantic/field/border/default" },
    { nodePath: "Field", property: "cornerRadius", semanticToken: "radius/semantic/field/default" },
  ],
};

const SEARCH: ComponentBlueprint = {
  name: "Search",
  category: "forms",
  description: "Search input with icon, clear action, and loading state",
  root: {
    name: "Search",
    kind: "frame",
    width: 320,
    layoutMode: "HORIZONTAL",
    primaryAxisAlign: "MIN",
    counterAxisAlign: "CENTER",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    height: 40,
    paddingX: 12,
    itemSpacing: 8,
    cornerRadius: 8,
    fillSemantic: "color/semantic/field/bg/default",
    strokeSemantic: "color/semantic/field/border/default",
    strokeWeight: 1,
    children: [
      { name: "SearchIcon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/tertiary" },
      { name: "Value", kind: "text", textContent: "Search...", textPreset: "body/md", textFillSemantic: "color/semantic/text/tertiary" },
      { name: "ClearIcon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/tertiary", opacity: 0 },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
    { name: "State", values: ["Default", "Focused", "Searching", "Filled", "Disabled"], defaultValue: "Default" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/field/bg/default" },
    { nodePath: "", property: "strokes", semanticToken: "color/semantic/field/border/default" },
    { nodePath: "", property: "cornerRadius", semanticToken: "radius/semantic/field/default" },
  ],
};

const COMBOBOX: ComponentBlueprint = {
  name: "Combobox",
  category: "forms",
  description: "Text input with dropdown suggestions and autocomplete filtering",
  root: {
    name: "Combobox",
    kind: "frame",
    width: 280,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 4,
    children: [
      { name: "Label", kind: "text", textContent: "Country", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary" },
      {
        name: "Field",
        kind: "frame",
        height: 40,
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "SPACE_BETWEEN",
        counterAxisAlign: "CENTER",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "FIXED",
        paddingX: 12,
        cornerRadius: 6,
        fillSemantic: "color/semantic/field/bg/default",
        strokeSemantic: "color/semantic/field/border/default",
        strokeWeight: 1,
        children: [
          { name: "Value", kind: "text", textContent: "Type to search...", textPreset: "body/md", textFillSemantic: "color/semantic/text/tertiary" },
          { name: "Chevron", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/tertiary" },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
    { name: "State", values: ["Default", "Open", "Focused", "Error", "Disabled"], defaultValue: "Default" },
  ],
  tokenBindings: [
    { nodePath: "Field", property: "fills", semanticToken: "color/semantic/field/bg/default" },
    { nodePath: "Field", property: "strokes", semanticToken: "color/semantic/field/border/default" },
    { nodePath: "Field", property: "cornerRadius", semanticToken: "radius/semantic/field/default" },
  ],
};

const DATEPICKER: ComponentBlueprint = {
  name: "DatePicker",
  category: "forms",
  description: "Date selection input with calendar popup for single or range selection",
  root: {
    name: "DatePicker",
    kind: "frame",
    width: 280,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 4,
    children: [
      { name: "Label", kind: "text", textContent: "Start date", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary" },
      {
        name: "Trigger",
        kind: "frame",
        height: 40,
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "SPACE_BETWEEN",
        counterAxisAlign: "CENTER",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "FIXED",
        paddingX: 12,
        cornerRadius: 6,
        fillSemantic: "color/semantic/field/bg/default",
        strokeSemantic: "color/semantic/field/border/default",
        strokeWeight: 1,
        children: [
          { name: "Value", kind: "text", textContent: "MM/DD/YYYY", textPreset: "body/md", textFillSemantic: "color/semantic/text/tertiary" },
          { name: "CalendarIcon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/tertiary" },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "Type", values: ["single", "range"], defaultValue: "single" },
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
    { name: "State", values: ["Default", "Open", "Focused", "Error", "Disabled"], defaultValue: "Default" },
  ],
  tokenBindings: [
    { nodePath: "Trigger", property: "fills", semanticToken: "color/semantic/field/bg/default" },
    { nodePath: "Trigger", property: "strokes", semanticToken: "color/semantic/field/border/default" },
    { nodePath: "Trigger", property: "cornerRadius", semanticToken: "radius/semantic/field/default" },
  ],
};

const NUMBERINPUT: ComponentBlueprint = {
  name: "NumberInput",
  category: "forms",
  description: "Numeric input with increment/decrement stepper buttons",
  root: {
    name: "NumberInput",
    kind: "frame",
    width: 200,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 4,
    children: [
      { name: "Label", kind: "text", textContent: "Quantity", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary" },
      {
        name: "Field",
        kind: "frame",
        height: 40,
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "SPACE_BETWEEN",
        counterAxisAlign: "CENTER",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "FIXED",
        cornerRadius: 6,
        fillSemantic: "color/semantic/field/bg/default",
        strokeSemantic: "color/semantic/field/border/default",
        strokeWeight: 1,
        children: [
          { name: "Decrement", kind: "frame", width: 32, height: 40, fillSemantic: "color/semantic/surface/subtle", cornerRadius: 6, primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER" },
          { name: "Value", kind: "text", textContent: "1", textPreset: "body/md", textFillSemantic: "color/semantic/text/primary" },
          { name: "Increment", kind: "frame", width: 32, height: 40, fillSemantic: "color/semantic/surface/subtle", cornerRadius: 6, primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER" },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
    { name: "State", values: ["Default", "Focused", "Error", "Disabled"], defaultValue: "Default" },
  ],
  tokenBindings: [
    { nodePath: "Field", property: "fills", semanticToken: "color/semantic/field/bg/default" },
    { nodePath: "Field", property: "strokes", semanticToken: "color/semantic/field/border/default" },
    { nodePath: "Field", property: "cornerRadius", semanticToken: "radius/semantic/field/default" },
  ],
};

const FORM: ComponentBlueprint = {
  name: "Form",
  category: "forms",
  description: "Form container wrapping field groups with consistent layout and validation",
  root: {
    name: "Form",
    kind: "frame",
    width: 400,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 16,
    paddingX: 24,
    paddingY: 24,
    cornerRadius: 8,
    fillSemantic: "color/semantic/surface/default",
    children: [
      { name: "FormTitle", kind: "text", textContent: "Create account", textPreset: "label/lg", textFillSemantic: "color/semantic/text/primary" },
      {
        name: "FieldGroup",
        kind: "frame",
        layoutMode: "VERTICAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        itemSpacing: 12,
        children: [
          { name: "Field1Placeholder", kind: "rect", width: 352, height: 64, cornerRadius: 6, strokeSemantic: "color/semantic/border/subtle", strokeWeight: 1 },
          { name: "Field2Placeholder", kind: "rect", width: 352, height: 64, cornerRadius: 6, strokeSemantic: "color/semantic/border/subtle", strokeWeight: 1 },
        ],
      },
      {
        name: "Actions",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "MAX",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        itemSpacing: 8,
        children: [
          { name: "Cancel", kind: "text", textContent: "Cancel", textPreset: "label/md", textFillSemantic: "color/semantic/text/secondary" },
          {
            name: "Submit",
            kind: "frame",
            width: 100,
            height: 40,
            layoutMode: "HORIZONTAL",
            primaryAxisAlign: "CENTER",
            counterAxisAlign: "CENTER",
            cornerRadius: 8,
            fillSemantic: "color/semantic/actions/primary/bg/default",
            children: [
              { name: "SubmitLabel", kind: "text", textContent: "Submit", textPreset: "label/md", textFillSemantic: "color/semantic/text/on-color" },
            ],
          },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "Layout", values: ["Vertical", "Horizontal"], defaultValue: "Vertical" },
    { name: "State", values: ["Default", "Submitting", "Error"], defaultValue: "Default" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/surface/default" },
    { nodePath: "Actions.Submit", property: "fills", semanticToken: "color/semantic/actions/primary/bg/default" },
  ],
};

// ─── Batch 3: Nav + Data + Layout ───────────────────────────────────────────

const PAGINATION: ComponentBlueprint = {
  name: "Pagination",
  category: "navigation",
  description: "Page navigation with numbered buttons, prev/next controls",
  root: {
    name: "Pagination",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    itemSpacing: 4,
    counterAxisAlign: "CENTER",
    children: [
      { name: "Prev", kind: "frame", width: 36, height: 36, cornerRadius: 8, primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER", fillSemantic: "color/semantic/surface/subtle", children: [{ name: "Arrow", kind: "text", textContent: "‹", textPreset: "label/md", textFillSemantic: "color/semantic/text/primary" }] },
      { name: "Page1", kind: "frame", width: 36, height: 36, cornerRadius: 8, primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER", fillSemantic: "color/semantic/actions/primary/bg/default", children: [{ name: "Num", kind: "text", textContent: "1", textPreset: "label/md", textFillSemantic: "color/semantic/text/on-color" }] },
      { name: "Page2", kind: "frame", width: 36, height: 36, cornerRadius: 8, primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER", children: [{ name: "Num", kind: "text", textContent: "2", textPreset: "label/md", textFillSemantic: "color/semantic/text/primary" }] },
      { name: "Page3", kind: "frame", width: 36, height: 36, cornerRadius: 8, primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER", children: [{ name: "Num", kind: "text", textContent: "3", textPreset: "label/md", textFillSemantic: "color/semantic/text/primary" }] },
      { name: "Next", kind: "frame", width: 36, height: 36, cornerRadius: 8, primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER", fillSemantic: "color/semantic/surface/subtle", children: [{ name: "Arrow", kind: "text", textContent: "›", textPreset: "label/md", textFillSemantic: "color/semantic/text/primary" }] },
    ],
  },
  variantProperties: [
    { name: "Type", values: ["numbered", "loadMore", "compact"], defaultValue: "numbered" },
    { name: "Size", values: ["sm", "md"], defaultValue: "md" },
  ],
  tokenBindings: [
    { nodePath: "Page1", property: "fills", semanticToken: "color/semantic/actions/primary/bg/default" },
  ],
};

const LIST: ComponentBlueprint = {
  name: "List",
  category: "data",
  description: "Vertical list of items with optional icons, secondary text, and dividers",
  root: {
    name: "List",
    kind: "frame",
    width: 320,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    fillSemantic: "color/semantic/surface/default",
    children: [
      {
        name: "ListItem1",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "FIXED",
        height: 48,
        paddingX: 16,
        counterAxisAlign: "CENTER",
        itemSpacing: 12,
        children: [
          { name: "Icon", kind: "frame", width: 20, height: 20, fillSemantic: "color/semantic/text/secondary" },
          { name: "Label", kind: "text", textContent: "List item one", textPreset: "body/md", textFillSemantic: "color/semantic/text/primary" },
        ],
      },
      { name: "Divider", kind: "rect", height: 1, fillSemantic: "color/semantic/border/subtle" },
      {
        name: "ListItem2",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "FIXED",
        height: 48,
        paddingX: 16,
        counterAxisAlign: "CENTER",
        itemSpacing: 12,
        children: [
          { name: "Icon", kind: "frame", width: 20, height: 20, fillSemantic: "color/semantic/text/secondary" },
          { name: "Label", kind: "text", textContent: "List item two", textPreset: "body/md", textFillSemantic: "color/semantic/text/primary" },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "Type", values: ["simple", "interactive", "twoLine", "avatar"], defaultValue: "simple" },
    { name: "Dividers", values: ["true", "false"], defaultValue: "true" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/surface/default" },
  ],
};

const TREEVIEW: ComponentBlueprint = {
  name: "TreeView",
  category: "data",
  description: "Hierarchical expandable tree for navigating nested data",
  root: {
    name: "TreeView",
    kind: "frame",
    width: 260,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    children: [
      {
        name: "Node1",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "FIXED",
        height: 36,
        paddingX: 8,
        counterAxisAlign: "CENTER",
        itemSpacing: 4,
        cornerRadius: 6,
        children: [
          { name: "ExpandIcon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/tertiary" },
          { name: "FolderIcon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/secondary" },
          { name: "Label", kind: "text", textContent: "Documents", textPreset: "body/sm", textFillSemantic: "color/semantic/text/primary" },
        ],
      },
      {
        name: "Node1Child",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "FIXED",
        height: 36,
        paddingX: 32,
        counterAxisAlign: "CENTER",
        itemSpacing: 4,
        cornerRadius: 6,
        fillSemantic: "color/semantic/actions/primary/bg/default",
        children: [
          { name: "FileIcon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/on-color" },
          { name: "Label", kind: "text", textContent: "Report.pdf", textPreset: "body/sm", textFillSemantic: "color/semantic/text/on-color" },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md"], defaultValue: "md" },
    { name: "Selection", values: ["single", "multi", "none"], defaultValue: "single" },
  ],
  tokenBindings: [
    { nodePath: "Node1Child", property: "fills", semanticToken: "color/semantic/actions/primary/bg/default" },
  ],
};

const TYPOGRAPHY: ComponentBlueprint = {
  name: "Typography",
  category: "core",
  description: "Text display component for headings, body text, labels, and captions",
  root: {
    name: "Typography",
    kind: "frame",
    width: 400,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 8,
    children: [
      { name: "Display", kind: "text", textContent: "Display Text", textPreset: "display/lg", textFillSemantic: "color/semantic/text/primary" },
      { name: "Heading", kind: "text", textContent: "Heading Text", textPreset: "heading/md", textFillSemantic: "color/semantic/text/primary" },
      { name: "Body", kind: "text", textContent: "Body text for paragraphs and content.", textPreset: "body/md", textFillSemantic: "color/semantic/text/secondary" },
      { name: "Label", kind: "text", textContent: "Label Text", textPreset: "label/md", textFillSemantic: "color/semantic/text/primary" },
      { name: "Caption", kind: "text", textContent: "Caption text", textPreset: "body/sm", textFillSemantic: "color/semantic/text/tertiary" },
    ],
  },
  variantProperties: [
    { name: "Variant", values: ["display", "heading", "body", "label", "caption"], defaultValue: "body" },
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
  ],
  tokenBindings: [],
};

const DIVIDER: ComponentBlueprint = {
  name: "Divider",
  category: "layout",
  description: "Visual separator line between content sections",
  root: {
    name: "Divider",
    kind: "rect",
    width: 400,
    height: 1,
    fillSemantic: "color/semantic/border/subtle",
  },
  variantProperties: [
    { name: "Orientation", values: ["horizontal", "vertical"], defaultValue: "horizontal" },
    { name: "Type", values: ["solid", "dashed"], defaultValue: "solid" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/border/subtle" },
  ],
};

const SKELETON: ComponentBlueprint = {
  name: "Skeleton",
  category: "layout",
  description: "Loading placeholder mimicking content layout while data loads",
  root: {
    name: "Skeleton",
    kind: "frame",
    width: 320,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 12,
    children: [
      { name: "ImagePlaceholder", kind: "rect", width: 320, height: 180, cornerRadius: 8, fillSemantic: "color/semantic/surface/subtle" },
      { name: "TitleLine", kind: "rect", width: 240, height: 16, cornerRadius: 4, fillSemantic: "color/semantic/surface/subtle" },
      { name: "BodyLine1", kind: "rect", width: 320, height: 12, cornerRadius: 4, fillSemantic: "color/semantic/surface/subtle" },
      { name: "BodyLine2", kind: "rect", width: 280, height: 12, cornerRadius: 4, fillSemantic: "color/semantic/surface/subtle" },
    ],
  },
  variantProperties: [
    { name: "Type", values: ["text", "circle", "rect", "card"], defaultValue: "card" },
    { name: "Animation", values: ["shimmer", "pulse"], defaultValue: "shimmer" },
  ],
  tokenBindings: [
    { nodePath: "ImagePlaceholder", property: "fills", semanticToken: "color/semantic/surface/subtle" },
    { nodePath: "TitleLine", property: "fills", semanticToken: "color/semantic/surface/subtle" },
  ],
};

// ─── Batch 4: Overlay + Remaining ───────────────────────────────────────────

const POPOVER: ComponentBlueprint = {
  name: "Popover",
  category: "overlay",
  description: "Interactive floating panel with rich content triggered by click",
  root: {
    name: "Popover",
    kind: "frame",
    width: 280,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    paddingX: 16,
    paddingY: 12,
    cornerRadius: 12,
    fillSemantic: "color/semantic/surface/raised",
    strokeSemantic: "color/semantic/border/subtle",
    strokeWeight: 1,
    effects: [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.12 }, offset: { x: 0, y: 8 }, radius: 24, spread: -4 }],
    itemSpacing: 8,
    children: [
      {
        name: "Header",
        kind: "frame",
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "SPACE_BETWEEN",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "AUTO",
        children: [
          { name: "Title", kind: "text", textContent: "Popover title", textPreset: "label/md", textFillSemantic: "color/semantic/text/primary" },
          { name: "Close", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/tertiary" },
        ],
      },
      { name: "Body", kind: "text", textContent: "Popover content with interactive elements.", textPreset: "body/sm", textFillSemantic: "color/semantic/text/secondary" },
    ],
  },
  variantProperties: [
    { name: "Placement", values: ["top", "bottom", "left", "right"], defaultValue: "bottom" },
    { name: "HasArrow", values: ["true", "false"], defaultValue: "true" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/surface/raised" },
    { nodePath: "", property: "cornerRadius", semanticToken: "radius/semantic/surface/default" },
  ],
};

const DROPDOWNMENU: ComponentBlueprint = {
  name: "DropdownMenu",
  category: "overlay",
  description: "Button-triggered menu with action items and keyboard navigation",
  root: {
    name: "DropdownMenu",
    kind: "frame",
    width: 200,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    paddingY: 4,
    cornerRadius: 8,
    fillSemantic: "color/semantic/surface/raised",
    strokeSemantic: "color/semantic/border/subtle",
    strokeWeight: 1,
    effects: [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 4 }, radius: 12, spread: -2 }],
    children: [
      { name: "Item1", kind: "frame", layoutMode: "HORIZONTAL", primaryAxisSizing: "AUTO", counterAxisSizing: "FIXED", height: 36, paddingX: 12, counterAxisAlign: "CENTER", itemSpacing: 8, children: [{ name: "Icon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/secondary" }, { name: "Label", kind: "text", textContent: "Action one", textPreset: "body/sm", textFillSemantic: "color/semantic/text/primary" }] },
      { name: "Item2", kind: "frame", layoutMode: "HORIZONTAL", primaryAxisSizing: "AUTO", counterAxisSizing: "FIXED", height: 36, paddingX: 12, counterAxisAlign: "CENTER", itemSpacing: 8, children: [{ name: "Icon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/secondary" }, { name: "Label", kind: "text", textContent: "Action two", textPreset: "body/sm", textFillSemantic: "color/semantic/text/primary" }] },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
    { name: "Alignment", values: ["start", "end"], defaultValue: "start" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/surface/raised" },
  ],
};

const AVATARGROUP: ComponentBlueprint = {
  name: "AvatarGroup",
  category: "core",
  description: "Overlapping row of avatars with overflow indicator",
  root: {
    name: "AvatarGroup",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    children: [
      { name: "Avatar1", kind: "ellipse", width: 32, height: 32, fillSemantic: "color/semantic/surface/subtle", strokeSemantic: "color/semantic/surface/default", strokeWeight: 2 },
      { name: "Avatar2", kind: "ellipse", width: 32, height: 32, fillSemantic: "color/semantic/surface/subtle", strokeSemantic: "color/semantic/surface/default", strokeWeight: 2 },
      { name: "Avatar3", kind: "ellipse", width: 32, height: 32, fillSemantic: "color/semantic/surface/subtle", strokeSemantic: "color/semantic/surface/default", strokeWeight: 2 },
      { name: "Overflow", kind: "ellipse", width: 32, height: 32, fillSemantic: "color/semantic/surface/subtle", strokeSemantic: "color/semantic/surface/default", strokeWeight: 2 },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md", "lg", "xl"], defaultValue: "md" },
    { name: "MaxVisible", values: ["3", "4", "5"], defaultValue: "3" },
  ],
  tokenBindings: [],
};

const GRID: ComponentBlueprint = {
  name: "Grid",
  category: "layout",
  description: "CSS Grid-based responsive layout container",
  root: {
    name: "Grid",
    kind: "frame",
    width: 800,
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 16,
    children: [
      { name: "Cell1", kind: "rect", width: 180, height: 120, cornerRadius: 8, fillSemantic: "color/semantic/surface/subtle" },
      { name: "Cell2", kind: "rect", width: 180, height: 120, cornerRadius: 8, fillSemantic: "color/semantic/surface/subtle" },
      { name: "Cell3", kind: "rect", width: 180, height: 120, cornerRadius: 8, fillSemantic: "color/semantic/surface/subtle" },
      { name: "Cell4", kind: "rect", width: 180, height: 120, cornerRadius: 8, fillSemantic: "color/semantic/surface/subtle" },
    ],
  },
  variantProperties: [
    { name: "Columns", values: ["1", "2", "3", "4", "6", "12"], defaultValue: "4" },
    { name: "Gap", values: ["sm", "md", "lg"], defaultValue: "md" },
  ],
  tokenBindings: [],
};

const EMPTYSTATE: ComponentBlueprint = {
  name: "EmptyState",
  category: "layout",
  description: "Placeholder for zero-data views with illustration, message, and action",
  root: {
    name: "EmptyState",
    kind: "frame",
    width: 400,
    layoutMode: "VERTICAL",
    primaryAxisAlign: "CENTER",
    counterAxisAlign: "CENTER",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 16,
    paddingY: 48,
    children: [
      { name: "Illustration", kind: "rect", width: 160, height: 120, cornerRadius: 12, fillSemantic: "color/semantic/surface/subtle" },
      { name: "Heading", kind: "text", textContent: "No items found", textPreset: "heading/md", textFillSemantic: "color/semantic/text/primary" },
      { name: "Description", kind: "text", textContent: "Get started by creating your first item.", textPreset: "body/md", textFillSemantic: "color/semantic/text/secondary" },
      {
        name: "Action",
        kind: "frame",
        width: 140,
        height: 40,
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "CENTER",
        counterAxisAlign: "CENTER",
        cornerRadius: 8,
        fillSemantic: "color/semantic/actions/primary/bg/default",
        children: [
          { name: "ActionLabel", kind: "text", textContent: "Create item", textPreset: "label/md", textFillSemantic: "color/semantic/text/on-color" },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["compact", "default", "full"], defaultValue: "default" },
  ],
  tokenBindings: [
    { nodePath: "Action", property: "fills", semanticToken: "color/semantic/actions/primary/bg/default" },
  ],
};

const BANNER: ComponentBlueprint = {
  name: "Banner",
  category: "feedback",
  description: "Full-width persistent notification bar for system-level messages",
  root: {
    name: "Banner",
    kind: "frame",
    width: 800,
    height: 48,
    layoutMode: "HORIZONTAL",
    primaryAxisAlign: "CENTER",
    counterAxisAlign: "CENTER",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    paddingX: 16,
    itemSpacing: 12,
    fillSemantic: "color/semantic/feedback/info/bg",
    children: [
      { name: "Icon", kind: "frame", width: 20, height: 20, fillSemantic: "color/semantic/feedback/info/text" },
      { name: "Message", kind: "text", textContent: "New version available. Update now for the latest features.", textPreset: "body/sm", textFillSemantic: "color/semantic/feedback/info/text" },
      { name: "Action", kind: "text", textContent: "Update", textPreset: "label/sm", textFillSemantic: "color/semantic/actions/primary/bg/default" },
      { name: "Close", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/feedback/info/text" },
    ],
  },
  variantProperties: [
    { name: "Type", values: ["info", "success", "warning", "error"], defaultValue: "info" },
    { name: "Dismissible", values: ["true", "false"], defaultValue: "true" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/feedback/info/bg" },
  ],
};

// ─── Batch 5: Tier 3 ───────────────────────────────────────────────────────

const DRAWER: ComponentBlueprint = {
  name: "Drawer",
  category: "overlay",
  description: "Slide-in panel from screen edge for secondary content or navigation",
  root: {
    name: "Drawer",
    kind: "frame",
    width: 360,
    height: 600,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "FIXED",
    counterAxisSizing: "FIXED",
    fillSemantic: "color/semantic/surface/default",
    effects: [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.16 }, offset: { x: -4, y: 0 }, radius: 24, spread: 0 }],
    children: [
      { name: "Header", kind: "frame", layoutMode: "HORIZONTAL", primaryAxisAlign: "SPACE_BETWEEN", counterAxisAlign: "CENTER", primaryAxisSizing: "AUTO", counterAxisSizing: "FIXED", height: 56, paddingX: 20, strokeSemantic: "color/semantic/border/subtle", strokeWeight: 1, children: [{ name: "Title", kind: "text", textContent: "Drawer Title", textPreset: "heading/sm", textFillSemantic: "color/semantic/text/primary" }, { name: "Close", kind: "frame", width: 20, height: 20, fillSemantic: "color/semantic/text/secondary" }] },
      { name: "Body", kind: "frame", layoutMode: "VERTICAL", primaryAxisSizing: "AUTO", counterAxisSizing: "AUTO", paddingX: 20, paddingY: 16, itemSpacing: 12, children: [{ name: "Content", kind: "text", textContent: "Drawer content goes here.", textPreset: "body/md", textFillSemantic: "color/semantic/text/secondary" }] },
    ],
  },
  variantProperties: [
    { name: "Side", values: ["left", "right", "bottom"], defaultValue: "right" },
    { name: "Size", values: ["sm", "md", "lg", "full"], defaultValue: "md" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/surface/default" },
  ],
};

const SEGMENTEDCONTROL: ComponentBlueprint = {
  name: "SegmentedControl",
  category: "core",
  description: "Button group for single-selection between mutually exclusive options",
  root: {
    name: "SegmentedControl",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    cornerRadius: 8,
    fillSemantic: "color/semantic/surface/subtle",
    paddingX: 4,
    paddingY: 4,
    itemSpacing: 2,
    children: [
      { name: "Segment1", kind: "frame", width: 80, height: 32, layoutMode: "HORIZONTAL", primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER", cornerRadius: 6, fillSemantic: "color/semantic/surface/default", effects: [{ type: "DROP_SHADOW", color: { r: 0, g: 0, b: 0, a: 0.06 }, offset: { x: 0, y: 1 }, radius: 2, spread: 0 }], children: [{ name: "Label", kind: "text", textContent: "Day", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary" }] },
      { name: "Segment2", kind: "frame", width: 80, height: 32, layoutMode: "HORIZONTAL", primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER", cornerRadius: 6, children: [{ name: "Label", kind: "text", textContent: "Week", textPreset: "label/sm", textFillSemantic: "color/semantic/text/secondary" }] },
      { name: "Segment3", kind: "frame", width: 80, height: 32, layoutMode: "HORIZONTAL", primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER", cornerRadius: 6, children: [{ name: "Label", kind: "text", textContent: "Month", textPreset: "label/sm", textFillSemantic: "color/semantic/text/secondary" }] },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
    { name: "Type", values: ["text", "icon", "both"], defaultValue: "text" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/surface/subtle" },
    { nodePath: "Segment1", property: "fills", semanticToken: "color/semantic/surface/default" },
  ],
};

const STEPPER: ComponentBlueprint = {
  name: "Stepper",
  category: "navigation",
  description: "Multi-step progress indicator showing workflow completion status",
  root: {
    name: "Stepper",
    kind: "frame",
    width: 600,
    layoutMode: "HORIZONTAL",
    primaryAxisAlign: "SPACE_BETWEEN",
    counterAxisAlign: "CENTER",
    primaryAxisSizing: "FIXED",
    counterAxisSizing: "AUTO",
    children: [
      { name: "Step1", kind: "frame", layoutMode: "HORIZONTAL", primaryAxisSizing: "AUTO", counterAxisSizing: "AUTO", itemSpacing: 8, counterAxisAlign: "CENTER", children: [{ name: "Circle", kind: "ellipse", width: 32, height: 32, fillSemantic: "color/semantic/actions/primary/bg/default" }, { name: "Label", kind: "text", textContent: "Details", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary" }] },
      { name: "Connector1", kind: "rect", width: 80, height: 2, fillSemantic: "color/semantic/actions/primary/bg/default" },
      { name: "Step2", kind: "frame", layoutMode: "HORIZONTAL", primaryAxisSizing: "AUTO", counterAxisSizing: "AUTO", itemSpacing: 8, counterAxisAlign: "CENTER", children: [{ name: "Circle", kind: "ellipse", width: 32, height: 32, strokeSemantic: "color/semantic/actions/primary/bg/default", strokeWeight: 2 }, { name: "Label", kind: "text", textContent: "Review", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary" }] },
      { name: "Connector2", kind: "rect", width: 80, height: 2, fillSemantic: "color/semantic/border/default" },
      { name: "Step3", kind: "frame", layoutMode: "HORIZONTAL", primaryAxisSizing: "AUTO", counterAxisSizing: "AUTO", itemSpacing: 8, counterAxisAlign: "CENTER", children: [{ name: "Circle", kind: "ellipse", width: 32, height: 32, strokeSemantic: "color/semantic/border/default", strokeWeight: 2 }, { name: "Label", kind: "text", textContent: "Confirm", textPreset: "label/sm", textFillSemantic: "color/semantic/text/tertiary" }] },
    ],
  },
  variantProperties: [
    { name: "Orientation", values: ["horizontal", "vertical"], defaultValue: "horizontal" },
    { name: "Type", values: ["numbered", "icon"], defaultValue: "numbered" },
  ],
  tokenBindings: [
    { nodePath: "Step1.Circle", property: "fills", semanticToken: "color/semantic/actions/primary/bg/default" },
    { nodePath: "Connector1", property: "fills", semanticToken: "color/semantic/actions/primary/bg/default" },
  ],
};

const FILEUPLOADER: ComponentBlueprint = {
  name: "FileUploader",
  category: "forms",
  description: "File upload via drag-and-drop zone or button trigger",
  root: {
    name: "FileUploader",
    kind: "frame",
    width: 400,
    height: 160,
    layoutMode: "VERTICAL",
    primaryAxisAlign: "CENTER",
    counterAxisAlign: "CENTER",
    primaryAxisSizing: "FIXED",
    counterAxisSizing: "FIXED",
    itemSpacing: 8,
    cornerRadius: 8,
    strokeSemantic: "color/semantic/border/default",
    strokeWeight: 2,
    fillSemantic: "color/semantic/surface/subtle",
    children: [
      { name: "Icon", kind: "frame", width: 32, height: 32, fillSemantic: "color/semantic/text/tertiary" },
      { name: "Title", kind: "text", textContent: "Drag & drop files here", textPreset: "label/md", textFillSemantic: "color/semantic/text/primary" },
      { name: "Subtitle", kind: "text", textContent: "or click to browse (max 10MB)", textPreset: "body/sm", textFillSemantic: "color/semantic/text/tertiary" },
    ],
  },
  variantProperties: [
    { name: "Type", values: ["dropzone", "button"], defaultValue: "dropzone" },
    { name: "State", values: ["Idle", "DragOver", "Uploading", "Complete", "Error"], defaultValue: "Idle" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/surface/subtle" },
    { nodePath: "", property: "strokes", semanticToken: "color/semantic/border/default" },
  ],
};

const INLINEMESSAGE: ComponentBlueprint = {
  name: "InlineMessage",
  category: "feedback",
  description: "Contextual helper or error message associated with a form field",
  root: {
    name: "InlineMessage",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    itemSpacing: 4,
    counterAxisAlign: "CENTER",
    children: [
      { name: "Icon", kind: "frame", width: 14, height: 14, fillSemantic: "color/semantic/feedback/info/text" },
      { name: "Message", kind: "text", textContent: "This field is required", textPreset: "body/sm", textFillSemantic: "color/semantic/feedback/info/text" },
    ],
  },
  variantProperties: [
    { name: "Type", values: ["info", "success", "warning", "error"], defaultValue: "info" },
  ],
  tokenBindings: [
    { nodePath: "Icon", property: "fills", semanticToken: "color/semantic/feedback/info/text" },
    { nodePath: "Message", property: "fills", semanticToken: "color/semantic/feedback/info/text" },
  ],
};

const TOOLBAR: ComponentBlueprint = {
  name: "Toolbar",
  category: "navigation",
  description: "Horizontal action bar with grouped icon buttons and controls",
  root: {
    name: "Toolbar",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    height: 44,
    paddingX: 8,
    itemSpacing: 4,
    counterAxisAlign: "CENTER",
    fillSemantic: "color/semantic/surface/default",
    strokeSemantic: "color/semantic/border/subtle",
    strokeWeight: 1,
    cornerRadius: 8,
    children: [
      { name: "Action1", kind: "frame", width: 32, height: 32, cornerRadius: 6, primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER", children: [{ name: "Icon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/primary" }] },
      { name: "Action2", kind: "frame", width: 32, height: 32, cornerRadius: 6, primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER", children: [{ name: "Icon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/primary" }] },
      { name: "Separator", kind: "rect", width: 1, height: 20, fillSemantic: "color/semantic/border/subtle" },
      { name: "Action3", kind: "frame", width: 32, height: 32, cornerRadius: 6, primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER", children: [{ name: "Icon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/primary" }] },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md"], defaultValue: "md" },
    { name: "Overflow", values: ["visible", "menu"], defaultValue: "visible" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/surface/default" },
  ],
};

const CALENDAR: ComponentBlueprint = {
  name: "Calendar",
  category: "data",
  description: "Month-view calendar grid for date selection",
  root: {
    name: "Calendar",
    kind: "frame",
    width: 280,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    paddingX: 12,
    paddingY: 12,
    itemSpacing: 8,
    cornerRadius: 12,
    fillSemantic: "color/semantic/surface/default",
    strokeSemantic: "color/semantic/border/subtle",
    strokeWeight: 1,
    children: [
      { name: "MonthNav", kind: "frame", layoutMode: "HORIZONTAL", primaryAxisAlign: "SPACE_BETWEEN", primaryAxisSizing: "AUTO", counterAxisSizing: "AUTO", counterAxisAlign: "CENTER", children: [{ name: "Prev", kind: "frame", width: 24, height: 24, fillSemantic: "color/semantic/text/secondary" }, { name: "MonthYear", kind: "text", textContent: "April 2026", textPreset: "label/md", textFillSemantic: "color/semantic/text/primary" }, { name: "Next", kind: "frame", width: 24, height: 24, fillSemantic: "color/semantic/text/secondary" }] },
      { name: "WeekHeaders", kind: "frame", layoutMode: "HORIZONTAL", primaryAxisAlign: "SPACE_BETWEEN", primaryAxisSizing: "AUTO", counterAxisSizing: "AUTO", children: [{ name: "Sun", kind: "text", textContent: "S", textPreset: "label/sm", textFillSemantic: "color/semantic/text/tertiary" }, { name: "Mon", kind: "text", textContent: "M", textPreset: "label/sm", textFillSemantic: "color/semantic/text/tertiary" }, { name: "Tue", kind: "text", textContent: "T", textPreset: "label/sm", textFillSemantic: "color/semantic/text/tertiary" }, { name: "Wed", kind: "text", textContent: "W", textPreset: "label/sm", textFillSemantic: "color/semantic/text/tertiary" }, { name: "Thu", kind: "text", textContent: "T", textPreset: "label/sm", textFillSemantic: "color/semantic/text/tertiary" }, { name: "Fri", kind: "text", textContent: "F", textPreset: "label/sm", textFillSemantic: "color/semantic/text/tertiary" }, { name: "Sat", kind: "text", textContent: "S", textPreset: "label/sm", textFillSemantic: "color/semantic/text/tertiary" }] },
      { name: "DayGrid", kind: "frame", layoutMode: "HORIZONTAL", primaryAxisAlign: "SPACE_BETWEEN", primaryAxisSizing: "AUTO", counterAxisSizing: "AUTO", children: [{ name: "Day1", kind: "frame", width: 32, height: 32, cornerRadius: 16, primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER", fillSemantic: "color/semantic/actions/primary/bg/default", children: [{ name: "Num", kind: "text", textContent: "1", textPreset: "body/sm", textFillSemantic: "color/semantic/text/on-color" }] }, { name: "Day2", kind: "frame", width: 32, height: 32, cornerRadius: 16, primaryAxisAlign: "CENTER", counterAxisAlign: "CENTER", children: [{ name: "Num", kind: "text", textContent: "2", textPreset: "body/sm", textFillSemantic: "color/semantic/text/primary" }] }] },
    ],
  },
  variantProperties: [
    { name: "Type", values: ["single", "range"], defaultValue: "single" },
    { name: "Size", values: ["sm", "md"], defaultValue: "md" },
  ],
  tokenBindings: [
    { nodePath: "", property: "fills", semanticToken: "color/semantic/surface/default" },
    { nodePath: "DayGrid.Day1", property: "fills", semanticToken: "color/semantic/actions/primary/bg/default" },
  ],
};

const TIMEPICKER: ComponentBlueprint = {
  name: "TimePicker",
  category: "forms",
  description: "Time selection input with dropdown of time slots",
  root: {
    name: "TimePicker",
    kind: "frame",
    width: 200,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 4,
    children: [
      { name: "Label", kind: "text", textContent: "Time", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary" },
      {
        name: "Trigger",
        kind: "frame",
        height: 40,
        layoutMode: "HORIZONTAL",
        primaryAxisAlign: "SPACE_BETWEEN",
        counterAxisAlign: "CENTER",
        primaryAxisSizing: "AUTO",
        counterAxisSizing: "FIXED",
        paddingX: 12,
        cornerRadius: 6,
        fillSemantic: "color/semantic/field/bg/default",
        strokeSemantic: "color/semantic/field/border/default",
        strokeWeight: 1,
        children: [
          { name: "Value", kind: "text", textContent: "09:00 AM", textPreset: "body/md", textFillSemantic: "color/semantic/text/primary" },
          { name: "ClockIcon", kind: "frame", width: 16, height: 16, fillSemantic: "color/semantic/text/tertiary" },
        ],
      },
    ],
  },
  variantProperties: [
    { name: "Format", values: ["12h", "24h"], defaultValue: "12h" },
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
    { name: "State", values: ["Default", "Open", "Focused", "Error", "Disabled"], defaultValue: "Default" },
  ],
  tokenBindings: [
    { nodePath: "Trigger", property: "fills", semanticToken: "color/semantic/field/bg/default" },
    { nodePath: "Trigger", property: "strokes", semanticToken: "color/semantic/field/border/default" },
  ],
};

const RANGESLIDER: ComponentBlueprint = {
  name: "RangeSlider",
  category: "forms",
  description: "Dual-thumb slider for selecting a value range",
  root: {
    name: "RangeSlider",
    kind: "frame",
    width: 280,
    layoutMode: "VERTICAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "FIXED",
    itemSpacing: 8,
    children: [
      { name: "LabelRow", kind: "frame", layoutMode: "HORIZONTAL", primaryAxisAlign: "SPACE_BETWEEN", primaryAxisSizing: "AUTO", counterAxisSizing: "AUTO", children: [{ name: "Label", kind: "text", textContent: "Price range", textPreset: "label/sm", textFillSemantic: "color/semantic/text/primary" }, { name: "Values", kind: "text", textContent: "$20 – $80", textPreset: "label/sm", textFillSemantic: "color/semantic/text/secondary" }] },
      { name: "TrackContainer", kind: "frame", height: 24, layoutMode: "HORIZONTAL", counterAxisAlign: "CENTER", primaryAxisSizing: "AUTO", counterAxisSizing: "FIXED", children: [{ name: "Track", kind: "rect", width: 280, height: 4, cornerRadius: 2, fillSemantic: "color/semantic/border/default" }, { name: "Fill", kind: "rect", width: 168, height: 4, cornerRadius: 2, fillSemantic: "color/semantic/actions/primary/bg/default" }, { name: "ThumbMin", kind: "ellipse", width: 20, height: 20, fillSemantic: "color/semantic/surface/default", strokeSemantic: "color/semantic/actions/primary/bg/default", strokeWeight: 2 }, { name: "ThumbMax", kind: "ellipse", width: 20, height: 20, fillSemantic: "color/semantic/surface/default", strokeSemantic: "color/semantic/actions/primary/bg/default", strokeWeight: 2 }] },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md"], defaultValue: "md" },
    { name: "State", values: ["Default", "Hover", "Active", "Disabled"], defaultValue: "Default" },
  ],
  tokenBindings: [
    { nodePath: "TrackContainer.Fill", property: "fills", semanticToken: "color/semantic/actions/primary/bg/default" },
    { nodePath: "TrackContainer.ThumbMin", property: "strokes", semanticToken: "color/semantic/actions/primary/bg/default" },
    { nodePath: "TrackContainer.ThumbMax", property: "strokes", semanticToken: "color/semantic/actions/primary/bg/default" },
  ],
};

const INLINEEDIT: ComponentBlueprint = {
  name: "InlineEdit",
  category: "data",
  description: "Click-to-edit text field that toggles between read and edit modes",
  root: {
    name: "InlineEdit",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    itemSpacing: 4,
    counterAxisAlign: "CENTER",
    paddingX: 4,
    paddingY: 4,
    cornerRadius: 4,
    children: [
      { name: "Value", kind: "text", textContent: "Click to edit", textPreset: "body/md", textFillSemantic: "color/semantic/text/primary" },
      { name: "EditIcon", kind: "frame", width: 14, height: 14, fillSemantic: "color/semantic/text/tertiary", opacity: 0 },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
    { name: "State", values: ["ReadMode", "EditMode", "Saving", "Error"], defaultValue: "ReadMode" },
  ],
  tokenBindings: [],
};

// ─── Batch 6: Final ─────────────────────────────────────────────────────────

const STATUSDOT: ComponentBlueprint = {
  name: "StatusDot",
  category: "core",
  description: "Colored dot indicator for status with required text label",
  root: {
    name: "StatusDot",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    itemSpacing: 6,
    counterAxisAlign: "CENTER",
    children: [
      { name: "Dot", kind: "ellipse", width: 10, height: 10, fillSemantic: "color/semantic/feedback/success/text" },
      { name: "Label", kind: "text", textContent: "Online", textPreset: "body/sm", textFillSemantic: "color/semantic/text/primary" },
    ],
  },
  variantProperties: [
    { name: "Status", values: ["success", "warning", "error", "info", "neutral", "offline", "online"], defaultValue: "success" },
    { name: "Size", values: ["sm", "md"], defaultValue: "md" },
  ],
  tokenBindings: [
    { nodePath: "Dot", property: "fills", semanticToken: "color/semantic/feedback/success/text" },
  ],
};

const RATING: ComponentBlueprint = {
  name: "Rating",
  category: "forms",
  description: "Star-based rating input for user feedback or read-only display",
  root: {
    name: "Rating",
    kind: "frame",
    layoutMode: "HORIZONTAL",
    primaryAxisSizing: "AUTO",
    counterAxisSizing: "AUTO",
    itemSpacing: 4,
    counterAxisAlign: "CENTER",
    children: [
      { name: "Star1", kind: "frame", width: 24, height: 24, fillSemantic: "color/semantic/feedback/warning/text" },
      { name: "Star2", kind: "frame", width: 24, height: 24, fillSemantic: "color/semantic/feedback/warning/text" },
      { name: "Star3", kind: "frame", width: 24, height: 24, fillSemantic: "color/semantic/feedback/warning/text" },
      { name: "Star4", kind: "frame", width: 24, height: 24, fillSemantic: "color/semantic/border/default" },
      { name: "Star5", kind: "frame", width: 24, height: 24, fillSemantic: "color/semantic/border/default" },
      { name: "Value", kind: "text", textContent: "3.0", textPreset: "label/sm", textFillSemantic: "color/semantic/text/secondary" },
    ],
  },
  variantProperties: [
    { name: "Size", values: ["sm", "md", "lg"], defaultValue: "md" },
    { name: "State", values: ["Interactive", "ReadOnly", "Disabled"], defaultValue: "Interactive" },
  ],
  tokenBindings: [
    { nodePath: "Star1", property: "fills", semanticToken: "color/semantic/feedback/warning/text" },
    { nodePath: "Star4", property: "fills", semanticToken: "color/semantic/border/default" },
  ],
};

// ─── Aggregate ──────────────────────────────────────────────────────────────

export const COMPONENT_BLUEPRINTS: ComponentBlueprint[] = [
  // Original 17
  BUTTON, INPUT, SELECT, CHECKBOX, TOGGLE, RADIO,
  CARD, MODAL, TOAST, BADGE, AVATAR, TOOLTIP,
  TABS, BREADCRUMB, TAG, NAVBAR, TABLE,
  // Batch 1: Gap-fill + new Tier 1
  ACCORDION, SLIDER, ALERT, CHIP, PROGRESS, SIDENAVIGATION,
  ICON, LINK, MENU, SPINNER,
  // Batch 2: Tier 2 Forms
  TEXTAREA, SEARCH, COMBOBOX, DATEPICKER, NUMBERINPUT, FORM,
  // Batch 3: Nav + Data + Layout
  PAGINATION, LIST, TREEVIEW, TYPOGRAPHY, DIVIDER, SKELETON,
  // Batch 4: Overlay + Remaining
  POPOVER, DROPDOWNMENU, AVATARGROUP, GRID, EMPTYSTATE, BANNER,
  // Batch 5: Tier 3
  DRAWER, SEGMENTEDCONTROL, STEPPER, FILEUPLOADER, INLINEMESSAGE,
  TOOLBAR, CALENDAR, TIMEPICKER, RANGESLIDER, INLINEEDIT,
  // Batch 6: Final
  STATUSDOT, RATING,
];

/**
 * Get blueprints filtered by category.
 */
export function getBlueprintsByCategory(
  categories: Array<"core" | "forms" | "navigation" | "data" | "feedback" | "overlay" | "layout">
): ComponentBlueprint[] {
  return COMPONENT_BLUEPRINTS.filter((b) => categories.includes(b.category));
}

/**
 * Get a single blueprint by name.
 */
export function getBlueprint(name: string): ComponentBlueprint | undefined {
  return COMPONENT_BLUEPRINTS.find((b) => b.name.toLowerCase() === name.toLowerCase());
}
