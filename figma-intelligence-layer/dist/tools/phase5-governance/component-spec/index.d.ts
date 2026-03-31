/**
 * figma_component_spec — Unified component specification generator
 *
 * Replaces both figma_generate_spec and figma_component_doc with a single,
 * modular tool that follows the uSpec pattern: deterministic data extraction
 * from real Figma components + AI-structured output. Content is never fabricated.
 */
import type { ComponentSpecArgs, ComponentSpecResult } from "./types.js";
export { resolveTargetNodeId, captureSnapshot } from "./extractors/snapshot.js";
export { createDocumentationPages, formatDocumentReport } from "./legacy-compat.js";
export type { NodeSnapshot, SnapshotNode, GeneratedDocumentSection, GeneratedDocument, } from "./types.js";
export declare function componentSpecHandler(args: ComponentSpecArgs): Promise<ComponentSpecResult>;
//# sourceMappingURL=index.d.ts.map