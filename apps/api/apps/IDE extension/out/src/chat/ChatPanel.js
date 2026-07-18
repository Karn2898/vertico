"use strict";
// src/chat/ChatPanel.ts
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
exports.ChatPanel = void 0;
const vscode = __importStar(require("vscode"));
class ChatPanel {
    constructor(extensionUri, api, sessionManager, contextCollector) {
        this.extensionUri = extensionUri;
        this.api = api;
        this.sessionManager = sessionManager;
        this.contextCollector = contextCollector;
        this.eventSource = null;
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
exports.ChatPanel = ChatPanel;
ChatPanel.viewType = "vertico.chatView";
