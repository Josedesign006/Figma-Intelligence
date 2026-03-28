---
name: component-doc-generator
description: >
  Generate comprehensive design system component documentation directly in Figma.
  Produces anatomy annotations, API specs, property exhibits, color token mapping,
  structure/spacing specs, and accessibility (screen reader) specs — all rendered
  as structured frames in your Figma file via Figma MCP. Use this skill whenever
  someone asks to document a component, create component specs, generate design
  system documentation, annotate a component's anatomy, map color tokens, document
  spacing/structure, create accessibility specs, or produce any form of component
  specification in Figma. Also trigger when users mention "component docs", "spec
  pages", "design handoff docs", "anatomy markers", "API table", "property overview",
  "color annotation", "structure spec", "screen reader spec", or "a11y spec".
  Works with Figma Console MCP and native Figma MCP.
---

# Component Documentation Generator

Generate production-quality design system component documentation directly in Figma — anatomy, API, properties, color tokens, structure, and screen reader specs.

## Overview

This skill connects to your Figma file through Figma MCP (Console MCP or native Figma MCP), extracts component data programmatically, applies AI reasoning for classification and semantics, and renders structured documentation frames directly in your Figma file.

**The pipeline for every spec type follows the same pattern:**
1. **Extract** — Read component layers, properties, variables, and styles from Figma via MCP
2. **Classify & Enrich** — AI determines element roles, semantic meaning, and documentation strategy
3. **Import Template** — Pull the documentation template from your library (or create frames from scratch)
4. **Render** — Build the spec: fill text fields, create instances, place markers, build tables
5. **Validate** — Capture screenshot, check completeness, fix issues (up to 3 iterations)

## Prerequisites

- **Figma MCP connected** — Either Figma Console MCP (with Desktop Bridge plugin) or native Figma MCP
- **A Figma component link** — The URL to a component set or standalone component
- **Template library** (optional but recommended) — A published Figma library with documentation templates

Before running any spec, verify the Figma MCP connection by asking the agent to check Figma status or list pages.

## Available Spec Types

| Command | What It Generates |
|---------|-------------------|
| `create-anatomy` | Numbered markers on each element + attribute table with semantic notes |
| `create-api` | Property tables with values, defaults, required/optional, configuration examples |
| `create-property` | Visual exhibits for variant axes, boolean toggles, variable modes, child properties |
| `create-color` | Design token mapping for every element across states and variants |
| `create-structure` | Dimensions, spacing, padding tables across size/density variants |
| `create-screen-reader` | VoiceOver, TalkBack, and ARIA accessibility specs per platform |

## How to Invoke

Paste a Figma component link and specify the spec type. Add context about the component for richer output.

```
create-anatomy https://www.figma.com/design/FILE_KEY/File-Name?node-id=XX:YY

This is a text field with a leading icon, label, placeholder text, 
helper text, and a trailing clear button. It has enabled, focused, 
error, and disabled states.
```

**Optional destination**: Place the spec in a different file or page:
```
Destination: https://www.figma.com/design/OTHER_KEY/Docs?node-id=0-1
```

## Reading Reference Files

Before generating any spec, read the appropriate reference file for detailed instructions:

| Spec Type | Reference File |
|-----------|---------------|
| Anatomy | `references/anatomy-spec.md` |
| API | `references/api-spec.md` |
| Properties | `references/property-spec.md` |
| Color Annotation | `references/color-spec.md` |
| Structure | `references/structure-spec.md` |
| Screen Reader | `references/screen-reader-spec.md` |

**Always read the reference file before starting.** Each contains the exact extraction steps, classification logic, rendering instructions, and validation checklist for that spec type.

## General Rendering Rules (Apply to ALL Spec Types)

### Frame & Layout Standards
- Documentation frame width: **1440px** (standard Figma doc width)
- Use **auto-layout** for all sections (vertical, spacing 24–40px between sections)
- Section headers: **24px bold**, body text: **14px regular**, table text: **13px**
- Use your design system's font family if configured; fall back to Inter
- Background: white (#FFFFFF); text: near-black (#1A1A1A)
- Section dividers: 1px line, #E5E5E5

### Marker Standards (Anatomy & Color)
- Marker circles: **24px diameter**, fill **#D946EF** (pink/magenta), white text, 13px bold
- Connector lines: 1px stroke, same pink color, from marker center to element edge
- Markers numbered sequentially starting at 1
- Place markers outside the component artwork, connected by leader lines

### Table Standards
- Header row: **#F3F4F6** background, 13px bold text
- Body rows: alternating white / **#FAFAFA**
- Cell padding: 8px horizontal, 6px vertical
- Border: 1px #E5E5E5

### Instance Rendering
- When showing component instances as artwork, set them to the exact variant/state needed
- Make hidden boolean elements visible by toggling component properties (not raw visibility)
- Label hidden elements as "(hidden)" in tables

### Validation Loop
After rendering each spec:
1. Capture a screenshot of the output frame
2. Check: Are all sections present? Are markers aligned? Are tables complete?
3. If issues found, fix them automatically
4. Repeat up to **3 times** maximum
5. Report completion to the user

## Figma MCP Operations Reference

These are the key MCP operations used across all spec types. The exact tool names depend on your MCP provider.

### Reading Component Data
```
// Get component children and properties
get_node_children(node_id)
get_component_property_definitions(node_id)
get_variant_properties(node_id)

// Get styles, fills, variables
get_node_styles(node_id)
get_node_fills(node_id)
get_bound_variables(node_id)
get_variable_collection(collection_id)

// Get dimensions
get_node_dimensions(node_id)  // returns width, height, padding, gaps
```

### Writing to Figma
```
// Create frames and text
create_frame(parent_id, name, width, height, layout_mode)
create_text(parent_id, content, font_size, font_weight)

// Create instances
create_instance(component_key, parent_id)
set_component_properties(instance_id, properties)

// Drawing markers
create_ellipse(parent_id, x, y, diameter, fill_color)
create_line(parent_id, start_x, start_y, end_x, end_y, stroke_color)

// Import from library
import_component_by_key(template_key)
detach_instance(instance_id)
```

### Screenshots
```
capture_screenshot(node_id)  // for validation
```

## Tips for Best Results

1. **Use component sets** — Skills expect a component set (dashed-border container) or standalone component, not an instance
2. **Name your layers** — Layer names become element labels. "Leading Icon" beats "Frame 47"
3. **Describe all states** — The agent can't infer states not visible in the current frame
4. **Mention sub-components** — If your component nests other components, describe their configuration
5. **Specify defaults** — Tell the agent which values are the default configuration
6. **List interactive states** — enabled, hover, pressed, disabled, focused, selected, loading
7. **Describe variable modes** — If properties are controlled by Figma variable collections, name them

## Error Handling

- If MCP connection fails: Ask the user to verify their Figma MCP setup and Desktop Bridge plugin
- If component not found: Verify the node-id in the Figma link is correct
- If template import fails: Fall back to creating frames from scratch (no template dependency)
- If rendering is incomplete after 3 validation attempts: Report what was completed and what needs manual adjustment
