import * as vscode from 'vscode';
import * as server from './server';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: 'file', language: 'forester' },
      {
        async provideCompletionItems(doc, pos, tok, _) {
          // see if we should complete
          // \transclude{, \import{, \export{, \ref, [link](, [[link
          // There are three matching groups for the replacing content
          const tagPattern =
            /(?:\\transclude{|\\import{|\\export{|\\ref{)([^}]*)$|\[[^\[]*\]\(([^\)]*)$|\[\[([^\]]*)$/d;
          const text = doc.getText(
            new vscode.Range(new vscode.Position(pos.line, 0), pos)
          );
          let match = tagPattern.exec(text);
          if (match === null || match.indices === undefined) {
            return [];
          }
          let ix =
            match.indices[1]?.[0] ??
            match.indices[2]?.[0] ??
            match.indices[3]?.[0] ??
            pos.character;
          // Get the files
          var root : vscode.Uri;
          if (vscode.workspace.workspaceFolders) {
            if (vscode.workspace.workspaceFolders.length !== 1) {
              vscode.window.showWarningMessage("vscode-forester only supports opening one workspace folder.");
            }
            root = vscode.workspace.workspaceFolders[0].uri;
          } else {
            // Probably opened a single file
            root = vscode.Uri.joinPath(doc.uri, '..');
          }
          let range = new vscode.Range(
            new vscode.Position(pos.line, ix),
            pos
          );
          var results : vscode.CompletionItem[] = [];
          for (const [id, val] of Object.entries(await server.query(root))) {
            let item = new vscode.CompletionItem(
              { label: (val as any).title , description: (val as any).taxon },
              vscode.CompletionItemKind.Value
            );
            item.range = range;
            item.insertText = id;
            item.detail = ((val as any).taxon ?? "Tree") + ` [${id}]`;
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
