# Implementation Plan - Improve Message Persistence & Usage Metadata

We will upgrade the persistence layer to store the full interaction history (including tool calls) and detailed token usage metadata. This ensures full auditability and cost tracking for both text and audio interactions.

## User Review Required

> [!NOTE]
> The `AudioAgent` will be updated to return usage metadata. The `Agent` will be updated to accept this metadata to attach it to the incoming user message (accounting for proper attribution of costs).

- **Technical Choice**: We will modify `SQLiteChatMessageHistory` to store LangChain's `usage_metadata` field directly into new columns.
- **Database**: 4 new columns will be added to the `messages` table. We need to handle migration (likely a check-and-alter approach since we use `better-sqlite3`).

## Proposed Changes

### Phase 1: Database & Memory Layer

#### [SQLiteChatMessageHistory] Schema Update
- Update `ensureTable` method in `src/runtime/memory/sqlite.ts` to include:
  - `input_tokens INTEGER`
  - `output_tokens INTEGER`
  - `total_tokens INTEGER`
  - `cache_read_tokens INTEGER`
- Implement a migration check: If columns likely don't exist (primitive check), assume it's valid or try `ALTER TABLE` in a try-catch block for existing dev DBs.

#### [SQLiteChatMessageHistory] Logic Update
- Update `addMessage(message)`:
  - Extract usage from `message.response_metadata` (standard LangChain location) or `message.usage_metadata`.
  - Extract usage if passed directly (for Audio cases).
  - Persist `ToolMessage` types correctly (currently only Human/AI/System).
- Update `getMessages()`:
  - Reconstruct `ToolMessage` from DB rows (map type 'tool').
  - Hydrate `usage_metadata` on returned messages so context matches history.

### Phase 2: Agent Logic & Persistence Loop

#### [Agent] Persist Full Trace
- Refactor `src/runtime/agent.ts` -> `chat()` method.
- Instead of just saving the last message, iterate through `response.messages`.
- **Logic**:
  1. Fetch `previousMessages` count.
  2. Run `invoke`.
  3. Identify *new* messages returned by the agent (slicing the array).
  4. Loop through new messages and save each one to history.
  5. Ensure proper ordering (User -> [Tool Call -> Tool Output]* -> AI Answer).

#### [Agent] Usage Metadata Handling
- When saving `AIMessage`, LangChain usually attaches `usage_metadata` to the final response. Ensure this is extracted and passed to `addMessage`.

### Phase 3: Audio Agent Integration

#### [AudioAgent] Return Metadata
- Update `src/runtime/audio-agent.ts` -> `transcribe`.
- Change return type from `Promise<string>` to `Promise<{ text: string, usage: UsageMetadata }>`.
- Extract usage from GoogleGenAI response (`response.usageMetadata`).

#### [TelegramAdapter] Pass Audio Usage
- Update `src/channels/telegram.ts`.
- When handling voice:
  - Call improved `transcribe`.
  - Call `agent.chat(text, { previousUsage: usage })`.
- Update `Agent.chat` signature to accept `extraUsage`.
- When creating the initial `HumanMessage`, attach this audio usage to it (so the user's "voice" message carries its cost).

## Verification Plan

### Automated Tests
- **Unit**: Test `SQLiteChatMessageHistory` with `ToolMessage` and usage data.
- **Unit**: Mock provider in `Agent` and verify `history.addMessage` is called multiple times for a tool chain.

### Manual Verification
1. **Tool Usage**: Ask "Check price of ETH". Check DB `messages` table.
   - Expect: User Msg -> AI Msg (Tool Call) -> Tool Msg (Result) -> AI Msg (Answer).
2. **Audio**: Send voice note. Check DB.
   - Expect: User Msg has `input_tokens` (audio) > 0.
3. **Cache**: Run same query twice. Check DB.
   - Expect: Second run has `cache_read_tokens` > 0.
