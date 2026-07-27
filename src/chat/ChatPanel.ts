// src/chat/ChatPanel.ts

import * as vscode from "vscode";
import { ApiClient } from "../services/ApiClient";
import { SessionManager } from "../services/SessionManager";
import { ContextCollector } from "../context/ContextCollector";

export class ChatPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = "vertico.chatView";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly api: ApiClient,
    private readonly sessionManager: SessionManager,
    private readonly contextCollector: ContextCollector
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "webview", "dist")],
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
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
  }

  reveal() {
    vscode.commands.executeCommand(
      "workbench.view.extension.verticoActivityBar",
      ChatPanel.viewType
    );
  }

  private _handleChatMessage(text: string) {
    const sessionId = this.sessionManager.currentSessionId;
    if (!sessionId) {
      this._postToWebview({ type: "error", text: "No active session. Open a file and run a command first." });
      return;
    }

    this.api.streamChat(sessionId, text, {
      onMessage: (data: any) => {
        this._postToWebview({ type: "streamChunk", ...data });
      },
      onError: () => {
        this._postToWebview({ type: "streamEnd" });
      },
    });
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
    this._view?.webview.postMessage(message);
  }

  private _getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview", "dist", "assets", "index.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview", "dist", "assets", "index.css")
    );
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <link rel="stylesheet" href="${styleUri}"/>
  <title>Vertico Agent</title>
</head>
<body class="bg-background text-foreground">
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
