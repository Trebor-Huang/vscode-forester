import * as vscode from 'vscode';
import * as util from 'util';
import * as child_process from 'child_process';

const execFile = util.promisify(child_process.execFile);

// See lib/render/Render_json.ml in forester
export interface OldQueryResult {
  title: string | null,
  taxon: string | null,
  tags: string[],
  route: string,
  metas: Map<string, string>
}

export interface NewQueryResult extends OldQueryResult {
  uri: string
}

type OldQuery = {[key: string]: OldQueryResult};
export type NewQuery = NewQueryResult[];

// TODO remove duplicate code
export async function query(root: vscode.Uri, token: vscode.CancellationToken)
  : Promise<NewQuery> {
  // Get some configurations
  const config = vscode.workspace.getConfiguration('forester');
  const path : string = config.get('path') ?? "forester";
  const configfile : string | undefined = config.get('config');

  // Spawn process
  let forester = child_process.spawn(
    path,
    ["query", "all",
      ...(configfile ? [configfile] : [])],
    {
      cwd: root.fsPath,
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
    return [];
  } else if (code !== 0) {
    vscode.window.showErrorMessage(`Forester exited with code ${code}.`);
  }

  try {
    return toNewQueryFormat(JSON.parse(stdout));
  } catch (e : any) {
    console.log(e);
    if (stderr) {
      // We've already shown an error message.
      return [];
    } else {
      // This is unexpected.
      vscode.window.showErrorMessage("Forester didn't return a valid JSON response.");
      return [];
    }
  }
}

export function toNewQueryFormat(query : OldQuery | NewQuery) : NewQuery {
  if (Array.isArray(query)) {
    return query;
  } else {
    return Object.entries(query).map(([id, entry]) => {
      return {
        uri: id,
        ...entry
      };
    }
    );
  }
}

export async function command(root: vscode.Uri, command: string[]) {
  // Get some configurations
  const config = vscode.workspace.getConfiguration('forester');
  const path : string = config.get('path') ?? "forester";
  const configfile : string | undefined = config.get('config');

  console.log(command);

  try {
    let { stdout, stderr } = await execFile(
      path,
      configfile ? [...command, configfile] : command,
      {
        cwd: root.fsPath,
        windowsHide: true
      }
    );
    if (stderr) {
      vscode.window.showErrorMessage(stderr);
    }
    return stdout;
  } catch (e : any) {
    vscode.window.showErrorMessage(e.toString());
  }
}
