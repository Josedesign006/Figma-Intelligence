export type ScreenTemplate = "auth" | "dashboard" | "list" | "detail" | "settings" | "onboarding" | "checkout-cart" | "checkout-address" | "checkout-shipping" | "checkout-payment" | "checkout-review" | "checkout-success" | "generic";
export interface TemplateDefinition {
    template: ScreenTemplate;
    keywords: string[];
    components: string[];
    layoutPattern: string;
}
/**
 * Built-in screen templates (from plan):
 *   Auth:        Login, Register, Forgot Password, OTP, Reset Password
 *   Onboarding:  Welcome, Feature Tour, Permissions, Profile Setup, Success
 *   Core App:    Dashboard, List View, Detail View, Settings, Profile, Notifications
 *   E-commerce:  PLP, PDP, Cart, Checkout, Order Confirmation
 *   Data:        Table View, Chart Dashboard, Empty State, Filter Panel
 *   SaaS:        Pricing, Trial Signup, Team Invite, Workspace, Billing
 */
export declare const SCREEN_TEMPLATES: TemplateDefinition[];
/**
 * Detect which template best matches a screen name/description.
 * Returns the matching TemplateDefinition or null.
 */
export declare function detectTemplate(nameOrDescription: string): TemplateDefinition | null;
/** Get the default components list for a screen template. */
export declare function componentsForTemplate(template: ScreenTemplate): string[];
//# sourceMappingURL=screen-templates.d.ts.map