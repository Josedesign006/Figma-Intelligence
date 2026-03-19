"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Screen Templates
// Built-in screen template definitions used by the page-architect tool.
// Each template maps a screen category to required DS components,
// layout patterns, and keywords for auto-detection.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCREEN_TEMPLATES = void 0;
exports.detectTemplate = detectTemplate;
exports.componentsForTemplate = componentsForTemplate;
/**
 * Built-in screen templates (from plan):
 *   Auth:        Login, Register, Forgot Password, OTP, Reset Password
 *   Onboarding:  Welcome, Feature Tour, Permissions, Profile Setup, Success
 *   Core App:    Dashboard, List View, Detail View, Settings, Profile, Notifications
 *   E-commerce:  PLP, PDP, Cart, Checkout, Order Confirmation
 *   Data:        Table View, Chart Dashboard, Empty State, Filter Panel
 *   SaaS:        Pricing, Trial Signup, Team Invite, Workspace, Billing
 */
exports.SCREEN_TEMPLATES = [
    {
        template: "auth",
        keywords: ["login", "sign in", "signup", "register", "auth", "password", "email", "forgot", "otp", "reset"],
        components: ["TextInput", "Button", "Heading", "Link"],
        layoutPattern: "Centered single-column with email + password inputs and primary CTA",
    },
    {
        template: "dashboard",
        keywords: ["dashboard", "home", "overview", "main", "hub", "analytics", "stats"],
        components: ["Navigation", "Header", "Card", "Chart", "Badge"],
        layoutPattern: "Sidebar nav + top header + main content grid",
    },
    {
        template: "list",
        keywords: ["list", "feed", "search", "browse", "explore", "results", "index", "directory", "catalog"],
        components: ["SearchBar", "Filter", "ListItem", "Pagination"],
        layoutPattern: "Search/filter header + scrollable list of items",
    },
    {
        template: "detail",
        keywords: ["detail", "view", "show", "profile", "product", "article", "post", "item"],
        components: ["Image", "Heading", "Body", "Button", "ActionBar"],
        layoutPattern: "Hero image + content area + sticky action bar",
    },
    {
        template: "settings",
        keywords: ["settings", "preferences", "account", "profile edit", "configuration", "options", "billing"],
        components: ["SectionHeader", "FormField", "Toggle", "Button"],
        layoutPattern: "Grouped form sections with labels and inputs",
    },
    {
        template: "onboarding",
        keywords: ["onboarding", "welcome", "intro", "get started", "tutorial", "step", "walkthrough", "tour"],
        components: ["Illustration", "Heading", "Body", "Button", "StepIndicator"],
        layoutPattern: "Full-bleed illustration + centered heading + body + next button",
    },
    {
        template: "checkout-cart",
        keywords: ["cart", "bag", "basket"],
        components: ["Navigation", "ProductCard", "QuantityStepper", "PromoCode", "OrderSummary", "Button"],
        layoutPattern: "Product list with summary card and bottom CTA",
    },
    {
        template: "checkout-address",
        keywords: ["address", "delivery address", "shipping address"],
        components: ["Navigation", "AddressCard", "TextInput", "Button"],
        layoutPattern: "Saved address selection with editable delivery form",
    },
    {
        template: "checkout-shipping",
        keywords: ["shipping", "delivery", "method"],
        components: ["Navigation", "RadioOption", "OrderSummary", "Button"],
        layoutPattern: "Shipping method options with delivery ETA and summary",
    },
    {
        template: "checkout-payment",
        keywords: ["payment", "card", "billing", "wallet"],
        components: ["Navigation", "PaymentMethodRow", "TextInput", "Button"],
        layoutPattern: "Saved payment methods, billing fields, and trust messaging",
    },
    {
        template: "checkout-review",
        keywords: ["review", "confirm", "place order", "order review"],
        components: ["Navigation", "OrderSummary", "AddressCard", "PaymentMethodRow", "Button"],
        layoutPattern: "Sectioned review screen with final totals and place-order CTA",
    },
    {
        template: "checkout-success",
        keywords: ["success", "confirmation", "complete", "thank you"],
        components: ["Illustration", "Heading", "OrderSummary", "Button"],
        layoutPattern: "Confirmation state with receipt summary and next steps",
    },
];
/**
 * Detect which template best matches a screen name/description.
 * Returns the matching TemplateDefinition or null.
 */
function detectTemplate(nameOrDescription) {
    const text = nameOrDescription.toLowerCase();
    return (exports.SCREEN_TEMPLATES.find((t) => t.keywords.some((kw) => text.includes(kw))) ?? null);
}
/** Get the default components list for a screen template. */
function componentsForTemplate(template) {
    const def = exports.SCREEN_TEMPLATES.find((t) => t.template === template);
    return def?.components ?? ["Heading", "Button"];
}
//# sourceMappingURL=screen-templates.js.map