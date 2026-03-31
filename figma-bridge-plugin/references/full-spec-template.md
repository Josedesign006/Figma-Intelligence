# Component Specification Template

> This is the gold-standard reference for what a complete component spec should look like.
> When generating a spec with `figma_component_spec`, the output should match this quality,
> tone, and depth. Use this as a writing guide — adapt the content to the actual component
> but maintain the same level of detail and structure.

---

## Example: Button Component Specification

---

### 1. Overview

Component:       Button
Type:            COMPONENT_SET (24 variants)
Node ID:         1:234
Dimensions:      160 × 44 px (default variant)
Layout:          HORIZONTAL auto layout, 8px gap, padding 12/16/12/16
Description:     Button is a primary interactive component used to trigger actions
                 and submit forms. It supports 3 hierarchy levels (Primary, Secondary,
                 Tertiary), 4 sizes (XSmall, Small, Medium, Large), and full state
                 coverage (Default, Hover, Pressed, Focused, Disabled). Composed of
                 5 elements including 2 optional icon slots controlled by boolean toggles.
                 All 8 color fills are bound to design tokens for full theme support.
States:          Default, Hover, Pressed, Focused, Disabled
Detected pattern: button
Direct children: Leading Icon, Label, Trailing Icon, Loader, Focus Ring

---

### 2. Anatomy

#    Element          Type       Role                 Visible   Controlled By
──────────────────────────────────────────────────────────────────────────────────
1    Leading Icon     INSTANCE   optional-slot        true      Show Leading Icon
2    Label            TEXT       content-element      true      —
3    Trailing Icon    INSTANCE   optional-slot        false     Show Trailing Icon
4    Loader           INSTANCE   optional-slot        false     Is Loading
5    Focus Ring       FRAME      decorative           false     —

Anatomy notes:
- Leading Icon and Trailing Icon are optional slots controlled by boolean toggles.
  When hidden, the button auto-resizes due to auto layout.
- Label is the primary content element and must always remain visible.
- Loader replaces the label content during async operations when Is Loading = true.
- Focus Ring is a decorative element rendered on keyboard focus via the Focused state variant.

---

### 3. Variants

Axis         Values                              Default    Count
──────────────────────────────────────────────────────────────────
Hierarchy    Primary, Secondary, Tertiary        Primary    3
Size         XSmall, Small, Medium, Large        Medium     4
State        Default, Hover, Pressed, Focused,   Default    5
             Disabled

Toggle       Default   Controls
──────────────────────────────────────────────
Show Leading Icon    false     Leading Icon
Show Trailing Icon   false     Trailing Icon
Is Loading           false     Loader

Swap Slot              Current Component
──────────────────────────────────────────
Leading Icon Swap      Icon / Arrow Left
Trailing Icon Swap     Icon / Chevron Right

Total possible configurations: 60 (3 hierarchy × 4 size × 5 state).
Boolean multiplier: ×8 (3 toggles). Defined variants in file: 24.

Defined variant names:
- Hierarchy=Primary, Size=Large, State=Default
- Hierarchy=Primary, Size=Large, State=Hover
- Hierarchy=Primary, Size=Large, State=Pressed
- Hierarchy=Primary, Size=Large, State=Focused
- Hierarchy=Primary, Size=Medium, State=Default
- ... and 19 more

---

### 4. States

State      Source          Axis / Property
───────────────────────────────────────────
Default    variant-axis    State
Hover      variant-axis    State
Pressed    variant-axis    State
Focused    variant-axis    State
Disabled   variant-axis    State

State behavior notes:
- Default: Normal idle state with standard fill colors and cursor: pointer.
- Hover: Background shifts to a lighter/darker tint (token: button/primary/hover).
  Triggered on mouse enter. Transition: 150ms ease-out.
- Pressed: Background shifts further. Active fill token: button/primary/pressed.
  Applied on mousedown, released on mouseup.
- Focused: Visible focus ring (2px offset, brand color) for keyboard navigation.
  Must meet WCAG 2.4.7 — 3:1 contrast against adjacent colors.
- Disabled: Reduced opacity (0.4) or muted fill. Remove from tab order.
  Use aria-disabled="true" rather than the disabled attribute when possible
  to maintain focus for screen reader discoverability.

---

### 5. Properties / API

