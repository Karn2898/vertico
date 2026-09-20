interface ContextChip {
  id: string;
  label: string;
  type: "file" | "symbol" | "test";
  path?: string;
}

interface Props {
  chips: ContextChip[];
  onRemove: (chipId: string) => void;
  onAdd?: (chip: Omit<ContextChip, "id">) => void;
}

export function ContextChips({ chips, onRemove, onAdd }: Props) {
  if (chips.length === 0) {
    return (
      <div className="context-chips-empty">
        <span className="text-dim text-xs">No context files — agent sees nothing</span>
        {onAdd && (
          <button
            className="context-chip-add"
            onClick={() => onAdd({ label: "auth.py", type: "file" })}
            title="Add context file"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="context-chips-container">
      <div className="context-chips-row" role="list" aria-label="Context files">
        {chips.map((chip) => (
          <button
            key={chip.id}
            className={`context-chip context-chip--${chip.type}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(chip.id);
            }}
            title={chip.path || chip.label}
            role="listitem"
          >
            <span className="context-chip-icon">
              {chip.type === "file" && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M1.5 2.5L3 1H8.5C9.32843 1 10 1.67157 10 2.5V7.5C10 8.32843 9.32843 9 8.5 9H1.5C0.671573 9 0 8.32843 0 7.5V2.5C0 1.67157 0.671573 1 1.5 1Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M3 4H7M3 6H7M3 8H5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                </svg>
              )}
              {chip.type === "symbol" && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M5 1.5C6.38071 1.5 7.5 2.61929 7.5 4C7.5 5.38071 6.38071 6.5 5 6.5C3.61929 6.5 2.5 5.38071 2.5 4C2.5 2.61929 3.61929 1.5 5 1.5Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                  <path d="M5 6.5V8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              )}
              {chip.type === "test" && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M5 1C6.65685 1 8 2.34315 8 4C8 5.65685 6.65685 7 5 7C3.34315 7 2 5.65685 2 4C2 2.34315 3.34315 1 5 1Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                  <path d="M3.5 4L4.5 5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="context-chip-label">{chip.label}</span>
            <button
              className="context-chip-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(chip.id);
              }}
              aria-label={`Remove ${chip.label} from context`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </button>
        ))}
      </div>
      {onAdd && (
        <button className="context-chip-add" onClick={() => onAdd({ label: "new_file.py", type: "file" })} title="Add context file">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}