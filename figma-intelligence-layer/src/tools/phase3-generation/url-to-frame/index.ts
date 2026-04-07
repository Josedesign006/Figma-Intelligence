// ─────────────────────────────────────────────────────────────────────────────
// URL to Frame
// Captures screenshots of a live URL at breakpoint widths using Playwright,
// feeds each screenshot through the screen-cloner pipeline, positions the
// resulting frames side-by-side, and optionally annotates with competitive
// analysis notes and a DS coverage gap report.
// ─────────────────────────────────────────────────────────────────────────────

// Lazy-load playwright — native module, may not be available in bundled environments
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let chromium: any;
try {
  const pw = require("playwright");
  chromium = pw.chromium;
} catch {
  // playwright unavailable — url-to-frame will fail gracefully
}
type Page = any;
type Browser = any;
import { getBridge } from "../../../shared/figma-bridge.js";
import { VisionClient } from "../../../shared/vision-client.js";
import { decisionLog } from "../../../shared/decision-log.js";
import { screenClonerHandler } from "../../phase1-vision/screen-cloner/index.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export type Breakpoint = "mobile" | "tablet" | "desktop";

export interface UrlToFrameArgs {
  url: string;
  breakpoints: Array<Breakpoint>;
  cloneMode: "pixel" | "system" | "adaptive";
  addCompetitorAnnotations?: boolean;
  dsGapReport?: boolean;
}

export interface BreakpointCapture {
  breakpoint: Breakpoint;
  width: number;
  frameId: string;
  screenshot: string;
  dsCoverage: number;
}

export interface DsGapEntry {
  pattern: string;
  breakpoint: Breakpoint;
  hasEquivalent: boolean;
  suggestedComponent: string | null;
}

export interface UrlToFrameResult {
  url: string;
  captures: BreakpointCapture[];
  frameIds: string[];
  screenshotsTaken: number;
  dsCoveragePercentage: number;
  dsGapReport: DsGapEntry[] | null;
  competitorAnnotations: string[] | null;
  logEntryId: string;
}

// ─── Breakpoint widths ────────────────────────────────────────────────────────

const BREAKPOINT_WIDTHS: Record<Breakpoint, number> = {
  mobile: 375,
  tablet: 768,
  desktop: 1440,
};

// ─── Playwright screenshot capture ───────────────────────────────────────────

async function captureScreenshot(
  page: Page,
  url: string,
  width: number
): Promise<string> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

  // Let lazy-loaded content settle
  await page.waitForTimeout(1200);

  const buffer = await page.screenshot({
    type: "png",
    fullPage: false,
    clip: { x: 0, y: 0, width, height: 900 },
  });

  return `data:image/png;base64,${buffer.toString("base64")}`;
}

// ─── Figma: reposition frames side by side ────────────────────────────────────

function buildRepositionScript(
  frameIds: string[],
  frameWidths: number[],
  gap = 32
): string {
  const frameData = JSON.stringify(
    frameIds.map((id, i) => ({ id, width: frameWidths[i] }))
  );

  return `
(async () => {
  const frameData = ${frameData};
  const gap = ${gap};
  let xOffset = 0;

  for (const { id, width } of frameData) {
    const node = await figma.getNodeByIdAsync(id);
    if (node) {
      node.x = xOffset;
      node.y = 0;
    }
    xOffset += width + gap;
  }

  const nodes = [];
  for (const d of frameData) {
    const n = await figma.getNodeByIdAsync(d.id);
    if (n) nodes.push(n);
  }
  if (nodes.length > 0) figma.viewport.scrollAndZoomIntoView(nodes);
  return { repositioned: nodes.length };
})();
`.trim();
}

// ─── Figma: add sticky annotation ────────────────────────────────────────────

function buildAnnotationScript(frameId: string, text: string, xOffset: number): string {
  return `
(async () => {
  const frame = await figma.getNodeByIdAsync(${JSON.stringify(frameId)});
  if (!frame) return;

  const sticky = figma.createSticky();
  sticky.text.characters = ${JSON.stringify(text.slice(0, 500))};
  sticky.x = frame.x;
  sticky.y = (frame.absoluteBoundingBox ? frame.absoluteBoundingBox.y + frame.absoluteBoundingBox.height : frame.y + 900) + 24;
  figma.currentPage.appendChild(sticky);
  return { stickyId: sticky.id };
})();
`.trim();
}

