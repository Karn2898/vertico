import React, { useState, useEffect } from "react";
import { ChatWindow } from "./components/ChatWindow";
import { DiffPanel } from "./components/DiffPanel";
import { FileTree } from "./components/FileTree";1
  postMessage: console.log
};

export default function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<any[]>([]);
  const [diff, setDiff] = useState<any>(null);
  const [context, setContext] = useState<any>(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    // Listen for messages from extension host
    window.addEventListener("message", (event) => {
      const msg = event.data;
      switch (msg.type) {
        case "streamChunk":
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last?.streaming) {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + (msg.content ?? ""), node: msg.node }
              ];
            }
            return [...prev, { role: "assistant", content: msg.content ?? "", streaming: true, node: msg.node }];
          });
          setStreaming(true);
          break;
        case "streamEnd":
          setMessages(prev =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, streaming: false } : m
            )
          );
          setStreaming(false);
          break;
        case "context":
          setContext(msg.context);
          break;
        case "diffAccepted":
        case "diffRejected":
          setDiff(null);
          setTab("chat");
          break;
        case "error":
          setMessages(prev => [...prev, { role: "system", content: msg.text }]);
          break;
      }
    });

    // Request context on mount
    vscode.postMessage({ type: "getContext" });
  }, []);

  const sendMessage = (text: string) => {
    setMessages(prev => [...prev, { role: "user", content: text }]);
    vscode.postMessage({ type: "sendMessage", text });
  };

  return React.createElement(
    "div",
    { className: "flex flex-col h-screen bg-background text-foreground font-sans" },
    React.createElement(
      "div",
      { className: "flex border-b border-border" },
      (["chat", "diff", "context"] as Tab[]).map((t) =>
        React.createElement(
          "button",
          {
            key: t,
            onClick: () => setTab(t),
            className: `px-4 py-2 text-sm font-medium capitalize transition-colors
              ${tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
              }`,
          },
          t
        )
      )
    ),
    React.createElement(
      "div",
      { className: "flex-1 overflow-hidden" },
      tab === "chat"
        ? React.createElement(ChatWindow, {
            messages,
            streaming,
            onSend: sendMessage,
          })
        : null,
      tab === "diff"
        ? React.createElement(DiffPanel, {
            diff,
            onAccept: () => vscode.postMessage({ type: "acceptDiff" }),
            onReject: () => vscode.postMessage({ type: "rejectDiff" }),
          })
        : null,
      tab === "context" ? React.createElement(FileTree, { context }) : null
    )
  );
}