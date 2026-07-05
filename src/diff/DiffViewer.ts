import * as vscode from "vscode";
import { ApiClient } from "../services/ApiClient";
import { SessionManager } from "../session/session_manager";

export class DiffViewer {
  constructor(private api: ApiClient, private sessionManager: SessionManager) {}

  async showDiff(sessionId: string) {
    const diff = await this.api.getDiff(sessionId);
    if (!diff || !diff.has_changes || !diff.diff) {
      vscode.window.showInformationMessage("No changes to show");
      return;
    }

    const originalUrl = vscode.Uri.parse(`untitled:original.py?${Date.now()}`);
    const refactoredUrl = vscode.Uri.parse(`untitled:refactored.py?${Date.now()}`);

    // open diff editor
    await vscode.commands.executeCommand(
      "vscode.diff",
      originalUrl,
      refactoredUrl,
      `copilot: ${diff.diff.lines_added} added, ${diff.diff.lines_removed} removed`
    );
  }

  async accept(sessionId: string) {
    await this.api.acceptDiff(sessionId);
    const state = await this.api.getSessionState(sessionId);

    // Write accepted code back to the actual file
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const fullRange = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length)
      );

      await editor.edit((editBuilder) => {
        editBuilder.replace(fullRange, state.refactored_code);
      });
      await editor.document.save();
    }
  }

  async reject(sessionId: string) {
    await this.api.rejectDiff(sessionId);
    vscode.window.showInformationMessage("Changes rejected, original restored");
  }
}
