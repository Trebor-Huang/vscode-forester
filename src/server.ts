import * as vscode from 'vscode';
import * as util from 'util';
import * as child_process from 'child_process';

const exec = util.promisify(child_process.exec);

export async function getTrees(directory: vscode.Uri) {
  let { stderr, stdout } = await exec(
    "/Users/trebor/.opam/5.1.0/bin/forester complete trees",
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
    return [];
  }
  // TODO make forester return a more structured format like json
  // Also the title doesn't correctly handle formatted text
  const paths = stdout.split('\n').map(pair => pair.split(', ', 2));
  return paths;
}
