import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
export function DiffsList({ sessions, currentSessionId, onSelectDiff, api }) {
    const [diffs, setDiffs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedSessionId, setSelectedSessionId] = useState(currentSessionId);
    useEffect(() => {
        if (sessions.length === 0) {
            setDiffs([]);
            return;
        }
        const fetchAllDiffs = async () => {
            setLoading(true);
            const results = [];
            for (const session of sessions) {
                try {
                    const diff = await api.getDiff(session.session_id);
                    if (diff?.has_changes && diff?.diff) {
                        results.push({
                            session_id: session.session_id,
                            filename: session.filename || "untitled",
                            has_changes: true,
                            unified: diff.diff.unified,
                            lines_added: diff.diff.lines_added ?? 0,
                            lines_removed: diff.diff.lines_removed ?? 0,
                            status: session.status || "ready",
                        });
                    }
                }
                catch {
                    // Ignore individual diff fetch errors
                }
            }
            setDiffs(results);
            setLoading(false);
        };
        fetchAllDiffs();
    }, [sessions, api]);
    if (diffs.length === 0 && !loading) {
        return (_jsx("div", { className: "flex flex-col h-full overflow-hidden", children: _jsxs("div", { className: "flex-1 flex flex-col items-center justify-center p-8 text-center text-muted text-xs", children: [_jsx("p", { className: "font-medium text-[#f1e4d9]", children: "No diffs available" }), _jsx("p", { className: "text-dim text-[11px] mt-1", children: "Ask Vertico to refactor code in any session to generate diffs." })] }) }));
    }
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden", children: [_jsx("div", { className: "p-2 border-b border-white/5", children: _jsxs("div", { className: "flex items-center justify-between text-xs text-muted mb-2 px-1", children: [_jsx("span", { children: "Available Diffs" }), loading && _jsx("span", { className: "text-[10px] text-gold", children: "Loading\u2026" })] }) }), _jsx("div", { className: "flex-1 overflow-y-auto p-2 space-y-1", children: diffs.map((diff) => {
                    const isActive = diff.session_id === selectedSessionId;
                    return (_jsxs("button", { onClick: () => {
                            setSelectedSessionId(diff.session_id);
                            onSelectDiff(diff);
                        }, className: `side-panel-row ${isActive ? "active" : ""}`, title: `View diff for ${diff.filename}`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-medium text-xs text-[#f1e4d9] truncate", children: diff.filename }), _jsxs("div", { className: "flex items-center gap-1.5 text-xs font-mono", children: [_jsxs("span", { className: "text-emerald-400", children: ["+", diff.lines_added] }), _jsxs("span", { className: "text-rose-400", children: ["-", diff.lines_removed] })] })] }), _jsxs("div", { className: "text-[11px] text-muted truncate mt-0.5 font-mono", children: [diff.session_id.slice(0, 16), "... \u00B7 ", diff.status] })] }, diff.session_id));
                }) })] }));
}
