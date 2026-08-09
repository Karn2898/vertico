import * as vscode from "vscode";
import { ChatPanel } from "../../../../src/chat/ChatPanel";
import { SessionManager } from "../../../../src/services/SessionManager";
import { ContextCollector } from "../../../../src/context/ContextCollector";
import { InlineProvider } from "../../../../src/context/InlineProvider";
import { DiffViewer } from "../../../../src/diff/DiffViewer";
import { ApiClient } from "../../../../src/services/ApiClient";
let sessionManager;
export function activate(context) {
    const apiUrl = vscode.workspace
        .getConfiguration("Vertico")
        .get("apiUrl", "http://localhost:3000/api");
    const api = new ApiClient(apiUrl);
    sessionManager = new SessionManager(api);
    const contextCollector = new ContextCollector();
    const diffViewer = new DiffViewer(api, sessionManager);
    vscode.commands.registerCommand("vertico.startChat", () => {
        ChatPanel.createOrShow(context.extensionUri, api, sessionManager, contextCollector);
    });
    vscode.commands.registerCommand("vertico.refactorFile", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const code = editor.document.getText();
        const filename = editor.document.fileName;
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Vertico: creating session.." }, async () => {
            const session = await sessionManager.createSession(filename, code);
            ChatPanel.createOrShow(context.extensionUri, api, sessionManager, contextCollector);
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
        ChatPanel.createOrShow(context.extensionUri, api, sessionManager, contextCollector);
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
        ChatPanel.createOrShow(context.extensionUri, api, sessionManager, contextCollector);
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
    const inlineProvider = new InlineProvider(api, sessionManager);
    context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, inlineProvider));
}
export function deactivate() {
    sessionManager?.cleanup();
}
