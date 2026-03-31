/**
 * Legacy compatibility — functions needed by apg-doc that were in spec-generator
 */
import { getBridge } from "../../../shared/figma-bridge.js";
import type { GeneratedDocument } from "./types.js";

export function formatDocumentReport(document: GeneratedDocument): string {
  const lines = [
    document.title,
    "",
    document.summary,
    "",
  ];

  for (const section of document.sections) {
    lines.push(section.title);
    for (const item of section.items) {
      lines.push(section.style === "paragraph" ? item : `- ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

export async function createDocumentationPages(documents: GeneratedDocument[], pageName?: string): Promise<string> {
  const bridge = await getBridge();
  const result = await bridge.execute(`
    (async () => {
      const documents = ${JSON.stringify(documents)};
      await figma.loadAllPagesAsync();
      const resolvedPageName = ${JSON.stringify(pageName || "Generated Component Docs")};
      const existing = figma.root.children.find((candidate) => candidate.name === resolvedPageName);
      const page = existing || figma.createPage();
      page.name = resolvedPageName;
      await figma.setCurrentPageAsync(page);

      for (const child of [...page.children]) {
        child.remove();
      }

      await figma.loadFontAsync({ family: "Inter", style: "Bold" });
      await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
      await figma.loadFontAsync({ family: "Inter", style: "Medium" });
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });

      const colors = {
        card: { r: 1, g: 1, b: 1 },
        stroke: { r: 0.874, g: 0.874, b: 0.914 },
        heading: { r: 0.121, g: 0.129, b: 0.259 },
        body: { r: 0.188, g: 0.192, b: 0.224 },
        muted: { r: 0.376, g: 0.376, b: 0.412 },
      };

      function makeText(value, size, style, color, width) {
        const text = figma.createText();
        text.fontName = { family: "Inter", style };
        text.fontSize = size;
        text.lineHeight = { unit: "PIXELS", value: size <= 14 ? 20 : size + 8 };
        text.characters = value;
        text.fills = [{ type: "SOLID", color }];
        text.textAutoResize = width ? "HEIGHT" : "WIDTH_AND_HEIGHT";
        if (width) {
          text.resize(width, text.height);
        }
        return text;
      }

      function makeSection(section, width) {
        const frame = figma.createFrame();
        frame.layoutMode = "VERTICAL";
        frame.primaryAxisSizingMode = "AUTO";
        frame.counterAxisSizingMode = "AUTO";
        frame.itemSpacing = 10;
        frame.fills = [];
        frame.appendChild(makeText(section.title, 18, "Semi Bold", colors.heading, width));
        for (const item of section.items) {
          const prefix = section.style === "paragraph" ? "" : "• ";
          frame.appendChild(makeText(prefix + item, 14, "Regular", colors.body, width));
        }
        return frame;
      }

      let y = 40;
      for (const document of documents) {
        const card = figma.createFrame();
        card.name = document.title;
        card.layoutMode = "VERTICAL";
        card.primaryAxisSizingMode = "AUTO";
        card.counterAxisSizingMode = "AUTO";
        card.itemSpacing = 20;
        card.paddingTop = 28;
        card.paddingRight = 28;
        card.paddingBottom = 28;
        card.paddingLeft = 28;
        card.cornerRadius = 16;
        card.strokes = [{ type: "SOLID", color: colors.stroke }];
        card.fills = [{ type: "SOLID", color: colors.card }];
        card.x = 40;
        card.y = y;
        card.resize(1006, 100);
        card.appendChild(makeText(document.title, 28, "Semi Bold", colors.heading, 920));
        card.appendChild(makeText(document.summary, 14, "Regular", colors.muted, 920));
        for (const section of document.sections) {
          card.appendChild(makeSection(section, 920));
        }
        page.appendChild(card);
        y += Math.max(card.height, 240) + 32;
      }

      figma.viewport.scrollAndZoomIntoView(page.children);
      return page.id;
    })();
  `);

  if (!result.success) {
    throw new Error(`createDocumentationPages: failed to create page: ${result.error}`);
  }

  return result.result as string;
}
