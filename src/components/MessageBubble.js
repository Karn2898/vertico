import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect, useState } from "react";
export function MessageBubble({ message }) {
    const isUser = message?.role === "user";
    const isSystem = message?.role === "system";
    const [isVisible, setIsVisible] = useState(false);
    const contentRef = useRef(null);
    useEffect(() => {
        requestAnimationFrame(() => {
            setIsVisible(true);
        });
    }, []);
    if (!isUser) {
        return null; // Agent messages handled by AgentMessage component
    }
    return (_jsx("div", { ref: contentRef, className: `message-row user ${isVisible ? "visible" : ""}`, children: _jsxs("div", { className: "bubble-user px-4 py-3 text-sm leading-relaxed max-w-[70%]", children: [typeof message?.content === "string" && message.content.trim() ? (_jsx("p", { className: "whitespace-pre-wrap", children: message.content })) : null, message?.streaming && !message?.content?.trim() && _jsx(ThinkingIndicator, {}), message?.streaming && !!message?.content?.trim() && (_jsxs("span", { className: "thinking-dots mt-2", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }))] }) }));
}
function ThinkingIndicator() {
    return (_jsx("div", { className: "thinking", "aria-label": "Vertico is thinking", children: _jsxs("span", { className: "thinking-dots", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] }) }));
}
