# Cart Screen
## Accessibility Annotation (Developer Handoff)

**Frame:** `Cart`
**Node ID:** `268:2848`
**Generated:** 2026-03-20
**Standard:** WAI-ARIA APG + WCAG 2.1 AA

---

### Scope
Complete shopping cart page including: global header navigation, promotional offer banner, two product line items with quantity controls and remove actions, order summary with pricing breakdown, coupon code input, and checkout CTA.

### Assumptions
- Page is in default state with 2 items in cart
- No validation errors are visible
- Coupon code field is empty
- Both products have quantity of 1
- No modal dialogs are open

---

## Keyboard Tab Order

Complete linear tab sequence for all focusable elements. Static text (prices, labels, headings) is excluded.

| # | Element | Role | Label | Notes |
|---|---------|------|-------|-------|
| 1 | Menu icon (hamburger) | `button` | "Open navigation menu" | Opens mobile/side nav; see Focus Management for trap behavior |
| 2 | Logo "Cozy®" | `link` | "Cozy, home" | Navigates to homepage |
| 3 | SHOP | `link` | "Shop" | Main nav link |
| 4 | COLLECTIVE | `link` | "Collective" | Main nav link |
| 5 | DESIGNERS | `link` | "Designers" | Main nav link |
| 6 | ABOUT US | `link` | "About Us" | Main nav link |
| 7 | CONTACT | `link` | "Contact" | Main nav link |
| 8 | Search icon | `button` | "Search" | Opens search overlay; announce expanded/collapsed state |
| 9 | Cart icon | `link` | "Shopping cart, 2 items" | Current page — use `aria-current="page"` |
| 10 | Product 1 image | `link` | "Osmond Armchair product image" | Links to product detail page |
| 11 | Product 1 name "Osmond Armchair" | `link` | "Osmond Armchair" | Links to product detail page |
| 12 | Product 1 Decrease quantity | `button` | "Decrease quantity for Osmond Armchair" | Disabled when qty = 1; announce current qty on activation |
| 13 | Product 1 Quantity value | `spinbutton` | "Quantity for Osmond Armchair" | `aria-valuenow="1"`, `aria-valuemin="1"`; keyboard: Arrow Up/Down to adjust |
| 14 | Product 1 Increase quantity | `button` | "Increase quantity for Osmond Armchair" | Announce new qty on activation |
| 15 | Product 1 Remove | `button` | "Remove Osmond Armchair from cart" | See Focus Management for post-removal focus |
| 16 | Product 2 image | `link` | "Meryl Lounge Chair product image" | Links to product detail page |
| 17 | Product 2 name "Meryl Lounge Chair" | `link` | "Meryl Lounge Chair" | Links to product detail page |
| 18 | Product 2 Decrease quantity | `button` | "Decrease quantity for Meryl Lounge Chair" | Disabled when qty = 1 |
| 19 | Product 2 Quantity value | `spinbutton` | "Quantity for Meryl Lounge Chair" | `aria-valuenow="1"`, `aria-valuemin="1"` |
| 20 | Product 2 Increase quantity | `button` | "Increase quantity for Meryl Lounge Chair" | Announce new qty on activation |
| 21 | Product 2 Remove | `button` | "Remove Meryl Lounge Chair from cart" | See Focus Management for post-removal focus |
| 22 | Coupon Code input | `textbox` | "Coupon Code" | Paired with visible label or `aria-label`; trailing icon is submit action |
| 23 | Apply Coupon (trailing icon) | `button` | "Apply coupon code" | Inside input row; activates coupon validation |
| 24 | Proceed to Checkout | `button` | "Proceed to Checkout" | Primary CTA; navigates to checkout flow |

---

## Screen Reader Reading Order

Virtual cursor (Browse mode) reading order, reflecting DOM order inferred from auto-layout hierarchy:

1. **Banner region** — Offer: "10% Instant Discount with Federal Bank Debit Cards on a min spend of $150. TCA"
2. **Header / Navigation landmark**
   - Logo: "Cozy®" (heading level 1 or link)
   - Navigation: SHOP, COLLECTIVE, DESIGNERS, ABOUT US, CONTACT
   - Search button, Cart button ("2 items")
3. **Main content landmark**
   - Heading (h1): "Cart"
   - Status text: "2 ITEMS" — use `aria-live="polite"` on this element so changes are announced
4. **Product list region** (`role="list"` or `<ul>`)
   - **Product 1** (`role="listitem"`)
     - Image: "Osmond Armchair" (decorative if linked via name, otherwise informative alt)
     - Product name: "Osmond Armchair" (heading level 2 or strong)
     - "Color: Gunnared biege" — read as a single phrase; use `<dl>` or colon-separated label/value
     - Price: "$149.99"
     - Quantity controls group: "Quantity: 1" with minus/plus buttons
     - "Remove" button
   - **Divider** — decorative, `aria-hidden="true"`
   - **Product 2** (`role="listitem"`)
     - Image: "Meryl Lounge Chair"
     - Product name: "Meryl Lounge Chair" (heading level 2 or strong)
     - "Color: Lysed bright green"
     - Price: "$169.99"
     - Quantity controls group: "Quantity: 1" with minus/plus buttons
     - "Remove" button
