import * as vscode from "vscode";
import { BridgeClient } from "./bridge-client";
import { DualOutputParser } from "./dual-output";
import { CodeGenerator } from "./code-generator";
import { PreviewServer } from "./preview-server";

let bridgeClient: BridgeClient | undefined;
let statusBarItem: vscode.StatusBarItem;
let dualParser: DualOutputParser;
let codeGenerator: CodeGenerator;
let previewServer: PreviewServer;

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("figmaIntelligence");
  const port = config.get<number>("bridgePort", 9001);

  dualParser = new DualOutputParser();
  codeGenerator = new CodeGenerator();
  previewServer = new PreviewServer();

  // Status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.text = "$(plug) Figma Bridge";
  statusBarItem.tooltip =
    "Figma Intelligence Bridge — Disconnected. Click to reconnect.";
  statusBarItem.command = "figmaIntelligence.reconnect";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Bridge client
  bridgeClient = new BridgeClient(port);

  bridgeClient.onStatusChange((connected) => {
    if (connected) {
      statusBarItem.text = "$(check) Figma Bridge";
      statusBarItem.tooltip =
        "Figma Intelligence Bridge — Connected. Dual mode code files will be written to workspace.";
    } else {
      statusBarItem.text = "$(plug) Figma Bridge";
      statusBarItem.tooltip =
        "Figma Intelligence Bridge — Disconnected. Click to reconnect.";
    }
  });

  // Listen for bridge messages — handle dual-mode code output
  bridgeClient.onMessage((msg) => handleBridgeMessage(msg));

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("figmaIntelligence.reconnect", () => {
      bridgeClient?.reconnect();
      vscode.window.showInformationMessage(
        "Reconnecting to Figma Intelligence Bridge..."
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "figmaIntelligence.togglePreview",
      () => {
        previewServer.toggle();
      }
    )
  );

  // Auto-connect
  if (config.get<boolean>("autoConnect", true)) {
    bridgeClient.connect();
  }
}

function handleBridgeMessage(msg: any) {
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

async function writeCodeFiles(
  files: Array<{ path: string; content: string }>
) {
  const config = vscode.workspace.getConfiguration("figmaIntelligence");
  const outputDir = config.get<string>("codeOutputDir", "src/components");

  const writtenFiles = await codeGenerator.writeFiles(files, outputDir);

  if (writtenFiles.length > 0) {
    // Check if a preview.html was generated
    const hasPreview = writtenFiles.some((f) => f.endsWith("preview.html"));

    // Open the component source files in editor tabs
    const sourceFiles = writtenFiles.filter(
      (f) =>
        !f.endsWith("preview.html") &&
        !f.endsWith(".stories.tsx")
    );
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
      vscode.window.showInformationMessage(
        `Generated ${writtenFiles.length} file(s) — live preview opened`
      );
    } else {
      const action = await vscode.window.showInformationMessage(
        `Generated ${writtenFiles.length} component file(s)`,
        "Open All Files"
      );
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

export function deactivate() {
  bridgeClient?.disconnect();
  previewServer?.stop();
}
