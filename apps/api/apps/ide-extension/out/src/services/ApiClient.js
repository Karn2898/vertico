"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
class ApiClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.patchSessions = new Map();
        this.baseUrl = baseUrl.replace(/\/+$/, "");
        if (this.baseUrl.endsWith("/api")) {
            this.baseUrl = this.baseUrl.slice(0, -4);
        }
    }
    async checkHealth() {
        const res = await fetch(`${this.baseUrl}/health`);
        if (!res.ok)
            throw new Error(`health check failed: ${res.statusText}`);
    }
    async createSession(filename, code, workspaceRoot) {
        const res = await fetch(`${this.baseUrl}/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, code, workspace_root: workspaceRoot }),
        });
        if (!res.ok)
            throw new Error(`createSession failed: ${res.statusText}`);
        return (await res.json());
    }
    async runAgent(sessionId, graph, error_message) {
        const res = await fetch(`${this.baseUrl}/agent/run/${sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ graph, error_message }),
        });
        if (!res.ok)
            throw new Error(`runAgent failed: ${res.statusText}`);
        return (await res.json());
    }
    async getTaskStatus(taskId) {
        const res = await fetch(`${this.baseUrl}/agent/tasks/${taskId}`);
        if (!res.ok)
            throw new Error(`getTaskStatus failed: ${res.statusText}`);
        return await res.json();
    }
    async indexRepo(workspaceRoot) {
        const res = await fetch(`${this.baseUrl}/index`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: workspaceRoot }),
        });
        if (!res.ok)
            throw new Error(`indexRepo failed: ${res.statusText}`);
    }
    async acceptDiff(sessionId) {
        const patchId = await this.ensurePatchSession(sessionId);
        const res = await fetch(`${this.baseUrl}/patches/${patchId}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approved: true }),
        });
        if (!res.ok)
            throw new Error(`acceptDiff failed: ${res.statusText}`);
    }
    async rejectDiff(sessionId) {
        const patchId = await this.ensurePatchSession(sessionId);
        const res = await fetch(`${this.baseUrl}/patches/${patchId}/reject`, { method: "POST" });
        if (!res.ok)
            throw new Error(`rejectDiff failed: ${res.statusText}`);
    }
    async preparePatch(sessionId, useGitStash = false) {
        const res = await fetch(`${this.baseUrl}/patches/from-session/${sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ use_git_stash: useGitStash }),
        });
        if (!res.ok)
            throw new Error(`preparePatch failed: ${res.statusText}`);
        const patch = (await res.json());
        this.patchSessions.set(sessionId, patch.session_id);
        return patch;
    }
    async ensurePatchSession(sessionId) {
        const existing = this.patchSessions.get(sessionId);
        if (existing)
            return existing;
        const patch = await this.preparePatch(sessionId);
        return patch.session_id;
    }
    // Additional helpers used by other parts of the extension (lightweight stubs)
    async getSessionState(sessionId) {
        const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/state`);
        if (!res.ok)
            return {};
        return await res.json();
    }
    async getDiff(sessionId) {
        const res = await fetch(`${this.baseUrl}/diffs/${sessionId}`);
        if (!res.ok)
            return { has_changes: false, diff: null };
        return await res.json();
    }
    streamChat(sessionId, text, handlers) {
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
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    const events = buffer.split("\n\n");
                    buffer = events.pop() ?? "";
                    for (const evt of events) {
                        const line = evt.trim();
                        if (!line.startsWith("data:"))
                            continue;
                        const payload = line.slice(5).trim();
                        if (!payload)
                            continue;
                        try {
                            handlers.onMessage(JSON.parse(payload));
                        }
                        catch {
                            /* ignore malformed */
                        }
                    }
                }
            }
            catch {
                handlers.onError?.();
            }
        })();
        return () => controller.abort();
    }
}
exports.ApiClient = ApiClient;
