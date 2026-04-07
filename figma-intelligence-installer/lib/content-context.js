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
 * Extract keywords from a query string, including bigrams for compound concepts.
 * E.g., "design system components" → ["design system", "design", "system", "components"]
 */
function extractKeywords(query) {
  const words = (query || "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Generate bigrams for multi-word concepts
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(words[i] + " " + words[i + 1]);
  }

  // Return bigrams first (higher specificity), then unigrams
  return [...bigrams, ...words];
}

/**
 * Score a text block against keywords using TF-IDF-like weighting.
 * Bigrams score 4x (more specific), word-boundary matches score 2x,
 * substring matches score 1x. Multiple occurrences add diminishing returns.
 */
function scoreText(text, keywords) {
  const lower = text.toLowerCase();
  let score = 0;
  let matchedCount = 0;
  const uniqueMatches = new Set();

  for (const kw of keywords) {
    if (!lower.includes(kw)) continue;

    const isBigram = kw.includes(" ");
    const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = text.match(regex);

    if (matches) {
      // Count unique keyword roots matched
      if (isBigram) {
        kw.split(" ").forEach((w) => uniqueMatches.add(w));
      } else {
        uniqueMatches.add(kw);
      }

      // Score: bigrams are worth more (more specific match)
      const baseScore = isBigram ? 4 : 2;
      // Diminishing returns for repeated matches: 1st=full, 2nd=half, 3rd+=quarter
      const occurrences = Math.min(matches.length, 5);
      score += baseScore + Math.min(occurrences - 1, 3) * (baseScore * 0.25);
    } else {
      // Substring match (less precise)
      uniqueMatches.add(isBigram ? kw.split(" ")[0] : kw);
      score += isBigram ? 2 : 0.5;
    }
  }

  matchedCount = uniqueMatches.size;
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

  // For chunked sources: score individual chunks and pick the best ones globally
  // For non-chunked sources: sample multiple positions (not just first 2000 chars)
  const allScoredChunks = []; // { sourceTitle, chunkTitle, content, score, meta }

  for (const [id, data] of contentSources) {
    if (data.isChunked && data.sources.length > 1) {
      // Chunked source: score each chunk individually
      // Extract unigrams for pre-filter (bigrams are checked in full scoring)
      const unigrams = keywords.filter((k) => !k.includes(" "));

      for (const src of data.sources) {
        if (!src.content) continue;
        // Pre-filter: check if any unigrams match stored chunk keywords
        let preScore = 0;
        if (src.keywords && unigrams.length > 0) {
          for (const kw of unigrams) {
            // Exact match on stored keywords (not substring)
            if (src.keywords.includes(kw)) {
              preScore += 2;
            } else if (src.keywords.some((ck) => ck.includes(kw))) {
              preScore += 0.5;
            }
          }
        }
        // Full text scoring for chunks that passed pre-filter
        if (preScore > 0 || keywords.length === 0) {
          const { score: textScore, matchedCount } = scoreText(src.content.slice(0, 4000), keywords);
          const totalScore = preScore + textScore;
          if (totalScore > 0 || keywords.length === 0) {
            allScoredChunks.push({
              sourceTitle: data.title,
              chunkTitle: src.title || data.title,
              content: src.content,
              score: totalScore,
              matchedCount,
              meta: data.meta,
            });
          }
        }
      }
    } else {
      // Non-chunked source: sample multiple positions across the content
      for (const src of data.sources) {
        if (!src.content) continue;
        let totalScore = 0;
        const len = src.content.length;
        const sampleSize = 2000;
        const positions = [0, Math.floor(len * 0.25), Math.floor(len * 0.5), Math.floor(len * 0.75)];
        for (const pos of positions) {
          const { score } = scoreText(src.content.slice(pos, pos + sampleSize), keywords);
          totalScore += score;
        }
        allScoredChunks.push({
          sourceTitle: data.title,
          chunkTitle: data.title,
          content: src.content,
          score: totalScore,
          meta: data.meta,
        });
      }
    }
  }

  if (allScoredChunks.length === 0) return "";

  // Sort all chunks by score, take the best ones within budget
  allScoredChunks.sort((a, b) => b.score - a.score);

  // Filter to relevant chunks (score > 0) if we have keywords
  const relevant = keywords.length > 0
    ? allScoredChunks.filter((c) => c.score > 0)
    : allScoredChunks;

  const chunksToInclude = relevant.length > 0 ? relevant : allScoredChunks.slice(0, 5);

  const parts = [];
  parts.push("=== KNOWLEDGE CONTEXT ===");
  parts.push("The following excerpts are from the user's knowledge library. Use them to provide accurate, well-sourced answers. Synthesize the information — do not dump raw text.\n");

  let usedChars = 0;
  let currentSource = "";

  for (const chunk of chunksToInclude) {
    if (usedChars >= GROUNDING_CHAR_BUDGET) break;

    // Add source header if it changed
    if (chunk.sourceTitle !== currentSource) {
      const metaInfo = [];
      if (chunk.meta?.url) metaInfo.push(chunk.meta.url);
      const metaStr = metaInfo.length > 0 ? ` (${metaInfo.join(", ")})` : "";
      parts.push(`\n--- "${chunk.sourceTitle}"${metaStr} ---`);
      currentSource = chunk.sourceTitle;
    }

    // Add chunk heading if different from source title
    if (chunk.chunkTitle && chunk.chunkTitle !== chunk.sourceTitle) {
      parts.push(`\n### ${chunk.chunkTitle}`);
    }

    const remaining = GROUNDING_CHAR_BUDGET - usedChars;
    const passage = extractRelevantPassages(chunk.content, keywords, remaining);
    parts.push(passage);
    usedChars += passage.length;
  }

  parts.push("\n=== END KNOWLEDGE CONTEXT ===\n");
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
      if (f.startsWith(".")) return false;
      // Prefer .chunks.json — hide the original PDF if a chunks file exists
      if (f.endsWith(".chunks.json")) return true;
      const ext = path.extname(f).toLowerCase();
      if (!supported.includes(ext)) return false;
      // Hide PDFs that have been converted to chunks
      if (ext === ".pdf") {
        const slug = f.replace(/\.pdf$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (files.includes(`${slug}.chunks.json`)) return false;
      }
      return true;
    })
    .map((f) => {
      const isChunks = f.endsWith(".chunks.json");
      const ext = isChunks ? "chunks" : path.extname(f).toLowerCase().replace(".", "");
      const stat = fs.statSync(path.join(KNOWLEDGE_HUB_DIR, f));
      const cached = _hubCache.get(f);

      let title = f.replace(/\.chunks\.json$/, "").replace(/\.\w+$/, "").replace(/[-_]/g, " ");
      let charCount = cached ? cached.totalChars || cached.text?.length : null;
      let preview = cached ? (cached.preview || (cached.text || "").slice(0, 200)).replace(/\s+/g, " ").trim() : null;

      // For chunks files, read title from the JSON metadata
      if (isChunks && !cached) {
        try {
          const meta = JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_HUB_DIR, f), "utf8"));
          title = meta.title || title;
          charCount = meta.totalChars || null;
          preview = meta.chunks?.[0]?.text?.slice(0, 200)?.replace(/\s+/g, " ")?.trim() || null;
        } catch {}
      } else if (isChunks && cached) {
        title = cached.title || title;
      }

      return {
        fileName: f,
        fileType: ext,
        title,
        sizeBytes: stat.size,
        cached: !!cached,
        preview,
        charCount,
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
    if (cached.chunks) {
      // Return chunked source (multi-source for chunk-level scoring)
      return createChunkedContentSource(cached.title, cached.chunks, cached.meta);
    }
    return createContentSource(cached.title, cached.text, cached.meta);
  }

  // Handle .chunks.json files (pre-indexed, instant load)
  if (fileName.endsWith(".chunks.json")) {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const meta = {
      fileName,
      fileType: "chunks",
      hubFile: true,
      pages: data.pages,
      source: data.source,
      chunkCount: data.chunks.length,
    };

    // Cache the chunks
    _hubCache.set(fileName, {
      title: data.title,
      chunks: data.chunks,
      totalChars: data.totalChars,
      preview: data.chunks[0]?.text?.slice(0, 200) || "",
      meta,
      mtime: stat.mtimeMs,
    });

    return createChunkedContentSource(data.title, data.chunks, meta);
  }

  // Parse the file (PDF, DOCX, plain text)
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
 * Create a content source from pre-chunked data.
 * Each chunk becomes a separate source entry for chunk-level scoring.
 */
