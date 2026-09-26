import { useRef, useEffect, useCallback } from "react";
import { MessageBubble } from "@src/components/MessageBubble";
import { AgentMessage } from "@src/components/AgentMessage";

interface Props {
  messages: any[];
  streaming: boolean;
  onSend: (text: string) => void;
  onCancel?: () => void;
  onRegenerate?: (messageIndex: number) => void;
  onFeedback?: (messageIndex: number, feedback: "helpful" | "not_helpful") => void;
}

export function ChatWindow({ messages, streaming, onSend, onCancel, onRegenerate, onFeedback }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef<boolean>(true);

  // Auto-scroll only while the user is already at the bottom; manual
  // scrolling (reading earlier messages) is never hijacked.
  useEffect(() => {
    if (stickToBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  const handleSend = useCallback(() => {
    const text = inputRef.current?.value.trim();
    if (!text || streaming) return;
    onSend(text);
    if (inputRef.current) inputRef.current.value = "";
    stickToBottomRef.current = true;
  }, [streaming, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 min-h-0">
        {messages.length === 0 && (
          <p className="text-muted text-center mt-8">
            Open a file and run <strong>Vertico: Refactor</strong> to start.
          </p>
        )}
        {messages.map((msg, i) => {
          const isUser = msg?.role === "user";
          const isSystem = msg?.role === "system";
          if (isUser) {
            return <MessageBubble key={`user-${i}-${msg.content?.slice(0, 20)}`} message={msg} />;
          }
          if (isSystem) {
            return (
              <div key={`system-${i}`} className="message-row system">
                <div className="bubble-system px-4 py-3 text-sm leading-relaxed max-w-[80%] text-center">
                  {msg.content}
                </div>
              </div>
            );
          }
          return <AgentMessage key={`assistant-${i}`} message={msg} index={i} messages={messages} streaming={streaming} onRegenerate={onRegenerate} onFeedback={onFeedback} />;
        })}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="p-3 border-t border-border flex gap-2 flex-shrink-0">
        <input
          ref={inputRef}
          className="flex-1 bg-[#1b1513] border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#b8935a] focus:shadow-[0_0_0_1.5px_rgba(184,147,90,0.35)] transition-colors placeholder:text-[#6b5f58]"
          onKeyDown={handleKeyDown}
          placeholder={streaming ? "Response streaming… (you can keep typing)" : "Ask about your code..."}
        />
        {streaming ? (
          <button
            onClick={onCancel}
            title="Stop generating"
            className="bg-[#2b2b2b] text-[#f1e4d9] px-4 py-2 rounded-lg text-sm hover:bg-[#3a3a3a] transition-colors flex-shrink-0"
          >
            ■ Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            className="bg-[#6e2a3a] text-[#f1e4d9] px-4 py-2 rounded-lg text-sm hover:bg-[#7d3244] transition-colors flex-shrink-0"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
