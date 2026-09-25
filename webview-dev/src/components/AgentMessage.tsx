import { useRef, useEffect, useState, useCallback } from "react";

interface AgentMessageProps {
  message: any;
  index: number;
  messages: any[];
  streaming: boolean;
  onRegenerate?: (messageIndex: number) => void;
  onFeedback?: (messageIndex: number, feedback: "helpful" | "not_helpful") => void;
}

const NODE_LABELS: Record<string, string> = {
  reviewer: "Code Review",
  refactor: "Refactored",
  linter: "Linter",
  done: "Complete",
  error: "Error",
};

function isSameTurnAsPrevious(messages: any[], index: number): boolean {
  if (index === 0) return false;
  const prev = messages[index - 1];
  const curr = messages[index];
  return prev?.role === "assistant" && curr?.role === "assistant";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);

  html = html.replace(/### (.+)/g, "<h3 class='agent-h3'>$1</h3>");
  html = html.replace(/## (.+)/g, "<h2 class='agent-h2'>$1</h2>");
  html = html.replace(/# (.+)/g, "<h1 class='agent-h1'>$1</h1>");

  html = html.replace(
    /(\[[^\]]+\])\(([^)]+)\)/g,
    '<a href="$2" class="agent-link" target="_blank" rel="noopener">$1</a>'
  );

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong class='agent-strong'>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em class='agent-em'>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code class='agent-inline-code'>$1</code>");

  html = html.replace(
    /^- (.+)/gm,
    "<li class='agent-li'>$1</li>"
  );
  html = html.replace(/(<li class='agent-li'>.*?<\/li>(\s*<li class='agent-li'>.*?<\/li>)*)/gs, "<ul class='agent-ul'>$1</ul>");

  html = html.replace(/(\d+)\. (.+)/g, "<li class='agent-li agent-li-ordered'>$2</li>");
  html = html.replace(/(<li class='agent-li agent-li-ordered'>.*?<\/li>(\s*<li class='agent-li agent-li-ordered'>.*?<\/li>)*)/gs, "<ol class='agent-ol'>$1</ol>");

  html = html.replace(/\n\n/g, "</p><p class='agent-p'>");
  html = html.replace(/\n/g, "<br/>");
  html = `<p class='agent-p'>${html}</p>`;

  return html;
}

