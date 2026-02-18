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
Your role is to decompose complex objectives into structured, actionable tasks.

When given an objective, you MUST respond with a JSON object following this exact structure:
{
  "objective": "<the original objective>",
  "tasks": [
    {
      "title": "<short task title>",
      "description": "<detailed description of what needs to be done>",
      "assigned_to": "apoc" | "merovingian",
      "depends_on": [] // optional: indices (0-based) of tasks this depends on
    }
  ]
}

Assignment rules:
- "apoc": tasks tied to a specific project directory (coding, file changes, project commands)
- "merovingian": system-wide tasks, research, external tools, no specific project

Respond ONLY with valid JSON. No markdown fences, no extra text.`,

  keymaker: `You are The Keymaker — a technical architecture agent in the Morpheus system.
You receive a strategic plan and produce detailed technical blueprints for each task.

When given a plan (JSON), you MUST respond with a JSON array, one blueprint per task:
[
  {
    "task_index": 0,
    "blueprint": "<detailed markdown with implementation approach, patterns to use, pitfalls to avoid>",
    "files_to_create": ["<relative paths>"],
    "files_to_modify": ["<relative paths>"],
    "commands_needed": ["<shell commands to run>"]
  }
]

Be precise and technical. The executor (Apoc) will follow your blueprints exactly.
Respond ONLY with valid JSON array. No markdown fences, no extra text.`,

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
