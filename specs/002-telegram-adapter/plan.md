# Implementation Plan: Telegram Channel Adapter

**Branch**: `002-telegram-adapter` | **Date**: 2026-01-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-telegram-adapter/spec.md`

## Summary

Implement the Telegram Channel Adapter to allow Morpheus to communicate via Telegram. This includes adding the `telegraf` library, implementing the adapter logic (connect/disconnect/echo), and adding a new `config set` CLI command to easily configure the bot token and status.

## Technical Context

**Language/Version**: Node.js >= 18, TypeScript
**Primary Dependencies**: `telegraf`
**Utilities**: Custom `setByPath` for config updates usage
**Storage**: `config.yaml` updates
**Testing**: Manual integration testing (CLI actions) & Unit tests for utils
**Target Platform**: CLI
**Project Type**: CLI Application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Standard**: Follows SpecKit file structure.
- **Local-First**: Telegram token stored locally; no external server except Telegram API.
- **Extensibility**: Adds a new channel module pattern.

## Project Structure

### Documentation (this feature)

```text
specs/002-telegram-adapter/
├── plan.md              
├── research.md          
├── data-model.md        
├── quickstart.md        
├── contracts/           
│   └── cli-api.md
└── tasks.md             
```

### Source Code (repository root)

```text
src/
├── channels/
│   └── telegram.ts       # Adapter implementation
├── cli/
│   ├── commands/
│   │   └── config.ts     # Updated with 'set' subcommand
│   └── index.ts          # (No change needed config cmd already registered)
├── config/
│   └── utils.ts          # Start/set helper utility
└── runtime/
    └── lifecycle.ts      # (Might need updates for centralized adapter management in future, simplified for now)
```

## Phase 1: Setup

- [ ] T001 Install `telegraf` dependency (`npm install telegraf`).
- [ ] T002 Update `src/types/config.ts` to ensure Telegram config types are exported (already done in 001, verifying).

## Phase 2: Core Logic (Adapter)

- [ ] T003 Create `src/channels/telegram.ts`.
- [ ] T004 Implement `TelegramAdapter` class with `connect(token)` and `disconnect()` methods.
- [ ] T005 Implement `stop('SIGINT')` logic for graceful shutdown in `disconnect()`.
- [ ] T006 Add message listener to log incoming messages to `stdout` (Echo/Log only).

## Phase 3: Configuration (CLI)

- [ ] T007 Implement `setByPath` utility (likely in `src/config/utils.ts` or inside `manager.ts`).
- [ ] T008 Update `ConfigManager` to support `set(key, value)` operation that saves to disk.
- [ ] T009 Update `src/cli/commands/config.ts` to handle sub-command `set <key> <value>`.
- [ ] T010 Implement value parsing logic (boolean/number conversion) for CLI inputs.

## Phase 4: Integration

- [ ] T011 Update `src/cli/commands/start.ts` to check `config.channels.telegram.enabled`.
- [ ] T012 Instantiate and start `TelegramAdapter` if enabled.
- [ ] T013 Ensure `start.ts` calls `adapter.disconnect()` on shutdown signals.

## Phase 5: Verification

- [ ] T014 Verification: Run `morpheus config set` and check `config.yaml`.
- [ ] T015 Verification: Run `morpheus start` with valid token and test message reception.
