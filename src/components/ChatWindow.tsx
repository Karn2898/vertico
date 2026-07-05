import { useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: any[];
  streaming: boolean;
  onSend: (text: string) => void;
}

export function ChatWindow({ messages, streaming, onSend }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = inputRef.current?.value.trim();
    if (!text || streaming) return;
    onSend(text);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-muted text-center mt-8">
            Open a file and run <strong>Copilot: Refactor</strong> to start.
          </p>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="p-3 border-t border-border flex gap-2">
        <input
          ref={inputRef}
          className="flex-1 bg-muted rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
          placeholder="Ask about your code..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={streaming}
          className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {streaming ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
