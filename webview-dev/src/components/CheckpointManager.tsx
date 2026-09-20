import { useState, useCallback } from "react";
import { ApiClient } from "@src/services/ApiClient";

interface Checkpoint {
  id: string;
  timestamp: number;
  label: string;
  sessionId: string;
  files: string[];
  diffSnapshot: any;
}

interface Props {
  sessionId: string | null;
  api: ApiClient;
  diff: any;
  onRestore: (checkpoint: Checkpoint) => void;
}

export function CheckpointManager({ sessionId, api, diff, onRestore }: Props) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const createCheckpoint = useCallback(async () => {
    if (!sessionId || !diff) return;

    setIsCreating(true);
    try {
      const patch = await api.preparePatch(sessionId);
      const checkpoint: Checkpoint = {
        id: `cp_${Date.now()}`,
        timestamp: Date.now(),
        label: `Checkpoint ${new Date().toLocaleTimeString()}`,
        sessionId,
        files: patch.files,
        diffSnapshot: diff,
      };
      setCheckpoints((prev) => [checkpoint, ...prev.slice(0, 9)]); // Keep last 10
    } catch (error) {
      console.error("Failed to create checkpoint:", error);
    } finally {
      setIsCreating(false);
    }
  }, [sessionId, api, diff]);

  const handleRestore = useCallback(
    (checkpoint: Checkpoint) => {
      onRestore(checkpoint);
    },
    [onRestore]
  );

  const handleDelete = useCallback((checkpointId: string) => {
    setCheckpoints((prev) => prev.filter((c) => c.id !== checkpointId));
  }, []);

  if (!sessionId || checkpoints.length === 0) {
    return (
      <div className="checkpoint-empty">
        <button
          className="checkpoint-create-btn"
          onClick={createCheckpoint}
          disabled={isCreating || !sessionId || !diff}
        >
          {isCreating ? (
            <>
              <span className="checkpoint-spinner" />
              Creating…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M6 1C8.20914 1 10 2.79086 10 5C10 7.20914 8.20914 9 6 9C3.79086 9 2 7.20914 2 5C2 2.79086 3.79086 1 6 1Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path d="M6 9V11M6 11L4 9M6 11L8 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Create Checkpoint
            </>
          )}
        </button>
        <p className="checkpoint-hint">
          Creates a snapshot before multi-file changes — one-click restore if needed
        </p>
      </div>
    );
  }

  return (
    <div className="checkpoint-container">
      <div className="checkpoint-header">
        <h4 className="checkpoint-title">Checkpoints</h4>
        <button
          className="checkpoint-create-btn secondary"
          onClick={createCheckpoint}
          disabled={isCreating}
        >
          {isCreating ? (
            <>
              <span className="checkpoint-spinner" />
              Saving…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              New
            </>
          )}
        </button>
      </div>

      <div className="checkpoint-list" role="list">
        {checkpoints.map((cp) => (
          <div key={cp.id} className="checkpoint-item" role="listitem">
            <div className="checkpoint-info">
              <span className="checkpoint-label">{cp.label}</span>
              <span className="checkpoint-meta">
                {cp.files.length} file{cp.files.length !== 1 ? "s" : ""} ·{" "}
                {new Date(cp.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="checkpoint-actions">
              <button
                className="checkpoint-restore-btn"
                onClick={() => handleRestore(cp)}
                title="Restore this checkpoint"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M10 6C10 8.20914 8.20914 10 6 10C3.79086 10 2 8.20914 2 6C2 3.79086 3.79086 2 6 2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path d="M2 6L6 2M2 6L6 10M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Restore
              </button>
              <button
                className="checkpoint-delete-btn"
                onClick={() => handleDelete(cp.id)}
                title="Delete checkpoint"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}