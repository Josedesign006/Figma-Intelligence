import * as vscode from "vscode";
import { existsSync } from "fs";
import { join, basename } from "path";
import { createServer, Server, IncomingMessage, ServerResponse } from "http";
import { readFileSync } from "fs";

export class PreviewServer {
  private server: Server | null = null;
  private port = 3210;
  private running = false;
  private servingDir = "";

  async toggle() {
    if (this.running) {
      this.stop();
    } else {
      vscode.window.showInformationMessage(
        "No active preview. Use Design + Code mode to generate a component first."
      );
    }
  }

  /**
   * Open the generated preview.html in VS Code's Simple Browser.
   * Starts a tiny local HTTP server so the preview works with all features.
   */
  async openPreview(files: string[]) {
    // Look for preview.html among generated files
    const previewFile = files.find((f) => basename(f) === "preview.html");

    if (previewFile && existsSync(previewFile)) {
      // Start a simple HTTP server to serve the preview
      const dir = join(previewFile, "..");
      await this.startServer(dir);

      const url = `http://localhost:${this.port}/preview.html`;

      // Open in VS Code Simple Browser panel (side by side with editor)
      try {
        await vscode.commands.executeCommand(
          "simpleBrowser.api.open",
          vscode.Uri.parse(url),
          {
            viewColumn: vscode.ViewColumn.Beside,
            preserveFocus: false,
          }
        );
      } catch {
        // Fallback: open in external browser
        vscode.env.openExternal(vscode.Uri.parse(url));
      }
      return;
    }

    // Fallback: open the main component file
    const componentFile = files.find(
      (f) =>
        f.endsWith(".tsx") &&
        !f.endsWith(".stories.tsx") &&
        !f.endsWith(".test.tsx")
    );
    if (componentFile) {
      const uri = vscode.Uri.file(componentFile);
      await vscode.window.showTextDocument(uri);
    }
  }

  private async startServer(dir: string): Promise<void> {
    // Reuse if already serving the same directory
    if (this.running && this.servingDir === dir) return;

    // Stop any existing server
    this.stop();

    this.servingDir = dir;

    return new Promise((resolve) => {
      this.server = createServer(
        (req: IncomingMessage, res: ServerResponse) => {
          const fileName = (req.url || "/").split("?")[0].replace(/^\//, "") || "preview.html";
          const filePath = join(dir, fileName);

          if (existsSync(filePath)) {
            const ext = fileName.split(".").pop() || "";
            const mimeTypes: Record<string, string> = {
              html: "text/html",
              css: "text/css",
              js: "application/javascript",
              json: "application/json",
              svg: "image/svg+xml",
              png: "image/png",
            };
            res.writeHead(200, {
              "Content-Type": mimeTypes[ext] || "text/plain",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(readFileSync(filePath));
          } else {
            res.writeHead(404);
            res.end("Not found");
          }
        }
      );

      this.server.listen(this.port, () => {
        this.running = true;
        resolve();
      });

      this.server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          this.port++;
          this.server?.close();
          this.startServer(dir).then(resolve);
        }
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.running = false;
    }
  }
}
