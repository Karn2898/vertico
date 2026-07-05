import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
export function ChatWindow({ messages, streaming, onSend }) {
    const inputRef = useRef(null);
    const bottomRef = useRef(null);
    useEffect(() => {
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
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "flex-1 overflow-y-auto p-4", children: [messages.length === 0 && (_jsxs("p", { className: "text-muted text-center mt-8", children: ["Open a file and run ", _jsx("strong", { children: "Copilot: Refactor" }), " to start."] })), messages.map((msg, i) => (_jsx(MessageBubble, { message: msg }, i))), _jsx("div", { ref: bottomRef })] }), _jsxs("div", { className: "p-3 border-t border-border flex gap-2", children: [_jsx("input", { ref: inputRef, className: "flex-1 bg-muted rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary", placeholder: "Ask about your code...", onKeyDown: (e) => e.key === "Enter" && handleSend() }), _jsx("button", { onClick: handleSend, disabled: streaming, className: "bg-primary text-primary-foreground px-4 py-2 rounded text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors", children: streaming ? "..." : "Send" })] })] }));
}
