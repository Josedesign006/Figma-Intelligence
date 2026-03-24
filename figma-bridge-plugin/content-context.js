#!/usr/bin/env node
/**
 * content-context.js — Universal content parsing for knowledge grounding.
 *
 * Extracts text from PDFs, DOCX files, web URLs, and plain text.
 * The extracted content is stored as "knowledge sources" and injected
 * as grounding context into any AI provider's chat messages.
 *
 * Supported formats:
 *   - PDF  → pdf-parse (pure JS, no native binaries)
 *   - DOCX → mammoth (pure JS, JSZip-based)
 *   - URL  → cheerio + @mozilla/readability
 *   - TXT/MD/CSV/JSON → plain UTF-8 text
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Knowledge Hub directory (sibling to this file)
const KNOWLEDGE_HUB_DIR = path.join(__dirname, "knowledge-hub");

// Lazy-load heavy dependencies to keep startup fast
let _pdfParse, _mammoth, _cheerio, _Readability, _JSDOM;

function getPdfParse() {
  if (!_pdfParse) _pdfParse = require("pdf-parse"); // exports { PDFParse, ... }
  return _pdfParse;
}
function getMammoth() {
  if (!_mammoth) _mammoth = require("mammoth");
  return _mammoth;
}
function getCheerio() {
  if (!_cheerio) _cheerio = require("cheerio");
  return _cheerio;
}
function getReadability() {
  if (!_Readability) _Readability = require("@mozilla/readability");
  return _Readability;
}

// ── PDF Parsing ─────────────────────────────────────────────────────────────

/**
 * Extract text from a PDF buffer.
 * @param {Buffer} buffer — raw PDF bytes
 * @returns {Promise<{ title: string, text: string, pages: number }>}
 */
async function parsePdfBuffer(buffer) {
  const { PDFParse } = getPdfParse();
  // pdf-parse v2+ requires Uint8Array, not Buffer
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const parser = new PDFParse(uint8);
  const result = await parser.getText();
  // result = { pages: [{ text, num }], text: string, total: number }
  // Clean up: join page texts, remove page markers like "-- 1 of 320 --"
  const rawText = result.text || result.pages.map(p => p.text).join("\n\n");
  const fullText = rawText.replace(/\n-- \d+ of \d+ --\n/g, "\n\n").trim();
  let title = "";
  // Try to get title from info
  try {
    const info = await parser.getInfo();
    title = info?.Title || info?.title || "";
  } catch {}
  return {
    title,
    text: fullText,
    pages: result.total || result.pages?.length || 0,
  };
}

// ── DOCX Parsing ────────────────────────────────────────────────────────────

/**
 * Extract text from a DOCX buffer.
 * @param {Buffer} buffer — raw DOCX bytes
 * @returns {Promise<{ title: string, text: string }>}
 */
async function parseDocxBuffer(buffer) {
  const mammoth = getMammoth();
  const result = await mammoth.extractRawText({ buffer });
  // Try to derive title from first line
  const firstLine = (result.value || "").split("\n").find(l => l.trim().length > 0) || "";
  return {
    title: firstLine.length > 5 && firstLine.length < 120 ? firstLine.trim() : "",
    text: result.value || "",
  };
}

// ── URL Content Extraction ──────────────────────────────────────────────────

/**
 * Fetch a URL and extract its readable text content.
 * @param {string} url — any HTTP/HTTPS URL
 * @returns {Promise<{ title: string, text: string, url: string }>}
 */
async function fetchUrlContent(url) {
  const html = await fetchHtml(url);
  const cheerio = getCheerio();
  const { Readability } = getReadability();

  const $ = cheerio.load(html);

  // Remove scripts, styles, nav, footer, ads
  $("script, style, nav, footer, aside, [role='banner'], [role='navigation'], .ad, .ads, .advertisement").remove();

  // Try @mozilla/readability first (needs a DOM-like object)
  // Since Readability expects a DOM, we create a minimal one from cheerio
  let title = $("title").text().trim() || $("h1").first().text().trim() || "";
  let text = "";

  // Extract text from main content areas
  const mainSelectors = ["main", "article", "[role='main']", ".content", ".post-content", ".entry-content", "#content"];
  for (const sel of mainSelectors) {
    const el = $(sel);
    if (el.length && el.text().trim().length > 100) {
      text = el.text().trim();
      break;
    }
  }

  // Fallback: get body text
  if (!text) {
    text = $("body").text().trim();
  }

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();

  // Truncate very long pages
  if (text.length > 50000) {
    text = text.slice(0, 50000) + "\n\n[Content truncated at 50,000 characters]";
  }

  return { title, text, url };
}

function fetchHtml(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("Too many redirects"));
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return resolve(fetchHtml(next, maxRedirects - 1));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let body = "";
      res.on("data", (chunk) => { body += chunk.toString(); });
      res.on("end", () => resolve(body));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Request timed out")); });
  });
}

// ── Content Source Management ───────────────────────────────────────────────

/**
 * Create a content source entry from extracted text.
 */
