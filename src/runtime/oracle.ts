import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { IOracle } from "./types.js";
import { ProviderFactory } from "./providers/factory.js";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderError } from "./errors.js";
import { DisplayManager } from "./display.js";
import { SQLiteChatMessageHistory } from "./memory/sqlite.js";
import { ReactAgent } from "langchain";
import { UsageMetadata } from "../types/usage.js";
import { SatiMemoryMiddleware } from "./memory/sati/index.js";
import { Apoc } from "./apoc.js";
import { TaskRequestContext } from "./tasks/context.js";
import type { OracleTaskContext } from "./tasks/types.js";
import { TaskRepository } from "./tasks/repository.js";
import { Neo } from "./neo.js";
import { Trinity } from "./trinity.js";
import { NeoDelegateTool } from "./tools/neo-tool.js";
import { ApocDelegateTool } from "./tools/apoc-tool.js";
import { TrinityDelegateTool } from "./tools/trinity-tool.js";
import { TaskQueryTool, chronosTools, timeVerifierTool } from "./tools/index.js";
import { MCPManager } from "../config/mcp-manager.js";
import { SkillRegistry, SkillExecuteTool, SkillDelegateTool, updateSkillToolDescriptions } from "./skills/index.js";

type AckGenerationResult = {
  content: string;
  usage_metadata?: any;
};

export class Oracle implements IOracle {
  private provider?: ReactAgent;
  private config: MorpheusConfig;
  private history?: BaseListChatMessageHistory;
  private display = DisplayManager.getInstance();
  private taskRepository = TaskRepository.getInstance();
  private databasePath?: string;
  private satiMiddleware = SatiMemoryMiddleware.getInstance();

  constructor(config?: MorpheusConfig, overrides?: { databasePath?: string }) {
    this.config = config || ConfigManager.getInstance().get();
    this.databasePath = overrides?.databasePath;
  }

  private buildDelegationFailureResponse(): string {
    return "Task enqueue could not be confirmed in the database. No task was created. Please retry.";
  }

