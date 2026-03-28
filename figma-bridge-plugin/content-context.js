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
      if (res.statusCode !== 200 && res.statusCode !== 202) return reject(new Error(`HTTP ${res.statusCode}`));
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
 * Extract keywords from a query string (shared helper for search & grounding).
 */
function extractKeywords(query) {
  return (query || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Score a text block against keywords. Returns { score, matchedCount }.
 */
function scoreText(text, keywords) {
  const lower = text.toLowerCase();
  let score = 0;
  let matchedCount = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) {
      matchedCount++;
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      score += regex.test(text) ? 2 : 1;
    }
  }
  return { score, matchedCount };
}

/**
 * Extract the most relevant passages from content using keyword scoring.
 * Returns a string of the top passages within the char budget.
 */
function extractRelevantPassages(content, keywords, charBudget) {
  if (!keywords || keywords.length === 0) {
    // No keywords — fall back to truncation
    return content.length > charBudget
      ? content.slice(0, charBudget) + "\n…[truncated]"
      : content;
  }

  const paragraphs = content.split(/\n{2,}/).filter((p) => p.trim().length > 30);
  if (paragraphs.length === 0) {
    return content.slice(0, charBudget);
  }

  // Score each paragraph
  const scored = paragraphs.map((para) => {
    const { score, matchedCount } = scoreText(para, keywords);
    return { para: para.trim(), score, matchedCount };
  });

  // Sort by score descending, keep top paragraphs within budget
  scored.sort((a, b) => b.score - a.score);

  const selected = [];
  let usedChars = 0;
  for (const { para, score } of scored) {
    if (score === 0 && selected.length > 0) break; // Stop adding irrelevant paragraphs
    if (usedChars + para.length > charBudget) {
      if (selected.length === 0) {
        // At least include a truncated version of the best paragraph
        selected.push(para.slice(0, charBudget) + "…");
      }
      break;
    }
    selected.push(para);
    usedChars += para.length;
  }

  return selected.join("\n\n");
}

/**
 * Build a grounding context string from active content sources.
 * Prepended to chat messages before routing to the AI provider.
 *
 * Optimizations:
 * - Relevance filtering: only includes sources with keyword overlap
 * - Adaptive truncation: extracts best paragraphs, not just first N chars
 * - Budget-based: total grounding limited to ~4000 tokens (~16000 chars)
 */
const GROUNDING_CHAR_BUDGET = 16000; // ~4000 tokens total

function buildGroundingContext(contentSources, userQuery) {
  if (!contentSources || contentSources.size === 0) return "";

  const keywords = extractKeywords(userQuery);
  const sourceCount = contentSources.size;
  const perSourceBudget = Math.floor(GROUNDING_CHAR_BUDGET / Math.max(sourceCount, 1));

  // Score each source for relevance
  const scoredSources = [];
  for (const [id, data] of contentSources) {
    let totalScore = 0;
    for (const src of data.sources) {
      if (src.content) {
        const { score } = scoreText(src.content.slice(0, 2000), keywords);
        totalScore += score;
      }
    }
    scoredSources.push({ id, data, score: totalScore });
  }

  // Sort by relevance, filter out zero-score sources (if we have keywords)
  scoredSources.sort((a, b) => b.score - a.score);
  const relevantSources = keywords.length > 0
    ? scoredSources.filter((s) => s.score > 0)
    : scoredSources;

  // If no relevant sources found, include all (user might ask follow-up)
  const sourcesToInclude = relevantSources.length > 0 ? relevantSources : scoredSources;
  if (sourcesToInclude.length === 0) return "";

  // Redistribute budget to relevant sources only
  const adjustedBudget = Math.floor(GROUNDING_CHAR_BUDGET / sourcesToInclude.length);

  const parts = [];
  parts.push("=== KNOWLEDGE CONTEXT ===");
  parts.push("Cite sources by name when referencing this material.\n");

  for (const { data } of sourcesToInclude) {
    const metaInfo = [];
    if (data.meta?.url) metaInfo.push(data.meta.url);
    const metaStr = metaInfo.length > 0 ? ` (${metaInfo.join(", ")})` : "";

    parts.push(`--- "${data.title}"${metaStr} ---`);
    for (const src of data.sources) {
      if (src.content) {
        const passage = extractRelevantPassages(src.content, keywords, adjustedBudget);
        parts.push(passage);
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

// ── Tier 1: Knowledge Hub Instant Answer ─────────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "must",
  "i", "me", "my", "we", "our", "you", "your", "he", "she", "it",
  "they", "them", "their", "this", "that", "these", "those",
  "what", "which", "who", "whom", "how", "when", "where", "why",
  "and", "or", "but", "not", "no", "nor", "so", "if", "then",
  "of", "in", "on", "at", "to", "for", "with", "by", "from",
  "about", "into", "through", "during", "before", "after",
  "above", "below", "between", "under", "over",
  "just", "also", "very", "too", "more", "most", "some", "any",
  "all", "each", "every", "both", "few", "many", "much",
  "tell", "me", "explain", "describe", "show",
]);

/**
 * Search loaded content sources for a direct answer to a query.
 * Returns a formatted answer with source attribution, or null if no confident match.
 */
function searchContentForAnswer(query, contentSources) {
  if (!query || !contentSources || contentSources.size === 0) return null;

  const keywords = extractKeywords(query);
  if (keywords.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const [, source] of contentSources) {
    for (const src of source.sources) {
      if (!src.content) continue;
      const text = src.content;

      // Split into paragraphs
      const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 50);

      for (const para of paragraphs) {
        const paraLower = para.toLowerCase();
        let score = 0;
        let matchedKeywords = 0;

        for (const kw of keywords) {
          if (paraLower.includes(kw)) {
            matchedKeywords++;
            // Bonus for exact word boundary match
            const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
            score += regex.test(para) ? 2 : 1;
          }
        }

        // Require at least 3 keyword hits or 60% of keywords matched
        const matchRatio = matchedKeywords / keywords.length;
        if (matchedKeywords >= 3 || (keywords.length <= 3 && matchRatio >= 0.6)) {
          if (score > bestScore) {
            bestScore = score;
            bestMatch = {
              text: para.trim(),
              title: source.title,
              meta: source.meta,
            };
          }
        }
      }
    }
  }

  if (!bestMatch) return null;

  // Format the answer with source attribution
  const snippet = bestMatch.text.length > 1500
    ? bestMatch.text.slice(0, 1500) + "..."
    : bestMatch.text;

  const metaInfo = [];
  if (bestMatch.meta?.fileType) metaInfo.push(bestMatch.meta.fileType.toUpperCase());
  if (bestMatch.meta?.pages) metaInfo.push(`${bestMatch.meta.pages} pages`);
  const metaStr = metaInfo.length > 0 ? ` (${metaInfo.join(", ")})` : "";

  return {
    text: `**From "${bestMatch.title}"**${metaStr}:\n\n> ${snippet}\n\n_Source: "${bestMatch.title}"_`,
    sources: [{ title: bestMatch.title, meta: bestMatch.meta }],
  };
}

// ── Tier 2: Web Reference Search ─────────────────────────────────────────────

// Default reference sites — starts empty, users add via UI
// NN/g is suggested in the UI but not auto-enabled to avoid blocking chat
let referenceSites = [];

// Article cache: url → { title, text, fetchedAt }
const _articleCache = new Map();
const ARTICLE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getReferenceSites() {
  return [...referenceSites];
}

function addReferenceSite(site) {
  const id = "ref-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  const entry = {
    id,
    name: site.name || site.searchDomain || "Reference",
    baseUrl: site.baseUrl || site.url || "",
    searchDomain: site.searchDomain || extractDomain(site.baseUrl || site.url || ""),
  };
  referenceSites.push(entry);
  return entry;
}

