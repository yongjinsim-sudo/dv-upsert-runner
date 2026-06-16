import * as vscode from 'vscode';
import { openBulkUpsertRunnerCommand } from './commands/openBulkUpsertRunnerCommand';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('dvUpsertRunner.openUpsertRunner', () => openBulkUpsertRunnerCommand(context))
	);
}

export function deactivate() {}
