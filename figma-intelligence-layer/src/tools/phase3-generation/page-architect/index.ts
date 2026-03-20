// ─────────────────────────────────────────────────────────────────────────────
// Page Architect
// Parses a natural-language flow description into a sequence of screens and
// builds them in Figma using Auto Layout frames populated with DS components.
// Optionally wires prototype connections and generates a flow-map page.
// ─────────────────────────────────────────────────────────────────────────────

import Fuse from "fuse.js";
import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import { ComponentSet } from "../../../shared/types.js";
import {
  fetchRemoteImageAsDataUri,
  searchUnsplashPhotos,
  trackUnsplashDownload,
  UnsplashOrientation,
} from "../../../shared/unsplash.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PageArchitectArgs {
  productContext: string;
  flow: string;
  platform: "web" | "mobile" | "both";
  width?: number;
  wireframeMode?: boolean;
  includeFlowMap?: boolean;
  contentMode: "placeholder" | "realistic";
  useStockImages?: boolean;
  imageQuery?: string;
}

export interface ScreenSpec {
  name: string;
  purpose: string;
  template: ScreenTemplate;
  requiredComponents: string[];
  layoutPattern: string;
  realisticContent?: ScreenContent;
}

export interface ScreenContent {
  heading?: string;
  subheading?: string;
  bodyText?: string;
  ctaLabel?: string;
  listItems?: string[];
  sectionTitle?: string;
  summaryItems?: string[];
  helperText?: string;
}

export interface CreatedScreen {
  frameId: string;
  name: string;
  template: ScreenTemplate;
  instantiatedComponents: string[];
}

export interface PrototypeConnection {
  fromFrameId: string;
  toFrameId: string;
  fromName: string;
  toName: string;
}

export interface PageArchitectResult {
  screens: CreatedScreen[];
  prototypeConnections: PrototypeConnection[];
  flowMapPageId: string | null;
  frameIds: string[];
  prototypeConnectionCount: number;
  logEntryId: string;
}

// ─── Screen templates ─────────────────────────────────────────────────────────

type ScreenTemplate =
  | "auth"
  | "dashboard"
  | "list"
  | "detail"
  | "settings"
  | "onboarding"
  | "checkout-cart"
  | "checkout-address"
  | "checkout-shipping"
  | "checkout-payment"
  | "checkout-review"
  | "checkout-success"
  | "generic";

interface TemplateDefinition {
  template: ScreenTemplate;
  keywords: string[];
  components: string[];
  layoutPattern: string;
}

