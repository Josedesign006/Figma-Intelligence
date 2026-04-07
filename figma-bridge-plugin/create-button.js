#!/usr/bin/env node
const WebSocket = require("ws");

const code = `
// ── Create Button Component with all variant properties ──

var page = figma.currentPage;

// Helper to create a single button variant
async function createButtonVariant(opts) {
  var frame = figma.createFrame();
  frame.name = "Size=" + opts.size + ", Style=" + opts.style + ", State=" + opts.state + ", IconPosition=" + opts.iconPos;
  frame.layoutMode = "HORIZONTAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  frame.primaryAxisAlignItems = "CENTER";
  frame.counterAxisAlignItems = "CENTER";
  frame.itemSpacing = 8;
  frame.cornerRadius = opts.radius;

  // Padding by size
  var padH = opts.size === "sm" ? 12 : opts.size === "md" ? 16 : 20;
  var padV = opts.size === "sm" ? 6 : opts.size === "md" ? 10 : 14;
  frame.paddingLeft = padH;
  frame.paddingRight = padH;
  frame.paddingTop = padV;
  frame.paddingBottom = padV;

  // Colors by style & state
  var bgColor, textColor, borderColor, bgOpacity;
  bgOpacity = 1;

  if (opts.style === "Primary") {
    bgColor = { r: 0.15, g: 0.39, b: 0.92 };  // #2563EB
    textColor = { r: 1, g: 1, b: 1 };
    borderColor = null;
  } else if (opts.style === "Secondary") {
    bgColor = { r: 0.93, g: 0.95, b: 1 };     // #EDF0FF
    textColor = { r: 0.15, g: 0.39, b: 0.92 };
    borderColor = null;
  } else if (opts.style === "Outline") {
    bgColor = { r: 1, g: 1, b: 1 };
    textColor = { r: 0.15, g: 0.39, b: 0.92 };
    borderColor = { r: 0.15, g: 0.39, b: 0.92 };
  } else if (opts.style === "Ghost") {
    bgColor = { r: 1, g: 1, b: 1 };
    textColor = { r: 0.15, g: 0.39, b: 0.92 };
    bgOpacity = 0;
    borderColor = null;
  } else if (opts.style === "Destructive") {
    bgColor = { r: 0.86, g: 0.15, b: 0.15 };  // #DC2626
    textColor = { r: 1, g: 1, b: 1 };
    borderColor = null;
  }

  // State modifications
  if (opts.state === "Hover") {
    bgColor = { r: bgColor.r * 0.85, g: bgColor.g * 0.85, b: bgColor.b * 0.85 };
  } else if (opts.state === "Pressed") {
    bgColor = { r: bgColor.r * 0.7, g: bgColor.g * 0.7, b: bgColor.b * 0.7 };
  } else if (opts.state === "Disabled") {
    bgOpacity = 0.4;
  } else if (opts.state === "Loading") {
    bgOpacity = 0.7;
  } else if (opts.state === "Focused") {
    // Add focus ring effect later
  }

  frame.fills = [{ type: "SOLID", color: bgColor, opacity: bgOpacity }];

  if (borderColor) {
    frame.strokes = [{ type: "SOLID", color: borderColor }];
    frame.strokeWeight = 1.5;
    frame.strokeAlign = "INSIDE";
  }

  // Icon size by button size
  var iconSize = opts.size === "sm" ? 16 : opts.size === "md" ? 20 : 24;

  // Leading icon
  if (opts.iconPos === "Left" || opts.iconPos === "Both") {
    var leadIcon = figma.createRectangle();
    leadIcon.name = "Icon-Left";
    leadIcon.resize(iconSize, iconSize);
    leadIcon.fills = [{ type: "SOLID", color: textColor }];
    leadIcon.cornerRadius = 3;
    leadIcon.opacity = 0.85;
    frame.appendChild(leadIcon);
  }

  // Label
  var fontSize = opts.size === "sm" ? 12 : opts.size === "md" ? 14 : 16;
  var fontStyle = opts.size === "lg" ? "Bold" : "Semi Bold";

  await figma.loadFontAsync({ family: "Inter", style: fontStyle });
  var label = figma.createText();
  label.name = "Label";
  label.fontName = { family: "Inter", style: fontStyle };
  label.characters = "Button";
  label.fontSize = fontSize;
  label.fills = [{ type: "SOLID", color: textColor }];
  frame.appendChild(label);

  // Loading spinner (just an indicator rect for Loading state)
  if (opts.state === "Loading") {
    label.opacity = 0;
    var spinner = figma.createEllipse();
    spinner.name = "Spinner";
    spinner.resize(iconSize, iconSize);
    spinner.fills = [];
    spinner.strokes = [{ type: "SOLID", color: textColor }];
    spinner.strokeWeight = 2;
    spinner.dashPattern = [6, 4];
    frame.insertChild(frame.children.length, spinner);
  }

  // Trailing icon
  if (opts.iconPos === "Right" || opts.iconPos === "Both") {
    var trailIcon = figma.createRectangle();
    trailIcon.name = "Icon-Right";
    trailIcon.resize(iconSize, iconSize);
    trailIcon.fills = [{ type: "SOLID", color: textColor }];
    trailIcon.cornerRadius = 3;
    trailIcon.opacity = 0.85;
    frame.appendChild(trailIcon);
  }

  return frame;
}

// ── Generate all variant combos ──
var sizes = ["sm", "md", "lg"];
var styles = ["Primary", "Secondary", "Outline", "Ghost", "Destructive"];
var states = ["Default", "Hover", "Pressed", "Focused", "Disabled", "Loading"];
var iconPositions = ["None", "Left", "Right", "Both"];

var radiusMap = { sm: 6, md: 8, lg: 10 };
var allVariants = [];

for (var si = 0; si < sizes.length; si++) {
  for (var sti = 0; sti < styles.length; sti++) {
    for (var sta = 0; sta < states.length; sta++) {
      for (var ip = 0; ip < iconPositions.length; ip++) {
        allVariants.push({
          size: sizes[si],
          style: styles[sti],
          state: states[sta],
          iconPos: iconPositions[ip],
          radius: radiusMap[sizes[si]],
        });
      }
    }
  }
}

// Create variants in batches to avoid timeout
var components = [];
for (var i = 0; i < allVariants.length; i++) {
  var v = allVariants[i];
  var frame = await createButtonVariant(v);
  page.appendChild(frame);
  var comp = figma.createComponentFromNode(frame);
  components.push(comp);
}

// Combine into a component set
if (components.length > 1) {
  var set = figma.combineAsVariants(components, page);
  set.name = "Button";
  set.description = "Button component with Size, Style, State, and IconPosition variant properties.\\n\\nSizes: sm, md, lg\\nStyles: Primary, Secondary, Outline, Ghost, Destructive\\nStates: Default, Hover, Pressed, Focused, Disabled, Loading\\nIcon Position: None, Left, Right, Both";
  set.layoutMode = "VERTICAL";
  set.primaryAxisSizingMode = "AUTO";
  set.counterAxisSizingMode = "AUTO";
  set.itemSpacing = 16;
  set.paddingLeft = 24;
  set.paddingRight = 24;
  set.paddingTop = 24;
  set.paddingBottom = 24;
  set.x = 200;
  set.y = 200;
  figma.viewport.scrollAndZoomIntoView([set]);

  return {
    componentSetId: set.id,
    name: set.name,
    variantCount: components.length,
    properties: {
      Size: sizes,
      Style: styles,
      State: states,
      IconPosition: iconPositions,
    },
  };
}

return { error: "Not enough variants created" };
`;

const { readFileSync, existsSync } = require("fs");
const { join } = require("path");
const { homedir } = require("os");
function getRelayPort() {
  try {
    const p = readFileSync(join(homedir(), ".figma-intelligence", "relay.port"), "utf8").trim();
    const n = parseInt(p, 10);
    if (n > 0 && n < 65536) return n;
  } catch {}
  return 9001;
}
const ws = new WebSocket(`ws://localhost:${getRelayPort()}`);
ws.on("open", () => {
  console.log("Connected to relay, sending button creation command...");
  console.log("Creating " + 3*5*6*4 + " variants (3 sizes x 5 styles x 6 states x 4 icon positions)...");
  ws.send(JSON.stringify({ id: "btn-gen", method: "execute", params: { code } }));
});
ws.on("message", (data) => {
  const resp = JSON.parse(data.toString());
  if (resp.error) {
    console.error("Error:", resp.error);
  } else {
    console.log("Success:", JSON.stringify(resp.result, null, 2));
  }
  ws.close();
  process.exit(0);
});
ws.on("error", (e) => { console.error("WS Error:", e.message); process.exit(1); });
setTimeout(() => { console.log("Timeout - 360 variants may take a while. Check Figma."); process.exit(0); }, 120000);
