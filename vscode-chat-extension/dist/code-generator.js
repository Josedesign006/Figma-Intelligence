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
exports.CodeGenerator = void 0;
const vscode = __importStar(require("vscode"));
const path_1 = require("path");
const fs_1 = require("fs");
class CodeGenerator {
    /**
     * Write generated code files to the workspace.
     * Returns array of absolute paths that were written.
     */
    async writeFiles(files, outputDir) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            vscode.window.showWarningMessage("No workspace folder open. Cannot write component files.");
            return [];
        }
        const writtenPaths = [];
        const baseDir = (0, path_1.join)(workspaceRoot, outputDir);
        for (const file of files) {
            try {
                const fullPath = (0, path_1.join)(baseDir, file.path);
                const dir = (0, path_1.dirname)(fullPath);
                // Create directory if needed
                if (!(0, fs_1.existsSync)(dir)) {
                    (0, fs_1.mkdirSync)(dir, { recursive: true });
                }
                // Check if file already exists
                if ((0, fs_1.existsSync)(fullPath)) {
                    const overwrite = await vscode.window.showWarningMessage(`File already exists: ${file.path}`, "Overwrite", "Skip");
                    if (overwrite !== "Overwrite") {
                        continue;
                    }
                }
                (0, fs_1.writeFileSync)(fullPath, file.content, "utf8");
                writtenPaths.push(fullPath);
            }
            catch (err) {
                vscode.window.showErrorMessage(`Failed to write ${file.path}: ${err.message}`);
            }
        }
        return writtenPaths;
    }
    getWorkspaceRoot() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return null;
        }
        return folders[0].uri.fsPath;
    }
}
exports.CodeGenerator = CodeGenerator;
//# sourceMappingURL=code-generator.js.map