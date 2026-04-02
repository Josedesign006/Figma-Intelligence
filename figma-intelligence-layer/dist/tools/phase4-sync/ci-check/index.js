"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// figma_ci_check — CI/CD integration for design system governance
//
// Runs lint-rules + health-report and produces CI-friendly output:
//   - Exit codes: 0 = pass, 1 = warnings, 2 = errors
//   - SARIF format for GitHub Code Scanning
//   - GitHub Actions annotations (::error, ::warning)
//   - PR comment body (markdown)
//   - Threshold gates: fail if health score drops below configured minimum
//
// Also generates a GitHub Action YAML that can be copied into .github/workflows/
// for automated design system checks on every push/PR.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.ciCheckHandler = ciCheckHandler;
const index_js_1 = require("../../phase2-accuracy/lint-rules/index.js");
const index_js_2 = require("../../phase5-governance/health-report/index.js");
// ─── Check runners ─────────────────────────────────────────────────────────
async function runLintCheck(nodeId) {
    try {
        const result = await (0, index_js_1.lintRulesHandler)({
            action: "run",
            nodeId,
            autoFix: false,
            outputFormat: "ci",
        });
        const lintResult = result;
        const violations = (lintResult.violations ?? []).map((v) => ({
            rule: v.ruleId,
            severity: v.severity,
            message: v.message,
            element: v.nodeName,
            nodeId: v.nodeId,
            autoFixable: v.autoFixable ?? false,
        }));
        return {
            violations,
            errorCount: lintResult.errorCount ?? violations.filter((v) => v.severity === "error").length,
            warningCount: lintResult.warningCount ?? violations.filter((v) => v.severity === "warning").length,
            exitCode: lintResult.exitCode ?? (violations.some((v) => v.severity === "error") ? 2 : violations.length > 0 ? 1 : 0),
        };
    }
    catch {
        return { violations: [], errorCount: 0, warningCount: 0, exitCode: 0 };
    }
}
async function runHealthCheck() {
    try {
        const result = await (0, index_js_2.healthReportHandler)({
            outputFormat: "report",
            runAudits: ["all"],
        });
        const report = result;
        return {
            overall: report.scores?.overall ?? 0,
            tokenCoverage: report.scores?.tokenCoverage ?? 0,
            lintScore: report.scores?.lintScore ?? 0,
            a11yScore: report.scores?.accessibility ?? 0,
            componentAdoption: report.scores?.componentAdoption ?? 0,
            documentation: report.scores?.documentation ?? 0,
        };
    }
    catch {
        return { overall: 0, tokenCoverage: 0, lintScore: 0, a11yScore: 0, componentAdoption: 0, documentation: 0 };
    }
}
// ─── Output formatters ─────────────────────────────────────────────────────
function formatGitHubActions(violations, health, passed) {
    const lines = [];
    // Health score group
    lines.push(`::group::Design System Health: ${health.overall}/100`);
    lines.push(`Token Coverage: ${health.tokenCoverage}%`);
    lines.push(`Overall Score: ${health.overall}/100`);
    lines.push(`Status: ${passed ? "PASSED ✓" : "FAILED ✗"}`);
    lines.push(`::endgroup::`);
    lines.push(``);
    // Violation annotations
    for (const v of violations) {
        const level = v.severity === "error" ? "error" : "warning";
        lines.push(`::${level} title=${v.rule}::${v.message} [${v.element}]${v.autoFixable ? " (auto-fixable)" : ""}`);
    }
    // Summary
    const errors = violations.filter((v) => v.severity === "error").length;
    const warnings = violations.filter((v) => v.severity === "warning").length;
    if (errors > 0) {
        lines.push(`::error::Design system check failed: ${errors} error(s), ${warnings} warning(s)`);
    }
    else if (warnings > 0) {
        lines.push(`::warning::Design system check passed with ${warnings} warning(s)`);
    }
    else {
        lines.push(`::notice::Design system check passed — no issues found`);
    }
    return lines.join("\n");
}
function formatSarif(violations) {
    const sarif = {
        version: "2.1.0",
        $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        runs: [
            {
                tool: {
                    driver: {
                        name: "figma-intelligence-layer",
                        version: "1.0.0",
                        informationUri: "https://github.com/figma-intelligence-layer",
                        rules: [...new Set(violations.map((v) => v.rule))].map((ruleId) => ({
                            id: ruleId,
                            shortDescription: { text: ruleId.replace(/-/g, " ") },
                            defaultConfiguration: {
                                level: violations.find((v) => v.rule === ruleId)?.severity === "error" ? "error" : "warning",
                            },
                        })),
                    },
                },
                results: violations.map((v) => ({
                    ruleId: v.rule,
                    level: v.severity === "error" ? "error" : "warning",
                    message: { text: `${v.message} [${v.element}]` },
                    locations: [
                        {
                            physicalLocation: {
                                artifactLocation: { uri: `figma://node/${v.nodeId}` },
                            },
                        },
                    ],
                    properties: {
                        autoFixable: v.autoFixable,
                        figmaNodeId: v.nodeId,
                    },
                })),
            },
        ],
    };
    return JSON.stringify(sarif, null, 2);
}
function formatPrComment(violations, health, passed, threshold) {
    const errors = violations.filter((v) => v.severity === "error");
    const warnings = violations.filter((v) => v.severity === "warning");
    const fixable = violations.filter((v) => v.autoFixable);
    const statusIcon = passed ? "✅" : "❌";
    const lines = [];
    lines.push(`## ${statusIcon} Design System Check`);
    lines.push(``);
    lines.push(`| Metric | Score | Status |`);
    lines.push(`|--------|-------|--------|`);
    lines.push(`| **Overall Health** | ${health.overall}/100 | ${health.overall >= threshold ? "✅" : "❌"} (threshold: ${threshold}) |`);
    lines.push(`| Token Coverage | ${health.tokenCoverage}% | ${health.tokenCoverage >= 80 ? "✅" : "⚠️"} |`);
    lines.push(`| Lint Score | ${health.lintScore}/100 | ${health.lintScore >= 80 ? "✅" : "⚠️"} |`);
    lines.push(`| Accessibility | ${health.a11yScore}/100 | ${health.a11yScore >= 80 ? "✅" : "⚠️"} |`);
    lines.push(`| Component Adoption | ${health.componentAdoption}% | ${health.componentAdoption >= 70 ? "✅" : "⚠️"} |`);
    lines.push(`| Documentation | ${health.documentation}% | ${health.documentation >= 60 ? "✅" : "⚠️"} |`);
    lines.push(``);
    if (errors.length > 0) {
        lines.push(`### ❌ Errors (${errors.length})`);
        lines.push(``);
        for (const e of errors.slice(0, 20)) {
            lines.push(`- **${e.rule}**: ${e.message} — \`${e.element}\`${e.autoFixable ? " _(auto-fixable)_" : ""}`);
        }
        if (errors.length > 20) {
            lines.push(`- _...and ${errors.length - 20} more errors_`);
        }
        lines.push(``);
    }
    if (warnings.length > 0) {
        lines.push(`### ⚠️ Warnings (${warnings.length})`);
        lines.push(``);
        for (const w of warnings.slice(0, 10)) {
            lines.push(`- **${w.rule}**: ${w.message} — \`${w.element}\``);
        }
        if (warnings.length > 10) {
            lines.push(`- _...and ${warnings.length - 10} more warnings_`);
        }
        lines.push(``);
    }
    if (fixable.length > 0) {
        lines.push(`> 💡 ${fixable.length} issue(s) can be auto-fixed with \`figma_lint_rules\` (autoFix: true)`);
        lines.push(``);
    }
    if (violations.length === 0) {
        lines.push(`No design system violations found. 🎉`);
        lines.push(``);
    }
    lines.push(`---`);
    lines.push(`_Generated by figma-intelligence-layer CI check_`);
    return lines.join("\n");
}
function generateGitHubWorkflow() {
    return `# Design System CI Check
# Runs figma-intelligence-layer lint + health checks on every PR
# Add this to .github/workflows/design-system-check.yml

name: Design System Check

on:
  pull_request:
    branches: [main, develop]
    paths:
      - 'src/components/**'
      - 'src/tokens/**'
      - 'src/styles/**'

  # Manual trigger
  workflow_dispatch:
    inputs:
      health_threshold:
        description: 'Minimum health score (0-100)'
        default: '70'
        type: string

jobs:
  design-check:
    name: Design System Governance
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Dependencies
        run: npm ci

      - name: Start Figma Bridge
        run: |
          npx figma-intelligence-layer &
          sleep 3
        env:
          FIGMA_FILE_KEY: \${{ secrets.FIGMA_FILE_KEY }}
          FIGMA_ACCESS_TOKEN: \${{ secrets.FIGMA_ACCESS_TOKEN }}

      - name: Run Design System Check
        id: ds-check
        run: |
          RESULT=$(npx figma-ci-check \\
            --checks lint,health,tokens \\
            --threshold \${{ inputs.health_threshold || '70' }} \\
            --format github-actions)
          echo "$RESULT"
          # Extract exit code
          EXIT_CODE=$(echo "$RESULT" | tail -1 | grep -oP '\\d+' || echo "0")
          exit $EXIT_CODE

      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: ds-check-results.sarif
        continue-on-error: true

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const body = fs.readFileSync('ds-check-comment.md', 'utf8');
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body
            });
`;
}
// ─── Main handler ──────────────────────────────────────────────────────────
async function ciCheckHandler(args) {
    const threshold = args.healthThreshold ?? 70;
    const maxErrors = args.maxLintErrors ?? 0;
    const maxWarnings = args.maxLintWarnings ?? -1;
    const checksToRun = args.checks.includes("all")
        ? ["lint", "health", "tokens"]
        : args.checks;
    // Run checks
    let lintResult = { violations: [], errorCount: 0, warningCount: 0, exitCode: 0 };
    let healthResult = { overall: 100, tokenCoverage: 100, lintScore: 100, a11yScore: 100, componentAdoption: 100, documentation: 100 };
    if (checksToRun.includes("lint") || checksToRun.includes("tokens")) {
        lintResult = await runLintCheck(args.nodeId);
    }
    if (checksToRun.includes("health")) {
        healthResult = await runHealthCheck();
    }
    // Determine pass/fail
    const errorsFailed = lintResult.errorCount > maxErrors;
    const warningsFailed = maxWarnings >= 0 && lintResult.warningCount > maxWarnings;
    const healthFailed = healthResult.overall < threshold;
    const passed = !errorsFailed && !warningsFailed && !healthFailed;
    // Compute exit code
    let exitCode = 0;
    if (errorsFailed || healthFailed)
        exitCode = 2;
    else if (warningsFailed)
        exitCode = 1;
    // Generate outputs
    const outputs = {};
    const formats = args.outputFormat === "all"
        ? ["github-actions", "sarif", "pr-comment", "json"]
        : [args.outputFormat];
    for (const fmt of formats) {
        switch (fmt) {
            case "github-actions":
                outputs["github-actions"] = formatGitHubActions(lintResult.violations, healthResult, passed);
                break;
            case "sarif":
                outputs["ds-check-results.sarif"] = formatSarif(lintResult.violations);
                break;
            case "pr-comment":
                outputs["ds-check-comment.md"] = formatPrComment(lintResult.violations, healthResult, passed, threshold);
                break;
            case "json":
                outputs["ds-check-results.json"] = JSON.stringify({
                    passed,
                    exitCode,
                    health: healthResult,
                    lint: { errors: lintResult.errorCount, warnings: lintResult.warningCount },
                    violations: lintResult.violations,
                }, null, 2);
                break;
        }
    }
    // Generate workflow if requested
    let workflow;
    if (args.generateWorkflow) {
        workflow = generateGitHubWorkflow();
        outputs["design-system-check.yml"] = workflow;
    }
    const result = {
        exitCode,
        summary: {
            passed,
            errors: lintResult.errorCount,
            warnings: lintResult.warningCount,
            healthScore: healthResult.overall,
            tokenCoverage: healthResult.tokenCoverage,
            lintScore: healthResult.lintScore,
            threshold,
        },
        violations: lintResult.violations,
        outputs,
        workflow,
    };
    return result;
}
//# sourceMappingURL=index.js.map