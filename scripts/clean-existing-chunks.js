#!/usr/bin/env node
/**
 * clean-existing-chunks.js — Clean up existing .chunks.json files
 *
 * Applies text cleaning (OCR artifact removal, page number stripping)
 * and re-extracts keywords with bigram support.
 *
 * Usage: node scripts/clean-existing-chunks.js
 */

const fs = require("fs");
const path = require("path");

const HUB_DIR = path.resolve(__dirname, "..", "figma-bridge-plugin", "knowledge-hub");

// ── Text Cleaning ──────────────────────────────────────────────────────────

function cleanChunkText(text) {
  return text
    // Remove OCR garbage patterns like "12ChapterC 20Ct.Ipnoddu"
    .replace(/\b\d+[A-Z][a-z]+[A-Z]\s+\d+[A-Z][a-z]+\.\w+\b/g, "")
    // Remove standalone page numbers
    .replace(/^\s*\d{1,4}\s*$/gm, "")
    // Remove tab-heavy lines (TOC remnants)
    .replace(/^[^\n]*\t{2,}[^\n]*$/gm, "")
    // Remove very short noise lines (1-3 chars)
    .replace(/^.{1,3}$/gm, "")
    // Clean up leading line numbers like "3\t" or "142\t"
    .replace(/^\d{1,4}\t/gm, "")
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanHeading(heading) {
  return heading
    // Remove tab-separated content (TOC-style headings like "Chapter 07. \tAppendix \t142")
    .replace(/\t.*/g, "")
    // Remove trailing page numbers
    .replace(/\s+\d{1,4}\s*$/, "")
    // Remove "(part N)" suffix for re-detection
    // Keep it — it's useful for navigation
    .replace(/^\d{1,4}\t/, "")
    .trim();
}

// ── Keyword Extraction ─────────────────────────────────────────────────────

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
  "such", "only", "other", "new", "like", "than", "even",
  "one", "two", "three", "first", "second", "well", "way",
  "use", "used", "using", "make", "made", "see", "get", "take",
  "work", "part", "page", "chapter", "figure", "table",
]);

function extractChunkKeywords(text, maxKeywords = 15) {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => {
      if (w.length < 3) return false;
      if (STOP_WORDS.has(w)) return false;
      // Filter OCR garbage
      if (/\d/.test(w) && /[a-z]/i.test(w) && w.length > 6) return false;
      return true;
    });

  const freq = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  // Bigrams
  const bigramFreq = {};
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + " " + words[i + 1];
    if ((freq[words[i]] || 0) >= 2 && (freq[words[i + 1]] || 0) >= 2) {
      bigramFreq[bigram] = (bigramFreq[bigram] || 0) + 1;
    }
  }

  const allTerms = [
    ...Object.entries(bigramFreq).filter(([, c]) => c >= 2).map(([term, count]) => ({ term, score: count * 3 })),
    ...Object.entries(freq).map(([term, count]) => ({ term, score: count })),
  ];

  allTerms.sort((a, b) => b.score - a.score);
  const seen = new Set();
  const keywords = [];
  for (const { term } of allTerms) {
    if (keywords.length >= maxKeywords) break;
    if (seen.has(term)) continue;
    seen.add(term);
    if (!term.includes(" ") && keywords.some((k) => k.includes(" ") && k.includes(term))) continue;
    keywords.push(term);
  }

  return keywords;
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log("Cleaning existing chunk files...\n");

  if (!fs.existsSync(HUB_DIR)) {
    console.error(`Knowledge hub directory not found: ${HUB_DIR}`);
    process.exit(1);
  }

  const chunkFiles = fs.readdirSync(HUB_DIR).filter((f) => f.endsWith(".chunks.json"));

  if (chunkFiles.length === 0) {
    console.log("No .chunks.json files found.");
    process.exit(0);
  }

  for (const file of chunkFiles) {
    const filePath = path.join(HUB_DIR, file);
    console.log(`Processing ${file}...`);

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    let cleanedChunks = 0;
    let keywordsUpdated = 0;

    for (const chunk of data.chunks) {
      // Clean text
      const originalLen = chunk.text.length;
      chunk.text = cleanChunkText(chunk.text);
      chunk.chars = chunk.text.length;
      if (chunk.text.length !== originalLen) cleanedChunks++;

      // Clean heading
      chunk.heading = cleanHeading(chunk.heading);

      // Re-extract keywords
      const oldKeywords = chunk.keywords || [];
      chunk.keywords = extractChunkKeywords(chunk.text);
      if (JSON.stringify(oldKeywords) !== JSON.stringify(chunk.keywords)) keywordsUpdated++;
    }

    // Remove empty chunks
    const before = data.chunks.length;
    data.chunks = data.chunks.filter((c) => c.text.length > 50);
    const removed = before - data.chunks.length;

    // Re-index chunk IDs
    data.chunks.forEach((c, i) => {
      c.id = `ch-${String(i + 1).padStart(3, "0")}`;
    });

    // Recalculate totalChars
    data.totalChars = data.chunks.reduce((s, c) => s + c.chars, 0);

    // Write back
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    console.log(`  ${cleanedChunks} chunks cleaned, ${keywordsUpdated} keywords updated, ${removed} empty chunks removed`);
    console.log(`  ${data.chunks.length} chunks remaining (${(data.totalChars / 1000).toFixed(0)}K chars)\n`);
  }

  console.log("Done.");
}

main();
