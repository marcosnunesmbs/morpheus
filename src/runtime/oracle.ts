import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
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
import { Neo } from "./neo.js";
import { NeoDelegateTool } from "./tools/neo-tool.js";
import { ApocDelegateTool } from "./tools/apoc-tool.js";

export class Oracle implements IOracle {
  private provider?: ReactAgent;
  private config: MorpheusConfig;
  private history?: BaseListChatMessageHistory;
  private display = DisplayManager.getInstance();
  private databasePath?: string;
  private satiMiddleware = SatiMemoryMiddleware.getInstance();

  constructor(config?: MorpheusConfig, overrides?: { databasePath?: string }) {
    this.config = config || ConfigManager.getInstance().get();
    this.databasePath = overrides?.databasePath;
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
      this.provider = await ProviderFactory.create(this.config.llm, [NeoDelegateTool, ApocDelegateTool]);
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

Rules:
1. For conversation-only requests (greetings, conceptual explanation, memory follow-up), answer directly.
2. For requests that require execution, verification, external/system state, or non-trivial operations, evaluate the available tools and choose the best one.
3. Prefer delegation tools when execution should be asynchronous, and return the task acknowledgement clearly.
4. Never fabricate execution results for delegated tasks.
5. Keep responses concise and objective.
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
        messages.push(memoryMessage);
      }

      messages.push(...previousMessages);
      messages.push(userMessage);

      // Propagate current session to Apoc so its token usage lands in the right session
      const currentSessionId = (this.history instanceof SQLiteChatMessageHistory)
        ? this.history.currentSessionId
        : undefined;
      Apoc.setSessionId(currentSessionId);
      Neo.setSessionId(currentSessionId);

      const invokeContext: OracleTaskContext = {
        origin_channel: taskContext?.origin_channel ?? "api",
        session_id: taskContext?.session_id ?? currentSessionId ?? "default",
        origin_message_id: taskContext?.origin_message_id,
        origin_user_id: taskContext?.origin_user_id,
      };
      const response = await TaskRequestContext.run(invokeContext, () => this.provider!.invoke({ messages }));

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

      // Persist user message + all generated messages in a single transaction
      await this.history.addMessages([userMessage, ...newGeneratedMessages]);

      this.display.log('Response generated.', { source: 'Oracle' });

      const lastMessage = response.messages[response.messages.length - 1];
      const responseContent = (typeof lastMessage.content === 'string') ? lastMessage.content : JSON.stringify(lastMessage.content);

      // Sati Middleware: Evaluation (Fire and forget)
      this.satiMiddleware.afterAgent(responseContent, [...previousMessages, userMessage], currentSessionId)
        .catch((e: any) => this.display.log(`Sati memory evaluation failed: ${e.message}`, { source: 'Sati' }));

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

    this.provider = await ProviderFactory.create(this.config.llm, [NeoDelegateTool, ApocDelegateTool]);
    await Neo.getInstance().reload();
    this.display.log(`Oracle and Neo tools reloaded`, { source: 'Oracle' });
  }
}

