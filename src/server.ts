import * as vscode from 'vscode';
import * as util from 'util';
import * as child_process from 'child_process';

const exec = util.promisify(child_process.exec);

// TODO write an interface type
export async function query(directory: vscode.Uri) {
  const config = vscode.workspace.getConfiguration('forester');
  const cmd : string = config.get('command') ?? "forester query all trees";

  let { stderr, stdout } = await exec(cmd,
    {
      cwd: directory.fsPath,
      env: process.env
    }
  ).catch((reason) => {
    vscode.window.showErrorMessage(reason.toString());
    return { stderr: "", stdout: "" };
  });
  if (stderr) {
    vscode.window.showErrorMessage(stderr);
    return {};
  }
  try {
    return JSON.parse(stdout);
  } catch (e : any) {
    console.log(e);
    vscode.window.showErrorMessage("Forester didn't return a valid JSON response.");
  }
}
