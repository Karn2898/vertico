import { useEffect, useRef, useState, useCallback } from "react";
import { ChatWindow } from "@src/components/ChatWindow";
import { DiffPanel } from "@src/components/DiffPanel";
import { InlineDiffPanel } from "@src/components/InlineDiffPanel";
import { FileTree } from "@src/components/FileTree";
import { ApiClient } from "@src/services/ApiClient";
import { SidePane, SideTab } from "./components/SidePane";
import { QuickPick, SessionItem } from "./components/QuickPick";
import { ContextChips, ContextChip } from "./components/ContextChips";
import { CheckpointManager } from "./components/CheckpointManager";

const API_URL =
  (window as any).__VERTICO_API__ ||
  new URLSearchParams(location.search).get("api") ||
  "http://localhost:8000";

const api = new ApiClient(API_URL);

interface DiffData {
  session_id: string;
  filename: string;
  has_changes: boolean;
  unified: string;
  lines_added: number;
  lines_removed: number;
  status: string;
}

interface Checkpoint {
  id: string;
  timestamp: number;
  label: string;
  sessionId: string;
  files: string[];
  diffSnapshot: any;
}

export default function App() {
  const [messages, setMessages] = useState<any[]>([]);
  const [diff, setDiff] = useState<any>(null);
  const [context, setContext] = useState<any>(null);
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<string>("connecting…");

  // Context chips state
  const [contextChips, setContextChips] = useState<ContextChip[]>([]);

  // Checkpoint state
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  // Per-hunk diff decisions
  const [acceptedHunks, setAcceptedHunks] = useState<Set<number>>(new Set());
  const [rejectedHunks, setRejectedHunks] = useState<Set<number>>(new Set());

  // Layout state: side panel overlay & QuickPick overlay
  const [sideOpen, setSideOpen] = useState<boolean>(false);
  const [sideTab, setSideTab] = useState<SideTab>("diffs");
  const [quickPickOpen, setQuickPickOpen] = useState<boolean>(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);

  const cancelRef = useRef<(() => void) | null>(null);

  const fetchSessions = async () => {
    try {
      const list = await api.listSessions();
      setSessions(list);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    api
      .checkHealth()
      .then(() => setApiStatus("connected"))
      .catch(() => setApiStatus("offline (start API on :8000)"));

    return () => cancelRef.current?.();
  }, []);

  // Keyboard shortcut listener for Cmd/Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        fetchSessions();
        setQuickPickOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const ensureSession = async (filename?: string): Promise<string | null> => {
    if (sessionId) return sessionId;
    try {
      const name = filename || "untitled.py";
      const s = await api.createSession(name, "");
      setSessionId(s.session_id);
      fetchSessions();
      return s.session_id;
    } catch {
      return null;
    }
  };

  const sendMessage = async (text: string) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    // Create session with first user message as name if no session exists
    const sid = await ensureSession(sessionId ? undefined : text.slice(0, 50));
    if (!sid) {
      setMessages((prev) => [...prev, { role: "system", content: "API offline — start the Vertico API on port 8000." }]);
      return;
    }
    setStreaming(true);
    let acc = "";
    let thinkingMessageIndex = -1;
    // Get context file paths from chips
    const contextFiles = contextChips.map(c => c.path || c.label).filter(Boolean);
    cancelRef.current = api.streamChat(sid, text, {
      onMessage: (data) => {
        const content = data.content ?? "";
        // thinking heartbeat: start the animation, append nothing
        if (data.node === "thinking" && !content) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last?.streaming) return prev;
            return [...prev, { role: "assistant", content: "", streaming: true, node: "thinking" }];
          });
          return;
        }
        if (data.node && data.node !== "done") {
          acc += (acc ? "\n" : "") + `**${data.node}**\n${content}`;
        } else {
          acc += content;
        }
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last?.streaming) {
            return [...prev.slice(0, -1), { ...last, content: acc, streaming: true, node: data.node }];
          }
          return [...prev, { role: "assistant", content: acc, streaming: true, node: data.node }];
        });

        if (data.node === "refactorer" || data.node === "done") {
          api.getDiff(sid).then((d) => setDiff(d)).catch(() => {});
        }
      },
      onError: () => {
        setStreaming(false);
        setMessages((prev) => [...prev, { role: "system", content: "Stream error." }]);
      },
      onAbort: () => {
        setStreaming(false);
        cancelRef.current = null;
        setStreaming(false);
        cancelRef.current = null;
        setMessages((prev) =>
          prev.map((m, i) => (i === prev.length - 1 ? { ...m, streaming: false } : m))
        );
      },
      onDone: () => {
        setStreaming(false);
        setMessages((prev) =>
          prev.map((m, i) => (i === prev.length - 1 ? { ...m, streaming: false } : m))
        );
      },
    }, contextFiles);
  };

  const handleCancel = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setStreaming(false);
    setMessages((prev) =>
      prev.map((m, i) => (i === prev.length - 1 && m.streaming ? { ...m, streaming: false } : m))
    );
  }, []);

  const handlePickSession = (session: SessionItem) => {
    setSessionId(session.session_id);
    setAcceptedHunks(new Set());
    setRejectedHunks(new Set());
    api
      .getSessionState(session.session_id)
      .then((state) => {
        setMessages((prev) => {
          const history = (state?.messages ?? []).map(
            (m: any) => ({ role: m.role, content: m.content })
          );
          return history.length > 0
            ? history
            : [{ role: "system", content: `Switched to session ${session.filename || session.session_id}` }];
        });
      })
      .catch(() =>
        setMessages([{ role: "system", content: `Switched to session ${session.filename || session.session_id}` }])
      );
    api.getDiff(session.session_id).then((d) => setDiff(d)).catch(() => {});
  };

  const handleSelectDiff = (diffData: DiffData) => {
    setDiff({
      has_changes: diffData.has_changes,
      diff: {
        unified: diffData.unified,
        lines_added: diffData.lines_added,
        lines_removed: diffData.lines_removed,
      },
      status: diffData.status,
      filename: diffData.filename,
    });
    setAcceptedHunks(new Set());
    setRejectedHunks(new Set());
  };

  // Context chips handlers
  const addContextChip = useCallback((chip: Omit<ContextChip, "id">) => {
    const newChip: ContextChip = {
      ...chip,
      id: `chip_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    };
    setContextChips((prev) => [...prev, newChip]);
  }, []);

  const removeContextChip = useCallback((chipId: string) => {
    setContextChips((prev) => prev.filter((c) => c.id !== chipId));
  }, []);

  // Per-hunk diff handlers
  const handleAcceptHunk = useCallback((hunkIndex: number) => {
    setAcceptedHunks((prev) => new Set([...prev, hunkIndex]));
    setRejectedHunks((prev) => {
      const next = new Set(prev);
      next.delete(hunkIndex);
      return next;
    });
  }, []);

  const handleRejectHunk = useCallback((hunkIndex: number) => {
    setRejectedHunks((prev) => new Set([...prev, hunkIndex]));
    setAcceptedHunks((prev) => {
      const next = new Set(prev);
      next.delete(hunkIndex);
      return next;
    });
  }, []);

  const handleAcceptAllHunks = useCallback(() => {
    if (!diff?.diff?.unified) return;
    // We need to parse the diff to get hunk count
    const lines = diff.diff.unified.split("\n");
    const hunkCount = lines.filter((l: string) => l.startsWith("@@")).length;
    setAcceptedHunks(new Set(Array.from({ length: hunkCount }, (_, i) => i)));
    setRejectedHunks(new Set());
  }, [diff]);

  const handleRejectAllHunks = useCallback(() => {
    if (!diff?.diff?.unified) return;
    const lines = diff.diff.unified.split("\n");
    const hunkCount = lines.filter((l: string) => l.startsWith("@@")).length;
    setRejectedHunks(new Set(Array.from({ length: hunkCount }, (_, i) => i)));
    setAcceptedHunks(new Set());
  }, [diff]);

  const handleApplySelected = useCallback(async () => {
    if (!sessionId || acceptedHunks.size === 0) return;
    try {
      await api.applyPartialDiff(
        sessionId,
        Array.from(acceptedHunks),
        Array.from(rejectedHunks)
      );
      setMessages((prev) => [
        ...prev,
        { role: "system", content: `Applied ${acceptedHunks.size} hunk(s)` },
      ]);
      setDiff(null);
      setAcceptedHunks(new Set());
      setRejectedHunks(new Set());
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "system", content: `Failed to apply: ${error instanceof Error ? error.message : "Unknown error"}` },
      ]);
    }
  }, [sessionId, api, acceptedHunks, rejectedHunks]);

  // Checkpoint handlers
  const createCheckpoint = useCallback(async () => {
    if (!sessionId || !diff) return;
    setIsCreatingCheckpoint(true);
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
      setCheckpoints((prev) => [checkpoint, ...prev.slice(0, 9)]);
    } catch (error) {
      console.error("Failed to create checkpoint:", error);
    } finally {
      setIsCreatingCheckpoint(false);
    }
  }, [sessionId, api, diff]);

  const restoreCheckpoint = useCallback((checkpoint: Checkpoint) => {
    setDiff(checkpoint.diffSnapshot);
    setAcceptedHunks(new Set());
    setRejectedHunks(new Set());
    setMessages((prev) => [...prev, { role: "system", content: `Restored checkpoint: ${checkpoint.label}` }]);
  }, []);

  const deleteCheckpoint = useCallback((checkpointId: string) => {
    setCheckpoints((prev) => prev.filter((c) => c.id !== checkpointId));
  }, []);

  const handleRegenerate = useCallback((messageIndex: number) => {
    // Find the user message that preceded this assistant message
    const userMsgIndex = messages.slice(0, messageIndex).lastIndexOf(
      messages.slice(0, messageIndex).find((m, i) => m.role === "user" && i < messageIndex)
    );
    // Simple approach: re-send the last user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    if (lastUserMsg) {
      // Remove messages after the user message
      const userIdx = messages.lastIndexOf(lastUserMsg);
      setMessages(prev => prev.slice(0, userIdx + 1));
      sendMessage(lastUserMsg.content);
    }
  }, [messages, sendMessage]);

  const handleFeedback = useCallback((messageIndex: number, feedback: "helpful" | "not_helpful") => {
    // Could send feedback to backend here
    console.log(`Feedback for message ${messageIndex}: ${feedback}`);
    setMessages(prev => prev.map((m, i) =>
      i === messageIndex ? { ...m, feedback } : m
    ));
  }, []);

  const handleIndexRepo = useCallback(async () => {
    try {
      // Get workspace root from context or use a default
      await api.indexRepo(".");
      setMessages((prev) => [...prev, { role: "system", content: "Repository indexed successfully" }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "system", content: `Failed to index repo: ${error instanceof Error ? error.message : "Unknown error"}` }]);
    }
  }, [api]);

  const [isCreatingCheckpoint, setIsCreatingCheckpoint] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground font-sans overflow-hidden">
      {/* Minimal header: VERTICO wordmark only */}
      <header className="flex items-center border-b border-border px-4 py-2.5 bg-background">
        <span className="font-bold text-sm tracking-wider text-primary">VERTICO</span>
      </header>

      {/* Context chips bar - always visible at top */}
      <ContextChips
        chips={contextChips}
        onRemove={removeContextChip}
        onAdd={addContextChip}
      />

      {/* Hamburger: fixed top-right corner of the whole interface */}
      <button
        onClick={async () => {
          await fetchSessions();
          setSideTab("sessions");
          setSideOpen(true);
        }}
        className="hamburger-btn-fixed"
        aria-label="Open sessions panel"
        title="Open sessions panel"
      >
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="0" y1="1" x2="18" y2="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="0" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="0" y1="13" x2="18" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {/* Main layout */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0 relative">
        {/* Primary Pane: Chat */}
        <main className="flex-1 flex flex-col min-w-0 h-full">
          <ChatWindow
            messages={messages}
            streaming={streaming}
            onSend={sendMessage}
            onCancel={handleCancel}
            onRegenerate={handleRegenerate}
            onFeedback={handleFeedback}
          />
        </main>

        {/* Side Panel Overlay: Diffs, Sessions & Context */}
        <SidePane
          open={sideOpen}
          onClose={() => setSideOpen(false)}
          tab={sideTab}
          onTabChange={setSideTab}
          diff={
            <>
              <InlineDiffPanel
                diff={diff}
                onAcceptHunk={handleAcceptHunk}
                onRejectHunk={handleRejectHunk}
                onAcceptAll={handleAcceptAllHunks}
                onRejectAll={handleRejectAllHunks}
                onApplySelected={handleApplySelected}
                acceptedHunks={acceptedHunks}
                rejectedHunks={rejectedHunks}
              />
              <CheckpointManager
                sessionId={sessionId}
                api={api}
                diff={diff}
                onRestore={restoreCheckpoint}
              />
            </>
          }
          diffData={diff}
          context={
            <FileTree
              context={context}
              chips={contextChips}
              onRemoveChip={removeContextChip}
              onAddChip={addContextChip}
            />
          }
          sessions={sessions}
          currentSessionId={sessionId}
          onSelectSession={handlePickSession}
          onSelectDiff={handleSelectDiff}
          apiStatus={apiStatus}
          onOpenQuickPick={() => {
            fetchSessions();
            setQuickPickOpen(true);
          }}
          api={api}
          onIndexRepo={handleIndexRepo}
        />
      </div>

      {/* Cmd/Ctrl+K QuickPick Modal */}
      <QuickPick
        open={quickPickOpen}
        sessions={sessions}
        onPick={handlePickSession}
        onClose={() => setQuickPickOpen(false)}
      />
    </div>
  );
}
