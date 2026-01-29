# Implementation Plan: Agent Interaction Flow & Telegram Integration

**Branch**: `006-agent-interaction-flow` | **Date**: 2026-01-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/006-agent-interaction-flow/spec.md`

## Summary

This feature integrates the Telegram channel into the Morpheus agent, allowing users to interact with their local agent remotely via a Telegram Bot. It involves updating the CLI initialization flow to capture Telegram configuration (Token, Allowed IDs), extending the configuration schema, and upgrading the `TelegramAdapter` to secure the channel (allowlist filtering) and connect it to the `Agent` runtime for processing messages.

## Technical Context

**Language/Version**: TypeScript 5.3 (Node.js 18+)
**Primary Dependencies**: `telegraf` (Telegram API), `@inquirer/prompts` (CLI UI), `fs-extra` (Config IO)
**Storage**: JSON file (`morpheus.json`) for configuration.
**Testing**: Manual verification via `manual_start_verify.ts` pattern or unit tests in `src/channels/__tests__/`.
**Target Platform**: Local CLI (Windows/Linux/Mac).
**Project Type**: CLI
**Performance Goals**: N/A (Limited by LLM latency).
**Constraints**: Telegram API Webhooks require public IP, so we will use Long Polling (`bot.launch()`) which works locally without port forwarding.
**Scale/Scope**: Single user (or small group of trusted users) per agent instance.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Local-First & Privacy**: Keys stored locally in `morpheus.json`. Chat logs valid for `DisplayManager` (local). Data goes to Telegram API (unavoidable for external channel) but user consents via configuration.
- [x] **Extensibility**: Logic encapsulated in `TelegramAdapter`.
- [x] **DX**: Easy setup via `morpheus init`.
- [x] **Reliability**: Uses `DisplayManager` for logs.
- [x] **Observability**: All IO logged to terminal.

## Project Structure

### Documentation (this feature)

```text
specs/006-agent-interaction-flow/
├── plan.md              # This file
├── research.md          # Technology decisions
├── data-model.md        # Config schema updates
├── quickstart.md        # User guide
├── contracts/           # Internal module interfaces
│   └── internal-api.md
└── tasks.md             # Implementation tasks
```

### Source Code

```text
src/
├── channels/
│   └── telegram.ts      # [UPDATE] Add auth logic, Agent binding, and error handling
├── cli/
│   └── commands/
│       ├── init.ts      # [UPDATE] Add Telegram config prompts
│       └── start.ts     # [UPDATE] Pass Agent to TelegramAdapter
├── types/
│   └── config.ts        # [UPDATE] Add TelegramConfig interface
└── config/
    └── manager.ts       # [UPDATE] Ensure new config fields are loaded validly
```

**Structure Decision**: enhance existing `src/channels/telegram.ts` rather than creating new folder structure, as it fits the current pattern.

## Complexity Tracking

No violations.
