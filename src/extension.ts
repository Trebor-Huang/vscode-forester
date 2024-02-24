import * as vscode from 'vscode';
import * as util from 'util';
import * as server from './server';

var cachedQuery : Promise<{[id: string]: server.QueryResult}>;
var cancel : vscode.CancellationTokenSource | undefined;
var dirty = true;

function update() {
  if (! dirty) {
    return;
  }
  if (cancel !== undefined) {
    cancel.cancel();
  }
  cancel = new vscode.CancellationTokenSource();

  var root : vscode.Uri;
  if (vscode.workspace.workspaceFolders?.length) {
    if (vscode.workspace.workspaceFolders.length !== 1) {
      vscode.window.showWarningMessage("vscode-forester only supports opening one workspace folder.");
    }
    root = vscode.workspace.workspaceFolders[0].uri;
  } else {
    // Probably opened a single file
    throw new vscode.FileSystemError("vscode-forester doesn't support opening a single file.");
  }

  dirty = false;
  cachedQuery = Promise.race([
    util.promisify((callback : (...args: any) => void) => {
      // If cancelled, return {} immediately
      cancel?.token.onCancellationRequested((e) => {
        callback(undefined, {});
      });
    })(),
    // The token is also used to cancel the stuff inside
    server.query(root, cancel.token)
  ]);
}

async function suggest(range: vscode.Range) {
  var results : vscode.CompletionItem[] = [];
  for (const [id, val] of Object.entries(await cachedQuery)) {
    let { title, taxon } = val;
    title ??= "Untitled";
    let item = new vscode.CompletionItem(
      { label: title , description: taxon ?? "" },
      vscode.CompletionItemKind.Value
    );
    item.range = range;
    item.insertText = id;
    item.filterText = `${id} ${title} ${taxon ?? ""}`;
    item.detail = `${taxon ?? "Tree"} [${id}]`;
    item.documentation = title;
    results.push(item);
  }
  return results;
}

export function activate(context: vscode.ExtensionContext) {
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.tree');
  watcher.onDidCreate(() => { dirty = true; });
  watcher.onDidChange(() => { dirty = true; });
  watcher.onDidDelete(() => { dirty = true; });
  setInterval(update, 200);

  context.subscriptions.push(
    watcher,
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

          // Get the needed range
          let ix =
            match.indices[1]?.[0] ??
            match.indices[2]?.[0] ??
            match.indices[3]?.[0] ??
            pos.character;
          let range = new vscode.Range(
            new vscode.Position(pos.line, ix),
            pos
          );

          // If we cancel, we kill the process
          context.subscriptions.push(tok.onCancellationRequested(() => {
            dirty = true;
            cancel?.cancel();
          }));
          return await suggest(range);
        },
      },
      '{', '(', '['
    ),
    vscode.commands.registerCommand(
      "forester.new",
      function (folder ?: vscode.Uri) {
        if (folder === undefined) {
          // Try to get from focused folder
        }
        // Ask about prefix and template
      }
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() { }
