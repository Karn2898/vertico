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
exports.default = App;
const react_1 = __importStar(require("react"));
const ChatWindow_1 = require("../../../../src/components/ChatWindow");
const DiffPanel_1 = require("../../../../src/components/DiffPanel");
const FileTree_1 = require("../../../../src/components/FileTree");
const vscode = acquireVsCodeApi();
function App() {
    const [tab, setTab] = (0, react_1.useState)("chat");
    const [messages, setMessages] = (0, react_1.useState)([]);
    const [diff, setDiff] = (0, react_1.useState)(null);
    const [context, setContext] = (0, react_1.useState)(null);
    const [streaming, setStreaming] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        const handleMessage = (event) => {
            const msg = event.data;
            switch (msg.type) {
                case "streamChunk":
                    setMessages((prev) => {
                        const last = prev[prev.length - 1];
                        if (last?.role === "assistant" && last?.streaming) {
                            return [
                                ...prev.slice(0, -1),
                                { ...last, content: last.content + (msg.content ?? ""), node: msg.node },
                            ];
                        }
                        return [
                            ...prev,
                            { role: "assistant", content: msg.content ?? "", streaming: true, node: msg.node },
                        ];
                    });
                    setStreaming(true);
                    break;
                case "streamEnd":
                    setMessages((prev) => prev.map((message, index) => index === prev.length - 1 ? { ...message, streaming: false } : message));
                    setStreaming(false);
                    break;
                case "context":
                    setContext(msg.context);
                    break;
                case "diffAccepted":
                case "diffRejected":
                    setDiff(null);
                    setTab("chat");
                    break;
                case "error":
                    setMessages((prev) => [...prev, { role: "system", content: msg.text }]);
                    break;
            }
        };
        window.addEventListener("message", handleMessage);
        vscode.postMessage({ type: "getContext" });
        return () => window.removeEventListener("message", handleMessage);
    }, []);
    const sendMessage = (text) => {
        setMessages((prev) => [...prev, { role: "user", content: text }]);
        vscode.postMessage({ type: "sendMessage", text });
    };
    return react_1.default.createElement("div", { className: "flex flex-col h-screen bg-background text-foreground font-sans" }, react_1.default.createElement("div", { className: "flex border-b border-border" }, ["chat", "diff", "context"].map((value) => react_1.default.createElement("button", {
        key: value,
        onClick: () => setTab(value),
        className: `px-4 py-2 text-sm font-medium capitalize transition-colors
              ${tab === value
            ? "border-b-2 border-primary text-primary"
            : "text-muted-foreground hover:text-foreground"}`,
    }, value))), react_1.default.createElement("div", { className: "flex-1 overflow-hidden" }, tab === "chat"
        ? react_1.default.createElement(ChatWindow_1.ChatWindow, {
            messages,
            streaming,
            onSend: sendMessage,
        })
        : null, tab === "diff"
        ? react_1.default.createElement(DiffPanel_1.DiffPanel, {
            diff,
            onAccept: () => vscode.postMessage({ type: "acceptDiff" }),
            onReject: () => vscode.postMessage({ type: "rejectDiff" }),
        })
        : null, tab === "context" ? react_1.default.createElement(FileTree_1.FileTree, { context }) : null));
}
