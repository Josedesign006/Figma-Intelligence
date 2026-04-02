// ─────────────────────────────────────────────────────────────────────────────
// figma_generate_component_code — Figma component → production code
//
// Takes a Figma component (or component set) and generates production-ready
// code: React TSX, Vue SFC, Svelte, or HTML. Also generates CSS Module,
// Storybook stories, and a barrel index file.
//
// Data sources (in priority order):
//   1. Live Figma component via bridge (spec extraction)
//   2. Built-in component templates (blueprint catalog)
//
// The generated code mirrors the Figma component 1:1:
//   - Variant axes → typed union props
//   - Boolean toggles → boolean props
//   - Instance swaps → slot/children props
//   - Semantic tokens → CSS custom properties
//   - States → CSS pseudo-classes and variant classes
//   - Sizes → dimension presets
// ─────────────────────────────────────────────────────────────────────────────

import { getBridge } from "../../../shared/figma-bridge.js";
import { componentSpecHandler } from "../../phase5-governance/component-spec/index.js";
import { COMPONENT_BLUEPRINTS, ComponentBlueprint, VariantProperty } from "../../../shared/component-templates.js";

import type {
  ExtractionResult,
  VariantAxis,
  BooleanToggle,
  InstanceSwap,
  SpacingEntry,
  ColorTokenEntry,
  TypographyEntry,
} from "../../phase5-governance/component-spec/types.js";

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface ComponentData {
  name: string;
  description: string;
  variantAxes: VariantAxis[];
  booleanToggles: BooleanToggle[];
  instanceSwaps: InstanceSwap[];
  textProps: Array<{ name: string; value: string }>;
  spacing: SpacingEntry[];
  colorTokens: ColorTokenEntry[];
  typography: TypographyEntry[];
  states: string[];
  source: "figma" | "blueprint";
}

// ─── Naming helpers ─────────────────────────────────────────────────────────

