import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  Executable,
  TransportKind
} from 'vscode-languageclient/node';

import {load} from 'js-toml';
import * as util from 'util';
import * as server from './server';
import { readFile } from 'fs/promises';
import { join } from 'path';

// TODO there must be a better system
// Maybe an event pool instead of a promise
var cachedQuery : Promise<server.NewQuery>;
var cancel : vscode.CancellationTokenSource | undefined;
var dirty = true;
var client : LanguageClient;

function getRoot() {
  if (vscode.workspace.workspaceFolders?.length) {
    if (vscode.workspace.workspaceFolders.length !== 1) {
      vscode.window.showWarningMessage("vscode-forester only supports opening one workspace folder.");
    }
    return vscode.workspace.workspaceFolders[0].uri;
  } else {
    // Probably opened a single file
    throw new vscode.FileSystemError("vscode-forester doesn't support opening a single file.");
  }
}

function update() {
  if (! dirty) {
    return;
  }
  if (cancel !== undefined) {
    cancel.cancel();
  }
  cancel = new vscode.CancellationTokenSource();

  dirty = false;
  cachedQuery = Promise.race([
    util.promisify((callback : (...args: any) => void) => {
      // If cancelled, return [] immediately
      cancel?.token.onCancellationRequested((e) => {
        callback(undefined, []);
      });
    })(),
    // The token is also used to cancel the stuff inside
    server.query(getRoot(), cancel.token)
  ]);
}

async function suggest(range: vscode.Range) {
  var results : vscode.CompletionItem[] = [];
  const config = vscode.workspace.getConfiguration('forester');
  const showID = config.get('completion.showID') ?? false;
  for (const entry of (await cachedQuery)) {
    let {uri: id, title, taxon} = entry;
    let item = new vscode.CompletionItem(
      { label: title === null ? `[${id}]` :
          showID ? `[${id}] ${title}` : title ,
        description: taxon ?? "" },
      vscode.CompletionItemKind.Value
    );
    item.range = range;
    item.insertText = id;
    item.filterText = `${id} ${title ?? ""} ${taxon ?? ""}`;
    item.detail = `${taxon ?? "Tree"} [${id}]`;
    item.documentation = title ?? undefined;
    results.push(item);
  }
  return results;
}

export function activate(context: vscode.ExtensionContext) {
  if (vscode.workspace.getConfiguration('forester').get("useLSP")) {

    let e : Executable = {
      command: "/Users/trebor/.opam/default/bin/forester",
      transport: TransportKind.stdio,
      args: ["lsp"],
    };

    let serverOptions: ServerOptions = {
      run: e, debug: e
    };
    let clientOptions: LanguageClientOptions = {
      documentSelector: [{ scheme: "file", language: "forester" }],
      synchronize: {
        fileEvents: vscode.workspace.createFileSystemWatcher("**/.tree"),
      },
    };

    client = new LanguageClient(
      'foresterLanguageClient',
      'Forester Language Client',
      serverOptions,
      clientOptions
    );

    client.start();

  } else {
    // We will complete ourselves

    const watcher = vscode.workspace.createFileSystemWatcher('**/*.tree');
    watcher.onDidCreate(() => { dirty = true; });
    watcher.onDidChange(() => { dirty = true; });
    watcher.onDidDelete(() => { dirty = true; });
    update();

    context.subscriptions.push(watcher,
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
            update();
            let killswitch = tok.onCancellationRequested(() => {
              dirty = true;
              cancel?.cancel();
            });
            let result = await suggest(range);
            killswitch.dispose();
            return result;
          },
          // resolveCompletionItem, we can extend the CompletionItem class to inject more information
        },
        '{', '(', '['
      )
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "forester.new",
      async function (folder ?: vscode.Uri) {
        if (folder === undefined) {
          // Try to get from focused folder
          // https://github.com/Microsoft/vscode/issues/3553

          // "view/title": [
          //   {
          //     "command": "forester.new",
          //     "when": "view == workbench.explorer.fileView",
          //     "group": "navigation"
          //   }
          // ],
          return;
        }
        let root = getRoot();
        // Get prefixes from configuration
        const config = vscode.workspace.getConfiguration('forester');
        let configfile : string | undefined = config.get('config');
        if (! configfile) {
          configfile = "forest.toml";
        }
        const toml = await readFile(join(root.fsPath, configfile), {
          encoding: 'utf-8'
        });
        let obj : {forest ?: {prefixes ?: string[]}} = load(toml);
        let prefixes: string[] | undefined = obj?.forest?.prefixes;
        // Ask about prefix and template in a quick pick
        // https://code.visualstudio.com/api/references/vscode-api#window.showQuickPick
        var prefix: string | undefined = undefined;
        // allow the option to just use a new prefix
        if (prefixes) {
          prefix = await vscode.window.showQuickPick(
            prefixes,
            {
              canPickMany: false,
              placeHolder: "Choose prefix or Escape to use new one"
            }
          );
        }
        if (prefix === undefined) {
          prefix = await vscode.window.showInputBox(
            {
              placeHolder: "Enter a prefix or Escape to cancel"
            }
          );
        }
        if (prefix === undefined) {
          return;  // Cancelled
        }

        let templates = (await vscode.workspace.fs.readDirectory(
          vscode.Uri.joinPath(root, 'templates')
        ))
        .filter(([n, f]) => f === vscode.FileType.File && n.endsWith(".tree"))
        .map(([n, f]) => n.slice(0, -5));
        var template: string | undefined = undefined;
        templates.push("(No template)");
        if (templates) {
          template = await vscode.window.showQuickPick(
            templates,
            {
              canPickMany: false,
              placeHolder: "Choose a template"
            }
          );
        }
        if (template === undefined) {
          return;
        } else if (template === "(No template)") {
          template = undefined;
        }

        const random : boolean = vscode.workspace
          .getConfiguration('forester')
          .get('create.random') ?? false;
        let result = (await server.command(root, ["new",
          "--dest", folder.fsPath,
          "--prefix", prefix,
          ...(template ? [`--template=${template}`] : []),
          ...(random ? ["--random"] : [])
        ]))?.trim();
        if (result) {
          await vscode.window.showTextDocument(
            await vscode.workspace.openTextDocument(result)
          );
        }
      }
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() {
  if (client) {
    return client.stop();
  }
}
