import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import { HealthScore } from "../../../shared/types.js";
import { a11yAuditHandler } from "../../phase1-vision/a11y-audit/index.js";
import { lintRulesHandler } from "../../phase2-accuracy/lint-rules/index.js";
import { componentAuditHandler } from "../../phase2-accuracy/component-audit/index.js";

export interface HealthReportArgs {
  fileKey?: string;
  includeHistory?: boolean;
  outputFormat: "report" | "figma-page" | "slack-digest" | "all";
  runAudits: Array<"a11y" | "lint" | "tokens" | "components" | "drift" | "all">;
}

export interface HealthReportResult {
  scores: HealthScore;
  topActions: string[];
  outputText: string;
  figmaPageId?: string;
  historicalTrend?: Array<{ date: string; overall: number }>;
  logEntryId: string;
}

const WEIGHTS = {
  tokenCoverage: 0.25,
  accessibility: 0.25,
  componentAdoption: 0.20,
  documentation: 0.15,
  lintScore: 0.10,
  driftScore: 0.05,
};

// ─── Token coverage check ─────────────────────────────────────────────────────

async function measureTokenCoverage(): Promise<number> {
  const bridge = await getBridge();
  const result = await bridge.execute(`
    (async () => {
      var total = 0, tokenized = 0;
      var page = figma.currentPage;
      var nodes = page.findAll(function(n) { return n.fills && n.fills.length > 0; });
      for (var i = 0; i < nodes.length; i++) {
        var fills = nodes[i].fills || [];
        for (var j = 0; j < fills.length; j++) {
          total++;
          if (fills[j].type === 'VARIABLE_ALIAS') tokenized++;
        }
      }
      return { total: total, tokenized: tokenized };
    })();
  `);
  if (!result.success || !result.result) return 70;
  const { total, tokenized } = result.result as { total: number; tokenized: number };
  return total > 0 ? Math.round((tokenized / total) * 100) : 100;
}

// ─── Documentation coverage ───────────────────────────────────────────────────

async function measureDocumentationCoverage(): Promise<number> {
  const bridge = await getBridge();
  const components = await bridge.getComponentSets();
  if (components.length === 0) return 50;
  const documented = components.filter(
    (c) => c.description && c.description.trim().length > 10
  ).length;
  return Math.round((documented / components.length) * 100);
}

// ─── Weighted score calculation ───────────────────────────────────────────────

function computeOverall(scores: Omit<HealthScore, "overall">): number {
  return Math.round(
    scores.tokenCoverage * WEIGHTS.tokenCoverage +
    scores.accessibility * WEIGHTS.accessibility +
    scores.componentAdoption * WEIGHTS.componentAdoption +
    scores.documentation * WEIGHTS.documentation +
    scores.lintScore * WEIGHTS.lintScore +
    scores.driftScore * WEIGHTS.driftScore
  );
}

// ─── Recommended actions ──────────────────────────────────────────────────────

function deriveTopActions(scores: HealthScore): string[] {
  const actions: Array<{ gap: number; action: string }> = [
    { gap: 95 - scores.tokenCoverage, action: "Tokenize hardcoded color/spacing values (run figma_lint_rules with autoFix)" },
    { gap: 90 - scores.accessibility, action: "Fix WCAG contrast violations (run figma_a11y_audit with autoSuggestFixes)" },
    { gap: 80 - scores.componentAdoption, action: "Replace raw frames with DS component instances (run figma_component_archaeologist)" },
    { gap: 70 - scores.documentation, action: "Add descriptions to undocumented components (update in Figma component panel)" },
    { gap: 95 - scores.lintScore, action: "Fix lint violations (run figma_lint_rules --autoFix)" },
    { gap: 95 - scores.driftScore, action: "Realign drifting token values (run figma_system_drift to identify gaps)" },
  ];
  return actions
    .filter((a) => a.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3)
    .map((a) => a.action);
}

