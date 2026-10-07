import { useRef, useEffect, useCallback, useState } from "react";
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
      <div className="border-t border-border flex-shrink-0">
        <div className="p-3">
          <div className="relative flex items-end bg-[#1b1513] border border-border rounded-lg focus-within:border-[#b8935a] focus-within:shadow-[0_0_0_1.5px_rgba(184,147,90,0.35)] transition-colors">
            <textarea
              ref={inputRef}
              rows={4}
              className="w-full bg-transparent rounded-lg px-3 pt-2.5 pb-8 text-xs leading-relaxed outline-none resize-y min-h-[96px] placeholder:text-[#6b5f58]"
              onKeyDown={handleKeyDown}
              placeholder={streaming ? "Response streaming… (you can keep typing)" : "Ask about your code..."}
            />
            <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1.5">
              <ModelSelector onChange={setModel} disabled={streaming} apiUrl={apiUrl} />
              {streaming ? (
                <button
                  onClick={onCancel}
                  title="Stop generating"
                  className="bg-[#2b2b2b] text-[#f1e4d9] px-2.5 py-1 rounded-md text-[11px] hover:bg-[#3a3a3a] transition-colors flex-shrink-0"
                >
                  ■ Stop
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  className="bg-[#6e2a3a] text-[#f1e4d9] px-2.5 py-1 rounded-md text-[11px] hover:bg-[#7d3244] transition-colors flex-shrink-0"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