function pascalCase(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function camelCase(s: string): string {
  const p = pascalCase(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

function kebabCase(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .replace(/^-|-$/g, "");
}

function tokenToCssVar(token: string): string {
  return "var(--" + token.replace(/\//g, "-").toLowerCase() + ")";
}

// ─── Data extraction ────────────────────────────────────────────────────────

async function extractFromFigma(nodeId: string): Promise<ComponentData> {
  const specResult = await componentSpecHandler({
    nodeId,
    outputFormat: "json",
    sections: ["variants", "states", "properties", "spacing", "color-tokens", "typography"],
  });

  const ext = specResult.spec.extraction;

  return {
    name: specResult.spec.componentName,
    description: specResult.spec.description ?? "",
    variantAxes: ext.properties.variantAxes,
    booleanToggles: ext.properties.booleanToggles,
    instanceSwaps: ext.properties.instanceSwaps,
    textProps: ext.properties.textProperties,
    spacing: ext.spacing,
    colorTokens: ext.colorTokens,
    typography: ext.typography,
    states: ext.states.states.map((s) => s.name),
    source: "figma",
  };
}

function extractFromBlueprint(blueprint: ComponentBlueprint): ComponentData {
  return {
    name: blueprint.name,
    description: blueprint.description,
    variantAxes: blueprint.variantProperties.map((vp) => ({
      name: vp.name,
      values: vp.values,
      defaultValue: vp.defaultValue,
    })),
    booleanToggles: (blueprint.iconSlots ?? []).map((slot) => ({
      name: slot.propName,
      defaultValue: !slot.required,
      controlsElement: slot.nodePath,
    })),
    instanceSwaps: [],
    textProps: [],
    spacing: [],
    colorTokens: [],
    typography: [],
    states: blueprint.variantProperties
      .find((vp) => vp.name.toLowerCase() === "state")?.values ?? [],
    source: "blueprint",
  };
}

// ─── Code generators ────────────────────────────────────────────────────────

function generateReact(data: ComponentData, args: GenerateComponentCodeArgs): Record<string, string> {
  const name = pascalCase(data.name);
  const ts = args.typescript !== false;
  const ext = ts ? "tsx" : "jsx";
  const cssModule = args.cssStrategy !== "tailwind" && args.cssStrategy !== "styled-components";
  const files: Record<string, string> = {};

  // ── Build prop types ──
  const propLines: string[] = [];
  const defaultProps: string[] = [];

  // Variant axes → union types (skip "State" — handled via CSS states)
  const stateAxis = data.variantAxes.find(
    (a) => a.name.toLowerCase() === "state"
  );
  const propAxes = data.variantAxes.filter(
    (a) => a.name.toLowerCase() !== "state"
  );

  for (const axis of propAxes) {
    const propName = camelCase(axis.name);
    const unionType = axis.values.map((v) => `'${v.toLowerCase()}'`).join(" | ");
    propLines.push(`  /** ${axis.name} variant */`);
    propLines.push(`  ${propName}?: ${unionType};`);
    defaultProps.push(`    ${propName} = '${axis.defaultValue.toLowerCase()}',`);
  }

  // Boolean toggles
  for (const toggle of data.booleanToggles) {
    const propName = camelCase(toggle.name);
    propLines.push(`  /** Toggle ${toggle.name} visibility */`);
    propLines.push(`  ${propName}?: boolean;`);
    defaultProps.push(`    ${propName} = ${toggle.defaultValue},`);
  }

  // Standard props
  propLines.push(`  /** Button label / content */`);
  propLines.push(`  children: React.ReactNode;`);

  // Loading state (if component has Loading state)
  const hasLoading = data.states.some((s) => s.toLowerCase() === "loading");
  if (hasLoading) {
    propLines.push(`  /** Loading state — disables interaction and shows spinner */`);
    propLines.push(`  loading?: boolean;`);
    defaultProps.push(`    loading = false,`);
  }

  // Disabled
  const hasDisabled = data.states.some((s) => s.toLowerCase() === "disabled");
  if (hasDisabled) {
    propLines.push(`  /** Disabled state */`);
    propLines.push(`  disabled?: boolean;`);
    defaultProps.push(`    disabled = false,`);
  }

  propLines.push(`  /** Additional CSS class */`);
  propLines.push(`  className?: string;`);

  // ── Determine HTML element ──
  const isButton = data.name.toLowerCase().includes("button");
  const isInput = data.name.toLowerCase().includes("input") || data.name.toLowerCase().includes("text-field");
  const isToggle = data.name.toLowerCase().includes("toggle") || data.name.toLowerCase().includes("switch");
  const isCheckbox = data.name.toLowerCase().includes("checkbox");
  const isRadio = data.name.toLowerCase().includes("radio");

  let htmlTag = "div";
  let extendsType = "HTMLDivElement";
  let htmlAttrsType = "React.HTMLAttributes<HTMLDivElement>";

  if (isButton) {
    htmlTag = "button";
    extendsType = "HTMLButtonElement";
    htmlAttrsType = "React.ButtonHTMLAttributes<HTMLButtonElement>";
  } else if (isInput) {
    htmlTag = "input";
    extendsType = "HTMLInputElement";
    htmlAttrsType = "React.InputHTMLAttributes<HTMLInputElement>";
  }

  // ── Component file ──
  const importLines: string[] = [];
  importLines.push(`import React, { forwardRef } from 'react';`);
  if (cssModule) {
    importLines.push(`import styles from './${name}.module.css';`);
  }

  // Build className logic
  const classExprParts: string[] = [];
  if (cssModule) {
    classExprParts.push(`styles.${camelCase(data.name)}`);
    for (const axis of propAxes) {
      const propName = camelCase(axis.name);
      classExprParts.push(`styles[\`${axis.name.toLowerCase()}-\${${propName}}\`]`);
    }
    if (hasDisabled) classExprParts.push(`disabled ? styles.disabled : ''`);
    if (hasLoading) classExprParts.push(`loading ? styles.loading : ''`);
    classExprParts.push(`className || ''`);
  }

  const classExpr = classExprParts.length > 0
    ? `[${classExprParts.join(", ")}].filter(Boolean).join(' ')`
    : `className || ''`;

  // Destructured props
  const destructuredProps = [
    ...propAxes.map((a) => camelCase(a.name)),
    ...data.booleanToggles.map((t) => camelCase(t.name)),
    "children",
    ...(hasLoading ? ["loading"] : []),
    ...(hasDisabled ? ["disabled"] : []),
    "className",
    "...rest",
  ];

  const componentCode = `${importLines.join("\n")}

${ts ? `export interface ${name}Props extends ${htmlAttrsType} {
${propLines.join("\n")}
}` : ""}

const ${name} = forwardRef${ts ? `<${extendsType}, ${name}Props>` : ""}(
  (
    {
${defaultProps.join("\n")}
      children,
      className,
      ...rest
    },
    ref
  ) => {
    const classNames = ${classExpr};

    return (
      <${htmlTag}
        ref={ref}
        className={classNames}
${hasDisabled || hasLoading ? `        disabled={${hasDisabled ? "disabled" : "false"} || ${hasLoading ? "loading" : "false"}}` : ""}
        {...rest}
      >
        {children}
      </${htmlTag}>
    );
  }
);

${name}.displayName = '${name}';
export default ${name};
`;

  files[`${name}.${ext}`] = componentCode;

  // ── CSS Module ──
  if (args.includeStyles !== false && cssModule) {
    files[`${name}.module.css`] = generateCSS(data, args);
  }

  // ── Stories ──
  if (args.includeStories !== false) {
    files[`${name}.stories.${ext}`] = generateStories(data, name, ext, propAxes);
  }

  // ── Index barrel ──
  files[`index.${ts ? "ts" : "js"}`] = `export { default as ${name} } from './${name}';\nexport type { ${name}Props } from './${name}';\n`;

  return files;
}

function generateVue(data: ComponentData, args: GenerateComponentCodeArgs): Record<string, string> {
  const name = pascalCase(data.name);
  const files: Record<string, string> = {};

  const stateAxis = data.variantAxes.find((a) => a.name.toLowerCase() === "state");
  const propAxes = data.variantAxes.filter((a) => a.name.toLowerCase() !== "state");
  const hasLoading = data.states.some((s) => s.toLowerCase() === "loading");
  const hasDisabled = data.states.some((s) => s.toLowerCase() === "disabled");

  const propDefs: string[] = [];
  for (const axis of propAxes) {
    const propName = camelCase(axis.name);
    propDefs.push(`  ${propName}: {\n    type: String as PropType<${axis.values.map((v) => `'${v.toLowerCase()}'`).join(" | ")}>,\n    default: '${axis.defaultValue.toLowerCase()}',\n  },`);
  }
  for (const toggle of data.booleanToggles) {
    propDefs.push(`  ${camelCase(toggle.name)}: {\n    type: Boolean,\n    default: ${toggle.defaultValue},\n  },`);
  }
  if (hasLoading) {
    propDefs.push(`  loading: {\n    type: Boolean,\n    default: false,\n  },`);
  }
  if (hasDisabled) {
    propDefs.push(`  disabled: {\n    type: Boolean,\n    default: false,\n  },`);
  }

  const classBindings = propAxes
    .map((a) => `[$style[\`${a.name.toLowerCase()}-\${${camelCase(a.name)}}\`]]: true`)
    .join(",\n      ");

  const sfcCode = `<script setup lang="ts">
import type { PropType } from 'vue';

defineProps({
${propDefs.join("\n")}
});
</script>

<template>
  <div
    :class="{
      [$style.${camelCase(data.name)}]: true,
      ${classBindings}${hasDisabled ? `,\n      [$style.disabled]: disabled` : ""}${hasLoading ? `,\n      [$style.loading]: loading` : ""}
    }"
    v-bind="$attrs"
  >
    <slot />
  </div>
</template>

<style module>
${generateCSSBody(data, args)}
</style>
`;

  files[`${name}.vue`] = sfcCode;

  if (args.includeStories !== false) {
    files[`${name}.stories.ts`] = generateVueStories(data, name, propAxes);
  }

  return files;
}

function generateSvelte(data: ComponentData, args: GenerateComponentCodeArgs): Record<string, string> {
  const name = pascalCase(data.name);
  const files: Record<string, string> = {};

  const propAxes = data.variantAxes.filter((a) => a.name.toLowerCase() !== "state");
  const hasLoading = data.states.some((s) => s.toLowerCase() === "loading");
  const hasDisabled = data.states.some((s) => s.toLowerCase() === "disabled");

  const propDecls: string[] = [];
  for (const axis of propAxes) {
    propDecls.push(`  export let ${camelCase(axis.name)}: ${axis.values.map((v) => `'${v.toLowerCase()}'`).join(" | ")} = '${axis.defaultValue.toLowerCase()}';`);
  }
  for (const toggle of data.booleanToggles) {
    propDecls.push(`  export let ${camelCase(toggle.name)}: boolean = ${toggle.defaultValue};`);
  }
  if (hasLoading) propDecls.push(`  export let loading: boolean = false;`);
  if (hasDisabled) propDecls.push(`  export let disabled: boolean = false;`);

  const classExpr = [
    `'${kebabCase(data.name)}'`,
    ...propAxes.map((a) => `\`${a.name.toLowerCase()}-\${${camelCase(a.name)}}\``),
    ...(hasDisabled ? [`disabled ? 'disabled' : ''`] : []),
    ...(hasLoading ? [`loading ? 'loading' : ''`] : []),
  ].join(", ");

  const svelteCode = `<script lang="ts">
${propDecls.join("\n")}
</script>

<div
  class={[${classExpr}].filter(Boolean).join(' ')}
  {...$$restProps}
>
  <slot />
</div>

<style>
${generateCSSBody(data, args)}
</style>
`;

  files[`${name}.svelte`] = svelteCode;
  return files;
}

function generateHTML(data: ComponentData, args: GenerateComponentCodeArgs): Record<string, string> {
  const name = pascalCase(data.name);
  const files: Record<string, string> = {};

  const css = generateCSS(data, args);
  const kebab = kebabCase(data.name);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} Component</title>
  <style>
${generateCSSBody(data, args).split("\n").map((l) => "    " + l).join("\n")}
  </style>
</head>
<body>
  <h2>${name} Component</h2>

  <!-- Default -->
  <div class="${kebab}">
    ${name}
  </div>

${data.variantAxes
  .filter((a) => a.name.toLowerCase() !== "state")
  .map((axis) =>
    axis.values
      .map((v) => `  <!-- ${axis.name}: ${v} -->\n  <div class="${kebab} ${axis.name.toLowerCase()}-${v.toLowerCase()}">${name} (${v})</div>`)
      .join("\n")
  )
  .join("\n\n")}
</body>
</html>
`;

  files[`${name}.html`] = html;
  files[`${name}.css`] = css;
  return files;
}

// ─── CSS generation ─────────────────────────────────────────────────────────

function generateCSS(data: ComponentData, args: GenerateComponentCodeArgs): string {
  const tokenPath = args.tokenImportPath ?? "../../tokens.css";
  return `/* ============================================================
   ${data.name} — Generated from Figma Component
   Source: ${data.source === "figma" ? "Live Figma extraction" : "Blueprint catalog"}
   ============================================================ */

@import '${tokenPath}';

${generateCSSBody(data, args)}`;
}

function generateCSSBody(data: ComponentData, _args: GenerateComponentCodeArgs): string {
  const base = kebabCase(data.name);
  const propAxes = data.variantAxes.filter((a) => a.name.toLowerCase() !== "state");
  const stateAxis = data.variantAxes.find((a) => a.name.toLowerCase() === "state");
  const lines: string[] = [];

  // ── Token custom properties ──
  lines.push(`/* --- Design Tokens --- */`);
  if (data.colorTokens.length > 0) {
    lines.push(`:root {`);
    const seen = new Set<string>();
    for (const ct of data.colorTokens) {
      const varName = `--${base}-${ct.element.toLowerCase()}-${ct.property}`;
      if (seen.has(varName)) continue;
      seen.add(varName);
      lines.push(`  ${varName}: ${ct.tokenName ? tokenToCssVar(ct.tokenName) : ct.colorHex};`);
    }
    lines.push(`}`);
    lines.push(``);
  }

  // ── Base styles ──
  lines.push(`/* --- Base --- */`);
  lines.push(`.${base} {`);
  lines.push(`  display: inline-flex;`);
  lines.push(`  align-items: center;`);
  lines.push(`  justify-content: center;`);

  if (data.spacing.length > 0) {
    const root = data.spacing[0];
    if (root.layoutMode === "HORIZONTAL" || root.layoutMode === "VERTICAL") {
      lines.push(`  flex-direction: ${root.layoutMode === "VERTICAL" ? "column" : "row"};`);
    }
    if (root.itemSpacing > 0) lines.push(`  gap: ${root.itemSpacing}px;`);
    if (root.paddingTop > 0 || root.paddingRight > 0 || root.paddingBottom > 0 || root.paddingLeft > 0) {
      lines.push(`  padding: ${root.paddingTop}px ${root.paddingRight}px ${root.paddingBottom}px ${root.paddingLeft}px;`);
    }
  }

  if (data.typography.length > 0) {
    const firstText = data.typography[0];
    lines.push(`  font-family: '${firstText.fontFamily}', sans-serif;`);
    lines.push(`  font-size: ${firstText.fontSize}px;`);
    if (firstText.lineHeightPx) lines.push(`  line-height: ${firstText.lineHeightPx}px;`);
    lines.push(`  font-weight: ${firstText.fontStyle?.includes("Bold") ? 700 : firstText.fontStyle?.includes("Medium") ? 500 : 400};`);
  }

  lines.push(`  border: none;`);
  lines.push(`  cursor: pointer;`);
  lines.push(`  box-sizing: border-box;`);
  lines.push(`  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;`);
  lines.push(`}`);
  lines.push(``);

  lines.push(`.${base}:focus-visible {`);
  lines.push(`  outline: 2px solid var(--color-semantic-border-focus, #2563eb);`);
  lines.push(`  outline-offset: 2px;`);
  lines.push(`}`);
  lines.push(``);

  // ── Size variants ──
  const sizeAxis = propAxes.find(
    (a) => a.name.toLowerCase() === "size"
  );
  if (sizeAxis) {
    lines.push(`/* --- Sizes --- */`);
    const sizeMap: Record<string, { height: number; paddingX: number; paddingY: number; fontSize: number }> = {
      sm: { height: 32, paddingX: 12, paddingY: 6, fontSize: 12 },
      md: { height: 40, paddingX: 16, paddingY: 10, fontSize: 14 },
      lg: { height: 48, paddingX: 20, paddingY: 12, fontSize: 16 },
    };
    for (const size of sizeAxis.values) {
      const s = sizeMap[size.toLowerCase()] ?? sizeMap.md;
      lines.push(`.size-${size.toLowerCase()} {`);
      lines.push(`  height: ${s.height}px;`);
      lines.push(`  padding: ${s.paddingY}px ${s.paddingX}px;`);
      lines.push(`  font-size: ${s.fontSize}px;`);
      lines.push(`}`);
    }
    lines.push(``);
  }

  // ── Type/variant variants ──
  const typeAxis = propAxes.find(
    (a) => a.name.toLowerCase() === "type" || a.name.toLowerCase() === "variant"
  );
  if (typeAxis) {
    lines.push(`/* --- ${typeAxis.name} Variants --- */`);
    for (const variant of typeAxis.values) {
      const cls = `${typeAxis.name.toLowerCase()}-${variant.toLowerCase()}`;
      lines.push(`.${cls} {`);

      // Try to find matching color tokens
      const variantTokens = data.colorTokens.filter(
        (ct) => ct.tokenName?.toLowerCase().includes(variant.toLowerCase())
      );
      if (variantTokens.length > 0) {
        const bgToken = variantTokens.find((t) => t.property === "fill");
        const textToken = variantTokens.find((t) => t.property === "stroke") ?? variantTokens.find((t) => t.element.toLowerCase().includes("text") || t.element.toLowerCase().includes("label"));
        if (bgToken) lines.push(`  background-color: ${bgToken.tokenName ? tokenToCssVar(bgToken.tokenName) : bgToken.colorHex};`);
        if (textToken) lines.push(`  color: ${textToken.tokenName ? tokenToCssVar(textToken.tokenName) : textToken.colorHex};`);
      }

      lines.push(`}`);

      // Hover / active states
      lines.push(`.${cls}:hover:not(:disabled) {`);
      lines.push(`  opacity: 0.9;`);
      lines.push(`}`);
      lines.push(`.${cls}:active:not(:disabled) {`);
      lines.push(`  opacity: 0.8;`);
      lines.push(`}`);
    }
    lines.push(``);
  }

  // ── Disabled ──
  if (data.states.some((s) => s.toLowerCase() === "disabled")) {
    lines.push(`/* --- Disabled --- */`);
    lines.push(`.disabled,`);
    lines.push(`.${base}:disabled {`);
    lines.push(`  opacity: 0.4;`);
    lines.push(`  cursor: not-allowed;`);
    lines.push(`  pointer-events: none;`);
    lines.push(`}`);
    lines.push(``);
  }

  // ── Loading ──
  if (data.states.some((s) => s.toLowerCase() === "loading")) {
    lines.push(`/* --- Loading --- */`);
    lines.push(`.loading {`);
    lines.push(`  pointer-events: none;`);
    lines.push(`  position: relative;`);
    lines.push(`}`);
    lines.push(``);
    lines.push(`@keyframes spin {`);
    lines.push(`  to { transform: rotate(360deg); }`);
    lines.push(`}`);
    lines.push(``);
  }

  return lines.join("\n");
}

// ─── Storybook generation ───────────────────────────────────────────────────

function generateStories(
  data: ComponentData,
  name: string,
  ext: string,
  propAxes: VariantAxis[]
): string {
  const typeAxis = propAxes.find(
    (a) => a.name.toLowerCase() === "type" || a.name.toLowerCase() === "variant"
  );
  const sizeAxis = propAxes.find((a) => a.name.toLowerCase() === "size");
  const hasLoading = data.states.some((s) => s.toLowerCase() === "loading");
  const hasDisabled = data.states.some((s) => s.toLowerCase() === "disabled");

  const argTypes: string[] = [];
  for (const axis of propAxes) {
    argTypes.push(`    ${camelCase(axis.name)}: {\n      control: 'select',\n      options: [${axis.values.map((v) => `'${v.toLowerCase()}'`).join(", ")}],\n    },`);
  }
  for (const toggle of data.booleanToggles) {
    argTypes.push(`    ${camelCase(toggle.name)}: { control: 'boolean' },`);
  }
  if (hasDisabled) argTypes.push(`    disabled: { control: 'boolean' },`);
  if (hasLoading) argTypes.push(`    loading: { control: 'boolean' },`);

  const defaultArgs: string[] = [
    `    children: '${name}',`,
    ...propAxes.map((a) => `    ${camelCase(a.name)}: '${a.defaultValue.toLowerCase()}',`),
    ...data.booleanToggles.map((t) => `    ${camelCase(t.name)}: ${t.defaultValue},`),
    ...(hasDisabled ? [`    disabled: false,`] : []),
    ...(hasLoading ? [`    loading: false,`] : []),
  ];

  let allVariantsStory = "";
  if (typeAxis && sizeAxis) {
    allVariantsStory = `
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {(${JSON.stringify(typeAxis.values.map((v) => v.toLowerCase()))} as const).map((variant) => (
        <div key={variant} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ width: 100, fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>{variant}</span>
          {(${JSON.stringify(sizeAxis.values.map((v) => v.toLowerCase()))} as const).map((size) => (
            <${name} key={\`\${variant}-\${size}\`} ${camelCase(typeAxis.name)}={variant} ${camelCase(sizeAxis.name)}={size}>${name}</${name}>
          ))}
          <${name} ${camelCase(typeAxis.name)}={variant} disabled>${name}</${name}>
        </div>
      ))}
    </div>
  ),
};`;
  }

  return `import type { Meta, StoryObj } from '@storybook/react';
import ${name} from './${name}';

const meta: Meta<typeof ${name}> = {
  title: 'Components/${name}',
  component: ${name},
  argTypes: {
${argTypes.join("\n")}
  },
  args: {
${defaultArgs.join("\n")}
  },
};

export default meta;
type Story = StoryObj<typeof ${name}>;

export const Default: Story = {};
${allVariantsStory}

export const Disabled: Story = {
  args: { disabled: true },
};
${hasLoading ? `
export const Loading: Story = {
  args: { loading: true },
};` : ""}
`;
}

function generateVueStories(data: ComponentData, name: string, propAxes: VariantAxis[]): string {
  const defaultArgs: string[] = propAxes.map(
    (a) => `      ${camelCase(a.name)}: '${a.defaultValue.toLowerCase()}',`
  );

  return `import type { Meta, StoryObj } from '@storybook/vue3';
import ${name} from './${name}.vue';

const meta: Meta<typeof ${name}> = {
  title: 'Components/${name}',
  component: ${name},
  args: {
${defaultArgs.join("\n")}
  },
};

export default meta;
type Story = StoryObj<typeof ${name}>;

export const Default: Story = {
  render: (args) => ({
    components: { ${name} },
    setup() { return { args }; },
    template: '<${name} v-bind="args">${name}</${name}>',
  }),
};
`;
}

// ─── Main handler ───────────────────────────────────────────────────────────

export async function generateComponentCodeHandler(
  args: GenerateComponentCodeArgs
): Promise<unknown> {
  let data: ComponentData;

  // 1. Try live Figma extraction
  if (args.nodeId) {
    try {
      data = await extractFromFigma(args.nodeId);
    } catch (err) {
      return {
        error: `Failed to extract component data from Figma: ${err instanceof Error ? err.message : String(err)}`,
        hint: "Ensure Figma is open with the bridge plugin running, and the nodeId points to a Component or ComponentSet.",
      };
    }
  } else if (args.componentName) {
    // 2. Fall back to blueprint catalog
    const blueprint = COMPONENT_BLUEPRINTS.find(
      (b) => b.name.toLowerCase() === args.componentName!.toLowerCase()
    );
    if (!blueprint) {
      return {
        error: `No blueprint found for component "${args.componentName}".`,
        availableBlueprints: COMPONENT_BLUEPRINTS.map((b) => b.name),
      };
    }
    data = extractFromBlueprint(blueprint);
  } else {
    // 3. Try current selection
    try {
      const bridge = await getBridge();
      const selection = (await bridge.getSelection()) as Array<{ id: string }>;
      if (!selection?.length) {
        return {
          error: "No nodeId or componentName provided, and nothing is selected in Figma.",
          hint: "Select a component in Figma, or pass nodeId or componentName.",
        };
      }
      data = await extractFromFigma(selection[0].id);
    } catch {
      return {
        error: "No nodeId or componentName provided, and Figma bridge is not connected.",
        hint: "Pass nodeId (from Figma) or componentName (to use built-in blueprints).",
        availableBlueprints: COMPONENT_BLUEPRINTS.map((b) => b.name),
      };
    }
  }

  // Generate code for the requested framework
  let files: Record<string, string>;

  switch (args.framework) {
    case "react":
      files = generateReact(data, args);
      break;
    case "vue":
      files = generateVue(data, args);
      break;
    case "svelte":
      files = generateSvelte(data, args);
      break;
    case "html":
      files = generateHTML(data, args);
      break;
    default:
      return { error: `Unsupported framework: ${args.framework}` };
  }

  return {
    component: data.name,
    framework: args.framework,
    source: data.source,
    files,
    summary: {
      totalFiles: Object.keys(files).length,
      props: [
        ...data.variantAxes
          .filter((a) => a.name.toLowerCase() !== "state")
          .map((a) => ({ name: camelCase(a.name), type: "variant", values: a.values })),
        ...data.booleanToggles.map((t) => ({ name: camelCase(t.name), type: "boolean" })),
        ...(data.states.some((s) => s.toLowerCase() === "loading") ? [{ name: "loading", type: "boolean" }] : []),
        ...(data.states.some((s) => s.toLowerCase() === "disabled") ? [{ name: "disabled", type: "boolean" }] : []),
      ],
      states: data.states,
      variantCombinations: data.variantAxes.reduce((acc, a) => acc * a.values.length, 1),
      tokenCount: data.colorTokens.length,
    },
    usage: `Copy the files to your components directory:\n  ${Object.keys(files).join("\n  ")}`,
  };
}
