import { useEffect, useRef, useState } from "react";
import { ChatWindow } from "@src/components/ChatWindow";
import { DiffPanel } from "@src/components/DiffPanel";
import { FileTree } from "@src/components/FileTree";
import { ApiClient } from "@src/services/ApiClient";
import { SidePane } from "./components/SidePane";
import { QuickPick, SessionItem } from "./components/QuickPick";

const API_URL =
  (window as any).__VERTICO_API__ ||
  new URLSearchParams(location.search).get("api") ||
  "http://localhost:8000";

const api = new ApiClient(API_URL);

export default function App() {
  const [messages, setMessages] = useState<any[]>([]);
  const [diff, setDiff] = useState<any>(null);
  const [context, setContext] = useState<any>(null);
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<string>("connecting…");

  // Layout state: resizable side pane & QuickPick overlay
  const [sideWidth, setSideWidth] = useState<number>(340);
  const [sideOpen, setSideOpen] = useState<boolean>(true);
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

    (async () => {
      try {
        const s = await api.createSession("untitled.py", "# paste code and ask Vertico to refactor");
        setSessionId(s.session_id);
        fetchSessions();
      } catch {
        setApiStatus("offline (start API on :8000)");
      }
    })();

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

  const ensureSession = async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    try {
      const s = await api.createSession("untitled.py", "");
      setSessionId(s.session_id);
      fetchSessions();
      return s.session_id;
    } catch {
      return null;
    }
  };

  const sendMessage = async (text: string) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    const sid = await ensureSession();
    if (!sid) {
      setMessages((prev) => [...prev, { role: "system", content: "API offline — start the Vertico API on port 8000." }]);
      return;
    }
    setStreaming(true);
    let acc = "";
    cancelRef.current = api.streamChat(sid, text, {
      onMessage: (data) => {
        const content = data.content ?? "";
        if (data.node && data.node !== "done") {
          acc += (acc ? "\n" : "") + `**${data.node}**\n${content}`;
        } else {
          acc += content;
        }
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last?.streaming) {
            return [...prev.slice(0, -1), { ...last, content: acc }];
          }
          return [...prev, { role: "assistant", content: acc, streaming: true }];
        });

        if (data.node === "refactorer" || data.node === "done") {
          api.getDiff(sid).then((d) => setDiff(d)).catch(() => {});
        }
      },
      onError: () => {
        setStreaming(false);
        setMessages((prev) => [...prev, { role: "system", content: "Stream error." }]);
      },
      onDone: () => {
        setStreaming(false);
        setMessages((prev) =>
          prev.map((m, i) => (i === prev.length - 1 ? { ...m, streaming: false } : m))
        );
      },
    });
  };

  const handlePickSession = (session: SessionItem) => {
    setSessionId(session.session_id);
    setMessages([{ role: "system", content: `Switched to session ${session.filename || session.session_id}` }]);
    api.getDiff(session.session_id).then((d) => setDiff(d)).catch(() => {});
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground font-sans overflow-hidden">
      {/* Header bar */}
      <header className="flex items-center justify-between border-b border-border px-4 py-2 bg-surface">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm tracking-wide text-primary">VERTICO</span>
          <button
            onClick={() => {
              fetchSessions();
              setQuickPickOpen(true);
            }}
            className="px-2.5 py-1 text-xs rounded bg-[#1b1513] border border-border text-muted hover:text-foreground flex items-center gap-1.5 transition-colors"
            title="Recent sessions (Cmd/Ctrl+K)"
          >
            <span>Recent Sessions</span>
            <kbd className="bg-surface px-1.5 py-0.5 rounded text-[10px] border border-border text-dim">⌘K</kbd>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">{`API: ${apiStatus}`}</span>
          <button
            onClick={() => setSideOpen((open) => !open)}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              sideOpen
                ? "bg-primary text-primary-foreground"
                : "bg-[#1b1513] border border-border text-muted hover:text-foreground"
            }`}
          >
            {sideOpen ? "Hide Side Pane" : "Show Side Pane"}
          </button>
        </div>
      </header>

      {/* Main Two-region layout */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0">
        {/* Primary Pane: Chat */}
        <main className="flex-1 flex flex-col min-w-0 h-full">
          <ChatWindow messages={messages} streaming={streaming} onSend={sendMessage} />
        </main>

        {/* Side Pane: Diffs & Context */}
        {sideOpen && (
          <SidePane
            width={sideWidth}
            onWidthChange={setSideWidth}
            diff={
              <DiffPanel
                diff={diff}
                onAccept={() => sessionId && api.acceptDiff(sessionId).then(() => setDiff(null))}
                onReject={() => sessionId && api.rejectDiff(sessionId).then(() => setDiff(null))}
              />
            }
            context={<FileTree context={context} />}
          />
        )}
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
