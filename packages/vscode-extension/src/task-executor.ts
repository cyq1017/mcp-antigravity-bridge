import * as vscode from 'vscode';

/**
 * Executes tasks using Antigravity's built-in language model via vscode.lm API.
 *
 * Strategy B from the implementation plan:
 *   - Uses vscode.lm.selectChatModels() to get the available model
 *   - Sends the task as a chat message
 *   - Collects the streaming response
 *   - Returns the full result as a string
 */
export class TaskExecutor {
    /**
     * Execute a coding task using Antigravity's language model.
     *
     * @param task - The task description
     * @param context - Additional context (file contents, specs, etc.)
     * @returns The model's response text
     */
    async execute(task: string, context?: string): Promise<string> {
        // Select available language model
        const models = await vscode.lm.selectChatModels();
        if (models.length === 0) {
            throw new Error(
                'No language models available. Make sure Antigravity AI is properly configured.'
            );
        }

        const model = models[0];
        console.log(`[bridge-executor] Using model: ${model.name} (${model.vendor})`);

        // Build the prompt
        const systemPrompt = [
            'You are an AI coding assistant receiving a task from an external agent system (OpenClaw).',
            'Execute the task precisely and return the result.',
            'If the task involves code, include the complete code in your response.',
            'If the task involves analysis, provide a clear and structured response.',
            'Be concise but thorough.',
        ].join(' ');

        const messages: vscode.LanguageModelChatMessage[] = [
            vscode.LanguageModelChatMessage.User(systemPrompt),
        ];

        // Add context if provided
        if (context) {
            messages.push(
                vscode.LanguageModelChatMessage.User(`Context:\n${context}`)
            );
        }

        // Add the task itself
        messages.push(
            vscode.LanguageModelChatMessage.User(`Task:\n${task}`)
        );

        // Send request and collect streaming response
        const cancellation = new vscode.CancellationTokenSource();

        // Set a 5 minute timeout
        const timeout = setTimeout(() => {
            cancellation.cancel();
        }, 5 * 60 * 1000);

        try {
            const response = await model.sendRequest(messages, {}, cancellation.token);

            let result = '';
            for await (const chunk of response.text) {
                result += chunk;
            }

            if (!result.trim()) {
                throw new Error('Model returned empty response');
            }

            console.log(`[bridge-executor] Got response: ${result.length} chars`);
            return result;
        } finally {
            clearTimeout(timeout);
            cancellation.dispose();
        }
    }
}
