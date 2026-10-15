import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
export function QuickPick({ open, sessions, onPick, onClose }) {
    const [query, setQuery] = useState("");
    const [index, setIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const filtered = sessions.filter((s) => (s.filename || s.session_id).toLowerCase().includes(query.toLowerCase()));
    useEffect(() => {
        if (!open)
            return;
        setQuery("");
        setIndex(0);
        // focus on next frame so the modal is mounted
        requestAnimationFrame(() => inputRef.current?.focus());
    }, [open]);
    useEffect(() => {
        setIndex(0);
    }, [query]);
    if (!open)
        return null;
    const commit = (i) => {
        const item = filtered[i];
        if (!item)
            return;
        onPick(item);
        onClose();
    };
    const onKeyDown = (e) => {
        if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        }
        else if (e.key === "ArrowDown") {
            e.preventDefault();
            setIndex((i) => Math.min(filtered.length - 1, i + 1));
        }
        else if (e.key === "ArrowUp") {
            e.preventDefault();
            setIndex((i) => Math.max(0, i - 1));
        }
        else if (e.key === "Enter") {
            e.preventDefault();
            commit(index);
        }
    };
    return (_jsx("div", { className: "quickpick-backdrop", onMouseDown: (e) => {
            if (e.target === e.currentTarget)
                onClose();
        }, children: _jsxs("div", { className: "quickpick-modal", role: "dialog", "aria-label": "Recent sessions", children: [_jsx("input", { ref: inputRef, className: "quickpick-input", placeholder: "Search recent sessions\u2026", value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: onKeyDown }), _jsxs("div", { className: "quickpick-list", ref: listRef, children: [filtered.length === 0 && (_jsx("div", { className: "quickpick-empty", children: "No matching sessions" })), filtered.map((s, i) => (_jsxs("button", { className: `quickpick-item ${i === index ? "active" : ""}`, onMouseEnter: () => setIndex(i), onClick: () => commit(i), children: [_jsx("span", { className: "quickpick-item-title", children: s.filename || "untitled" }), s.status && _jsx("span", { className: "quickpick-item-meta", children: s.status })] }, s.session_id)))] }), _jsx("div", { className: "quickpick-hint", children: "\u2191\u2193 navigate \u00B7 \u21B5 open \u00B7 esc dismiss" })] }) }));
}
