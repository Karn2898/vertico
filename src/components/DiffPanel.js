import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function DiffPanel({ diff, onAccept, onReject }) {
    if (!diff) {
        return (_jsx("div", { className: "flex items-center justify-center h-full text-muted-foreground text-sm", children: "No diff available. Run a refactor first." }));
    }
    const lines = diff.unified?.split("\n") ?? [];
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "flex items-center gap-4 px-4 py-2 border-b border-border text-xs", children: [_jsxs("span", { className: "text-green-500", children: ["+", diff.lines_added, " added"] }), _jsxs("span", { className: "text-red-500", children: ["-", diff.lines_removed, " removed"] }), _jsxs("div", { className: "ml-auto flex gap-2", children: [_jsx("button", { onClick: onAccept, className: "bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors", children: "Accept" }), _jsx("button", { onClick: onReject, className: "bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors", children: "Reject" })] })] }), _jsx("div", { className: "flex-1 overflow-y-auto font-mono text-xs p-2", children: lines.map((line, i) => (_jsx("div", { className: `px-2 py-0.5 rounded
              ${line.startsWith("+") && !line.startsWith("+++")
                        ? "bg-green-500/10 text-green-400"
                        : line.startsWith("-") && !line.startsWith("---")
                            ? "bg-red-500/10 text-red-400"
                            : line.startsWith("@@")
                                ? "text-blue-400"
                                : "text-muted-foreground"}`, children: line || " " }, i))) })] }));
}
