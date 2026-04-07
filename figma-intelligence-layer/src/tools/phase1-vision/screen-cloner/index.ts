import fs from "fs/promises";
// Lazy-load sharp — it's a native module that may not be available in bundled environments
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharp: any;
try {
  sharp = require("sharp");
} catch {
  // sharp unavailable — screen-cloner crop/resize will fail gracefully
}
import { VisionClient } from "../../../shared/vision-client.js";
import { getBridge } from "../../../shared/figma-bridge.js";
import { getDesignSystemContextStore, DSComponentSet } from "../../../shared/design-system-context.js";
import { decisionLog } from "../../../shared/decision-log.js";
import {
  manifestToDSMatchRequest,
  matchComponentInContext,
} from "../../../shared/design-system-matcher.js";
import {
  ComponentSet,
  LayoutNode,
  LayoutNodeAlignment,
  ComponentManifest,
} from "../../../shared/types.js";
import { resolveFontStyleMatch, FontStyleMatch } from "./font-matcher.js";
import { resolveIconComponentMatch, IconComponentMatch } from "./icon-resolver.js";
import { searchIcons } from "../../../shared/icon-catalog.js";

export interface ScreenClonerArgs {
  image: string;
  cloneMode: "pixel" | "system" | "adaptive";
  frameWidth?: number;
  targetPage?: string;
  annotateUnmatched?: boolean;
}

export interface ScreenClonerResult {
  frameId: string;
  cloneMode: string;
  zones: number;
  matched: number;
  unmatched: number;
  unmatchedComponents: string[];
  tokenCoverage: string;
  generatedFrame: { nodeId: string };
}

const CONFIDENCE_THRESHOLD = 0.75;

interface ZoneMatch {
  node: LayoutNode;
  manifest: ComponentManifest;
  dsComponent: DSComponentSet | null;
  confidence: number;
  renderStrategy?: "ds" | "text" | "icon" | "crop";
  fontStyleMatch?: FontStyleMatch | null;
  iconComponentMatch?: IconComponentMatch | null;
  openSourceIconSvg?: string | null;
  fallbackImageHash?: string;
  fallbackHeight?: number;
  fallbackWidth?: number;
}

interface ResolvedLayoutNode {
  node: LayoutNode;
  children: ResolvedLayoutNode[];
  match?: ZoneMatch;
}

interface SerializedLayoutNode {
  id: string;
  label: string;
  layoutType: LayoutNode["layoutType"];
  x: number;
  y: number;
  width: number;
  height: number;
  relativeX: number;
  relativeY: number;
  absolute: boolean;
  layout: LayoutNodeAlignment;
  repetition?: LayoutNode["repetition"];
  siblingHints?: LayoutNode["siblingHints"];
  children: SerializedLayoutNode[];
  renderStrategy?: ZoneMatch["renderStrategy"] | "container";
  dsId?: string | null;
  dsName?: string | null;
  textContent?: string | null;
  fontFamily?: string | null;
  fontStyle?: string | null;
  fontSize?: number | null;
  lineHeightPx?: number | null;
  iconNodeId?: string | null;
  iconName?: string | null;
  openSourceIconSvg?: string | null;
  fallbackImageHash?: string | null;
}

interface ImageDimensions {
  width: number;
  height: number;
}

export async function imageBufferToPngDataUri(buffer: Buffer): Promise<string> {
  const normalizedBuffer = await sharp(buffer).png().toBuffer();
  return `data:image/png;base64,${normalizedBuffer.toString("base64")}`;
}

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function snapToGrid(value: number, grid = 4, minimum = 1): number {
  return Math.max(minimum, Math.round(value / grid) * grid);
}

