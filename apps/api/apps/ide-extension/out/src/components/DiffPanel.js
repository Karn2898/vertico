"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffPanel = DiffPanel;
const jsx_runtime_1 = require("react/jsx-runtime");
function DiffPanel({ diff, onAccept, onReject }) {
    if (!diff) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center h-full text-muted-foreground text-sm", children: "No diff available. Run a refactor first." }));
    }
    const lines = diff.unified?.split("\n") ?? [];
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col h-full", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-4 px-4 py-2 border-b border-border text-xs", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-green-500", children: ["+", diff.lines_added, " added"] }), (0, jsx_runtime_1.jsxs)("span", { className: "text-red-500", children: ["-", diff.lines_removed, " removed"] }), (0, jsx_runtime_1.jsxs)("div", { className: "ml-auto flex gap-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: onAccept, className: "bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors", children: "Accept" }), (0, jsx_runtime_1.jsx)("button", { onClick: onReject, className: "bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors", children: "Reject" })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex-1 overflow-y-auto font-mono text-xs p-2", children: lines.map((line, i) => ((0, jsx_runtime_1.jsx)("div", { className: `px-2 py-0.5 rounded
              ${line.startsWith("+") && !line.startsWith("+++")
                        ? "bg-green-500/10 text-green-400"
                        : line.startsWith("-") && !line.startsWith("---")
                            ? "bg-red-500/10 text-red-400"
                            : line.startsWith("@@")
                                ? "text-blue-400"
                                : "text-muted-foreground"}`, children: line || " " }, i))) })] }));
}