5. **Order Summary region** (`role="region"`, `aria-label="Order summary"`)
   - Heading (h2): "Order Summary"
   - Definition list or table:
     - Price: $319.98
     - Discount: $31.9
     - Shipping: Free
     - Coupon Applied: $0.00
   - Divider — `aria-hidden="true"`
   - Total: $288.08
   - Estimated Delivery by: 01 Feb, 2023
   - Coupon Code input
   - Proceed to Checkout button

---

## Screen Reader Interaction Announcements

### On Focus

| Element | Announcement |
|---------|-------------|
| Menu button | "Open navigation menu, button" |
| Logo link | "Cozy, home, link" |
| Nav links | "[Link name], link" |
| Search button | "Search, button" |
| Cart icon | "Shopping cart, 2 items, link, current page" |
| Product image link | "Osmond Armchair product image, link" |
| Product name link | "Osmond Armchair, link" |
| Minus button (Product 1) | "Decrease quantity for Osmond Armchair, button" (if qty = 1: "Decrease quantity for Osmond Armchair, button, disabled") |
| Quantity spinbutton | "Quantity for Osmond Armchair, spin button, 1" |
| Plus button (Product 1) | "Increase quantity for Osmond Armchair, button" |
| Remove button (Product 1) | "Remove Osmond Armchair from cart, button" |
| Coupon Code input | "Coupon Code, edit text, blank" |
| Apply Coupon button | "Apply coupon code, button" |
| Proceed to Checkout | "Proceed to Checkout, button" |

### On Quantity Change (Spinbutton / Button Activation)

When user presses plus or minus:
- **Announce via `aria-live="assertive"` on quantity region:** "Quantity updated to 2 for Osmond Armchair"
- **Subtotal in Order Summary updates:** announce via `aria-live="polite"` on Total region: "Cart total: $438.07"
- If minus is pressed at qty = 1: announce "Minimum quantity reached" and button becomes `aria-disabled="true"`

### On Remove Item

- **Announce:** "Osmond Armchair removed from cart"
- **Cart count updates:** "2 ITEMS" element (with `aria-live="polite"`) announces "1 item"
- **Order Summary updates** via live region

### On Coupon Code Submission

#### Success
- **Announce:** "Coupon applied. Discount: $15.00. New total: $273.08"
- Focus remains on the coupon input (or moves to a success message)

#### Validation Error
- **Announce:** "Invalid coupon code. Please enter a valid coupon."
- Error message appears inline below the input with `role="alert"` or `aria-live="assertive"`
- Input receives `aria-invalid="true"` and `aria-describedby` pointing to the error message

### On Proceed to Checkout

- **Announce:** Page navigation — "Navigating to checkout"
- If form validation is needed before checkout, announce errors first (see Focus Management)

### On Empty Cart (all items removed)

- **Announce via live region:** "Your cart is empty"
- Focus moves to an empty cart message or a "Continue Shopping" link

---

## Focus Management & State Changes

- **Initial focus on page load:** Focus on the `<main>` landmark or the "Cart" heading (`<h1>`). If arriving from "Add to Cart" action, focus on the newly added product row.

- **After quantity change:** Focus stays on the activated button (plus or minus). Do NOT move focus.

- **After item removal:**
  - If items remain: move focus to the **next product's name** in the list. If the removed item was the last in the list, move focus to the **previous product's name**.
  - If cart becomes empty: move focus to the **empty cart message** or **"Continue Shopping" link**.

- **Coupon validation failure:** Focus moves to the coupon code input. The input is marked `aria-invalid="true"`. Error message is associated via `aria-describedby`.

- **Coupon validation success:** Focus remains on the coupon input. Success message announced via `aria-live="polite"`.

- **Proceed to Checkout:** Standard page navigation. On the new page, focus moves to the first heading or main content.

- **Menu button activation:** If it opens a side drawer:
  - Focus traps inside the drawer
  - Escape key closes the drawer and returns focus to the menu button
  - Drawer has `role="dialog"`, `aria-modal="true"`, `aria-label="Navigation menu"`

- **Search button activation:** If it opens a search overlay:
  - Focus moves to the search input
  - Escape closes and returns focus to the search button

---

## Implementation Notes for Developers

### Required ARIA (only where native HTML is insufficient)

