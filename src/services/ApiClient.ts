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
  constructor(private baseUrl: string) {}

  async createSession(filename: string, code: string): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, code }),
    });
    if (!res.ok) throw new Error(`createSession failed: ${res.statusText}`);
    return (await res.json()) as Session;
  }

  async getTaskStatus(taskId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/tasks/${taskId}`);
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

  streamChat(sessionId: string, text: string): any {
    // In a real environment this would open an EventSource or websocket.
    // Return a minimal EventSource-like object for runtime usage in the extension.
    const es: any = {
      onmessage: null,
      onerror: null,
      close() {},
    };
    // Attempt a simple fetch-stream or server-sent events in production.
    return es;
  }
}
