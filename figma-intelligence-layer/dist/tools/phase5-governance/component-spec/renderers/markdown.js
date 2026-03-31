"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderMarkdown = renderMarkdown;
function renderMarkdown(spec) {
    const lines = [`# ${spec.componentName} — Component Spec`, ""];
    for (const section of spec.sections) {
        lines.push(`## ${section.title}`, "");
        renderContent(section.content, lines);
        lines.push("");
    }
    return lines.join("\n").trim();
}
function renderContent(content, lines) {
    switch (content.kind) {
        case "key-value":
            for (const entry of content.entries) {
                lines.push(`- **${entry.label}**: ${entry.value}`);
            }
            break;
        case "table":
            if (content.rows.length === 0)
                break;
            lines.push(`| ${content.headers.join(" | ")} |`);
            lines.push(`| ${content.headers.map(() => "---").join(" | ")} |`);
            for (const row of content.rows) {
                lines.push(`| ${row.join(" | ")} |`);
            }
            break;
        case "list":
            for (const item of content.items) {
                lines.push(`- ${item}`);
            }
            break;
        case "do-dont":
            if (content.dos.length > 0) {
                lines.push("### Do");
                for (const d of content.dos)
                    lines.push(`- ✓ ${d}`);
            }
            if (content.donts.length > 0) {
                lines.push("### Don't");
                for (const d of content.donts)
                    lines.push(`- ✗ ${d}`);
            }
            break;
        case "paragraph":
            lines.push(content.text);
            break;
        case "structured-data":
            if (content.rows.length === 0)
                break;
            lines.push(`| ${content.columns.join(" | ")} |`);
            lines.push(`| ${content.columns.map(() => "---").join(" | ")} |`);
            for (const row of content.rows) {
                lines.push(`| ${content.columns.map((col) => row[col] || "—").join(" | ")} |`);
            }
            break;
        case "rules":
            for (const item of content.items) {
                lines.push(`- ${item}`);
            }
            break;
        case "mixed":
            for (const block of content.blocks) {
                renderContent(block, lines);
                lines.push("");
            }
            break;
    }
}
//# sourceMappingURL=markdown.js.map