| Element | Attribute | Value |
|---------|-----------|-------|
| Cart icon | `aria-label` | "Shopping cart, 2 items" |
| Cart icon | `aria-current` | "page" |
| "2 ITEMS" text | `aria-live` | "polite" |
| Quantity stepper group | `role` | "group" |
| Quantity stepper group | `aria-label` | "Quantity for [Product Name]" |
| Quantity display | `role` | "spinbutton" |
| Quantity display | `aria-valuenow` | current qty |
| Quantity display | `aria-valuemin` | "1" |
| Minus button (at min) | `aria-disabled` | "true" |
| Minus button | `aria-label` | "Decrease quantity for [Product Name]" |
| Plus button | `aria-label` | "Increase quantity for [Product Name]" |
| Remove button | `aria-label` | "Remove [Product Name] from cart" |
| Product list | `role` | "list" (or use `<ul>`) |
| Each product row | `role` | "listitem" (or use `<li>`) |
| Order Summary section | `role` | "region" |
| Order Summary section | `aria-label` | "Order summary" |
| Total amount | `aria-live` | "polite" |
| Coupon input | `aria-label` | "Coupon Code" |
| Apply coupon button | `aria-label` | "Apply coupon code" |
| Dividers | `aria-hidden` | "true" |
| Offer banner | `role` | "banner" or `role="status"` |
| Menu drawer (if applicable) | `role` | "dialog" |
| Menu drawer | `aria-modal` | "true" |

### Keyboard Behaviour Expectations

| Component | Key | Action |
|-----------|-----|--------|
| All buttons | `Enter` / `Space` | Activate |
| All links | `Enter` | Navigate |
| Quantity spinbutton | `Arrow Up` | Increment quantity |
| Quantity spinbutton | `Arrow Down` | Decrement quantity (min 1) |
| Quantity spinbutton | `Home` | Set to minimum (1) |
| Quantity spinbutton | `End` | Set to maximum |
| Coupon code input | `Enter` | Submit coupon code |
| Menu drawer | `Escape` | Close drawer, return focus to menu button |
| Search overlay | `Escape` | Close overlay, return focus to search button |
| Nav links | `Tab` | Move to next link |
| Nav links | `Shift+Tab` | Move to previous link |
| Entire page | `Tab` | Move to next focusable element |
| Entire page | `Shift+Tab` | Move to previous focusable element |

### Do / Don't Rules

- Do: Use `<button>` for minus, plus, remove, apply coupon, and proceed to checkout actions
- Do: Use `<a>` for product names and images that navigate to product detail pages
- Do: Use `<input type="text">` for the coupon code field with a visible `<label>`
- Do: Group quantity controls (minus, value, plus) in a `<div role="group" aria-label="Quantity for [Product]">`
- Do: Use `aria-live="polite"` on elements that update dynamically (cart count, order total)
- Do: Provide `aria-label` on icon-only buttons (menu, search, cart, minus, plus)
- Don't: Use `<div>` or `<span>` for interactive elements — always use semantic HTML
- Don't: Rely on color alone for the "Free" shipping label or discount values
- Don't: Use `placeholder` as the only label for the coupon code input
- Don't: Remove focus outline on any interactive element
- Don't: Use `tabindex` values greater than 0 — let DOM order control tab sequence
- Don't: Make decorative dividers or product images (when linked via name) focusable

### Warnings

1. **Contrast failures (Critical):** The audit found 8 contrast issues. "Color" labels (2.50:1), "2 ITEMS" (2.50:1), coupon placeholder (2.50:1), and "Free" text (3.03:1) all fail AA. Fix by darkening these text elements to at least `#595959` on white or using the safe palette colors from the accessibility guidelines.

2. **Touch target violations (Critical):** 19 interactive elements are below the 44x44px minimum. All icon buttons (menu, search, cart, minus, plus, heart) are 20-24px. Apply invisible padding to achieve 44x44px tap zones.

3. **Fixed-height text containers:** Price, Discount, Shipping, Coupon Applied, Total, and Delivery rows use fixed 24px height. These will clip text at larger font sizes. Change to `height: auto` / hug contents.

4. **Remove button lacks unique label:** Both "Remove" buttons have identical text. Screen readers cannot distinguish them. Add `aria-label="Remove [Product Name] from cart"` to each.

5. **Heart icon in Remove button:** The heart icon inside the Remove button instance is semantically confusing — a heart icon typically means "Favorite/Wishlist", not "Remove". Either remove the heart icon from the Remove action or separate Wishlist and Remove into distinct buttons.

6. **"Color" label contrast:** The "Color" text for both products has a 2.50:1 contrast ratio — this fails both AA and AAA. This is not just a visual concern; it also impacts users with low vision who rely on reading the color description.

7. **Offer banner:** The promotional discount banner should have `role="status"` or be placed in an ARIA landmark so screen readers encounter it in browse mode. Currently it may be skipped.

---

## A11y Audit Summary

| Severity | Count | Category |
|----------|-------|----------|
| Error | 5 | Contrast (Minimum) — text below 4.5:1 |
| Error | 19 | Target Size — interactive elements below 44x44px |
| Warning | 3 | Contrast (Minimum) — text between 3:1 and 4.5:1 |
| Warning | 6 | Resize Text — fixed height text containers |
| **Total** | **34** | **issues across 75 checks (55% pass rate)** |
