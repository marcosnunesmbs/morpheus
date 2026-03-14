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
- Neo: MCP/internal-tools executor for analytical and operational actions (personality: `analytical_engineer`).
- Apoc: DevTools/browser executor for engineering and automation tasks (personality: `pragmatic_dev`). Auto-resolves and injects relevant skills (including GWS) based on task keywords.
- Trinity: database specialist for SQL/NoSQL query execution (personality: `data_specialist`).
- Link: documentation specialist for RAG over user documents (personality: `documentation_specialist`).
- Smith: remote DevKit executor for isolated machines via WebSocket (uses Oracle's LLM with proxy tools).
- Sati: memory evaluator that enriches context with long-term facts.

This separation reduces prompt ambiguity and improves reliability for mixed workloads. Each subagent's personality can be customized via configuration to adapt behavior to specific workflows.

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
- Optional TTS audio responses (Google Gemini / OpenAI) with text fallback on failure
- Inline buttons for Trinity database actions
- Session management commands (list, switch, rename)

#### Discord
- DM-only responses from authorized users
- Slash commands for all major operations
- Session management commands (list, switch, rename)
- Voice message and audio file transcription
- Optional TTS audio responses with text fallback on failure
- Automatic command registration on startup

#### Web Chat
- Markdown AI rendering (GitHub Flavored Markdown)
- Collapsible tool-call blocks
- SATI memory collapses
- Token badges per message
- Memory recovery counts in message metadata
- Browser notifications when tab is in background
- Per-session loading state indicators

## 5. Primary Workflows

### 5.1 Single Action
1. User asks for an execution task.
2. Oracle chooses Neo, Apoc, Trinity, or Smith and enqueues one task.
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
- Dedicated agent settings in UI for Oracle, Sati, Neo, Apoc, Trinity, Link, and Smiths.
- Per-agent personality configuration:
  - Neo: `analytical_engineer`, `meticulous_auditor`, `systems_thinker`, or custom
  - Apoc: `pragmatic_dev`, `cautious_admin`, `automation_specialist`, or custom
  - Trinity: `data_specialist`, `query_optimizer`, `db_architect`, or custom
  - Link: `documentation_specialist` or custom
- Channel configuration in UI for Telegram and Discord.
- Runtime toggle for async execution (`runtime.async_tasks.enabled`).
- Per-agent model/provider configuration for cost and performance tuning.
- Chronos configuration: polling interval and default timezone.
- Per-job notification channel routing (`notify_channels`).
- Smith remote agent management: config hot-reload, ping, add/remove via API or LLM tools.
- Link document management: upload, delete, reindex via UI or API.
- Sati memory configuration: evaluation interval, similarity threshold.
- Audit dashboard: session audit, tool call tracking, cost breakdowns.
- Display currency: Settings → Interface configures the currency used for cost displays across audit pages and model pricing (USD, BRL, EUR, CAD, JPY, GBP, AUD, CHF, ARS, or custom). Costs remain stored in USD; conversion is display-only.
- Google Workspace integration: 102 built-in skills for Gmail, Drive, Sheets, Calendar, Docs, and more. Configurable via `gws` section in `zaion.yaml`.
- Webhook security: per-webhook API key toggle (public or secured). Payload isolation prevents prompt injection from webhook data.
- Real-time activity visualization: live agent activity feed on dashboard with 3D orbital visualizer.
- Danger Zone: destructive data operations (reset sessions, tasks, jobs, audit, factory reset).

## 7. Non-Functional Requirements
- Privacy: local-first by default; external API calls are explicit by chosen providers/tools.
- Security: channel allowlists, API auth (`x-architect-pass`), webhook key auth (`x-api-key`).
- Reliability: persisted queue with retry and stale-recovery logic.
- Cost tracking: token usage persisted per message/provider/model for analytics. Display currency is configurable independently — costs are always stored in USD.
- Audio responses: voice message transcription (STT) and optional text-to-speech replies (TTS) via Google Gemini or OpenAI, with automatic fallback to text.
- Extensibility: new channels implement `IChannelAdapter` and register with `ChannelRegistry`. Runtime services are decoupled via Ports & Adapters (dependency inversion), enabling adapter swaps and mock-based testing without changing consumer code. New LLM providers are added via the `IProviderStrategy` interface.
- Remote execution: Smith agents extend DevKit reach to isolated machines via WebSocket (TLS supported).
- Auditability: comprehensive execution audit trail with tool call tracking and cost breakdowns.

## 8. Product Direction
Morpheus is evolving from chat assistant to an asynchronous local operator:
- deterministic task orchestration
- richer auditability of delegated work
- stronger separation between orchestration and execution agents
- better operational visibility in UI and external channels (real-time activity visualization)
- multi-channel presence (Terminal, Web UI, Telegram, Discord)
- temporal scheduling with Chronos for recurring and one-time automations
- remote execution delegation via Smith agents on isolated machines
- Google Workspace automation via skills-based `gws` CLI integration
- extensible skill system with auto-resolution for domain-specific task handling
