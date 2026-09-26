import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from "react";
export function CheckpointManager({ sessionId, api, diff, onRestore }) {
    const [checkpoints, setCheckpoints] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const createCheckpoint = useCallback(async () => {
        if (!sessionId || !diff)
            return;
        setIsCreating(true);
        try {
            const patch = await api.preparePatch(sessionId);
            const checkpoint = {
                id: `cp_${Date.now()}`,
                timestamp: Date.now(),
                label: `Checkpoint ${new Date().toLocaleTimeString()}`,
                sessionId,
                files: patch.files,
                diffSnapshot: diff,
            };
            setCheckpoints((prev) => [checkpoint, ...prev.slice(0, 9)]); // Keep last 10
        }
        catch (error) {
            console.error("Failed to create checkpoint:", error);
        }
        finally {
            setIsCreating(false);
        }
    }, [sessionId, api, diff]);
    const handleRestore = useCallback((checkpoint) => {
        onRestore(checkpoint);
    }, [onRestore]);
    const handleDelete = useCallback((checkpointId) => {
        setCheckpoints((prev) => prev.filter((c) => c.id !== checkpointId));
    }, []);
    if (!sessionId || checkpoints.length === 0) {
        return (_jsxs("div", { className: "checkpoint-empty", children: [_jsx("button", { className: "checkpoint-create-btn", onClick: createCheckpoint, disabled: isCreating || !sessionId || !diff, children: isCreating ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "checkpoint-spinner" }), "Creating\u2026"] })) : (_jsxs(_Fragment, { children: [_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", children: [_jsx("path", { d: "M6 1C8.20914 1 10 2.79086 10 5C10 7.20914 8.20914 9 6 9C3.79086 9 2 7.20914 2 5C2 2.79086 3.79086 1 6 1Z", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("path", { d: "M6 9V11M6 11L4 9M6 11L8 9", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })] }), "Create Checkpoint"] })) }), _jsx("p", { className: "checkpoint-hint", children: "Creates a snapshot before multi-file changes \u2014 one-click restore if needed" })] }));
    }
    return (_jsxs("div", { className: "checkpoint-container", children: [_jsxs("div", { className: "checkpoint-header", children: [_jsx("h4", { className: "checkpoint-title", children: "Checkpoints" }), _jsx("button", { className: "checkpoint-create-btn secondary", onClick: createCheckpoint, disabled: isCreating, children: isCreating ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "checkpoint-spinner" }), "Saving\u2026"] })) : (_jsxs(_Fragment, { children: [_jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", children: _jsx("path", { d: "M6 1V11M1 6H11", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) }), "New"] })) })] }), _jsx("div", { className: "checkpoint-list", role: "list", children: checkpoints.map((cp) => (_jsxs("div", { className: "checkpoint-item", role: "listitem", children: [_jsxs("div", { className: "checkpoint-info", children: [_jsx("span", { className: "checkpoint-label", children: cp.label }), _jsxs("span", { className: "checkpoint-meta", children: [cp.files.length, " file", cp.files.length !== 1 ? "s" : "", " \u00B7", " ", new Date(cp.timestamp).toLocaleTimeString()] })] }), _jsxs("div", { className: "checkpoint-actions", children: [_jsxs("button", { className: "checkpoint-restore-btn", onClick: () => handleRestore(cp), title: "Restore this checkpoint", children: [_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", children: [_jsx("path", { d: "M10 6C10 8.20914 8.20914 10 6 10C3.79086 10 2 8.20914 2 6C2 3.79086 3.79086 2 6 2", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("path", { d: "M2 6L6 2M2 6L6 10M2 6H10", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })] }), "Restore"] }), _jsx("button", { className: "checkpoint-delete-btn", onClick: () => handleDelete(cp.id), title: "Delete checkpoint", children: _jsx("svg", { width: "10", height: "10", viewBox: "0 0 10 10", fill: "none", children: _jsx("path", { d: "M2 2L8 8M8 2L2 8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) }) })] })] }, cp.id))) })] }));
}
