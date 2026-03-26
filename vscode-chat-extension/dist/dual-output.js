"use strict";
/**
 * dual-output.ts — Parses AI stream for CODE_OUTPUT markers.
 *
 * When Claude responds in dual mode, code files are wrapped in:
 *   <!-- FIGMA_INTELLIGENCE_CODE_OUTPUT: path/to/File.tsx -->
 *   ```tsx
 *   // code content
 *   ```
 *   <!-- /FIGMA_INTELLIGENCE_CODE_OUTPUT -->
 *
 * This parser extracts those blocks and passes through regular text.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DualOutputParser = void 0;
const CODE_START_MARKER = /<!-- FIGMA_INTELLIGENCE_CODE_OUTPUT:\s*(.+?)\s*-->/;
const CODE_END_MARKER = /<!-- \/FIGMA_INTELLIGENCE_CODE_OUTPUT\s*-->/;
class DualOutputParser {
    constructor() {
        this.buffer = "";
        this.codeFiles = [];
        this.insideCodeBlock = false;
        this.currentFilePath = "";
        this.currentCodeContent = "";
    }
    reset() {
        this.buffer = "";
        this.codeFiles = [];
        this.insideCodeBlock = false;
        this.currentFilePath = "";
        this.currentCodeContent = "";
    }
    /**
     * Feed a text delta into the parser.
     * Returns the non-code text that should be displayed in chat.
     */
    feed(delta) {
        this.buffer += delta;
        let displayText = "";
        // Process complete lines
        while (true) {
            const newlineIdx = this.buffer.indexOf("\n");
            if (newlineIdx === -1)
                break;
            const line = this.buffer.substring(0, newlineIdx + 1);
            this.buffer = this.buffer.substring(newlineIdx + 1);
            if (this.insideCodeBlock) {
                // Check for end marker
                if (CODE_END_MARKER.test(line)) {
                    // Strip the code fence markers (```lang and ```)
                    let code = this.currentCodeContent;
                    // Remove opening fence line
                    code = code.replace(/^```\w*\n/, "");
                    // Remove closing fence line
                    code = code.replace(/\n```\s*$/, "");
                    code = code.replace(/```\s*$/, "");
                    this.codeFiles.push({
                        path: this.currentFilePath,
                        content: code.trim(),
                    });
                    this.insideCodeBlock = false;
                    this.currentFilePath = "";
                    this.currentCodeContent = "";
                }
                else {
                    this.currentCodeContent += line;
                }
            }
            else {
                // Check for start marker
                const startMatch = line.match(CODE_START_MARKER);
                if (startMatch) {
                    this.insideCodeBlock = true;
                    this.currentFilePath = startMatch[1].trim();
                    this.currentCodeContent = "";
                }
                else {
                    displayText += line;
                }
            }
        }
        // If not inside a code block, check if remaining buffer has a partial marker
        if (!this.insideCodeBlock) {
            // Check if buffer could be the start of a marker
            if (this.buffer.length > 0 &&
                !this.buffer.startsWith("<!") &&
                !this.buffer.includes("<!--")) {
                displayText += this.buffer;
                this.buffer = "";
            }
        }
        return { text: displayText };
    }
    /**
     * Flush any remaining buffer content.
     */
    flush() {
        const remaining = this.buffer;
        this.buffer = "";
        return this.insideCodeBlock ? "" : remaining;
    }
    /**
     * Get all extracted code files.
     */
    getCodeFiles() {
        return [...this.codeFiles];
    }
}
exports.DualOutputParser = DualOutputParser;
//# sourceMappingURL=dual-output.js.map