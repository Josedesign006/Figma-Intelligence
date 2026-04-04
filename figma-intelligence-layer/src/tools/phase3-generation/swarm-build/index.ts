// ─────────────────────────────────────────────────────────────────────────────
// Swarm Build — Multi-Agent Orchestrated Page Builder
//
// Decomposes a high-level task into spatial sub-tasks, assigns each to a named
// "agent" with its own colored cursor, runs preparation in parallel, and
// executes canvas writes with multi-cursor visual theatre.
//
// Architecture:
//   1. Parse user intent into spatial zones (hero, nav, features, footer, etc.)
//   2. Spawn agent cursors for each role (Layouter, Styler, Copywriter, Matcher)
//   3. Run all agent preparation in parallel via Promise.all()
//   4. Execute canvas writes sequentially (Figma Plugin API constraint) with
//      each agent's cursor animating to its zone as its work is committed
//   5. Post agent chat notes showing collaboration between agents
//   6. Clean up cursors, leave chat notes as visible collaboration log
// ─────────────────────────────────────────────────────────────────────────────

import Fuse from "fuse.js";
import { getBridge } from "../../../shared/figma-bridge.js";
import { decisionLog } from "../../../shared/decision-log.js";
import { ComponentSet, Token } from "../../../shared/types.js";
import {
  resolveDesignPalette,
  ResolvedPalette,
} from "../../../shared/token-binder.js";
import { FontConfig, resolveFontConfig, generateFontLoadScript, fontNameLiteral } from "../../../shared/font-config.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SwarmBuildArgs {
  brief: string;
  platform?: "web" | "mobile";
  width?: number;
  showAgentChat?: boolean;
  fonts?: Partial<FontConfig>;
}

export interface SwarmBuildResult {
  zones: ZoneResult[];
  frameIds: string[];
  agentsUsed: string[];
  parallelPrepMs: number;
  totalBuildMs: number;
  chatNoteIds: string[];
}

interface SpatialZone {
  name: string;
  role: string;
  yOrder: number;
  components: string[];
  description: string;
  content: ZoneContent;
}

interface ZoneContent {
  heading?: string;
  subheading?: string;
  bodyText?: string;
  ctaLabel?: string;
  listItems?: string[];
}

interface ZoneResult {
  zoneName: string;
  agent: string;
  frameId: string;
  componentsMatched: number;
}

// ─── Agent Definitions ──────────────────────────────────────────────────────

const AGENTS = {
  Layouter: {
    role: "Determines spatial layout, Auto Layout config, frame dimensions, and spacing",
    chatPrefix: "Layout ready",
  },
  Styler: {
    role: "Resolves design tokens, color palette, typography, and visual styles",
    chatPrefix: "Tokens bound",
  },
  Copywriter: {
    role: "Generates realistic UI text: headings, body copy, CTAs, list items",
    chatPrefix: "Copy written",
  },
  Matcher: {
    role: "Finds matching design system components for each zone",
    chatPrefix: "Components matched",
  },
};

// ─── Zone Decomposition ─────────────────────────────────────────────────────

const ZONE_PATTERNS: Array<{
  keywords: string[];
  name: string;
  components: string[];
  description: string;
}> = [
  {
    keywords: ["nav", "navigation", "header", "top bar", "app bar", "menu"],
    name: "Navigation",
    components: ["Navigation", "Logo", "Avatar", "Button", "SearchBar"],
    description: "Top navigation bar with logo, links, and actions",
  },
  {
    keywords: ["hero", "banner", "splash", "above the fold", "intro", "welcome"],
    name: "Hero",
    components: ["Heading", "Body", "Button", "Image"],
    description: "Full-width hero section with headline, subtext, and CTA",
  },
  {
    keywords: ["feature", "benefit", "service", "capability", "offering", "what we do"],
    name: "Features",
    components: ["Card", "Heading", "Body", "Icon", "Badge"],
    description: "Multi-column feature cards with icons and descriptions",
  },
  {
    keywords: ["pricing", "plan", "tier", "subscription", "package"],
    name: "Pricing",
    components: ["Card", "Heading", "Body", "Button", "Badge", "Divider"],
    description: "Pricing comparison cards with tiers and CTAs",
  },
  {
    keywords: ["testimonial", "review", "quote", "social proof", "customer"],
    name: "Testimonials",
    components: ["Card", "Avatar", "Body", "Rating"],
    description: "Customer testimonials with avatars and quotes",
  },
  {
    keywords: ["cta", "call to action", "signup", "get started", "join", "subscribe"],
    name: "CTA Section",
    components: ["Heading", "Body", "Button", "TextInput"],
    description: "Call-to-action section with headline and primary action",
  },
  {
    keywords: ["footer", "bottom", "links", "copyright", "sitemap"],
    name: "Footer",
    components: ["Body", "Link", "Logo", "Divider"],
    description: "Page footer with links, copyright, and brand",
  },
  {
    keywords: ["form", "input", "contact", "feedback"],
    name: "Form Section",
    components: ["TextInput", "Button", "Heading", "Body", "Select", "Checkbox"],
    description: "Form section with inputs and submit action",
  },
  {
    keywords: ["gallery", "portfolio", "showcase", "grid", "image"],
    name: "Gallery",
    components: ["Image", "Card", "Heading"],
    description: "Image gallery or portfolio grid",
  },
  {
    keywords: ["stat", "metric", "number", "counter", "achievement"],
    name: "Stats",
    components: ["Heading", "Body", "Card"],
    description: "Key metrics or statistics display",
  },
  {
    keywords: ["faq", "question", "answer", "help"],
    name: "FAQ",
    components: ["Heading", "Body", "Divider"],
    description: "Frequently asked questions accordion",
  },
];

