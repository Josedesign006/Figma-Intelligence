import * as vscode from "vscode";
import { join, dirname } from "path";
import { mkdirSync, writeFileSync, existsSync } from "fs";

export class CodeGenerator {
  /**
   * Write generated code files to the workspace.
   * Returns array of absolute paths that were written.
   */
  async writeFiles(
    files: Array<{ path: string; content: string }>,
    outputDir: string
  ): Promise<string[]> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showWarningMessage(
        "No workspace folder open. Cannot write component files."
      );
      return [];
    }

    const writtenPaths: string[] = [];
    const baseDir = join(workspaceRoot, outputDir);

    for (const file of files) {
      try {
        const fullPath = join(baseDir, file.path);
        const dir = dirname(fullPath);

        // Create directory if needed
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        // Check if file already exists
        if (existsSync(fullPath)) {
          const overwrite = await vscode.window.showWarningMessage(
            `File already exists: ${file.path}`,
            "Overwrite",
            "Skip"
          );
          if (overwrite !== "Overwrite") {
            continue;
          }
        }

        writeFileSync(fullPath, file.content, "utf8");
        writtenPaths.push(fullPath);
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `Failed to write ${file.path}: ${err.message}`
        );
      }
    }

    return writtenPaths;
  }

  private getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return null;
    }
    return folders[0].uri.fsPath;
  }
}
