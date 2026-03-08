# Antigravity Bridge

VS Code extension that auto-executes coding tasks from OpenClaw via a file-system mailbox.

## Features

- Watches `~/antigravity-tasks/pending/` for new tasks
- Auto-executes tasks using Antigravity's built-in language model
- Writes results back to `~/antigravity-tasks/completed/`
- Status bar indicator showing bridge status

## Commands

- `Antigravity Bridge: Process Next Pending Task` — manually trigger task execution
- `Antigravity Bridge: Show Task Queue Status` — show queue stats
