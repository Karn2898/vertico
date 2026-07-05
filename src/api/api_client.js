import { ApiClient as ServiceApiClient } from "../services/ApiClient";

export class ApiClient extends ServiceApiClient {
   
    async getSessionState(sessionId) {
        
        return { review_notes: null, refactored_code: null };
    }
    async getDiff(sessionId) {
        return { has_changes: false, diff: null };
    }
    streamChat(sessionId, text) {
       
        return {
            onmessage: null,
            onerror: null,
            close() { },
        };
    }
}
