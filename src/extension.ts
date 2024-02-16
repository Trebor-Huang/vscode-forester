import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { scheme: 'file', language: 'forester' },
      {
        async provideCompletionItems(doc, pos, tok, _) {
          // see if we should complete
          // \transclude{, \import{, \export{, [link](
          const tagPattern =
            /(\\transclude{|\\import{|\\export{|\[[^\[]*\]\()$/;
          const text = doc.getText(
            new vscode.Range(new vscode.Position(pos.line, 0), pos)
          );
          if (! tagPattern.test(text)) {
            return [];
          }
          // Get the files as a first approximation to trees
          const files = await vscode.workspace.fs.readDirectory(
            vscode.Uri.joinPath(doc.uri, '..')
          );
          return files
            .filter(([filename, type]) =>
              type === vscode.FileType.File && filename.endsWith(".tree"))
            .map(([filename, _]) => {
                let item = new vscode.CompletionItem(
                  { label: filename.slice(0, -5) },
                  vscode.CompletionItemKind.File);
                // item.documentation = vscode.Uri.joinPath(doc.uri, '..', filename).toString();
                return item;
              }
            );
        },
        // async resolveCompletionItem(item, tok) {
        //   let path = vscode.Uri.parse(item.documentation as string);
        //   item.documentation = undefined;
        //   let content = await vscode.workspace.fs.readFile(path);
        //   item.detail = "detail";  // title
        //   item.documentation = content.slice(0, 50);  // first few lines
        //   return item;
        // }
      },
      '{', '('
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() { }
