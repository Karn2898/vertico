import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function parseUnifiedDiff(unified) {
    const lines = unified.split("\n");
    const hunks = [];
    let fileHeader = "";
    let i = 0;
    // Extract file header (--- and +++ lines)
    while (i < lines.length && (lines[i].startsWith("---") || lines[i].startsWith("+++"))) {
        fileHeader += lines[i] + "\n";
        i++;
    }
    // Parse hunks
    while (i < lines.length) {
        const line = lines[i];
        if (line.startsWith("@@")) {
            // Parse hunk header: @@ -oldStart,oldLines +newStart,newLines @@
            const match = line.match(/^@@\s+-(\d+),?(\d*)\s+\+(\d+),?(\d*)\s+@@/);
            const oldStart = match ? parseInt(match[1], 10) : 0;
            const oldLines = match && match[2] ? parseInt(match[2], 10) : 1;
            const newStart = match ? parseInt(match[3], 10) : 0;
            const newLines = match && match[4] ? parseInt(match[4], 10) : 1;
            const hunkLines = [];
            let oldLineNum = oldStart;
            let newLineNum = newStart;
            i++;
            while (i < lines.length && !lines[i].startsWith("@@")) {
                const hunkLine = lines[i];
                if (hunkLine.startsWith("+")) {
                    hunkLines.push({
                        type: "add",
                        content: hunkLine.slice(1),
                        newLineNum: newLineNum++,
                    });
                }
                else if (hunkLine.startsWith("-")) {
                    hunkLines.push({
                        type: "remove",
                        content: hunkLine.slice(1),
                        oldLineNum: oldLineNum++,
                    });
                }
                else {
                    hunkLines.push({
                        type: "context",
                        content: hunkLine.startsWith(" ") ? hunkLine.slice(1) : hunkLine,
                        oldLineNum: oldLineNum++,
                        newLineNum: newLineNum++,
                    });
                }
                i++;
            }
            hunks.push({
                header: line,
                lines: hunkLines,
                oldStart,
                oldLines,
                newStart,
                newLines,
            });
        }
        else {
            i++;
        }
    }
    return { fileHeader: fileHeader.trim(), hunks };
}
function generateHunkDiff(hunk, fileHeader) {
    const lines = [fileHeader, hunk.header];
    for (const line of hunk.lines) {
        const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
        lines.push(prefix + line.content);
    }
    return lines.join("\n");
}
export function InlineDiffPanel({ diff, onAcceptHunk, onRejectHunk, onAcceptAll, onRejectAll, onApplySelected, acceptedHunks, rejectedHunks, }) {
    if (!diff?.has_changes || !diff?.diff?.unified) {
        return (_jsx("div", { className: "flex items-center justify-center h-full text-muted-foreground text-sm", children: "No diff available. Run a refactor first." }));
    }
    const parsed = parseUnifiedDiff(diff.diff.unified);
    const { fileHeader, hunks } = parsed;
    const totalAdds = diff.diff.lines_added ?? 0;
    const totalRemoves = diff.diff.lines_removed ?? 0;
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3 px-4 py-2 border-b border-border text-xs", children: [_jsxs("span", { className: "text-green-500", children: ["+", totalAdds, " added"] }), _jsxs("span", { className: "text-red-500", children: ["-", totalRemoves, " removed"] }), _jsx("span", { className: "text-muted mx-1", children: "|" }), _jsxs("span", { className: "text-muted", children: [hunks.length, " hunk", hunks.length !== 1 ? "s" : ""] }), _jsx("span", { className: "text-muted mx-1", children: "|" }), _jsxs("span", { className: "text-emerald-400", children: ["\u2713 ", acceptedHunks.size, " accepted"] }), _jsxs("span", { className: "text-rose-400", children: ["\u2717 ", rejectedHunks.size, " rejected"] }), _jsxs("div", { className: "ml-auto flex gap-2", children: [_jsx("button", { onClick: onApplySelected, disabled: acceptedHunks.size === 0, className: "bg-gold text-bg px-3 py-1 rounded hover:bg-gold/80 disabled:opacity-50 transition-colors text-xs font-medium", children: "Apply Selected" }), _jsx("button", { onClick: onAcceptAll, disabled: acceptedHunks.size === hunks.length, className: "bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50 transition-colors text-xs", children: "Accept All" }), _jsx("button", { onClick: onRejectAll, disabled: rejectedHunks.size === hunks.length, className: "bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50 transition-colors text-xs", children: "Reject All" })] })] }), _jsxs("div", { className: "flex-1 overflow-y-auto font-mono text-xs p-2 space-y-3", children: [hunks.length === 0 && (_jsx("div", { className: "text-center text-muted py-8", children: "No hunks in this diff" })), hunks.map((hunk, hunkIndex) => {
                        const isAccepted = acceptedHunks.has(hunkIndex);
                        const isRejected = rejectedHunks.has(hunkIndex);
                        const isDecided = isAccepted || isRejected;
                        return (_jsxs("div", { className: `diff-hunk ${isAccepted ? "accepted" : ""} ${isRejected ? "rejected" : ""} ${isDecided ? "decided" : ""}`, children: [_jsxs("div", { className: "diff-hunk-header flex items-center gap-2 px-2 py-1.5 rounded-t border border-border bg-surface", children: [_jsx("span", { className: "text-blue-400 text-xs", children: hunk.header }), _jsxs("span", { className: "text-dim text-[10px] ml-auto", children: [hunk.lines.filter((l) => l.type === "add").length, " added,", " ", hunk.lines.filter((l) => l.type === "remove").length, " removed"] }), !isDecided && (_jsxs("div", { className: "flex gap-1.5 ml-2", children: [_jsx("button", { onClick: () => onAcceptHunk(hunkIndex), className: "hunk-action-btn accept bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 px-2 py-0.5 rounded text-[10px] font-medium transition-colors", title: "Accept this hunk", children: "Accept" }), _jsx("button", { onClick: () => onRejectHunk(hunkIndex), className: "hunk-action-btn reject bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 px-2 py-0.5 rounded text-[10px] font-medium transition-colors", title: "Reject this hunk", children: "Reject" })] })), isAccepted && (_jsx("span", { className: "hunk-status accepted text-emerald-400 text-[10px] font-medium ml-2", children: "\u2713 Accepted" })), isRejected && (_jsx("span", { className: "hunk-status rejected text-rose-400 text-[10px] font-medium ml-2", children: "\u2717 Rejected" }))] }), _jsx("div", { className: "diff-hunk-lines border-l-2 border-border pl-2", children: hunk.lines.map((line, lineIndex) => (_jsx("div", { className: `diff-line px-2 py-0.5 select-none ${line.type === "add"
                                            ? "text-green-400 bg-green-500/5"
                                            : line.type === "remove"
                                                ? "text-red-400 bg-red-500/5 line-through"
                                                : "text-muted-foreground"} ${isDecided ? "opacity-60" : ""}`, children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [line.oldLineNum !== undefined && (_jsx("span", { className: "text-dim text-[10px] w-6 text-right select-none", children: line.oldLineNum })), line.newLineNum !== undefined && (_jsx("span", { className: "text-dim text-[10px] w-6 text-right select-none", children: line.newLineNum })), _jsx("span", { className: "whitespace-pre", children: line.content })] }) }, lineIndex))) })] }, hunkIndex));
                    }), hunks.length > 0 && (_jsxs("div", { className: "diff-summary pt-3 border-t border-border text-center text-xs text-muted", children: [_jsxs("p", { children: [acceptedHunks.size, " of ", hunks.length, " hunks accepted"] }), _jsx("p", { className: "text-[10px] mt-1", children: "Click \"Accept All\" to apply accepted hunks, or continue editing individual hunks" })] }))] })] }));
}
