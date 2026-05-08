import * as vscode from 'vscode';
import * as path from 'path';
import { AnsibleContentProvider, buildTree, makeUri, SCHEME } from './providers/contentProvider';

let provider: AnsibleContentProvider;
const watchers = new Map<string, vscode.FileSystemWatcher>();

export function activate(context: vscode.ExtensionContext): void {
  provider = new AnsibleContentProvider();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider),
    vscode.commands.registerCommand('ansibleVisualiser.showTree', () => showTree()),
    vscode.commands.registerCommand('ansibleVisualiser.refresh', () => refreshActive()),
  );
}

async function showTree(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor — open an Ansible YAML file first.');
    return;
  }

  const filePath = editor.document.uri.fsPath;
  if (!isYamlFile(filePath)) {
    vscode.window.showErrorMessage('Active file is not a YAML file.');
    return;
  }

  if (!isLikelyAnsible(editor.document)) {
    const answer = await vscode.window.showWarningMessage(
      'This file does not appear to be an Ansible playbook or task file. Show tree anyway?',
      'Yes', 'No',
    );
    if (answer !== 'Yes') return;
  }

  await openTree(filePath);
  setupWatcher(filePath);
}

async function openTree(filePath: string): Promise<void> {
  const uri = makeUri(filePath);
  provider.update(uri, buildTree(filePath));

  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
}

function refreshActive(): void {
  for (const editor of vscode.window.visibleTextEditors) {
    const fp = editor.document.uri.fsPath;
    if (isYamlFile(fp)) {
      const uri = makeUri(fp);
      provider.update(uri, buildTree(fp));
      return;
    }
  }
  vscode.window.showInformationMessage('No YAML editor visible to refresh.');
}

function setupWatcher(filePath: string): void {
  if (watchers.has(filePath)) return;

  const config = vscode.workspace.getConfiguration('ansibleVisualiser');
  if (!config.get<boolean>('autoRefresh', true)) return;

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(path.dirname(filePath), path.basename(filePath)),
  );

  watcher.onDidChange(() => {
    const uri = makeUri(filePath);
    provider.update(uri, buildTree(filePath));
  });

  watchers.set(filePath, watcher);
}

function isYamlFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.yml' || ext === '.yaml';
}

function isLikelyAnsible(doc: vscode.TextDocument): boolean {
  const sample = doc.getText(new vscode.Range(0, 0, Math.min(doc.lineCount, 60), 0));
  const ansibleMarkers = [
    'hosts:', 'tasks:', 'roles:', 'handlers:', 'pre_tasks:', 'post_tasks:',
    'become:', 'gather_facts:', 'ansible.builtin.',
    'apt:', 'yum:', 'service:', 'template:', 'copy:', 'file:',
    'command:', 'shell:', 'debug:', 'include_tasks:', 'import_tasks:',
  ];
  return ansibleMarkers.some(m => sample.includes(m));
}

export function deactivate(): void {
  for (const w of watchers.values()) w.dispose();
  watchers.clear();
  provider?.dispose();
}