function decomposeToZones(brief: string): SpatialZone[] {
  const lowerBrief = brief.toLowerCase();
  const zones: SpatialZone[] = [];
  let yOrder = 0;

  // Always start with navigation if it's a page/landing page
  const isPage = /(page|landing|website|site|home|app)/.test(lowerBrief);

  if (isPage) {
    zones.push({
      name: "Navigation",
      role: "Layouter",
      yOrder: yOrder++,
      components: ["Navigation", "Logo", "Avatar", "Button"],
      description: "Top navigation bar",
      content: {},
    });
  }

  // Match zones from brief
  for (const pattern of ZONE_PATTERNS) {
    if (pattern.name === "Navigation" && isPage) continue; // already added
    const matches = pattern.keywords.some((kw) => lowerBrief.includes(kw));
    if (matches) {
      zones.push({
        name: pattern.name,
        role: yOrder % 2 === 0 ? "Layouter" : "Builder",
        yOrder: yOrder++,
        components: pattern.components,
        description: pattern.description,
        content: {},
      });
    }
  }

  // If no specific zones matched, generate default page sections
  if (zones.length <= 1) {
    const defaultZones = ["Hero", "Features", "CTA Section", "Footer"];
    for (const zoneName of defaultZones) {
      const pattern = ZONE_PATTERNS.find((p) => p.name === zoneName);
      if (pattern) {
        zones.push({
          name: pattern.name,
          role: yOrder % 2 === 0 ? "Layouter" : "Builder",
          yOrder: yOrder++,
          components: pattern.components,
          description: pattern.description,
          content: {},
        });
      }
    }
  }

  // Always end with footer if it's a page and not already added
  if (isPage && !zones.find((z) => z.name === "Footer")) {
    const footerPattern = ZONE_PATTERNS.find((p) => p.name === "Footer")!;
    zones.push({
      name: "Footer",
      role: "Layouter",
      yOrder: yOrder++,
      components: footerPattern.components,
      description: footerPattern.description,
      content: {},
    });
  }

  return zones;
}

// ─── Parallel Agent Work ────────────────────────────────────────────────────