function createChunkedContentSource(title, chunks, meta) {
  return {
    id: "hub-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    title,
    sources: chunks.map((chunk) => ({
      title: chunk.heading || title,
      content: chunk.text,
      keywords: chunk.keywords || [],
    })),
    meta: meta || {},
    extractedAt: new Date().toISOString(),
    isChunked: true,
  };
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
  "and", "or", "but", "not", "no", "nor", "so", "if", "then",
  "of", "in", "on", "at", "to", "for", "with", "by", "from",
  "about", "into", "through", "during", "before", "after",
  "above", "below", "between", "under", "over",
  "just", "also", "very", "too", "more", "most", "some", "any",
  "all", "each", "every", "both", "few", "many", "much",
  "tell", "explain", "describe", "show",
]);

/**
 * Search loaded content sources for a direct answer to a query.
 * Scores ALL paragraphs globally, returns the top matches with surrounding context.
 */
function searchContentForAnswer(query, contentSources) {
  if (!query || !contentSources || contentSources.size === 0) return null;

  const keywords = extractKeywords(query);
  if (keywords.length === 0) return null;

  // Count only unique unigrams for threshold (bigrams are bonus)
  const uniqueKeywords = keywords.filter((k) => !k.includes(" "));
  const minMatches = Math.max(2, Math.ceil(uniqueKeywords.length * 0.4));

  // Score ALL paragraphs globally
  const candidates = [];

  for (const [, source] of contentSources) {
    for (const src of source.sources) {
      if (!src.content) continue;
      const paragraphs = src.content.split(/\n{2,}/).filter((p) => p.trim().length > 40);

      for (let pi = 0; pi < paragraphs.length; pi++) {
        const para = paragraphs[pi];
        const { score, matchedCount } = scoreText(para, keywords);

        if (matchedCount >= minMatches) {
          // Include surrounding context (previous + next paragraph) for better answers
          const contextParts = [];
          if (pi > 0 && paragraphs[pi - 1].trim().length > 30) {
            contextParts.push(paragraphs[pi - 1].trim());
          }
          contextParts.push(para.trim());
          if (pi < paragraphs.length - 1 && paragraphs[pi + 1].trim().length > 30) {
            contextParts.push(paragraphs[pi + 1].trim());
          }

          candidates.push({
            text: contextParts.join("\n\n"),
            mainPara: para.trim(),
            score,
            matchedCount,
            title: src.title || source.title,
            sourceTitle: source.title,
            meta: source.meta,
          });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Sort by score descending, take top 3 for a richer answer
  candidates.sort((a, b) => b.score - a.score);
  const topMatches = candidates.slice(0, 3);

  // Deduplicate overlapping text
  const seen = new Set();
  const uniqueMatches = topMatches.filter((m) => {
    const key = m.mainPara.slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Format the answer
  const parts = [];
  for (const match of uniqueMatches) {
    const snippet = match.text.length > 1200
      ? match.text.slice(0, 1200) + "..."
      : match.text;

    const heading = match.title !== match.sourceTitle
      ? `**From "${match.sourceTitle}" — ${match.title}**`
      : `**From "${match.sourceTitle}"**`;

    parts.push(`${heading}:\n\n> ${snippet}`);
  }

  const metaInfo = [];
  if (uniqueMatches[0].meta?.fileType) metaInfo.push(uniqueMatches[0].meta.fileType.toUpperCase());
  if (uniqueMatches[0].meta?.pages) metaInfo.push(`${uniqueMatches[0].meta.pages} pages`);
  const metaStr = metaInfo.length > 0 ? ` (${metaInfo.join(", ")})` : "";

  return {
    text: parts.join("\n\n---\n\n") + `\n\n_Sources: ${[...new Set(uniqueMatches.map((m) => `"${m.sourceTitle}"`))].join(", ")}${metaStr}_`,
    sources: uniqueMatches.map((m) => ({ title: m.sourceTitle, meta: m.meta })),
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

/**
 * Pre-warm the hub cache by loading all .chunks.json files.
 * Call on relay startup for instant first-query response.
 */
async function prewarmHub() {
  const catalog = scanKnowledgeHub();
  let loaded = 0;
  for (const file of catalog) {
    if (file.fileName.endsWith(".chunks.json")) {
      try {
        await loadHubFile(file.fileName);
        loaded++;
      } catch {}
    }
  }
  return loaded;
}

module.exports = {
  parsePdfBuffer,
  parseDocxBuffer,
  fetchUrlContent,
  createContentSource,
  createChunkedContentSource,
  buildGroundingContext,
  scanKnowledgeHub,
  loadHubFile,
  searchHub,
  searchContentForAnswer,
  searchReferenceSites,
  getReferenceSites,
  addReferenceSite,
  removeReferenceSite,
  prewarmHub,
  KNOWLEDGE_HUB_DIR,
};
