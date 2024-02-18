import * as vscode from 'vscode';
import * as server from './server';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: 'file', language: 'forester' },
      {
        async provideCompletionItems(doc, pos, tok, _) {
          // see if we should complete
          // \transclude{, \import{, \export{, [link](
          const tagPattern =
            /(\\transclude{|\\import{|\\export{|\\ref{|\[[^\[]*\]\()$/;
          const text = doc.getText(
            new vscode.Range(new vscode.Position(pos.line, 0), pos)
          );
          if (! tagPattern.test(text)) {
            return [];
          }
          // Get the files
          var root : vscode.Uri;
          if (vscode.workspace.workspaceFolders) {
            if (vscode.workspace.workspaceFolders.length !== 1) {
              vscode.window.showWarningMessage("vscode-forester only supports opening one workspace folder.");
            }
            root = vscode.workspace.workspaceFolders[0].uri;
          } else {
            // Probably opened a single
            root = vscode.Uri.joinPath(doc.uri, '..');
          }
          var results : vscode.CompletionItem[] = [];
          for (const [id, val] of Object.entries(await server.query(root))) {
            let item = new vscode.CompletionItem(
              { label: id , description: (val as any).title },
              vscode.CompletionItemKind.Value
            );
            item.detail = (val as any).taxon ?? "Tree";
            item.documentation = (val as any).title;
            results.push(item);
          }
          return results;
        },
      },
      '{', '('
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() { }