function removeReferenceSite(id) {
  referenceSites = referenceSites.filter((s) => s.id !== id);
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}

/**
 * Search configured reference sites for articles relevant to a query.
 * Uses DuckDuckGo HTML search (no API key needed).
 * Returns a formatted answer with link, or null if no match.
 */
async function searchReferenceSites(query) {
  if (!query || referenceSites.length === 0) return null;

  // Try each reference site
  for (const site of referenceSites) {
    try {
      const result = await searchSingleSite(query, site);
      if (result) return result;
    } catch (err) {
      console.error(`[web-ref] Error searching ${site.name}: ${err.message}`);
    }
  }
  return null;
}

async function searchSingleSite(query, site) {
  const searchQuery = `site:${site.searchDomain} ${query}`;
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

  // Fetch DuckDuckGo search results
  let html;
  try {
    html = await fetchHtml(searchUrl);
  } catch (err) {
    console.error(`[web-ref] DuckDuckGo search failed: ${err.message}`);
    return null;
  }

  // Parse results to extract article URLs
  const cheerio = getCheerio();
  const $ = cheerio.load(html);
  const resultLinks = [];

  $("a.result__a").each((i, el) => {
    const href = $(el).attr("href") || "";
    const title = $(el).text().trim();
    // DuckDuckGo wraps URLs in a redirect — extract the actual URL
    const urlMatch = href.match(/uddg=([^&]+)/);
    const actualUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : href;
    if (actualUrl.includes(site.searchDomain) && title) {
      resultLinks.push({ url: actualUrl, title });
    }
  });

  if (resultLinks.length === 0) return null;

  const topResult = resultLinks[0];

  // Check article cache
  const cached = _articleCache.get(topResult.url);
  if (cached && Date.now() - cached.fetchedAt < ARTICLE_CACHE_TTL) {
    return formatWebAnswer(cached.title, cached.text, topResult.url, site.name);
  }

  // Fetch and extract article content
  try {
    const article = await fetchUrlContent(topResult.url);
    const articleText = article.text.slice(0, 3000); // Truncate for answer
    const articleTitle = article.title || topResult.title;

    // Cache the article
    _articleCache.set(topResult.url, {
      title: articleTitle,
      text: articleText,
      fetchedAt: Date.now(),
    });

    return formatWebAnswer(articleTitle, articleText, topResult.url, site.name);
  } catch (err) {
    console.error(`[web-ref] Failed to fetch article: ${err.message}`);
    return null;
  }
}

function formatWebAnswer(title, text, url, siteName) {
  // Extract the most relevant paragraphs (first ~1500 chars)
  const excerpt = text.length > 1500 ? text.slice(0, 1500) + "..." : text;

  return {
    text: `**From ${siteName}:**\n\n**[${title}](${url})**\n\n> ${excerpt}\n\n_[Read full article](${url})_`,
    url,
    title,
    siteName,
  };
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
  searchContentForAnswer,
  searchReferenceSites,
  getReferenceSites,
  addReferenceSite,
  removeReferenceSite,
  KNOWLEDGE_HUB_DIR,
};
