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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const bridge_client_1 = require("./bridge-client");
const dual_output_1 = require("./dual-output");
const code_generator_1 = require("./code-generator");
const preview_server_1 = require("./preview-server");
let bridgeClient;
let statusBarItem;
let dualParser;
let codeGenerator;
let previewServer;
function activate(context) {
    const config = vscode.workspace.getConfiguration("figmaIntelligence");
    const port = config.get("bridgePort", 9001);
    dualParser = new dual_output_1.DualOutputParser();
    codeGenerator = new code_generator_1.CodeGenerator();
    previewServer = new preview_server_1.PreviewServer();
    // Status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(plug) Figma Bridge";
    statusBarItem.tooltip =
        "Figma Intelligence Bridge — Disconnected. Click to reconnect.";
    statusBarItem.command = "figmaIntelligence.reconnect";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // Bridge client
    bridgeClient = new bridge_client_1.BridgeClient(port);
    bridgeClient.onStatusChange((connected) => {
        if (connected) {
            statusBarItem.text = "$(check) Figma Bridge";
            statusBarItem.tooltip =
                "Figma Intelligence Bridge — Connected. Dual mode code files will be written to workspace.";
        }
        else {
            statusBarItem.text = "$(plug) Figma Bridge";
            statusBarItem.tooltip =
                "Figma Intelligence Bridge — Disconnected. Click to reconnect.";
        }
    });
    // Listen for bridge messages — handle dual-mode code output
    bridgeClient.onMessage((msg) => handleBridgeMessage(msg));
    // Commands
    context.subscriptions.push(vscode.commands.registerCommand("figmaIntelligence.reconnect", () => {
        bridgeClient?.reconnect();
        vscode.window.showInformationMessage("Reconnecting to Figma Intelligence Bridge...");
    }));
    context.subscriptions.push(vscode.commands.registerCommand("figmaIntelligence.togglePreview", () => {
        previewServer.toggle();
    }));
    // Auto-connect
    if (config.get("autoConnect", true)) {
        bridgeClient.connect();
    }
}
function handleBridgeMessage(msg) {
    switch (msg.type) {
        case "text_delta":
            // Parse for code output markers
            dualParser.feed(msg.delta || "");
            break;
        case "done": {
            // Extract any code files from the completed response
            const codeFiles = dualParser.getCodeFiles();
            if (codeFiles.length > 0) {
                writeCodeFiles(codeFiles);
            }
            dualParser.reset();
            break;
        }
        case "phase_start":
            // Reset parser when a new dual-mode request starts
            if (msg.phase && msg.phase.includes("Dual")) {
                dualParser.reset();
            }
            break;
    }
}
async function writeCodeFiles(files) {
    const config = vscode.workspace.getConfiguration("figmaIntelligence");
    const outputDir = config.get("codeOutputDir", "src/components");
    const writtenFiles = await codeGenerator.writeFiles(files, outputDir);
    if (writtenFiles.length > 0) {
        // Check if a preview.html was generated
        const hasPreview = writtenFiles.some((f) => f.endsWith("preview.html"));
        // Open the component source files in editor tabs
        const sourceFiles = writtenFiles.filter((f) => !f.endsWith("preview.html") &&
            !f.endsWith(".stories.tsx"));
        for (const f of sourceFiles.slice(0, 3)) {
            const uri = vscode.Uri.file(f);
            await vscode.window.showTextDocument(uri, {
                preview: true,
                preserveFocus: true,
            });
        }
        // Auto-open live preview if preview.html exists
        if (hasPreview) {
            await previewServer.openPreview(writtenFiles);
            vscode.window.showInformationMessage(`Generated ${writtenFiles.length} file(s) — live preview opened`);
        }
        else {
            const action = await vscode.window.showInformationMessage(`Generated ${writtenFiles.length} component file(s)`, "Open All Files");
            if (action === "Open All Files") {
                for (const f of writtenFiles) {
                    const uri = vscode.Uri.file(f);
                    await vscode.window.showTextDocument(uri, {
                        preview: true,
                        preserveFocus: true,
                    });
                }
            }
        }
    }
}
function deactivate() {
    bridgeClient?.disconnect();
    previewServer?.stop();
}
//# sourceMappingURL=extension.js.map