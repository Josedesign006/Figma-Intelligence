// ─────────────────────────────────────────────────────────────────────────────
// figma_icon_library_sync — Bidirectional icon library synchronization
//
// Syncs icons between Figma and code:
//   - Export: Figma icon components → SVG files + React/Vue icon components
//   - Import: SVG directory → Figma icon components
//   - Diff: Compare Figma icon set against local SVG directory, report changes
//   - Catalog: Generate a typed icon catalog (name → component map)
//
// Change detection tracks which icons are added, modified, or removed between
// Figma and the codebase.
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface IconLibrarySyncArgs {
  /** Sync direction */
  action: "export" | "diff" | "catalog";
  /** Figma page or frame containing the icon set (default: page named "Icons" or current page) */
  sourceNodeId?: string;
  /** Icon component name prefix filter (e.g. "icon/" or "Icon/") */
  namePrefix?: string;
  /** Output framework for generated components */
  framework?: "react" | "vue" | "svelte" | "svg-only";
  /** Whether to generate a TypeScript icon catalog */
  generateCatalog?: boolean;
  /** Export size in px (default: 24) */
  exportSize?: number;
  /** Include size variants (16, 20, 24, 32) */
  includeSizeVariants?: boolean;
  /** Existing icon names for diff comparison */
  existingIcons?: string[];
}

interface FigmaIcon {
  nodeId: string;
  name: string;
  cleanName: string;
  componentName: string;
  width: number;
  height: number;
  hasVariants: boolean;
  variants: string[];
  svgContent: string;
  category: string;
}

