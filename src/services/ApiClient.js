"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClient = void 0;
class ApiClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async createSession(filename, code) {
        const res = await fetch(`${this.baseUrl}/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, code }),
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
        const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/accept`, { method: "POST" });
        if (!res.ok)
            throw new Error(`acceptDiff failed: ${res.statusText}`);
    }
    async rejectDiff(sessionId) {
        const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/reject`, { method: "POST" });
        if (!res.ok)
            throw new Error(`rejectDiff failed: ${res.statusText}`);
    }
    // Additional helpers used by other parts of the extension (lightweight stubs)
    async getSessionState(sessionId) {
        const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/state`);
        if (!res.ok)
            return {};
        return await res.json();
    }
    async getDiff(sessionId) {
        const res = await fetch(`${this.baseUrl}/sessions/${sessionId}/diff`);
        if (!res.ok)
            return { has_changes: false, diff: null };
        return await res.json();
    }
    streamChat(sessionId, text) {
        // In a real environment this would open an EventSource or websocket.
        // Return a minimal EventSource-like object for runtime usage in the extension.
        const es = {
            onmessage: null,
            onerror: null,
            close() { },
        };
        // Attempt a simple fetch-stream or server-sent events in production.
        return es;
    }
}
exports.ApiClient = ApiClient;