export async function resolveImage(image: string): Promise<string> {
  if (image.startsWith("data:image")) {
    const base64 = image.replace(/^data:image\/[^;]+;base64,/, "");
    return imageBufferToPngDataUri(Buffer.from(base64, "base64"));
  }

  if (image.startsWith("http://") || image.startsWith("https://")) {
    const response = await fetch(image);
    if (!response.ok) {
      throw new Error(`screenClonerHandler: Failed to fetch image URL (${response.status})`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    return imageBufferToPngDataUri(bytes);
  }

  const buf = await fs.readFile(image);
  return imageBufferToPngDataUri(buf);
}

async function getImageDimensions(image: string): Promise<ImageDimensions> {
  const base64 = image.replace(/^data:image\/\w+;base64,/, "");
  const metadata = await sharp(Buffer.from(base64, "base64")).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("screenClonerHandler: Unable to determine source image dimensions");
  }

  return { width: metadata.width, height: metadata.height };
}

function pctToPx(value: number, total: number): number {
  return Math.round((clampPercentage(value) / 100) * total);
}

function normalizeIconName(value: string | undefined): string | null {
  if (!value) return null;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) return null;

  // Try catalog search for alias resolution (e.g. "hamburger" → "menu")
  const catalogResult = searchIcons(normalized, { limit: 1 });
  if (catalogResult.length > 0) {
    // Extract the Iconify slug from the catalog entry
    const iconifyId = catalogResult[0].iconifyId;
    const slug = iconifyId.split(":").pop();
    if (slug) return slug;
  }

  return normalized;
}

