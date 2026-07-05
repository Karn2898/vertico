import * as vscode from "vscode";
import { ApiClient, Session } from "./ApiClient";

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  public currentSessionId: string | null = null;

  constructor(private api: ApiClient) {}

  async createSession(filename: string, code: string): Promise<Session> {
    const session = await this.api.createSession(filename, code);
    this.sessions.set(session.session_id, session);
    this.currentSessionId = session.session_id;
    return session;
  }

  async runGraph(
    sessionId: string,
    graph: "refactor" | "bugfix" | "review",
    errorMessage?: string
  ): Promise<void> {
    const taskId = sessionId;
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const status = await this.api.getTaskStatus(taskId);
          // accept several possible shapes for completion
          if (
            status === "completed" ||
            status?.state === "COMPLETED" ||
            status?.status === "completed"
          ) {
            clearInterval(interval);
            resolve();
            return;
          }
          if (status?.state === "FAILURE" || status?.status === "failed") {
            clearInterval(interval);
            reject(new Error(status?.result || status?.errors || "task failed"));
            return;
          }
        } catch (err) {
          clearInterval(interval);
          reject(err);
        }
      }, 2000);
    });
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  cleanup(): void {
    this.sessions.clear();
    this.currentSessionId = null;
  }
}
