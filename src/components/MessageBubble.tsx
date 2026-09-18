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
  const isAssistant = message?.role === "assistant";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bubble-user"
            : isSystem
            ? "bubble-system"
            : "bubble-assistant"
        }`}
      >
        {/* node label badge */}
        {message?.node && NODE_LABELS[message.node] && (
          <span className="text-xs font-semibold text-muted-foreground block mb-2">
            {NODE_LABELS[message.node]}
          </span>
        )}

        {/* Content */}
        {typeof message?.content === "string" && message.content.trim() ? (
          isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownContent content={message.content} />
          )
        ) : null}

        {/* Thinking state: replaces the bubble while the agent works with no content yet */}
        {message?.streaming && !message?.content?.trim() && <ThinkingIndicator />}

        {/* Streaming indicator (inline, once content is flowing) */}
        {message?.streaming && !!message?.content?.trim() && (
          <span className="thinking-dots mt-2">
            <span /><span /><span />
          </span>
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

function MarkdownContent({ content }: { content: string }) {
  const hasCode = content.includes("```");
  if (hasCode) {
    return <CodeAware content={content} />;
  }
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />;
}

function CodeAware({ content }: { content: string }) {
  const parts = content.split(/(```[\w]*\n[\s\S]*?```)/g);
  return (
    <div className="space-y-3">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const langMatch = part.match(/^```(\w*)/);
          const lang = langMatch?.[1] || "";
          const code = part.replace(/```[\w]*\n/, "").replace(/```$/, "");
          return (
            <div key={i} className="rounded-lg overflow-hidden border border-border">
              {lang && (
                <div className="bg-[#211a18] text-[#9c8c82] text-xs px-3 py-1.5 border-b border-border flex items-center justify-between">
                  <span>{lang}</span>
                  <span className="text-[10px] opacity-50">Vertico</span>
                </div>
              )}
              <pre className="bg-[#181311] p-3 text-xs overflow-x-auto font-mono leading-relaxed">
                <code dangerouslySetInnerHTML={{ __html: highlightSyntax(code, lang) }} />
              </pre>
            </div>
          );
        }
        return (
          <div
            key={i}
            className="markdown whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(part) }}
          />
        );
      })}
    </div>
  );
}

function renderMarkdown(text: string): string {
  let html = text;
  html = escapeHtml(html);

  html = html.replace(/### (.+)/g, "<h3 class='text-sm font-semibold mb-1 mt-3'>$1</h3>");
  html = html.replace(/## (.+)/g, "<h2 class='text-base font-semibold mb-1 mt-3'>$1</h2>");
  html = html.replace(/# (.+)/g, "<h1 class='text-lg font-bold mb-2 mt-4'>$1</h1>");

  html = html.replace(
    /(\[[^\]]+\])\(([^)]+)\)/g,
    '<a href="$2" class="underline text-primary hover:text-primary/80" target="_blank">$1</a>'
  );

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong class='font-semibold'>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em class='italic'>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code class='code-chip'>$1</code>");

  html = html.replace(
    /^- (.+)/gm,
    "<li class='ml-4 list-disc marker:text-muted-foreground mb-0.5'>$1</li>"
  );
  html = html.replace(/(<li[^>]*>.*?<\/li>(\s*<li[^>]*>.*?<\/li>)*)/gs, "<ul class='space-y-0.5 mb-2'>$1</ul>");

  html = html.replace(/(\d+)\. (.+)/g, "<li class='ml-4 list-decimal marker:text-muted-foreground mb-0.5'>$2</li>");
  html = html.replace(/(<li[^>]*>.*?<\/li>(\s*<li[^>]*>.*?<\/li>)*)/gs, (match, p1) => {
    if (match.includes("list-disc")) return match;
    return `<ol class='space-y-0.5 mb-2'>${p1}</ol>`;
  });

  html = html.replace(/\n\n/g, "</p><p class='mb-2'>");
  html = html.replace(/\n/g, "<br/>");
  html = `<p class='mb-2'>${html}</p>`;

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
      "__init__", "__name__", "__file__", "None",
    ],
    js: [
      "const", "let", "var", "function", "return", "async", "await", "yield",
      "if", "else", "for", "while", "try", "catch", "finally", "throw", "new",
      "this", "class", "extends", "import", "export", "default", "from", "of",
      "in", "typeof", "instanceof", "null", "undefined", "true", "false",
      "console", "Promise", "async", "await", "React", "useState", "useEffect",
    ],
    ts: [
      "const", "let", "var", "function", "return", "async", "await", "yield",
      "if", "else", "for", "while", "try", "catch", "finally", "throw", "new",
      "this", "class", "extends", "import", "export", "default", "from", "of",
      "interface", "type", "enum", "implements", "private", "public", "protected",
      "readonly", "as", "is", "infer", "keyof", "typeof", "extends", "any",
      "unknown", "never", "void", "null", "undefined", "true", "false",
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
    result = result.replace(regex, `<span class="token-keyword" style="color:#7ee787">${escaped}</span>`);
  }

  result = result.replace(
    /"(?:[^"\\]|\\.)*"/g,
    '<span class="token-string" style="color:#a5d6ff">$&</span>'
  );
  result = result.replace(
    /'(?:[^'\\]|\\.)*'/g,
    '<span class="token-string" style="color:#a5d6ff">$&</span>'
  );
  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="token-number" style="color:#79c0ff">$1</span>'
  );
  result = result.replace(
    /(\/\/.*$|#.*$)/gm,
    '<span class="token-comment" style="color:#8b949e">$1</span>'
  );

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}