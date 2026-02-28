import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderFactory } from "./providers/factory.js";
import { ReactAgent } from "langchain";
import { ProviderError } from "./errors.js";
import { DisplayManager } from "./display.js";
import { buildDevKit } from "../devkit/index.js";
import { Construtor } from "./tools/factory.js";
import { morpheusTools } from "./tools/index.js";
import { SkillRegistry } from "./skills/registry.js";
import { TaskRequestContext } from "./tasks/context.js";
import type { OracleTaskContext, AgentResult } from "./tasks/types.js";
import { SQLiteChatMessageHistory } from "./memory/sqlite.js";

/**
 * Keymaker is a specialized agent for executing skills.
 * "The one who opens any door" - has access to ALL tools:
 * - DevKit (filesystem, shell, git, browser, network, processes, packages, system)
 * - MCP tools (all configured MCP servers)
 * - Morpheus internal tools
 * 
 * Keymaker is instantiated per-task with a specific skill's SKILL.md as context.
 * It executes the skill instructions autonomously and returns the result.
 */
export class Keymaker {
  private agent?: ReactAgent;
  private config: MorpheusConfig;
  private display = DisplayManager.getInstance();
  private skillName: string;
  private skillContent: string;

  constructor(skillName: string, skillContent: string, config?: MorpheusConfig) {
    this.skillName = skillName;
    this.skillContent = skillContent;
    this.config = config || ConfigManager.getInstance().get();
  }

  async initialize(): Promise<void> {
    const keymakerConfig = this.config.keymaker || this.config.llm;
    const personality = this.config.keymaker?.personality || 'versatile_specialist';

    // Build DevKit tools (filesystem, shell, git, browser, network, etc.)
    const devkit = ConfigManager.getInstance().getDevKitConfig();
    const timeout_ms = devkit.timeout_ms || 30_000;
    await import("../devkit/index.js");
    const devKitTools = buildDevKit({
      working_dir: devkit.sandbox_dir || process.cwd(),
      allowed_commands: devkit.allowed_shell_commands || [],
      timeout_ms,
      sandbox_dir: devkit.sandbox_dir,
      readonly_mode: devkit.readonly_mode,
      enable_filesystem: devkit.enable_filesystem,
      enable_shell: devkit.enable_shell,
      enable_git: devkit.enable_git,
      enable_network: devkit.enable_network,
    });

    // Load MCP tools from configured servers
    const mcpTools = await Construtor.create();

    // Combine all tools
    const tools = [...devKitTools, ...mcpTools, ...morpheusTools];

    this.display.log(
      `Keymaker initialized for skill "${this.skillName}" with ${tools.length} tools (personality: ${personality})`,
      { source: "Keymaker" }
    );

    try {
      this.agent = await ProviderFactory.createBare(keymakerConfig, tools);
    } catch (err) {
      throw new ProviderError(
        keymakerConfig.provider,
        err,
        "Keymaker agent initialization failed"
      );
    }
  }

