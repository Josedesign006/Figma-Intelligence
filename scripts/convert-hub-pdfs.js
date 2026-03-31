#!/usr/bin/env node
/**
 * convert-hub-pdfs.js — One-time converter: PDF → chunked JSON
 *
 * Reads each PDF in knowledge-hub/, splits into chapter-sized chunks,
 * and outputs .chunks.json files for instant loading by the bridge relay.
 *
 * Usage: node scripts/convert-hub-pdfs.js
 */

const fs = require("fs");
const path = require("path");

const HUB_DIR = path.resolve(__dirname, "..", "figma-bridge-plugin", "knowledge-hub");

// Lazy-load pdf-parse from the bridge plugin's node_modules
let pdfParse;
function getPdfParse() {
  if (!pdfParse) {
    const bridgeModules = path.resolve(__dirname, "..", "figma-bridge-plugin", "node_modules", "pdf-parse");
    pdfParse = require(bridgeModules);
  }
  return pdfParse;
}

// ── Text Cleaning ──────────────────────────────────────────────────────────

/**
 * Clean OCR artifacts and PDF extraction noise from raw text.
 */
function cleanExtractedText(text) {
  return text
    // Remove page markers like "-- 1 of 320 --"
    .replace(/\n-- \d+ of \d+ --\n/g, "\n\n")
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    // Remove standalone page numbers (line that's just a number)
    .replace(/^\s*\d{1,4}\s*$/gm, "")
    // Remove OCR garbage: sequences of random mixed-case letters/numbers that aren't real words
    // e.g. "12ChapterC 20Ct.Ipnoddu" → removed
    .replace(/\b\d+[A-Z][a-z]+[A-Z]\s+\d+[A-Z][a-z]+\.\w+\b/g, "")
    // Remove repeated header/footer text (same line appearing every ~50 lines)
    .replace(/^(.{10,80})\n(?:.*\n){20,80}\1$/gm, (match, header) => {
      return match.replace(new RegExp("^" + header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "gm"), "");
    })
    // Remove tab-heavy lines (likely table-of-contents remnants)
    .replace(/^[^\n]*\t{2,}[^\n]*$/gm, "")
    // Clean up excessive whitespace
    .replace(/\n{4,}/g, "\n\n\n")
    // Remove leading/trailing whitespace per line
    .replace(/^[ \t]+|[ \t]+$/gm, (m) => m.length > 8 ? "" : m)
    .trim();
}

/**
 * Additional cleaning for individual chunk text.
 */
function cleanChunkText(text) {
  return text
    // Remove lines that are just numbers (page numbers caught inside chunks)
    .replace(/^\s*\d{1,4}\s*$/gm, "")
    // Remove very short lines that are likely headers/footers (< 5 chars, not part of content)
    .replace(/^.{1,3}$/gm, "")
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Heading Detection ──────────────────────────────────────────────────────

/**
 * Detect chapter/section headings in extracted PDF text.
 * Returns an array of { heading, startIndex }.
 */
function detectHeadings(text) {
  const lines = text.split("\n");
  const headings = [];
  let charPos = 0;

  // First pass: detect TOC-like blocks and skip them
  // TOC lines typically have dots or tabs between title and page number
  const tocLinePattern = /^.{5,60}\s*\.{3,}\s*\d+\s*$/;
  const tocRegions = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (tocLinePattern.test(lines[i].trim())) {
      // Mark a window around this line as TOC
      for (let j = Math.max(0, i - 2); j < Math.min(lines.length, i + 3); j++) {
        tocRegions.add(j);
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = (lines[i + 1] || "").trim();
    const prevLine = i > 0 ? lines[i - 1].trim() : "";

    // Skip TOC regions
    if (tocRegions.has(i)) {
      charPos += lines[i].length + 1;
      continue;
    }

    // Skip lines with tabs (likely TOC entries) like "Chapter 07. \tAppendix \t142"
    if (/\t/.test(line)) {
      charPos += lines[i].length + 1;
      continue;
    }

    // Skip very short or empty lines
    if (line.length < 4) {
      charPos += lines[i].length + 1;
      continue;
    }

    // Pattern 1: "Chapter N" or "CHAPTER N" or "Part N" (without page numbers or tabs)
    if (/^(chapter|part)\s+\d+[.:)]\s*/i.test(line) && line.length < 120 && !/\d+$/.test(line.replace(/^.*\d+[.:)]\s*/, ""))) {
      headings.push({ heading: line, startIndex: charPos });
    }
    // Pattern 2: Numbered heading like "1. Introduction" or "1.1 Overview"
    else if (/^\d+(\.\d+)?\s+[A-Z]/.test(line) && line.length < 120 && line.length > 5) {
      // Exclude lines that end with just a page number (TOC entries)
      if (!/\s+\d{1,3}\s*$/.test(line)) {
        headings.push({ heading: line, startIndex: charPos });
      }
    }
    // Pattern 3: ALL CAPS line (likely a section heading), short and followed by content
    else if (
      line.length > 3 &&
      line.length < 80 &&
      line === line.toUpperCase() &&
      /[A-Z]{3,}/.test(line) &&
      !/^\d+$/.test(line) && // Not just numbers
      nextLine.length > 30
    ) {
      headings.push({ heading: line, startIndex: charPos });
    }
    // Pattern 4: Title-case line that's short, preceded by blank line, followed by content
    else if (
      line.length > 5 &&
      line.length < 100 &&
      /^[A-Z][a-z]/.test(line) &&
      !line.endsWith(".") &&
      !line.endsWith(",") &&
      nextLine.length > 50 &&
      prevLine === ""
    ) {
      headings.push({ heading: line, startIndex: charPos });
    }

    charPos += lines[i].length + 1;
  }

  return headings;
}

