import { ApiClient as ServiceApiClient } from "../services/ApiClient";
export class ApiClient extends ServiceApiClient {
    async getSessionState(sessionId) {
        return super.getSessionState(sessionId);
    }
    async getDiff(sessionId) {
        return super.getDiff(sessionId);
    }
}
