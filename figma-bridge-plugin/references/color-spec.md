# Color Annotation Spec Reference

Generate design token specifications mapping every UI element to its color token across states and variants.

## What This Spec Produces

1. **Color-annotated artwork** — Component instances with numbered markers pointing to color-bearing elements
2. **Token mapping tables** — Element name → Token name → Resolved hex value, organized by state
3. **Variant sections** — Separate sections for each color-affecting variant (Default, Danger, etc.)
4. **Variable mode sections** — Sections for variable-mode-controlled color variants (Tag color, Badge style)

---

## Step-by-Step Pipeline

### Phase 1: Determine Rendering Strategy

Before extracting data, analyze which variant axes affect color:

**Strategy A — Section-per-variant** (simpler components):
Use when the component has ≤3 color-affecting variant values (e.g., Default + Danger).
Render: One section per variant, each containing state tables.

**Strategy B — States-as-columns** (complex components):
Use when the component has many variant combinations (e.g., 4 types × 4 states).
Render: One table per variant type, with states as columns.

**Strategy C — Variable-mode sections**:
Use when color is controlled by a Figma variable collection (e.g., "Tag Color" with Default, Success, Warning, Error modes).
Render: One section per mode value.

**Decision logic:**
1. Count variant axes that affect fill/stroke colors
2. If only "State" axis changes colors → Strategy A (sections for other axes, states within each)
3. If multiple axes × multiple states → Strategy B (states as columns)
4. If color comes from variable modes → Strategy C

### Phase 2: Extract Color Data

For each variant/state combination that needs documentation:

1. Create or navigate to the appropriate variant instance
2. For every child layer (recursive), extract:
   ```
   get_node_fills(child_id)        → fill color(s)
   get_node_strokes(child_id)      → stroke/border color(s)
   get_bound_variables(child_id)   → variable bindings (token references)
   ```

3. For each color-bearing property, collect:
   - **Element name**: Layer name (e.g., "Container", "Label Text", "Icon")
   - **Property**: `fill`, `stroke`, `text-fill`
   - **Token name**: The variable/token name if bound (e.g., `color/button/primary/bg`)
   - **Resolved value**: The actual hex color value (e.g., `#6D28D9`)
   - **Opacity**: If not 100%, include it

4. **Enable hidden boolean elements** before extracting:
   ```
   set_component_properties(instance_id, { "Show Leading Icon": true, ... })
   ```
   Hidden elements may have color bindings that only appear when visible.

### Phase 3: Classify Color Roles (AI Reasoning)

Group elements by their color role:

| Role | Elements | Example Tokens |
|------|----------|----------------|
| Background | Container fills, surface fills | `color/bg/primary`, `color/surface/default` |
| Text | Label, helper text, placeholder | `color/text/primary`, `color/text/secondary` |
| Icon | Leading icon, trailing icon fills | `color/icon/primary`, `color/icon/on-color` |
| Border | Container strokes, input outlines | `color/border/default`, `color/border/focus` |
| State Layer | Hover overlay, pressed overlay | `color/state-layer/hover`, `color/state-layer/pressed` |
| Indicator | Error icon, success badge | `color/indicator/error`, `color/indicator/success` |

### Phase 4: Render the Documentation Frame

#### Strategy A Layout (Section-per-variant):
```
Main Frame (1440px wide)
├── Header: "[Component Name] — Color Annotation"
├── Variant Section: "Default"
│   ├── State: "Enabled"
│   │   ├── Annotated Artwork (instance + numbered markers)
│   │   └── Token Table: Element | Property | Token | Value
│   ├── State: "Hover"
│   │   ├── Annotated Artwork
│   │   └── Token Table (highlight changed values in bold)
│   ├── State: "Pressed"
│   │   └── ...
│   └── State: "Disabled"
│       └── ...
├── Variant Section: "Danger"
│   └── (same structure)
```

#### Strategy B Layout (States-as-columns):
```
Main Frame (1440px wide)
├── Header: "[Component Name] — Color Annotation"
├── Artwork Strip: [Enabled] [Hover] [Pressed] [Disabled]
├── Token Table:
│   Header: Element | Property | Enabled | Hover | Pressed | Disabled
│   Row: Container | fill | token/bg/default | token/bg/hover | ... | ...
│   Row: Label | text | token/text/primary | (same) | ... | token/text/disabled
```

#### Strategy C Layout (Variable modes):
```
Main Frame (1440px wide)
├── Header: "[Component Name] — Color Annotation"
├── Mode Section: "Default"
│   ├── Annotated Artwork
│   └── Token Table
├── Mode Section: "Success"
│   └── ...
├── Mode Section: "Warning"
│   └── ...
```

### Marker Placement for Color Specs

Color markers differ from anatomy markers:
- Use **same marker style** (24px circle, #D946EF)
- Place markers pointing to the specific **color-bearing surface** (not the element in general)
- For elements with both fill and stroke, use two markers (one for each)
- Number markers per-section (restart numbering for each state/variant section)

### Phase 5: Validate

Checklist:
- [ ] All color-bearing elements are documented (fills, strokes, text colors)
- [ ] Token names match actual Figma variable names
- [ ] Resolved hex values are correct
- [ ] All relevant states are covered (enabled, hover, pressed, disabled at minimum)
- [ ] All relevant variants are covered
- [ ] Variable mode sections exist for mode-controlled colors
- [ ] Light/dark themes are NOT duplicated (semantic tokens handle this)
- [ ] Hidden elements' colors are captured (booleans toggled on during extraction)

---

## Notes

- **Semantic tokens only**: Document the semantic token names, not raw color primitives. If an element is bound to `color/text/primary` which resolves to `gray/900` which resolves to `#111827`, document `color/text/primary → #111827`.
- **State layers**: Hover and pressed often use a semi-transparent overlay. Document both the overlay token and its opacity.
- **Unchanged values**: When a token stays the same across states, you can use "—" or "(same)" in the table to reduce noise. Only highlight values that actually change.
- **Sub-component reference**: If a nested component (e.g., Icon Button inside Section Heading) has its own color spec, add a note "See [Component] color annotation" rather than duplicating all its tokens.
