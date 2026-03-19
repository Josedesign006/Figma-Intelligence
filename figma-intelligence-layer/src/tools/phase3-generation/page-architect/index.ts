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
    components: ["TextInput", "Button", "Heading", "Link"],
    layoutPattern: "Centered single-column with email + password inputs and primary CTA",
  },
  {
    template: "dashboard",
    keywords: ["dashboard", "home", "overview", "main", "hub"],
    components: ["Navigation", "Header", "Card", "Chart", "Badge"],
    layoutPattern: "Sidebar nav + top header + main content grid",
  },
  {
    template: "list",
    keywords: ["list", "feed", "search", "browse", "explore", "results", "index", "directory"],
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

function mobileWidth(platform: "web" | "mobile" | "both"): number | null {
  return platform === "both" ? 390 : null;
}

// ─── Parse flow into screen specs (template matching) ────────────────────────

function parseFlowToScreens(
  productContext: string,
  flow: string,
  contentMode: "placeholder" | "realistic"
): ScreenSpec[] {
  const screenNames = flow
    .split(/[,\n→>]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.length < 60)
    .slice(0, 8);

  const parsed = screenNames.map((name) => ({
    name: name.replace(/\s+/g, ""),
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

  const componentInstances = resolvedComponents
    .filter((c) => c.nodeId !== null)
    .map(
      (c) => `
  {
    const comp = await figma.getNodeByIdAsync(${JSON.stringify(c.nodeId)});
    if (comp && comp.type === 'COMPONENT') {
      const inst = comp.createInstance();
      inst.name = ${JSON.stringify(c.name)};
      if ('layoutSizingHorizontal' in inst) inst.layoutSizingHorizontal = 'FILL';
      frame.appendChild(inst);
    }
  }`
    )
    .join("\n");

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
    helperText
  );

  return `
(async () => {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
  await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });

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

  ${componentInstances}

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
  helperText?: string
): string {
  const rectColor = wireframeMode
    ? "{ r: 0.88, g: 0.88, b: 0.88 }"
    : "{ r: 0.94, g: 0.95, b: 1 }";

  const addHeading = `
  const heading = figma.createText();
  heading.characters = ${JSON.stringify(headerText)};
  heading.fontSize = 28;
  heading.fontName = { family: 'Inter', style: 'Bold' };
  if ('layoutSizingHorizontal' in heading) heading.layoutSizingHorizontal = 'FILL';
  frame.appendChild(heading);`;

  const addSubheading = subText
    ? `
  const subheading = figma.createText();
  subheading.characters = ${JSON.stringify(subText.slice(0, 140))};
  subheading.fontSize = 16;
  subheading.fontName = { family: 'Inter', style: 'Regular' };
  subheading.opacity = 0.65;
  if ('layoutSizingHorizontal' in subheading) subheading.layoutSizingHorizontal = 'FILL';
  frame.appendChild(subheading);`
    : "";

  const addSectionTitle = sectionTitle
    ? `
  const sectionTitleNode = figma.createText();
  sectionTitleNode.characters = ${JSON.stringify(sectionTitle)};
  sectionTitleNode.fontSize = 14;
  sectionTitleNode.fontName = { family: 'Inter', style: 'Bold' };
  sectionTitleNode.opacity = 0.8;
  if ('layoutSizingHorizontal' in sectionTitleNode) sectionTitleNode.layoutSizingHorizontal = 'FILL';
  frame.appendChild(sectionTitleNode);`
    : "";

  const addBodyText = bodyText
    ? `
  const bodyNode = figma.createText();
  bodyNode.characters = ${JSON.stringify(bodyText.slice(0, 180))};
  bodyNode.fontSize = 15;
  bodyNode.fontName = { family: 'Inter', style: 'Regular' };
  bodyNode.opacity = 0.75;
  if ('layoutSizingHorizontal' in bodyNode) bodyNode.layoutSizingHorizontal = 'FILL';
  frame.appendChild(bodyNode);`
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
    if ('layoutSizingHorizontal' in group) group.layoutSizingHorizontal = 'FILL';
    ${
      rows
        .map(
          (row) => `
    {
      const t = figma.createText();
      t.characters = ${JSON.stringify(row)};
      t.fontSize = 15;
      t.fontName = { family: 'Inter', style: 'Regular' };
      if ('layoutSizingHorizontal' in t) t.layoutSizingHorizontal = 'FILL';
      group.appendChild(t);
    }`
        )
        .join("\n")
    }
    frame.appendChild(group);
  }`;
  };

  const addHelperText = helperText
    ? `
  const helperNode = figma.createText();
  helperNode.characters = ${JSON.stringify(helperText.slice(0, 180))};
  helperNode.fontSize = 13;
  helperNode.fontName = { family: 'Inter', style: 'Regular' };
  helperNode.opacity = 0.6;
  if ('layoutSizingHorizontal' in helperNode) helperNode.layoutSizingHorizontal = 'FILL';
  frame.appendChild(helperNode);`
    : "";

  const addPlaceholderRect = (label: string, height: number) => `
  {
    const r = figma.createRectangle();
    r.name = ${JSON.stringify(label)};
    r.resize(frame.width - 48, ${height});
    r.fills = [{ type: 'SOLID', color: ${rectColor} }];
    r.cornerRadius = 8;
    if ('layoutSizingHorizontal' in r) r.layoutSizingHorizontal = 'FILL';
    frame.appendChild(r);
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
    if ('layoutSizingHorizontal' in r) r.layoutSizingHorizontal = 'FILL';
    frame.appendChild(r);
  }`;

  const addCTA = `
  {
    const btn = figma.createFrame();
    btn.name = 'CTA';
    btn.resize(frame.width - 48, 48);
    btn.layoutMode = 'HORIZONTAL';
    btn.primaryAxisAlignItems = 'CENTER';
    btn.counterAxisAlignItems = 'CENTER';
    btn.fills = [{ type: 'SOLID', color: { r: 0.24, g: 0.37, b: 1 } }];
    btn.cornerRadius = 8;
    if ('layoutSizingHorizontal' in btn) btn.layoutSizingHorizontal = 'FILL';
    const btnLabel = figma.createText();
    btnLabel.characters = ${JSON.stringify(ctaText)};
    btnLabel.fontSize = 16;
    btnLabel.fontName = { family: 'Inter', style: 'Medium' };
    btnLabel.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    btn.appendChild(btnLabel);
    frame.appendChild(btn);
  }`;

  switch (template) {
    case "auth":
      return `
  ${addHeading}
  ${addSubheading}
  ${addPlaceholderRect("Email Input", 48)}
  ${addPlaceholderRect("Password Input", 48)}
  ${addCTA}
  `;

    case "dashboard":
      return `
  ${addPlaceholderRect("Top Navigation", 56)}
  ${addHeading}
  ${addPlaceholderRect("Stats Row", 96)}
  ${addPlaceholderRect("Main Content", 320)}
  `;

    case "list":
      return `
  ${addHeading}
  ${addPlaceholderRect("Search Bar", 48)}
  ${addPlaceholderRect("List Item", 72)}
  ${addPlaceholderRect("List Item", 72)}
  ${addPlaceholderRect("List Item", 72)}
  ${addPlaceholderRect("List Item", 72)}
  `;

    case "detail":
      return `
  ${addImageRect("Hero Image", 240)}
  ${addHeading}
  ${addSubheading}
  ${addBodyText}
  ${addPlaceholderRect("Content Body", 180)}
  ${addCTA}
  `;

    case "settings":
      return `
  ${addHeading}
  ${addPlaceholderRect("Section Group 1", 140)}
  ${addPlaceholderRect("Section Group 2", 140)}
  ${addCTA}
  `;

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
  ${addPlaceholderRect("Address Form", 180)}
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
  ${addPlaceholderRect("Card Details", 140)}
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
  ${imageHash ? addImageRect("Content Visual", 220) : ""}
  ${addPlaceholderRect("Content Area", 300)}
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

  // 2. Load DS components for matching
  const componentSets = await bridge.getComponentSets();
  const fuse = buildFuse(componentSets);

  // 2.5 Optionally prepare imagery for image-heavy flows
  const shouldUseStockImages =
    useStockImages &&
    !wireframeMode &&
    contentMode === "realistic" &&
    isImageHeavyContext(productContext, flow);

  let stockImagery: ScreenImagery[] = [];
  if (shouldUseStockImages) {
    try {
      const querySource = imageQuery?.trim() ? imageQuery : guessImageQuery(productContext, flow);
      stockImagery = await loadStockImagery(querySource, flow, screenSpecs.length, platform === "mobile" ? "portrait" : "landscape");
    } catch (error) {
      console.warn(`pageArchitect: stock imagery lookup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 3. Build each screen frame
  const createdScreens: CreatedScreen[] = [];
  const frameWidth = platformWidth(platform, userWidth);
  const FRAME_GAP = 80;
  let xOffset = 0;

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

    const script = buildScreenScript(frameSpec);
    const execResult = await bridge.execute(script);

    if (execResult.success && execResult.result) {
      const res = execResult.result as { frameId: string };
      createdScreens.push({
        frameId: res.frameId,
        name: spec.name,
        template: spec.template,
        instantiatedComponents: resolved
          .filter((c) => c.nodeId !== null)
          .map((c) => c.name),
      });
      xOffset += frameWidth + FRAME_GAP;
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
    rationale: `Built ${createdScreens.length} screen frame(s) for flow: "${flow.slice(0, 100)}". Platform: ${platform}. Content: ${contentMode}. Wireframe: ${wireframeMode}. Prototype connections: ${prototypeConnections.length}. Flow map: ${!!flowMapPageId}.`,
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

  return {
    screens: createdScreens,
    prototypeConnections,
    flowMapPageId,
    frameIds: createdScreens.map((s) => s.frameId),
    prototypeConnectionCount: prototypeConnections.length,
    logEntryId: logEntry.id,
  };
}
