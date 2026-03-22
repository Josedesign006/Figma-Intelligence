import { FontConfig } from "./font-config.js";
import { ComponentBlueprint } from "./component-templates.js";
/**
 * Build a Figma Plugin API script for a single component blueprint.
 * The script creates the component as a Component node, recursively creates
 * children with auto-layout, and binds semantic tokens via variable lookup.
 *
 * @param blueprint - Component definition
 * @param fontConfig - Font configuration
 * @param collectionId - Optional variable collection ID for token binding
 * @returns Script string for bridge.execute()
 */
export declare function buildComponentScript(blueprint: ComponentBlueprint, fontConfig: FontConfig, collectionId?: string): string;
/**
 * Build a batch script that creates ALL components for the given blueprints
 * on a new page.
 */
export declare function buildAllComponentsScript(blueprints: ComponentBlueprint[], brandName: string, fontConfig: FontConfig, collectionId?: string): string;
//# sourceMappingURL=component-script-builder.d.ts.map