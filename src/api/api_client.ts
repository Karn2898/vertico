import { ApiClient as ServiceApiClient, SessionState, DiffResult } from "../services/ApiClient";

export class ApiClient extends ServiceApiClient {
  async getSessionState(sessionId: string): Promise<SessionState> {
    return super.getSessionState(sessionId);
  }

  async getDiff(sessionId: string): Promise<DiffResult> {
    return super.getDiff(sessionId);
  }
}
