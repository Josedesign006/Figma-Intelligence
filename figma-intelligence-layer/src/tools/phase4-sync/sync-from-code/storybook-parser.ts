// ─────────────────────────────────────────────────────────────────────────────
// Storybook Parser
// Fetches Storybook's stories.json endpoint and normalises prop/argType
// data for reconciliation with Figma component properties.
// ─────────────────────────────────────────────────────────────────────────────

export interface StorybookArgType {
  name: string;
  description?: string;
  type?: string;
  control?: string | { type: string };
  options?: string[];
  defaultValue?: unknown;
  table?: Record<string, unknown>;
}

export interface StorybookStory {
  id: string;
  title: string;
  name: string;
  importPath?: string;
  argTypes?: Record<string, StorybookArgType>;
}

export interface StorybookStoriesJson {
  v: number;
  stories: Record<string, StorybookStory>;
}

export interface NormalizedProp {
  name: string;
  values: string[];
  type: string;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch the stories.json index from a running Storybook instance.
 * Works with Storybook v6+ and v7+ formats.
 */
export async function fetchStoriesJson(baseUrl: string): Promise<StorybookStoriesJson> {
  const cleanUrl = baseUrl.replace(/\/+$/, "");
  const resp = await fetch(`${cleanUrl}/stories.json`);
  if (!resp.ok) {
    throw new Error(`Failed to fetch Storybook stories.json (${resp.status})`);
  }
  return resp.json() as Promise<StorybookStoriesJson>;
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

/** Group stories by their component title (e.g. "Components/Button"). */
export function groupStoriesByComponent(
  stories: Record<string, StorybookStory>
): Map<string, StorybookStory[]> {
  const groups = new Map<string, StorybookStory[]>();
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
export function extractStorybookProps(stories: StorybookStory[]): NormalizedProp[] {
  const propMap = new Map<string, NormalizedProp>();

  for (const story of stories) {
    if (!story.argTypes) continue;
    for (const [key, arg] of Object.entries(story.argTypes)) {
      if (SKIP_PROPS.has(key)) continue;
      if (propMap.has(key)) continue;

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
export function normalizePropName(name: string): string {
  return name.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase());
}
