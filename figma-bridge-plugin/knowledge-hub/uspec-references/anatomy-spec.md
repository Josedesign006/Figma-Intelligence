# Anatomy Spec Reference

Generate numbered anatomy annotations with attribute tables directly in Figma.

## What This Spec Produces

1. **Component artwork** — A default-variant instance with all hidden elements made visible
2. **Numbered markers** — Pink circles (24px, #D946EF) with connector lines pointing to each element
3. **Attribute table** — 4 columns: Number, Type (instance/text/shape icon), Element Name, Semantic Notes
4. **Per-child sections** — Nested component instances get their own markers and tables
5. **Cross-references** — Composition table notes link to per-child sections ("See X anatomy section")

---

## Step-by-Step Pipeline

### Phase 1: Extract Component Data

1. Parse the Figma link to get `file_key` and `node_id`
2. Read the component set or standalone component:
   ```
   get_node(file_key, node_id)
   get_component_property_definitions(node_id)
   ```
3. Get the **default variant** (first child of the component set, or the component itself if standalone)
4. Traverse all child layers recursively and collect:
   - `name` — Layer name
   - `type` — INSTANCE, TEXT, RECTANGLE, ELLIPSE, VECTOR, FRAME, GROUP, LINE
   - `visible` — Whether the element is visible in the default state
   - `componentPropertyReferences` — Which boolean property controls this element's visibility
   - `characters` — Text content (for TEXT nodes)
   - `componentId` — If an INSTANCE, the component it references

5. For each INSTANCE child, resolve to its source component and check if it has meaningful internal structure (more than 1 visible child layer). If yes, mark it as a **per-child candidate**.

6. **Filter out utility sub-components**: Skip elements whose resolved component name matches: `Spacer`, `Divider`, `Separator`, `Gap`, `Padding`. These have no meaningful anatomy to document.

### Phase 2: Classify Each Element (AI Reasoning)

For each collected element, determine its **role**:

| Role | Description | Example |
|------|-------------|---------|
| `content-element` | Displays user-facing content | Label text, avatar image |
| `optional-slot` | Controlled by a boolean toggle, can be hidden | Leading icon, trailing button |
| `fixed-sub-component` | Always present nested instance | Icon component, badge |
| `structural` | Layout container, not meaningful to document | Auto-layout wrapper frame |
| `decorative` | Visual-only, no semantic meaning | Background shape, shadow layer |

**Classification rules:**
- If element has a `componentPropertyReference` to a boolean → `optional-slot`
- If element is an INSTANCE with ≥2 meaningful children → `fixed-sub-component` or per-child candidate
- If element is a FRAME/GROUP with only auto-layout purpose → `structural` (skip from table)
- If element name starts with "." or is named "Background", "Shadow", "Overlay" → `decorative` (skip)
- Everything else → `content-element`

**Write semantic notes for each non-skipped element:**
- For optional slots: "Optional. Controlled by [boolean-name] toggle. Hidden by default." or "Visible by default."
- For content elements: Describe the element's purpose in the component context
- For fixed sub-components: "Fixed sub-component. See [Name] anatomy section." (if per-child exists)
- For instance swap slots: "Swappable. Accepts [list of allowed instances]."

### Phase 3: Determine Per-Child Sections

A nested instance warrants its own per-child section when:
- It has ≥3 internal child layers (not counting structural wrappers)
- It is NOT a utility component (Spacer, Divider, etc.)
- It has its own configurable properties (booleans, variants)

For qualifying per-child instances, repeat Phase 1 and Phase 2 on the nested component.

**Collapsing identical siblings**: If the same component appears N times consecutively (e.g., 5 star icons), collapse into a single row with "(xN)" suffix.

### Phase 4: Make Hidden Elements Visible

For the artwork instance, unhide all hidden optional elements **through component properties**:
```
// DO THIS (property-aware unhide):
set_component_properties(instance_id, { "Show Leading Icon": true, "Show Badge": true })

// DO NOT DO THIS (raw visibility override):
set_visibility(child_node_id, true)  // WRONG — breaks component property binding
```

This ensures the artwork shows the complete anatomy with all optional elements visible, while maintaining proper component property bindings.

### Phase 5: Render the Documentation Frame

#### Create the main frame
```
Main Frame (1440px wide, auto-layout vertical, padding 60px, gap 40px)
├── Header Section
│   ├── Title: "[Component Name] — Anatomy" (24px bold)
│   └── Subtitle: "Component structure and element inventory" (14px, #6B7280)
├── Artwork + Markers Section (horizontal layout)
│   ├── Component Instance (all hidden elements visible)
│   └── Marker Layer (positioned absolutely relative to artwork)
├── Attribute Table
│   ├── Header Row: # | Type | Element | Notes
│   └── Body Rows: One per non-skipped element
├── Per-Child Section 1 (if applicable)
│   ├── Section Header: "[Child Name] Anatomy"
│   ├── Child Artwork + Markers
│   └── Child Attribute Table
└── Per-Child Section N...
```

#### Place markers
For each element in the attribute table:
1. Get the element's absolute position and bounds within the artwork
2. Create a marker circle (24px, #D946EF fill, white number text)
3. Position the marker **outside** the component artwork (to the left, right, top, or bottom — whichever has the most space)
4. Draw a 1px connector line from the marker center to the nearest edge of the element
5. Avoid overlapping markers — distribute them evenly with ≥8px gaps

#### Build the attribute table
| Column | Width | Content |
|--------|-------|---------|
| # | 48px | Sequential number matching the marker |
| Type | 48px | Icon indicator: 🔲 for instance, 📝 for text, ⬡ for shape/vector |
| Element | 200px | Layer name. Append "(hidden)" if element is not visible in default state |
| Notes | Fill remaining | Semantic notes from Phase 2 classification |

### Phase 6: Validate

1. Capture a screenshot of the completed frame
2. Check against this checklist:
   - [ ] All non-structural, non-decorative elements have a marker
   - [ ] Marker numbers match table row numbers
   - [ ] No markers overlap each other
   - [ ] Connector lines point to the correct elements
   - [ ] Hidden elements are labeled "(hidden)" in the table
   - [ ] Per-child sections exist for qualifying nested instances
   - [ ] Cross-references in the main table link to per-child sections
3. Fix any issues found
4. Repeat up to 3 times

---

## Example Output Structure

For a **Text Field** component with: Container, Leading Icon (optional), Label, Input Area, Placeholder Text, Helper Text (optional), Trailing Clear Button (optional):

**Main Attribute Table:**
| # | Type | Element | Notes |
|---|------|---------|-------|
| 1 | 🔲 | Container | Root frame. Auto-layout horizontal with nested vertical sections. |
| 2 | 🔲 | Leading Icon (hidden) | Optional. Controlled by "Show Leading Icon" toggle. Hidden by default. |
| 3 | 📝 | Label | Required. Displays the field's label text above the input area. |
| 4 | 📝 | Input Text | Content element. Displays user-entered text or placeholder. |
| 5 | 📝 | Placeholder Text | Content element. Visible when Input Text is empty. |
| 6 | 📝 | Helper Text (hidden) | Optional. Controlled by "Show Helper" toggle. Provides guidance below the input. |
| 7 | 🔲 | Clear Button (hidden) | Optional. Controlled by "Show Clear" toggle. See Clear Button anatomy section. |

**Per-child: Clear Button Anatomy:**
| # | Type | Element | Notes |
|---|------|---------|-------|
| 1 | 🔲 | Icon | Fixed sub-component. Displays the clear/close icon. |
| 2 | ⬡ | Hit Area | Touch target overlay. 44x44px minimum for accessibility compliance. |
