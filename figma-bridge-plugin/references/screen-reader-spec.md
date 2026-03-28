# Screen Reader Spec Reference

Generate accessibility specifications for VoiceOver (iOS), TalkBack (Android), and ARIA (Web).

## What This Spec Produces

1. **Focus order diagram** — Visual showing the tab/swipe order through interactive elements
2. **Per-platform tables** — VoiceOver, TalkBack, and ARIA properties for each focus stop
3. **State-specific announcements** — How announcements change across enabled, disabled, selected, etc.
4. **Merge analysis** — Which visual elements combine into a single focus stop vs. independent stops

---

## Step-by-Step Pipeline

### Phase 1: Extract Component Elements

1. Read all child layers from the component:
   ```
   get_node_children(node_id, recursive=true)
   ```
2. Classify each element:
   - **Interactive**: buttons, toggles, inputs, links (elements users can act on)
   - **Informational**: labels, helper text, badges, icons (content that informs but isn't interactive)
   - **Decorative**: backgrounds, shadows, dividers (invisible to screen readers)

### Phase 2: Merge Analysis (Critical AI Step)

The merge analysis determines which visual parts become independent **focus stops** and which get merged into a parent element's announcement.

**Rules for merging:**

| Visual Part | Merge Behavior |
|-------------|---------------|
| Label text adjacent to a control | **Merge** into the control's accessibility label |
| Helper/hint text below a control | **Merge** as the accessibility hint/description |
| Decorative icons (bullets, arrows) | **Hide** from screen readers entirely |
| Functional icons (clear, search, edit) | **Separate** focus stop if independently tappable |
| Action buttons within a compound control | **Separate** focus stop |
| Static content (read-only text, images) | **Merge** into nearest logical container |
| Error messages | **Live region** announcement, not a focus stop |
| Badges/counts | **Merge** into parent element's value announcement |

**Decision framework:**
1. Is this element independently interactive (tappable/clickable)? → **Separate focus stop**
2. Does this element add information to an adjacent interactive element? → **Merge** into that element
3. Is this element purely visual? → **Hide** (decorative)
4. Is this element dynamic content that changes without user action? → **Live region**

### Phase 3: Determine Focus Order

For compound components with multiple focus stops:

1. List all independent focus stops in their natural reading/tab order
2. Default order: **left-to-right, top-to-bottom** (LTR layouts)
3. Note any exceptions requested by the user (e.g., "input should focus before clear button")
4. For each focus stop, note:
   - Focus stop number
   - Element name
   - Which visual parts merge into this stop

**Example — Text Field:**
```
Focus Stop 1: Input Field
  Merges: Label text, Placeholder text, Helper text
  
Focus Stop 2: Clear Button (only when text is entered)
  Merges: Clear icon
```

### Phase 4: Build Per-Platform Specifications

For each focus stop, document platform-specific properties:

#### iOS (VoiceOver)

| Property | Description | Example |
|----------|-------------|---------|
| `accessibilityLabel` | What VoiceOver announces as the element's name | "Search" |
| `accessibilityTraits` | Element type: `.button`, `.textField`, `.staticText`, `.header`, `.adjustable`, `.selected` | `.button` |
| `accessibilityHint` | Action description, read after a pause | "Double tap to activate" |
| `accessibilityValue` | Current value for adjustable elements | "3 of 5" |
| `isAccessibilityElement` | Whether this is a single focus stop (true) or a container (false) | `true` |

#### Android (TalkBack)

| Property | Description | Example |
|----------|-------------|---------|
| `contentDescription` | What TalkBack announces | "Search, Edit field" |
| `role` | Android role: `Button`, `EditText`, `CheckBox`, `Switch`, `Tab` | `Button` |
| `stateDescription` | Current state in human-readable form | "Disabled" |
| `importantForAccessibility` | Whether element is visible to TalkBack | `yes` |
| `liveRegion` | For dynamic content: `polite` or `assertive` | — |

#### Web (ARIA)

| Property | Description | Example |
|----------|-------------|---------|
| `role` | ARIA role: `button`, `textbox`, `checkbox`, `tab`, `tabpanel`, `alert` | `button` |
| `aria-label` | Accessible name (when visual text is insufficient) | "Close dialog" |
| `aria-labelledby` | ID reference to visible label element | `"label-email"` |
| `aria-describedby` | ID reference to description/hint element | `"hint-email"` |
| `aria-expanded` | For expandable elements: `true` or `false` | `false` |
| `aria-selected` | For selectable elements | `true` |
| `aria-disabled` | Disabled state | `true` |
| `aria-live` | For live regions: `polite` or `assertive` | — |
| `tabindex` | Tab order: `0` (natural), `-1` (programmatic only) | `0` |

### Phase 5: Document State Variations

For each state the component can be in, document how announcements change:

| State | What Changes |
|-------|-------------|
| **Enabled** | Base announcement — label, role, hint |
| **Disabled** | Add "dimmed" (VoiceOver) / "disabled" (TalkBack) / `aria-disabled="true"` (ARIA) |
| **Selected** | Add "selected" trait/state |
| **Loading** | Announce "loading" via live region, disable interaction |
| **Error** | Announce error message via live region or `aria-invalid` + `aria-errormessage` |
| **Expanded** | Toggle `aria-expanded`, announce "expanded"/"collapsed" |

### Phase 6: Render the Documentation Frame

```
Main Frame (1440px wide, auto-layout vertical, padding 60px, gap 40px)
├── Header Section
│   ├── Title: "[Component Name] — Screen Reader" (24px bold)
│   └── Subtitle: "VoiceOver, TalkBack, and ARIA specifications" (14px, #6B7280)
│
├── Focus Order Section (only for compound components)
│   ├── Section Header: "Focus Order" (20px bold)
│   ├── Component Artwork with numbered focus indicators
│   ├── Focus sequence: "1 → 2 → 3" with element names
│   └── Notes about conditional focus stops
│
├── Platform Section: "iOS — VoiceOver"
│   ├── Section Header (20px bold)
│   ├── Per-Focus-Stop Tables:
│   │   ├── Focus Stop 1: [Element Name]
│   │   │   └── State Table:
│   │   │       Header: Property | Enabled | Disabled | Selected
│   │   │       Row: accessibilityLabel | "Save" | "Save" | "Save"
│   │   │       Row: accessibilityTraits | .button | .button, .notEnabled | .button, .selected
│   │   └── Focus Stop 2: [Element Name]
│   │       └── ...
│
├── Platform Section: "Android — TalkBack"
│   └── (same structure, Android properties)
│
└── Platform Section: "Web — ARIA"
    └── (same structure, ARIA properties)
```

### Phase 7: Validate

Checklist:
- [ ] All interactive elements have a focus stop
- [ ] Non-interactive informational elements are merged into appropriate focus stops
- [ ] Decorative elements are marked as hidden from screen readers
- [ ] All three platforms (VoiceOver, TalkBack, ARIA) are documented
- [ ] State variations are documented (at minimum: enabled, disabled)
- [ ] Focus order is specified for compound components
- [ ] Error messages and dynamic content use live regions
- [ ] Merge analysis is consistent across platforms

---

## Component Complexity Guide

**Simple components (1 focus stop):**
Button, Checkbox, Switch, Toggle, Badge, Tag, Avatar
→ Single focus stop, all visual parts merged. Document state changes.

**Compound components (2–5 focus stops):**
Text Field + Clear Button, Chip + Dismiss, Search Bar, Stepper
→ Focus order section + per-stop tables. Document conditional stops.

**Complex components (5+ focus stops):**
Tab Bar, Navigation Bar, Data Table Row, Form Section
→ Full focus order diagram. Consider documenting as a composite of simpler components with cross-references.
