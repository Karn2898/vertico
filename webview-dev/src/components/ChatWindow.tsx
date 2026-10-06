import { useRef, useEffect, useCallback, useState } from "react";
// Composer: single card with textarea, model selector + send/stop inside it.
import { MessageBubble } from "@src/components/MessageBubble";
import { AgentMessage } from "@src/components/AgentMessage";
import { ModelSelector } from "@src/components/ModelSelector";

interface Props {
  messages: any[];
  streaming: boolean;
  onSend: (text: string, model: string) => void;
  onCancel?: () => void;
  onRegenerate?: (messageIndex: number) => void;
  onFeedback?: (messageIndex: number, feedback: "helpful" | "not_helpful") => void;
  apiUrl: string;
}

export function ChatWindow({ messages, streaming, onSend, onCancel, onRegenerate, onFeedback, apiUrl }: Props) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [model, setModel] = useState("");
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
    onSend(text, model);
    if (inputRef.current) inputRef.current.value = "";
    stickToBottomRef.current = true;
  }, [streaming, onSend, model]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Auto-grow textarea, clamped to the composer height.
  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

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

      {/* composer: textarea + model selector + send/stop, all inside one box */}
      <div className="composer-shell flex-shrink-0 p-3 pt-2">
        <div className="composer">
          <textarea
            ref={inputRef}
            rows={1}
            className="composer-input"
            onKeyDown={handleKeyDown}
            onInput={autoResize}
            placeholder={streaming ? "Response streaming… (you can keep typing)" : "Ask about your code..."}
          />
          <div className="composer-toolbar">
            <ModelSelector onChange={setModel} disabled={streaming} apiUrl={apiUrl} />
            <div className="flex-1" />
            {streaming ? (
              <button
                onClick={onCancel}
                title="Stop generating"
                aria-label="Stop generating"
                className="composer-btn composer-btn-stop"
              >
                <span className="composer-stop-icon" aria-hidden />
                Stop
              </button>
            ) : (
              <button
                onClick={handleSend}
                title="Send (Enter)"
                aria-label="Send message"
                className="composer-btn composer-btn-send"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M2 8l12-6-4.5 6L14 14 2 8z" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round" />
                </svg>
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
