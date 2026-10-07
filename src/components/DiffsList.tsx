import { useEffect, useState } from "react";
import { ApiClient } from "@src/services/ApiClient";
import { SessionItem } from "./QuickPick";

interface DiffData {
  session_id: string;
  filename: string;
  has_changes: boolean;
  unified: string;
  lines_added: number;
  lines_removed: number;
  status: string;
}

interface Props {
  sessions: SessionItem[];
  currentSessionId: string | null;
  onSelectDiff: (diff: DiffData) => void;
  api: ApiClient;
}

export function DiffsList({ sessions, currentSessionId, onSelectDiff, api }: Props) {
  const [diffs, setDiffs] = useState<DiffData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(currentSessionId);

  useEffect(() => {
    if (sessions.length === 0) {
      setDiffs([]);
      return;
    }

    const fetchAllDiffs = async () => {
      setLoading(true);
      const results: DiffData[] = [];

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
        } catch {
          // Ignore individual diff fetch errors
        }
      }

      setDiffs(results);
      setLoading(false);
    };

    fetchAllDiffs();
  }, [sessions, api]);

  if (diffs.length === 0 && !loading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted text-xs">
          <p className="font-medium text-[#f1e4d9]">No diffs available</p>
          <p className="text-dim text-[11px] mt-1">
            Ask Vertico to refactor code in any session to generate diffs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-2 border-b border-white/5">
        <div className="flex items-center justify-between text-xs text-muted mb-2 px-1">
          <span>Available Diffs</span>
          {loading && <span className="text-[10px] text-gold">Loading…</span>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {diffs.map((diff) => {
          const isActive = diff.session_id === selectedSessionId;
          return (
            <button
              key={diff.session_id}
              onClick={() => {
                setSelectedSessionId(diff.session_id);
                onSelectDiff(diff);
              }}
              className={`side-panel-row ${isActive ? "active" : ""}`}
              title={`View diff for ${diff.filename}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs text-[#f1e4d9] truncate">
                  {diff.filename}
                </span>
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-emerald-400">+{diff.lines_added}</span>
                  <span className="text-rose-400">-{diff.lines_removed}</span>
                </div>
              </div>
              <div className="text-[11px] text-muted truncate mt-0.5 font-mono">
                {diff.session_id.slice(0, 16)}... · {diff.status}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}