async function agentCopywriter(
  brief: string,
  zones: SpatialZone[],
): Promise<Map<string, ZoneContent>> {
  const contentMap = new Map<string, ZoneContent>();

  // Try AI content generation, fall back to smart defaults
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (apiKey) {
    try {
      const prompt = `You are a UI copywriter. Generate concise, realistic content for a "${brief}" page.

Zones: ${zones.map((z) => z.name).join(", ")}

Return ONLY valid JSON (no markdown):
{
  "zones": [
    {
      "zoneName": "string",
      "heading": "string (max 8 words)",
      "subheading": "string (max 20 words)",
      "ctaLabel": "string (max 3 words)",
      "listItems": ["string"],
      "bodyText": "string (max 30 words)"
    }
  ]
}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
        const text = data.content?.[0]?.text ?? "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { zones: Array<ZoneContent & { zoneName: string }> };
          for (const z of parsed.zones) {
            contentMap.set(z.zoneName, z);
          }
        }
      }
    } catch {
      // Fall through to defaults
    }
  }

  // Fill in defaults for any zones without AI content
  for (const zone of zones) {
    if (!contentMap.has(zone.name)) {
      contentMap.set(zone.name, buildDefaultContent(zone.name, brief));
    }
  }

  return contentMap;
}

function buildDefaultContent(zoneName: string, brief: string): ZoneContent {
  const brand = brief.split(/\s+/).slice(0, 2).join(" ");
  switch (zoneName) {
    case "Navigation":
      return { heading: brand };
    case "Hero":
      return {
        heading: `Build something amazing with ${brand}`,
        subheading: "The modern platform designed to help you move faster and build better.",
        ctaLabel: "Get Started",
      };
    case "Features":
      return {
        heading: "Why choose us",
        listItems: ["Lightning fast performance", "Enterprise-grade security", "Beautiful by default"],
      };
    case "Pricing":
      return {
        heading: "Simple, transparent pricing",
        subheading: "No hidden fees. Cancel anytime.",
        listItems: ["Starter — Free", "Pro — $19/mo", "Enterprise — Custom"],
      };
    case "Testimonials":
      return {
        heading: "Loved by teams worldwide",
        listItems: ['"This changed how we work" — Sarah K.', '"Best tool we\'ve adopted" — Mike L.'],
      };
    case "CTA Section":
      return {
        heading: "Ready to get started?",
        subheading: "Join thousands of teams already using our platform.",
        ctaLabel: "Start free trial",
      };
    case "Footer":
      return {
        heading: brand,
        bodyText: `© ${new Date().getFullYear()} ${brand}. All rights reserved.`,
        listItems: ["About", "Blog", "Careers", "Contact", "Privacy", "Terms"],
      };
    case "Stats":
      return {
        listItems: ["10K+ Users", "99.9% Uptime", "150+ Countries"],
      };
    case "FAQ":
      return {
        heading: "Frequently asked questions",
        listItems: ["How does it work?", "Is there a free trial?", "Can I cancel anytime?"],
      };
    default:
      return {
        heading: zoneName,
        bodyText: `Content for ${zoneName} section`,
      };
  }
}

async function agentMatcher(
  zones: SpatialZone[],
  componentSets: ComponentSet[],
): Promise<Map<string, Array<{ name: string; nodeId: string | null }>>> {
  const fuse = new Fuse(componentSets, {
    keys: ["name", "description"],
    threshold: 0.45,
    includeScore: true,
    minMatchCharLength: 2,
  });

  const matchMap = new Map<string, Array<{ name: string; nodeId: string | null }>>();

  for (const zone of zones) {
    const matches = zone.components.map((compName) => {
      const results = fuse.search(compName);
      if (results.length === 0) return { name: compName, nodeId: null };
      const best = results[0];
      const firstChild = best.item.children[0];
      return { name: best.item.name, nodeId: firstChild?.id ?? null };
    });
    matchMap.set(zone.name, matches);
  }

  return matchMap;
}

async function agentStyler(
  tokens: Token[],
  dsId?: string | null,
): Promise<ResolvedPalette | undefined> {
  // When a DS is selected, its tokens are authoritative (ignore file tokens)
  if (!dsId && tokens.length === 0) return undefined;
  try {
    return resolveDesignPalette(tokens, dsId);
  } catch {
    return undefined;
  }
}

// ─── Zone Build Script ──────────────────────────────────────────────────────

function buildZoneScript(
  zone: SpatialZone,
  content: ZoneContent,
  matches: Array<{ name: string; nodeId: string | null }>,
  palette: ResolvedPalette | undefined,
  frameWidth: number,
  parentFrameId: string,
  fc: FontConfig,
): string {
  const fontLoadBlock = generateFontLoadScript(fc);
  const headingFont = fontNameLiteral("heading", "Bold", fc);
  const bodyFont = fontNameLiteral("body", "Regular", fc);
  const uiFont = fontNameLiteral("ui", "Medium", fc);

  const heading = content.heading || zone.name;
  const sub = content.subheading || "";
  const cta = content.ctaLabel || "";
  const body = content.bodyText || "";
  const items = content.listItems || [];

  const bgFill = zone.name === "Hero"
    ? "{ r: 0.96, g: 0.96, b: 0.99 }"
    : zone.name === "Footer"
      ? "{ r: 0.12, g: 0.12, b: 0.15 }"
      : zone.name === "CTA Section"
        ? "{ r: 0.26, g: 0.52, b: 0.96 }"
        : "{ r: 1, g: 1, b: 1 }";

  const textColor = (zone.name === "Footer" || zone.name === "CTA Section")
    ? "{ r: 1, g: 1, b: 1 }"
    : "{ r: 0.1, g: 0.1, b: 0.12 }";

  const subColor = (zone.name === "Footer" || zone.name === "CTA Section")
    ? "{ r: 0.8, g: 0.8, b: 0.85 }"
    : "{ r: 0.4, g: 0.4, b: 0.45 }";

  // Build list items script
  const listScript = items.length > 0 ? `
    // List items
    ${items.map((item, i) => `
    {
      const li = figma.createText();
      await figma.loadFontAsync(${bodyFont});
      li.fontName = ${bodyFont};
      li.characters = ${JSON.stringify(item)};
      li.fontSize = 16;
      li.fills = [{ type: 'SOLID', color: ${subColor} }];
      li.name = 'ListItem_${i}';
      zone.appendChild(li);
      if ('layoutSizingHorizontal' in li) li.layoutSizingHorizontal = 'FILL';
    }
    `).join("\n")}
  ` : "";

  // CTA button
  const ctaScript = cta ? `
    // CTA Button
    const ctaFrame = figma.createFrame();
    ctaFrame.name = 'CTA';
    ctaFrame.layoutMode = 'HORIZONTAL';
    ctaFrame.primaryAxisSizingMode = 'AUTO';
    ctaFrame.counterAxisSizingMode = 'AUTO';
    ctaFrame.paddingLeft = 24; ctaFrame.paddingRight = 24;
    ctaFrame.paddingTop = 12; ctaFrame.paddingBottom = 12;
    ctaFrame.cornerRadius = 8;
    ctaFrame.fills = [{ type: 'SOLID', color: ${zone.name === "CTA Section" ? "{ r: 1, g: 1, b: 1 }" : "{ r: 0.26, g: 0.52, b: 0.96 }"} }];
    const ctaText = figma.createText();
    await figma.loadFontAsync(${uiFont});
    ctaText.fontName = ${uiFont};
    ctaText.characters = ${JSON.stringify(cta)};
    ctaText.fontSize = 16;
    ctaText.fills = [{ type: 'SOLID', color: ${zone.name === "CTA Section" ? "{ r: 0.26, g: 0.52, b: 0.96 }" : "{ r: 1, g: 1, b: 1 }"} }];
    ctaFrame.appendChild(ctaText);
    zone.appendChild(ctaFrame);
  ` : "";

  return `
(async () => {
  ${fontLoadBlock}

  const parent = await figma.getNodeByIdAsync(${JSON.stringify(parentFrameId)});
  if (!parent || !('appendChild' in parent)) throw new Error('Parent frame not found');

  const zone = figma.createFrame();
  zone.name = ${JSON.stringify(zone.name)};
  zone.layoutMode = 'VERTICAL';
  zone.primaryAxisSizingMode = 'AUTO';
  zone.counterAxisSizingMode = 'FIXED';
  zone.resize(${frameWidth}, 100);
  zone.itemSpacing = ${zone.name === "Navigation" ? 0 : 16};
  zone.paddingLeft = ${zone.name === "Navigation" ? 24 : 48};
  zone.paddingRight = ${zone.name === "Navigation" ? 24 : 48};
  zone.paddingTop = ${zone.name === "Navigation" ? 12 : 48};
  zone.paddingBottom = ${zone.name === "Navigation" ? 12 : 48};
  zone.fills = [{ type: 'SOLID', color: ${bgFill} }];
  if ('layoutSizingHorizontal' in zone) zone.layoutSizingHorizontal = 'FILL';
  parent.appendChild(zone);

  // Heading
  ${heading ? `
  const h = figma.createText();
  await figma.loadFontAsync(${headingFont});
  h.fontName = ${headingFont};
  h.characters = ${JSON.stringify(heading)};
  h.fontSize = ${zone.name === "Hero" ? 48 : zone.name === "Navigation" ? 16 : 32};
  h.fills = [{ type: 'SOLID', color: ${textColor} }];
  h.name = 'Heading';
  zone.appendChild(h);
  if ('layoutSizingHorizontal' in h) h.layoutSizingHorizontal = 'FILL';
  ` : ""}

  // Subheading
  ${sub ? `
  const sub = figma.createText();
  await figma.loadFontAsync(${bodyFont});
  sub.fontName = ${bodyFont};
  sub.characters = ${JSON.stringify(sub)};
  sub.fontSize = 18;
  sub.fills = [{ type: 'SOLID', color: ${subColor} }];
  sub.name = 'Subheading';
  zone.appendChild(sub);
  if ('layoutSizingHorizontal' in sub) sub.layoutSizingHorizontal = 'FILL';
  ` : ""}

  // Body text
  ${body ? `
  const bodyEl = figma.createText();
  await figma.loadFontAsync(${bodyFont});
  bodyEl.fontName = ${bodyFont};
  bodyEl.characters = ${JSON.stringify(body)};
  bodyEl.fontSize = 14;
  bodyEl.fills = [{ type: 'SOLID', color: ${subColor} }];
  bodyEl.name = 'Body';
  zone.appendChild(bodyEl);
  if ('layoutSizingHorizontal' in bodyEl) bodyEl.layoutSizingHorizontal = 'FILL';
  ` : ""}

  ${listScript}

  ${ctaScript}

  return { zoneId: zone.id, zoneName: ${JSON.stringify(zone.name)} };
})();
`.trim();
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function swarmBuildHandler(
  args: SwarmBuildArgs,
): Promise<SwarmBuildResult> {
  const {
    brief,
    platform = "web",
    width: userWidth,
    showAgentChat = true,
  } = args;

  if (!brief) throw new Error("swarmBuild: `brief` is required.");

  const startTime = Date.now();
  const bridge = await getBridge();
  const fontConfig = resolveFontConfig(args.fonts, bridge.getActiveDesignSystemId());
  const frameWidth = userWidth || (platform === "mobile" ? 390 : 1440);

  // 1. Decompose brief into spatial zones
  const zones = decomposeToZones(brief);

  // 2. Find rightmost existing frame to avoid overlap
  let xOffset = 0;
  try {
    const posResult = await bridge.execute(`(async () => {
      const frames = figma.currentPage.children.filter(n =>
        n.type === 'FRAME' && !n.name.startsWith('__agent_')
      );
      const maxX = frames.reduce((max, f) => Math.max(max, f.x + f.width), 0);
      return { maxX };
    })();`);
    const posMax = (posResult.result as { maxX?: number })?.maxX ?? 0;
    if (posResult.success && posMax > 0) {
      xOffset = posMax + 80;
    }
  } catch { /* start at 0 */ }

  // 3. Spawn agent cursors across the workspace
  const agentNames = Object.keys(AGENTS) as Array<keyof typeof AGENTS>;
  const cursorSpacing = 200;
  for (let i = 0; i < agentNames.length; i++) {
    try {
      await bridge.spawnAgentCursor(agentNames[i], xOffset + i * cursorSpacing, -60);
    } catch { /* cursor spawn is best-effort */ }
  }

  // 4. Run all agent preparation in TRUE PARALLEL
  const prepStart = Date.now();

  const [contentMap, componentSets, tokens] = await Promise.all([
    // Agent: Copywriter — generate content for all zones
    (async () => {
      try { await bridge.updateAgentLabel("Copywriter", "Copywriter: generating content..."); } catch {}
      const result = await agentCopywriter(brief, zones);
      try { await bridge.updateAgentLabel("Copywriter", "Copywriter: content ready ✓"); } catch {}
      return result;
    })(),

    // Agent: Matcher — fetch component sets for matching
    (async () => {
      try { await bridge.updateAgentLabel("Matcher", "Matcher: scanning components..."); } catch {}
      const sets = await bridge.getComponentSets();
      try { await bridge.updateAgentLabel("Matcher", `Matcher: ${sets.length} components found ✓`); } catch {}
      return sets;
    })(),

    // Agent: Styler — fetch and resolve design tokens
    (async () => {
      try { await bridge.updateAgentLabel("Styler", "Styler: resolving tokens..."); } catch {}
      let tkns: Token[] = [];
      try { tkns = await bridge.getTokens(); } catch {}
      try { await bridge.updateAgentLabel("Styler", `Styler: ${tkns.length} tokens resolved ✓`); } catch {}
      return tkns;
    })(),
  ]);

  // Get the active design system — its tokens are authoritative when set
  const dsId = bridge.getActiveDesignSystemId();

  // Run dependent preparation
  const [matchMap, palette] = await Promise.all([
    agentMatcher(zones, componentSets),
    agentStyler(tokens, dsId),
  ]);

  const parallelPrepMs = Date.now() - prepStart;

  // Apply content to zones
  for (const zone of zones) {
    const content = contentMap.get(zone.name);
    if (content) zone.content = content;
  }

  // 5. Create the main page frame
  try { await bridge.updateAgentLabel("Layouter", "Layouter: creating page frame..."); } catch {}
  const pageFrameResult = await bridge.execute(`(async () => {
    const frame = figma.createFrame();
    frame.name = ${JSON.stringify(`Swarm: ${brief.slice(0, 50)}`)};
    frame.resize(${frameWidth}, 100);
    frame.layoutMode = 'VERTICAL';
    frame.primaryAxisSizingMode = 'AUTO';
    frame.counterAxisSizingMode = 'FIXED';
    frame.itemSpacing = 0;
    frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    frame.x = ${xOffset};
    frame.y = 0;
    figma.currentPage.appendChild(frame);
    figma.viewport.scrollAndZoomIntoView([frame]);
    return { frameId: frame.id };
  })();`);

  if (!pageFrameResult.success) {
    throw new Error(`Failed to create page frame: ${pageFrameResult.error}`);
  }
  const parentFrameId = (pageFrameResult.result as { frameId: string }).frameId;

  // 6. Build each zone with cursor animation
  const zoneResults: ZoneResult[] = [];
  const chatNoteIds: string[] = [];

  for (const zone of zones) {
    const matches = matchMap.get(zone.name) || [];
    const agentName = zone.yOrder % 2 === 0 ? "Layouter" : "Builder";

    // Move the agent's cursor to this zone's approximate position
    try {
      await bridge.moveAgentCursor(agentName, xOffset - 20, zone.yOrder * 300, true, 300);
      await bridge.updateAgentLabel(agentName, `${agentName}: building ${zone.name}...`);
    } catch {}

    // Post agent chat note
    if (showAgentChat) {
      try {
        const chatMsg = `${AGENTS[agentName as keyof typeof AGENTS]?.chatPrefix || "Working on"} → ${zone.name}`;
        const noteId = await bridge.postAgentChat(
          agentName,
          chatMsg,
          xOffset + frameWidth + 20,
          zone.yOrder * 300,
        );
        chatNoteIds.push(noteId);
      } catch {}
    }

    // Execute zone build
    const script = buildZoneScript(zone, zone.content, matches, palette, frameWidth, parentFrameId, fontConfig);
    const result = await bridge.execute(script);

    if (result.success && result.result) {
      const res = result.result as { zoneId: string; zoneName: string };
      zoneResults.push({
        zoneName: res.zoneName,
        agent: agentName,
        frameId: res.zoneId,
        componentsMatched: matches.filter((m) => m.nodeId !== null).length,
      });
    }

    // Update cursor label to show completion
    try {
      await bridge.updateAgentLabel(agentName, `${agentName}: ${zone.name} done ✓`);
    } catch {}
  }

  // 7. Post cross-agent collaboration chat notes
  if (showAgentChat && zoneResults.length > 1) {
    try {
      const noteId = await bridge.postAgentChat(
        "Styler",
        `Applied ${tokens.length} tokens across ${zoneResults.length} zones`,
        xOffset + frameWidth + 20,
        -30,
      );
      chatNoteIds.push(noteId);
    } catch {}
    try {
      const noteId = await bridge.postAgentChat(
        "Copywriter",
        `Generated copy for ${zoneResults.length} sections`,
        xOffset + frameWidth + 180,
        -30,
      );
      chatNoteIds.push(noteId);
    } catch {}
  }

  // 8. Clean up agent cursors (leave chat notes as collaboration log)
  await new Promise((resolve) => setTimeout(resolve, 1500)); // let user see cursors for a moment
  for (const agentName of agentNames) {
    try { await bridge.removeAgentCursor(agentName); } catch {}
  }

  const totalBuildMs = Date.now() - startTime;

  // Log decision
  try {
    decisionLog.log({
      tool: "figma_swarm_build",
      rationale: `Built ${zoneResults.length} zones in parallel-prep mode (${parallelPrepMs}ms prep, ${totalBuildMs}ms total) for: ${brief}`,
      nodeIds: zoneResults.map((z) => z.frameId),
      tokens: tokens.length > 0 ? [`${tokens.length} tokens resolved`] : [],
    });
  } catch {}

  return {
    zones: zoneResults,
    frameIds: [parentFrameId, ...zoneResults.map((z) => z.frameId)],
    agentsUsed: [...new Set(zoneResults.map((z) => z.agent))],
    parallelPrepMs,
    totalBuildMs,
    chatNoteIds,
  };
}
