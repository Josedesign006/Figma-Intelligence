// ─────────────────────────────────────────────────────────────────────────────
// Design Decision Log Tool
// Generates a styled Figma frame documenting UX design decisions for a screen.
// Produces: header with status badges, title, description, metadata row,
// and numbered decision cards with source badges — all using Auto Layout.
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DesignDecisionLogArgs {
  /** Frame title (e.g. "Login Screen Design Decisions") */
  name: string;
  /** Detailed description of the screen and key design choices */
  description: string;
  /** Decision status badge text */
  status?: "Approved" | "Under review" | "Requires revisions" | "Blocked" | "In progress" | "Info";
  /** Category badge text */
  category?: string;
  /** Page name context (e.g. "prototype example") */
  pageName?: string;
  /** Number of screens covered */
  screenCount?: number;
  /** Decision entries with UX rationale */
  decisions: Array<{
    /** Decision title (e.g. "Linear Checkout Flow") */
    title: string;
    /** Detailed rationale text */
    rationale: string;
    /** Source attribution (e.g. "NN Group", "Baymard Institute", "UX Best Practice") */
    source: string;
  }>;
  /** Place the frame near this node ID */
  nearNodeId?: string;
}

export interface DesignDecisionLogResult {
  success: boolean;
  nodeId?: string;
  message: string;
}

// ─── Color constants ──────────────────────────────────────────────────────────

