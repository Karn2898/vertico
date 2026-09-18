import React, { useState } from "react";
import { SessionItem } from "./QuickPick";

export type SideTab = "diffs" | "sessions" | "context";

interface Props {
  open: boolean;
  onClose: () => void;
  diff: React.ReactNode;
  diffData?: any;
  context: React.ReactNode;
  sessions: SessionItem[];
  currentSessionId: string | null;
  onSelectSession: (session: SessionItem) => void;
  apiStatus: string;
  onOpenQuickPick: () => void;
}

export function SidePane({
  open,
  onClose,
  diff,
  diffData,
  context,
  sessions,
  currentSessionId,
  onSelectSession,
  apiStatus,
  onOpenQuickPick,
}: Props) {
  const [tab, setTab] = useState<SideTab>("diffs");

  const isConnected = apiStatus.toLowerCase().startsWith("connect");

  return (
    <>
      {/* Dimmed backdrop when panel is open */}
      <div
        className={`side-panel-backdrop ${open ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in side panel */}
      <aside
        className={`side-panel ${open ? "open" : ""}`}
        aria-label="Reference Panel"
      >
        {/* Header with tabs and dismiss icon */}
        <div className="side-panel-header">
          <div className="side-panel-tabs">
            {(["diffs", "sessions", "context"] as SideTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`side-panel-tab ${tab === t ? "active" : ""}`}
              >
                {t === "diffs" ? "Diffs" : t === "sessions" ? "Sessions" : "Context"}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="side-panel-close-btn"
            title="Close side panel"
            aria-label="Close side panel"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1.5 1.5L12.5 12.5M1.5 12.5L12.5 1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Panel Content */}
        <div className="side-panel-content">
          {tab === "diffs" && (
            <div className="flex flex-col h-full overflow-hidden">
              {diffData ? (
                <>
                  <div className="p-2 border-b border-white/5">
                    <button
                      className="side-panel-row active"
                      title="Current modified diff"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-[#f1e4d9] font-medium truncate">
                          {diffData.filename || "Active session changes"}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <span className="text-emerald-400">+{diffData.lines_added ?? 0}</span>
                          <span className="text-rose-400">-{diffData.lines_removed ?? 0}</span>
                        </div>
                      </div>
                      <div className="text-[11px] text-muted truncate mt-0.5">
                        Unified code review diff
                      </div>
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden">{diff}</div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted text-xs">
                  <p className="font-medium text-[#f1e4d9]">No active diffs</p>
                  <p className="text-dim text-[11px] mt-1">
                    Ask Vertico to refactor or edit code to review diffs here.
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === "sessions" && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-2 space-y-1 overflow-y-auto flex-1">
                {sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted text-xs">
                    <p className="font-medium text-[#f1e4d9]">No sessions yet</p>
                    <p className="text-dim text-[11px] mt-1">
                      Start a chat to create a new session.
                    </p>
                  </div>
                ) : (
                  sessions.map((s) => {
                    const isActive = s.session_id === currentSessionId;
                    return (
                      <button
                        key={s.session_id}
                        onClick={() => {
                          onSelectSession(s);
                          onClose();
                        }}
                        className={`side-panel-row ${isActive ? "active" : ""}`}
                        title={`Switch to session ${s.filename || s.session_id}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-xs text-[#f1e4d9] truncate">
                            {s.filename || "untitled session"}
                          </span>
                          {s.status && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#24262B] text-[var(--gold)]">
                              {s.status}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted truncate mt-0.5 font-mono">
                          {s.session_id.slice(0, 16)}...
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {tab === "context" && (
            <div className="flex-1 overflow-hidden h-full">
              {context}
            </div>
          )}
        </div>

        {/* Footer: API status and QuickPick entry */}
        <div className="side-panel-footer">
          <div className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full inline-block shrink-0"
              style={{
                background: isConnected ? "#10b981" : "#f43f5e",
              }}
            />
            <span className="truncate">{`API: ${apiStatus}`}</span>
          </div>
          <button
            onClick={() => {
              onClose();
              onOpenQuickPick();
            }}
            className="text-xs text-muted hover:text-foreground flex items-center gap-1.5 transition-colors shrink-0 ml-2"
            title="Recent sessions quick-pick (Cmd/Ctrl+K)"
          >
            <span>Quick Pick</span>
            <kbd className="bg-[#24262B] px-1.5 py-0.5 rounded text-[10px] text-[var(--gold)]">⌘K</kbd>
          </button>
        </div>
      </aside>
    </>
  );
}
