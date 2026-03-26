export declare class CodeGenerator {
    /**
     * Write generated code files to the workspace.
     * Returns array of absolute paths that were written.
     */
    writeFiles(files: Array<{
        path: string;
        content: string;
    }>, outputDir: string): Promise<string[]>;
    private getWorkspaceRoot;
}
