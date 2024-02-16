import * as vscode from 'vscode';

// Trees no longer corresponds to files
// so we need to query forester
export async function getTrees(directory: vscode.Uri) {
  return [];
}

// Quickly scans a file for basic info
// This should be replaced with stuff liks LSP really