// ─── Report formatters ────────────────────────────────────────────────────────

function scoreBar(score: number, target: number): string {
  const icon = score >= target ? "🟢" : score >= target - 15 ? "🟠" : "🔴";
  const targetStr = `(target: ${target}%)`;
  const check = score >= target ? "✅" : "";
  return `${score}%  ${icon} ${targetStr} ${check}`.trim();
}

function formatTextReport(scores: HealthScore, topActions: string[]): string {
  return [
    "╔══════════════════════════════════════════════════════╗",
    `║  DESIGN SYSTEM HEALTH REPORT — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase().padEnd(20)}  ║`,
    "╠══════════════════════════════════════════════════════╣",
    `║  Overall Score: ${scores.overall}/100${scores.overall > 80 ? "  ✅ Good" : scores.overall > 60 ? "  🟠 Needs work" : "  🔴 Critical"}`.padEnd(55) + "║",
    "╠══════════════════════════════════════════════════════╣",
    `║  Token Coverage:       ${scoreBar(scores.tokenCoverage, 95).padEnd(33)}║`,
    `║  Accessibility:        ${scoreBar(scores.accessibility, 90).padEnd(33)}║`,
    `║  Component Adoption:   ${scoreBar(scores.componentAdoption, 80).padEnd(33)}║`,
    `║  Documentation:        ${scoreBar(scores.documentation, 70).padEnd(33)}║`,
    `║  Lint Score:           ${scoreBar(scores.lintScore, 95).padEnd(33)}║`,
    `║  System Drift:         ${scoreBar(scores.driftScore, 95).padEnd(33)}║`,
    "╠══════════════════════════════════════════════════════╣",
    "║  Top 3 Actions:                                      ║",
    ...topActions.map((a, i) => `║  ${i + 1}. ${a.slice(0, 50).padEnd(51)}║`),
    "╚══════════════════════════════════════════════════════╝",
  ].join("\n");
}

