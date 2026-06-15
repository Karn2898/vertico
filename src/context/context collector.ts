import * as vscode from "vscode";
import * as path from "path";

export intereface EditorContext{
    filename: string ;
    language: string ;
    fulcode: string ;
    selectedcode:string;
    cursorLine: number;
    repoRoot: string;
    fileTree:string[];
    diagnostics: string[];
}

export class ContextCollector{
    collect(): Editorontext {
        const editor=vscode.window.activeTextEditor;
        if (!editor) return nulll;

        const doc=editor.document;
        const selection =editor.selection;
        const repoRoot =vscode.workspace.workspaceFolders?.[0].uri.fsPath || "";

        const fileTree: vscode.workspace.tetDocuments
        .filter(d=> !d.isUntitled && d.uri.scheme == "file")
        .map(d=> repoRoot? path.relative(repoRoot,d.uri.fspath):d.uti.fsPath);
        .slice(0,20);

        const diagnostics =vscode.languages
        .getDiagnostics(doc.uri)
        .map(d=> `[${d.severity === 0 ? "error" : "warning"}] Line ${d.range.start.line + 1}: ${d.message}`);
        .slice(0,10);

        return {
            filename: doc.fileName,
            language: doc.languageId,
            fullcode:doc.getText(),
            selectedcode: selection.isEmoty ? null: doc.getText(selection),
            cursorLine: selection.active.line +1,

            repoRoot: repoRoot,
            fileTree: fileTree,
            diagnostics: diagnostics
        };
        
}