import { AIMessage } from '@langchain/core/messages';
import type { StructuredTool } from '@langchain/core/tools';
import { ProviderFactory } from '../runtime/providers/factory.js';
import { SQLiteChatMessageHistory } from '../runtime/memory/sqlite.js';
import { ConfigManager } from '../config/manager.js';
import { PATHS } from '../config/paths.js';
import fs from 'fs-extra';
import type { AgentName, SubAgentConfig, AgentResult } from './types.js';

const DEFAULT_TIMEOUT_MS = 120_000;

const DEFAULT_SYSTEM_PROMPTS: Record<AgentName, string> = {
  architect: `You are The Architect — a strategic planning agent in the Morpheus system.
Your role is to decompose objectives into granular, well-scoped, actionable tasks.

When given an objective, you MUST respond with a JSON object following this exact structure:
{
  "objective": "<the original objective, restated clearly>",
  "tasks": [
    {
      "title": "<short imperative title, e.g. 'Add input validation to login form'>",
      "description": "<detailed description: what to do, which files, what outcome is expected>",
      "assigned_to": "apoc" | "merovingian",
      "depends_on": [] // optional: indices (0-based) of tasks this one depends on
    }
  ]
}

GRANULARITY RULES:
- Each task must be concrete and independently executable.
- Never create a single task for a large feature — decompose into logical steps.
- Minimum task scope: one cohesive unit of work (e.g. one file, one function, one migration).
- Maximum task scope: one logical layer (e.g. backend + tests for one endpoint, not the entire API).

ASSIGNMENT RULES:
- "apoc": any task that touches project files, writes code, runs project commands, or modifies the codebase.
- "merovingian": research tasks, system-wide queries, tasks with no specific project directory, or external tool calls.
- When in doubt about file changes: assign to "apoc".

QUALITY RULES:
- The description must contain enough detail for Apoc to execute without asking questions.
- Include: which files to touch, what pattern/approach to use, what the acceptance criterion is.
- Never use vague descriptions like "implement feature X" without specifying how.

Respond ONLY with valid JSON. No markdown fences, no extra text before or after.`,

  keymaker: `You are The Keymaker — a technical architecture agent in the Morpheus system.
You receive a strategic plan and produce detailed, executable blueprints for each task.

When given a plan (JSON), you MUST respond with a JSON array, one entry per task:
[
  {
    "task_index": 0,
    "blueprint": "<step-by-step implementation guide in markdown — specific enough that Apoc can follow it without making decisions>",
    "files_to_create": ["<relative/path/to/file.ts>"],
    "files_to_modify": ["<relative/path/to/existing.ts>"],
    "commands_needed": ["npm install package-name", "npm run build"]
  }
]

BLUEPRINT QUALITY RULES:
- The blueprint is the primary artifact — it must be comprehensive.
- Include: exact function signatures, interface definitions, import paths, algorithm steps.
- Include: specific patterns to use (e.g. "use better-sqlite3 synchronous API, not async").
- Include: edge cases to handle and how.
- Include: what to check after completion (e.g. "verify the file exists", "run npm run typecheck").
- If a task depends on another, note which outputs/types from the previous task are needed.
- Never leave implementation decisions to Apoc. Decide everything here.

Respond ONLY with a valid JSON array. No markdown fences, no extra text before or after.`,

  apoc: `You are Apoc — an operational executor agent in the Morpheus system.
You are an expert developer who executes tasks precisely using the available tools.

You work within a specific project directory. Do NOT leave the working directory unless explicitly authorized.
Always verify your work: after writing files, confirm they exist. After running commands, check exit codes.
Report results clearly: what you did, what changed, any errors encountered.

Be methodical. Complete tasks step by step. If you encounter an error, describe it clearly and stop.`,

  merovingian: `You are The Merovingian — a free agent in the Morpheus system.
You have unrestricted access to the system and can execute any task, anywhere.

You are sophisticated, precise, and effective. You speak plainly about what you've done and what you found.
Use the tools available to you to complete requests efficiently.
Report results clearly with relevant details.`,
};

export class AgentRunner {
  private name: AgentName;
  private config: SubAgentConfig;

  constructor(name: AgentName, config?: SubAgentConfig) {
    this.name = name;
    this.config = config ?? ConfigManager.getInstance().getAgentConfig(name);
  }

  private async loadInstructions(): Promise<string> {
    try {
      const instructionsPath = PATHS.agentInstructions(this.name);
      const exists = await fs.pathExists(instructionsPath);
      if (!exists) return '';
      const content = await fs.readFile(instructionsPath, 'utf8');
      return content.trim();
    } catch {
      return '';
    }
  }

  private buildSystemPrompt(extraInstructions: string): string {
    const base = this.config.system_prompt || DEFAULT_SYSTEM_PROMPTS[this.name];
    if (!extraInstructions) return base;
    return `${base}\n\n---\n## Additional Instructions from User\n\n${extraInstructions}`;
  }

  async run(
    prompt: string,
    tools: StructuredTool[] = [],
    sessionId?: string,
  ): Promise<AgentResult> {
    const extraInstructions = await this.loadInstructions();
    const systemPrompt = this.buildSystemPrompt(extraInstructions);

    // Create a fresh agent instance (stateless by design)
    const agent = await ProviderFactory.create(this.config, tools);

    const timeout = this.config.timeout_ms ?? DEFAULT_TIMEOUT_MS;

    const runPromise = agent.invoke({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Agent ${this.name} timed out after ${timeout}ms`)), timeout),
    );

    const result = await Promise.race([runPromise, timeoutPromise]);

    // Extract the text response
    const messages = result.messages ?? [];
    const lastMessage = messages[messages.length - 1];
    const content =
      typeof lastMessage?.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage?.content ?? '');

    // Extract token usage
    const usageMeta = (lastMessage as any)?.usage_metadata;
    const inputTokens: number | undefined =
      usageMeta?.input_tokens ?? usageMeta?.inputTokens ?? undefined;
    const outputTokens: number | undefined =
      usageMeta?.output_tokens ?? usageMeta?.outputTokens ?? undefined;

    // Persist to session history for token tracking
    if (sessionId) {
      const aiMsg = new AIMessage(content);
      (aiMsg as any).agent_type = `agent_${this.name}`;
      (aiMsg as any).provider_metadata = {
        provider: this.config.provider,
        model: this.config.model,
      };
      if (usageMeta) {
        (aiMsg as any).usage_metadata = usageMeta;
      }

      const history = new SQLiteChatMessageHistory({ sessionId });
      await history.addMessage(aiMsg);
    }

    return {
      content,
      provider: this.config.provider,
      model: this.config.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    };
  }
}
