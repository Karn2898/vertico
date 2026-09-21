interface DiffHunk {
  header: string;
  lines: DiffLine[];
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
}

interface DiffLine {
  type: "context" | "add" | "remove";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

interface ParsedDiff {
  fileHeader: string;
  hunks: DiffHunk[];
}

function parseUnifiedDiff(unified: string): ParsedDiff {
  const lines = unified.split("\n");
  const hunks: DiffHunk[] = [];
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

      const hunkLines: DiffLine[] = [];
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
        } else if (hunkLine.startsWith("-")) {
          hunkLines.push({
            type: "remove",
            content: hunkLine.slice(1),
            oldLineNum: oldLineNum++,
          });
        } else {
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
    } else {
      i++;
    }
  }

  return { fileHeader: fileHeader.trim(), hunks };
}

function generateHunkDiff(hunk: DiffHunk, fileHeader: string): string {
  const lines = [fileHeader, hunk.header];
  for (const line of hunk.lines) {
    const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
    lines.push(prefix + line.content);
  }
  return lines.join("\n");
}

interface Props {
  diff: any;
  onAcceptHunk: (hunkIndex: number) => void;
  onRejectHunk: (hunkIndex: number) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onApplySelected: () => void;
  acceptedHunks: Set<number>;
  rejectedHunks: Set<number>;
}

export function InlineDiffPanel({
  diff,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
  onApplySelected,
  acceptedHunks,
  rejectedHunks,
}: Props) {
  if (!diff?.has_changes || !diff?.diff?.unified) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No diff available. Run a refactor first.
      </div>
    );
  }

  const parsed = parseUnifiedDiff(diff.diff.unified);
  const { fileHeader, hunks } = parsed;

  const totalAdds = diff.diff.lines_added ?? 0;
  const totalRemoves = diff.diff.lines_removed ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-border text-xs">
        <span className="text-green-500">+{totalAdds} added</span>
        <span className="text-red-500">-{totalRemoves} removed</span>
        <span className="text-muted mx-1">|</span>
        <span className="text-muted">
          {hunks.length} hunk{hunks.length !== 1 ? "s" : ""}
        </span>
        <span className="text-muted mx-1">|</span>
        <span className="text-emerald-400">
          ✓ {acceptedHunks.size} accepted
        </span>
        <span className="text-rose-400">
          ✗ {rejectedHunks.size} rejected
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={onApplySelected}
            disabled={acceptedHunks.size === 0}
            className="bg-gold text-bg px-3 py-1 rounded hover:bg-gold/80 disabled:opacity-50 transition-colors text-xs font-medium"
          >
            Apply Selected
          </button>
          <button
            onClick={onAcceptAll}
            disabled={acceptedHunks.size === hunks.length}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50 transition-colors text-xs"
          >
            Accept All
          </button>
          <button
            onClick={onRejectAll}
            disabled={rejectedHunks.size === hunks.length}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50 transition-colors text-xs"
          >
            Reject All
          </button>
        </div>
      </div>

      {/* Hunks list */}
      <div className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-3">
        {hunks.length === 0 && (
          <div className="text-center text-muted py-8">
            No hunks in this diff
          </div>
        )}

        {hunks.map((hunk, hunkIndex) => {
          const isAccepted = acceptedHunks.has(hunkIndex);
          const isRejected = rejectedHunks.has(hunkIndex);
          const isDecided = isAccepted || isRejected;

          return (
            <div
              key={hunkIndex}
              className={`diff-hunk ${isAccepted ? "accepted" : ""} ${isRejected ? "rejected" : ""} ${
                isDecided ? "decided" : ""
              }`}
            >
              {/* Hunk header with actions */}
              <div className="diff-hunk-header flex items-center gap-2 px-2 py-1.5 rounded-t border border-border bg-surface">
                <span className="text-blue-400 text-xs">{hunk.header}</span>
                <span className="text-dim text-[10px] ml-auto">
                  {hunk.lines.filter((l) => l.type === "add").length} added,{" "}
                  {hunk.lines.filter((l) => l.type === "remove").length} removed
                </span>
                {!isDecided && (
                  <div className="flex gap-1.5 ml-2">
                    <button
                      onClick={() => onAcceptHunk(hunkIndex)}
                      className="hunk-action-btn accept bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                      title="Accept this hunk"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => onRejectHunk(hunkIndex)}
                      className="hunk-action-btn reject bg-rose-600/20 text-rose-400 hover:bg-rose-600/40 px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
                      title="Reject this hunk"
                    >
                      Reject
                    </button>
                  </div>
                )}
                {isAccepted && (
                  <span className="hunk-status accepted text-emerald-400 text-[10px] font-medium ml-2">
                    ✓ Accepted
                  </span>
                )}
                {isRejected && (
                  <span className="hunk-status rejected text-rose-400 text-[10px] font-medium ml-2">
                    ✗ Rejected
                  </span>
                )}
              </div>

              {/* Hunk lines */}
              <div className="diff-hunk-lines border-l-2 border-border pl-2">
                {hunk.lines.map((line, lineIndex) => (
                  <div
                    key={lineIndex}
                    className={`diff-line px-2 py-0.5 select-none ${
                      line.type === "add"
                        ? "text-green-400 bg-green-500/5"
                        : line.type === "remove"
                        ? "text-red-400 bg-red-500/5 line-through"
                        : "text-muted-foreground"
                    } ${isDecided ? "opacity-60" : ""}`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {line.oldLineNum !== undefined && (
                        <span className="text-dim text-[10px] w-6 text-right select-none">
                          {line.oldLineNum}
                        </span>
                      )}
                      {line.newLineNum !== undefined && (
                        <span className="text-dim text-[10px] w-6 text-right select-none">
                          {line.newLineNum}
                        </span>
                      )}
                      <span className="whitespace-pre">{line.content}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Summary */}
        {hunks.length > 0 && (
          <div className="diff-summary pt-3 border-t border-border text-center text-xs text-muted">
            <p>
              {acceptedHunks.size} of {hunks.length} hunks accepted
            </p>
            <p className="text-[10px] mt-1">
              Click "Accept All" to apply accepted hunks, or continue editing individual hunks
            </p>
          </div>
        )}
      </div>
    </div>
  );
}