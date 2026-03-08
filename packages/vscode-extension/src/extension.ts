import * as vscode from 'vscode';
import { TaskWatcher } from './task-watcher.js';
import { TaskExecutor } from './task-executor.js';

let taskWatcher: TaskWatcher | undefined;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('[antigravity-bridge] Extension activating...');

    // Status bar indicator
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = '$(plug) Bridge';
    statusBarItem.tooltip = 'Antigravity Bridge: Watching for tasks';
    statusBarItem.command = 'antigravityBridge.showStatus';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Initialize task watcher + executor
    const config = vscode.workspace.getConfiguration('antigravityBridge');
    const tasksDir = resolveHome(config.get<string>('tasksDir', '~/antigravity-tasks'));
    const autoExecute = config.get<boolean>('autoExecute', true);
    const pollIntervalMs = config.get<number>('pollIntervalMs', 3000);

    const executor = new TaskExecutor();
    taskWatcher = new TaskWatcher(tasksDir, executor, {
        autoExecute,
        pollIntervalMs,
    });
    taskWatcher.start();

    // Update status bar based on watcher state
    taskWatcher.onStatusChange((status) => {
        switch (status) {
            case 'idle':
                statusBarItem.text = '$(plug) Bridge';
                statusBarItem.tooltip = 'Antigravity Bridge: Watching for tasks';
                break;
            case 'executing':
                statusBarItem.text = '$(loading~spin) Bridge';
                statusBarItem.tooltip = 'Antigravity Bridge: Executing task...';
                break;
            case 'error':
                statusBarItem.text = '$(error) Bridge';
                statusBarItem.tooltip = 'Antigravity Bridge: Error occurred';
                break;
        }
    });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('antigravityBridge.processNext', async () => {
            if (taskWatcher) {
                await taskWatcher.processNext();
                vscode.window.showInformationMessage('Processing next pending task...');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('antigravityBridge.showStatus', async () => {
            if (taskWatcher) {
                const stats = await taskWatcher.getStats();
                vscode.window.showInformationMessage(
                    `Bridge: ${stats.pending} pending, ${stats.inProgress} in-progress, ${stats.completed} completed, ${stats.failed} failed`
                );
            }
        })
    );

    console.log(`[antigravity-bridge] Watching ${tasksDir} (auto-execute: ${autoExecute})`);
}

export function deactivate() {
    taskWatcher?.stop();
    console.log('[antigravity-bridge] Extension deactivated');
}

function resolveHome(filepath: string): string {
    if (filepath.startsWith('~/') || filepath === '~') {
        const home = process.env.HOME || process.env.USERPROFILE || '';
        return filepath.replace('~', home);
    }
    return filepath;
}
