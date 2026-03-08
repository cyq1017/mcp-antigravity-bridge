# MCP Antigravity Bridge 🦞🚀

> Bridge between [OpenClaw](https://github.com/openclaw/openclaw) and [Antigravity](https://code.visualstudio.com/) — let your OpenClaw agents delegate complex coding tasks to Antigravity.

## Architecture

```
┌─────────────┐     MCP      ┌──────────────────┐    filesystem    ┌─────────────────────┐
│  OpenClaw   │ ──────────→ │  MCP Server      │ ──────────────→ │  VS Code Extension  │
│  (Discord)  │              │                  │  ~/antigravity-  │  (Antigravity)      │
│             │ ←────────── │  send_task        │  tasks/          │                     │
│             │   results    │  get_result       │ ←────────────── │  • file watcher     │
└─────────────┘              │  list_pending     │   completed/     │  • auto-execute     │
                             └──────────────────┘                  │  • write results    │
                                                                   └─────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| [`packages/mcp-server`](./packages/mcp-server) | MCP Server exposing task management tools to OpenClaw |
| [`packages/vscode-extension`](./packages/vscode-extension) | VS Code extension that auto-executes tasks inside Antigravity |

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Configure OpenClaw

Add to `~/.openclaw/openclaw.json`:

```json
{
  "mcpServers": {
    "antigravity-bridge": {
      "command": "node",
      "args": ["/path/to/mcp-antigravity-bridge/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### 4. Install the VS Code Extension

```bash
cd packages/vscode-extension
npm run package
antigravity --install-extension ./antigravity-bridge-0.1.0.vsix
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `send_task` | Submit a coding task for Antigravity to execute |
| `get_result` | Check the status and retrieve results of a task |
| `list_pending` | List all pending tasks in the queue |

## Communication

Tasks are exchanged via a file-system mailbox at `~/antigravity-tasks/`:

```
~/antigravity-tasks/
├── pending/      # New tasks waiting to be picked up
├── in-progress/  # Tasks currently being executed
├── completed/    # Finished tasks with results
└── failed/       # Failed tasks with error details
```

## License

MIT
