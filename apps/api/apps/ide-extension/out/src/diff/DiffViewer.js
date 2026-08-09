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
exports.DiffViewer = void 0;
const vscode = __importStar(require("vscode"));
class DiffViewer {
    constructor(api, sessionManager) {
        this.api = api;
        this.sessionManager = sessionManager;
    }
    async showDiff(sessionId) {
        const diff = await this.api.getDiff(sessionId);
        if (!diff || !diff.has_changes || !diff.diff) {
            vscode.window.showInformationMessage("No changes to show");
            return;
        }
        const originalUrl = vscode.Uri.parse(`untitled:original.py?${Date.now()}`);
        const refactoredUrl = vscode.Uri.parse(`untitled:refactored.py?${Date.now()}`);
        // open diff editor
        await vscode.commands.executeCommand("vscode.diff", originalUrl, refactoredUrl, `vertico: ${diff.diff.lines_added} added, ${diff.diff.lines_removed} removed`);
    }
    async accept(sessionId) {
        await this.api.acceptDiff(sessionId);
        const state = await this.api.getSessionState(sessionId);
        // Write accepted code back to the actual file
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(editor.document.getText().length));
            await editor.edit((editBuilder) => {
                editBuilder.replace(fullRange, state.refactored_code);
            });
            await editor.document.save();
        }
    }
    async reject(sessionId) {
        await this.api.rejectDiff(sessionId);
        vscode.window.showInformationMessage("Changes rejected, original restored");
    }
}
exports.DiffViewer = DiffViewer;
