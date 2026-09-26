// src/chat/ChatPanel.ts
import * as vscode from "vscode";
export class ChatPanel {
    constructor(extensionUri, api, sessionManager, contextCollector) {
        this.extensionUri = extensionUri;
        this.api = api;
        this.sessionManager = sessionManager;
        this.contextCollector = contextCollector;
    }
    resolveWebviewView(webviewView) {
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
        vscode.commands.executeCommand("workbench.view.extension.verticoActivityBar", ChatPanel.viewType);
    }
    _handleChatMessage(text) {
        const sessionId = this.sessionManager.currentSessionId;
        if (!sessionId) {
            this._postToWebview({ type: "error", text: "No active session. Open a file and run a command first." });
            return;
        }
        this.api.streamChat(sessionId, text, {
            onMessage: (data) => {
                this._postToWebview({ type: "streamChunk", ...data });
            },
            onError: () => {
                this._postToWebview({ type: "streamEnd" });
            },
        });
    }
    async _handleAcceptDiff() {
        const sessionId = this.sessionManager.currentSessionId;
        if (!sessionId)
            return;
        await this.api.acceptDiff(sessionId);
        this._postToWebview({ type: "diffAccepted" });
        vscode.window.showInformationMessage("Changes accepted");
    }
    async _handleRejectDiff() {
        const sessionId = this.sessionManager.currentSessionId;
        if (!sessionId)
            return;
        await this.api.rejectDiff(sessionId);
        this._postToWebview({ type: "diffRejected" });
        vscode.window.showInformationMessage("Changes rejected");
    }
    _sendContext() {
        const ctx = this.contextCollector.collect();
        this._postToWebview({ type: "context", context: ctx });
    }
    _postToWebview(message) {
        this._view?.webview.postMessage(message);
    }
    _getHtml(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "webview", "dist", "assets", "index.js"));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "webview", "dist", "assets", "index.css"));
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
ChatPanel.viewType = "vertico.chatView";
