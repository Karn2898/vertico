import React, { useEffect, useState } from "react";
import { ChatWindow } from "../../../../src/components/ChatWindow";
import { DiffPanel } from "../../../../src/components/DiffPanel";
import { FileTree } from "../../../../src/components/FileTree";

type Tab = "chat" | "diff" | "context";

declare function acquireVsCodeApi(): {
  postMessage: (message: unknown) => void;
};

const vscode = acquireVsCodeApi();

export default function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<any[]>([]);
  const [diff, setDiff] = useState<any>(null);
  const [context, setContext] = useState<any>(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;

      switch (msg.type) {
        case "streamChunk":
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last?.streaming) {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + (msg.content ?? ""), node: msg.node },
              ];
            }

            return [
              ...prev,
              { role: "assistant", content: msg.content ?? "", streaming: true, node: msg.node },
            ];
          });
          setStreaming(true);
          break;
        case "streamEnd":
          setMessages((prev) =>
            prev.map((message, index) =>
              index === prev.length - 1 ? { ...message, streaming: false } : message
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
          setMessages((prev) => [...prev, { role: "system", content: msg.text }]);
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    vscode.postMessage({ type: "getContext" });

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const sendMessage = (text: string) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    vscode.postMessage({ type: "sendMessage", text });
  };

  return React.createElement(
    "div",
    { className: "flex flex-col h-screen bg-background text-foreground font-sans" },
    React.createElement(
      "div",
      { className: "flex border-b border-border" },
      (["chat", "diff", "context"] as Tab[]).map((value) =>
        React.createElement(
          "button",
          {
            key: value,
            onClick: () => setTab(value),
            className: `px-4 py-2 text-sm font-medium capitalize transition-colors
              ${
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