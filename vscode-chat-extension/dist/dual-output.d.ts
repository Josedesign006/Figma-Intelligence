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
interface CodeFile {
    path: string;
    content: string;
}
export declare class DualOutputParser {
    private buffer;
    private codeFiles;
    private insideCodeBlock;
    private currentFilePath;
    private currentCodeContent;
    reset(): void;
    /**
     * Feed a text delta into the parser.
     * Returns the non-code text that should be displayed in chat.
     */
    feed(delta: string): {
        text: string;
    };
    /**
     * Flush any remaining buffer content.
     */
    flush(): string;
    /**
     * Get all extracted code files.
     */
    getCodeFiles(): CodeFile[];
}
export {};