function highlightSyntax(code: string, lang: string): string {
  const keywords: Record<string, string[]> = {
    python: [
      "import", "from", "def", "class", "return", "yield", "async", "await",
      "if", "elif", "else", "for", "while", "try", "except", "finally", "with",
      "in", "is", "not", "and", "or", "True", "False", "None", "self", "pass",
      "raise", "global", "nonlocal", "lambda", "print", "len", "range", "str",
      "int", "float", "list", "dict", "set", "tuple", "bool", "type", "super",
      "__init__", "__name__", "__file__",
    ],
    js: [
      "const", "let", "var", "function", "return", "async", "await", "yield",
      "if", "else", "for", "while", "try", "catch", "finally", "throw", "new",
      "this", "class", "extends", "import", "export", "default", "from", "of",
      "in", "typeof", "instanceof", "null", "undefined", "true", "false",
      "console", "Promise",
    ],
    ts: [
      "const", "let", "var", "function", "return", "async", "await", "yield",
      "if", "else", "for", "while", "try", "catch", "finally", "throw", "new",
      "this", "class", "extends", "import", "export", "default", "from", "of",
      "interface", "type", "enum", "implements", "private", "public", "protected",
      "readonly", "as", "is", "infer", "keyof", "typeof", "extends", "any",
      "unknown", "never", "void",
    ],
    jsx: ["React", "JSX", "return", "className", "style", "key", "props", "children"],
    tsx: ["React", "JSX", "return", "className", "style", "key", "props", "children", "interface", "type"],
    json: [":", ",", "{", "}", "[", "]"],
    bash: ["echo", "cd", "ls", "pwd", "export", "source", "if", "then", "fi", "for", "do", "done", "|", "&&", "||", ">", "<", ">>"],
    sh: ["echo", "cd", "ls", "pwd", "export", "source", "if", "then", "fi", "for", "do", "done", "|", "&&", "||", ">", "<", ">>"],
    markdown: ["#", "##", "###", "-", "*", "**", "```", "---", "[", "](", "|"],
    sql: ["SELECT", "FROM", "WHERE", "AND", "OR", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON", "AS", "ORDER BY", "GROUP BY", "HAVING", "LIMIT", "INSERT", "UPDATE", "DELETE", "CREATE", "TABLE", "DROP", "ALTER", "DISTINCT", "BETWEEN", "LIKE", "IN", "IS", "NOT", "NULL", "UNION"],
    git: ["git", "commit", "push", "pull", "branch", "checkout", "merge", "log", "diff", "status", "add", "reset", "rebase", "stash", "tag"],
    docker: ["docker", "build", "run", "stop", "rm", "compose", "up", "down", "image", "container", "volume", "network", "exec"],
    yaml: [":", "-", "---"],
    text: [],
  };

  const langKeywords = keywords[lang] || keywords.text || [];
  let result = escapeHtml(code);

  for (const keyword of langKeywords) {
    const escaped = escapeHtml(keyword);
    const regex = new RegExp(`\\b${escaped}\\b`, "g");
    result = result.replace(regex, `<span class="token-keyword">${escaped}</span>`);
  }

  result = result.replace(
    /"(?:[^"\\]|\\.)*"/g,
    '<span class="token-string">$&</span>'
  );
  result = result.replace(
    /'(?:[^'\\]|\\.)*'/g,
    '<span class="token-string">$&</span>'
  );
  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="token-number">$1</span>'
  );
  result = result.replace(
    /(\/\/.*$|#.*$)/gm,
    '<span class="token-comment">$1</span>'
  );

  return result;
}

