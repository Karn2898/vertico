import { ApiClient as ServiceApiClient, Session, SessionState, DiffResult } from "../services/ApiClient";
   

export class ApiClient extends ServiceApiClient {
 
  async getSessionState(sessionId: string): Promise<any> {
   
    return { review_notes: null, refactored_code: null } as any;
  }

  async getDiff(sessionId: string): Promise<any> {
    return { has_changes: false, diff: null } as any;
  }

  streamChat(sessionId: string, text: string): any {

    return {
      onmessage: null as any,
      onerror: null as any,
      close() {},
    } as any;
  }
}
