"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Storybook Parser
// Fetches Storybook's stories.json endpoint and normalises prop/argType
// data for reconciliation with Figma component properties.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchStoriesJson = fetchStoriesJson;
exports.groupStoriesByComponent = groupStoriesByComponent;
exports.extractStorybookProps = extractStorybookProps;
exports.normalizePropName = normalizePropName;
// ─── Fetch ────────────────────────────────────────────────────────────────────
/**
 * Fetch the stories.json index from a running Storybook instance.
 * Works with Storybook v6+ and v7+ formats.
 */
async function fetchStoriesJson(baseUrl) {
    const cleanUrl = baseUrl.replace(/\/+$/, "");
    const resp = await fetch(`${cleanUrl}/stories.json`);
    if (!resp.ok) {
        throw new Error(`Failed to fetch Storybook stories.json (${resp.status})`);
    }
    return resp.json();
}
// ─── Grouping ─────────────────────────────────────────────────────────────────
/** Group stories by their component title (e.g. "Components/Button"). */
function groupStoriesByComponent(stories) {
    const groups = new Map();
    for (const story of Object.values(stories)) {
        const group = groups.get(story.title) ?? [];
        group.push(story);
        groups.set(story.title, group);
    }
    return groups;
}
// ─── Prop extraction ──────────────────────────────────────────────────────────
const SKIP_PROPS = new Set(["children", "className", "style", "key", "ref"]);
/** Extract normalised props from a Storybook story's argTypes. */
function extractStorybookProps(stories) {
    const propMap = new Map();
    for (const story of stories) {
        if (!story.argTypes)
            continue;
        for (const [key, arg] of Object.entries(story.argTypes)) {
            if (SKIP_PROPS.has(key))
                continue;
            if (propMap.has(key))
                continue;
            const controlType = typeof arg.control === "string"
                ? arg.control
                : arg.control?.type ?? arg.type ?? "text";
            const values = arg.options
                ? arg.options.map(String)
                : controlType === "boolean"
                    ? ["true", "false"]
                    : [];
            propMap.set(key, {
                name: normalizePropName(key),
                values,
                type: controlType,
            });
        }
    }
    return Array.from(propMap.values());
}
// ─── Naming normalisation ─────────────────────────────────────────────────────
/** Normalise kebab-case / snake_case prop names to camelCase. */
function normalizePropName(name) {
    return name.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
}
//# sourceMappingURL=storybook-parser.js.map