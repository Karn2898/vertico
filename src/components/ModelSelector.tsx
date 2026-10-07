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
  onChange: (model: string) => void;
  disabled?: boolean;
  apiUrl: string;
}

export function ModelSelector({ onChange, disabled, apiUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [currentModel, setCurrentModel] = useState<string>("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Fetch models and initialize from localStorage
  useEffect(() => {
    let cancelled = false;
    fetch(`${apiUrl}/chat/models`)
      .then(res => res.ok ? res.json() : [])
      .then((data: Model[]) => {
        if (!cancelled) {
          setModels(data);
          const initial = loadModel(data);
          setCurrentModel(initial);
          if (initial) onChange(initial);
        }
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => { cancelled = true; };
  }, [apiUrl, onChange]);

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

  const current = useMemo(() => models.find(m => m.id === currentModel) ?? models[0], [models, currentModel]);

  const select = (modelId: string) => {
    setCurrentModel(modelId);
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
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        title={`Model: ${current?.label ?? currentModel} (${current?.description ?? ""})`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1 border border-border rounded-full px-2 py-1 text-xs text-[#d8c9bd] hover:bg-[#2b2320] transition-colors disabled:opacity-50 whitespace-nowrap min-w-[100px]"
      >
        <span className="flex-1 text-left truncate">{current?.label ?? currentModel}</span>
        <svg
          width="7"
          height="7"
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
          className="absolute bottom-full left-0 mb-1 w-52 max-h-64 overflow-y-auto overscroll-contain bg-[#211a18] border border-border rounded-lg shadow-lg py-0.5 model-dropdown"
        >
          {models.map(m => (
            <li key={m.id} role="option" aria-selected={m.id === currentModel}>
              <button
                type="button"
                onClick={() => select(m.id)}
                className={`w-full flex items-center gap-2 px-2 py-1 text-xs text-left hover:bg-[#2b2320] transition-colors ${m.id === currentModel ? "text-[#b8935a]" : "text-[#d8c9bd]"}`}
              >
                <span className="flex-1 truncate">
                  {m.label}
                  <span className="block text-[9px] text-[#6b5f58]">{m.description}</span>
                </span>
                {m.id === currentModel && <span aria-hidden>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