// ─── Vision analysis for competitor annotations ───────────────────────────────

async function analyzeForAnnotations(
  screenshots: Array<{ breakpoint: Breakpoint; screenshot: string }>,
  vision: VisionClient
): Promise<string[]> {
  const annotations: string[] = [];

  for (const { breakpoint, screenshot } of screenshots) {
    const result = await vision.analyze(
      screenshot,
      `You are a competitive UX analyst reviewing this ${breakpoint} screenshot.
Identify:
1. Key UX patterns used (navigation, CTAs, information architecture)
2. Strengths of this design approach
3. Weaknesses or friction points
4. Notable techniques or innovations

Return a concise bullet-point analysis (max 6 bullets). Start each bullet with a category tag like [STRENGTH], [WEAKNESS], [PATTERN], or [TECHNIQUE].`
    );

    const prefix = `[${breakpoint.toUpperCase()} Competitive Analysis]\n`;
    annotations.push(prefix + result.rawAnalysis);
  }

  return annotations;
}

// ─── DS gap analysis ─────────────────────────────────────────────────────────

async function computeDsGapReport(
  screenshots: Array<{ breakpoint: Breakpoint; screenshot: string }>,
  vision: VisionClient
): Promise<DsGapEntry[]> {
  const gaps: DsGapEntry[] = [];

  for (const { breakpoint, screenshot } of screenshots) {
    const result = await vision.analyze(
      screenshot,
      `Analyze this UI screenshot and identify all distinct UI patterns/components present.
For each pattern, output a JSON array item:
{ "pattern": "pattern name", "category": "navigation|form|content|feedback|layout|data" }

Return ONLY a valid JSON array, no markdown.`
    );

    let patterns: Array<{ pattern: string; category: string }> = [];
    try {
      const jsonMatch = result.rawAnalysis.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
      patterns = JSON.parse(jsonMatch ? jsonMatch[1] : result.rawAnalysis);
    } catch {
      // If parsing fails, extract pattern names from raw analysis
      const lines = result.rawAnalysis.split("\n").filter((l) => l.trim().length > 2);
      patterns = lines.slice(0, 10).map((l) => ({
        pattern: l.replace(/^[-*•]\s*/, "").trim(),
        category: "content",
      }));
    }

    for (const { pattern } of patterns) {
      // Heuristic: check if DS likely has an equivalent
      const dsKeywords = [
        "button",
        "input",
        "card",
        "nav",
        "modal",
        "badge",
        "tab",
        "list",
        "table",
        "form",
        "header",
        "footer",
        "icon",
        "avatar",
        "chip",
        "toast",
        "tooltip",
      ];
      const lp = pattern.toLowerCase();
      const hasEquivalent = dsKeywords.some((kw) => lp.includes(kw));
      const suggestedComponent = hasEquivalent
        ? pattern
            .split(" ")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join("")
        : null;

      gaps.push({ pattern, breakpoint, hasEquivalent, suggestedComponent });
    }
  }

  return gaps;
}

// ─── Coverage calculation ─────────────────────────────────────────────────────

