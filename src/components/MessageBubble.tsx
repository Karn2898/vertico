interface Props { message: any }

const NODE_LABELS: Record<string, string> = {
  reviewer: "Code Review",
  refactor: "Refactored",
  linter: "Linter",
  done: "Complete",
  error: "Error",
};

export function MessageBubble({ message }: Props) {
  const isUser = message?.role === "user";
  const isSystem = message?.role === "system";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : isSystem
            ? "bg-destructive/10 text-destructive border border-destructive/20"
            : "bg-muted text-foreground"
        }`}
      >
        {/* node label badge */}
        {message?.node && NODE_LABELS[message.node] && (
          <span className="text-xs font-semibold text-muted-foreground block mb-1">
            {NODE_LABELS[message.node]}
          </span>
        )}

        {/* Content — render code blocks */}
        {typeof message?.content === "string" && message.content.includes("```") ? (
          <CodeContent content={message.content} />
        ) : (
          <p className="whitespace-pre-wrap">{message?.content}</p>
        )}

        {/* Streaming indicator */}
        {message?.streaming && (
          <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse ml-1" />
        )}
      </div>
    </div>
  );
}

function CodeContent({ content }: { content: string }) {
  const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g);
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const code = part.replace(/```[\w]*\n/, "").replace(/```$/, "");
          return (
            <pre key={i} className="bg-background rounded p-2 text-xs overflow-x-auto">
              <code>{code}</code>
            </pre>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {part}
          </p>
        );
      })}
    </div>
  );
}