import * as vscode from "vscode";
import { ApiClient } from "../services/ApiClient";
import { SessionManager } from "../services/SessionManager";

export class InlineProvider implements vscode.InlineCompletionItemProvider {
  private lastTrigger: number = 0;
  private DEBOUNCE_MS = 800;

  constructor(private api: ApiClient, private sessionManager: SessionManager) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext
  ): Promise<vscode.InlineCompletionList | null> {
    const now = Date.now();
    if (now - this.lastTrigger < this.DEBOUNCE_MS) return null;
    this.lastTrigger = now;

    if (context.triggerKind !== vscode.InlineCompletionTriggerKind.Automatic) return null;

    const sessionId = this.sessionManager.currentSessionId;
    if (!sessionId) return null;

    const textUpToCursor = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

    const currentLine = document.lineAt(position.line).text.trim();
    const shouldTrigger =
      currentLine.startsWith("def") ||
      currentLine.startsWith("function") ||
      currentLine.startsWith("//") ||
      currentLine.startsWith("#");

    if (!shouldTrigger) return null;

    try {
      const state = await this.api.getSessionState(sessionId);
      if (!state?.review_notes) return null;

      const suggestion = `\n    // TODO (copilot): ${state.review_notes.split("\n")[0]}`;

      const item = new vscode.InlineCompletionItem(suggestion, new vscode.Range(position, position));
      return new vscode.InlineCompletionList([item]);
    } catch {
      return null;
    }
  }
}
