import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export function findGitRoot(startPath: string): string | undefined {
  let current = startPath;
  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

export interface EditorContext {
  filename: string;
  language: string;
  fullcode: string;
  selectedcode: string | null;
  cursorLine: number;
  repoRoot: string;
  fileTree: string[];
  diagnostics: string[];
}

export class ContextCollector {
  collect(): EditorContext | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return null;

    const doc = editor.document;
    const selection = editor.selection;
    const activeUri = doc.uri;
    const fileDir = activeUri ? path.dirname(activeUri.fsPath) : "";
    const repoRoot = findGitRoot(fileDir)
      ?? (activeUri
        ? vscode.workspace.getWorkspaceFolder(activeUri)?.uri.fsPath ?? ""
        : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "");

    const fileTree = vscode.workspace.textDocuments
      .filter((d) => !d.isUntitled && d.uri.scheme === "file")
      .map((d) => (repoRoot ? path.relative(repoRoot, d.uri.fsPath) : d.uri.fsPath))
      .slice(0, 20);

    const diagnostics = vscode.languages
      .getDiagnostics(doc.uri)
      .map((d) =>
        `[${d.severity === vscode.DiagnosticSeverity.Error ? "error" : "warning"}] Line ${
          d.range.start.line + 1
        }: ${d.message}`
      )
      .slice(0, 10);

    return {
      filename: doc.fileName,
      language: doc.languageId,
      fullcode: doc.getText(),
      selectedcode: selection.isEmpty ? null : doc.getText(selection),
      cursorLine: selection.active.line + 1,
      repoRoot,
      fileTree,
      diagnostics,
    };
  }
}
