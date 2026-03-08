import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskExecutor } from './task-executor.js';

interface TaskData {
    taskId: string;
    task: string;
    context?: string;
    priority: 'low' | 'normal' | 'high';
    workingDir?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    result?: string;
    error?: string;
}

type BridgeStatus = 'idle' | 'executing' | 'error';

/**
 * Watches ~/antigravity-tasks/pending/ and auto-executes new tasks.
 */
export class TaskWatcher {
    private timer: ReturnType<typeof setInterval> | undefined;
    private processing = false;
    private statusListeners: Array<(status: BridgeStatus) => void> = [];

    private dirs: Record<string, string>;

    constructor(
        private baseDir: string,
        private executor: TaskExecutor,
        private options: { autoExecute: boolean; pollIntervalMs: number }
    ) {
        this.dirs = {
            pending: path.join(baseDir, 'pending'),
            'in-progress': path.join(baseDir, 'in-progress'),
            completed: path.join(baseDir, 'completed'),
            failed: path.join(baseDir, 'failed'),
        };
    }

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => {
            if (this.options.autoExecute && !this.processing) {
                this.processNext().catch(console.error);
            }
        }, this.options.pollIntervalMs);
        console.log(`[bridge-watcher] Started polling every ${this.options.pollIntervalMs}ms`);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        console.log('[bridge-watcher] Stopped');
    }

    onStatusChange(listener: (status: BridgeStatus) => void) {
        this.statusListeners.push(listener);
    }

    private emitStatus(status: BridgeStatus) {
        for (const listener of this.statusListeners) {
            listener(status);
        }
    }

    async processNext(): Promise<void> {
        if (this.processing) return;
        this.processing = true;

        try {
            // Find the highest-priority pending task
            const pendingFiles = await this.listJsonFiles(this.dirs.pending);
            if (pendingFiles.length === 0) {
                this.processing = false;
                return;
            }

            // Read and sort by priority
            const tasks: TaskData[] = [];
            for (const file of pendingFiles) {
                const content = await fs.readFile(file, 'utf-8');
                tasks.push(JSON.parse(content));
            }
            tasks.sort((a, b) => {
                const order = { high: 0, normal: 1, low: 2 };
                return order[a.priority] - order[b.priority];
            });

            const task = tasks[0];
            console.log(`[bridge-watcher] Processing task ${task.taskId}: "${task.task.slice(0, 80)}..."`);

            // Move to in-progress
            await this.moveTask(task, 'pending', 'in-progress');
            this.emitStatus('executing');

            // Execute via Antigravity's language model
            try {
                const result = await this.executor.execute(task.task, task.context);

                // Move to completed
                task.result = result;
                task.status = 'completed';
                task.updatedAt = new Date().toISOString();
                await this.moveTask(task, 'in-progress', 'completed');

                console.log(`[bridge-watcher] Task ${task.taskId} completed`);
                this.emitStatus('idle');
            } catch (err) {
                // Move to failed
                task.error = err instanceof Error ? err.message : String(err);
                task.status = 'failed';
                task.updatedAt = new Date().toISOString();
                await this.moveTask(task, 'in-progress', 'failed');

                console.error(`[bridge-watcher] Task ${task.taskId} failed:`, err);
                this.emitStatus('error');
            }
        } catch (err) {
            console.error('[bridge-watcher] Error processing tasks:', err);
            this.emitStatus('error');
        } finally {
            this.processing = false;
        }
    }

    async getStats(): Promise<{
        pending: number;
        inProgress: number;
        completed: number;
        failed: number;
    }> {
        const count = async (dir: string) => {
            try {
                return (await this.listJsonFiles(dir)).length;
            } catch {
                return 0;
            }
        };
        return {
            pending: await count(this.dirs.pending),
            inProgress: await count(this.dirs['in-progress']),
            completed: await count(this.dirs.completed),
            failed: await count(this.dirs.failed),
        };
    }

    private async listJsonFiles(dir: string): Promise<string[]> {
        try {
            const files = await fs.readdir(dir);
            return files
                .filter((f) => f.endsWith('.json'))
                .map((f) => path.join(dir, f));
        } catch {
            return [];
        }
    }

    private async moveTask(task: TaskData, from: string, to: string) {
        const filename = `${task.taskId}.json`;
        const fromPath = path.join(this.dirs[from], filename);
        const toPath = path.join(this.dirs[to], filename);
        await fs.writeFile(toPath, JSON.stringify(task, null, 2), 'utf-8');
        await fs.unlink(fromPath).catch(() => { });
    }
}
