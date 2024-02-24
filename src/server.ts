import * as vscode from 'vscode';
import * as util from 'util';
import * as child_process from 'child_process';

const exec = util.promisify(child_process.exec);

// See lib/render/Render_json.ml in forester
export interface QueryResult {
  title: string | null,
  taxon: string | null,
  tags: string[],
  route: string,
  metas: Map<string, string>
}

export async function query(directory: vscode.Uri, token: vscode.CancellationToken)
  : Promise<{[key: string]: QueryResult}> {
  // Get some configurations
  const config = vscode.workspace.getConfiguration('forester');
  const cmd : string = config.get('command') ?? "forester query all trees";

  const env = process.env;
  // env.PATH = "";

  // Spawn process
  let forester = child_process.spawn(
    "forester",
    ["query", "all", "trees"],
    {
      cwd: directory.fsPath,
      env,
      detached: false,
      stdio: 'pipe',
      windowsHide: true
    }
  );

  const killswitch = token.onCancellationRequested(
    () => {
      console.log("Forester: killing unfinished query.");
      forester.kill();
    }
  );

  var stderr = '', stdout = '';
  forester.stderr.on('data', chunk => {
    stderr += chunk;
  });
  forester.stdout.on('data', chunk => {
    stdout += chunk;
  });

  let [code, signal] = await util.promisify((callback) => {
    forester.on('close', (code, signal) => {
      console.log(`Forester: process exited with code ${code} and signal ${signal}.`);
      killswitch.dispose();
      callback(undefined, [code, signal]);
    });
  })() as [number | null, NodeJS.Signals | null];

  if (stderr) {
    vscode.window.showErrorMessage(stderr);
  } else if (signal !== null) {
    // It's killed, probably by ourselves.
    return {};
  } else if (code !== 0) {
    vscode.window.showErrorMessage(`Forester exited with code ${code}.`);
  }

  try {
    return JSON.parse(stdout);
  } catch (e : any) {
    console.log(e);
    if (stderr) {
      // We've already shown an error message.
      return {};
    } else {
      // This is unexpected.
      vscode.window.showErrorMessage("Forester didn't return a valid JSON response.");
      return {};
    }
  }
}
