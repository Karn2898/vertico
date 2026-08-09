"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatWindow = ChatWindow;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const MessageBubble_1 = require("./MessageBubble");
function ChatWindow({ messages, streaming, onSend }) {
    const inputRef = (0, react_1.useRef)(null);
    const bottomRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    const handleSend = () => {
        const text = inputRef.current?.value.trim();
        if (!text || streaming)
            return;
        onSend(text);
        if (inputRef.current)
            inputRef.current.value = "";
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col h-full", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex-1 overflow-y-auto p-4", children: [messages.length === 0 && ((0, jsx_runtime_1.jsxs)("p", { className: "text-muted text-center mt-8", children: ["Open a file and run ", (0, jsx_runtime_1.jsx)("strong", { children: "Vertico: Refactor" }), " to start."] })), messages.map((msg, i) => ((0, jsx_runtime_1.jsx)(MessageBubble_1.MessageBubble, { message: msg }, i))), (0, jsx_runtime_1.jsx)("div", { ref: bottomRef })] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-3 border-t border-border flex gap-2", children: [(0, jsx_runtime_1.jsx)("input", { ref: inputRef, className: "flex-1 bg-muted rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary", placeholder: "Ask about your code...", onKeyDown: (e) => e.key === "Enter" && handleSend() }), (0, jsx_runtime_1.jsx)("button", { onClick: handleSend, disabled: streaming, className: "bg-primary text-primary-foreground px-4 py-2 rounded text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors", children: streaming ? "..." : "Send" })] })] }));
}
