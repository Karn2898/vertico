// webview/src/components/DiffPanel.tsx

interface Props {
  diff: any;
  onAccept: () => void;
  onReject: () => void;
}

export function DiffPanel({ diff, onAccept, onReject }: Props) {
  if (!diff) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No diff available. Run a refactor first.
      </div>
    );
  }

  const lines = diff.unified?.split("\n") ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border text-xs">
        <span className="text-green-500">+{diff.lines_added} added</span>
        <span className="text-red-500">-{diff.lines_removed} removed</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={onAccept}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={onReject}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>

      {/* Unified diff */}
      <div className="flex-1 overflow-y-auto font-mono text-xs p-2">
        {lines.map((line: string, i: number) => (
          <div
            key={i}
            className={`px-2 py-0.5 rounded
              ${line.startsWith("+") && !line.startsWith("+++")
                ? "bg-green-500/10 text-green-400"
                : line.startsWith("-") && !line.startsWith("---")
                  ? "bg-red-500/10 text-red-400"
                  : line.startsWith("@@")
                    ? "text-blue-400"
                    : "text-muted-foreground"
              }`}
          >
            {line || " "}
          </div>
        ))}
      </div>
    </div>
  );
}