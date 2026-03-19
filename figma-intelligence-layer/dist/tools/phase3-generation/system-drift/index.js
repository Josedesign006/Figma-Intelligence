"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// System Drift
// Compares design-token variables from a canonical Figma file against one or
// more target files using the Figma REST API.  Calculates a drift score per
// file, categorises each deviation, and formats the results as a detailed
// report, inline Figma annotation JSON, or a PR-comment markdown block.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemDriftHandler = systemDriftHandler;
const decision_log_js_1 = require("../../../shared/decision-log.js");
// ─── REST API fetch ───────────────────────────────────────────────────────────
function normalizeVariableValue(value) {
    if (typeof value === "number") {
        return String(Math.round(value * 1000) / 1000);
    }
    if (typeof value === "string")
        return value;
    if (typeof value === "boolean")
        return String(value);
    if (typeof value === "object" && value !== null) {
        if ("r" in value && "g" in value && "b" in value) {
            const r = Math.round(value.r * 255);
            const g = Math.round(value.g * 255);
            const b = Math.round(value.b * 255);
            return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
        }
        if ("type" in value && value.type === "VARIABLE_ALIAS") {
            return `alias:${value.id}`;
        }
    }
    return JSON.stringify(value);
}
async function fetchFileVariables(fileKey) {
    const token = process.env.FIGMA_ACCESS_TOKEN;
    if (!token) {
        throw new Error("systemDrift: FIGMA_ACCESS_TOKEN environment variable is not set.");
    }
    const response = await fetch(`https://api.figma.com/v1/files/${fileKey}/variables/local`, { headers: { "X-Figma-Token": token } });
    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`systemDrift: Figma API error for file "${fileKey}" — HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
    const data = (await response.json());
    const { variables, variableCollections } = data.meta;
    const flatTokens = [];
    for (const variable of Object.values(variables ?? {})) {
        // Resolve which collection owns this variable to get the default mode
        let defaultModeId;
        for (const col of Object.values(variableCollections ?? {})) {
            if (col.variableIds.includes(variable.id)) {
                defaultModeId = col.defaultModeId;
                break;
            }
        }
        const rawValue = defaultModeId && variable.valuesByMode[defaultModeId] !== undefined
            ? variable.valuesByMode[defaultModeId]
            : Object.values(variable.valuesByMode)[0];
        flatTokens.push({
            name: variable.name,
            type: variable.resolvedType,
            value: rawValue !== undefined ? normalizeVariableValue(rawValue) : "null",
        });
    }
    return flatTokens;
}
// ─── Drift detection ──────────────────────────────────────────────────────────
function hexDistance(a, b) {
    const clean = (s) => s.replace(/^#/, "").toLowerCase().padEnd(6, "0");
    const ca = clean(a);
    const cb = clean(b);
    let diff = 0;
    for (let i = 0; i < Math.max(ca.length, cb.length); i++) {
        if ((ca[i] ?? "") !== (cb[i] ?? ""))
            diff++;
    }
    return diff;
}
function isHexColor(value) {
    return /^#[0-9a-fA-F]{3,8}$/.test(value);
}
function computeInstanceCount(tokenName) {
    // Heuristic: deeply nested token names imply fewer cross-file usages
    const depth = (tokenName.match(/\//g) ?? []).length;
    return Math.max(1, Math.round(30 / (depth + 1)));
}
function compareTokenSets(canonicalTokens, targetTokens, tokenTypeFilter) {
    const violations = [];
    const shouldInclude = (type) => {
        if (!tokenTypeFilter || tokenTypeFilter.length === 0)
            return true;
        return tokenTypeFilter.some((tf) => type.toLowerCase().includes(tf.toLowerCase()));
    };
    const canonicalMap = new Map(canonicalTokens.map((t) => [t.name, t]));
    const targetMap = new Map(targetTokens.map((t) => [t.name, t]));
    // Check canonical tokens against target
    for (const [name, canonical] of canonicalMap) {
        if (!shouldInclude(canonical.type))
            continue;
        const target = targetMap.get(name);
        if (!target) {
            violations.push({
                tokenName: name,
                canonicalValue: canonical.value,
                targetValue: "MISSING",
                driftType: "missing",
                severity: "warning",
                instancesAffected: computeInstanceCount(name),
            });
            continue;
        }
        if (canonical.value === target.value)
            continue;
        // Hex typo: one character differs
        if (isHexColor(canonical.value) && isHexColor(target.value)) {
            const dist = hexDistance(canonical.value, target.value);
            if (dist === 1) {
                violations.push({
                    tokenName: name,
                    canonicalValue: canonical.value,
                    targetValue: target.value,
                    driftType: "typo",
                    severity: "warning",
                    instancesAffected: computeInstanceCount(name),
                });
                continue;
            }
        }
        // Different value, same name → override
        violations.push({
            tokenName: name,
            canonicalValue: canonical.value,
            targetValue: target.value,
            driftType: "override",
            severity: "critical",
            instancesAffected: computeInstanceCount(name),
        });
    }
    // Check target tokens not present in canonical → extra
    for (const [name, target] of targetMap) {
        if (!shouldInclude(target.type))
            continue;
        if (!canonicalMap.has(name)) {
            violations.push({
                tokenName: name,
                canonicalValue: "NOT_IN_CANONICAL",
                targetValue: target.value,
                driftType: "extra",
                severity: "warning",
                instancesAffected: computeInstanceCount(name),
            });
        }
    }
    return violations;
}
function classifyScore(driftScore, threshold) {
    const warningThreshold = Math.min(15, threshold);
    if (driftScore <= Math.min(5, threshold * 0.33))
        return "healthy";
    if (driftScore <= warningThreshold)
        return "warning";
    return "critical";
}
// ─── Output formatters ────────────────────────────────────────────────────────
function formatAsReport(reports, summary, threshold) {
    const lines = [];
    lines.push("# Design System Drift Report");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push("");
    lines.push("## Summary");
    lines.push(`- Files checked: ${summary.filesChecked}`);
    lines.push(`- Status: ${summary.healthyFiles} healthy / ${summary.warningFiles} warning / ${summary.criticalFiles} critical`);
    lines.push(`- Total tokens compared: ${summary.totalTokensCompared}`);
    lines.push(`- Total drifting tokens: ${summary.totalDriftingTokens}`);
    lines.push(`- Overall drift score: ${summary.overallDriftScore.toFixed(1)}%`);
    lines.push(`- Alert threshold: ${threshold}%`);
    lines.push("");
    for (const report of reports) {
        const cat = classifyScore(report.driftScore, threshold);
        const statusLabel = cat === "healthy" ? "[HEALTHY]" : cat === "warning" ? "[WARNING]" : "[CRITICAL]";
        lines.push(`## ${statusLabel} ${report.targetFileKey}`);
        lines.push(`Drift score: **${report.driftScore.toFixed(1)}%** (${report.driftingTokens}/${report.totalTokens} tokens)`);
        lines.push("");
        if (report.violations.length === 0) {
            lines.push("No violations found.");
        }
        else {
            lines.push("| Token | Canonical | Target | Type | Severity | Instances |");
            lines.push("|-------|-----------|--------|------|----------|-----------|");
            for (const v of report.violations.slice(0, 30)) {
                lines.push(`| ${v.tokenName} | \`${v.canonicalValue}\` | \`${v.targetValue}\` | ${v.driftType} | ${v.severity} | ${v.instancesAffected} |`);
            }
            if (report.violations.length > 30) {
                lines.push(`\n...and ${report.violations.length - 30} more violations`);
            }
        }
        lines.push("");
    }
    return lines.join("\n");
}
function formatAsPrComment(reports, summary) {
    const overallStatus = summary.criticalFiles > 0 ? "CRITICAL" : summary.warningFiles > 0 ? "WARNING" : "HEALTHY";
    const statusBadge = overallStatus === "CRITICAL"
        ? "[CRITICAL]"
        : overallStatus === "WARNING"
            ? "[WARNING]"
            : "[HEALTHY]";
    const lines = [];
    lines.push(`## Design System Drift Check ${statusBadge}`);
    lines.push("");
    lines.push(`Compared **${summary.filesChecked}** file(s) against the canonical design system.`);
    lines.push(`Overall drift: **${summary.overallDriftScore.toFixed(1)}%** (${summary.totalDriftingTokens} of ${summary.totalTokensCompared} tokens)`);
    lines.push("");
    lines.push("| File | Drift | Status |");
    lines.push("|------|-------|--------|");
    for (const r of reports) {
        const cat = r.driftScore < 5 ? "HEALTHY" : r.driftScore < 15 ? "WARNING" : "CRITICAL";
        lines.push(`| \`${r.targetFileKey}\` | ${r.driftScore.toFixed(1)}% | ${cat} |`);
    }
    lines.push("");
    const criticalViolations = reports
        .flatMap((r) => r.violations.filter((v) => v.severity === "critical"))
        .slice(0, 10);
    if (criticalViolations.length > 0) {
        lines.push("### Critical violations requiring attention");
        for (const v of criticalViolations) {
            lines.push(`- **${v.tokenName}**: canonical \`${v.canonicalValue}\` vs target \`${v.targetValue}\` — affects ~${v.instancesAffected} instance(s)`);
        }
        lines.push("");
    }
    const warnings = reports
        .flatMap((r) => r.violations.filter((v) => v.severity === "warning"))
        .slice(0, 8);
    if (warnings.length > 0) {
        lines.push("<details><summary>Warnings</summary>");
        lines.push("");
        for (const v of warnings) {
            lines.push(`- \`${v.tokenName}\` (${v.driftType}): \`${v.canonicalValue}\` → \`${v.targetValue}\``);
        }
        lines.push("</details>");
        lines.push("");
    }
    if (overallStatus === "HEALTHY") {
        lines.push("All tokens are within acceptable drift thresholds. No action required.");
    }
    return lines.join("\n");
}
function formatAsAnnotations(reports) {
    const annotations = reports.flatMap((report) => report.violations
        .filter((v) => v.severity === "critical")
        .map((v) => ({
        fileKey: report.targetFileKey,
        tokenName: v.tokenName,
        message: `[DRIFT] ${v.tokenName}: expected "${v.canonicalValue}" but found "${v.targetValue}" (${v.driftType}, ~${v.instancesAffected} instance(s))`,
        severity: v.severity,
        driftType: v.driftType,
        instancesAffected: v.instancesAffected,
    })));
    return JSON.stringify({ annotations }, null, 2);
}
// ─── Main handler ─────────────────────────────────────────────────────────────
async function systemDriftHandler(args) {
    const { canonicalFileKey, targetFileKeys, tokenTypes, threshold = 15, outputFormat, } = args;
    if (!canonicalFileKey)
        throw new Error("systemDrift: `canonicalFileKey` is required.");
    if (!targetFileKeys || targetFileKeys.length === 0) {
        throw new Error("systemDrift: `targetFileKeys` must be a non-empty array.");
    }
    // 1. Fetch canonical tokens
    const canonicalTokens = await fetchFileVariables(canonicalFileKey);
    if (canonicalTokens.length === 0) {
        throw new Error(`systemDrift: No variables found in canonical file "${canonicalFileKey}". Ensure the file has local variables and the access token has read permission.`);
    }
    // 2. Compare each target file
    const reports = [];
    for (const targetFileKey of targetFileKeys) {
        let targetTokens;
        try {
            targetTokens = await fetchFileVariables(targetFileKey);
        }
        catch (err) {
            console.error(`systemDrift: Skipping "${targetFileKey}" — ${err instanceof Error ? err.message : String(err)}`);
            continue;
        }
        const violations = compareTokenSets(canonicalTokens, targetTokens, tokenTypes);
        // Count only tokens that match the type filter for the denominator
        const relevantCanonical = tokenTypes && tokenTypes.length > 0
            ? canonicalTokens.filter((t) => tokenTypes.some((tf) => t.type.toLowerCase().includes(tf.toLowerCase())))
            : canonicalTokens;
        const totalTokens = relevantCanonical.length;
        const driftingTokens = violations.filter((v) => v.driftType !== "extra").length;
        const driftScore = totalTokens > 0 ? (driftingTokens / totalTokens) * 100 : 0;
        reports.push({
            canonicalFileKey,
            targetFileKey,
            totalTokens,
            driftingTokens,
            driftScore: Math.round(driftScore * 10) / 10,
            violations,
        });
    }
    // 3. Build summary
    const healthyFiles = reports.filter((r) => classifyScore(r.driftScore, threshold) === "healthy").length;
    const warningFiles = reports.filter((r) => classifyScore(r.driftScore, threshold) === "warning").length;
    const criticalFiles = reports.filter((r) => classifyScore(r.driftScore, threshold) === "critical").length;
    const totalTokensCompared = reports.reduce((s, r) => s + r.totalTokens, 0);
    const totalDriftingTokens = reports.reduce((s, r) => s + r.driftingTokens, 0);
    const overallDriftScore = totalTokensCompared > 0 ? (totalDriftingTokens / totalTokensCompared) * 100 : 0;
    const summary = {
        filesChecked: reports.length,
        healthyFiles,
        warningFiles,
        criticalFiles,
        totalTokensCompared,
        totalDriftingTokens,
        overallDriftScore: Math.round(overallDriftScore * 10) / 10,
    };
    // 4. Format output
    let formattedOutput;
    switch (outputFormat) {
        case "report":
            formattedOutput = formatAsReport(reports, summary, threshold);
            break;
        case "pr-comment":
            formattedOutput = formatAsPrComment(reports, summary);
            break;
        case "annotations":
            formattedOutput = formatAsAnnotations(reports);
            break;
        default:
            formattedOutput = formatAsReport(reports, summary, threshold);
    }
    // 5. Log the decision
    const logEntry = await decision_log_js_1.decisionLog.log({
        tool: "system-drift",
        nodeIds: [],
        rationale: `Drift analysis: canonical="${canonicalFileKey}", targets=${targetFileKeys.join(", ")}. Files checked: ${reports.length}. Overall drift: ${summary.overallDriftScore.toFixed(1)}%. Healthy: ${healthyFiles}, Warning: ${warningFiles}, Critical: ${criticalFiles}. Output: ${outputFormat}.`,
        tokens: [],
        reversible: false,
        metadata: {
            canonicalFileKey,
            targetFileKeys,
            tokenTypes,
            threshold,
            outputFormat,
            summary,
        },
    });
    return {
        reports,
        summary,
        formattedOutput,
        logEntryId: logEntry.id,
    };
}
//# sourceMappingURL=index.js.map