function computeCoveragePercentage(captures: BreakpointCapture[]): number {
  if (captures.length === 0) return 0;
  const avg = captures.reduce((sum, c) => sum + c.dsCoverage, 0) / captures.length;
  return Math.round(avg * 100) / 100;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function urlToFrameHandler(
  args: UrlToFrameArgs
): Promise<UrlToFrameResult> {
  const {
    url,
    breakpoints,
    cloneMode,
    addCompetitorAnnotations = false,
    dsGapReport = false,
  } = args;

  if (!url) throw new Error("urlToFrame: `url` is required.");
  if (!breakpoints || breakpoints.length === 0) {
    throw new Error("urlToFrame: `breakpoints` must be a non-empty array.");
  }

  const bridge = await getBridge();
  const vision = new VisionClient();

  // 1. Launch Playwright and capture screenshots
  let browser: Browser | null = null;
  const rawScreenshots: Array<{
    breakpoint: Breakpoint;
    width: number;
    screenshot: string;
  }> = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    for (const bp of breakpoints) {
      const width = BREAKPOINT_WIDTHS[bp];
      const screenshot = await captureScreenshot(page, url, width);
      rawScreenshots.push({ breakpoint: bp, width, screenshot });
    }

    await context.close();
  } catch (err) {
    throw new Error(
      `urlToFrame: Playwright capture failed — ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    if (browser) await browser.close();
  }

  // 2. Run screen-cloner pipeline for each screenshot
  const captures: BreakpointCapture[] = [];

  for (const { breakpoint, width, screenshot } of rawScreenshots) {
    try {
      const clonerResult = await screenClonerHandler({
        image: screenshot,
        cloneMode,
        frameWidth: width,
        annotateUnmatched: false,
      });

      const dsCoverage =
        clonerResult.zones > 0
          ? (clonerResult.matched / clonerResult.zones) * 100
          : 0;

      captures.push({
        breakpoint,
        width,
        frameId: clonerResult.frameId,
        screenshot,
        dsCoverage: Math.round(dsCoverage * 10) / 10,
      });
    } catch (err) {
      console.error(
        `urlToFrame: screen-cloner failed for ${breakpoint}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (captures.length === 0) {
    throw new Error("urlToFrame: No frames were created — all screen-cloner calls failed.");
  }

  // 3. Reposition frames side by side with 32px gap
  const frameIds = captures.map((c) => c.frameId);
  const frameWidths = captures.map((c) => c.width);
  const repositionScript = buildRepositionScript(frameIds, frameWidths, 32);
  await bridge.execute(repositionScript);

  // 4. Optionally add competitor annotations
  let competitorAnnotations: string[] | null = null;
  if (addCompetitorAnnotations) {
    const screenshotsForAnalysis = rawScreenshots.map((s) => ({
      breakpoint: s.breakpoint,
      screenshot: s.screenshot,
    }));
    competitorAnnotations = await analyzeForAnnotations(screenshotsForAnalysis, vision);

    let xOffset = 0;
    for (let i = 0; i < captures.length; i++) {
      const annotation = competitorAnnotations[i] ?? "";
      if (annotation) {
        const annotationScript = buildAnnotationScript(
          captures[i].frameId,
          annotation,
          xOffset
        );
        await bridge.execute(annotationScript);
      }
      xOffset += captures[i].width + 32;
    }
  }

  // 5. Optionally compute DS gap report
  let gapReport: DsGapEntry[] | null = null;
  if (dsGapReport) {
    const screenshotsForGap = rawScreenshots.map((s) => ({
      breakpoint: s.breakpoint,
      screenshot: s.screenshot,
    }));
    gapReport = await computeDsGapReport(screenshotsForGap, vision);
  }

  // 6. Compute overall DS coverage
  const dsCoveragePercentage = computeCoveragePercentage(captures);

  // 7. Log the decision
  const logEntry = await decisionLog.log({
    tool: "url-to-frame",
    nodeIds: frameIds,
    rationale: `Captured ${captures.length} breakpoint(s) from "${url}" and cloned into Figma frames using "${cloneMode}" mode. Breakpoints: ${captures.map((c) => `${c.breakpoint} (${c.width}px)`).join(", ")}. Overall DS coverage: ${dsCoveragePercentage}%. Competitor annotations: ${addCompetitorAnnotations}. DS gap report: ${dsGapReport}.`,
    tokens: [],
    reversible: true,
    metadata: {
      url,
      breakpoints,
      cloneMode,
      addCompetitorAnnotations,
      dsGapReport,
      screenshotsTaken: captures.length,
      dsCoveragePercentage,
      gapEntries: gapReport?.length ?? 0,
    },
  });

  return {
    url,
    captures,
    frameIds,
    screenshotsTaken: captures.length,
    dsCoveragePercentage,
    dsGapReport: gapReport,
    competitorAnnotations,
    logEntryId: logEntry.id,
  };
}
