# Research: Agent Interaction Flow & Telegram Integration

**Feature**: 006-agent-interaction-flow
**Date**: 2026-01-29

## Unknowns & Clarifications

### 1. Inquirer Selection Pattern for Channels
**Question**: How to present an extensible list of channels during `init`?
**Context**: We currently use `@inquirer/prompts`.
**Findings**:
- We can use `checkbox` from `@inquirer/prompts` to allow selecting multiple channels (even if currently only Telegram is supported).
- Alternatively, `confirm` ("Configure external channels?") followed by `select` or `checkbox`.
**Decision**: Use `confirm` ("Do you want to configure external channels?") to keep the "happy path" simple for local-only users. If Yes, show a `checkbox` list (future proof) or `select` (if we treat them one-by-one). Given the spec says "ask if user wants... then presents selection", the `confirm` -> `checkbox` pattern is best.

### 2. Telegram ID Validation
**Question**: Does Telegram return IDs as numbers or strings?
**Context**: `telegraf` types.
**Findings**: Telegram API v5+ uses Int64 for user IDs. JS `number` can handle up to 2^53-1 안전ly. Telegram IDs are often large integers.
- `ctx.from.id` is a `number` in Telegraf types.
- **Risk**: Very large IDs might exceed JS safe integer.
- **Mitigation**: Store as strings in config to be safe, but compare loosely or convert incoming numbers to strings for comparison.
**Decision**: Store `allowedUsers` as `string[]` in `morpheus.json`. Convert incoming `ctx.from.id` to string before checking inclusion.

### 3. Agent Interaction Loop
**Question**: How does the Adapter talk to the Agent?
**Context**: `TelegramAdapter` currently initializes its own `DisplayManager`. It needs access to the `Agent` instance which is created in `start.ts`.
**Findings**:
- `start.ts` creates the `Agent`.
- `start.ts` currently creates `TelegramAdapter`.
- We need to pass the `Agent` instance to the `TelegramAdapter` either via constructor or a `setAgent` method.
- `TelegramAdapter` currently has no reference to `Agent`.
**Decision**: Update `TelegramAdapter.constructor` or add `public bindAgent(agent: Agent): void` method. Using a bind method or setter is flexible. Constructor injection is cleaner if dependency is mandatory. Since adapter *needs* agent to work, constructor injection is preferred.

## Technology Decisions

1.  **Config Storage**: `morpheus.json` under `channels.telegram`.
2.  **User ID Type**: String in JSON, casting from Number at runtime.
3.  **Dependency Injection**: Pass `Agent` instance to `TelegramAdapter` constructor.