async function fetchOpenSourceIconSvg(manifest: ComponentManifest): Promise<string | null> {
  if (!manifest.iconPresent) return null;

  const requestedLibrary = (manifest.preferredIconLibrary ?? "").trim().toLowerCase();
  const iconName = normalizeIconName(manifest.openSourceIconName ?? manifest.iconName);
  if (!iconName) return null;

  // Resolve library: catalog entries use their own iconifyId prefix,
  // fall back to requested library or material-symbols
  const catalogResult = searchIcons(iconName, { limit: 1 });
  let prefix: string;
  let slug: string;

  if (catalogResult.length > 0 && requestedLibrary !== "simple-icons") {
    const parts = catalogResult[0].iconifyId.split(":");
    prefix = parts[0];
    slug = parts[1] ?? iconName;
  } else {
    prefix = requestedLibrary === "simple-icons" ? "simple-icons" : "material-symbols";
    slug = iconName;
  }

  const url = `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(slug)}.svg`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function extractZoneFallbackImage(
  image: string,
  node: LayoutNode,
  sourceDimensions: ImageDimensions
): Promise<{ imageDataUri: string; cropWidth: number; cropHeight: number }> {
  const base64 = image.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");

  const left = Math.max(
    0,
    Math.min(
      sourceDimensions.width - 1,
      Math.round((clampPercentage(node.boundingBox.x) / 100) * sourceDimensions.width)
    )
  );
  const top = Math.max(
    0,
    Math.min(
      sourceDimensions.height - 1,
      Math.round((clampPercentage(node.boundingBox.y) / 100) * sourceDimensions.height)
    )
  );
  const width = Math.max(
    1,
    Math.min(
      sourceDimensions.width - left,
      Math.round((clampPercentage(node.boundingBox.width) / 100) * sourceDimensions.width)
    )
  );
  const height = Math.max(
    1,
    Math.min(
      sourceDimensions.height - top,
      Math.round((clampPercentage(node.boundingBox.height) / 100) * sourceDimensions.height)
    )
  );

  const cropped = await sharp(buffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();

  return {
    imageDataUri: `data:image/png;base64,${cropped.toString("base64")}`,
    cropWidth: width,
    cropHeight: height,
  };
}

async function populateFallbackCrop(
  bridge: Awaited<ReturnType<typeof getBridge>>,
  image: string,
  match: ZoneMatch,
  sourceDimensions: ImageDimensions,
  frameWidth: number
): Promise<void> {
  const fallback = await extractZoneFallbackImage(image, match.node, sourceDimensions);
  const importedFallback = await bridge.importImage(fallback.imageDataUri);

  match.fallbackImageHash = importedFallback.imageHash;
  match.fallbackHeight = snapToGrid(
    Math.max(1, Math.round((frameWidth * fallback.cropHeight) / fallback.cropWidth))
  );
  match.fallbackWidth = snapToGrid(
    Math.max(16, Math.round((frameWidth * fallback.cropWidth) / sourceDimensions.width))
  );
}

function flattenLeafNodes(nodes: LayoutNode[]): LayoutNode[] {
  return nodes.flatMap((node) =>
    node.children && node.children.length > 0 ? flattenLeafNodes(node.children) : [node]
  );
}

function countNodes(nodes: LayoutNode[]): number {
  return nodes.reduce(
    (sum, node) => sum + 1 + (node.children ? countNodes(node.children) : 0),
    0
  );
}

function inferDirection(children: LayoutNode[]): "horizontal" | "vertical" | "none" {
  if (children.length < 2) return "none";

  const xSpread =
    Math.max(...children.map((child) => child.boundingBox.x + child.boundingBox.width / 2)) -
    Math.min(...children.map((child) => child.boundingBox.x + child.boundingBox.width / 2));
  const ySpread =
    Math.max(...children.map((child) => child.boundingBox.y + child.boundingBox.height / 2)) -
    Math.min(...children.map((child) => child.boundingBox.y + child.boundingBox.height / 2));

  return xSpread > ySpread ? "horizontal" : "vertical";
}

function averageGap(children: LayoutNode[], direction: "horizontal" | "vertical" | "none"): number {
  if (children.length < 2 || direction === "none") return 0;

  const ordered = [...children].sort((a, b) =>
    direction === "horizontal"
      ? a.boundingBox.x - b.boundingBox.x
      : a.boundingBox.y - b.boundingBox.y
  );

  const gaps = ordered
    .slice(1)
    .map((child, index) =>
      direction === "horizontal"
        ? child.boundingBox.x - (ordered[index].boundingBox.x + ordered[index].boundingBox.width)
        : child.boundingBox.y - (ordered[index].boundingBox.y + ordered[index].boundingBox.height)
    )
    .filter((gap) => Number.isFinite(gap) && gap >= 0);

  if (gaps.length === 0) return 0;
  return Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
}

function inferPadding(node: LayoutNode): LayoutNodeAlignment["padding"] | undefined {
  if (!node.children || node.children.length === 0) return undefined;

  const left = Math.max(
    0,
    Math.min(...node.children.map((child) => child.boundingBox.x - node.boundingBox.x))
  );
  const top = Math.max(
    0,
    Math.min(...node.children.map((child) => child.boundingBox.y - node.boundingBox.y))
  );
  const right = Math.max(
    0,
    Math.min(
      ...node.children.map(
        (child) =>
          node.boundingBox.x +
          node.boundingBox.width -
          (child.boundingBox.x + child.boundingBox.width)
      )
    )
  );
  const bottom = Math.max(
    0,
    Math.min(
      ...node.children.map(
        (child) =>
          node.boundingBox.y +
          node.boundingBox.height -
          (child.boundingBox.y + child.boundingBox.height)
      )
    )
  );

  return { top, right, bottom, left };
}

function defaultGapForType(layoutType: LayoutNode["layoutType"]): number {
  switch (layoutType) {
    case "header":
    case "toolbar":
    case "button-group":
    case "tab-bar":
      return 12;
    case "table":
    case "list":
    case "content":
    case "section":
      return 16;
    case "table-row":
    case "list-item":
    case "form-row":
      return 8;
    case "card":
    case "drawer":
    case "modal":
    case "form":
      return 16;
    default:
      return 12;
  }
}

function defaultPaddingForType(layoutType: LayoutNode["layoutType"]): NonNullable<LayoutNodeAlignment["padding"]> {
  switch (layoutType) {
    case "header":
    case "toolbar":
      return { top: 12, right: 16, bottom: 12, left: 16 };
    case "sidebar":
      return { top: 20, right: 16, bottom: 20, left: 16 };
    case "card":
    case "drawer":
    case "modal":
    case "form":
      return { top: 16, right: 16, bottom: 16, left: 16 };
    case "table":
    case "list":
    case "section":
    case "content":
      return { top: 12, right: 12, bottom: 12, left: 12 };
    default:
      return { top: 8, right: 8, bottom: 8, left: 8 };
  }
}

function defaultCrossAlignment(
  layoutType: LayoutNode["layoutType"],
  direction: "horizontal" | "vertical" | "none"
): NonNullable<LayoutNodeAlignment["crossAlignment"]> {
  if (direction === "vertical") return "stretch";
  if (layoutType === "header" || layoutType === "toolbar" || layoutType === "tab-bar" || layoutType === "button-group") {
    return "center";
  }
  return "stretch";
}

function enrichLayout(node: LayoutNode): LayoutNode {
  const children = node.children?.map(enrichLayout);
  const direction =
    node.layout?.direction ??
    node.repetition?.repeatAxis ??
    (children && children.length > 1 ? inferDirection(children) : "none");
  const inferredGap = children ? averageGap(children, direction) : 0;
  const gap = node.layout?.gap ?? (inferredGap > 0 ? inferredGap : defaultGapForType(node.layoutType));
  const padding = node.layout?.padding ?? inferPadding({ ...node, children }) ?? defaultPaddingForType(node.layoutType);

  return {
    ...node,
    children,
    layout: {
      direction,
      distribution: node.layout?.distribution ?? "start",
      crossAlignment: node.layout?.crossAlignment ?? defaultCrossAlignment(node.layoutType, direction),
      gap,
      padding,
      columns: node.layout?.columns,
      stackingOrder:
        node.layout?.stackingOrder ??
        (node.siblingHints?.overlay || node.layoutType === "overlay" ? "overlay" : "normal"),
    },
  };
}

function ensurePageRoot(nodes: LayoutNode[]): LayoutNode[] {
  if (nodes.length === 1 && nodes[0].layoutType === "page") {
    return [enrichLayout(nodes[0])];
  }

  const wrapped: LayoutNode = {
    id: "page-root",
    label: "Page",
    layoutType: "page",
    boundingBox: { x: 0, y: 0, width: 100, height: 100 },
    childCount: nodes.length,
    children: nodes,
  };

  return [enrichLayout(wrapped)];
}

function buildResolvedTree(nodes: LayoutNode[], matchesById: Map<string, ZoneMatch>): ResolvedLayoutNode[] {
  return nodes.map((node) => ({
    node,
    match: matchesById.get(node.id),
    children: buildResolvedTree(node.children ?? [], matchesById),
  }));
}

function sortResolvedChildren(
  children: ResolvedLayoutNode[],
  direction: "horizontal" | "vertical" | "none"
): ResolvedLayoutNode[] {
  if (direction === "horizontal") {
    return [...children].sort((a, b) => a.node.boundingBox.x - b.node.boundingBox.x);
  }
  return [...children].sort((a, b) => a.node.boundingBox.y - b.node.boundingBox.y);
}

function serializeResolvedTree(
  nodes: ResolvedLayoutNode[],
  frameWidth: number,
  frameHeight: number,
  parentNode?: LayoutNode
): SerializedLayoutNode[] {
  return nodes.map((resolved) => {
    const { node, match } = resolved;
    const direction = node.layout?.direction ?? "none";
    const sortedChildren = sortResolvedChildren(resolved.children, direction);
    const absolute =
      node.siblingHints?.overlay === true ||
      node.layout?.stackingOrder === "overlay" ||
      node.layoutType === "overlay" ||
      node.layoutType === "modal";

    const x = snapToGrid(pctToPx(node.boundingBox.x, frameWidth));
    const y = snapToGrid(pctToPx(node.boundingBox.y, frameHeight));
    const width = snapToGrid(pctToPx(node.boundingBox.width, frameWidth));
    const height = snapToGrid(pctToPx(node.boundingBox.height, frameHeight));
    const relativeX = parentNode
      ? snapToGrid(
          pctToPx(node.boundingBox.x, frameWidth) - pctToPx(parentNode.boundingBox.x, frameWidth)
        )
      : x;
    const relativeY = parentNode
      ? snapToGrid(
          pctToPx(node.boundingBox.y, frameHeight) - pctToPx(parentNode.boundingBox.y, frameHeight)
        )
      : y;

    return {
      id: node.id,
      label: node.label,
      layoutType: node.layoutType,
      x,
      y,
      width,
      height,
      relativeX,
      relativeY,
      absolute,
      layout: {
        direction: node.layout?.direction ?? "none",
        distribution: node.layout?.distribution ?? "start",
        crossAlignment: node.layout?.crossAlignment ?? "start",
        gap: node.layout?.gap ?? 0,
        padding: node.layout?.padding,
        columns: node.layout?.columns,
        stackingOrder: node.layout?.stackingOrder ?? "normal",
      },
      repetition: node.repetition,
      siblingHints: node.siblingHints,
      children: serializeResolvedTree(sortedChildren, frameWidth, frameHeight, node),
      renderStrategy:
        sortedChildren.length > 0 ? "container" : match?.renderStrategy ?? "crop",
      dsId: match?.dsComponent ? match.dsComponent.childComponentIds[0] ?? null : null,
      dsName: match?.dsComponent ? match.dsComponent.name : null,
      textContent: match?.manifest.textContent ?? null,
      fontFamily: match?.fontStyleMatch?.fontFamily ?? null,
      fontStyle: match?.fontStyleMatch?.fontStyle ?? null,
      fontSize: match?.fontStyleMatch?.fontSize ?? null,
      lineHeightPx: match?.fontStyleMatch?.lineHeightPx ?? null,
      iconNodeId: match?.iconComponentMatch?.nodeId ?? null,
      iconName: match?.iconComponentMatch?.name ?? null,
      openSourceIconSvg: match?.openSourceIconSvg ?? null,
      fallbackImageHash: match?.fallbackImageHash ?? null,
    };
  });
}

function buildFrameScript(
  frameWidth: number,
  frameHeight: number,
  tree: SerializedLayoutNode[],
  frameName: string,
  targetPage: string | undefined,
  annotateUnmatched: boolean
): string {
  return `
  const frameWidth = ${frameWidth};
  const frameHeight = ${frameHeight};
  const frameName = ${JSON.stringify(frameName)};
  const targetPageName = ${JSON.stringify(targetPage ?? null)};
  const annotateUnmatched = ${annotateUnmatched};
  const tree = ${JSON.stringify(tree)};

  function clampSize(value) {
    return Math.max(1, Math.round(value));
  }

  function toLayoutMode(direction) {
    if (direction === "horizontal") return "HORIZONTAL";
    if (direction === "vertical") return "VERTICAL";
    return "NONE";
  }

  function toPrimaryAlign(distribution) {
    if (distribution === "center") return "CENTER";
    if (distribution === "end") return "MAX";
    if (distribution === "space-between") return "SPACE_BETWEEN";
    return "MIN";
  }

  function toCounterAlign(crossAlignment) {
    if (crossAlignment === "center") return "CENTER";
    if (crossAlignment === "end") return "MAX";
    return "MIN";
  }

  function sanitizePadding(padding) {
    return {
      top: clampSize(padding?.top ?? 0),
      right: clampSize(padding?.right ?? 0),
      bottom: clampSize(padding?.bottom ?? 0),
      left: clampSize(padding?.left ?? 0),
    };
  }

  function styleWrapper(wrapper, node) {
    wrapper.name = node.label;
    wrapper.resize(clampSize(node.width), clampSize(node.height));
    wrapper.strokes = [];
    wrapper.clipsContent = false;

    if (node.layoutType === "page") {
      wrapper.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    } else if (node.layoutType === "card" || node.layoutType === "modal" || node.layoutType === "drawer") {
      wrapper.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    } else {
      wrapper.fills = [];
    }

    const layoutMode = toLayoutMode(node.layout?.direction);
    wrapper.layoutMode = layoutMode;
    if (layoutMode !== "NONE") {
      const padding = sanitizePadding(node.layout?.padding);
      wrapper.primaryAxisSizingMode = "FIXED";
      wrapper.counterAxisSizingMode = "FIXED";
      wrapper.itemSpacing = clampSize(node.layout?.gap ?? 0);
      wrapper.paddingTop = padding.top;
      wrapper.paddingRight = padding.right;
      wrapper.paddingBottom = padding.bottom;
      wrapper.paddingLeft = padding.left;
      wrapper.primaryAxisAlignItems = toPrimaryAlign(node.layout?.distribution);
      wrapper.counterAxisAlignItems = toCounterAlign(node.layout?.crossAlignment);
    }
  }

  async function renderLeafContent(wrapper, node) {
    if (node.renderStrategy === "ds" && node.dsId) {
      const mainComp = await figma.getNodeByIdAsync(node.dsId);
      if (mainComp && mainComp.type === "COMPONENT") {
        const inst = mainComp.createInstance();
        inst.name = node.dsName || node.label;
        if ("layoutSizingHorizontal" in inst) inst.layoutSizingHorizontal = "FILL";
        if ("layoutSizingVertical" in inst) inst.layoutSizingVertical = "FILL";
        if ("resize" in inst) {
          try {
            inst.resize(clampSize(node.width), clampSize(node.height));
          } catch {}
        }
        wrapper.appendChild(inst);
        return true;
      }
    }

    if (node.renderStrategy === "text" && node.textContent && node.fontFamily && node.fontStyle && node.fontSize) {
      const text = figma.createText();
      let font = { family: node.fontFamily, style: node.fontStyle };
      try {
        await figma.loadFontAsync(font);
      } catch {
        font = { family: "Inter", style: "Regular" };
        await figma.loadFontAsync(font);
      }
      text.name = "Resolved text: " + node.label;
      text.fontName = font;
      text.fontSize = node.fontSize;
      if (node.lineHeightPx) {
        text.lineHeight = { unit: "PIXELS", value: node.lineHeightPx };
      }
      text.characters = node.textContent;
      text.fills = [{ type: "SOLID", color: { r: 0.12, g: 0.12, b: 0.12 } }];
      text.textAutoResize = "HEIGHT";
      text.x = 0;
      text.y = 0;
      wrapper.appendChild(text);
      return true;
    }

    if (node.renderStrategy === "icon" && node.openSourceIconSvg) {
      wrapper.layoutMode = "HORIZONTAL";
      wrapper.primaryAxisAlignItems = "CENTER";
      wrapper.counterAxisAlignItems = "CENTER";

      const iconNode = figma.createNodeFromSvg(node.openSourceIconSvg);
      const iconSize = Math.max(16, Math.min(node.width, node.height));
      if ("resize" in iconNode) {
        try {
          iconNode.resize(iconSize, iconSize);
        } catch {}
      }
      wrapper.appendChild(iconNode);
      return true;
    }

    if (node.renderStrategy === "icon" && node.iconNodeId) {
      const iconNode = await figma.getNodeByIdAsync(node.iconNodeId);
      if (iconNode && (iconNode.type === "COMPONENT" || iconNode.type === "COMPONENT_SET")) {
        const target = iconNode.type === "COMPONENT_SET" ? iconNode.children[0] : iconNode;
        if (target && target.type === "COMPONENT") {
          wrapper.layoutMode = "HORIZONTAL";
          wrapper.primaryAxisAlignItems = "CENTER";
          wrapper.counterAxisAlignItems = "CENTER";

          const inst = target.createInstance();
          const iconSize = Math.max(16, Math.min(node.width, node.height));
          if ("resize" in inst) {
            inst.resize(iconSize, iconSize);
          }
          wrapper.appendChild(inst);
          return true;
        }
      }
    }

    const rect = figma.createRectangle();
    rect.name = "Unmatched: " + node.label;
    rect.resize(clampSize(node.width), clampSize(node.height));
    rect.strokes = [];

    if (node.fallbackImageHash) {
      rect.fills = [{
        type: "IMAGE",
        imageHash: node.fallbackImageHash,
        scaleMode: "FILL",
      }];
    } else {
      rect.fills = [{ type: "SOLID", color: { r: 1, g: 0.6, b: 0.2 }, opacity: 0.25 }];
      rect.strokes = [{ type: "SOLID", color: { r: 1, g: 0.4, b: 0 } }];
      rect.strokeWeight = 2;
      rect.dashPattern = [6, 4];
    }

    wrapper.appendChild(rect);
    return false;
  }

  async function buildNode(node, parent, pageForStickies) {
    const wrapper = figma.createFrame();
    styleWrapper(wrapper, node);
    parent.appendChild(wrapper);

    if (parent.layoutMode !== "NONE" && node.absolute && "layoutPositioning" in wrapper) {
      wrapper.layoutPositioning = "ABSOLUTE";
      wrapper.x = node.relativeX;
      wrapper.y = node.relativeY;
    } else if (parent.layoutMode === "NONE") {
      wrapper.x = node.relativeX;
      wrapper.y = node.relativeY;
    } else {
      if ("layoutSizingHorizontal" in wrapper) {
        wrapper.layoutSizingHorizontal =
          parent.layoutMode === "VERTICAL" || node.layout?.crossAlignment === "stretch"
            ? "FILL"
            : "FIXED";
      }
      if ("layoutSizingVertical" in wrapper) {
        wrapper.layoutSizingVertical =
          parent.layoutMode === "HORIZONTAL" && node.layoutType !== "table-row" && node.layoutType !== "list-item"
            ? "FILL"
            : "FIXED";
      }
    }

    if (node.children.length > 0) {
      for (const child of node.children) {
        await buildNode(child, wrapper, pageForStickies);
      }
      return wrapper;
    }

    const resolved = await renderLeafContent(wrapper, node);
    if (!resolved && annotateUnmatched) {
      const sticky = figma.createSticky();
      const repeated = node.repetition?.isRepeated ? "\\nRepeated pattern: " + (node.repetition.pattern || "yes") : "";
      sticky.text.characters = "No DS match for: " + node.label + " (type: " + node.layoutType + ")" + repeated;
      sticky.x = frame.x + frameWidth + 24;
      sticky.y = frame.y + node.y;
      pageForStickies.appendChild(sticky);
    }

    return wrapper;
  }

  let targetPage = figma.currentPage;
  if (targetPageName) {
    const found = figma.root.children.find((p) => p.name === targetPageName);
    if (found) {
      await figma.setCurrentPageAsync(found);
      targetPage = found;
    }
  }

  const frame = figma.createFrame();
  frame.name = frameName;
  frame.resize(frameWidth, frameHeight);
  frame.layoutMode = "NONE";
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  frame.clipsContent = true;
  targetPage.appendChild(frame);

  for (const rootNode of tree) {
    await buildNode(rootNode, frame, targetPage);
  }

  figma.viewport.scrollAndZoomIntoView([frame]);
  return { frameId: frame.id, nodeId: frame.id };
`;
}

function buildPixelCloneScript(
  imageHash: string,
  frameWidth: number,
  frameHeight: number,
  frameName: string,
  targetPage: string | undefined
): string {
  return `
  const frameName = ${JSON.stringify(frameName)};
  const targetPageName = ${JSON.stringify(targetPage ?? null)};
  const frameWidth = ${frameWidth};
  const frameHeight = ${frameHeight};
  const imageHash = ${JSON.stringify(imageHash)};

  let targetPage = figma.currentPage;
  if (targetPageName) {
    const found = figma.root.children.find((p) => p.name === targetPageName);
    if (found) {
      await figma.setCurrentPageAsync(found);
      targetPage = found;
    }
  }

  const frame = figma.createFrame();
  frame.name = frameName;
  frame.resize(frameWidth, frameHeight);
  frame.fills = [{
    type: "IMAGE",
    imageHash,
    scaleMode: "FILL",
  }];
  frame.strokes = [];
  targetPage.appendChild(frame);

  figma.viewport.scrollAndZoomIntoView([frame]);
  return { frameId: frame.id, nodeId: frame.id, createdIds: [frame.id] };
`;
}

export async function screenClonerHandler(
  args: ScreenClonerArgs
): Promise<ScreenClonerResult> {
  const {
    image,
    cloneMode,
    frameWidth = 1440,
    targetPage,
    annotateUnmatched = false,
  } = args;

  const resolvedImage = await resolveImage(image);
  const bridge = await getBridge();
  const frameName = `[Screen Clone] ${new Date().toLocaleDateString("en-US")} — ${cloneMode}`;
  const sourceDimensions = await getImageDimensions(resolvedImage);
  const frameHeight = Math.max(
    1,
    Math.round((frameWidth * sourceDimensions.height) / sourceDimensions.width)
  );

  if (cloneMode === "pixel") {
    const importedImage = await bridge.importImage(resolvedImage);
    const pixelScript = buildPixelCloneScript(
      importedImage.imageHash,
      frameWidth,
      frameHeight,
      frameName,
      targetPage
    );

    const execResult = await bridge.execute(pixelScript);
    if (!execResult.success) {
      throw new Error(`screenClonerHandler: Figma execution failed — ${execResult.error}`);
    }

    const execData = execResult.result as { frameId: string; nodeId: string };

    await decisionLog.log({
      tool: "figma_screen_cloner",
      nodeIds: [execData.frameId],
      rationale: `Cloned screen using "pixel" mode as an image-backed frame at ${frameWidth}×${frameHeight}. Preserved screenshot fidelity without forcing design-system substitutions.`,
      reversible: true,
      metadata: {
        cloneMode,
        frameWidth,
        frameHeight,
        sourceDimensions,
        reconstructionStrategy: "image-backed-frame",
      },
    });

    return {
      frameId: execData.frameId,
      cloneMode,
      zones: 1,
      matched: 1,
      unmatched: 0,
      unmatchedComponents: [],
      tokenCoverage: "N/A",
      generatedFrame: { nodeId: execData.nodeId },
    };
  }

  const vision = new VisionClient();
  const segmentedTree = ensurePageRoot(await vision.segment(resolvedImage));

  if (segmentedTree.length === 0) {
    throw new Error("screenClonerHandler: VisionClient.segment() returned no layout nodes");
  }

  const leafNodes = flattenLeafNodes(segmentedTree);
  const manifests: ComponentManifest[] = await Promise.all(
    leafNodes.map((node) => vision.identify(node.zoneImage ?? resolvedImage))
  );

  const componentSets = await bridge.getComponentSets();
  const styles = await bridge.getStyles();
  const designSystemContext = await (await getDesignSystemContextStore(bridge)).hydrate();

  const matches: ZoneMatch[] = leafNodes.map((node, index) => {
    const manifest = manifests[index];
    const effectiveThreshold = cloneMode === "system" ? 0.85 : CONFIDENCE_THRESHOLD;
    const { component, confidence } = matchComponentInContext(
      manifestToDSMatchRequest(manifest),
      designSystemContext,
      effectiveThreshold
    );
    const meetsThreshold = confidence >= effectiveThreshold;

    return {
      node,
      manifest,
      dsComponent: meetsThreshold ? component : null,
      confidence,
      renderStrategy: meetsThreshold ? "ds" : "crop",
      fontStyleMatch: null,
      iconComponentMatch: null,
    };
  });

  await Promise.all(
    matches.map(async (match) => {
      await populateFallbackCrop(
        bridge,
        resolvedImage,
        match,
        sourceDimensions,
        frameWidth
      );

      match.fontStyleMatch = resolveFontStyleMatch(match.manifest, styles);
      match.iconComponentMatch = resolveIconComponentMatch(match.manifest, componentSets);
      match.openSourceIconSvg = await fetchOpenSourceIconSvg(match.manifest);

      if (match.dsComponent !== null) return;

      const iconOnly =
        match.manifest.iconPresent &&
        !match.manifest.textContent &&
        (match.iconComponentMatch !== null || match.openSourceIconSvg !== null);

      const textOnly =
        Boolean(match.manifest.textContent) &&
        !match.manifest.interactiveElement &&
        match.fontStyleMatch !== null;

      if (iconOnly) {
        match.renderStrategy = "icon";
        match.fallbackHeight = snapToGrid(
          Math.max(
            16,
            Math.round((frameHeight * clampPercentage(match.node.boundingBox.height)) / 100)
          )
        );
        match.fallbackWidth = snapToGrid(
          Math.max(
            16,
            Math.round((frameWidth * clampPercentage(match.node.boundingBox.width)) / 100)
          )
        );
        return;
      }

      if (textOnly) {
        match.renderStrategy = "text";
        match.fallbackHeight = snapToGrid(
          Math.max(
            match.fontStyleMatch?.fontSize ?? 16,
            Math.round((frameHeight * clampPercentage(match.node.boundingBox.height)) / 100)
          )
        );
        match.fallbackWidth = snapToGrid(
          Math.max(
            16,
            Math.round((frameWidth * clampPercentage(match.node.boundingBox.width)) / 100)
          )
        );
        return;
      }

      match.renderStrategy = "crop";
    })
  );

  const matchesById = new Map(matches.map((match) => [match.node.id, match]));
  const resolvedTree = buildResolvedTree(segmentedTree, matchesById);
  const serializedTree = serializeResolvedTree(resolvedTree, frameWidth, frameHeight);

  const script = buildFrameScript(
    frameWidth,
    frameHeight,
    serializedTree,
    frameName,
    targetPage,
    annotateUnmatched
  );

  const execResult = await bridge.execute(script);
  if (!execResult.success) {
    throw new Error(`screenClonerHandler: Figma execution failed — ${execResult.error}`);
  }

  const execData = execResult.result as { frameId: string; nodeId: string };
  const matched = matches.filter((match) => match.dsComponent !== null).length;
  const unmatched = matches.length - matched;
  const unmatchedComponents = matches
    .filter((match) => match.dsComponent === null)
    .map(
      (match) =>
        `${match.node.label} (${match.manifest.componentType}, confidence: ${match.confidence.toFixed(2)})`
    );

  const totalNodes = countNodes(segmentedTree);
  const tokenCoverage =
    componentSets.length > 0
      ? `${Math.round((matched / Math.max(leafNodes.length, 1)) * 100)}%`
      : "0%";

  await decisionLog.log({
    tool: "figma_screen_cloner",
    nodeIds: [execData.frameId],
    rationale: `Cloned screen using "${cloneMode}" mode into a ${frameWidth}px frame with hierarchical layout reconstruction. Matched ${matched}/${leafNodes.length} leaf nodes to DS components across ${totalNodes} layout nodes. Token coverage: ${tokenCoverage}.`,
    reversible: true,
    metadata: {
      cloneMode,
      frameWidth,
      frameHeight,
      zones: totalNodes,
      leafNodes: leafNodes.length,
      matched,
      unmatched,
      unmatchedComponents,
      placementStrategy: "hierarchical-layout-tree-with-leaf-fallbacks",
    },
  });

  return {
    frameId: execData.frameId,
    cloneMode,
    zones: totalNodes,
    matched,
    unmatched,
    unmatchedComponents,
    tokenCoverage,
    generatedFrame: { nodeId: execData.nodeId },
  };
}
