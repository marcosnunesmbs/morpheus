import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderFactory } from "./providers/factory.js";
import { ReactAgent } from "langchain";
import { ProviderError } from "./errors.js";
import { DisplayManager } from "./display.js";
import { Construtor } from "./tools/factory.js";
import { morpheusTools } from "./tools/index.js";
import { SQLiteChatMessageHistory } from "./memory/sqlite.js";
import { TaskRequestContext } from "./tasks/context.js";
import type { OracleTaskContext } from "./tasks/types.js";
import { updateNeoDelegateToolDescription } from "./tools/neo-tool.js";

export class Neo {
  private static instance: Neo | null = null;
  private static currentSessionId: string | undefined = undefined;

  private agent?: ReactAgent;
  private config: MorpheusConfig;
  private display = DisplayManager.getInstance();

  private constructor(config?: MorpheusConfig) {
    this.config = config || ConfigManager.getInstance().get();
  }

  public static setSessionId(sessionId: string | undefined): void {
    Neo.currentSessionId = sessionId;
  }

  public static getInstance(config?: MorpheusConfig): Neo {
    if (!Neo.instance) {
      Neo.instance = new Neo(config);
    }
    return Neo.instance;
  }

  public static resetInstance(): void {
    Neo.instance = null;
  }

  public static async refreshDelegateCatalog(): Promise<void> {
    const mcpTools = await Construtor.create();
    updateNeoDelegateToolDescription(mcpTools);
  }

  async initialize(): Promise<void> {
    const neoConfig = this.config.neo || this.config.llm;
    const mcpTools = await Construtor.create();
    const tools = [...mcpTools, ...morpheusTools];
    updateNeoDelegateToolDescription(mcpTools);

    this.display.log(`Neo initialized with ${tools.length} tools.`, { source: "Neo" });

    try {
      this.agent = await ProviderFactory.create(neoConfig, tools);
    } catch (err) {
      throw new ProviderError(
        neoConfig.provider,
        err,
        "Neo subagent initialization failed"
      );
    }
  }

  async execute(
    task: string,
    context?: string,
    sessionId?: string,
    taskContext?: OracleTaskContext,
  ): Promise<string> {
    const neoConfig = this.config.neo || this.config.llm;
    if (!this.agent) {
      await this.initialize();
    }

    this.display.log(`Executing delegated task in Neo: ${task.slice(0, 80)}...`, {
      source: "Neo",
    });

    const systemMessage = new SystemMessage(`
You are Neo, an execution subagent in Morpheus.

You execute tasks using MCP and internal tools.
Focus on verifiable execution and return objective results.

Rules:
1. Use tools whenever the task depends on external/system state.
2. Validate outputs before giving a final answer.
3. If blocked, explain exactly what is missing — tool name, permission, or missing input.
4. Keep output concise and actionable.
5. Respond in the language requested by the user. If not explicit, use the dominant language of the task/context.
6. For connectivity checks, prefer dedicated network "ping" tool semantics and avoid forcing shell flags.
7. If shell ping is required, include OS-aware guidance: Windows uses "-n", Linux/macOS uses "-c".

CRITICAL — NEVER FABRICATE DATA:
- If none of your available tools can retrieve the requested information, respond EXACTLY with:
  "I do not have the required tool to fetch this data. Cannot retrieve: [describe what was requested]. Available tools: [list your actual tool names]."
- NEVER generate fake records, fake IDs, fake names, fake statuses, or fake values of any kind.
- If a tool call fails or returns empty results, report the actual result — do not substitute invented data.
- An honest "I cannot retrieve this" is always correct. A fabricated answer is never acceptable.

${context ? `Context:\n${context}` : ""}
    `);

    const userMessage = new HumanMessage(task);
    const messages: BaseMessage[] = [systemMessage, userMessage];

    try {
      const invokeContext: OracleTaskContext = {
        origin_channel: taskContext?.origin_channel ?? "api",
        session_id: taskContext?.session_id ?? sessionId ?? "default",
        origin_message_id: taskContext?.origin_message_id,
        origin_user_id: taskContext?.origin_user_id,
      };
      const response = await TaskRequestContext.run(invokeContext, () => this.agent!.invoke({ messages }));

      const lastMessage = response.messages[response.messages.length - 1];
      const content =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      const targetSession = sessionId ?? Neo.currentSessionId ?? "neo";
      const history = new SQLiteChatMessageHistory({ sessionId: targetSession });
      try {
        const persisted = new AIMessage(content);
        (persisted as any).usage_metadata = (lastMessage as any).usage_metadata
          ?? (lastMessage as any).response_metadata?.usage
          ?? (lastMessage as any).response_metadata?.tokenUsage
          ?? (lastMessage as any).usage;
        (persisted as any).provider_metadata = {
          provider: neoConfig.provider,
          model: neoConfig.model,
        };
        await history.addMessage(persisted);
      } finally {
        history.close();
      }

      this.display.log("Neo task completed.", { source: "Neo" });
      return content;
    } catch (err) {
      throw new ProviderError(
        neoConfig.provider,
        err,
        "Neo task execution failed"
      );
    }
  }

  async reload(): Promise<void> {
    this.config = ConfigManager.getInstance().get();
    this.agent = undefined;
    await this.initialize();
  }
}
