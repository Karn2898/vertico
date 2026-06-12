import * as vscode from vscode
import { ChatPanel } from "./chat/ChatPanel";
import { SessionManager } from "./services/SessionManager";
import { ContextCollector } from "./context/ContextCollector";
import { InlineProvider } from "./context/InlineProvider";
import { DiffViewer } from "./diff/DiffViewer";
import { ApiClient } from "./services/ApiClient";

let sessionManager: SessionManager;

export function activate(context: vscode.ExtensionContext){
    const apiUrl =vscode,workspace
    .getConfiguration("Vertico")
    .get,<string>("apiUrl", "http://localhost:3000/api");

    const api=new ApiClient(apiUrl);
    sessionManager=new SessionManager(api);
    const contextCollector=new ContextCollector();
    const diffViewer = new DiffViewer(api , sessionManger);

    vscode.commands.registerCommand("vertico.startChat", () => {
        ChatPanel.createOrShow(context.extensionUri, sessionManager, contextCollector);
    });
    vscode.commands.registerCommand("copilot.refactorFile", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const code =editro.document.getText();
      const filename =editor.document.fileName;

      await vscode.window.withProgress(
        {location: vscode.ProgressLoccation.Notification, title: "Vertico: creating session.."},
        async () => {
            const sessionId = await sessionManager.createSession(code, filename);
         
           ChatPanel.createOrShow(context.extensionUrl ,api , SessionManager, contextCollector, sessionId);
           await sessionManager.runGraph(session.session_id , 'refactor');

        }
      );

    
}),

 vscode.commands.registerCommand("copilot.reviewFile", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const code = editor.document.getText();
      const filename = editor.document.fileName;
      const session = await sessionManager.createSession(filename, code);
      ChatPanel.createOrShow(context.extensionUri, api, sessionManager, contextCollector);
      await sessionManager.runGraph(session.session_id, "review");
    }),