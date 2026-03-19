export interface StorybookArgType {
    name: string;
    description?: string;
    type?: string;
    control?: string | {
        type: string;
    };
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
/**
 * Fetch the stories.json index from a running Storybook instance.
 * Works with Storybook v6+ and v7+ formats.
 */
export declare function fetchStoriesJson(baseUrl: string): Promise<StorybookStoriesJson>;
/** Group stories by their component title (e.g. "Components/Button"). */
export declare function groupStoriesByComponent(stories: Record<string, StorybookStory>): Map<string, StorybookStory[]>;
/** Extract normalised props from a Storybook story's argTypes. */
export declare function extractStorybookProps(stories: StorybookStory[]): NormalizedProp[];
/** Normalise kebab-case / snake_case prop names to camelCase. */
export declare function normalizePropName(name: string): string;
//# sourceMappingURL=storybook-parser.d.ts.map