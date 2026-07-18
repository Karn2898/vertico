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
exports.ContextCollector = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class ContextCollector {
    collect() {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return null;
        const doc = editor.document;
        const selection = editor.selection;
        const repoRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? "";
        const fileTree = vscode.workspace.textDocuments
            .filter((d) => !d.isUntitled && d.uri.scheme === "file")
            .map((d) => (repoRoot ? path.relative(repoRoot, d.uri.fsPath) : d.uri.fsPath))
            .slice(0, 20);
        const diagnostics = vscode.languages
            .getDiagnostics(doc.uri)
            .map((d) => `[${d.severity === vscode.DiagnosticSeverity.Error ? "error" : "warning"}] Line ${d.range.start.line + 1}: ${d.message}`)
            .slice(0, 10);
        return {
            filename: doc.fileName,
            language: doc.languageId,
            fullcode: doc.getText(),
            selectedcode: selection.isEmpty ? null : doc.getText(selection),
            cursorLine: selection.active.line + 1,
            repoRoot,
            fileTree,
            diagnostics,
        };
    }
}
exports.ContextCollector = ContextCollector;