// ── Chunking ───────────────────────────────────────────────────────────────

/**
 * Split text into chunks based on detected headings.
 * Falls back to paragraph-based splitting if no headings found.
 */
function chunkText(text, headings, targetChunkSize = 2000) {
  const chunks = [];

  if (headings.length > 0) {
    // Handle text before first heading
    if (headings[0].startIndex > 200) {
      const preface = text.slice(0, headings[0].startIndex).trim();
      if (preface.length > 100) {
        chunks.push({
          heading: "Introduction / Preface",
          text: cleanChunkText(preface),
        });
      }
    }

    // Split by headings
    for (let i = 0; i < headings.length; i++) {
      const start = headings[i].startIndex;
      const end = i + 1 < headings.length ? headings[i + 1].startIndex : text.length;
      const raw = text.slice(start, end).trim();
      const cleaned = cleanChunkText(raw);

      if (cleaned.length < 80) continue;

      if (cleaned.length > targetChunkSize * 2) {
        const subChunks = splitByParagraphs(cleaned, targetChunkSize, headings[i].heading);
        chunks.push(...subChunks);
      } else {
        chunks.push({ heading: headings[i].heading, text: cleaned });
      }
    }
  } else {
    const subChunks = splitByParagraphs(text, targetChunkSize, "Section");
    chunks.push(...subChunks);
  }

  return chunks;
}

/**
 * Split a block of text into chunks by paragraph boundaries.
 */
function splitByParagraphs(text, targetSize, parentHeading) {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 30);
  const chunks = [];
  let currentText = "";
  let chunkIndex = 1;

  for (const para of paragraphs) {
    if (currentText.length + para.length > targetSize && currentText.length > 200) {
      chunks.push({
        heading: `${parentHeading} (part ${chunkIndex})`,
        text: cleanChunkText(currentText),
      });
      currentText = "";
      chunkIndex++;
    }
    currentText += para + "\n\n";
  }

  if (currentText.trim().length > 80) {
    chunks.push({
      heading: chunks.length > 0 ? `${parentHeading} (part ${chunkIndex})` : parentHeading,
      text: cleanChunkText(currentText),
    });
  }

  return chunks;
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

/**
 * Extract top keywords from a chunk, including bigrams for compound concepts.
 * Filters OCR garbage (non-dictionary-like words).
 */
