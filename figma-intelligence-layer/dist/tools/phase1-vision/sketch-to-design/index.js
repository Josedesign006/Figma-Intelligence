"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sketchToDesignHandler = sketchToDesignHandler;
const promises_1 = __importDefault(require("fs/promises"));
const fuse_js_1 = __importDefault(require("fuse.js"));
const vision_client_js_1 = require("../../../shared/vision-client.js");
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function resolveImage(image) {
    if (image.startsWith("data:image") || image.startsWith("http")) {
        return image;
    }
    const buf = await promises_1.default.readFile(image);
    return `data:image/png;base64,${buf.toString("base64")}`;
}
function buildFuseIndex(componentSets) {
    return new fuse_js_1.default(componentSets, {
        keys: ["name", "description"],
        threshold: 0.35,
        includeScore: true,
        minMatchCharLength: 2,
    });
}
function matchZoneToDS(fuse, manifest, zone, strictDSOnly) {
    // Build a rich query from manifest and sketch zone intent
    const queryParts = [
        manifest.dsBestMatch,
        manifest.componentType,
        zone.intent,
        zone.label,
    ].filter(Boolean);
    if (queryParts.length === 0)
        return { component: null, confidence: 0 };
    const query = queryParts.join(" ");
    const results = fuse.search(query);
    if (results.length === 0)
        return { component: null, confidence: 0 };
    const best = results[0];
    const confidence = best.score !== undefined ? 1 - best.score : 0.5;
    // In strict mode, only accept highly confident DS matches
    const threshold = strictDSOnly ? 0.85 : 0.65;
    return {
        component: confidence >= threshold ? best.item : null,
        confidence,
    };
}
function buildFrameScript(frameWidth, matches, frameName, annotateInterpretations) {
    const matchData = matches.map((m) => ({
        label: m.zone.label,
        layoutType: m.zone.layoutType,
        intent: m.zone.intent ?? null,
        layoutDirection: m.zone.layoutDirection ?? "horizontal",
        dsId: m.dsComponent ? m.dsComponent.children[0]?.id ?? null : null,
        dsName: m.dsComponent ? m.dsComponent.name : null,
        confidence: m.confidence,
        unmatched: m.dsComponent === null,
    }));
    return `
(async () => {
  const frameWidth = ${frameWidth};
  const frameName = ${JSON.stringify(frameName)};
  const annotateInterpretations = ${annotateInterpretations};
  const matchData = ${JSON.stringify(matchData)};

  // Create root auto-layout frame
  const frame = figma.createFrame();
  frame.name = frameName;
  frame.resize(frameWidth, 900);
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "FIXED";
  frame.itemSpacing = 16;
  frame.paddingLeft = 0;
  frame.paddingRight = 0;
  frame.paddingTop = 0;
  frame.paddingBottom = 0;
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  figma.currentPage.appendChild(frame);

  const annotationStickyIds = [];

  for (const m of matchData) {
    let child;

    if (!m.unmatched && m.dsId) {
      const mainComp = await figma.getNodeByIdAsync(m.dsId);
      if (mainComp && mainComp.type === "COMPONENT") {
        child = mainComp.createInstance();
        child.name = m.dsName || m.label;
        child.layoutSizingHorizontal = "FILL";
        frame.appendChild(child);
      }
    }

    if (!child) {
      // Placeholder for unmatched zones
      child = figma.createFrame();
      child.name = "Sketch zone: " + m.label;
      child.resize(frameWidth, 80);
      child.layoutSizingHorizontal = "FILL";
      child.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } }];
      child.strokes = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.6 } }];
      child.strokeWeight = 1;
      child.dashPattern = [8, 4];

      // Add a label text inside the placeholder
      const label = figma.createText();
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      label.characters = m.label + (m.intent ? " — " + m.intent : "");
      label.fontSize = 14;
      label.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
      label.x = 16;
      label.y = 16;
      child.appendChild(label);
      frame.appendChild(child);
    }

    // Add interpretation sticky note for each zone
    if (annotateInterpretations && child) {
      const sticky = figma.createSticky();
      const interpretText = [
        "Zone: " + m.label,
        m.intent ? "Intent: " + m.intent : null,
        "Layout: " + m.layoutType + " (" + m.layoutDirection + ")",
        m.dsName ? "DS: " + m.dsName + " (" + (m.confidence * 100).toFixed(0) + "% match)" : "No DS match",
      ].filter(Boolean).join("\\n");
      sticky.text.characters = interpretText;
      sticky.x = frame.x + frameWidth + 24;
      sticky.y = child.absoluteBoundingBox ? child.absoluteBoundingBox.y : frame.y;
      figma.currentPage.appendChild(sticky);
      annotationStickyIds.push(sticky.id);
    }
  }

  figma.viewport.scrollAndZoomIntoView([frame]);
  return { frameId: frame.id, nodeId: frame.id, annotationCount: annotationStickyIds.length };
})();
`;
}
// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
async function sketchToDesignHandler(args) {
    const { image, productContext = "General product UI", strictDSOnly = false, frameWidth = 1440, annotateInterpretations = false, } = args;
    // 1. Resolve image to base64
    const resolvedImage = await resolveImage(image);
    // 2. Interpret sketch zones
    const vision = new vision_client_js_1.VisionClient();
    const zones = await vision.interpretSketch(resolvedImage, productContext);
    if (zones.length === 0) {
        throw new Error("sketchToDesignHandler: VisionClient.interpretSketch() returned no zones — ensure the image contains a legible wireframe or sketch");
    }
    // 3. Identify each zone with component manifest
    const manifests = await Promise.all(zones.map((zone) => vision.identify(zone.zoneImage ?? resolvedImage)));
    // 4. Load DS components
    const bridge = await (0, figma_bridge_js_1.getBridge)();
    const componentSets = await bridge.getComponentSets();
    if (strictDSOnly && componentSets.length === 0) {
        throw new Error("sketchToDesignHandler: strictDSOnly=true but no design system components found in this file");
    }
    // 5. Match each zone to a DS component
    const fuse = buildFuseIndex(componentSets);
    const matches = zones.map((zone, i) => {
        const enrichedZone = zone;
        const manifest = manifests[i];
        const { component, confidence } = matchZoneToDS(fuse, manifest, enrichedZone, strictDSOnly);
        return { zone: enrichedZone, manifest, dsComponent: component, confidence };
    });
    // 6. Build frame via bridge
    const frameName = `[Sketch → Design] ${new Date().toLocaleDateString("en-US")} — ${productContext.slice(0, 40)}`;
    const script = buildFrameScript(frameWidth, matches, frameName, annotateInterpretations);
    const execResult = await bridge.execute(script);
    if (!execResult.success) {
        throw new Error(`sketchToDesignHandler: Figma execution failed — ${execResult.error}`);
    }
    const execData = execResult.result;
    // 7. Compute stats
    const matched = matches.filter((m) => m.dsComponent !== null).length;
    const unmatched = matches.length - matched;
    const unmatchedZones = matches
        .filter((m) => m.dsComponent === null)
        .map((m) => `${m.zone.label}${m.zone.intent ? ` (${m.zone.intent})` : ""} — confidence: ${m.confidence.toFixed(2)}`);
    const tokenCoverage = zones.length > 0 ? `${Math.round((matched / zones.length) * 100)}%` : "0%";
    // 8. Log action
    await decision_log_js_1.decisionLog.log({
        tool: "figma_sketch_to_design",
        nodeIds: [execData.frameId],
        rationale: `Converted sketch to design with ${zones.length} zones. Product context: "${productContext}". DS coverage: ${tokenCoverage} (${matched}/${zones.length} matched). strictDSOnly: ${strictDSOnly}.`,
        reversible: true,
        metadata: {
            productContext,
            strictDSOnly,
            frameWidth,
            zones: zones.length,
            matched,
            unmatched,
            unmatchedZones,
        },
    });
    return {
        frameId: execData.frameId,
        zones: zones.length,
        matched,
        unmatched,
        unmatchedZones,
        tokenCoverage,
        generatedFrame: { nodeId: execData.nodeId },
        productContext,
    };
}
//# sourceMappingURL=index.js.map