const COLORS = {
  // Header gradient
  headerBg: { r: 0.12, g: 0.31, b: 0.42 },        // #1E4F6B dark teal
  headerText: { r: 1, g: 1, b: 1 },                 // white

  // Status badges
  approvedBg: { r: 0.86, g: 0.99, b: 0.89 },       // #DCFCE7 light green
  approvedText: { r: 0.09, g: 0.40, b: 0.20 },     // #166534 dark green
  reviewBg: { r: 0.88, g: 0.95, b: 0.99 },          // #E0F2FE light blue
  reviewText: { r: 0.04, g: 0.31, b: 0.54 },        // #0B4F8A dark blue
  blockedBg: { r: 1.0, g: 0.93, b: 0.93 },          // #FFEDED light red
  blockedText: { r: 0.60, g: 0.11, b: 0.11 },       // #991B1B dark red
  progressBg: { r: 1.0, g: 0.98, b: 0.89 },         // #FFF9E3 light yellow
  progressText: { r: 0.55, g: 0.42, b: 0.05 },      // #8C6B0D dark yellow
  categoryBg: { r: 0.24, g: 0.38, b: 0.50 },        // #3D6180 blue-gray
  categoryText: { r: 1, g: 1, b: 1 },                // white

  // Body
  bodyBg: { r: 1, g: 1, b: 1 },                     // white
  cardBg: { r: 0.98, g: 0.99, b: 1.0 },             // #FAFCFF very light blue
  cardBorder: { r: 0.89, g: 0.93, b: 0.96 },        // #E3ECFA light blue border

  // Text
  titleText: { r: 0.07, g: 0.07, b: 0.07 },         // #111111
  bodyText: { r: 0.25, g: 0.25, b: 0.30 },           // #40404D
  metaLabel: { r: 0.33, g: 0.46, b: 0.55 },          // #55758C
  metaValue: { r: 0.13, g: 0.13, b: 0.17 },          // #21212B

  // Number circle
  numBg: { r: 0.16, g: 0.44, b: 0.60 },              // #297099 teal
  numText: { r: 1, g: 1, b: 1 },                     // white

  // Source badge
  sourceBg: { r: 0.93, g: 0.96, b: 0.99 },          // #EDF5FE light blue
  sourceText: { r: 0.16, g: 0.44, b: 0.60 },         // #297099 teal
  sourceBorder: { r: 0.82, g: 0.89, b: 0.95 },       // #D1E3F2

  // Divider
  divider: { r: 0.88, g: 0.91, b: 0.94 },            // #E0E8F0
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function designDecisionLogHandler(
  args: DesignDecisionLogArgs
): Promise<DesignDecisionLogResult> {
  const {
    name,
    description,
    status = "Approved",
    category = "Design Research",
    pageName,
    screenCount,
    decisions,
    nearNodeId,
  } = args;

  if (!name) throw new Error("designDecisionLog: name is required.");
  if (!description) throw new Error("designDecisionLog: description is required.");
  if (!decisions || decisions.length === 0) {
    throw new Error("designDecisionLog: at least one decision entry is required.");
  }

  const bridge = await getBridge();

  // Pre-serialize data for embedding in the execute script
  const dataJson = JSON.stringify({
    name,
    description,
    status,
    category,
    pageName: pageName || "",
    screenCount: screenCount || 0,
    decisionCount: decisions.length,
    date: new Date().toISOString().slice(0, 10),
    decisions: decisions.map((d) => ({
      title: d.title,
      rationale: d.rationale,
      source: d.source || "UX Best Practice",
    })),
  });
  const nearIdJson = nearNodeId ? JSON.stringify(nearNodeId) : "null";

  const script = `
(async () => {
  var D = ${dataJson};
  var NEAR_ID = ${nearIdJson};

  // ── Colors ──────────────────────────────────────────────
  var C = ${JSON.stringify(COLORS)};

  // ── Helpers ─────────────────────────────────────────────
  function rgb(c) { return { r: c.r, g: c.g, b: c.b }; }
  function solid(c) { return [{ type: "SOLID", color: rgb(c) }]; }
  function solidOpacity(c, o) { return [{ type: "SOLID", color: rgb(c), opacity: o }]; }
  function stroke(c) { return [{ type: "SOLID", color: rgb(c) }]; }

  var fontsLoaded = {};
  async function loadFont(family, style) {
    var key = family + "-" + style;
    if (!fontsLoaded[key]) {
      await figma.loadFontAsync({ family: family, style: style });
      fontsLoaded[key] = true;
    }
  }

  await loadFont("Inter", "Bold");
  await loadFont("Inter", "Semi Bold");
  await loadFont("Inter", "Medium");
  await loadFont("Inter", "Regular");

  // ── Status badge color mapping ──────────────────────────
  function statusColors(s) {
    var lc = s.toLowerCase();
    if (lc === "approved") return { bg: C.approvedBg, text: C.approvedText };
    if (lc === "under review") return { bg: C.reviewBg, text: C.reviewText };
    if (lc === "blocked" || lc === "requires revisions") return { bg: C.blockedBg, text: C.blockedText };
    if (lc === "in progress") return { bg: C.progressBg, text: C.progressText };
    return { bg: C.reviewBg, text: C.reviewText };
  }

  // ── Root frame ──────────────────────────────────────────
  var root = figma.createFrame();
  root.name = "Design Decision — " + D.name;
  root.layoutMode = "VERTICAL";
  root.layoutSizingHorizontal = "FIXED";
  root.layoutSizingVertical = "HUG";
  root.resize(800, 100);
  root.cornerRadius = 16;
  root.clipsContent = true;
  root.fills = solid(C.bodyBg);
  root.strokes = stroke(C.cardBorder);
  root.strokeWeight = 1;

  // ── Header section (dark teal bg) ───────────────────────
  var header = figma.createFrame();
  header.name = "Header";
  header.layoutMode = "VERTICAL";
  header.layoutSizingHorizontal = "FILL";
  header.layoutSizingVertical = "HUG";
  header.paddingTop = 32;
  header.paddingBottom = 32;
  header.paddingLeft = 40;
  header.paddingRight = 40;
  header.itemSpacing = 16;
  header.fills = solid(C.headerBg);
  root.appendChild(header);

  // Badges row
  var badgeRow = figma.createFrame();
  badgeRow.name = "Status Badges";
  badgeRow.layoutMode = "HORIZONTAL";
  badgeRow.layoutSizingHorizontal = "HUG";
  badgeRow.layoutSizingVertical = "HUG";
  badgeRow.itemSpacing = 12;
  badgeRow.fills = [];
  header.appendChild(badgeRow);

  // Status badge
  var sc = statusColors(D.status);
  var statusBadge = figma.createFrame();
  statusBadge.name = "Status";
  statusBadge.layoutMode = "HORIZONTAL";
  statusBadge.layoutSizingHorizontal = "HUG";
  statusBadge.layoutSizingVertical = "HUG";
  statusBadge.paddingTop = 6; statusBadge.paddingBottom = 6;
  statusBadge.paddingLeft = 14; statusBadge.paddingRight = 14;
  statusBadge.cornerRadius = 6;
  statusBadge.fills = solid(sc.bg);
  badgeRow.appendChild(statusBadge);

  var statusText = figma.createText();
  statusText.fontName = { family: "Inter", style: "Bold" };
  statusText.characters = D.status.toUpperCase();
  statusText.fontSize = 12;
  statusText.letterSpacing = { value: 8, unit: "PERCENT" };
  statusText.fills = solid(sc.text);
  statusText.layoutSizingHorizontal = "HUG";
  statusText.layoutSizingVertical = "HUG";
  statusBadge.appendChild(statusText);

  // Category badge
  var catBadge = figma.createFrame();
  catBadge.name = "Category";
  catBadge.layoutMode = "HORIZONTAL";
  catBadge.layoutSizingHorizontal = "HUG";
  catBadge.layoutSizingVertical = "HUG";
  catBadge.paddingTop = 6; catBadge.paddingBottom = 6;
  catBadge.paddingLeft = 14; catBadge.paddingRight = 14;
  catBadge.cornerRadius = 6;
  catBadge.fills = solid(C.categoryBg);
  badgeRow.appendChild(catBadge);

  var catText = figma.createText();
  catText.fontName = { family: "Inter", style: "Bold" };
  catText.characters = D.category.toUpperCase();
  catText.fontSize = 12;
  catText.letterSpacing = { value: 8, unit: "PERCENT" };
  catText.fills = solid(C.categoryText);
  catText.layoutSizingHorizontal = "HUG";
  catText.layoutSizingVertical = "HUG";
  catBadge.appendChild(catText);

  // Title
  var title = figma.createText();
  title.fontName = { family: "Inter", style: "Bold" };
  title.characters = D.name;
  title.fontSize = 32;
  title.fills = solid(C.headerText);
  title.layoutSizingHorizontal = "FILL";
  title.layoutSizingVertical = "HUG";
  header.appendChild(title);

  // Description
  var desc = figma.createText();
  desc.fontName = { family: "Inter", style: "Regular" };
  desc.characters = D.description;
  desc.fontSize = 16;
  desc.lineHeight = { value: 24, unit: "PIXELS" };
  desc.fills = solidOpacity(C.headerText, 0.8);
  desc.layoutSizingHorizontal = "FILL";
  desc.layoutSizingVertical = "HUG";
  header.appendChild(desc);

  // ── Metadata row ────────────────────────────────────────
  var metaRow = figma.createFrame();
  metaRow.name = "Metadata";
  metaRow.layoutMode = "HORIZONTAL";
  metaRow.layoutSizingHorizontal = "FILL";
  metaRow.layoutSizingVertical = "HUG";
  metaRow.paddingTop = 16; metaRow.paddingBottom = 16;
  metaRow.paddingLeft = 40; metaRow.paddingRight = 40;
  metaRow.itemSpacing = 32;
  metaRow.fills = solid(C.cardBg);
  metaRow.strokes = stroke(C.divider);
  metaRow.strokeWeight = 1;
  metaRow.strokesIncludedInLayout = true;
  root.appendChild(metaRow);

  function addMetaPair(parent, label, value) {
    var pair = figma.createFrame();
    pair.name = label;
    pair.layoutMode = "HORIZONTAL";
    pair.layoutSizingHorizontal = "HUG";
    pair.layoutSizingVertical = "HUG";
    pair.itemSpacing = 6;
    pair.fills = [];
    parent.appendChild(pair);

    var lbl = figma.createText();
    lbl.fontName = { family: "Inter", style: "Semi Bold" };
    lbl.characters = label + ":";
    lbl.fontSize = 13;
    lbl.fills = solid(C.metaLabel);
    lbl.layoutSizingHorizontal = "HUG";
    lbl.layoutSizingVertical = "HUG";
    pair.appendChild(lbl);

    var val = figma.createText();
    val.fontName = { family: "Inter", style: "Medium" };
    val.characters = String(value);
    val.fontSize = 13;
    val.fills = solid(C.metaValue);
    val.layoutSizingHorizontal = "HUG";
    val.layoutSizingVertical = "HUG";
    pair.appendChild(val);
  }

  if (D.pageName) addMetaPair(metaRow, "Page", D.pageName);
  if (D.screenCount > 0) addMetaPair(metaRow, "Screens", String(D.screenCount));
  addMetaPair(metaRow, "Decisions", String(D.decisionCount));
  addMetaPair(metaRow, "Date", D.date);

  // ── Decision cards container ────────────────────────────
  var cardsContainer = figma.createFrame();
  cardsContainer.name = "Decision Cards";
  cardsContainer.layoutMode = "VERTICAL";
  cardsContainer.layoutSizingHorizontal = "FILL";
  cardsContainer.layoutSizingVertical = "HUG";
  cardsContainer.paddingTop = 8; cardsContainer.paddingBottom = 24;
  cardsContainer.paddingLeft = 40; cardsContainer.paddingRight = 40;
  cardsContainer.itemSpacing = 12;
  cardsContainer.fills = [];
  root.appendChild(cardsContainer);

  // ── Build each decision card ────────────────────────────
  for (var i = 0; i < D.decisions.length; i++) {
    var dec = D.decisions[i];
    var num = String(i + 1).padStart(2, "0");

    // Card frame
    var card = figma.createFrame();
    card.name = "Decision " + num;
    card.layoutMode = "HORIZONTAL";
    card.layoutSizingHorizontal = "FILL";
    card.layoutSizingVertical = "HUG";
    card.paddingTop = 24; card.paddingBottom = 24;
    card.paddingLeft = 24; card.paddingRight = 24;
    card.itemSpacing = 20;
    card.cornerRadius = 12;
    card.fills = solid(C.cardBg);
    card.strokes = stroke(C.cardBorder);
    card.strokeWeight = 1;
    cardsContainer.appendChild(card);

    // Number circle
    var numCircle = figma.createFrame();
    numCircle.name = "Number";
    numCircle.layoutMode = "HORIZONTAL";
    numCircle.layoutSizingHorizontal = "FIXED";
    numCircle.layoutSizingVertical = "FIXED";
    numCircle.resize(42, 42);
    numCircle.cornerRadius = 21;
    numCircle.fills = solid(C.numBg);
    numCircle.primaryAxisAlignItems = "CENTER";
    numCircle.counterAxisAlignItems = "CENTER";
    card.appendChild(numCircle);

    var numTxt = figma.createText();
    numTxt.fontName = { family: "Inter", style: "Bold" };
    numTxt.characters = num;
    numTxt.fontSize = 16;
    numTxt.fills = solid(C.numText);
    numTxt.layoutSizingHorizontal = "HUG";
    numTxt.layoutSizingVertical = "HUG";
    numCircle.appendChild(numTxt);

    // Content column (title row + rationale)
    var contentCol = figma.createFrame();
    contentCol.name = "Content";
    contentCol.layoutMode = "VERTICAL";
    contentCol.layoutSizingHorizontal = "FILL";
    contentCol.layoutSizingVertical = "HUG";
    contentCol.itemSpacing = 10;
    contentCol.fills = [];
    card.appendChild(contentCol);

    // Title row: title text + source badge
    var titleRow = figma.createFrame();
    titleRow.name = "Title Row";
    titleRow.layoutMode = "HORIZONTAL";
    titleRow.layoutSizingHorizontal = "FILL";
    titleRow.layoutSizingVertical = "HUG";
    titleRow.primaryAxisAlignItems = "SPACE_BETWEEN";
    titleRow.counterAxisAlignItems = "CENTER";
    titleRow.fills = [];
    contentCol.appendChild(titleRow);

    var decTitle = figma.createText();
    decTitle.fontName = { family: "Inter", style: "Semi Bold" };
    decTitle.characters = dec.title;
    decTitle.fontSize = 17;
    decTitle.fills = solid(C.titleText);
    decTitle.layoutSizingHorizontal = "FILL";
    decTitle.layoutSizingVertical = "HUG";
    titleRow.appendChild(decTitle);

    // Source badge
    var srcBadge = figma.createFrame();
    srcBadge.name = "Source";
    srcBadge.layoutMode = "HORIZONTAL";
    srcBadge.layoutSizingHorizontal = "HUG";
    srcBadge.layoutSizingVertical = "HUG";
    srcBadge.paddingTop = 4; srcBadge.paddingBottom = 4;
    srcBadge.paddingLeft = 10; srcBadge.paddingRight = 10;
    srcBadge.cornerRadius = 6;
    srcBadge.fills = solid(C.sourceBg);
    srcBadge.strokes = stroke(C.sourceBorder);
    srcBadge.strokeWeight = 1;
    titleRow.appendChild(srcBadge);

    var srcText = figma.createText();
    srcText.fontName = { family: "Inter", style: "Medium" };
    srcText.characters = dec.source;
    srcText.fontSize = 12;
    srcText.fills = solid(C.sourceText);
    srcText.layoutSizingHorizontal = "HUG";
    srcText.layoutSizingVertical = "HUG";
    srcBadge.appendChild(srcText);

    // Rationale text
    var rationale = figma.createText();
    rationale.fontName = { family: "Inter", style: "Regular" };
    rationale.characters = dec.rationale;
    rationale.fontSize = 15;
    rationale.lineHeight = { value: 23, unit: "PIXELS" };
    rationale.fills = solid(C.bodyText);
    rationale.layoutSizingHorizontal = "FILL";
    rationale.layoutSizingVertical = "HUG";
    contentCol.appendChild(rationale);
  }

  // ── Position the frame ──────────────────────────────────
  if (NEAR_ID) {
    var target = await figma.getNodeByIdAsync(NEAR_ID);
    if (target && "x" in target && "width" in target) {
      root.x = target.x + target.width + 100;
      root.y = target.y;
    }
  }
  if (!NEAR_ID || root.x === 0) {
    var maxX = 0;
    for (var j = 0; j < figma.currentPage.children.length; j++) {
      var child = figma.currentPage.children[j];
      if (child.id !== root.id && "x" in child && "width" in child) {
        var right = child.x + child.width;
        if (right > maxX) maxX = right;
      }
    }
    root.x = maxX + 200;
    root.y = 0;
  }

  figma.viewport.scrollAndZoomIntoView([root]);

  return {
    success: true,
    nodeId: root.id,
    message: "Design Decision Log created: '" + D.name + "' with " + D.decisionCount + " decisions."
  };
})()
`;

  const result = await bridge.execute(script, 60000); // 60s timeout for font loading + node creation
  if (!result.success) {
    return {
      success: false,
      message: `Failed to create Design Decision Log: ${result.error}`,
    };
  }
  const output = result.result as DesignDecisionLogResult;

  // Audit trail
  if (output.success && output.nodeId) {
    decisionLog.log({
      tool: "figma_design_decision_log",
      nodeIds: [output.nodeId],
      rationale: `Created Design Decision Log "${name}" with ${decisions.length} entries. Status: ${status}, Category: ${category}.`,
      tokens: [],
      reversible: true,
    });
  }

  return output;
}