Property              Type            Values / Default                      Required
────────────────────────────────────────────────────────────────────────────────────
Hierarchy             Variant         Primary, Secondary, Tertiary          Yes
                                      (default: Primary)
Size                  Variant         XSmall, Small, Medium, Large          Yes
                                      (default: Medium)
State                 Variant         Default, Hover, Pressed, Focused,     Yes
                                      Disabled (default: Default)
Show Leading Icon     Boolean         true / false (default: false)         No
Show Trailing Icon    Boolean         true / false (default: false)         No
Is Loading            Boolean         true / false (default: false)         No
Leading Icon Swap     Instance Swap   Any icon component                    No
Trailing Icon Swap    Instance Swap   Any icon component                    No
Label Text            Text Override   "Button" (editable)                   No

Total properties: 9 (3 variants, 3 booleans, 2 instance swaps, 1 text override).

Implementation notes:
- Variant properties (Hierarchy, Size, State) are required and must always be set.
- Boolean toggles control child visibility — they do not add/remove DOM elements,
  only toggle display.
- Instance swap slots accept any component from the Icon library. Ensure swapped
  icons maintain the same bounding box (20×20 for Medium size) to avoid layout shift.
- Label Text supports single-line text only. Truncation with ellipsis should be
  handled if text overflows the maximum width.

---

### 6. Spacing & Structure

Root layout:     HORIZONTAL auto layout
Dimensions:      160 × 44 px (Medium)
Padding:         12 / 16 / 12 / 16 (T/R/B/L)
Item spacing:    8px

Element             Layout       W × H        Padding (T/R/B/L)   Gap    Sizing (H/V)
──────────────────────────────────────────────────────────────────────────────────────
Button (root)       HORIZONTAL   160 × 44     12/16/12/16          8px    HUG / FIXED
Leading Icon        —            20 × 20      —                    —      FIXED / FIXED
Label               —            auto × 20    —                    —      HUG / HUG
Trailing Icon       —            20 × 20      —                    —      FIXED / FIXED

Size scale:
- XSmall: 28px height, 8/12 padding, 6px gap, 14px font
- Small:  32px height, 8/12 padding, 6px gap, 14px font
- Medium: 44px height, 12/16 padding, 8px gap, 16px font
- Large:  52px height, 16/20 padding, 8px gap, 18px font

Touch target compliance:
- XSmall (28px): Below 44×44 WCAG minimum — ensure adequate spacing or hit area padding.
- Small (32px): Below 44×44 — same concern.
- Medium (44px): Meets 44×44 minimum touch target.
- Large (52px): Exceeds minimum. Recommended for primary CTAs on mobile.

---

### 7. Color Tokens

Element          Property   Hex Value   Token Name
────────────────────────────────────────────────────────────────
Button (root)    fill       #0F62FE     color/interactive/primary
Button (root)    fill       #0043CE     color/interactive/primary/hover
Button (root)    fill       #002D9C     color/interactive/primary/pressed
Label            fill       #FFFFFF     color/text/on-color
Leading Icon     fill       #FFFFFF     color/icon/on-color
Focus Ring       stroke     #0F62FE     color/focus/outline
Disabled fill    fill       #C6C6C6     color/interactive/disabled
Disabled text    fill       #8D8D8D     color/text/disabled

Token coverage: 8/8 colors are bound to design tokens. Fully theme-ready.

Token architecture notes:
- All interactive colors use the `color/interactive/*` namespace.
- Text and icon colors on filled backgrounds use `color/*/on-color` tokens
  which automatically invert in dark mode.
- The Disabled state uses dedicated disabled tokens — do not use opacity
  reduction as it creates inconsistent results across themes.
- Focus ring uses `color/focus/outline` which must maintain 3:1 contrast
  against any background.

---

### 8. Typography

Element   Content     Font               Size    Line Height   Token
────────────────────────────────────────────────────────────────────────
Label     "Button"    Inter SemiBold      16px    20px          type/body/semibold/md

Font families used: Inter SemiBold. Size range: 14px–18px across 4 size variants.

Typography scale by size variant:
- XSmall / Small: Inter SemiBold 14px / 18px line height
- Medium: Inter SemiBold 16px / 20px line height
- Large: Inter SemiBold 18px / 24px line height

