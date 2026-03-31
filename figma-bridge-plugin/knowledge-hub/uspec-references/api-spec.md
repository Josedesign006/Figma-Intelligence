# API Spec Reference

Generate component property documentation with values, defaults, required/optional status, and configuration examples.

## What This Spec Produces

1. **Main property table** — All top-level properties with values, required status, defaults, and notes
2. **Sub-component tables** — Separate tables for configurable nested elements
3. **Configuration examples** — 1–4 annotated instances showing common setups

---

## Step-by-Step Pipeline

### Phase 1: Extract All Properties

Properties come from **three sources** in Figma. You must check all three.

#### Source 1: Variant Axes
Read from the component set's variant names:
```
get_component_set_variants(node_id)
```
Parse variant names (formatted as "Property1=Value1, Property2=Value2") to extract:
- Property name (e.g., "Size", "Type", "State", "Hierarchy")
- All possible values (e.g., ["Large", "Medium", "Small", "XSmall"])
- Default value (the first variant listed, or the one matching the default instance)

#### Source 2: Instance (Boolean & Slot) Properties
Read from `componentPropertyDefinitions` on the component set:
```
get_component_property_definitions(node_id)
```
This returns:
- **Boolean properties**: Toggle-controlled elements (e.g., "Show Leading Icon": true/false)
- **Instance swap properties**: Slots that accept different components (e.g., "Trailing Content": [IconButton, TextButton, None])
- **Text properties**: Editable text content (e.g., "Label Text": string)

#### Source 3: Variable Mode Collections
Check for variable collections scoped to this component:
```
get_local_variable_collections()
```
Look for collections named after the component or containing modes like:
- Shape: `Rounded`, `Square`, `Pill`
- Density: `Compact`, `Default`, `Spacious`
- Color/Style: `Default`, `Danger`, `Success`

### Phase 2: Classify Properties (AI Reasoning)

For each discovered property, determine:

| Field | Description |
|-------|-------------|
| `name` | Property name as it appears in Figma |
| `type` | `variant`, `boolean`, `instance-swap`, `text`, `variable-mode` |
| `values` | All possible values |
| `default` | The default value |
| `required` | Whether the property must be explicitly set |
| `notes` | Description of what this property controls |

**Classification rules for required vs. optional:**
- Variant axes that affect layout/appearance → **Required** (Size, Type)
- State properties (enabled, disabled, selected) → **Required** 
- Boolean toggles → **Optional** (they have a default on/off state)
- Instance swap slots → **Optional** (they have a default or "None")
- Text content properties → Depends on context (Label usually required, Helper Text optional)

**Exclude transient interactive states:**
- `hover`, `pressed`, `focused`, `hovered` → These are runtime states, NOT API properties
- Only include **persistent** states: `disabled`, `selected`, `loading`, `error`, `active`

### Phase 3: Identify Sub-Component Configurations

For each instance swap slot or fixed nested component:
1. Check if the nested component has its own configurable properties
2. If yes, create a separate sub-component table
3. In the main table, add a note: "See [Sub-component Name] configuration below"

Example: A Section Heading with a trailing slot that accepts IconButton or TextButton:
- Main table lists "Trailing Content" with values: "Icon Button | Text Button | None"
- Sub-table for "Icon Button Configuration" lists the icon button's own properties
- Sub-table for "Text Button Configuration" lists the text button's own properties

### Phase 4: Generate Configuration Examples

Create 1–4 examples showing common real-world setups:

**Example selection strategy:**
1. **Minimal** — Required properties only, all optionals at defaults
2. **Common** — The most frequently used configuration
3. **Full** — All optional elements enabled
4. **Specialized** — A specific variant (e.g., "Error state with helper text")

For each example:
- Create a component instance with the specific properties set
- Add a label below: Example name + brief description
- Add a property callout listing which properties differ from default

### Phase 5: Render the Documentation Frame

```
Main Frame (1440px wide, auto-layout vertical, padding 60px, gap 40px)
├── Header Section
│   ├── Title: "[Component Name] — API" (24px bold)
│   └── Subtitle: "Properties and configuration reference" (14px, #6B7280)
├── Main Property Table
│   ├── Header: Property | Type | Values | Default | Required | Notes
│   └── Rows: One per property (grouped by source: variants first, then booleans, then slots)
├── Sub-Component Table(s) (if applicable)
│   ├── Section Header: "[Sub-component] Configuration"
│   └── Table with same column structure
├── Configuration Examples Section
│   ├── Section Header: "Configuration Examples"
│   └── Example Grid (2-column layout)
│       ├── Example 1: [Instance] + [Label + Property List]
│       ├── Example 2: [Instance] + [Label + Property List]
│       └── ...
```

**Main Property Table columns:**
| Column | Width | Content |
|--------|-------|---------|
| Property | 160px | Property name |
| Type | 100px | `variant` / `boolean` / `slot` / `text` / `mode` |
| Values | 200px | All possible values, pipe-separated |
| Default | 120px | Default value, **bold** |
| Required | 80px | ✓ or — |
| Notes | Fill | Description of what this property controls |

### Phase 6: Validate

Checklist:
- [ ] All variant axes are listed
- [ ] All boolean properties are listed
- [ ] All instance swap slots are listed
- [ ] All variable mode properties are listed
- [ ] Transient states (hover, pressed) are NOT listed
- [ ] Default values are correctly identified
- [ ] Sub-component tables exist for configurable nested components
- [ ] Configuration examples render correctly with the right property combinations

---

## Example: Button API

**Main Property Table:**
| Property | Type | Values | Default | Required | Notes |
|----------|------|--------|---------|----------|-------|
| Size | variant | Large \| Medium \| Small \| XSmall | Medium | ✓ | Controls button height and padding |
| Hierarchy | variant | Primary \| Secondary \| Tertiary | Primary | ✓ | Visual emphasis level |
| State | variant | Enabled \| Disabled \| Loading | Enabled | ✓ | Interaction state |
| Show Leading Icon | boolean | true \| false | false | — | Displays an icon before the label |
| Show Trailing Icon | boolean | true \| false | false | — | Displays an icon after the label |
| Label | text | string | "Button" | ✓ | Button text content |
| Color | mode | Default \| Danger \| Success | Default | — | Color scheme via variable mode |

**Configuration Examples:**
1. **Default** — Medium, Primary, Enabled, no icons → The basic button
2. **Icon + Label** — Medium, Primary, Leading Icon visible → Common CTA pattern
3. **Danger Action** — Medium, Primary, Danger color, "Delete" label → Destructive action
4. **Loading** — Medium, Primary, Loading state → Async operation in progress
