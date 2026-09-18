import { useEffect, useRef, useState } from "react";

export interface SessionItem {
  session_id: string;
  filename: string;
  status?: string;
}

interface Props {
  open: boolean;
  sessions: SessionItem[];
  onPick: (session: SessionItem) => void;
  onClose: () => void;
}

export function QuickPick({ open, sessions, onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const filtered = sessions.filter((s) =>
    (s.filename || s.session_id).toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    // focus on next frame so the modal is mounted
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) return null;

  const commit = (i: number) => {
    const item = filtered[i];
    if (!item) return;
    onPick(item);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(index);
    }
  };

  return (
    <div
      className="quickpick-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="quickpick-modal" role="dialog" aria-label="Recent sessions">
        <input
          ref={inputRef}
          className="quickpick-input"
          placeholder="Search recent sessions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="quickpick-list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="quickpick-empty">No matching sessions</div>
          )}
          {filtered.map((s, i) => (
            <button
              key={s.session_id}
              className={`quickpick-item ${i === index ? "active" : ""}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => commit(i)}
            >
              <span className="quickpick-item-title">{s.filename || "untitled"}</span>
              {s.status && <span className="quickpick-item-meta">{s.status}</span>}
            </button>
          ))}
        </div>
        <div className="quickpick-hint">↑↓ navigate · ↵ open · esc dismiss</div>
      </div>
    </div>
  );
}