function createContentSource(title, text, meta) {
  const id = "ks-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  return {
    id,
    title: title || "Untitled",
    sources: [{
      name: title || "Content",
      content: text,
    }],
    meta: meta || {},  // { pages, url, fileType, fileName }
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Build a grounding context string from active content sources.
 * Prepended to chat messages before routing to the AI provider.
 */
function buildGroundingContext(contentSources) {
  if (!contentSources || contentSources.size === 0) return "";

  const parts = [];
  parts.push("=== KNOWLEDGE CONTEXT (uploaded reference material) ===");
  parts.push("The user has uploaded documents/URLs as research context for this design project.");
  parts.push("Ground your answers in this material when relevant. Cite specific sources by name.\n");

  for (const [id, data] of contentSources) {
    const metaInfo = [];
    if (data.meta?.fileType) metaInfo.push(data.meta.fileType.toUpperCase());
    if (data.meta?.pages) metaInfo.push(`${data.meta.pages} pages`);
    if (data.meta?.url) metaInfo.push(data.meta.url);
    const metaStr = metaInfo.length > 0 ? ` (${metaInfo.join(", ")})` : "";

    parts.push(`--- Source: "${data.title}"${metaStr} ---`);
    for (const src of data.sources) {
      if (src.content) {
        // Truncate per source to keep total tokens manageable
        const truncated = src.content.length > 8000
          ? src.content.slice(0, 8000) + "\n…[truncated]"
          : src.content;
        parts.push(truncated);
      }
    }
    parts.push("");
  }

  parts.push("=== END KNOWLEDGE CONTEXT ===\n");
  return parts.join("\n");
}

// ── Knowledge Hub ───────────────────────────────────────────────────────────

// Cache of parsed hub files: fileName → { id, title, text, meta, parsedAt }
const _hubCache = new Map();

/**
 * Scan the knowledge-hub/ folder and return a catalog of available files.
 * Does NOT parse content — just lists what's available.
 */
function scanKnowledgeHub() {
  if (!fs.existsSync(KNOWLEDGE_HUB_DIR)) return [];

  const files = fs.readdirSync(KNOWLEDGE_HUB_DIR);
  const supported = [".pdf", ".docx", ".doc", ".txt", ".md", ".csv", ".json", ".xml", ".html"];

  return files
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return supported.includes(ext) && !f.startsWith(".");
    })
    .map((f) => {
      const ext = path.extname(f).toLowerCase().replace(".", "");
      const stat = fs.statSync(path.join(KNOWLEDGE_HUB_DIR, f));
      const cached = _hubCache.get(f);
      return {
        fileName: f,
        fileType: ext,
        title: f.replace(/\.\w+$/, "").replace(/[-_]/g, " "),
        sizeBytes: stat.size,
        cached: !!cached,
        preview: cached ? cached.text.slice(0, 200).replace(/\s+/g, " ").trim() : null,
        charCount: cached ? cached.text.length : null,
      };
    });
}

/**
 * Load and parse a specific file from the knowledge hub.
 * Uses cache to avoid re-parsing on every request.
 * Returns a content source ready to add to activeContentSources.
 */
async function loadHubFile(fileName) {
  const filePath = path.join(KNOWLEDGE_HUB_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found in knowledge hub: ${fileName}`);
  }

  // Check cache (invalidate if file changed)
  const stat = fs.statSync(filePath);
  const cached = _hubCache.get(fileName);
  if (cached && cached.mtime === stat.mtimeMs) {
    return createContentSource(cached.title, cached.text, cached.meta);
  }

  // Parse the file
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(fileName).toLowerCase();
  let title, text;
  const meta = { fileName, fileType: ext.replace(".", ""), hubFile: true };

  if (ext === ".pdf") {
    const result = await parsePdfBuffer(buffer);
    title = result.title || fileName.replace(/\.\w+$/, "");
    text = result.text;
    meta.pages = result.pages;
  } else if (ext === ".docx" || ext === ".doc") {
    const result = await parseDocxBuffer(buffer);
    title = result.title || fileName.replace(/\.\w+$/, "");
    text = result.text;
  } else {
    title = fileName.replace(/\.\w+$/, "").replace(/[-_]/g, " ");
    text = buffer.toString("utf-8");
  }

  if (!text || text.trim().length === 0) {
    throw new Error(`No text content could be extracted from: ${fileName}`);
  }

  // Cache the parsed result
  _hubCache.set(fileName, { title, text, meta, mtime: stat.mtimeMs });

  return createContentSource(title, text, meta);
}

/**
 * Search the knowledge hub for files relevant to a query.
 * Simple keyword matching against file names and cached content.
 */
function searchHub(query) {
  const catalog = scanKnowledgeHub();
  if (!query || !query.trim()) return catalog;

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return catalog
    .map((item) => {
      const haystack = (item.title + " " + item.fileName + " " + (item.preview || "")).toLowerCase();
      const score = terms.reduce((s, t) => s + (haystack.includes(t) ? 1 : 0), 0);
      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

module.exports = {
  parsePdfBuffer,
  parseDocxBuffer,
  fetchUrlContent,
  createContentSource,
  buildGroundingContext,
  scanKnowledgeHub,
  loadHubFile,
  searchHub,
  KNOWLEDGE_HUB_DIR,
};