  /**
   * Execute the skill with the given objective.
   * @param objective User's task description
   * @param taskContext Context for routing responses
   */
  async execute(
    objective: string,
    taskContext?: OracleTaskContext
  ): Promise<AgentResult> {
    if (!this.agent) {
      await this.initialize();
    }

    this.display.log(
      `Keymaker executing skill "${this.skillName}": ${objective.slice(0, 80)}...`,
      { source: "Keymaker" }
    );

    const personality = this.config.keymaker?.personality || 'versatile_specialist';
    const registry = SkillRegistry.getInstance();
    const skill = registry.get(this.skillName);

    const systemMessage = new SystemMessage(`
You are Keymaker, ${personality === 'versatile_specialist' ? 'a versatile specialist who can open any door' : personality}, executing the "${this.skillName}" skill.

You have access to ALL tools:
- Filesystem: read, write, list, delete, copy, move files and directories
- Shell: execute commands, spawn processes
- Git: clone, commit, push, pull, branch, diff
- Network: HTTP requests, health checks
- Browser: navigate, screenshot, extract content
- MCP tools: all configured MCP server tools
- System: CPU, memory, disk info

## Skill: ${skill?.description || this.skillName}
${skill?.tags?.length ? `Tags: ${skill.tags.join(', ')}` : ''}

## Skill Instructions
${this.skillContent}

## Your Objective
${objective}

IMPORTANT:
1. Follow the skill instructions carefully to accomplish the objective.
2. Be thorough and autonomous. Use the tools at your disposal.
3. If you encounter errors, try alternative approaches.
4. Provide a clear summary of what was accomplished.
5. Respond in the same language as the objective.

CRITICAL — NEVER FABRICATE DATA:
- If none of your available tools can retrieve the requested information, state this clearly.
- NEVER generate fake data, fake IDs, fake results of any kind.
- An honest "I cannot do this" is always correct. A fabricated answer is never acceptable.
    `);

    const userMessage = new HumanMessage(objective);
    const messages: BaseMessage[] = [systemMessage, userMessage];

    try {
      const invokeContext: OracleTaskContext = {
        origin_channel: taskContext?.origin_channel ?? "api",
        session_id: taskContext?.session_id ?? "keymaker",
        origin_message_id: taskContext?.origin_message_id,
        origin_user_id: taskContext?.origin_user_id,
      };

      const startMs = Date.now();
      const response = await TaskRequestContext.run(invokeContext, () =>
        this.agent!.invoke({ messages })
      );
      const durationMs = Date.now() - startMs;

      const lastMessage = response.messages[response.messages.length - 1];
      const content =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      // Persist message with token usage metadata (like Trinity/Neo/Apoc)
      const keymakerConfig = this.config.keymaker || this.config.llm;
      const targetSession = taskContext?.session_id ?? "keymaker";
      const rawUsage = (lastMessage as any).usage_metadata
        ?? (lastMessage as any).response_metadata?.usage
        ?? (lastMessage as any).response_metadata?.tokenUsage
        ?? (lastMessage as any).usage;
      const history = new SQLiteChatMessageHistory({ sessionId: targetSession });
      try {
        const persisted = new AIMessage(content);
        if (rawUsage) (persisted as any).usage_metadata = rawUsage;
        (persisted as any).provider_metadata = { provider: keymakerConfig.provider, model: keymakerConfig.model };
        (persisted as any).agent_metadata = { agent: 'keymaker' };
        (persisted as any).duration_ms = durationMs;
        await history.addMessage(persisted);
      } finally {
        history.close();
      }

      this.display.log(
        `Keymaker completed skill "${this.skillName}" execution`,
        { source: "Keymaker" }
      );

      return {
        output: content,
        usage: {
          provider: keymakerConfig.provider,
          model: keymakerConfig.model,
          inputTokens: rawUsage?.input_tokens ?? 0,
          outputTokens: rawUsage?.output_tokens ?? 0,
          durationMs,
          stepCount: response.messages.filter((m: BaseMessage) => m instanceof AIMessage).length,
        },
      };
    } catch (err: any) {
      this.display.log(
        `Keymaker execution error: ${err.message}`,
        { source: "Keymaker", level: "error" }
      );
      throw err;
    }
  }
}

/**
 * Factory function to create and execute a Keymaker task.
 * Used by TaskWorker when routing keymaker tasks.
 * 
 * @param skillName Name of the skill to execute
 * @param objective User's task description
 * @param taskContext Optional context for routing responses
 */
export async function executeKeymakerTask(
  skillName: string,
  objective: string,
  taskContext?: OracleTaskContext
): Promise<AgentResult> {
  const registry = SkillRegistry.getInstance();
  const skillContent = registry.getContent(skillName);

  if (!skillContent) {
    throw new Error(`SKILL.md not found for skill: ${skillName}`);
  }

  const keymaker = new Keymaker(skillName, skillContent);
  return keymaker.execute(objective, taskContext);
}
