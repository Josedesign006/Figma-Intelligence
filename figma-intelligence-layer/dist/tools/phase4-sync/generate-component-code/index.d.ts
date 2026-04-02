export interface GenerateComponentCodeArgs {
    /** Figma node ID of the component or component set */
    nodeId?: string;
    /** Component name — used to match built-in templates when no nodeId given */
    componentName?: string;
    /** Target framework */
    framework: "react" | "vue" | "svelte" | "html";
    /** Include Storybook stories file */
    includeStories?: boolean;
    /** Include CSS Module file */
    includeStyles?: boolean;
    /** CSS approach */
    cssStrategy?: "css-modules" | "tailwind" | "styled-components";
    /** TypeScript (default true for React/Vue) */
    typescript?: boolean;
    /** Token import path in generated CSS (default "../../tokens.css") */
    tokenImportPath?: string;
}
export declare function generateComponentCodeHandler(args: GenerateComponentCodeArgs): Promise<unknown>;
//# sourceMappingURL=index.d.ts.map