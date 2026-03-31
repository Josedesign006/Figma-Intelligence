"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderJson = renderJson;
// Section ID → output JSON key mapping
const SECTION_KEY_MAP = {
    overview: "overview",
    anatomy: "anatomy",
    variants: "variantMatrix",
    states: "states",
    "state-specs": "stateSpecifications",
    properties: "componentProperties",
    "size-specs": "sizeSpecifications",
    spacing: "structureAndLayout",
    "color-tokens": "colorTokens",
    "design-tokens": "designTokenBindings",
    typography: "typography",
    "type-hierarchy": "typeHierarchyAndEmphasis",
    "interaction-rules": "interactionRules",
    "content-guidance": "contentGuidance",
    responsive: "responsiveBehaviour",
    accessibility: "accessibilitySpecifications",
    "qa-criteria": "qaAcceptanceCriteria",
    usage: "dosAndDonts",
    related: "relatedComponents",
};
function transformContent(content) {
    switch (content.kind) {
        case "key-value":
            return Object.fromEntries(content.entries.map((e) => [e.label, e.value]));
        case "table":
            return content.rows.map((row) => Object.fromEntries(content.headers.map((h, i) => [h, row[i] ?? ""])));
        case "structured-data":
            return content.rows;
        case "list":
        case "rules":
            return content.items;
        case "do-dont":
            return { dos: content.dos, donts: content.donts };
        case "paragraph":
            return content.text;
        case "mixed":
            // For mixed content, return an array of transformed blocks
            return content.blocks.map(transformContent);
    }
}
function transformSection(section) {
    const result = {
        title: section.title,
    };
    const content = section.content;
    if (content.kind === "do-dont") {
        result.dos = content.dos;
        result.donts = content.donts;
    }
    else if (content.kind === "structured-data") {
        result.data = content.rows;
    }
    else if (content.kind === "table") {
        result.data = content.rows.map((row) => Object.fromEntries(content.headers.map((h, i) => [h, row[i] ?? ""])));
    }
    else if (content.kind === "rules") {
        result.rules = content.items;
    }
    else if (content.kind === "list") {
        result.items = content.items;
    }
    else if (content.kind === "key-value") {
        result.data = Object.fromEntries(content.entries.map((e) => [e.label, e.value]));
    }
    else if (content.kind === "paragraph") {
        result.description = content.text;
    }
    else if (content.kind === "mixed") {
        // Flatten mixed content into the section object
        for (const block of content.blocks) {
            if (block.kind === "structured-data") {
                result.data = block.rows;
            }
            else if (block.kind === "table") {
                result.data = block.rows.map((row) => Object.fromEntries(block.headers.map((h, i) => [h, row[i] ?? ""])));
            }
            else if (block.kind === "rules") {
                result.rules = block.items;
            }
            else if (block.kind === "list") {
                if (!result.notes)
                    result.notes = [];
                result.notes.push(...block.items);
            }
            else if (block.kind === "paragraph") {
                if (!result.context)
                    result.context = block.text;
                else
                    result.notes = [...(result.notes || []), block.text];
            }
            else if (block.kind === "do-dont") {
                result.dos = block.dos;
                result.donts = block.donts;
            }
            else if (block.kind === "key-value") {
                if (!result.data) {
                    result.data = Object.fromEntries(block.entries.map((e) => [e.label, e.value]));
                }
            }
        }
    }
    return result;
}
function renderJson(spec) {
    const sections = {};
    for (const section of spec.sections) {
        const key = SECTION_KEY_MAP[section.id] ?? section.id;
        sections[key] = transformSection(section);
    }
    return {
        component: spec.componentName,
        description: spec.description ?? "",
        sections,
    };
}
//# sourceMappingURL=json.js.map