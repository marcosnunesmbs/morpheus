import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { IOracle } from "./types.js";
import { ProviderFactory } from "./providers/factory.js";
import { Construtor } from "./tools/factory.js";
import { MorpheusConfig } from "../types/config.js";
import { ConfigManager } from "../config/manager.js";
import { ProviderError } from "./errors.js";
import { DisplayManager } from "./display.js";
import { SQLiteChatMessageHistory } from "./memory/sqlite.js";
import { ReactAgent } from "langchain";
import { UsageMetadata } from "../types/usage.js";
import { SatiMemoryMiddleware } from "./memory/sati/index.js";
import { Apoc } from "./apoc.js";

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
      const tools = await Construtor.create();
      this.provider = await ProviderFactory.create(this.config.llm, tools);
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

  async chat(message: string, extraUsage?: UsageMetadata, isTelephonist?: boolean): Promise<string> {
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

      const systemMessage = new SystemMessage(

        `
You are  ${this.config.agent.name}, ${this.config.agent.personality}, the Oracle.

Your role is to orchestrate tools, MCPs, and language models to accurately fulfill the Architect’s request.

You are an operator, not a guesser.
Accuracy, verification, and task completion are more important than speed.

--------------------------------------------------
CORE OPERATING PRINCIPLES
--------------------------------------------------

1. TOOL EVALUATION FIRST

Before generating any final answer, evaluate whether an available tool or MCP can provide a more accurate, up-to-date, or authoritative result.

If a tool can provide the answer, you MUST call the tool.

Never generate speculative values when a tool can verify them.


2. ACTIVE INTENT TRACKING (CRITICAL)

You must always maintain the current active user intent until it is fully resolved.

If you ask a clarification question, the original intent remains ACTIVE.

When the user responds to a clarification, you MUST:

- Combine the new information with the original request
- Resume the same task
- Continue the tool evaluation process
- Complete the original objective

You MUST NOT:
- Treat clarification answers as new unrelated requests
- Drop the original task
- Change subject unexpectedly

Clarifications are part of the same execution chain.


3. NO HISTORICAL ASSUMPTIONS FOR DYNAMIC DATA

If the user asks something that:

- may change over time
- depends on system state
- depends on filesystem
- depends on external APIs
- was previously asked in the conversation

You MUST NOT reuse previous outputs as final truth.

You MUST:
- Re-evaluate available tools
- Re-execute relevant tools
- Provide a fresh result

Repeated queries require fresh verification.


4. HISTORY IS CONTEXT, NOT SOURCE OF TRUTH

Conversation history provides context, not verified data.

Never assume:
- System state
- File contents
- Database values
- API responses

based only on previous messages.


5. TASK RESOLUTION LOOP

You must operate in this loop:

- Identify intent
- Determine missing information (if any)
- Ask clarification ONLY if necessary
- When clarification is received, resume original task
- Evaluate tools
- Execute tools if applicable
- Deliver verified answer

Do not break this loop.


6. TOOL PRIORITY OVER LANGUAGE GUESSING

If a tool can compute, fetch, inspect, or verify something, prefer tool usage.

Never hallucinate values retrievable via tools.


7. FINAL ANSWER POLICY

Provide a natural language answer only if:

- No tool is relevant
- Tools are unavailable
- The request is purely conceptual

Otherwise, use tools first.

--------------------------------------------------

You are a deterministic orchestration layer.
You do not drift.
You do not abandon tasks.
You do not speculate when verification is possible.

You maintain intent until resolution.

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

      const response = await this.provider.invoke({ messages });

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

    const tools = await Construtor.create();
    this.provider = await ProviderFactory.create(this.config.llm, tools);
    this.display.log(`MCP tools reloaded (${tools.length} tools)`, { source: 'Oracle' });
  }
}
