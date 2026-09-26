import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect, useCallback } from "react";
import { MessageBubble } from "@src/components/MessageBubble";
import { AgentMessage } from "@src/components/AgentMessage";
export function ChatWindow({ messages, streaming, onSend, onCancel, onRegenerate, onFeedback }) {
    const inputRef = useRef(null);
    const bottomRef = useRef(null);
    const scrollRef = useRef(null);
    const stickToBottomRef = useRef(true);
    // Auto-scroll only while the user is already at the bottom; manual
    // scrolling (reading earlier messages) is never hijacked.
    useEffect(() => {
        if (stickToBottomRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);
    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el)
            return;
        stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    }, []);
    const handleSend = useCallback(() => {
        const text = inputRef.current?.value.trim();
        if (!text || streaming)
            return;
        onSend(text);
        if (inputRef.current)
            inputRef.current.value = "";
        stickToBottomRef.current = true;
    }, [streaming, onSend]);
    const handleKeyDown = useCallback((e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);
    return (_jsxs("div", { className: "flex flex-col h-full min-h-0", children: [_jsxs("div", { ref: scrollRef, onScroll: handleScroll, className: "flex-1 overflow-y-auto p-4 min-h-0", children: [messages.length === 0 && (_jsxs("p", { className: "text-muted text-center mt-8", children: ["Open a file and run ", _jsx("strong", { children: "Vertico: Refactor" }), " to start."] })), messages.map((msg, i) => {
                        const isUser = msg?.role === "user";
                        const isSystem = msg?.role === "system";
                        if (isUser) {
                            return _jsx(MessageBubble, { message: msg }, `user-${i}-${msg.content?.slice(0, 20)}`);
                        }
                        if (isSystem) {
                            return (_jsx("div", { className: "message-row system", children: _jsx("div", { className: "bubble-system px-4 py-3 text-sm leading-relaxed max-w-[80%] text-center", children: msg.content }) }, `system-${i}`));
                        }
                        return _jsx(AgentMessage, { message: msg, index: i, messages: messages, streaming: streaming, onRegenerate: onRegenerate, onFeedback: onFeedback }, `assistant-${i}`);
                    }), _jsx("div", { ref: bottomRef })] }), _jsxs("div", { className: "p-3 border-t border-border flex gap-2 flex-shrink-0", children: [_jsx("input", { ref: inputRef, className: "flex-1 bg-[#1b1513] border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#b8935a] focus:shadow-[0_0_0_1.5px_rgba(184,147,90,0.35)] transition-colors placeholder:text-[#6b5f58]", onKeyDown: handleKeyDown, placeholder: streaming ? "Response streaming… (you can keep typing)" : "Ask about your code..." }), streaming ? (_jsx("button", { onClick: onCancel, title: "Stop generating", className: "bg-[#2b2b2b] text-[#f1e4d9] px-4 py-2 rounded-lg text-sm hover:bg-[#3a3a3a] transition-colors flex-shrink-0", children: "\u25A0 Stop" })) : (_jsx("button", { onClick: handleSend, className: "bg-[#6e2a3a] text-[#f1e4d9] px-4 py-2 rounded-lg text-sm hover:bg-[#7d3244] transition-colors flex-shrink-0", children: "Send" }))] })] }));
}
