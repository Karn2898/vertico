// src/chat/ChatPanel.ts
import * as vscode from "vscode";
export class ChatPanel {
    static createOrShow(extensionUri, api, sessionManager, contextCollector) {
        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel.panel.reveal(vscode.ViewColumn.Two);
            return;
        }
        const panel = vscode.window.createWebviewPanel("copilotChat", "Copilot Agent", vscode.ViewColumn.Two, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, "webview", "dist")],
        });
        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, api, sessionManager, contextCollector);
    }
    constructor(panel, extensionUri, api, sessionManager, contextCollector) {
        this.api = api;
        this.sessionManager = sessionManager;
        this.contextCollector = contextCollector;
        this.eventSource = null;
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
    async _handleChatMessage(text) {
        const sessionId = this.sessionManager.currentSessionId;
        if (!sessionId) {
            this._postToWebview({ type: "error", text: "No active session. Open a file and run a command first." });
            return;
        }
        const es = this.api.streamChat(sessionId, text);
        this.eventSource = es;
        es.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this._postToWebview({ type: "streamChunk", ...data });
        };
        es.onerror = () => {
            es.close();
            this._postToWebview({ type: "streamEnd" });
        };
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
        this.panel.webview.postMessage(message);
    }
    _getHtml(extensionUri) {
        const scriptUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "webview", "dist", "assets", "index.js"));
        const styleUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "webview", "dist", "assets", "index.css"));
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
