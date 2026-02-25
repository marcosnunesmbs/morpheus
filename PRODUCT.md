# Morpheus Product Documentation

## 1. Product Overview
Morpheus is a local-first AI operator for developers.
It combines LLM reasoning, persistent memory, and asynchronous execution so the assistant can act on real systems without blocking the user conversation loop.

Core promise:
- keep data and control local
- be reachable from terminal, web UI, Telegram, and Discord
- execute real tasks through specialized subagents

## 2. Product Pillars
- Ownership: sessions, memories, usage, and task history remain in local SQLite databases.
- Responsiveness: Oracle stays available while delegated tasks run in background workers.
- Verifiability: delegated work is tracked as tasks with status, retries, and origin metadata.
- Operational clarity: users can inspect tasks and tool traces in the UI.
- Multi-channel delivery: unified ChannelRegistry abstraction for Telegram, Discord, and future adapters.

## 3. Multi-Agent Value
- Oracle: conversational orchestrator and decision layer.
- Neo: MCP/internal-tools executor for analytical and operational actions.
- Apoc: DevTools/browser executor for engineering and automation tasks.
- Trinity: database specialist for SQL/NoSQL query execution.
- Sati: memory evaluator that enriches context with long-term facts.

This separation reduces prompt ambiguity and improves reliability for mixed workloads.

## 4. End-User Experience

### 4.1 Async Delegation
When execution is needed, Oracle creates one or more atomic tasks and immediately acknowledges creation.
Results arrive asynchronously via notifier pipeline.

### 4.2 Task Observability
Users can inspect:
- task status (`pending`, `running`, `completed`, `failed`)
- assigned agent
- origin channel and session
- attempts, retry behavior, and outputs/errors

### 4.3 Rich Channel UX

#### Telegram
- Markdown-like rendering converted to safe rich text
- Copy-friendly IDs in code blocks
- Voice message transcription (Gemini/Whisper/OpenRouter)
- Inline buttons for Trinity database actions

#### Discord
- DM-only responses from authorized users
- Slash commands for all major operations
- Voice message and audio file transcription
- Automatic command registration on startup

#### Web Chat
- Markdown AI rendering
- Collapsible tool-call blocks
- SATI memory collapses
- Token badges per message

## 5. Primary Workflows

### 5.1 Single Action
1. User asks for an execution task.
2. Oracle chooses Neo, Apoc, or Trinity and enqueues one task.
3. User receives immediate acknowledgement.
4. Worker executes and notifier pushes result to origin channel or configured `notify_channels`.

### 5.2 Multi-Action Request
1. User asks for independent actions in one message.
2. Oracle splits into multiple atomic tasks (one objective per task).
3. Each task runs asynchronously and reports independently.

### 5.3 Status Follow-up
User asks "status/consultou?" and Oracle uses direct task query (no delegation required).

### 5.4 Scheduled Execution (Chronos)
1. User schedules a job via chat, Telegram command, Discord slash command, or UI.
2. ChronosWorker polls and executes job at scheduled time.
3. Job runs in active Oracle session with injected context.
4. Result delivered to configured `notify_channels` (default: broadcast to all active channels).

## 6. Product Controls
- Dedicated agent settings in UI for Oracle, Sati, Neo, Apoc, and Trinity.
- Channel configuration in UI for Telegram and Discord.
- Runtime toggle for async execution (`runtime.async_tasks.enabled`).
- Per-agent model/provider configuration for cost and performance tuning.
- Chronos configuration: polling interval and default timezone.
- Per-job notification channel routing (`notify_channels`).

## 7. Non-Functional Requirements
- Privacy: local-first by default; external API calls are explicit by chosen providers/tools.
- Security: channel allowlists, API auth (`x-architect-pass`), webhook key auth (`x-api-key`).
- Reliability: persisted queue with retry and stale-recovery logic.
- Cost tracking: token usage persisted per message/provider/model for analytics.
- Extensibility: new channels implement `IChannelAdapter` and register with `ChannelRegistry`.

## 8. Product Direction
Morpheus is evolving from chat assistant to an asynchronous local operator:
- deterministic task orchestration
- richer auditability of delegated work
- stronger separation between orchestration and execution agents
- better operational visibility in UI and external channels
- multi-channel presence (Terminal, Web UI, Telegram, Discord)
- temporal scheduling with Chronos for recurring and one-time automations