const SCREEN_TEMPLATES: TemplateDefinition[] = [
  {
    template: "auth",
    keywords: ["login", "sign in", "signup", "register", "auth", "password", "email", "forgot"],
    components: ["TextInput", "Button", "Heading", "Link", "Divider", "SocialButton", "Checkbox", "Logo", "Avatar"],
    layoutPattern: "Centered single-column with email + password inputs and primary CTA",
  },
  {
    template: "dashboard",
    keywords: ["dashboard", "home", "overview", "main", "hub"],
    components: ["Navigation", "Header", "Card", "Chart", "Badge", "Avatar", "Table"],
    layoutPattern: "Sidebar nav + top header + main content grid",
  },
  {
    template: "list",
    keywords: ["list", "feed", "search", "browse", "explore", "results", "index", "directory"],
    components: ["SearchBar", "Filter", "ListItem", "Pagination", "FilterChip", "Thumbnail"],
    layoutPattern: "Search/filter header + scrollable list of items",
  },
  {
    template: "detail",
    keywords: ["detail", "view", "show", "profile", "product", "article", "post", "item"],
    components: ["Image", "Heading", "Body", "Button", "ActionBar", "BackButton", "ShareButton", "Rating", "Tag"],
    layoutPattern: "Hero image + content area + sticky action bar",
  },
  {
    template: "settings",
    keywords: ["settings", "preferences", "account", "profile edit", "configuration", "options"],
    components: ["SectionHeader", "FormField", "Toggle", "Button"],
    layoutPattern: "Grouped form sections with labels and inputs",
  },
  {
    template: "onboarding",
    keywords: ["onboarding", "welcome", "intro", "get started", "tutorial", "step", "walkthrough"],
    components: ["Illustration", "Heading", "Body", "Button"],
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

// ─── Platform widths ──────────────────────────────────────────────────────────

function platformWidth(platform: "web" | "mobile" | "both", userWidth?: number): number {
  if (userWidth) return userWidth;
  switch (platform) {
    case "mobile": return 390;
    case "web": return 1440;
    case "both": return 1440;
  }
}

function mobileWidth(_platform: "web" | "mobile" | "both"): number | null {
  return null; // single-frame output — no duplicate (Mobile) frames
}

// ─── Parse flow into screen specs (template matching) ────────────────────────

function parseFlowToScreens(
  productContext: string,
  flow: string,
  contentMode: "placeholder" | "realistic"
): ScreenSpec[] {
  const rawParts = flow.split(/\s*(?:→|->|>>|,|\n)\s*/);
  let screenNames = rawParts
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 60)
    .filter((s) => {
      const lower = s.toLowerCase();
      // Keep if it matches any template keyword
      const hasKeyword = SCREEN_TEMPLATES.some((t) =>
        t.keywords.some((kw) => lower.includes(kw))
      );
      // Keep if it looks like a proper name (capital letter or common UI term)
      const looksLikeName =
        /[A-Z]/.test(s) ||
        /^(home|profile|search|feed|inbox|cart|map)$/i.test(lower);
      return hasKeyword || looksLikeName || s.split(/\s+/).length <= 3;
    })
    .slice(0, 8);

  // If we filtered out most fragments, treat the whole input as one screen
  if (
    screenNames.length === 0 ||
    (rawParts.length > 3 && screenNames.length <= 1)
  ) {
    screenNames = [flow.trim().slice(0, 80)];
  }

  const parsed = screenNames.map((name) => ({
    name: name.replace(/\s+/g, " ").trim(),
    purpose: `User navigates to ${name}`,
    templateHint: "generic" as string | undefined,
    requiredComponents: ["Heading", "Button"] as string[],
    layoutPattern: "Generic content frame",
  }));

  return parsed.map((item, index) => {
    const templateDef =
      SCREEN_TEMPLATES.find(
        (t) =>
          t.template === item.templateHint ||
          t.keywords.some((kw) => item.name.toLowerCase().includes(kw))
      ) ?? null;

    const resolvedTemplate =
      (item.templateHint as ScreenTemplate) ?? templateDef?.template ?? "generic";

    return {
      name: item.name,
      purpose: item.purpose,
      template: resolvedTemplate,
      requiredComponents:
        item.requiredComponents ??
        templateDef?.components ??
        ["Heading", "Button"],
      layoutPattern:
        item.layoutPattern ??
        templateDef?.layoutPattern ??
        "Vertical stack",
      realisticContent:
        contentMode === "realistic"
          ? buildRealisticContent(resolvedTemplate, item.name, productContext, index)
          : undefined,
    };
  });
}

function buildRealisticContent(
  template: ScreenTemplate,
  name: string,
  productContext: string,
  index: number
): ScreenContent {
  const brandLabel = /skincare|beauty|cosmetic/.test(productContext.toLowerCase())
    ? "Lumin Daily"
    : /fashion|apparel/.test(productContext.toLowerCase())
      ? "Studio North"
      : "Northstar";

  switch (template) {
    case "checkout-cart":
      return {
        heading: "Your bag",
        subheading: "Review items, delivery timing, and savings before checkout.",
        ctaLabel: "Continue to address",
        sectionTitle: `${brandLabel} favorites`,
        listItems: ["Vitamin C Serum x1  $48", "Barrier Repair Cream x1  $36", "Free sample kit included"],
        summaryItems: ["Subtotal  $84", "Shipping  Free", "Tax  $6", "Total  $90"],
        helperText: "Promo code SAVE10 applied",
      };
    case "checkout-address":
      return {
        heading: "Delivery address",
        subheading: "Choose where your order should arrive.",
        ctaLabel: "Continue to shipping",
        sectionTitle: "Saved addresses",
        listItems: ["Home  21 Lake Shore Drive, Apt 6B", "Office  101 Market Street, Floor 9"],
        helperText: "Add delivery instructions for the courier",
      };
    case "checkout-shipping":
      return {
        heading: "Shipping method",
        subheading: "Select the delivery speed that works best for you.",
        ctaLabel: "Continue to payment",
        sectionTitle: "Delivery options",
        listItems: ["Standard  Free  Arrives Tue, Mar 17", "Express  $12  Arrives Mon, Mar 16", "Same day  $18  Arrives today by 9 PM"],
        summaryItems: ["Items  2", "Estimated delivery  2-3 business days"],
      };
    case "checkout-payment":
      return {
        heading: "Payment method",
        subheading: "Your card details are encrypted and secure.",
        ctaLabel: "Review order",
        sectionTitle: "Saved methods",
        listItems: ["Visa ending in 4242", "Apple Pay", "Add new card"],
        helperText: "Billing address same as delivery",
      };
    case "checkout-review":
      return {
        heading: "Review your order",
        subheading: "Double-check delivery, payment, and totals before placing the order.",
        ctaLabel: "Place order",
        sectionTitle: "Order summary",
        listItems: ["Delivery to Maya Patel", "Payment  Visa 4242", "Standard shipping  Free"],
        summaryItems: ["Subtotal  $84", "Discount  -$8", "Tax  $6", "Total  $82"],
        helperText: "By placing this order, you agree to the terms and refund policy.",
      };
    case "checkout-success":
      return {
        heading: "Order confirmed",
        subheading: "Thanks for shopping with us. A receipt has been sent to your email.",
        ctaLabel: "Track shipment",
        sectionTitle: "What happens next",
        listItems: ["Order #NS-2048", "Estimated arrival Tue, Mar 17", "Receipt sent to maya@example.com"],
        summaryItems: ["Need help? Contact support 24/7"],
      };
    case "detail":
      return {
        heading: name,
        subheading: "Thoughtful product details, benefits, and a clear path to continue.",
        ctaLabel: "Continue",
      };
    default:
      return {
        heading: name,
        subheading: `Designed for ${productContext}.`,
        ctaLabel: index === 0 ? "Get started" : "Continue",
      };
  }
}

// ─── AI Content Bundle ────────────────────────────────────────────────────────

interface ContentBundle {
  brand: { name: string; tagline: string };
  user: { name: string; email: string };
  order: {
    number: string;
    items: Array<{ name: string; price: string; qty: number }>;
    subtotal: string;
    shipping: string;
    tax: string;
    total: string;
    discount?: string;
    estimatedDelivery: string;
  };
  address: { home: string; work: string };
  imageQuery: string;
  screens: Array<{
    screenName: string;
    heading: string;
    subheading: string;
    ctaLabel: string;
    listItems?: string[];
    summaryItems?: string[];
    sectionTitle?: string;
    helperText?: string;
    bodyText?: string;
  }>;
}

async function generateContentBundle(
  productContext: string,
  screenNames: string[]
): Promise<ContentBundle | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const prompt = `You are a UI content writer. Generate a realistic content bundle for a "${productContext}" app.

Screens: ${screenNames.join(", ")}

Return ONLY valid JSON (no markdown, no extra text):
{
  "brand": { "name": "string", "tagline": "string" },
  "user": { "name": "string", "email": "string" },
  "order": {
    "number": "string",
    "items": [{ "name": "string", "price": "string", "qty": 1 }],
    "subtotal": "string", "shipping": "string", "tax": "string", "total": "string",
    "discount": "string", "estimatedDelivery": "string"
  },
  "address": { "home": "string", "work": "string" },
  "imageQuery": "string",
  "screens": [
    {
      "screenName": "string",
      "heading": "string",
      "subheading": "string",
      "ctaLabel": "string",
      "listItems": ["string"],
      "summaryItems": ["string"],
      "sectionTitle": "string",
      "helperText": "string",
      "bodyText": "string"
    }
  ]
}

Rules:
- Brand name, user name, products, and prices must fit the product context
- imageQuery: a specific Unsplash-friendly photographic term (e.g. "artisan coffee overhead shot")
- listItems and summaryItems: real relevant data, not generic placeholder text
- Keep text concise like a real production app (subheading max 120 chars, bodyText max 150 chars)
- screens array must have one entry per screen in the same order provided`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      console.warn(`generateContentBundle: API error ${response.status}`);
      return null;
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };
    const text = data.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as ContentBundle;
  } catch (error) {
    console.warn(`generateContentBundle: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function applyBundleToScreen(
  template: ScreenTemplate,
  screenName: string,
  bundle: ContentBundle,
  index: number
): ScreenContent {
  const screenData =
    bundle.screens.find((s) => s.screenName.toLowerCase() === screenName.toLowerCase()) ??
    bundle.screens[index] ??
    bundle.screens[0];

  if (!screenData) return buildRealisticContent(template, screenName, "", index);

  switch (template) {
    case "checkout-cart":
      return {
        heading: screenData.heading || "Your bag",
        subheading: screenData.subheading,
        ctaLabel: screenData.ctaLabel || "Continue to address",
        sectionTitle: screenData.sectionTitle || bundle.brand.name,
        listItems: bundle.order.items.map((i) => `${i.name} x${i.qty}  ${i.price}`),
        summaryItems: [
          `Subtotal  ${bundle.order.subtotal}`,
          `Shipping  ${bundle.order.shipping}`,
          `Tax  ${bundle.order.tax}`,
          `Total  ${bundle.order.total}`,
        ],
        helperText: screenData.helperText,
      };
    case "checkout-address":
      return {
        heading: screenData.heading || "Delivery address",
        subheading: screenData.subheading,
        ctaLabel: screenData.ctaLabel || "Continue to shipping",
        sectionTitle: screenData.sectionTitle || "Saved addresses",
        listItems: [`Home  ${bundle.address.home}`, `Work  ${bundle.address.work}`],
        helperText: screenData.helperText,
      };
    case "checkout-shipping":
      return {
        heading: screenData.heading || "Shipping method",
        subheading: screenData.subheading,
        ctaLabel: screenData.ctaLabel || "Continue to payment",
        sectionTitle: screenData.sectionTitle || "Delivery options",
        listItems: screenData.listItems ?? [
          `Standard  Free  Arrives ${bundle.order.estimatedDelivery}`,
          "Express  $12  Arrives tomorrow",
          "Same day  $18  Arrives today by 9 PM",
        ],
        summaryItems: screenData.summaryItems ?? [
          `Items  ${bundle.order.items.length}`,
          `Estimated delivery  ${bundle.order.estimatedDelivery}`,
        ],
      };
    case "checkout-payment":
      return {
        heading: screenData.heading || "Payment method",
        subheading: screenData.subheading,
        ctaLabel: screenData.ctaLabel || "Review order",
        sectionTitle: screenData.sectionTitle || "Saved methods",
        listItems: screenData.listItems ?? ["Visa ending in 4242", "Apple Pay", "Add new card"],
        helperText: screenData.helperText,
      };
    case "checkout-review":
      return {
        heading: screenData.heading || "Review your order",
        subheading: screenData.subheading,
        ctaLabel: screenData.ctaLabel || "Place order",
        sectionTitle: screenData.sectionTitle || "Order summary",
        listItems: [
          `Delivery to ${bundle.user.name}`,
          "Payment  Visa 4242",
          bundle.order.shipping === "Free" ? "Standard shipping  Free" : `Shipping  ${bundle.order.shipping}`,
        ],
        summaryItems: [
          `Subtotal  ${bundle.order.subtotal}`,
          ...(bundle.order.discount ? [`Discount  -${bundle.order.discount}`] : []),
          `Tax  ${bundle.order.tax}`,
          `Total  ${bundle.order.total}`,
        ],
        helperText: screenData.helperText,
      };
    case "checkout-success":
      return {
        heading: screenData.heading || "Order confirmed",
        subheading: screenData.subheading || `Thanks for shopping with ${bundle.brand.name}. A receipt has been sent to your email.`,
        ctaLabel: screenData.ctaLabel || "Track shipment",
        sectionTitle: screenData.sectionTitle || "What happens next",
        listItems: [
          `Order ${bundle.order.number}`,
          `Estimated arrival ${bundle.order.estimatedDelivery}`,
          `Receipt sent to ${bundle.user.email}`,
        ],
        summaryItems: ["Need help? Contact support 24/7"],
      };
    default:
      return {
        heading: screenData.heading,
        subheading: screenData.subheading,
        ctaLabel: screenData.ctaLabel,
        sectionTitle: screenData.sectionTitle,
        listItems: screenData.listItems,
        summaryItems: screenData.summaryItems,
        helperText: screenData.helperText,
        bodyText: screenData.bodyText,
      };
  }
}

// ─── DS component matching ────────────────────────────────────────────────────

function buildFuse(sets: ComponentSet[]): Fuse<ComponentSet> {
  return new Fuse(sets, {
    keys: ["name", "description"],
    threshold: 0.45,
    includeScore: true,
    minMatchCharLength: 2,
  });
}

function resolveComponents(
  requiredNames: string[],
  fuse: Fuse<ComponentSet>
): Array<{ name: string; nodeId: string | null }> {
  return requiredNames.map((name) => {
    const results = fuse.search(name);
    if (results.length === 0) return { name, nodeId: null };
    const best = results[0];
    const firstChild = best.item.children[0];
    return {
      name: best.item.name,
      nodeId: firstChild?.id ?? null,
    };
  });
}

// ─── Figma script: build screen frame ────────────────────────────────────────

interface FrameSpec {
  name: string;
  purpose: string;
  width: number;
  template: ScreenTemplate;
  wireframeMode: boolean;
  contentMode: "placeholder" | "realistic";
  content?: ScreenContent;
  resolvedComponents: Array<{ name: string; nodeId: string | null }>;
  xOffset: number;
  imageHash?: string | null;
}

interface ScreenImagery {
  imageHash: string;
  sourceUrl: string;
  photographerName: string;
  photographerProfileUrl: string;
}

function isImageHeavyContext(productContext: string, flow: string): boolean {
  const text = `${productContext} ${flow}`.toLowerCase();
  return /(ecommerce|shop|store|retail|product|travel|hotel|hospitality|restaurant|food|beauty|fashion|wellness|fitness|interior|furniture|lifestyle|editorial|marketplace|booking)/.test(text);
}

function guessImageQuery(productContext: string, flow: string): string {
  const text = `${productContext} ${flow}`.toLowerCase();
  if (/(skincare|beauty|cosmetic|serum|makeup)/.test(text)) return "premium skincare product";
  if (/(fashion|clothing|apparel|shoe|jewelry)/.test(text)) return "premium fashion product";
  if (/(travel|hotel|hospitality|booking|resort)/.test(text)) return "boutique hotel travel";
  if (/(food|restaurant|meal|grocery)/.test(text)) return "premium food photography";
  if (/(fitness|wellness|health|yoga)/.test(text)) return "wellness lifestyle";
  if (/(interior|furniture|home decor|real estate)/.test(text)) return "modern interior design";
  return productContext.trim();
}

async function loadStockImagery(
  query: string,
  flow: string,
  count: number,
  orientation: UnsplashOrientation
): Promise<ScreenImagery[]> {
  const search = await searchUnsplashPhotos({
    query,
    perPage: Math.min(Math.max(count, 1), 6),
    orientation,
    contentFilter: "high",
  });

  const imagery: ScreenImagery[] = [];
  const bridge = await getBridge();

  for (const photo of search.results) {
    const dataUri = await fetchRemoteImageAsDataUri(photo.urls.regular || photo.urls.small);
    const imported = await bridge.importImage(dataUri);
    await trackUnsplashDownload(photo.links.downloadLocation);
    imagery.push({
      imageHash: imported.imageHash,
      sourceUrl: photo.links.html,
      photographerName: photo.photographer.name,
      photographerProfileUrl: photo.photographer.profileUrl,
    });
  }

  return imagery;
}

// ─── Shimmer skeleton script ──────────────────────────────────────────────────
// Creates the outer frame immediately with loading-skeleton rectangles so the
// user sees the frame appear in the viewport before content is injected.
function buildShimmerScript(spec: FrameSpec, isFirst: boolean): string {
  const { name, width, xOffset, wireframeMode } = spec;
  const bgColor = wireframeMode ? "{ r: 0.97, g: 0.97, b: 0.97 }" : "{ r: 1, g: 1, b: 1 }";

  const navigateSnippet = isFirst
    ? `figma.viewport.scrollAndZoomIntoView([frame]);`
    : "";

  return `
(async () => {
  const frame = figma.createFrame();
  frame.name = ${JSON.stringify(name)};
  frame.resize(${width}, 800);
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'FIXED';
  frame.itemSpacing = 16;
  frame.paddingLeft = 24;
  frame.paddingRight = 24;
  frame.paddingTop = 24;
  frame.paddingBottom = 32;
  frame.fills = [{ type: 'SOLID', color: ${bgColor} }];
  frame.x = ${xOffset};
  frame.y = 0;
  figma.currentPage.appendChild(frame);

  const skeletonFill = [{ type: 'SOLID', color: { r: 0.91, g: 0.92, b: 0.95 } }];
  const lightFill    = [{ type: 'SOLID', color: { r: 0.95, g: 0.96, b: 0.98 } }];
  const shimmerItems = [
    { h: 32, radius: 6, fill: skeletonFill },
    { h: 18, radius: 4, fill: lightFill, w: 0.6 },
    { h: 120, radius: 12, fill: lightFill },
    { h: 72, radius: 8, fill: skeletonFill },
    { h: 72, radius: 8, fill: skeletonFill },
    { h: 48, radius: 24, fill: [{ type: 'SOLID', color: { r: 0.55, g: 0.40, b: 0.95 }, opacity: 0.18 }] },
  ];
  for (const item of shimmerItems) {
    const r = figma.createRectangle();
    r.name = '__shimmer__';
    const rw = item.w ? Math.round((${width} - 48) * item.w) : ${width} - 48;
    r.resize(rw, item.h);
    r.cornerRadius = item.radius;
    r.fills = item.fill;
    frame.appendChild(r);
    if (!item.w && 'layoutSizingHorizontal' in r) r.layoutSizingHorizontal = 'FILL';
  }

  ${navigateSnippet}
  return { frameId: frame.id };
})();
`.trim();
}

function buildScreenScript(spec: FrameSpec): string {
  const {
    name,
    width,
    template,
    wireframeMode,
    contentMode,
    content,
    resolvedComponents,
    xOffset,
    imageHash,
  } = spec;

  const bgColor = wireframeMode
    ? "{ r: 0.97, g: 0.97, b: 0.97 }"
    : "{ r: 1, g: 1, b: 1 }";

  const headerText =
    contentMode === "realistic" && content?.heading
      ? content.heading
      : name;

  const subText =
    contentMode === "realistic" && content?.subheading
      ? content.subheading
      : spec.purpose ?? "";

  const ctaText =
    contentMode === "realistic" && content?.ctaLabel
      ? content.ctaLabel
      : "Continue";
  const bodyText =
    contentMode === "realistic" && content?.bodyText
      ? content.bodyText
      : "";
  const sectionTitle =
    contentMode === "realistic" && content?.sectionTitle
      ? content.sectionTitle
      : "";
  const listItems = contentMode === "realistic" ? (content?.listItems ?? []) : [];
  const summaryItems = contentMode === "realistic" ? (content?.summaryItems ?? []) : [];
  const helperText =
    contentMode === "realistic" && content?.helperText
      ? content.helperText
      : "";

  // Template-specific skeleton builders
  const templateBody = buildTemplateBody(
    template,
    headerText,
    subText,
    ctaText,
    wireframeMode,
    imageHash,
    bodyText,
    sectionTitle,
    listItems,
    summaryItems,
    helperText,
    resolvedComponents
  );

  return `
(async () => {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

  // Create new frame
  const frame = figma.createFrame();
  frame.name = ${JSON.stringify(name)};
  frame.resize(${width}, 900);
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisSizingMode = 'AUTO';
  frame.counterAxisSizingMode = 'FIXED';
  frame.itemSpacing = 16;
  frame.paddingLeft = 24;
  frame.paddingRight = 24;
  frame.paddingTop = 24;
  frame.paddingBottom = 32;
  frame.fills = [{ type: 'SOLID', color: ${bgColor} }];
  frame.x = ${xOffset};
  frame.y = 0;
  figma.currentPage.appendChild(frame);

  ${templateBody}

  return { frameId: frame.id };
})();
`.trim();
}

function buildTemplateBody(
  template: ScreenTemplate,
  headerText: string,
  subText: string,
  ctaText: string,
  wireframeMode: boolean,
  imageHash?: string | null,
  bodyText?: string,
  sectionTitle?: string,
  listItems: string[] = [],
  summaryItems: string[] = [],
  helperText?: string,
  resolvedComponents: Array<{ name: string; nodeId: string | null }> = []
): string {
  // ── Centralized color palette ──
  const palette = {
    primary: "{ r: 0.09, g: 0.09, b: 0.09 }",
    primaryText: "{ r: 1, g: 1, b: 1 }",
    surface: "{ r: 0.98, g: 0.98, b: 0.99 }",
    border: "{ r: 0.90, g: 0.91, b: 0.93 }",
    muted: "{ r: 0.45, g: 0.45, b: 0.50 }",
    accent: "{ r: 0.22, g: 0.35, b: 0.96 }",
  };

  const rectColor = wireframeMode
    ? "{ r: 0.88, g: 0.88, b: 0.88 }"
    : "{ r: 0.94, g: 0.95, b: 1 }";

  // Helper: try to instantiate a DS component, falling back to manual code
  const tryInstantiate = (componentName: string, fallbackCode: string): string => {
    const match = resolvedComponents.find(
      (c) => c.nodeId && c.name.toLowerCase().includes(componentName.toLowerCase())
    );
    if (match) {
      return `{
      const comp = await figma.getNodeByIdAsync(${JSON.stringify(match.nodeId)});
      if (comp && 'createInstance' in comp) {
        const inst = comp.createInstance();
        frame.appendChild(inst);
        if ('layoutSizingHorizontal' in inst) inst.layoutSizingHorizontal = 'FILL';
      } else { ${fallbackCode} }
    }`;
    }
    return fallbackCode;
  };

  const addHeading = `
  const heading = figma.createText();
  heading.characters = ${JSON.stringify(headerText)};
  heading.fontSize = 28;
  heading.fontName = { family: 'Inter', style: 'Bold' };
  frame.appendChild(heading);
  if ('layoutSizingHorizontal' in heading) heading.layoutSizingHorizontal = 'FILL';`;

  const addSubheading = subText
    ? `
  const subheading = figma.createText();
  subheading.characters = ${JSON.stringify(subText.slice(0, 140))};
  subheading.fontSize = 16;
  subheading.fontName = { family: 'Inter', style: 'Regular' };
  subheading.opacity = 0.65;
  frame.appendChild(subheading);
  if ('layoutSizingHorizontal' in subheading) subheading.layoutSizingHorizontal = 'FILL';`
    : "";

  const addSectionTitle = sectionTitle
    ? `
  const sectionTitleNode = figma.createText();
  sectionTitleNode.characters = ${JSON.stringify(sectionTitle)};
  sectionTitleNode.fontSize = 14;
  sectionTitleNode.fontName = { family: 'Inter', style: 'Bold' };
  sectionTitleNode.opacity = 0.8;
  frame.appendChild(sectionTitleNode);
  if ('layoutSizingHorizontal' in sectionTitleNode) sectionTitleNode.layoutSizingHorizontal = 'FILL';`
    : "";

  const addBodyText = bodyText
    ? `
  const bodyNode = figma.createText();
  bodyNode.characters = ${JSON.stringify(bodyText.slice(0, 180))};
  bodyNode.fontSize = 15;
  bodyNode.fontName = { family: 'Inter', style: 'Regular' };
  bodyNode.opacity = 0.75;
  frame.appendChild(bodyNode);
  if ('layoutSizingHorizontal' in bodyNode) bodyNode.layoutSizingHorizontal = 'FILL';`
    : "";

  const addTextRows = (rows: string[], title: string) => {
    if (rows.length === 0) return "";
    return `
  {
    const group = figma.createFrame();
    group.name = ${JSON.stringify(title)};
    group.layoutMode = 'VERTICAL';
    group.primaryAxisSizingMode = 'AUTO';
    group.counterAxisSizingMode = 'AUTO';
    group.itemSpacing = 12;
    group.paddingLeft = 16;
    group.paddingRight = 16;
    group.paddingTop = 16;
    group.paddingBottom = 16;
    group.cornerRadius = 12;
    group.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.99 } }];
    ${rows
      .map(
        (row) => `
    {
      const t = figma.createText();
      t.characters = ${JSON.stringify(row)};
      t.fontSize = 15;
      t.fontName = { family: 'Inter', style: 'Regular' };
      group.appendChild(t);
      if ('layoutSizingHorizontal' in t) t.layoutSizingHorizontal = 'FILL';
    }`
      )
      .join("\n")}
    frame.appendChild(group);
    if ('layoutSizingHorizontal' in group) group.layoutSizingHorizontal = 'FILL';
  }`;
  };

  const addHelperText = helperText
    ? `
  const helperNode = figma.createText();
  helperNode.characters = ${JSON.stringify(helperText.slice(0, 180))};
  helperNode.fontSize = 13;
  helperNode.fontName = { family: 'Inter', style: 'Regular' };
  helperNode.opacity = 0.6;
  frame.appendChild(helperNode);
  if ('layoutSizingHorizontal' in helperNode) helperNode.layoutSizingHorizontal = 'FILL';`
    : "";

  // Wireframe-only grey block — only used in wireframeMode
  const addPlaceholderRect = (label: string, height: number) => `
  {
    const r = figma.createRectangle();
    r.name = ${JSON.stringify(label)};
    r.resize(frame.width - 48, ${height});
    r.fills = [{ type: 'SOLID', color: ${rectColor} }];
    r.cornerRadius = 8;
    frame.appendChild(r);
    if ('layoutSizingHorizontal' in r) r.layoutSizingHorizontal = 'FILL';
  }`;

  const addImageRect = (label: string, height: number) => `
  {
    const r = figma.createRectangle();
    r.name = ${JSON.stringify(label)};
    r.resize(frame.width - 48, ${height});
    ${imageHash
      ? `r.fills = [{ type: 'IMAGE', imageHash: ${JSON.stringify(imageHash)}, scaleMode: 'FILL' }];`
      : `r.fills = [{ type: 'SOLID', color: ${rectColor} }];`}
    r.cornerRadius = 12;
    frame.appendChild(r);
    if ('layoutSizingHorizontal' in r) r.layoutSizingHorizontal = 'FILL';
  }`;

  const ctaFallback = `
    const btn = figma.createFrame();
    btn.name = 'CTA';
    btn.resize(frame.width - 48, 52);
    btn.layoutMode = 'HORIZONTAL';
    btn.primaryAxisAlignItems = 'CENTER';
    btn.counterAxisAlignItems = 'CENTER';
    btn.fills = [{ type: 'SOLID', color: ${palette.primary} }];
    btn.cornerRadius = 12;
    const btnLabel = figma.createText();
    btnLabel.characters = ${JSON.stringify(ctaText)};
    btnLabel.fontSize = 16;
    btnLabel.fontName = { family: 'Inter', style: 'Medium' };
    btnLabel.fills = [{ type: 'SOLID', color: ${palette.primaryText} }];
    btn.appendChild(btnLabel);
    frame.appendChild(btn);
    if ('layoutSizingHorizontal' in btn) btn.layoutSizingHorizontal = 'FILL';
  `;
  const addCTA = tryInstantiate("Button", ctaFallback);

  // ── Styled elements (replace grey rects in realistic / non-wireframe mode) ──

  const addInputField = (label: string, placeholder: string) => wireframeMode
    ? addPlaceholderRect(label, 52)
    : `
  {
    const inp = figma.createFrame();
    inp.name = ${JSON.stringify(label)};
    inp.layoutMode = 'HORIZONTAL';
    inp.counterAxisAlignItems = 'CENTER';
    inp.paddingLeft = 16; inp.paddingRight = 16;
    inp.primaryAxisSizingMode = 'FIXED'; inp.counterAxisSizingMode = 'FIXED';
    inp.resize(frame.width - 48, 52);
    inp.fills = [{ type: 'SOLID', color: { r: 0.99, g: 0.99, b: 1 } }];
    inp.cornerRadius = 10;
    inp.strokes = [{ type: 'SOLID', color: { r: 0.87, g: 0.88, b: 0.91 } }];
    inp.strokeWeight = 1.5;
    const ph = figma.createText();
    ph.characters = ${JSON.stringify(placeholder)};
    ph.fontSize = 15;
    ph.fontName = { family: 'Inter', style: 'Regular' };
    ph.fills = [{ type: 'SOLID', color: { r: 0.63, g: 0.64, b: 0.68 } }];
    inp.appendChild(ph);
    if ('layoutSizingHorizontal' in ph) ph.layoutSizingHorizontal = 'FILL';
    frame.appendChild(inp);
    if ('layoutSizingHorizontal' in inp) inp.layoutSizingHorizontal = 'FILL';
  }`;

  const addNavBar = (brandText: string) => wireframeMode
    ? addPlaceholderRect("Navigation Bar", 56)
    : `
  {
    const nav = figma.createFrame();
    nav.name = 'NavBar';
    nav.layoutMode = 'HORIZONTAL';
    nav.counterAxisAlignItems = 'CENTER';
    nav.primaryAxisAlignItems = 'SPACE_BETWEEN';
    nav.paddingLeft = 0; nav.paddingRight = 0;
    nav.primaryAxisSizingMode = 'FIXED'; nav.counterAxisSizingMode = 'FIXED';
    nav.resize(frame.width - 48, 56);
    nav.fills = [];
    const bLabel = figma.createText();
    bLabel.characters = ${JSON.stringify(brandText)};
    bLabel.fontSize = 17;
    bLabel.fontName = { family: 'Inter', style: 'Bold' };
    nav.appendChild(bLabel);
    const mIcon = figma.createText();
    mIcon.characters = '\u22EF';
    mIcon.fontSize = 20;
    mIcon.fontName = { family: 'Inter', style: 'Bold' };
    mIcon.opacity = 0.4;
    nav.appendChild(mIcon);
    frame.appendChild(nav);
    if ('layoutSizingHorizontal' in nav) nav.layoutSizingHorizontal = 'FILL';
  }`;

  const addStatRow = () => wireframeMode
    ? addPlaceholderRect("Stats Row", 96)
    : `
  {
    const row = figma.createFrame();
    row.name = 'StatsRow';
    row.layoutMode = 'HORIZONTAL';
    row.itemSpacing = 12;
    row.primaryAxisSizingMode = 'FIXED'; row.counterAxisSizingMode = 'AUTO';
    row.resize(frame.width - 48, 1);
    row.fills = [];
    ${[["24", "Active"], ["8", "Pending"], ["142", "Total"]]
      .map(
        ([val, lbl]) => `
    {
      const sc = figma.createFrame();
      sc.name = ${JSON.stringify(lbl)};
      sc.layoutMode = 'VERTICAL';
      sc.primaryAxisSizingMode = 'AUTO'; sc.counterAxisSizingMode = 'AUTO';
      sc.paddingLeft = 16; sc.paddingRight = 16;
      sc.paddingTop = 14; sc.paddingBottom = 14;
      sc.itemSpacing = 2;
      sc.cornerRadius = 12;
      sc.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.97, b: 1 } }];
      const sv = figma.createText(); sv.characters = ${JSON.stringify(val)};
      sv.fontSize = 24; sv.fontName = { family: 'Inter', style: 'Bold' };
      sc.appendChild(sv);
      const sl = figma.createText(); sl.characters = ${JSON.stringify(lbl)};
      sl.fontSize = 12; sl.fontName = { family: 'Inter', style: 'Regular' }; sl.opacity = 0.55;
      sc.appendChild(sl);
      row.appendChild(sc);
      if ('layoutSizingHorizontal' in sc) sc.layoutSizingHorizontal = 'FILL';
    }`
      )
      .join("\n")}
    frame.appendChild(row);
    if ('layoutSizingHorizontal' in row) row.layoutSizingHorizontal = 'FILL';
  }`;

  const addSearchBar = () => wireframeMode
    ? addPlaceholderRect("Search Bar", 48)
    : `
  {
    const sb = figma.createFrame();
    sb.name = 'SearchBar';
    sb.layoutMode = 'HORIZONTAL';
    sb.counterAxisAlignItems = 'CENTER';
    sb.paddingLeft = 16; sb.paddingRight = 16;
    sb.itemSpacing = 8;
    sb.primaryAxisSizingMode = 'FIXED'; sb.counterAxisSizingMode = 'FIXED';
    sb.resize(frame.width - 48, 48);
    sb.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.97 } }];
    sb.cornerRadius = 24;
    const sIcon = figma.createText();
    sIcon.characters = '\uD83D\uDD0D';
    sIcon.fontSize = 14; sIcon.fontName = { family: 'Inter', style: 'Regular' };
    sIcon.opacity = 0.4;
    sb.appendChild(sIcon);
    const sph = figma.createText();
    sph.characters = 'Search\u2026';
    sph.fontSize = 15; sph.fontName = { family: 'Inter', style: 'Regular' };
    sph.opacity = 0.45;
    sb.appendChild(sph);
    if ('layoutSizingHorizontal' in sph) sph.layoutSizingHorizontal = 'FILL';
    frame.appendChild(sb);
    if ('layoutSizingHorizontal' in sb) sb.layoutSizingHorizontal = 'FILL';
  }`;

  const addListItemRows = (items: string[]) => wireframeMode
    ? items.map(() => addPlaceholderRect("List Item", 72)).join("\n")
    : items
        .map(
          (item) => `
  {
    const row = figma.createFrame();
    row.name = 'ListItem';
    row.layoutMode = 'HORIZONTAL';
    row.counterAxisAlignItems = 'CENTER';
    row.paddingLeft = 16; row.paddingRight = 16;
    row.itemSpacing = 12;
    row.primaryAxisSizingMode = 'FIXED'; row.counterAxisSizingMode = 'FIXED';
    row.resize(frame.width - 48, 68);
    row.cornerRadius = 10;
    row.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    row.strokes = [{ type: 'SOLID', color: { r: 0.92, g: 0.93, b: 0.96 } }];
    row.strokeWeight = 1;
    const avatar = figma.createEllipse();
    avatar.resize(40, 40);
    avatar.fills = [{ type: 'SOLID', color: { r: 0.91, g: 0.92, b: 0.97 } }];
    row.appendChild(avatar);
    const textCol = figma.createFrame();
    textCol.name = 'Labels';
    textCol.layoutMode = 'VERTICAL';
    textCol.primaryAxisSizingMode = 'AUTO'; textCol.counterAxisSizingMode = 'AUTO';
    textCol.itemSpacing = 3; textCol.fills = [];
    const titleT = figma.createText();
    titleT.characters = ${JSON.stringify(item)};
    titleT.fontSize = 15; titleT.fontName = { family: 'Inter', style: 'Medium' };
    textCol.appendChild(titleT);
    const subT = figma.createText();
    subT.characters = 'Tap to view details';
    subT.fontSize = 13; subT.fontName = { family: 'Inter', style: 'Regular' };
    subT.opacity = 0.5;
    textCol.appendChild(subT);
    row.appendChild(textCol);
    if ('layoutSizingHorizontal' in textCol) textCol.layoutSizingHorizontal = 'FILL';
    const arrowT = figma.createText();
    arrowT.characters = '\u203A';
    arrowT.fontSize = 18; arrowT.fontName = { family: 'Inter', style: 'Regular' };
    arrowT.opacity = 0.35;
    row.appendChild(arrowT);
    frame.appendChild(row);
    if ('layoutSizingHorizontal' in row) row.layoutSizingHorizontal = 'FILL';
  }`
        )
        .join("\n");

  const addSettingsGroup = (items: string[]) => wireframeMode
    ? addPlaceholderRect("Settings Group", items.length * 52)
    : `
  {
    const grp = figma.createFrame();
    grp.name = 'SettingsGroup';
    grp.layoutMode = 'VERTICAL';
    grp.primaryAxisSizingMode = 'AUTO'; grp.counterAxisSizingMode = 'FIXED';
    grp.resize(frame.width - 48, 1);
    grp.cornerRadius = 12;
    grp.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    grp.strokes = [{ type: 'SOLID', color: { r: 0.92, g: 0.93, b: 0.96 } }];
    grp.strokeWeight = 1;
    ${items
      .map(
        (item, i) => `
    {
      const ri = figma.createFrame();
      ri.name = 'SettingsRow';
      ri.layoutMode = 'HORIZONTAL';
      ri.counterAxisAlignItems = 'CENTER';
      ri.primaryAxisAlignItems = 'SPACE_BETWEEN';
      ri.paddingLeft = 16; ri.paddingRight = 16;
      ri.primaryAxisSizingMode = 'FIXED'; ri.counterAxisSizingMode = 'FIXED';
      ri.resize(frame.width - 48, 52);
      ri.fills = [];
      ${i > 0 ? `ri.strokes = [{ type: 'SOLID', color: { r: 0.93, g: 0.94, b: 0.96 } }]; ri.strokeWeight = 1; ri.strokeAlign = 'INSIDE';` : ""}
      const rl = figma.createText();
      rl.characters = ${JSON.stringify(item)};
      rl.fontSize = 15; rl.fontName = { family: 'Inter', style: 'Regular' };
      ri.appendChild(rl);
      const ra = figma.createText();
      ra.characters = '\u203A';
      ra.fontSize = 18; ra.fontName = { family: 'Inter', style: 'Regular' };
      ra.opacity = 0.35;
      ri.appendChild(ra);
      grp.appendChild(ri);
      if ('layoutSizingHorizontal' in ri) ri.layoutSizingHorizontal = 'FILL';
    }`
      )
      .join("\n")}
    frame.appendChild(grp);
    if ('layoutSizingHorizontal' in grp) grp.layoutSizingHorizontal = 'FILL';
  }`;

  const addAddressForm = () => wireframeMode
    ? addPlaceholderRect("Address Form", 180)
    : `
  {
    const form = figma.createFrame();
    form.name = 'AddressForm';
    form.layoutMode = 'VERTICAL';
    form.primaryAxisSizingMode = 'AUTO'; form.counterAxisSizingMode = 'FIXED';
    form.resize(frame.width - 48, 1);
    form.itemSpacing = 12;
    form.paddingLeft = 16; form.paddingRight = 16;
    form.paddingTop = 16; form.paddingBottom = 16;
    form.cornerRadius = 12;
    form.fills = [{ type: 'SOLID', color: { r: 0.99, g: 0.99, b: 1 } }];
    form.strokes = [{ type: 'SOLID', color: { r: 0.9, g: 0.91, b: 0.94 } }];
    form.strokeWeight = 1;
    ['Street address', 'City', 'Postcode'].forEach(function(lbl) {
      const fi = figma.createFrame();
      fi.layoutMode = 'HORIZONTAL'; fi.counterAxisAlignItems = 'CENTER';
      fi.paddingLeft = 12; fi.paddingRight = 12;
      fi.primaryAxisSizingMode = 'FIXED'; fi.counterAxisSizingMode = 'FIXED';
      fi.resize(form.width - 32, 46);
      fi.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      fi.cornerRadius = 8;
      fi.strokes = [{ type: 'SOLID', color: { r: 0.87, g: 0.88, b: 0.91 } }];
      fi.strokeWeight = 1;
      const ft = figma.createText();
      ft.characters = lbl;
      ft.fontSize = 14; ft.fontName = { family: 'Inter', style: 'Regular' };
      ft.opacity = 0.5;
      fi.appendChild(ft);
      form.appendChild(fi);
      if ('layoutSizingHorizontal' in fi) fi.layoutSizingHorizontal = 'FILL';
    });
    frame.appendChild(form);
    if ('layoutSizingHorizontal' in form) form.layoutSizingHorizontal = 'FILL';
  }`;

  const addCardDetailsForm = () => wireframeMode
    ? addPlaceholderRect("Card Details", 140)
    : `
  {
    const cdf = figma.createFrame();
    cdf.name = 'CardDetails';
    cdf.layoutMode = 'VERTICAL';
    cdf.primaryAxisSizingMode = 'AUTO'; cdf.counterAxisSizingMode = 'FIXED';
    cdf.resize(frame.width - 48, 1);
    cdf.itemSpacing = 12;
    cdf.paddingLeft = 16; cdf.paddingRight = 16;
    cdf.paddingTop = 16; cdf.paddingBottom = 16;
    cdf.cornerRadius = 12;
    cdf.fills = [{ type: 'SOLID', color: { r: 0.99, g: 0.99, b: 1 } }];
    cdf.strokes = [{ type: 'SOLID', color: { r: 0.9, g: 0.91, b: 0.94 } }];
    cdf.strokeWeight = 1;
    ['Card number', 'MM / YY', 'CVV'].forEach(function(lbl) {
      const fi = figma.createFrame();
      fi.layoutMode = 'HORIZONTAL'; fi.counterAxisAlignItems = 'CENTER';
      fi.paddingLeft = 12; fi.paddingRight = 12;
      fi.primaryAxisSizingMode = 'FIXED'; fi.counterAxisSizingMode = 'FIXED';
      fi.resize(cdf.width - 32, 46);
      fi.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      fi.cornerRadius = 8;
      fi.strokes = [{ type: 'SOLID', color: { r: 0.87, g: 0.88, b: 0.91 } }];
      fi.strokeWeight = 1;
      const ft = figma.createText();
      ft.characters = lbl;
      ft.fontSize = 14; ft.fontName = { family: 'Inter', style: 'Regular' };
      ft.opacity = 0.5;
      fi.appendChild(ft);
      cdf.appendChild(fi);
      if ('layoutSizingHorizontal' in fi) fi.layoutSizingHorizontal = 'FILL';
    });
    frame.appendChild(cdf);
    if ('layoutSizingHorizontal' in cdf) cdf.layoutSizingHorizontal = 'FILL';
  }`;

  switch (template) {
    case "auth":
      return `
  ${addHeading}
  ${addSubheading}
  ${addInputField("Email", "Email address")}
  ${addInputField("Password", "Password")}
  ${addCTA}
  `;

    case "dashboard":
      return `
  ${addNavBar(sectionTitle || headerText)}
  ${addHeading}
  ${addSubheading}
  ${addStatRow()}
  ${addImageRect("Main Content", 300)}
  `;

    case "list": {
      const displayItems = listItems.length > 0 ? listItems.slice(0, 3) : ["Item One", "Item Two", "Item Three"];
      return `
  ${addHeading}
  ${addSearchBar()}
  ${addImageRect("Featured Item", 180)}
  ${addListItemRows(displayItems)}
  `;
    }

    case "detail":
      return `
  ${addImageRect("Hero Image", 240)}
  ${addHeading}
  ${addSubheading}
  ${addBodyText}
  ${addTextRows(listItems.length > 0 ? listItems : ["Key feature or detail", "Another relevant point", "Why users should care"], "Details")}
  ${addCTA}
  `;

    case "settings": {
      const settingsItems = listItems.length > 0 ? listItems : ["Notifications", "Privacy & Security", "Language", "Help & Support", "Sign out"];
      const half = Math.ceil(settingsItems.length / 2);
      return `
  ${addHeading}
  ${addSubheading}
  ${addSettingsGroup(settingsItems.slice(0, half))}
  ${addSettingsGroup(settingsItems.slice(half))}
  ${addCTA}
  `;
    }

    case "onboarding":
      return `
  ${addImageRect("Illustration", 280)}
  ${addHeading}
  ${addSubheading}
  ${addCTA}
  `;

    case "checkout-cart":
      return `
  ${addHeading}
  ${addSubheading}
  ${addSectionTitle}
  ${addImageRect("Product Hero", 160)}
  ${addTextRows(listItems, "Cart Items")}
  ${addHelperText}
  ${addTextRows(summaryItems, "Order Summary")}
  ${addCTA}
  `;

    case "checkout-address":
      return `
  ${addHeading}
  ${addSubheading}
  ${addSectionTitle}
  ${addTextRows(listItems, "Saved Addresses")}
  ${addAddressForm()}
  ${addHelperText}
  ${addCTA}
  `;

    case "checkout-shipping":
      return `
  ${addHeading}
  ${addSubheading}
  ${addSectionTitle}
  ${addTextRows(listItems, "Shipping Options")}
  ${addTextRows(summaryItems, "Delivery Summary")}
  ${addCTA}
  `;

    case "checkout-payment":
      return `
  ${addHeading}
  ${addSubheading}
  ${addSectionTitle}
  ${addTextRows(listItems, "Payment Methods")}
  ${addCardDetailsForm()}
  ${addHelperText}
  ${addCTA}
  `;

    case "checkout-review":
      return `
  ${addHeading}
  ${addSubheading}
  ${addSectionTitle}
  ${addTextRows(listItems, "Review Sections")}
  ${addTextRows(summaryItems, "Final Totals")}
  ${addHelperText}
  ${addCTA}
  `;

    case "checkout-success":
      return `
  ${addImageRect("Success Illustration", 220)}
  ${addHeading}
  ${addSubheading}
  ${addTextRows(listItems, "Confirmation Details")}
  ${addTextRows(summaryItems, "Support")}
  ${addCTA}
  `;

    default:
      return `
  ${addHeading}
  ${addSubheading}
  ${addImageRect("Content Visual", 220)}
  ${addTextRows(listItems.length > 0 ? listItems : ["Primary content area"], "Content")}
  ${addCTA}
  `;
  }
}

// ─── Prototype connection script ─────────────────────────────────────────────

function buildPrototypeScript(fromId: string, toId: string): string {
  return `