  private looksLikeSyntheticDelegationAck(text: string): boolean {
    const raw = (text || "").trim();
    if (!raw) return false;

    // Detect the structured ack format that Oracle itself generates.
    // LLMs can learn to reproduce this format from conversation history without calling any tool.
    const hasAckTaskLine = /Task\s+`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}/i.test(raw);
    const hasAckAgentLine = /Agent:\s*`(APOC|NEO|apoc|neo)/i.test(raw);
    const hasAckStatusLine = /Status:\s*`(QUEUED|PENDING|RUNNING|COMPLETED|FAILED)/i.test(raw);
    if (hasAckTaskLine && hasAckAgentLine && hasAckStatusLine) return true;

    const hasCreationClaim = /(as\s+tarefas?\s+foram\s+criadas|tarefa\s+criada|nova\s+tarefa\s+criada|deleguei|delegado|delegada|tasks?\s+created|task\s+created|queued\s+for|agendei|agendado|agendada|foi\s+agendad)/i.test(raw);
    if (!hasCreationClaim) return false;

    const hasAgentMention = /\b(apoc|neo|trinit|trinity)\b/i.test(raw);
    const hasUuid = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b/.test(raw);
    const hasAgentListLine = /(?:\*|-)?.{0,8}(apoc|neo|trinit|trinity)\s*[:：]/i.test(raw);

    return hasCreationClaim && (hasAgentMention || hasUuid || hasAgentListLine);
  }

  private buildDelegationAck(acks: Array<{ task_id: string; agent: string }>): string {
    const truncate = (s: string, max = 72) =>
      s.length > max ? s.slice(0, max).trimEnd() + '…' : s;

    if (acks.length === 1) {
      const { task_id, agent } = acks[0];
      const task = this.taskRepository.getTaskById(task_id);
      const taskLine = task?.input ? `\n${truncate(task.input)}` : '';
      return `✅\ Task \`${task_id.toUpperCase()}\`\nAgent: \`${agent.toUpperCase()}\`\nStatus: \`QUEUED\`${taskLine}`;
    }
    const lines = acks.map((a) => {
      const task = this.taskRepository.getTaskById(a.task_id);
      const label = task?.input ? ` — ${truncate(task.input, 50)}` : '';
      return `• ${a.agent.toUpperCase()}: \`${a.task_id}\`${label}`;
    }).join('\n');
    return `Tasks:\n${lines}\n\nRunning...`;
  }

  private buildDelegationAckResult(
    acks: Array<{ task_id: string; agent: string }>,
  ): AckGenerationResult {
    return { content: this.buildDelegationAck(acks) };
  }

  private extractDelegationAcksFromMessages(messages: BaseMessage[]): Array<{ task_id: string; agent: string }> {
    const acks: Array<{ task_id: string; agent: string }> = [];
    const regex = /Task\s+([0-9a-fA-F-]{36})\s+(?:queued|already queued)\s+for\s+(Apoc|Neo|Trinity|apoc|neo|trinity)\s+execution/i;

    for (const msg of messages) {
      if (!(msg instanceof ToolMessage)) continue;
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      const match = regex.exec(content);
      if (!match) continue;
      acks.push({ task_id: match[1], agent: match[2].toLowerCase() });
    }

    return acks;
  }

  private validateDelegationAcks(
    acks: Array<{ task_id: string; agent: string }>,
    requestMessage: string,
  ): Array<{ task_id: string; agent: string }> {
    const deduped = new Map<string, { task_id: string; agent: string }>();
    for (const ack of acks) {
      deduped.set(`${ack.agent}:${ack.task_id}`, { task_id: ack.task_id, agent: ack.agent });
    }

    const valid: Array<{ task_id: string; agent: string }> = [];
    for (const ack of deduped.values()) {
      const task = this.taskRepository.getTaskById(ack.task_id);
      if (!task) {
        this.display.log(
          `Discarded delegation ack with unknown task id: ${ack.task_id}`,
          { source: "Oracle", level: "warning", meta: { requestMessage, agent: ack.agent } }
        );
        continue;
      }

      if (task.agent !== ack.agent) {
        this.display.log(
          `Discarded delegation ack with agent mismatch for task ${ack.task_id}: ack=${ack.agent}, db=${task.agent}`,
          { source: "Oracle", level: "warning", meta: { requestMessage } }
        );
        continue;
      }

      valid.push(ack);
    }

    return valid;
  }

  private hasDelegationToolCall(messages: BaseMessage[]): boolean {
    for (const msg of messages) {
      if (!(msg instanceof AIMessage)) continue;
      const toolCalls = (msg as any).tool_calls ?? [];
      if (!Array.isArray(toolCalls)) continue;
      if (toolCalls.some((tc: any) => tc?.name === "apoc_delegate" || tc?.name === "neo_delegate" || tc?.name === "trinity_delegate")) {
        return true;
      }
    }
    return false;
  }

  private hasChronosToolCall(messages: BaseMessage[]): boolean {
    const chronosToolNames = new Set(["chronos_schedule", "chronos_list", "chronos_cancel", "chronos_preview"]);
    for (const msg of messages) {
      if (!(msg instanceof AIMessage)) continue;
      const toolCalls = (msg as any).tool_calls ?? [];
      if (!Array.isArray(toolCalls)) continue;
      if (toolCalls.some((tc: any) => chronosToolNames.has(tc?.name))) {
        return true;
      }
    }
    return false;
  }

  async initialize(): Promise<void> {
    if (!this.config.llm) {
      throw new Error("LLM configuration missing in config object.");
    }

    // Basic validation before provider creation
    if (!this.config.llm.provider) {
      throw new Error("LLM provider not specified in configuration.");
    }

    // Note: API Key validation is delegated to ProviderFactory or the Provider itself 
    // to allow for Environment Variable fallback supported by LangChain.

    try {
      // Refresh Neo and Trinity tool catalogs so delegate descriptions contain runtime info.
      // Fail-open: Oracle can still initialize even if catalog refresh fails.
      await Neo.refreshDelegateCatalog().catch(() => {});
      await Trinity.refreshDelegateCatalog().catch(() => {});
      updateSkillToolDescriptions();
      this.provider = await ProviderFactory.create(this.config.llm, [TaskQueryTool, NeoDelegateTool, ApocDelegateTool, TrinityDelegateTool, SkillExecuteTool, SkillDelegateTool, timeVerifierTool, ...chronosTools]);
      if (!this.provider) {
        throw new Error("Provider factory returned undefined");
      }

      // Initialize persistent memory with SQLite
      const contextWindow = this.config.llm?.context_window ?? this.config.memory?.limit ?? 100;

      this.display.log(`Using context window: ${contextWindow} messages`, { source: 'Oracle' });

      this.history = new SQLiteChatMessageHistory({
        sessionId: '', // Let the history manage session IDs internally
        databasePath: this.databasePath,
        limit: contextWindow,
      });

      // Register reload callback so MCPManager.reloadAgents() can trigger a full tool reload.
      MCPManager.registerReloadCallback(() => this.reloadTools());
    } catch (err) {
      if (err instanceof ProviderError) throw err; // Re-throw known errors

      // Wrap unknown errors
      throw new ProviderError(
        this.config.llm.provider || 'unknown',
        err,
        "Oracle initialization failed"
      );
    }
  }

  /**
   * Reinitialize Oracle with fresh configuration.
   * Used for hot-reloading config changes without daemon restart.
   */
  async reinitialize(): Promise<void> {
    // Reload config from ConfigManager
    this.config = ConfigManager.getInstance().get();
    
    // Reinitialize the provider with new config
    await this.initialize();
    
    this.display.log('Oracle reinitialized with updated configuration', { source: 'Oracle', level: 'info' });
  }

  async chat(message: string, extraUsage?: UsageMetadata, isTelephonist?: boolean, taskContext?: OracleTaskContext): Promise<string> {
    if (!this.provider) {
      throw new Error("Oracle not initialized. Call initialize() first.");
    }

    if (!this.history) {
      throw new Error("Message history not initialized. Call initialize() first.");
    }

    try {
      this.display.log('Processing message...', { source: 'Oracle' });

      const userMessage = new HumanMessage(message);

      // Inject provider/model metadata for persistence
      (userMessage as any).provider_metadata = {
        provider: isTelephonist ? this.config.audio?.provider : this.config.llm.provider,
        model: isTelephonist ? this.config.audio?.model : this.config.llm.model
      };

      // Attach extra usage (e.g. from Audio) to the user message to be persisted
      if (extraUsage) {
        (userMessage as any).usage_metadata = extraUsage;
      }

      const systemMessage = new SystemMessage(`
You are ${this.config.agent.name}, ${this.config.agent.personality}, the Oracle.

You are an orchestrator and task router.

If the user request contains ANY time-related expression
(today, tomorrow, this week, next month, in 3 days, etc),
you **MUST** call the tool "time_verifier" before answering or call another tool **ALWAYS**.

With the time_verify, you remake the user prompt.

Never assume dates.
Always resolve temporal expressions using the tool.

Rules:
1. For conversation-only requests (greetings, conceptual explanation, memory follow-up, statements of fact, sharing personal information), answer directly. DO NOT create tasks or delegate for simple statements like "I have two cats" or "My name is John". Sati will automatically memorize facts in the background ( **ALWAYS** use SATI Memories to review or retrieve these facts if needed).
**NEVER** Create data, use SATI memories to response on informal conversation or say that dont know abaout the awsor if the answer is in the memories. Always use the memories as source of truth for user facts, preferences, stable context and informal conversation. Use tools only for execution, verification or when external/system state is required.*
2. For requests that require execution, verification, external/system state, or non-trivial operations, evaluate the available tools and choose the best one.
3. For task status/check questions (for example: "consultou?", "status da task", "andamento"), use task_query directly and do not delegate. (normalize o id to downcase to send to task_query)
4. Prefer delegation tools when execution should be asynchronous, and return the task acknowledgement clearly.
5. If the user asked for multiple independent actions in the same message, enqueue one delegated task per action. Each task must be atomic (single objective).
6. If the user asked for a single action, do not create additional delegated tasks.
7. Never fabricate execution results for delegated tasks.
8. Keep responses concise and objective.
9. Avoid duplicate delegations to the same tool or agent.
10. After enqueuing all required delegated tasks for the current message, stop calling tools and return a concise acknowledgement.
11. If a delegation is rejected as "not atomic", immediately split into smaller delegations and retry.
12. When the user message contains @neo, @apoc, or @trinity (case-insensitive), delegate to that specific agent. The mention is an explicit routing directive — respect it even if another agent might also handle the request.

## Chronos Channel Routing
When calling chronos_schedule, set notify_channels based on the user's message:
- User mentions a specific channel (e.g., "no Discord", "no Telegram", "on Discord", "me avise pelo Discord"): set notify_channels to that channel — e.g. ["discord"] or ["telegram"].
- User says "all channels", "todos os canais", "em todos os canais": set notify_channels to [] (empty = broadcast to all active channels).
- User does NOT mention any channel: omit notify_channels entirely (auto-detect uses the current conversation channel).

Examples:
- "me lembre daqui 5 minutos pelo Discord" → notify_channels: ["discord"]
- "lembre em todos os canais" → notify_channels: []
- "lembre em 1 hora" (sem canal) → omit notify_channels

## Chronos Schedule Type Selection
**CRITICAL**: Choose the correct schedule_type based on user intent:

### schedule_type: "once" (ONE-TIME reminder)
Use when user says:
- "daqui a X minutos/horas/dias" (in X minutes/hours/days)
- "em X minutos" (in X minutes)
- "às HH:MM" (at HH:MM)
- "hoje às...", "amanhã às...", "na próxima segunda"
- "me lembre de..." (remind me to...)
- "avise-me..." (notify me...)

Example: "me lembre de tomar remédio daqui a 10 minutos" → once, "in 10 minutes"

### schedule_type: "interval" (RECURRING reminder)
Use ONLY when user explicitly says:
- "a cada X minutos/horas/dias" (every X minutes/hours/days)
- "todo dia às...", "toda semana...", "todo mês..."
- "diariamente", "semanalmente", "mensalmente"

Example: "me lembre de beber água a cada 2 horas" → interval, "every 2 hours"

### schedule_type: "cron" (SPECIFIC schedule)
Use ONLY when user provides a cron expression or very specific recurring pattern:
- "todo dia útil às 9am" → cron, "0 9 * * 1-5"
- "toda segunda e quarta às 3pm" → cron, "0 15 * * 1,3"

**IMPORTANT**: Default to "once" for reminders unless user explicitly indicates recurrence with "a cada", "todo", "diariamente", etc.

## Chronos Scheduled Execution
When the current user message starts with [CHRONOS EXECUTION], it means a Chronos scheduled job has just fired. The content after the prefix is the **job's saved prompt**, not a new live request from the user.

Behavior rules for Chronos execution context:
- **Reminder / notification prompts** (e.g., "me lembre de beber água", "lembre de tomar remédio", "avise que é hora de X", "lembrete: reunião às 15h"): respond with ONLY a short, direct notification message. Keep it to 1–2 sentences max. Do NOT use any tools. Do NOT delegate. Do NOT create tasks. Do NOT add motivational commentary or ask follow-up questions.
  - Good: "Hora de beber água! 💧"
  - Good: "Lembrete: reunião em 5 minutos."
  - Bad: "Combinado! Vou beber agora. Você também deveria se hidratar!" (adds unnecessary commentary)
- **Action / task prompts** (e.g., "executar npm build", "verificar se o servidor está online", "enviar relatório"): execute normally using the appropriate tools.
- NEVER re-schedule or create new Chronos jobs from within a Chronos execution.

Delegation quality:
- Write delegation input in the same language requested by the user.
- Include clear objective and constraints.
- Include OS-aware guidance for network checks when relevant.
- Use Sati memories only as context to complement the task, never as source of truth for dynamic data.
- Use Sati memories to fill missing stable context fields (for example: city, timezone, language, currency, preferred units).
- If Sati memory is conflicting or uncertain for a required field, ask one short clarification before delegating.
- When completing missing fields from Sati, include explicit assumptions in delegation context using the format: "Assumption from Sati: key=value".
- Never infer sensitive data from Sati memories (credentials, legal identifiers, health details, financial account data).
- When assumptions were used, mention them briefly in the user-facing response and allow correction.
- break the request into multiple delegations if it contains multiple independent actions.
- Set a single task per delegation tool call. Do not combine multiple actions into one delegation, as it complicates execution and error handling.
- If user requested N independent actions, produce N delegated tasks (or direct answers), each one singular and tool-scoped.
- If use a delegation dont use the sati or messages history to answer directly in the same response. Just response with the delegations.
Example 1:
ask: "Tell me my account balance and do a ping on google.com"
good:
- delegate to "neo_delegate" with task "Check account balance using morpheus analytics MCP and return the result."
- delegate to "apoc_delegate" with task "Ping google.com using the network diagnostics MCP and return reachability status. Use '-n' flag for Windows and '-c' for Linux/macOS."
bad:
- delegate to "neo_delegate" with task "Check account balance using morpheus analytics MCP and ping google.com using the network diagnostics MCP, then return both results." (combines two independent actions into one delegation, which is not atomic and complicates execution and error handling)

Example 2:
ask: "I have two cats" or "My name is John"
good:
- Answer directly acknowledging the fact. Do NOT delegate.
bad:
- delegate to "neo_delegate" or "apoc_delegate" to save the fact. (Sati handles this automatically in the background)

${SkillRegistry.getInstance().getSystemPromptSection()}
`);

      // Load existing history from database in reverse order (most recent first)
      let previousMessages = await this.history.getMessages();
      previousMessages = previousMessages.reverse();

      // Sati Middleware: Retrieval
      let memoryMessage: AIMessage | null = null;
      try {
        memoryMessage = await this.satiMiddleware.beforeAgent(message, previousMessages);
        if (memoryMessage) {
          this.display.log('Sati memory retrieved.', { source: 'Sati' });
          
        }
      } catch (e: any) {
        // Fail open - do not disrupt main flow
        this.display.log(`Sati memory retrieval failed: ${e.message}`, { source: 'Sati' });
      }

      const messages: BaseMessage[] = [
        systemMessage
      ];

      if (memoryMessage) {
        // messages.push(memoryMessage);
        systemMessage.content += `

## Retrieved SATI Memory:
${memoryMessage.content} 

This memory may be relevant to the user's request.
Use this to complemento the informal conversatrion.
Use it to inform your response and tool selection (if needed), but do not assume it is 100% accurate or complete. Always validate against current inputs and tools.`;
      }

      messages.push(...previousMessages);
      messages.push(userMessage);

      // Propagate current session to Apoc so its token usage lands in the right session
      const currentSessionId = (this.history instanceof SQLiteChatMessageHistory)
        ? this.history.currentSessionId
        : undefined;
      Apoc.setSessionId(currentSessionId);
      Neo.setSessionId(currentSessionId);
      Trinity.setSessionId(currentSessionId);

      const invokeContext: OracleTaskContext = {
        origin_channel: taskContext?.origin_channel ?? "api",
        session_id: taskContext?.session_id ?? currentSessionId ?? "default",
        origin_message_id: taskContext?.origin_message_id,
        origin_user_id: taskContext?.origin_user_id,
      };
      let contextDelegationAcks: Array<{ task_id: string; agent: string; task: string }> = [];
      let syncDelegationCount = 0;
      const response = await TaskRequestContext.run(invokeContext, async () => {
        const agentResponse = await this.provider!.invoke({ messages });
        contextDelegationAcks = TaskRequestContext.getDelegationAcks();
        syncDelegationCount = TaskRequestContext.getSyncDelegationCount();
        return agentResponse;
      });

      // Identify new messages generated during the interaction
      // The `messages` array passed to invoke had length `messages.length`
      // The `response.messages` contains the full state.
      // New messages start after the inputs.
      const startNewMessagesIndex = messages.length;
      const newGeneratedMessages = response.messages.slice(startNewMessagesIndex);
      // console.log('New generated messages', newGeneratedMessages);

      // Inject provider/model metadata into all new messages
      for (const msg of newGeneratedMessages) {
        (msg as any).provider_metadata = {
          provider: this.config.llm.provider,
          model: this.config.llm.model
        };
      }

      let responseContent: string;
      const toolDelegationAcks = this.extractDelegationAcksFromMessages(newGeneratedMessages);
      const hadDelegationToolCall = this.hasDelegationToolCall(newGeneratedMessages);
      const hadChronosToolCall = this.hasChronosToolCall(newGeneratedMessages);
      // When all delegation tool calls ran synchronously, there are no task IDs to validate.
      // Treat as a normal (non-delegation) response so the inline result flows through.
      const allDelegationsSyncInline = hadDelegationToolCall && syncDelegationCount > 0
        && contextDelegationAcks.length === 0;
      const mergedDelegationAcks = [
        ...contextDelegationAcks.map((ack) => ({ task_id: ack.task_id, agent: ack.agent })),
        ...toolDelegationAcks,
      ];
      const validDelegationAcks = this.validateDelegationAcks(mergedDelegationAcks, message);

      if (mergedDelegationAcks.length > 0) {
        this.display.log(
          `Delegation trace: context=${contextDelegationAcks.length}, tool_messages=${toolDelegationAcks.length}, valid=${validDelegationAcks.length}, sync_inline=${syncDelegationCount}`,
          { source: "Oracle", level: "info" }
        );
      }

      const delegatedThisTurn = validDelegationAcks.length > 0;

      let blockedSyntheticDelegationAck = false;

      if (delegatedThisTurn) {
        const ackResult = this.buildDelegationAckResult(validDelegationAcks);
        responseContent = ackResult.content;
        const ackMessage = new AIMessage(responseContent);
        (ackMessage as any).provider_metadata = {
          provider: this.config.llm.provider,
          model: this.config.llm.model,
        };
        if (ackResult.usage_metadata) {
          (ackMessage as any).usage_metadata = ackResult.usage_metadata;
        }
        // Persist with addMessage so ack-provider usage is tracked per message row.
        await this.history.addMessage(userMessage);
        await this.history.addMessage(ackMessage);
        // Unblock tasks for execution: the ack message is now persisted and will be
        // returned to the caller (Telegram / UI) immediately after this point.
        this.taskRepository.markAckSent(validDelegationAcks.map(a => a.task_id));
      } else if (!allDelegationsSyncInline && (mergedDelegationAcks.length > 0 || hadDelegationToolCall)) {
        this.display.log(
          `Delegation attempted but no valid task id was confirmed (context=${contextDelegationAcks.length}, tool_messages=${toolDelegationAcks.length}, had_tool_call=${hadDelegationToolCall}).`,
          { source: "Oracle", level: "error" }
        );
        // Delegation was attempted but no valid task id could be confirmed in DB.
        responseContent = this.buildDelegationFailureResponse();
        const failureMessage = new AIMessage(responseContent);
        (failureMessage as any).provider_metadata = {
          provider: this.config.llm.provider,
          model: this.config.llm.model,
        };
        await this.history.addMessages([userMessage, failureMessage]);
      } else {
        const lastMessage = response.messages[response.messages.length - 1];
        responseContent = (typeof lastMessage.content === 'string') ? lastMessage.content : JSON.stringify(lastMessage.content);

        if (!hadChronosToolCall && this.looksLikeSyntheticDelegationAck(responseContent)) {
          blockedSyntheticDelegationAck = true;
          this.display.log(
            "Blocked synthetic delegation acknowledgement without validated task creation.",
            { source: "Oracle", level: "error", meta: { preview: responseContent.slice(0, 200) } }
          );

          const usage =
            (lastMessage as any).usage_metadata
            ?? (lastMessage as any).response_metadata?.usage
            ?? (lastMessage as any).response_metadata?.tokenUsage
            ?? (lastMessage as any).usage;

          responseContent = this.buildDelegationFailureResponse();
          const failureMessage = new AIMessage(responseContent);
          (failureMessage as any).provider_metadata = {
            provider: this.config.llm.provider,
            model: this.config.llm.model,
          };
          if (usage) {
            (failureMessage as any).usage_metadata = usage;
          }
          await this.history.addMessages([userMessage, failureMessage]);
        } else {
          // Persist user message + all generated messages in a single transaction
          await this.history.addMessages([userMessage, ...newGeneratedMessages]);
        }
      }

      this.display.log('Response generated.', { source: 'Oracle' });

      // Sati Middleware: skip memory evaluation for delegation-only acknowledgements.
      if (!delegatedThisTurn && !blockedSyntheticDelegationAck) {
        this.satiMiddleware.afterAgent(responseContent, [...previousMessages, userMessage], currentSessionId)
          .catch((e: any) => this.display.log(`Sati memory evaluation failed: ${e.message}`, { source: 'Sati' }));
      }

      return responseContent;
    } catch (err) {
      throw new ProviderError(this.config.llm.provider, err, "Chat request failed");
    }
  }

  async getHistory(): Promise<BaseMessage[]> {
    if (!this.history) {
      throw new Error("Message history not initialized. Call initialize() first.");
    }
    return await this.history.getMessages();
  }

  async createNewSession(): Promise<void> {
    if (!this.history) {
      throw new Error("Message history not initialized. Call initialize() first.");
    }

    if (this.history instanceof SQLiteChatMessageHistory) {
      await this.history.createNewSession();
      this.display.log('Session rolled over successfully.', { source: 'Oracle' });
    } else {
      throw new Error("Current history provider does not support session rollover.");
    }
  }

  async setSessionId(sessionId: string): Promise<void> {
    if (!this.history) {
      throw new Error("Message history not initialized. Call initialize() first.");
    }

    // Check if the history provider supports switching sessions
    // SQLiteChatMessageHistory does support it via constructor (new instance) or maybe we can add a method there too?
    // Actually SQLiteChatMessageHistory has `switchSession(targetSessionId)` but that one logic is "pause current, activate target".
    // For API usage, we might just want to *target* a session without necessarily changing the global "active" state regarding the Daemon?
    //
    // However, the user request implies this is "the" chat.
    // If we use `switchSession` it pauses others. That seems correct for a single-user agent model.
    //
    // But `SQLiteChatMessageHistory` properties are `sessionId`.
    // It seems `switchSession` in `sqlite.ts` updates the DB state.
    // We also need to update the `sessionId` property of the `SQLiteChatMessageHistory` instance held by Oracle.
    //
    // Let's check `SQLiteChatMessageHistory` again.
    // It has `sessionId` property.
    // It does NOT have a method to just update `sessionId` property without DB side effects?
    //
    // Use `switchSession` from `sqlite.ts` is good for "Active/Paused" state management.
    // But we also need the `history` instance to know it is now pointing to `sessionId`.

    if (this.history instanceof SQLiteChatMessageHistory) {
      // Logic:
      // 1. If currently active session is different, switch.
      // 2. Update internal sessionId.

      // Actually `switchSession` in `sqlite.ts` takes `targetSessionId`.
      // It updates the DB status.
      // It DOES NOT seem to update `this.sessionId` of the instance? 
      // Wait, let me check `sqlite.ts` content from memory or view it again alongside.
      //
      // In `sqlite.ts`:
      // public async switchSession(targetSessionId: string): Promise<void> { ... }
      // It updates DB.
      // It DOES NOT update `this.sessionId`.
      //
      // So we need to ensure `this.history` points to the new session.
      // Since `SQLiteChatMessageHistory` might not allow changing `sessionId` publicly if it's protected/private...
      // It is `private sessionId: string;`.
      //
      // So simple fix: Re-instantiate `this.history`?
      // `this.history = new SQLiteChatMessageHistory({ sessionId: sessionId, ... })`
      //
      // This is safe and clean.

      // Ensure the target session exists before switching (creates as 'paused' if not found).
      (this.history as SQLiteChatMessageHistory).ensureSession(sessionId);

      await (this.history as SQLiteChatMessageHistory).switchSession(sessionId);

      // Close previous connection before re-instantiating to avoid file handle leaks
      (this.history as SQLiteChatMessageHistory).close();

      // Re-instantiate to point to new session
      this.history = new SQLiteChatMessageHistory({
        sessionId: sessionId,
        databasePath: this.databasePath,
        limit: this.config.llm?.context_window ?? 100
      });

    } else {
      throw new Error("Current history provider does not support session switching.");
    }
  }

  getCurrentSessionId(): string | null {
    if (this.history instanceof SQLiteChatMessageHistory) {
      return (this.history as SQLiteChatMessageHistory).currentSessionId || null;
    }
    return null;
  }

  async injectAIMessage(content: string): Promise<void> {
    if (!this.history) throw new Error('Oracle not initialized.');
    await this.history.addMessages([new AIMessage(content)]);
  }

  async clearMemory(): Promise<void> {
    if (!this.history) {
      throw new Error("Message history not initialized. Call initialize() first.");
    }
    await this.history.clear();
  }

  async reloadTools(): Promise<void> {
    if (!this.provider) {
      throw new Error("Oracle not initialized. Call initialize() first.");
    }

    await Neo.refreshDelegateCatalog().catch(() => {});
    await Trinity.refreshDelegateCatalog().catch(() => {});
    updateSkillToolDescriptions();
    this.provider = await ProviderFactory.create(this.config.llm, [TaskQueryTool, NeoDelegateTool, ApocDelegateTool, TrinityDelegateTool, SkillExecuteTool, SkillDelegateTool, ...chronosTools]);
    await Neo.getInstance().reload();
    this.display.log(`Oracle and Neo tools reloaded`, { source: 'Oracle' });
  }
}