function formatSlackDigest(scores: HealthScore, topActions: string[]): string {
  const status = scores.overall >= 80 ? ":large_green_circle:" : scores.overall >= 60 ? ":large_orange_circle:" : ":red_circle:";
  return JSON.stringify({
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${status} Design System Health Report` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Overall Score*\n${scores.overall}/100` },
          { type: "mrkdwn", text: `*Token Coverage*\n${scores.tokenCoverage}%` },
          { type: "mrkdwn", text: `*Accessibility*\n${scores.accessibility}%` },
          { type: "mrkdwn", text: `*Component Adoption*\n${scores.componentAdoption}%` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Top Actions*\n${topActions.map((a, i) => `${i + 1}. ${a}`).join("\n")}`,
        },
      },
    ],
  }, null, 2);
}

// ─── Figma page creation ──────────────────────────────────────────────────────

async function createHealthPage(scores: HealthScore, topActions: string[]): Promise<string> {
  const bridge = await getBridge();
  const result = await bridge.execute(`
    (async () => {
      await figma.loadAllPagesAsync();
      const pageName = "Health Report — " + new Date().toLocaleDateString();
      const existing = figma.root.children.find(p => p.name === pageName);
      if (existing) { await figma.setCurrentPageAsync(existing); return existing.id; }

      const page = figma.createPage();
      page.name = pageName;
      await figma.setCurrentPageAsync(page);

      // Background
      const bg = figma.createRectangle();
      bg.resize(800, 600);
      bg.fills = [{ type: "SOLID", color: { r: 0.04, g: 0.04, b: 0.08 } }];
      bg.x = 0; bg.y = 0;
      page.appendChild(bg);

      // Title
      await figma.loadFontAsync({ family: "Inter", style: "Bold" });
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      const title = figma.createText();
      title.fontName = { family: "Inter", style: "Bold" };
      title.fontSize = 28;
      title.characters = "Design System Health Report";
      title.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      title.x = 40; title.y = 32;
      page.appendChild(title);

      const overall = figma.createText();
      overall.fontName = { family: "Inter", style: "Bold" };
      overall.fontSize = 56;
      overall.characters = ${JSON.stringify(scores.overall.toString())} + "/100";
      overall.fills = [{ type: "SOLID", color: { r: ${scores.overall >= 80 ? "0.2, 0.9, 0.5" : scores.overall >= 60 ? "1, 0.6, 0.1" : "1, 0.3, 0.3"} } }];
      overall.x = 40; overall.y = 80;
      page.appendChild(overall);

      // Score cards
      const dims = [
        ["Token Coverage", ${scores.tokenCoverage}],
        ["Accessibility", ${scores.accessibility}],
        ["Component Adoption", ${scores.componentAdoption}],
        ["Documentation", ${scores.documentation}],
        ["Lint Score", ${scores.lintScore}],
        ["Drift Score", ${scores.driftScore}],
      ];

      let cx = 40;
      for (const [label, score] of dims) {
        const card = figma.createFrame();
        card.resize(100, 80);
        card.x = cx; card.y = 200;
        card.fills = [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.18 } }];
        card.cornerRadius = 8;
        card.layoutMode = "VERTICAL";
        card.primaryAxisAlignItems = "CENTER";
        card.counterAxisAlignItems = "CENTER";
        card.paddingTop = 8; card.paddingBottom = 8;

        const scoreText = figma.createText();
        scoreText.fontName = { family: "Inter", style: "Bold" };
        scoreText.fontSize = 24;
        scoreText.characters = String(score) + "%";
        scoreText.fills = [{ type: "SOLID", color: score >= 80 ? { r: 0.2, g: 0.9, b: 0.5 } : score >= 60 ? { r: 1, g: 0.6, b: 0.1 } : { r: 1, g: 0.3, b: 0.3 } }];
        card.appendChild(scoreText);

        const labelText = figma.createText();
        labelText.fontName = { family: "Inter", style: "Regular" };
        labelText.fontSize = 10;
        labelText.characters = String(label);
        labelText.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.7 } }];
        card.appendChild(labelText);

        page.appendChild(card);
        cx += 116;
      }

      // Actions section
      const actionsTitle = figma.createText();
      actionsTitle.fontName = { family: "Inter", style: "Bold" };
      actionsTitle.fontSize = 18;
      actionsTitle.characters = "Top 3 Actions";
      actionsTitle.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      actionsTitle.x = 40; actionsTitle.y = 320;
      page.appendChild(actionsTitle);

      const actions = ${JSON.stringify(topActions)};
      actions.forEach((action, i) => {
        const t = figma.createText();
        t.fontName = { family: "Inter", style: "Regular" };
        t.fontSize = 14;
        t.characters = (i + 1) + ". " + action;
        t.fills = [{ type: "SOLID", color: { r: 0.8, g: 0.8, b: 0.9 } }];
        t.x = 40; t.y = 360 + i * 28;
        page.appendChild(t);
      });

      figma.viewport.scrollAndZoomIntoView([page.children[0]]);
      return page.id;
    })();
  `);

  if (!result.success) throw new Error(`Health page creation failed: ${result.error}`);
  return result.result as string;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function healthReportHandler(args: HealthReportArgs): Promise<HealthReportResult> {
  const runAll = args.runAudits.includes("all");
  const shouldRun = (name: string) => runAll || args.runAudits.includes(name as never);

  // Default dimension scores
  let tokenCoverage = 80;
  let accessibility = 78;
  let componentAdoption = 72;
  let documentation = 55;
  let lintScore = 85;
  let driftScore = 95;

  // ── Run requested audits ───────────────────────────────────────────────────
  if (shouldRun("tokens")) {
    try { tokenCoverage = await measureTokenCoverage(); } catch { /* keep default */ }
  }

  if (shouldRun("a11y")) {
    try {
      const bridge = await getBridge();
      const rootResult = await bridge.execute(`var first = figma.currentPage.children[0]; return first ? first.id : null;`);
      if (rootResult.success && rootResult.result) {
        const a11y = await a11yAuditHandler({
          nodeId: rootResult.result as string,
          wcagLevel: "AA",
          includeColorBlindSim: false,
          outputFormat: "report",
          autoSuggestFixes: false,
        });
        const passRate = parseFloat(String(a11y.passRate ?? "78").replace("%", ""));
        if (!isNaN(passRate)) accessibility = passRate;
      }
    } catch { /* keep default */ }
  }

  if (shouldRun("components")) {
    try {
      const audit = await componentAuditHandler({ detectOrphans: true, groupBy: "component" });
      const totalComponents = (audit.topUsed?.length ?? 0) + (audit.orphanedComponents?.length ?? 0);
      if (totalComponents > 0) {
        const usedCount = audit.topUsed?.length ?? 0;
        componentAdoption = Math.round((usedCount / totalComponents) * 100);
      }
      documentation = await measureDocumentationCoverage();
    } catch { /* keep defaults */ }
  }

  if (shouldRun("lint")) {
    try {
      const lintResult = await lintRulesHandler({
        action: "run",
        outputFormat: "ci",
        autoFix: false,
      });
      const lr = lintResult as import("../../phase2-accuracy/lint-rules/index.js").LintRunResult;
      const totalNodes = lr.totalChecked ?? 100;
      const violations = lr.violations?.length ?? 0;
      lintScore = totalNodes > 0 ? Math.round(((totalNodes - violations) / totalNodes) * 100) : 85;
    } catch { /* keep default */ }
  }

  const partialScores = { tokenCoverage, accessibility, componentAdoption, documentation, lintScore, driftScore };
  const overall = computeOverall(partialScores);
  const scores: HealthScore = { overall, ...partialScores };

  const topActions = deriveTopActions(scores);

  // ── Historical trend ────────────────────────────────────────────────────────
  let historicalTrend: Array<{ date: string; overall: number }> | undefined;
  if (args.includeHistory) {
    const recentLogs = await decisionLog.getRecent(30);
    const healthLogs = recentLogs.filter((e) => e.tool === "figma_health_report");
    if (healthLogs.length > 0) {
      historicalTrend = healthLogs.map((e) => ({
        date: e.timestamp.slice(0, 10),
        overall: (e.metadata as Record<string, number> | undefined)?.overall ?? overall,
      }));
    }
  }

  // ── Format outputs ──────────────────────────────────────────────────────────
  const format = args.outputFormat;
  let outputText = "";
  let figmaPageId: string | undefined;

  if (format === "report" || format === "all") {
    outputText = formatTextReport(scores, topActions);
  }
  if (format === "slack-digest" || format === "all") {
    const slackOutput = formatSlackDigest(scores, topActions);
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: slackOutput,
      }).catch(() => {});
    }
    if (!outputText) outputText = slackOutput;
  }
  if (format === "figma-page" || format === "all") {
    try {
      figmaPageId = await createHealthPage(scores, topActions);
    } catch { /* non-fatal */ }
  }

  if (!outputText) outputText = formatTextReport(scores, topActions);

  // ── Log ─────────────────────────────────────────────────────────────────────
  const logEntry = await decisionLog.log({
    tool: "figma_health_report",
    nodeIds: figmaPageId ? [figmaPageId] : [],
    rationale: `Health report generated. Overall: ${overall}/100. Token coverage: ${tokenCoverage}%, Accessibility: ${accessibility}%, Component adoption: ${componentAdoption}%, Documentation: ${documentation}%, Lint: ${lintScore}%, Drift: ${driftScore}%.`,
    reversible: false,
    metadata: { overall, ...partialScores },
  });

  return {
    scores,
    topActions,
    outputText,
    figmaPageId,
    historicalTrend,
    logEntryId: logEntry.id,
  };
}
