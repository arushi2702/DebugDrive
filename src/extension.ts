import * as vscode from 'vscode';
import { registerDebugDriveCommands } from './ui/commands';

export function activate(context: vscode.ExtensionContext) {
  console.log('Debug Drive is now active.');

  registerDebugDriveCommands(context);

  const helloWorldDisposable = vscode.commands.registerCommand('debug-drive.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from debug-drive!');
  });

  context.subscriptions.push(helloWorldDisposable);
}

export function deactivate() {}
