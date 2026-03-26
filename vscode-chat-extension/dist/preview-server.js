"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreviewServer = void 0;
const vscode = __importStar(require("vscode"));
const fs_1 = require("fs");
const path_1 = require("path");
const http_1 = require("http");
const fs_2 = require("fs");
class PreviewServer {
    constructor() {
        this.server = null;
        this.port = 3210;
        this.running = false;
        this.servingDir = "";
    }
    async toggle() {
        if (this.running) {
            this.stop();
        }
        else {
            vscode.window.showInformationMessage("No active preview. Use Design + Code mode to generate a component first.");
        }
    }
    /**
     * Open the generated preview.html in VS Code's Simple Browser.
     * Starts a tiny local HTTP server so the preview works with all features.
     */
    async openPreview(files) {
        // Look for preview.html among generated files
        const previewFile = files.find((f) => (0, path_1.basename)(f) === "preview.html");
        if (previewFile && (0, fs_1.existsSync)(previewFile)) {
            // Start a simple HTTP server to serve the preview
            const dir = (0, path_1.join)(previewFile, "..");
            await this.startServer(dir);
            const url = `http://localhost:${this.port}/preview.html`;
            // Open in VS Code Simple Browser panel (side by side with editor)
            try {
                await vscode.commands.executeCommand("simpleBrowser.api.open", vscode.Uri.parse(url), {
                    viewColumn: vscode.ViewColumn.Beside,
                    preserveFocus: false,
                });
            }
            catch {
                // Fallback: open in external browser
                vscode.env.openExternal(vscode.Uri.parse(url));
            }
            return;
        }
        // Fallback: open the main component file
        const componentFile = files.find((f) => f.endsWith(".tsx") &&
            !f.endsWith(".stories.tsx") &&
            !f.endsWith(".test.tsx"));
        if (componentFile) {
            const uri = vscode.Uri.file(componentFile);
            await vscode.window.showTextDocument(uri);
        }
    }
    async startServer(dir) {
        // Reuse if already serving the same directory
        if (this.running && this.servingDir === dir)
            return;
        // Stop any existing server
        this.stop();
        this.servingDir = dir;
        return new Promise((resolve) => {
            this.server = (0, http_1.createServer)((req, res) => {
                const fileName = (req.url || "/").split("?")[0].replace(/^\//, "") || "preview.html";
                const filePath = (0, path_1.join)(dir, fileName);
                if ((0, fs_1.existsSync)(filePath)) {
                    const ext = fileName.split(".").pop() || "";
                    const mimeTypes = {
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
                    res.end((0, fs_2.readFileSync)(filePath));
                }
                else {
                    res.writeHead(404);
                    res.end("Not found");
                }
            });
            this.server.listen(this.port, () => {
                this.running = true;
                resolve();
            });
            this.server.on("error", (err) => {
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
exports.PreviewServer = PreviewServer;
//# sourceMappingURL=preview-server.js.map