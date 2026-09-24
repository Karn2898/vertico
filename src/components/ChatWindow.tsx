import { useRef, useEffect, useCallback } from "react";
import { MessageBubble } from "@src/components/MessageBubble";
import { AgentMessage } from "@src/components/AgentMessage";

interface Props {
  messages: any[];
  streaming: boolean;
  onSend: (text: string) => void;
  onRegenerate?: (messageIndex: number) => void;
  onFeedback?: (messageIndex: number, feedback: "helpful" | "not_helpful") => void;
}

export function ChatWindow({ messages, streaming, onSend, onRegenerate, onFeedback }: Props) {
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
            Open a file and run <strong>Vertico: Refactor</strong> to start.
          </p>
        )}
        {messages.map((msg, i) => {
          const isUser = msg?.role === "user";
          const isSystem = msg?.role === "system";
          if (isUser) {
            return <MessageBubble key={i} message={msg} />;
          }
          if (isSystem) {
            return (
              <div key={i} className="message-row system">
                <div className="bubble-system px-4 py-3 text-sm leading-relaxed max-w-[80%] text-center">
                  {msg.content}
                </div>
              </div>
            );
          }
          return <AgentMessage key={i} message={msg} index={i} messages={messages} streaming={streaming} onRegenerate={onRegenerate} onFeedback={onFeedback} />;
        })}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="p-3 border-t border-border flex gap-2">
        <input
          ref={inputRef}
          className="flex-1 bg-[#1b1513] border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#b8935a] focus:shadow-[0_0_0_1.5px_rgba(184,147,90,0.35)] transition-colors placeholder:text-[#6b5f58]"
          placeholder="Ask about your code..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={streaming}
          className="bg-[#6e2a3a] text-[#f1e4d9] px-4 py-2 rounded-lg text-sm hover:bg-[#7d3244] disabled:opacity-50 transition-colors"
        >
          {streaming ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