function extractChunkKeywords(text, maxKeywords = 15) {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => {
      if (w.length < 3) return false;
      if (STOP_WORDS.has(w)) return false;
      // Filter OCR garbage: words with unusual character patterns
      // Real words are mostly lowercase letters; OCR produces mixed case/numbers
      if (/\d/.test(w) && /[a-z]/i.test(w) && w.length > 6) return false; // "12chapterc"
      if (/[A-Z].*[a-z].*[A-Z]/.test(w)) return false; // "ChapterC"
      return true;
    });

  // Count word frequency
  const freq = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  // Extract bigrams for compound concepts (e.g., "design system", "user experience")
  const bigramFreq = {};
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + " " + words[i + 1];
    // Only keep bigrams where both words appear frequently
    if ((freq[words[i]] || 0) >= 2 && (freq[words[i + 1]] || 0) >= 2) {
      bigramFreq[bigram] = (bigramFreq[bigram] || 0) + 1;
    }
  }

  // Combine: prefer bigrams (more specific), then unigrams
  const allTerms = [
    ...Object.entries(bigramFreq).filter(([, c]) => c >= 2).map(([term, count]) => ({ term, score: count * 3 })),
    ...Object.entries(freq).map(([term, count]) => ({ term, score: count })),
  ];

  // Sort by score, deduplicate
  allTerms.sort((a, b) => b.score - a.score);
  const seen = new Set();
  const keywords = [];
  for (const { term } of allTerms) {
    if (keywords.length >= maxKeywords) break;
    if (seen.has(term)) continue;
    seen.add(term);
    // Don't add unigram if it's part of an already-added bigram
    if (!term.includes(" ") && keywords.some((k) => k.includes(" ") && k.includes(term))) continue;
    keywords.push(term);
  }

  return keywords;
}

// ── PDF Conversion ─────────────────────────────────────────────────────────

/**
 * Convert a single PDF to chunked JSON.
 */
async function convertPdf(filePath) {
  const fileName = path.basename(filePath);
  const { PDFParse } = getPdfParse();

  console.log(`  Parsing ${fileName}...`);
  const buffer = fs.readFileSync(filePath);
  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const parser = new PDFParse(uint8);
  const result = await parser.getText();

  const rawText = result.text || result.pages.map((p) => p.text).join("\n\n");
  const text = cleanExtractedText(rawText);

  let pdfTitle = "";
  try {
    const info = await parser.getInfo();
    pdfTitle = info?.Title || info?.title || "";
  } catch {}

  // Clean up title if it looks like garbage
  if (pdfTitle && (/[^\x20-\x7E]/.test(pdfTitle) || pdfTitle.length > 150)) {
    pdfTitle = "";
  }

  const numPages = result.total || result.pages?.length || 0;
  console.log(`     ${text.length.toLocaleString()} chars, ${numPages} pages`);

  const headings = detectHeadings(text);
  console.log(`     ${headings.length} headings detected`);

  const chunks = chunkText(text, headings);
  console.log(`     ${chunks.length} chunks created`);

  // Build output
  const output = {
    title: pdfTitle || fileName.replace(/\.pdf$/i, "").replace(/[-_]/g, " "),
    source: fileName,
    pages: numPages,
    totalChars: text.length,
    convertedAt: new Date().toISOString(),
    chunks: chunks.map((chunk, i) => ({
      id: `ch-${String(i + 1).padStart(3, "0")}`,
      heading: chunk.heading,
      text: chunk.text,
      chars: chunk.text.length,
      keywords: extractChunkKeywords(chunk.text),
    })),
  };

  // Write output
  const slug = fileName
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const outPath = path.join(HUB_DIR, `${slug}.chunks.json`);
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  const outSize = fs.statSync(outPath).size;
  console.log(
    `     Wrote ${outPath.split("/").pop()} (${(outSize / 1024).toFixed(0)}KB, ${output.chunks.length} chunks)`
  );

  return { fileName, outPath, chunks: output.chunks.length };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("Converting Knowledge Hub PDFs to chunked JSON...\n");

  if (!fs.existsSync(HUB_DIR)) {
    console.error(`Knowledge hub directory not found: ${HUB_DIR}`);
    process.exit(1);
  }

  const pdfFiles = fs
    .readdirSync(HUB_DIR)
    .filter((f) => f.toLowerCase().endsWith(".pdf"));

  if (pdfFiles.length === 0) {
    console.log("No PDF files found in knowledge-hub/. Nothing to convert.");
    process.exit(0);
  }

  console.log(`Found ${pdfFiles.length} PDF file(s):\n`);

  const results = [];
  for (const pdf of pdfFiles) {
    try {
      const result = await convertPdf(path.join(HUB_DIR, pdf));
      results.push(result);
    } catch (err) {
      console.error(`  Failed to convert ${pdf}: ${err.message}`);
    }
    console.log("");
  }

  console.log("-".repeat(50));
  console.log(`Converted ${results.length}/${pdfFiles.length} PDFs\n`);

  const totalChunks = results.reduce((s, r) => s + r.chunks, 0);
  console.log(`   Total chunks: ${totalChunks}`);
  console.log(`   Chunk files:  ${results.map((r) => path.basename(r.outPath)).join(", ")}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