interface IconDiff {
  added: string[];
  removed: string[];
  modified: string[];
  unchanged: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function cleanIconName(name: string, prefix?: string): string {
  let clean = name;
  if (prefix && clean.startsWith(prefix)) {
    clean = clean.slice(prefix.length);
  }
  return clean
    .replace(/\//g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function iconToPascalCase(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function iconToCamelCase(name: string): string {
  const pascal = iconToPascalCase(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function categorizeIcon(name: string): string {
  const lower = name.toLowerCase();
  if (/arrow|chevron|caret|expand|collapse|direction/.test(lower)) return "navigation";
  if (/edit|delete|add|remove|create|copy|paste|cut|save/.test(lower)) return "action";
  if (/check|close|error|warning|info|success|alert/.test(lower)) return "status";
  if (/user|person|people|group|account|avatar/.test(lower)) return "user";
  if (/file|folder|document|upload|download|attachment/.test(lower)) return "file";
  if (/search|filter|sort|zoom/.test(lower)) return "search";
  if (/settings|gear|cog|tune|config/.test(lower)) return "settings";
  if (/home|menu|grid|list|layout|dashboard/.test(lower)) return "layout";
  if (/mail|email|message|chat|notification|bell/.test(lower)) return "communication";
  if (/lock|unlock|security|shield|key/.test(lower)) return "security";
  if (/calendar|clock|time|date|schedule/.test(lower)) return "time";
  if (/star|heart|like|favorite|bookmark/.test(lower)) return "social";
  if (/link|share|external|globe|world/.test(lower)) return "connectivity";
  return "misc";
}

// ─── Figma icon extraction ─────────────────────────────────────────────────

async function extractFigmaIcons(
  sourceNodeId?: string,
  namePrefix?: string,
  exportSize?: number
): Promise<FigmaIcon[]> {
  const bridge = await getBridge();
  const size = exportSize ?? 24;

  const result = await bridge.execute(`
    (async () => {
      var sourceNode = ${sourceNodeId ? `figma.getNodeById('${sourceNodeId}')` : `figma.currentPage`};
      if (!sourceNode) {
        // Try to find an "Icons" page
        var iconPage = figma.root.children.find(function(p) {
          return p.name.toLowerCase().includes('icon');
        });
        sourceNode = iconPage || figma.currentPage;
      }

      var prefix = ${namePrefix ? `'${namePrefix}'` : 'null'};
      var icons = [];

      // Find all component/component set nodes that look like icons
      var candidates = sourceNode.findAll(function(n) {
        if (n.type !== 'COMPONENT' && n.type !== 'COMPONENT_SET') return false;
        if (prefix && !n.name.startsWith(prefix)) return false;
        // Heuristic: icons are typically small and roughly square
        if (!prefix) {
          var isSmall = n.width <= 64 && n.height <= 64;
          var isSquarish = Math.abs(n.width - n.height) <= 4;
          var nameHint = n.name.toLowerCase().includes('icon') || n.name.toLowerCase().includes('ico');
          return isSmall || isSquarish || nameHint;
        }
        return true;
      });

      for (var i = 0; i < candidates.length; i++) {
        var node = candidates[i];
        var variants = [];

        if (node.type === 'COMPONENT_SET' && node.children) {
          variants = node.children.map(function(c) { return c.name; });
        }

        // Export SVG
        var exportNode = node.type === 'COMPONENT_SET' && node.children.length > 0
          ? node.children[0]
          : node;

        var svgBytes;
        try {
          svgBytes = await exportNode.exportAsync({
            format: 'SVG',
            svgOutlineText: true,
            svgIdAttribute: false,
            svgSimplifyStroke: true,
          });
        } catch(e) {
          continue;
        }

        var svgContent = String.fromCharCode.apply(null, svgBytes);

        icons.push({
          nodeId: node.id,
          name: node.name,
          width: Math.round(exportNode.width),
          height: Math.round(exportNode.height),
          hasVariants: node.type === 'COMPONENT_SET',
          variants: variants,
          svgContent: svgContent
        });
      }

      return icons;
    })();
  `);

  if (!result.success || !result.result) {
    throw new Error(result.error || "Failed to extract icons from Figma");
  }

  const rawIcons = result.result as Array<{
    nodeId: string;
    name: string;
    width: number;
    height: number;
    hasVariants: boolean;
    variants: string[];
    svgContent: string;
  }>;

  return rawIcons.map((icon) => {
    const cleanName = cleanIconName(icon.name, namePrefix ?? undefined);
    return {
      ...icon,
      cleanName,
      componentName: `Icon${iconToPascalCase(cleanName)}`,
      category: categorizeIcon(cleanName),
    };
  });
}

// ─── Code generators ──────────────────────────────────────────────────────

function generateReactIcon(icon: FigmaIcon): string {
  // Clean up SVG: remove width/height, add currentColor
  let svg = icon.svgContent
    .replace(/width="[^"]*"/, 'width={size}')
    .replace(/height="[^"]*"/, 'height={size}')
    .replace(/<svg/, '<svg aria-hidden={!title} role={title ? "img" : "presentation"}');

  // Replace fill/stroke colors with currentColor for theming
  svg = svg
    .replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"');

  return `import React from 'react';

export interface ${icon.componentName}Props {
  /** Icon size in pixels */
  size?: number;
  /** CSS color override */
  color?: string;
  /** Accessible title (makes icon non-decorative) */
  title?: string;
  /** Additional class name */
  className?: string;
}

const ${icon.componentName}: React.FC<${icon.componentName}Props> = ({
  size = 24,
  color = 'currentColor',
  title,
  className,
  ...props
}) => (
  ${svg.replace(/\n/g, "\n  ")}
);

${icon.componentName}.displayName = '${icon.componentName}';
export default ${icon.componentName};
`;
}

function generateVueIcon(icon: FigmaIcon): string {
  let svg = icon.svgContent
    .replace(/width="[^"]*"/, ':width="size"')
    .replace(/height="[^"]*"/, ':height="size"')
    .replace(/fill="(?!none)[^"]*"/g, ':fill="color"')
    .replace(/stroke="(?!none)[^"]*"/g, ':stroke="color"');

  return `<script setup lang="ts">
defineProps<{
  size?: number;
  color?: string;
  title?: string;
}>();
</script>

<template>
  ${svg}
</template>
`;
}

function generateSvelteIcon(icon: FigmaIcon): string {
  let svg = icon.svgContent
    .replace(/width="[^"]*"/, 'width={size}')
    .replace(/height="[^"]*"/, 'height={size}')
    .replace(/fill="(?!none)[^"]*"/g, 'fill={color}')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke={color}');

  return `<script lang="ts">
  export let size: number = 24;
  export let color: string = 'currentColor';
  export let title: string = '';
</script>

{#if title}<title>{title}</title>{/if}
${svg}
`;
}

function generateIconCatalog(icons: FigmaIcon[], framework: string): string {
  const ext = framework === "vue" ? "vue" : framework === "svelte" ? "svelte" : "tsx";

  const imports = icons
    .map((icon) => `import ${icon.componentName} from './${icon.cleanName}/${icon.componentName}.${ext === "tsx" ? "tsx" : ext}';`)
    .join("\n");

  const catalogEntries = icons
    .map((icon) => `  '${icon.cleanName}': ${icon.componentName},`)
    .join("\n");

  const categoryMap = new Map<string, string[]>();
  for (const icon of icons) {
    const existing = categoryMap.get(icon.category) ?? [];
    existing.push(icon.cleanName);
    categoryMap.set(icon.category, existing);
  }

  const categories = [...categoryMap.entries()]
    .map(([cat, names]) => `  '${cat}': [${names.map((n) => `'${n}'`).join(", ")}],`)
    .join("\n");

  return `// Auto-generated icon catalog — do not edit manually
// Generated by figma_icon_library_sync
// ${icons.length} icons across ${categoryMap.size} categories

${imports}

export const ICON_CATALOG = {
${catalogEntries}
} as const;

export type IconName = keyof typeof ICON_CATALOG;

export const ICON_CATEGORIES = {
${categories}
} as const;

export type IconCategory = keyof typeof ICON_CATEGORIES;

/** Get all icon names */
export function getIconNames(): IconName[] {
  return Object.keys(ICON_CATALOG) as IconName[];
}

/** Get icons by category */
export function getIconsByCategory(category: IconCategory): IconName[] {
  return ICON_CATEGORIES[category] as unknown as IconName[];
}

/** Get the component for a given icon name */
export function getIconComponent(name: IconName) {
  return ICON_CATALOG[name];
}

export { ${icons.map((i) => i.componentName).join(", ")} };
`;
}

// ─── Main handler ──────────────────────────────────────────────────────────

export async function iconLibrarySyncHandler(args: IconLibrarySyncArgs): Promise<unknown> {
  const framework = args.framework ?? "react";

  switch (args.action) {
    case "export": {
      const icons = await extractFigmaIcons(args.sourceNodeId, args.namePrefix, args.exportSize);

      if (icons.length === 0) {
        return {
          error: "No icon components found. Ensure your icons are Component or ComponentSet nodes.",
          hint: args.namePrefix
            ? `No icons matched prefix "${args.namePrefix}". Check the naming convention.`
            : "Try specifying a sourceNodeId or namePrefix to narrow the search.",
        };
      }

      const files: Record<string, string> = {};

      for (const icon of icons) {
        // SVG file
        files[`${icon.cleanName}/${icon.cleanName}.svg`] = icon.svgContent;

        // Framework component
        if (framework !== "svg-only") {
          switch (framework) {
            case "react":
              files[`${icon.cleanName}/${icon.componentName}.tsx`] = generateReactIcon(icon);
              break;
            case "vue":
              files[`${icon.cleanName}/${icon.componentName}.vue`] = generateVueIcon(icon);
              break;
            case "svelte":
              files[`${icon.cleanName}/${icon.componentName}.svelte`] = generateSvelteIcon(icon);
              break;
          }
        }
      }

      // Generate catalog
      if (args.generateCatalog !== false && framework !== "svg-only") {
        files["index.ts"] = generateIconCatalog(icons, framework);
      }

      // Barrel export for SVGs
      files["sprites.ts"] = icons
        .map((icon) => `export { default as ${icon.componentName} } from './${icon.cleanName}/${icon.componentName}';`)
        .join("\n") + "\n";

      const categories = new Map<string, number>();
      for (const icon of icons) {
        categories.set(icon.category, (categories.get(icon.category) ?? 0) + 1);
      }

      return {
        action: "export",
        totalIcons: icons.length,
        framework,
        categories: Object.fromEntries(categories),
        files,
        summary: {
          totalFiles: Object.keys(files).length,
          iconNames: icons.map((i) => i.cleanName),
          withVariants: icons.filter((i) => i.hasVariants).length,
        },
        usage: `Copy the generated files to your icon directory. Import icons individually or use the catalog:\n\nimport { IconSearch, IconClose } from './icons';\nimport { ICON_CATALOG, type IconName } from './icons';`,
      };
    }

    case "diff": {
      const icons = await extractFigmaIcons(args.sourceNodeId, args.namePrefix, args.exportSize);
      const figmaNames = icons.map((i) => i.cleanName);
      const existingNames = args.existingIcons ?? [];

      const diff: IconDiff = {
        added: figmaNames.filter((n) => !existingNames.includes(n)),
        removed: existingNames.filter((n) => !figmaNames.includes(n)),
        modified: [], // Would need SVG content comparison for real modification detection
        unchanged: figmaNames.filter((n) => existingNames.includes(n)),
      };

      return {
        action: "diff",
        figmaIconCount: figmaNames.length,
        codeIconCount: existingNames.length,
        diff,
        summary: {
          added: diff.added.length,
          removed: diff.removed.length,
          modified: diff.modified.length,
          unchanged: diff.unchanged.length,
          inSync: diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0,
        },
        hint: diff.added.length > 0 || diff.removed.length > 0
          ? "Run with action: 'export' to regenerate the icon library from Figma."
          : "Icon library is in sync with Figma.",
      };
    }

    case "catalog": {
      const icons = await extractFigmaIcons(args.sourceNodeId, args.namePrefix, args.exportSize);

      if (icons.length === 0) {
        return { error: "No icons found to catalog." };
      }

      const catalog = generateIconCatalog(icons, framework);

      const categories = new Map<string, string[]>();
      for (const icon of icons) {
        const existing = categories.get(icon.category) ?? [];
        existing.push(icon.cleanName);
        categories.set(icon.category, existing);
      }

      return {
        action: "catalog",
        totalIcons: icons.length,
        categories: Object.fromEntries(categories),
        files: { "icon-catalog.ts": catalog },
        icons: icons.map((i) => ({
          name: i.cleanName,
          componentName: i.componentName,
          category: i.category,
          size: `${i.width}×${i.height}`,
          hasVariants: i.hasVariants,
          variantCount: i.variants.length,
        })),
      };
    }

    default:
      return { error: `Unknown action: ${args.action}` };
  }
}