Accessibility notes:
- Minimum font size (14px) meets readability guidelines.
- All text uses SemiBold weight for adequate legibility on colored backgrounds.
- Line height ratio (1.25–1.33) is within WCAG recommended range.

---

### 9. Accessibility

Touch target:
- Medium (44×44px) and Large (52×52px) variants meet WCAG 2.5.8 minimum.
- XSmall (28px) and Small (32px) are below minimum — add padding or spacing.

Typography:
- Label: Inter SemiBold 16px / 20px line height
- All text sizes ≥ 14px — meets readability guidelines.

Keyboard interaction:
- Component must be focusable and operable via keyboard.
- Focus state detected — visible focus indicator (2px ring) meets 3:1 contrast.
- Disabled state: use aria-disabled="true" rather than removing from tab order.
- Expected keyboard behavior: Enter/Space activates the button.

Screen reader:
- Role: button (native HTML or role="button" for custom elements)
- Label: Computed from visible text content. If icon-only, provide aria-label.
- State: Announce disabled state. Announce loading state with aria-busy="true"
  and aria-live="polite" on the status region.

Color contrast:
- Primary: White text (#FFF) on blue (#0F62FE) = 4.66:1 ratio (passes AA)
- Disabled: Gray text (#8D8D8D) on light gray (#C6C6C6) — verify ≥ 3:1 for
  decorative non-text contrast.

Structure:
- 8 token aliases bound — supports theming.
- Drop shadow: none on default. If added for elevation, verify contrast in all themes.
- Expected ARIA pattern: WAI-ARIA Button pattern
- Minimum contrast requirement: 4.5:1 for normal text, 3:1 for large text

---

### 10. Usage Guidelines

✓ DO:
   ✓  Use the variant properties (Hierarchy, Size, State) to configure the button.
      Don't detach instances to create custom variations.
   ✓  Use boolean toggles (Show Leading Icon, Show Trailing Icon, Is Loading) to
      show/hide optional elements instead of deleting layers.
   ✓  Keep required elements intact: Label.
   ✓  Support all defined states (Default, Hover, Pressed, Focused, Disabled).
   ✓  Use Primary hierarchy for the most important action on the page.
      Only one Primary button per view/section.
   ✓  Use Secondary for supporting actions, Tertiary for low-emphasis actions.
   ✓  Preserve auto layout settings — don't switch to absolute positioning.
   ✓  Maintain the 8px gap between icon and label.
   ✓  Use instance swap properties for icons — only swap in compatible 20×20 icons.
   ✓  Test the component in both light and dark themes before publishing.

✗ DON'T:
   ✗  Don't remove or hide the Label element — this breaks semantic structure.
   ✗  Don't create undocumented state variations — extend the variant set formally.
   ✗  Don't use buttons for navigation — use Link component instead.
   ✗  Don't replace icon swap slots with non-icon components.
   ✗  Don't override internal padding or spacing values.
   ✗  Don't use opacity to create disabled appearance — use the Disabled state variant.
   ✗  Don't place more than one Primary button in the same section.

---

### 11. Related Components

Related Component         When to Use Instead
──────────────────────────────────────────────────────────────────
Link / Anchor             Use for navigation instead of triggering actions
Icon Button               Use for icon-only actions with a tooltip
FAB (Floating Action)     Use for the primary page-level action on mobile
Split Button              Use when the button needs a dropdown for secondary actions
Toggle Button             Use when the button represents an on/off state

---

## Template Usage Notes

This template demonstrates the expected quality bar:

1. **Every section has content** — even when data is sparse, provide guidance,
   recommendations, or explain what's missing and why it matters.

2. **Tables are clean and aligned** — use consistent column widths, separator
   lines, and clear headers.

3. **Descriptive prose accompanies data** — don't just dump a table. Explain
   what the data means, why it matters, and what to do about it.

4. **Accessibility is specific** — mention exact WCAG criteria, contrast ratios,
   keyboard patterns, and screen reader behavior.

5. **Usage guidelines are actionable** — each do/don't references a specific
   component feature or behavior, not generic advice.

6. **Token architecture is explained** — don't just list token names. Explain
   the naming pattern, theme behavior, and contrast requirements.

7. **States include behavior notes** — describe transitions, timing, cursor
   changes, and ARIA state management.

8. **Spacing includes size scale** — if the component has size variants, show
   how spacing/typography scales across all sizes.
