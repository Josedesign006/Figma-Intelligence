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
type ScreenTemplate = "auth" | "dashboard" | "list" | "detail" | "settings" | "onboarding" | "checkout-cart" | "checkout-address" | "checkout-shipping" | "checkout-payment" | "checkout-review" | "checkout-success" | "generic";
export declare function pageArchitectHandler(args: PageArchitectArgs): Promise<PageArchitectResult>;
export {};
//# sourceMappingURL=index.d.ts.map