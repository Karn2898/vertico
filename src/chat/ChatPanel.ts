// src/chat/ChatPanel.ts

import * as vscode from "vscode";
import * as path from "path";
import { ApiClient } from "../services/ApiClient";
import { SessionManager } from "../services/SessionManager";
import { ContextCollector } from "../context/ContextCollector";

export class ChatPanel {
  public static currentPanel: ChatPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private eventSource: EventSource | null = null;

  static createOrShow(
    extensionUri: vscode.Uri,
    api: ApiClient,
    sessionManager: SessionManager,
    contextCollector: ContextCollector
  ) {
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel.panel.reveal(vscode.ViewColumn.Two);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "copilotChat",
      "Copilot Agent",
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "webview", "dist")],
      }
    );
    ChatPanel.currentPanel = new ChatPanel(
      panel, extensionUri, api, sessionManager, contextCollector
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private api: ApiClient,
    private sessionManager: SessionManager,
    private contextCollector: ContextCollector,
  ) {
    this.panel = panel;
    this.panel.webview.html = this._getHtml(extensionUri);

    this.panel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "sendMessage":
          await this._handleChatMessage(msg.text);
          break;
        case "acceptDiff":
          await this._handleAcceptDiff();
          break;
        case "rejectDiff":
          await this._handleRejectDiff();
          break;
        case "getContext":
          this._sendContext();
          break;
      }
    });

    this.panel.onDidDispose(() => {
      this.eventSource?.close();
      ChatPanel.currentPanel = undefined;
    });
  }

  private async _handleChatMessage(text: string) {
    const sessionId = this.sessionManager.currentSessionId;
    if (!sessionId) {
      this._postToWebview({ type: "error", text: "No active session. Open a file and run a command first." });
      return;
    }

    const es = this.api.streamChat(sessionId, text);
    this.eventSource = es;

    es.onmessage = (event: any) => {
      const data = JSON.parse(event.data);
      this._postToWebview({ type: "streamChunk", ...data });
    };

    es.onerror = () => {
      es.close();
      this._postToWebview({ type: "streamEnd" });
    };
  }

  private async _handleAcceptDiff() {
    const sessionId = this.sessionManager.currentSessionId;
    if (!sessionId) return;
    await this.api.acceptDiff(sessionId);
    this._postToWebview({ type: "diffAccepted" });
    vscode.window.showInformationMessage("Changes accepted");
  }

  private async _handleRejectDiff() {
    const sessionId = this.sessionManager.currentSessionId;
    if (!sessionId) return;
    await this.api.rejectDiff(sessionId);
    this._postToWebview({ type: "diffRejected" });
    vscode.window.showInformationMessage("Changes rejected");
  }

  private _sendContext() {
    const ctx = this.contextCollector.collect();
    this._postToWebview({ type: "context", context: ctx });
  }

  private _postToWebview(message: object) {
    this.panel.webview.postMessage(message);
  }

  private _getHtml(extensionUri: vscode.Uri): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "webview", "dist", "assets", "index.js")
    );
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "webview", "dist", "assets", "index.css")
    );
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <link rel="stylesheet" href="${styleUri}"/>
  <title>Copilot Agent</title>
</head>
<body class="bg-background text-foreground">
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
