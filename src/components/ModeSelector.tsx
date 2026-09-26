import { useEffect, useRef, useState } from "react";

export type ChatMode = "fast" | "thorough";

const MODES: { value: ChatMode; label: string; icon: string; hint: string }[] = [
  { value: "fast", label: "Fast", icon: "⚡", hint: "Cheaper / faster" },
  { value: "thorough", label: "Thorough", icon: "🔎", hint: "Full reasoning" },
];

const STORAGE_KEY = "vertico.chatMode";

function loadMode(): ChatMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "fast" || stored === "thorough") return stored;
  } catch {
    /* storage unavailable (e.g. webview restrictions) */
  }
  return "fast";
}

interface Props {
  value: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
}

/**
 * Compact speed-mode selector shown immediately left of the send button.
 * Opens on click without shifting the input/send layout (absolutely-
 * positioned menu, fixed-size trigger). Selection persists per-session
 * via localStorage and defaults to "fast".
 */
export function ModeSelector({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const current = MODES.find((m) => m.value === value) ?? MODES[0];

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const select = (mode: ChatMode) => {
    onChange(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex-shrink-0">
      {/* Trigger — fixed size so nothing shifts when the menu opens */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title={`Speed mode: ${current.label} (${current.hint})`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1 border border-border rounded-lg px-2 py-2 text-xs text-[#d8c9bd] hover:bg-[#2b2320] transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        <span aria-hidden>{current.icon}</span>
        <span>{current.label}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Menu — absolutely positioned so the send button never moves */}
      {open && (
        <ul
          role="listbox"
          className="absolute bottom-full left-0 mb-1 w-44 z-50 bg-[#211a18] border border-border rounded-lg shadow-lg overflow-hidden py-1"
        >
          {MODES.map((m) => (
            <li key={m.value} role="option" aria-selected={m.value === value}>
              <button
                type="button"
                onClick={() => select(m.value)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[#2b2320] transition-colors ${m.value === value ? "text-[#b8935a]" : "text-[#d8c9bd]"
                  }`}
              >
                <span aria-hidden>{m.icon}</span>
                <span className="flex-1">
                  {m.label}
                  <span className="block text-[10px] text-[#6b5f58]">{m.hint}</span>
                </span>
                {m.value === value && <span aria-hidden>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
