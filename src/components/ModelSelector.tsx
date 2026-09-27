import { useEffect, useRef, useState, useMemo } from "react";

export interface Model {
  id: string;
  provider: string;
  label: string;
  description: string;
}

const STORAGE_KEY = "vertico.chatModel";

function loadModel(models: Model[]): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && models.some(m => m.id === stored)) return stored;
  } catch {
    /* storage unavailable (e.g. webview restrictions) */
  }
  return models[0]?.id ?? "";
}

interface Props {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  apiUrl: string;
}

export function ModelSelector({ value, onChange, disabled, apiUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/chat/models`)
      .then(res => res.ok ? res.json() : [])
      .then((data: Model[]) => {
        if (!cancelled) {
          setModels(data);
          if (data.length > 0 && !data.some(m => m.id === value)) {
            onChange(data[0].id);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => { cancelled = true; };
  }, [apiUrl]);

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

  const current = useMemo(() => models.find(m => m.id === value) ?? models[0], [models, value]);

  const select = (modelId: string) => {
    onChange(modelId);
    try {
      localStorage.setItem(STORAGE_KEY, modelId);
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex-shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        title={`Model: ${current?.label ?? value} (${current?.description ?? ""})`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1 border border-border rounded-lg px-2 py-1.5 text-sm text-[#d8c9bd] hover:bg-[#2b2320] transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        <span className="flex-1 text-left truncate max-w-[100px]">{current?.label ?? value}</span>
        <svg
          width="8"
          height="8"
          viewBox="0 0 10 10"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute bottom-full left-0 mb-1 w-48 z-50 bg-[#211a18] border border-border rounded-lg shadow-lg overflow-hidden py-0.5"
        >
          {models.map(m => (
            <li key={m.id} role="option" aria-selected={m.id === value}>
              <button
                type="button"
                onClick={() => select(m.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left hover:bg-[#2b2320] transition-colors ${m.id === value ? "text-[#b8935a]" : "text-[#d8c9bd]"}`}
              >
                <span className="flex-1">
                  {m.label}
                  <span className="block text-[9px] text-[#6b5f58]">{m.description}</span>
                </span>
                {m.id === value && <span aria-hidden>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
