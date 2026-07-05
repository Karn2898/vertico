import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const NODE_LABELS = {
    reviewer: "Code Review",
    refactor: "Refactored",
    linter: "Linter",
    done: "Complete",
    error: "Error",
};
export function MessageBubble({ message }) {
    const isUser = message?.role === "user";
    const isSystem = message?.role === "system";
    return (_jsx("div", { className: `flex ${isUser ? "justify-end" : "justify-start"} mb-2`, children: _jsxs("div", { className: `max-w-[85%] rounded-lg px-3 py-2 text-sm ${isUser
                ? "bg-primary text-primary-foreground"
                : isSystem
                    ? "bg-destructive/10 text-destructive border border-destructive/20"
                    : "bg-muted text-foreground"}`, children: [message?.node && NODE_LABELS[message.node] && (_jsx("span", { className: "text-xs font-semibold text-muted-foreground block mb-1", children: NODE_LABELS[message.node] })), typeof message?.content === "string" && message.content.includes("```") ? (_jsx(CodeContent, { content: message.content })) : (_jsx("p", { className: "whitespace-pre-wrap", children: message?.content })), message?.streaming && (_jsx("span", { className: "inline-block w-2 h-2 bg-primary rounded-full animate-pulse ml-1" }))] }) }));
}
function CodeContent({ content }) {
    const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g);
    return (_jsx("div", { className: "space-y-2", children: parts.map((part, i) => {
            if (part.startsWith("```")) {
                const code = part.replace(/```[\w]*\n/, "").replace(/```$/, "");
                return (_jsx("pre", { className: "bg-background rounded p-2 text-xs overflow-x-auto", children: _jsx("code", { children: code }) }, i));
            }
            return (_jsx("p", { className: "whitespace-pre-wrap", children: part }, i));
        }) }));
}
