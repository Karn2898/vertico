"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTree = FileTree;
const jsx_runtime_1 = require("react/jsx-runtime");
function FileTree({ context }) {
    if (!context) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center h-full text-muted-foreground text-sm", children: "No context available" }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-4 space-y-4 overflow-y-auto h-full text-sm", children: [(0, jsx_runtime_1.jsxs)("section", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-xs font-semibold text-muted-foreground uppercase mb-2", children: "Files" }), (0, jsx_runtime_1.jsx)("p", { className: "text-foreground font-mono truncate", children: context.filename }), (0, jsx_runtime_1.jsx)("p", { className: "text-muted-foreground text-xs", children: context.language })] }), (0, jsx_runtime_1.jsxs)("section", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-xs font-semibold text-muted-foreground uppercase mb-2", children: "Diagnostics" }), (0, jsx_runtime_1.jsx)("div", { className: "text-muted-foreground text-xs", children: context.diagnostics?.map((d, i) => ((0, jsx_runtime_1.jsx)("div", { children: d }, i))) })] })] }));
}
