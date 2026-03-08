import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { FileMailbox } from './transport/file-mailbox.js';

export function createServer(mailbox: FileMailbox): McpServer {
    const server = new McpServer({
        name: 'antigravity-bridge',
        version: '0.1.0',
    });

    // ── send_task ─────────────────────────────────────────────
    server.tool(
        'send_task',
        'Submit a coding task for Antigravity to execute. Returns a taskId for tracking.',
        {
            task: z.string().describe('The task description — what Antigravity should do'),
            context: z.string().optional().describe('Additional context (file paths, specs, etc.)'),
            priority: z.enum(['low', 'normal', 'high']).default('normal').describe('Task priority'),
            workingDir: z.string().optional().describe('Working directory for the task'),
        },
        async ({ task, context, priority, workingDir }) => {
            const taskData = await mailbox.createTask({ task, context, priority, workingDir });
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: JSON.stringify({
                            taskId: taskData.taskId,
                            status: 'pending',
                            createdAt: taskData.createdAt,
                            message: `Task submitted. Use get_result with taskId "${taskData.taskId}" to check status.`,
                        }, null, 2),
                    },
                ],
            };
        }
    );

    // ── get_result ────────────────────────────────────────────
    server.tool(
        'get_result',
        'Check the status and retrieve results of a previously submitted task.',
        {
            taskId: z.string().describe('The taskId returned by send_task'),
        },
        async ({ taskId }) => {
            const result = await mailbox.getTask(taskId);
            if (!result) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({ error: `Task "${taskId}" not found` }),
                        },
                    ],
                    isError: true,
                };
            }
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
    );

    // ── list_pending ──────────────────────────────────────────
    server.tool(
        'list_pending',
        'List all pending tasks in the queue.',
        {
            limit: z.number().default(10).describe('Maximum number of tasks to return'),
        },
        async ({ limit }) => {
            const tasks = await mailbox.listPending(limit);
            return {
                content: [
                    {
                        type: 'text' as const,
                        text: JSON.stringify({
                            count: tasks.length,
                            tasks,
                        }, null, 2),
                    },
                ],
            };
        }
    );

    return server;
}
