import { useRef, useEffect, useState } from "react";

interface Props { message: any }

export function MessageBubble({ message }: Props) {
  const isUser = message?.role === "user";
  const isSystem = message?.role === "system";
  const [isVisible, setIsVisible] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  if (!isUser) {
    return null; // Agent messages handled by AgentMessage component
  }

  return (
    <div
      ref={contentRef}
      className={`message-row user ${isVisible ? "visible" : ""}`}
    >
      <div className="bubble-user px-4 py-3 text-sm leading-relaxed max-w-[70%]">
        {typeof message?.content === "string" && message.content.trim() ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : null}
        {message?.streaming && !message?.content?.trim() && <ThinkingIndicator />}
        {message?.streaming && !!message?.content?.trim() && (
          <span className="thinking-dots mt-2"><span /><span /><span /></span>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="thinking" aria-label="Vertico is thinking">
      <span className="thinking-dots">
        <span /><span /><span />
      </span>
    </div>
  );
}