(async () => {
  const from = await figma.getNodeByIdAsync(${JSON.stringify(fromId)});
  const to = await figma.getNodeByIdAsync(${JSON.stringify(toId)});
  if (!from || !to) return { success: false };

  const existing = from.reactions || [];
  from.reactions = [
    ...existing,
    {
      trigger: { type: 'ON_CLICK' },
      action: {
        type: 'NODE',
        destinationId: ${JSON.stringify(toId)},
        navigation: 'NAVIGATE',
        transition: {
          type: 'SMART_ANIMATE',
          easing: { type: 'EASE_IN_AND_OUT' },
          duration: 0.3,
        },
        preserveScrollPosition: false,
      },
    },
  ];
  return { success: true };
})();
`.trim();
}

// ─── Flow map page ────────────────────────────────────────────────────────────

function buildFlowMapScript(screens: CreatedScreen[]): string {
  const screenData = screens.map((s, i) => ({
    id: s.frameId,
    name: s.name,
    x: i * 280,
    y: 0,
  }));

  return `
(async () => {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });

  // Create or find flow map page
  let flowPage = figma.root.children.find(p => p.name === '[Flow Map]');
  if (!flowPage) {
    flowPage = figma.createPage();
    flowPage.name = '[Flow Map]';
  }
  await figma.setCurrentPageAsync(flowPage);

  const screenData = ${JSON.stringify(screenData)};
  const createdBoxes = [];

  for (const s of screenData) {
    const box = figma.createFrame();
    box.name = s.name;
    box.resize(240, 140);
    box.x = s.x;
    box.y = 0;
    box.fills = [{ type: 'SOLID', color: { r: 0.93, g: 0.96, b: 1 } }];
    box.cornerRadius = 12;
    box.strokeWeight = 2;
    box.strokes = [{ type: 'SOLID', color: { r: 0.24, g: 0.37, b: 1 } }];

    const label = figma.createText();
    label.characters = s.name;
    label.fontSize = 14;
    label.fontName = { family: 'Inter', style: 'Bold' };
    label.x = 16;
    label.y = 16;
    box.appendChild(label);

    flowPage.appendChild(box);
    createdBoxes.push(box);
  }

  // Draw connector lines between sequential screens
  for (let i = 0; i < createdBoxes.length - 1; i++) {
    const from = createdBoxes[i];
    const to = createdBoxes[i + 1];
    const line = figma.createLine();
    line.x = from.x + from.width;
    line.y = from.y + from.height / 2;
    line.resize(to.x - (from.x + from.width), 0);
    line.strokes = [{ type: 'SOLID', color: { r: 0.24, g: 0.37, b: 1 } }];
    line.strokeWeight = 2;
    flowPage.appendChild(line);
  }

  figma.viewport.scrollAndZoomIntoView(createdBoxes);
  return { pageId: flowPage.id };
})();
`.trim();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function pageArchitectHandler(
  args: PageArchitectArgs
): Promise<PageArchitectResult> {
  const {
    productContext,
    flow,
    platform,
    width: userWidth,
    wireframeMode = false,
    includeFlowMap = false,
    contentMode,
    useStockImages = true,
    imageQuery,
  } = args;

  if (!flow) throw new Error("pageArchitect: `flow` is required.");
  if (!productContext) throw new Error("pageArchitect: `productContext` is required.");

  const bridge = await getBridge();

  // 1. Parse flow into screen specs
  const screenSpecs = parseFlowToScreens(productContext, flow, contentMode);

  if (screenSpecs.length === 0) {
    throw new Error("pageArchitect: Could not parse any screens from the flow description.");
  }

  // 1.5 Generate AI content bundle for realistic mode
  let contentBundle: ContentBundle | null = null;
  if (contentMode === "realistic") {
    try {
      contentBundle = await generateContentBundle(productContext, screenSpecs.map((s) => s.name));
    } catch (error) {
      console.warn(`pageArchitect: content bundle generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (contentBundle) {
      for (const [index, spec] of screenSpecs.entries()) {
        spec.realisticContent = applyBundleToScreen(spec.template, spec.name, contentBundle, index);
      }
    }
  }

  // 2. Load DS components for matching
  const componentSets = await bridge.getComponentSets();
  const fuse = buildFuse(componentSets);

  // 2.5 Optionally prepare imagery for image-heavy flows
  const shouldUseStockImages =
    useStockImages &&
    !wireframeMode;

  let stockImagery: ScreenImagery[] = [];
  if (shouldUseStockImages) {
    try {
      const querySource = imageQuery?.trim()
        ? imageQuery
        : contentBundle?.imageQuery
          ? contentBundle.imageQuery
          : guessImageQuery(productContext, flow);
      stockImagery = await loadStockImagery(querySource, flow, screenSpecs.length, platform === "mobile" ? "portrait" : "landscape");
    } catch (error) {
      console.warn(`pageArchitect: stock imagery lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 3. Build each screen frame
  const createdScreens: CreatedScreen[] = [];
  const frameWidth = platformWidth(platform, userWidth);
  const FRAME_GAP = 80;

  // Find rightmost existing frame so new screens don't overlap prior work
  let xOffset = 0;
  try {
    const posScript = `(async () => {
  const frames = figma.currentPage.children.filter(n =>
    n.type === 'FRAME' && !n.name.startsWith('__agent_')
  );
  const maxX = frames.reduce((max, f) => Math.max(max, f.x + f.width), 0);
  return { maxX };
})();`;
    const posResult = await bridge.execute(posScript);
    const posMax = (posResult.result as { maxX?: number })?.maxX ?? 0;
    if (posResult.success && posMax > 0) {
      xOffset = posMax + FRAME_GAP;
    }
  } catch {
    // ignore — start at 0
  }

  for (const [index, spec] of screenSpecs.entries()) {
    const resolved = resolveComponents(spec.requiredComponents, fuse);
    const assignedImage = stockImagery[index % Math.max(stockImagery.length, 1)];

    const frameSpec: FrameSpec = {
      name: spec.name,
      width: frameWidth,
      template: spec.template,
      wireframeMode,
      contentMode,
      content: spec.realisticContent,
      resolvedComponents: resolved,
      xOffset,
      purpose: spec.purpose,
      imageHash: assignedImage?.imageHash ?? null,
    };

    // Build final frame directly in a single execute call (no shimmer phase —
    // eliminates one WebSocket round-trip and prevents duplicate/overlapping frames).
    const script = buildScreenScript(frameSpec);
    const execResult = await bridge.execute(script);

    if (execResult.success && execResult.result) {
      const res = execResult.result as { frameId: string };
      if (res.frameId) {
        createdScreens.push({
          frameId: res.frameId,
          name: spec.name,
          template: spec.template,
          instantiatedComponents: resolved
            .filter((c) => c.nodeId !== null)
            .map((c) => c.name),
        });
        xOffset += frameWidth + FRAME_GAP;
      }
    } else {
      console.error(
        `pageArchitect: Failed to create frame "${spec.name}": ${execResult.error}`
      );
    }

    // If "both" platforms, also create mobile frame
    const mw = mobileWidth(platform);
    if (mw && mw !== frameWidth) {
      const mobileSpec: FrameSpec = {
        ...frameSpec,
        width: mw,
        name: `${spec.name} (Mobile)`,
        xOffset,
      };
      const mobileScript = buildScreenScript(mobileSpec);
      const mobileResult = await bridge.execute(mobileScript);
      if (mobileResult.success && mobileResult.result) {
        const res = mobileResult.result as { frameId: string };
        if (res.frameId) {
          createdScreens.push({
            frameId: res.frameId,
            name: `${spec.name} (Mobile)`,
            template: spec.template,
            instantiatedComponents: resolved
              .filter((c) => c.nodeId !== null)
              .map((c) => c.name),
          });
          xOffset += mw + FRAME_GAP;
        }
      }
    }
  }

  // 4. Wire prototype connections between consecutive screens
  const prototypeConnections: PrototypeConnection[] = [];
  const primaryScreens = createdScreens.filter((s) => !s.name.includes("(Mobile)"));

  for (let i = 0; i < primaryScreens.length - 1; i++) {
    const from = primaryScreens[i];
    const to = primaryScreens[i + 1];
    const script = buildPrototypeScript(from.frameId, to.frameId);
    const result = await bridge.execute(script);
    if (result.success) {
      prototypeConnections.push({
        fromFrameId: from.frameId,
        toFrameId: to.frameId,
        fromName: from.name,
        toName: to.name,
      });
    }
  }

  // 5. Optionally create flow map page
  let flowMapPageId: string | null = null;
  if (includeFlowMap && createdScreens.length > 0) {
    const flowScript = buildFlowMapScript(primaryScreens);
    const flowResult = await bridge.execute(flowScript);
    if (flowResult.success && flowResult.result) {
      const res = flowResult.result as { pageId: string };
      flowMapPageId = res.pageId;
    }
  }

  // 6. Log the decision
  const logEntry = await decisionLog.log({
    tool: "page-architect",
    nodeIds: createdScreens.map((s) => s.frameId),
    rationale: `Built ${createdScreens.length} screen frame(s) for flow: "${flow.slice(0, 100)}". Platform: ${platform}. Content: ${contentMode}. AI content bundle: ${!!contentBundle}. Wireframe: ${wireframeMode}. Prototype connections: ${prototypeConnections.length}. Flow map: ${!!flowMapPageId}.`,
    tokens: [],
    reversible: true,
      metadata: {
      productContext,
      platform,
      wireframeMode,
      contentMode,
      useStockImages: shouldUseStockImages,
      stockImageCount: stockImagery.length,
      stockImageSources: stockImagery.map((item) => item.sourceUrl),
      includeFlowMap,
      screenCount: createdScreens.length,
      prototypeConnectionCount: prototypeConnections.length,
      flowMapPageId,
    },
  });

  // 7. Navigate viewport to the first created screen so the user lands there
  const primaryScreens2 = createdScreens.filter((s) => !s.name.includes("(Mobile)"));
  if (primaryScreens2.length > 0) {
    try {
      await bridge.navigate(primaryScreens2[0].frameId);
    } catch {
      // Non-critical navigation error — ignore
    }
  }

  return {
    screens: createdScreens,
    prototypeConnections,
    flowMapPageId,
    frameIds: createdScreens.map((s) => s.frameId),
    prototypeConnectionCount: prototypeConnections.length,
    logEntryId: logEntry.id,
  };
}