function CodeAware({ content }: { content: string }) {
  const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g);
  return (
    <div className="agent-code-blocks space-y-4">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const langMatch = part.match(/^```(\w*)/);
          const lang = langMatch?.[1] || "";
          const code = part.replace(/```[\w]*\n/, "").replace(/```$/, "");
          return (
            <div key={i} className="agent-code-block rounded-lg overflow-hidden border border-border">
              {lang && (
                <div className="agent-code-header bg-surface border-b border-border px-3 py-1.5 flex items-center justify-between">
                  <span className="text-xs text-muted font-mono">{lang}</span>
                  <CopyCodeButton code={code} />
                </div>
              )}
              <pre className="bg-bg-deep p-4 text-sm overflow-x-auto font-mono leading-relaxed">
                <code dangerouslySetInnerHTML={{ __html: highlightSyntax(code, lang) }} />
              </pre>
            </div>
          );
        }
        return (
          <div
            key={i}
            className="agent-markdown whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(part) }}
          />
        );
      })}
    </div>
  );
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };
  return (
    <button
      onClick={handleCopy}
      className="agent-copy-btn text-[10px] px-2 py-1 rounded text-muted hover:text-foreground hover:bg-white/5 transition-colors"
      title="Copy code"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function ThinkingIndicator() {
  return (
    <div className="agent-thinking" aria-label="Vertico is thinking">
      <span className="agent-thinking-dots">
        <span /><span /><span />
      </span>
      <span className="agent-thinking-text">Thinking…</span>
    </div>
  );
}

function StreamingCursor({ isStreaming }: { isStreaming: boolean }) {
  if (!isStreaming) return null;
  return (
    <span className="agent-streaming-cursor" aria-hidden="true" />
  );
}

export function AgentMessage({ message, index, messages, streaming, onRegenerate, onFeedback }: AgentMessageProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [showActions, setShowActions] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const isSameTurn = isSameTurnAsPrevious(messages, index);
  const isThinking = message?.streaming && !message?.content?.trim();
  const content = message?.content || "";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // fallback
    }
  }, [content]);

  const handleRegenerate = useCallback(() => {
    onRegenerate?.(index);
  }, [index, onRegenerate]);

  const handleFeedback = useCallback((feedback: "helpful" | "not_helpful") => {
    onFeedback?.(index, feedback);
  }, [index, onFeedback]);

  useEffect(() => {
    // Entrance animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  useEffect(() => {
    // Auto-scroll to new messages
    if (isVisible && contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isVisible, message?.content]);

  if (isThinking) {
    return (
      <div
        ref={contentRef}
        className={`agent-message agent-message--thinking ${isVisible ? "visible" : ""}`}
        onMouseEnter={() => setShowActions(false)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="agent-message-inner">
          {!isSameTurn && (
            <div className="agent-header">
              <div className="agent-avatar" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
                  <path d="M10 6C12.2091 6 14 7.79086 14 10C14 12.2091 12.2091 14 10 14C7.79086 14 6 12.2091 6 10C6 7.79086 7.79086 6 10 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M10 14V16M10 16L8 14M10 16L12 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="agent-label">Assistant</span>
            </div>
          )}
          <div className="agent-content">
            <ThinkingIndicator />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={contentRef}
      className={`agent-message ${isVisible ? "visible" : ""} ${showActions ? "hovered" : ""}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="agent-message-inner">
        {!isSameTurn && (
          <div className="agent-header">
            <div className="agent-avatar" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
                <path d="M10 6C12.2091 6 14 7.79086 14 10C14 12.2091 12.2091 14 10 14C7.79086 14 6 12.2091 6 10C6 7.79086 7.79086 6 10 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M10 14V16M10 16L8 14M10 16L12 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="agent-header-text">
              <span className="agent-label">Assistant</span>
              {message?.node && NODE_LABELS[message.node] && (
                <span className="agent-node-badge">{NODE_LABELS[message.node]}</span>
              )}
            </div>
          </div>
        )}

        <div className="agent-content" ref={contentRef}>
          {content.trim() ? (
            content.includes("```") ? (
              <CodeAware content={content} />
            ) : (
              <div className="agent-markdown whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
            )
          ) : null}

          {message?.streaming && content.trim() && <StreamingCursor isStreaming={true} />}
        </div>

        {/* Hover-reveal action row */}
        <div ref={actionsRef} className="agent-actions">
          <button className="agent-action-btn" title="Copy message" onClick={handleCopy}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2H9C10.1046 2 11 2.89543 11 4V10C11 11.1046 10.1046 12 9 12H3C1.89543 12 1 11.1046 1 10V4C1 2.89543 1.89543 2 3 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 2V4M8 2H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M5 7H9M5 10H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <span>Copy</span>
          </button>
          <button className="agent-action-btn" title="Regenerate" disabled={streaming} onClick={handleRegenerate}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1C10.3137 1 13 3.68629 13 7M13 7C13 10.3137 10.3137 13 7 13M1 7C1 3.68629 3.68629 1 7 1M7 1C3.68629 1 1 3.68629 1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M7 1V4M7 1L4.5 3.5M7 1L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <span>Regenerate</span>
          </button>
          <div className="agent-action-divider" />
          <button className="agent-action-btn" title="Helpful" onClick={() => handleFeedback("helpful")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11 4C11 5.10457 10.1046 6 9 6H5C3.89543 6 3 5.10457 3 4C3 2.89543 3.89543 2 5 2H9C10.1046 2 11 2.89543 11 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 10L9.5 12.5L12 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Helpful</span>
          </button>
          <button className="agent-action-btn" title="Not helpful" onClick={() => handleFeedback("not_helpful")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 10C3 8.89543 3.89543 8 5 8H9C10.1046 8 11 8.89543 11 10C11 11.1046 10.1046 12 9 12H5C3.89543 12 3 11.1046 3 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 4L4.5 1.5L2 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span>Not helpful</span>
          </button>
        </div>
      </div>
    </div>
  );
}