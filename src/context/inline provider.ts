import * as vscode from "vscode";
import { ApiClient } from "../services/ApiClient";
import { SessionManager } from "../services/SessionManager";

export class InlineProvider implements vscode.InlineCompletionItemProvider{
    private lastTrigger :number =0 ;
    private DEBOUNCE_MS=800;

    constructor(
        private api: ApiClient,
        private sessionManager :SessionManager
    )

    async provideInlineCompletionItems(
        document : vscode.TextDocument ,
        position:vscode.position,
        context:vscode.InlineCompletionList
    ):

    const now =Date.now();
    if (now - this .lastTrigger < this.DEBOUNCE_MS) return null ;
    this.lastTrigger =now;

    if (context.triggerKind !== vscode.InlineCompletionTriggerKind.Automatic) return null;

    const sessionId= this.sessionManager.currentSessionId;
    if(!sessionId) retirn null;

    const textUpTOCursor =document.getText(
        new vscode.Range (new vscode.position(0,0),position)

    );

    const currentLine=document.lineAt(position.line).text.trim();
    const shouldTrigger=
    currentLine.startswith("def")
    currentLine.startswith("function")
    currentLine.startswith("//")
    currentLine.startswith("#")

    if (!shouldTrigger) return null;

    try{
        const state=await this.api.getSessionState(sessionId);
        if (!state.review_notes) return null;

    tr{
        const state=await this.api.getSessionState(sessionId);
        if (!state..review_notes) return null;

        const suggestion=`\n    # TODO (copilot): ${state.review_notes.split("\n")[0]}`;

        return {
            items:[
                new vscode.InlineCom[;etionItem(
                    suggestion,
                    new vscode.Range(position , position)
                ),
            ],

            
        };
    } catch{
        return null;
    }
  }
    
}