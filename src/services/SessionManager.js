export class SessionManager {
    constructor(api) {
        this.api = api;
        this.sessions = new Map();
        this.currentSessionId = null;
    }
    async createSession(filename, code) {
        const session = await this.api.createSession(filename, code);
        this.sessions.set(session.session_id, session);
        this.currentSessionId = session.session_id;
        return session;
    }
    async runGraph(sessionId, graph, errorMessage) {
        const taskId = sessionId;
        return new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                try {
                    const status = await this.api.getTaskStatus(taskId);
                    // accept several possible shapes for completion
                    if (status === "completed" ||
                        status?.state === "COMPLETED" ||
                        status?.status === "completed") {
                        clearInterval(interval);
                        resolve();
                        return;
                    }
                    if (status?.state === "FAILURE" || status?.status === "failed") {
                        clearInterval(interval);
                        reject(new Error(status?.result || status?.errors || "task failed"));
                        return;
                    }
                }
                catch (err) {
                    clearInterval(interval);
                    reject(err);
                }
            }, 2000);
        });
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    cleanup() {
        this.sessions.clear();
        this.currentSessionId = null;
    }
}
