# Property Spec Reference

Generate visual property annotations with live instance previews for every configurable property — variant axes, boolean toggles, variable modes, and child component properties.

## What This Spec Produces

1. **Variant axis exhibits** — One section per axis with instance previews for every value
2. **Boolean toggle exhibits** — On/off states shown side by side, defaults labeled
3. **Variable mode exhibits** — Shape, density, and other mode-driven properties as visual chapters
4. **Child component chapters** — Nested component properties shown in-context on parent instances

---

## Step-by-Step Pipeline

### Phase 1: Extract All Properties

Read `componentPropertyDefinitions` from the component set:
```
get_component_property_definitions(node_id)
```

Collect four categories:

**1. Variant Axes** — From variant names (e.g., Size=Large, Hierarchy=Primary)
- Property name
- All values
- Default value

**2. Boolean Toggles** — From component property definitions
- Property name (e.g., "Show Leading Icon")
- Default state (true/false)
- Which child layer it controls

**3. Variable Mode Collections** — Check for component-scoped variable collections
```
get_local_variable_collections()
```
- Collection name (e.g., "Button Shape", "Density")
- Mode names (e.g., ["Rounded", "Square", "Pill"])

**4. Child Component Properties** — For each INSTANCE child layer:
- Resolve to source component
- Read its `componentPropertyDefinitions`
- Group by child component name

### Phase 2: Normalize Properties (AI Reasoning)

Consolidation rules to avoid redundant exhibits:

- **Coupled axes**: If two variant axes always change together (e.g., "Icon Size" always matches "Button Size"), merge them into a single exhibit showing the coupling
- **Container-gated booleans**: If a boolean only matters when a specific variant value is active, show it within that variant's context rather than as a standalone exhibit
- **Unified slots**: If multiple instance swap properties represent the same conceptual slot (e.g., "Leading Content" accepts both Icon and Avatar), combine into one exhibit
- **Sibling booleans**: If two booleans are mutually exclusive (toggling one forces the other off), show them as a single either/or exhibit

### Phase 3: Plan Exhibits

For each property, determine the exhibit type:

| Property Type | Exhibit Layout |
|--------------|----------------|
| Variant axis (≤6 values) | Horizontal row of instances, one per value |
| Variant axis (>6 values) | 2-column or 3-column grid |
| Boolean toggle | Side-by-side: OFF (default labeled) and ON |
| Variable mode | Row of instances, one per mode value |
| Child component | Show on parent instance with callout arrows |

**Instance creation for exhibits:**
- Start from the **default variant** of the component
- Change ONLY the property being exhibited (keep everything else at defaults)
- For variant axes: create one instance per value, changing only that axis
- For booleans: create two instances — one with false, one with true
- For modes: create one instance per mode, applying the mode via variable binding

### Phase 4: Render the Documentation Frame

```
Main Frame (1440px wide, auto-layout vertical, padding 60px, gap 40px)
├── Header Section
│   ├── Title: "[Component Name] — Properties" (24px bold)
│   └── Subtitle: "Configurable properties and visual reference" (14px, #6B7280)
│
├── Variant Axis Chapter(s)
│   ├── Chapter Header: "[Axis Name]" (20px bold)
│   ├── Values label: "Values: Large | Medium | Small | XSmall" (13px, #6B7280)
│   ├── Default label: "Default: Medium" (13px, bold tag on value)
│   └── Exhibit Row (horizontal auto-layout, gap 24px)
│       ├── [Instance: value 1] + Value Label below
│       ├── [Instance: value 2] + Value Label below (DEFAULT badge if applicable)
│       └── ...
│
├── Boolean Toggle Chapter(s)
│   ├── Chapter Header: "[Boolean Name]" (20px bold)
│   ├── Default label: "Default: false"
│   └── Exhibit Row (horizontal, gap 40px)
│       ├── [Instance: OFF state] + "Off" label + (DEFAULT badge)
│       └── [Instance: ON state] + "On" label
│
├── Variable Mode Chapter(s)
│   ├── Chapter Header: "[Collection Name]" (20px bold)
│   ├── Modes: "Rounded | Square | Pill"
│   └── Exhibit Row
│       ├── [Instance: Mode 1] + Mode Label
│       ├── [Instance: Mode 2] + Mode Label
│       └── ...
│
└── Child Component Chapter(s) (if applicable)
    ├── Chapter Header: "[Child Name] Properties" (20px bold)
    ├── Context note: "Shown in context on [Parent Name]"
    └── Sub-exhibits for each child property
        └── Same exhibit format but instances are parent component
            with the child property varied
```

**Exhibit instance sizing:**
- Use the default variant size for all exhibits within a chapter
- Exception: Size axis exhibits obviously show each size at its actual dimensions
- Maximum instance width: 300px (scale down if needed, maintaining aspect ratio)
- Minimum gap between instances: 24px

**Default badges:**
- Small rounded rectangle: 4px padding, #E5E7EB background, "DEFAULT" text 10px bold #6B7280
- Placed below the instance, centered

### Phase 5: Validate

Checklist:
- [ ] Every variant axis has an exhibit with an instance per value
- [ ] Every boolean toggle has a side-by-side OFF/ON exhibit
- [ ] Variable mode collections are rendered (if present)
- [ ] Child component properties are shown in-context on parent
- [ ] Default values are labeled on every exhibit
- [ ] No duplicate or redundant exhibits (normalization applied)
- [ ] Instances render correctly (no broken components)

---

## Example: Button Properties

### Size (Variant Axis)
```
Values: Large | Medium | Small | XSmall
Default: Medium

[Large instance] [Medium instance] [Small instance] [XSmall instance]
    Large           Medium              Small           XSmall
                    DEFAULT
```

### Show Leading Icon (Boolean)
```
Default: false

[Button without icon]    [Button with icon]
        Off                     On
      DEFAULT
```

### Shape (Variable Mode)
```
Modes: Rounded | Square | Pill
Default: Rounded

[Rounded button]    [Square button]    [Pill button]
    Rounded             Square             Pill
    DEFAULT
```

### Trailing Content — Icon Button Properties (Child Component)
```
Shown in context on Button

[Button with small icon]    [Button with medium icon]
     Icon Size: Small           Icon Size: Medium
```
