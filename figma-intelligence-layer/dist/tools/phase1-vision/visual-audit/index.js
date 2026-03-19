"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visualAuditHandler = visualAuditHandler;
const vision_client_js_1 = require("../../../shared/vision-client.js");
const figma_bridge_js_1 = require("../../../shared/figma-bridge.js");
const decision_log_js_1 = require("../../../shared/decision-log.js");
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function sanitiseAuditData(raw) {
    return {
        hierarchyScore: typeof raw.hierarchyScore === "number" ? raw.hierarchyScore : 50,
        cognitiveLoadRating: raw.cognitiveLoadRating === "low" ||
            raw.cognitiveLoadRating === "medium" ||
            raw.cognitiveLoadRating === "high"
            ? raw.cognitiveLoadRating
            : "medium",
        brandAlignmentNotes: typeof raw.brandAlignmentNotes === "string" ? raw.brandAlignmentNotes : "",
        consistencyIssues: Array.isArray(raw.consistencyIssues)
            ? raw.consistencyIssues
            : [],
        overallScore: typeof raw.overallScore === "number" ? raw.overallScore : 50,
        topIssues: Array.isArray(raw.topIssues)
            ? raw.topIssues
            : [],
        estimatedFixTimeMinutes: typeof raw.estimatedFixTimeMinutes === "number"
            ? raw.estimatedFixTimeMinutes
            : 0,
        auditAreas: [],
    };
}
function buildAnnotationScript(issues, pageName) {
    return `
(async () => {
  const pageName = ${JSON.stringify(pageName)};
  const issues = ${JSON.stringify(issues)};

  // Create or find the audit page
  let auditPage = figma.root.children.find(p => p.name === pageName);
  if (!auditPage) {
    auditPage = figma.createPage();
    auditPage.name = pageName;
  }
  await figma.setCurrentPageAsync(auditPage);

  const severityColors = {
    error:      { r: 0.96, g: 0.26, b: 0.21 },
    warning:    { r: 1,    g: 0.76, b: 0    },
    suggestion: { r: 0.13, g: 0.59, b: 0.95 },
  };

  const created = [];
  issues.forEach((issue, idx) => {
    const sticky = figma.createSticky();
    sticky.text.characters =
      "[" + issue.severity.toUpperCase() + "] " + issue.area + "\\n" + issue.description;
    sticky.x = (idx % 4) * 320;
    sticky.y = Math.floor(idx / 4) * 240;
    const color = severityColors[issue.severity] || severityColors.suggestion;
    sticky.fills = [{ type: "SOLID", color }];
    auditPage.appendChild(sticky);
    created.push(sticky.id);
  });

  const createdNodes = [];
  for (const id of created) {
    const n = await figma.getNodeByIdAsync(id);
    if (n) createdNodes.push(n);
  }
  if (createdNodes.length > 0) figma.viewport.scrollAndZoomIntoView(createdNodes);

  return { pageId: auditPage.id, count: created.length };
})();
`;
}
// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────
async function visualAuditHandler(args) {
    const { nodeId, imageInput, auditAreas, outputFormat } = args;
    if (!nodeId && !imageInput) {
        throw new Error("visualAuditHandler: either nodeId or imageInput must be provided");
    }
    if (auditAreas.length === 0) {
        throw new Error("visualAuditHandler: auditAreas must contain at least one area");
    }
    // 1. Resolve image — take screenshot from Figma if nodeId provided
    let image;
    if (nodeId) {
        const bridge = await (0, figma_bridge_js_1.getBridge)();
        image = await bridge.takeScreenshot(nodeId);
    }
    else {
        image = imageInput;
    }
    // 2. Run visual quality audit with VisionClient
    const vision = new vision_client_js_1.VisionClient();
    const rawAudit = await vision.auditVisualQuality(image, auditAreas);
    // 3. Build structured result
    const result = sanitiseAuditData(rawAudit);
    result.auditAreas = auditAreas;
    if (nodeId)
        result.nodeId = nodeId;
    let annotationPageId;
    // 4. Create annotation page in Figma if requested
    if (outputFormat === "annotations" || outputFormat === "both") {
        if (result.topIssues.length > 0) {
            const bridge = await (0, figma_bridge_js_1.getBridge)();
            const dateSuffix = new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            });
            const pageName = `AI Audit — ${dateSuffix}`;
            const script = buildAnnotationScript(result.topIssues, pageName);
            const execResult = await bridge.execute(script);
            if (!execResult.success) {
                throw new Error(`visualAuditHandler: Figma execution failed — ${execResult.error}`);
            }
            const execData = execResult.result;
            annotationPageId = execData.pageId;
            result.annotationPageId = annotationPageId;
        }
    }
    // 5. Attach raw analysis only in report mode
    if (outputFormat === "report" || outputFormat === "both") {
        result.rawAnalysis = rawAudit;
    }
    // 6. Log action
    const logNodeIds = [nodeId, annotationPageId].filter(Boolean);
    await decision_log_js_1.decisionLog.log({
        tool: "figma_visual_audit",
        nodeIds: logNodeIds,
        rationale: `Visual audit completed. Areas: [${auditAreas.join(", ")}]. Overall score: ${result.overallScore}/100. Found ${result.topIssues.length} issues (cognitive load: ${result.cognitiveLoadRating}). Estimated fix time: ${result.estimatedFixTimeMinutes} min.`,
        reversible: false,
        metadata: {
            outputFormat,
            overallScore: result.overallScore,
            issueCount: result.topIssues.length,
            annotationPageId,
        },
    });
    return result;
}
//# sourceMappingURL=index.js.map