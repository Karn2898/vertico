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
exports.InlineProvider = void 0;
const vscode = __importStar(require("vscode"));
class InlineProvider {
    constructor(api, sessionManager) {
        this.api = api;
        this.sessionManager = sessionManager;
        this.lastTrigger = 0;
        this.DEBOUNCE_MS = 800;
    }
    async provideInlineCompletionItems(document, position, context) {
        const now = Date.now();
        if (now - this.lastTrigger < this.DEBOUNCE_MS)
            return null;
        this.lastTrigger = now;
        if (context.triggerKind !== vscode.InlineCompletionTriggerKind.Automatic)
            return null;
        const sessionId = this.sessionManager.currentSessionId;
        if (!sessionId)
            return null;
        const textUpToCursor = document.getText(new vscode.Range(new vscode.Position(0, 0), position));
        const currentLine = document.lineAt(position.line).text.trim();
        const shouldTrigger = currentLine.startsWith("def") ||
            currentLine.startsWith("function") ||
            currentLine.startsWith("//") ||
            currentLine.startsWith("#");
        if (!shouldTrigger)
            return null;
        try {
            const state = await this.api.getSessionState(sessionId);
            if (!state?.review_notes)
                return null;
            const suggestion = `\n    // TODO (vertico): ${state.review_notes.split("\n")[0]}`;
            const item = new vscode.InlineCompletionItem(suggestion, new vscode.Range(position, position));
            return new vscode.InlineCompletionList([item]);
        }
        catch {
            return null;
        }
    }
}
exports.InlineProvider = InlineProvider;
