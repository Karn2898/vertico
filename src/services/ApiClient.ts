export interface Session {
  session_id: string;
  filename: string;
  status: string;
  iterations: number;
  errors: string | null;
}

export interface SessionState {
  original_code: string;
  refactored_code: string | null;
  review_notes: string | null;
  errors: string | null;
  iterations: number;
  status: string;
}

export interface DiffResult {
  has_changes: boolean;
  diff: {
    unified: string;
    lines_added: number;
    lines_removed: number;
  } | null;
  status: string;
}

export class ApiClient {
  constructor(public baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    if (this.baseUrl.endsWith("/api")) {
      this.baseUrl = this.baseUrl.slice(0, -4);
    }
  }

  async checkHealth(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) throw new Error(`health check failed: ${res.statusText}`);
  }

  async createSession(filename: string, code: string): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, code }),
    });
    if (!res.ok) throw new Error(`createSession failed: ${res.statusText}`);
    return (await res.json()) as Session;
  }

  async runAgent(
    sessionId: string,
    graph: "refactor" | "bugfix" | "review",
    error_message?: string
  ): Promise<{ task_id: string }> {
    const res = await fetch(`${this.baseUrl}/agent/run/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graph, error_message }),
    });
    if (!res.ok) throw new Error(`runAgent failed: ${res.statusText}`);
    return (await res.json()) as { task_id: string };
  }

  async getTaskStatus(taskId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/agent/tasks/${taskId}`);
    if (!res.ok) throw new Error(`getTaskStatus failed: ${res.statusText}`);
    return await res.json();
  }

  async indexRepo(workspaceRoot: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/index`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: workspaceRoot }),
    });
    if (!res.ok) throw new Error(`indexRepo failed: ${res.statusText}`);
  }

  async acceptDiff(sessionId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/accept`, { method: "POST" });
    if (!res.ok) throw new Error(`acceptDiff failed: ${res.statusText}`);
  }

  async rejectDiff(sessionId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/reject`, { method: "POST" });
    if (!res.ok) throw new Error(`rejectDiff failed: ${res.statusText}`);
  }

  // Additional helpers used by other parts of the extension (lightweight stubs)
  async getSessionState(sessionId: string): Promise<SessionState | any> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/state`);
    if (!res.ok) return {} as any;
    return await res.json();
  }

  async getDiff(sessionId: string): Promise<DiffResult | any> {
    const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/diff`);
    if (!res.ok) return { has_changes: false, diff: null } as any;
    return await res.json();
  }

  streamChat(
    sessionId: string,
    text: string,
    handlers: { onMessage: (data: any) => void; onError?: () => void }
  ): () => void {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/chat/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, message: text }),
          signal: controller.signal,
        });
        if (!res.ok) {
          handlers.onError?.();
          return;
        }
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evt of events) {
            const line = evt.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              handlers.onMessage(JSON.parse(payload));
            } catch {
              /* ignore malformed */
            }
          }
        }
      } catch {
        handlers.onError?.();
      }
    })();
    return () => controller.abort();
  }
}
