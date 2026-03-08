import { FileMailbox } from './transport/file-mailbox.js';
import { createServer } from './server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import path from 'path';
import os from 'os';

const DEFAULT_TASKS_DIR = path.join(os.homedir(), 'antigravity-tasks');

async function main() {
    // Parse CLI args
    const args = process.argv.slice(2);
    let tasksDir = DEFAULT_TASKS_DIR;

    const tasksDirIndex = args.indexOf('--tasks-dir');
    if (tasksDirIndex !== -1 && args[tasksDirIndex + 1]) {
        tasksDir = args[tasksDirIndex + 1];
    }

    // Initialize file mailbox (creates directories if needed)
    const mailbox = new FileMailbox(tasksDir);
    await mailbox.init();

    // Create and start MCP server
    const server = createServer(mailbox);
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error(`[antigravity-bridge] MCP server running, tasks dir: ${tasksDir}`);
}

main().catch((error) => {
    console.error('[antigravity-bridge] Fatal error:', error);
    process.exit(1);
});
