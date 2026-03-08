import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface TaskData {
    taskId: string;
    task: string;
    context?: string;
    priority: 'low' | 'normal' | 'high';
    workingDir?: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    createdAt: string;
    updatedAt: string;
    result?: string;
    error?: string;
}

/**
 * File-system dead-letter mailbox for task communication.
 *
 * Directory structure:
 *   ~/antigravity-tasks/
 *   ├── pending/      # New tasks (OpenClaw → Antigravity)
 *   ├── in-progress/  # Tasks being worked on
 *   ├── completed/    # Finished tasks with results
 *   └── failed/       # Failed tasks with error info
 */
export class FileMailbox {
    private dirs: Record<string, string>;

    constructor(private baseDir: string) {
        this.dirs = {
            pending: path.join(baseDir, 'pending'),
            'in-progress': path.join(baseDir, 'in-progress'),
            completed: path.join(baseDir, 'completed'),
            failed: path.join(baseDir, 'failed'),
        };
    }

    /** Create all required directories */
    async init(): Promise<void> {
        for (const dir of Object.values(this.dirs)) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    /** Create a new task in pending/ */
    async createTask(input: {
        task: string;
        context?: string;
        priority?: 'low' | 'normal' | 'high';
        workingDir?: string;
    }): Promise<TaskData> {
        const now = new Date().toISOString();
        const taskData: TaskData = {
            taskId: crypto.randomUUID(),
            task: input.task,
            context: input.context,
            priority: input.priority ?? 'normal',
            workingDir: input.workingDir,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
        };

        const filePath = path.join(this.dirs.pending, `${taskData.taskId}.json`);
        await fs.writeFile(filePath, JSON.stringify(taskData, null, 2), 'utf-8');
        return taskData;
    }

    /** Find a task by ID across all directories */
    async getTask(taskId: string): Promise<TaskData | null> {
        const filename = `${taskId}.json`;
        for (const dir of Object.values(this.dirs)) {
            const filePath = path.join(dir, filename);
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(content) as TaskData;
            } catch {
                // Not in this directory, continue
            }
        }
        return null;
    }

    /** List pending tasks, sorted by creation time */
    async listPending(limit: number = 10): Promise<TaskData[]> {
        const tasks: TaskData[] = [];
        try {
            const files = await fs.readdir(this.dirs.pending);
            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                const content = await fs.readFile(
                    path.join(this.dirs.pending, file),
                    'utf-8'
                );
                tasks.push(JSON.parse(content) as TaskData);
            }
        } catch {
            // Directory might not exist yet
        }

        return tasks
            .sort((a, b) => {
                const priorityOrder = { high: 0, normal: 1, low: 2 };
                const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (pDiff !== 0) return pDiff;
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            })
            .slice(0, limit);
    }

    /** Move a task from one status directory to another */
    async moveTask(
        taskId: string,
        from: TaskData['status'],
        to: TaskData['status'],
        update?: Partial<Pick<TaskData, 'result' | 'error'>>
    ): Promise<TaskData | null> {
        const filename = `${taskId}.json`;
        const fromPath = path.join(this.dirs[from], filename);
        const toPath = path.join(this.dirs[to], filename);

        try {
            const content = await fs.readFile(fromPath, 'utf-8');
            const taskData = JSON.parse(content) as TaskData;
            taskData.status = to;
            taskData.updatedAt = new Date().toISOString();

            if (update?.result !== undefined) taskData.result = update.result;
            if (update?.error !== undefined) taskData.error = update.error;

            await fs.writeFile(toPath, JSON.stringify(taskData, null, 2), 'utf-8');
            await fs.unlink(fromPath);

            return taskData;
        } catch {
            return null;
        }
    }
}
