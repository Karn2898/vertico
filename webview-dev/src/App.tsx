import React, { useEffect, useRef, useState } from "react";
import { ChatWindow } from "@src/components/ChatWindow";
import { DiffPanel } from "@src/components/DiffPanel";
import { FileTree } from "@src/components/FileTree";
import { ApiClient } from "@src/services/ApiClient";

type Tab = "chat" | "diff" | "context";

const API_URL =
  (window as any).__VERTICO_API__ ||
  new URLSearchParams(location.search).get("api") ||
  "http://localhost:8000";

const api = new ApiClient(API_URL);

export default function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<any[]>([]);
  const [diff, setDiff] = useState<any>(null);
  const [context, setContext] = useState<any>(null);
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<string>("connecting…");
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    api
      .getTaskStatus("__ping__")
      .then(() => setApiStatus("connected"))
      .catch(() => setApiStatus("offline (start API on :8000)"));

    // Create a session so chat works out of the box.
    (async () => {
      try {
        const s = await api.createSession("untitled.py", "# paste code and ask Vertico to refactor");
        setSessionId(s.session_id);
      } catch {
        setApiStatus("offline (start API on :8000)");
      }
    })();

    return () => cancelRef.current?.();
  }, []);

  const ensureSession = async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    try {
      const s = await api.createSession("untitled.py", "");
      setSessionId(s.session_id);
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
      },
      onError: () => {
        setStreaming(false);
        setMessages((prev) => [...prev, { role: "system", content: "Stream error." }]);
      },
    });
    // close the streaming token when SSE ends (best-effort)
    setTimeout(() => {
      setStreaming(false);
      setMessages((prev) =>
        prev.map((m, i) => (i === prev.length - 1 ? { ...m, streaming: false } : m))
      );
    }, 4000);
  };

  const openDiff = async () => {
    if (!sessionId) return;
    const d = await api.getDiff(sessionId);
    setDiff(d);
    setTab("diff");
  };

  return React.createElement(
    "div",
    { className: "flex flex-col h-screen bg-background text-foreground font-sans" },
    React.createElement(
      "div",
      { className: "flex items-center justify-between border-b border-border px-4 py-2" },
      React.createElement(
        "div",
        { className: "flex border-b-0" },
        (["chat", "diff", "context"] as Tab[]).map((value) =>
          React.createElement(
            "button",
            {
              key: value,
              onClick: () =>
                value === "diff" ? openDiff() : setTab(value),
              className: `px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === value
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`,
            },
            value
          )
        )
      ),
      React.createElement(
        "span",
        { className: "text-xs text-muted-foreground" },
        `API: ${apiStatus}`
      )
    ),
    React.createElement(
      "div",
      { className: "flex-1 overflow-hidden" },
      tab === "chat"
        ? React.createElement(ChatWindow, { messages, streaming, onSend: sendMessage })
        : null,
      tab === "diff"
        ? React.createElement(DiffPanel, {
            diff,
            onAccept: () => sessionId && api.acceptDiff(sessionId).then(() => setDiff(null)),
            onReject: () => sessionId && api.rejectDiff(sessionId).then(() => setDiff(null)),
          })
        : null,
      tab === "context" ? React.createElement(FileTree, { context }) : null
    )
  );
}
