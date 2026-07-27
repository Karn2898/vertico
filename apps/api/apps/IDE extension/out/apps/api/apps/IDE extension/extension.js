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
const ChatPanel_1 = require("../../../../src/chat/ChatPanel");
const SessionManager_1 = require("../../../../src/services/SessionManager");
const ContextCollector_1 = require("../../../../src/context/ContextCollector");
const InlineProvider_1 = require("../../../../src/context/InlineProvider");
const DiffViewer_1 = require("../../../../src/diff/DiffViewer");
const ApiClient_1 = require("../../../../src/services/ApiClient");
let sessionManager;
function activate(context) {
    const apiUrl = vscode.workspace
        .getConfiguration("Vertico")
        .get("apiUrl", "http://localhost:8000/api");
    const api = new ApiClient_1.ApiClient(apiUrl);
    sessionManager = new SessionManager_1.SessionManager(api);
    const contextCollector = new ContextCollector_1.ContextCollector();
    const diffViewer = new DiffViewer_1.DiffViewer(api, sessionManager);
    const chatPanel = new ChatPanel_1.ChatPanel(context.extensionUri, api, sessionManager, contextCollector);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(ChatPanel_1.ChatPanel.viewType, chatPanel, {
        webviewOptions: { retainContextWhenHidden: true },
    }));
    vscode.commands.registerCommand("vertico.startChat", () => {
        chatPanel.reveal();
    });
    vscode.commands.registerCommand("vertico.showChat", () => {
        chatPanel.reveal();
    });
    vscode.commands.registerCommand("vertico.refactorFile", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const code = editor.document.getText();
        const filename = editor.document.fileName;
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Vertico: creating session.." }, async () => {
            const session = await sessionManager.createSession(filename, code);
            chatPanel.reveal();
            await sessionManager.runGraph(session.session_id, "refactor");
        });
    });
    vscode.commands.registerCommand("Vertico.reviewFile", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const code = editor.document.getText();
        const filename = editor.document.fileName;
        const session = await sessionManager.createSession(filename, code);
        chatPanel.reveal();
        await sessionManager.runGraph(session.session_id, "review");
    });
    vscode.commands.registerCommand("Vertico.fixbug", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const errorMsg = await vscode.window.showInputBox({ prompt: "Describe the bug you want to fix" });
        if (!errorMsg)
            return;
        const code = editor.document.getText();
        const filename = editor.document.fileName;
        const session = await sessionManager.createSession(filename, code);
        chatPanel.reveal();
        await sessionManager.runGraph(session.session_id, "bugfix", errorMsg);
    });
    vscode.commands.registerCommand("vertico.indexRepo", async () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            vscode.window.showErrorMessage("No workspace open");
            return;
        }
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Vertico: Indexing repo ..." }, async () => {
            await api.indexRepo(workspaceRoot);
            vscode.window.showInformationMessage("Repository indexed successfully");
        });
    });
    vscode.commands.registerCommand("vertico.acceptDiff", async () => {
        const sessionId = sessionManager.currentSessionId;
        if (!sessionId)
            return;
        await diffViewer.accept(sessionId);
    });
    vscode.commands.registerCommand("vertico.rejectDiff", async () => {
        const sessionId = sessionManager.currentSessionId;
        if (!sessionId)
            return;
        await diffViewer.reject(sessionId);
    });
    const inlineProvider = new InlineProvider_1.InlineProvider(api, sessionManager);
    context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, inlineProvider));
}
function deactivate() {
    sessionManager?.cleanup();
}
