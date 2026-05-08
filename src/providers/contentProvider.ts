import * as vscode from 'vscode';
import * as fs from 'fs';
import { parseAnsibleFile } from '../parser/parser';
import { render, RendererOptions } from '../renderer/renderer';

export const SCHEME = 'ansible-ascii';

export class AnsibleContentProvider implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;
  private readonly cache = new Map<string, string>();

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.cache.get(uri.toString()) ?? '(loading…)';
  }

  update(uri: vscode.Uri, content: string): void {
    this.cache.set(uri.toString(), content);
    this._onDidChange.fire(uri);
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}

export function buildTree(filePath: string): string {
  const config = vscode.workspace.getConfiguration('ansibleVisualiser');
  const options: RendererOptions = {
    showSummary: config.get<boolean>('showSummary', true),
  };

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    return `Error reading file: ${e}`;
  }

  try {
    const ast = parseAnsibleFile(content);
    return render(ast, options);
  } catch (e) {
    return `Error parsing file: ${e}`;
  }
}

export function makeUri(filePath: string): vscode.Uri {
  const encoded = Buffer.from(filePath).toString('base64url');
  return vscode.Uri.parse(`${SCHEME}://tree/${encoded}`);
}
