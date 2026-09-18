import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  diff: React.ReactNode;
  context: React.ReactNode;
  width: number;
  onWidthChange: (w: number) => void;
}

type SideTab = "diffs" | "context";

const MIN = 240;
const MAX = 640;

export function SidePane({ diff, context, width, onWidthChange }: Props) {
  const [tab, setTab] = useState<SideTab>("diffs");
  const draggingRef = useRef(false);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      // drag handle sits on the left edge of the pane; dragging left widens it
      const w = window.innerWidth - e.clientX;
      onWidthChange(Math.min(MAX, Math.max(MIN, w)));
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onWidthChange]);

  return (
    <div className="side-pane" style={{ width }}>
      {/* drag handle */}
      <div
        className="side-pane-resizer"
        onMouseDown={onDragStart}
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize"
      />
      <div className="flex flex-col h-full min-w-0">
        {/* top tab strip */}
        <div className="side-pane-tabs">
          {(["diffs", "context"] as SideTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`side-pane-tab ${tab === t ? "active" : ""}`}
            >
              {t === "diffs" ? "Diffs" : "Context"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden min-h-0">
          {tab === "diffs" ? diff : context}
        </div>
      </div>
    </div>
  );
}
