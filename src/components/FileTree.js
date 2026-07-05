import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function FileTree({ context }) {
    if (!context) {
        return (_jsx("div", { className: "flex items-center justify-center h-full text-muted-foreground text-sm", children: "No context available" }));
    }
    return (_jsxs("div", { className: "p-4 space-y-4 overflow-y-auto h-full text-sm", children: [_jsxs("section", { children: [_jsx("h3", { className: "text-xs font-semibold text-muted-foreground uppercase mb-2", children: "Files" }), _jsx("p", { className: "text-foreground font-mono truncate", children: context.filename }), _jsx("p", { className: "text-muted-foreground text-xs", children: context.language })] }), _jsxs("section", { children: [_jsx("h3", { className: "text-xs font-semibold text-muted-foreground uppercase mb-2", children: "Diagnostics" }), _jsx("div", { className: "text-muted-foreground text-xs", children: context.diagnostics?.map((d, i) => (_jsx("div", { children: d }, i))) })] })] }));
}
