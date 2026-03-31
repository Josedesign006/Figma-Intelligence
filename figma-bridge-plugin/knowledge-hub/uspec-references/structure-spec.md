# Structure Spec Reference

Generate dimensional properties documentation — spacing, padding, heights, widths, and gaps across size and density variants.

## What This Spec Produces

1. **Dimension tables** — Organized by component section (container, leading, labels, trailing)
2. **Size/density columns** — Values shown across all variants so engineers see how dimensions change
3. **Token references** — Values linked to design tokens when bound to variables
4. **Composition mapping** — How parent sizes map to sub-component sizes

---

## Step-by-Step Pipeline

### Phase 1: Identify Dimensional Axes

Determine which variant axes and variable modes affect dimensions:

**Common dimensional axes:**
- **Size**: Large, Medium, Small, XSmall → changes heights, padding, icon sizes, font sizes
- **Density**: Compact, Default, Spacious → changes vertical padding, gaps
- **Shape**: Rounded, Square, Pill → changes border-radius (not spacing, but sometimes affects padding)

Read from two sources:
1. Variant axes from component set variants
2. Variable mode collections (density, size often come from variable modes)

### Phase 2: Extract Measurements (Deterministic)

For each dimensional variant combination, measure the component:

```
// For each size/density variant:
get_node_dimensions(instance_id) → {
  width, height,
  paddingTop, paddingBottom, paddingLeft, paddingRight,
  itemSpacing,        // gap between children in auto-layout
  counterAxisSpacing, // gap in the cross-axis (if wrap)
  borderRadius,
  strokeWeight
}
```

Traverse child layers and measure each section:
```
Container
├── Leading Content → width, height, gap from label section
│   └── Icon/Avatar → width, height
├── Label Section → vertical layout
│   ├── Primary Label → fontSize, lineHeight
│   ├── Secondary Label → fontSize, lineHeight
│   └── Gap between labels
├── Trailing Content → width, height
│   └── Icon/Button → width, height
└── Internal gaps between all sections
```

**Token resolution**: For each measured value, check if it's bound to a variable:
```
get_bound_variables(node_id, "paddingLeft") → "spacing/component/md" (16)
get_bound_variables(node_id, "height") → "sizing/button/lg" (56)
```

Report as: `token-name (resolved-value)` e.g., `spacing-md (16)` or just the raw number if hardcoded.

### Phase 3: Plan Documentation Sections (AI Reasoning)

Group measurements into logical sections based on the component's structure:

| Section | What to Document |
|---------|-----------------|
| **Container** | Height, min-width, max-width, border-radius, stroke-weight |
| **Padding** | Top, bottom, left, right (or horizontal/vertical if symmetric) |
| **Internal Gaps** | Spacing between leading→labels, labels→trailing, label→sublabel |
| **Leading Content** | Icon/avatar dimensions, gap from content |
| **Labels** | Font sizes, line heights (note: these may go in a Typography spec instead) |
| **Trailing Content** | Button/icon dimensions, gap from content |
| **Touch Target** | Minimum touch area if different from visual bounds |

**Section planning rules:**
- Only create sections for parts that exist in the component
- If a section has identical values across all variants, collapse it into a single-column note
- If values vary across density but not size (or vice versa), use the varying axis as columns
- Add a "Design Intent" note for non-obvious values (e.g., "Min-width ensures the button is tappable even with a single character label")

### Phase 4: Render the Documentation Frame

```
Main Frame (1440px wide, auto-layout vertical, padding 60px, gap 40px)
├── Header Section
│   ├── Title: "[Component Name] — Structure" (24px bold)
│   └── Subtitle: "Dimensions, spacing, and padding reference" (14px, #6B7280)
│
├── Section: "Container"
│   ├── Section Header (18px bold)
│   └── Table:
│       Header: Property | Large | Medium | Small | XSmall
│       Row: Height | sizing-lg (56) | sizing-md (48) | sizing-sm (40) | sizing-xs (32)
│       Row: Border Radius | radius-md (8) | radius-md (8) | radius-sm (6) | radius-sm (6)
│       Row: Stroke | 1 | 1 | 1 | 1
│
├── Section: "Padding"
│   └── Table:
│       Header: Property | Large | Medium | Small | XSmall
│       Row: Horizontal | spacing-lg (24) | spacing-md (16) | spacing-sm (12) | spacing-xs (8)
│       Row: Vertical | spacing-md (16) | spacing-sm (12) | spacing-xs (8) | spacing-2xs (4)
│
├── Section: "Leading Content"
│   └── Table:
│       Header: Property | Large | Medium | Small | XSmall
│       Row: Icon Size | 24 | 24 | 20 | 16
│       Row: Gap to Labels | spacing-sm (12) | spacing-sm (12) | spacing-xs (8) | spacing-xs (8)
│
├── Section: "Composition Mapping" (if component contains sub-components with their own sizes)
│   └── Table:
│       Header: Parent Size | Icon Size | Badge Size
│       Row: Large | Medium | Small
│       Row: Medium | Small | XSmall
│       Row: Small | XSmall | —
│
└── Notes Section (optional)
    └── Design intent notes, edge cases, responsive behavior
```

**Table formatting for structure specs:**
- Values with tokens: Show as `token-name (value)` e.g., `spacing-md (16)`
- Hardcoded values: Show as plain number e.g., `16`
- Units: Always in pixels (px), but omit the "px" suffix in tables for cleanliness
- Identical values across columns: Show the value (don't use "—" for same values in structure specs; engineers need explicit numbers)

### Phase 5: Validate

Checklist:
- [ ] All size/density variants are represented as columns
- [ ] Container dimensions are documented (height, width constraints, border-radius)
- [ ] Padding values are documented (all four sides or horizontal/vertical)
- [ ] Internal gaps between sections are documented
- [ ] Sub-component dimensions are documented
- [ ] Token names match actual Figma variable names
- [ ] Resolved values match actual measured pixel values
- [ ] Composition mapping exists for nested size relationships

---

## Density vs. Size

**Size** changes the overall scale: heights, icon dimensions, padding, font sizes, and minimum widths all change together.

**Density** changes only vertical rhythm: vertical padding and gaps change, but heights, icon sizes, and horizontal values stay the same.

If both axes exist, render size as primary columns and density as separate table sections:
```
## Container — Default Density
Property | Large | Medium | Small
Height   | 56    | 48     | 40

## Container — Compact Density
Property | Large | Medium | Small
Height   | 48    | 40     | 32

## Container — Spacious Density
Property | Large | Medium | Small
Height   | 64    | 56     | 48
```
