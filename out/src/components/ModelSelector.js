import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState, useMemo } from "react";
const STORAGE_KEY = "vertico.chatModel";
function loadModel(models) {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && models.some(m => m.id === stored))
            return stored;
    }
    catch {
        /* storage unavailable (e.g. webview restrictions) */
    }
    return models[0]?.id ?? "";
}
export function ModelSelector({ onChange, disabled, apiUrl }) {
    const [open, setOpen] = useState(false);
    const [models, setModels] = useState([]);
    const [currentModel, setCurrentModel] = useState("");
    const rootRef = useRef(null);
    // Fetch models and initialize from localStorage
    useEffect(() => {
        let cancelled = false;
        fetch(`${apiUrl}/chat/models`)
            .then(res => res.ok ? res.json() : [])
            .then((data) => {
            if (!cancelled) {
                setModels(data);
                const initial = loadModel(data);
                setCurrentModel(initial);
                if (initial)
                    onChange(initial);
            }
        })
            .catch(() => {
            if (!cancelled)
                setModels([]);
        });
        return () => { cancelled = true; };
    }, [apiUrl, onChange]);
    useEffect(() => {
        if (!open)
            return;
        const onDocClick = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);
    const current = useMemo(() => models.find(m => m.id === currentModel) ?? models[0], [models, currentModel]);
    const select = (modelId) => {
        setCurrentModel(modelId);
        onChange(modelId);
        try {
            localStorage.setItem(STORAGE_KEY, modelId);
        }
        catch {
            /* ignore */
        }
        setOpen(false);
    };
    return (_jsxs("div", { ref: rootRef, className: "relative flex-shrink-0", children: [_jsxs("button", { type: "button", disabled: disabled, onMouseDown: (e) => e.stopPropagation(), onClick: (e) => {
                    e.stopPropagation();
                    setOpen(o => !o);
                }, title: `Model: ${current?.label ?? currentModel} (${current?.description ?? ""})`, "aria-haspopup": "listbox", "aria-expanded": open, className: "flex items-center gap-1 border border-border rounded-full px-2 py-1 text-xs text-[#d8c9bd] hover:bg-[#2b2320] transition-colors disabled:opacity-50 whitespace-nowrap min-w-[100px]", children: [_jsx("span", { className: "flex-1 text-left truncate", children: current?.label ?? currentModel }), _jsx("svg", { width: "7", height: "7", viewBox: "0 0 10 10", className: `transition-transform ${open ? "rotate-180" : ""}`, "aria-hidden": true, children: _jsx("path", { d: "M1 3l4 4 4-4", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) })] }), open && (_jsx("ul", { role: "listbox", className: "absolute bottom-full left-0 mb-1 w-52 bg-[#211a18] border border-border rounded-lg shadow-lg overflow-hidden py-0.5 model-dropdown", children: models.map(m => (_jsx("li", { role: "option", "aria-selected": m.id === currentModel, children: _jsxs("button", { type: "button", onClick: () => select(m.id), className: `w-full flex items-center gap-2 px-2 py-1 text-xs text-left hover:bg-[#2b2320] transition-colors ${m.id === currentModel ? "text-[#b8935a]" : "text-[#d8c9bd]"}`, children: [_jsxs("span", { className: "flex-1 truncate", children: [m.label, _jsx("span", { className: "block text-[9px] text-[#6b5f58]", children: m.description })] }), m.id === currentModel && _jsx("span", { "aria-hidden": true, children: "\u2713" })] }) }, m.id))) }))] }));
}
