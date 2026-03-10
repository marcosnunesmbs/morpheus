# Implementation Plan: LangChain Core Agent

**Branch**: `004-langchain-core-agent` | **Date**: 2026-01-29 | **Spec**: [specs/004-langchain-core-agent/spec.md](specs/004-langchain-core-agent/spec.md)
**Input**: Feature specification from `specs/004-langchain-core-agent/spec.md`

## Summary

Implement the core conversational agent using LangChain (`@langchain/core` + providers) and an interactive CLI initialization flow using `inquirer`. The system will support OpenAI, Anthropic, Ollama, and Gemini, validating configuration at startup and providing user-friendly error feedback.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22+
**Primary Dependencies**: `commander` (CLI), `inquirer` (Interactivity), `@langchain/core`, `@langchain/openai`, `@langchain/anthropic`, `@langchain/ollama`, `@langchain/google-genai`
**Storage**: `config.yaml` (Local file for settings), In-Memory (Session history)
**Testing**: `vitest` (Unit tests for Agent class and Config validation)
**Target Platform**: CLI (Windows/Linux/macOS)
**Project Type**: single
**Performance Goals**: Startup < 500ms
**Constraints**: Local-first credentials
**Scale/Scope**: Single user, local session

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Local-First**: API keys stored in `~/.morpheus/config.yaml`, not sent to third-party servers (except the provider itself).
- [x] **Extensibility**: Uses `BaseChatModel` abstraction to easily add more providers (Groq, etc.) later.
- [x] **DX**: `morpheus init` guided setup significantly improves the onboarding experience compared to manual YAML editing.
- [x] **Reliability**: Explicit error handling for "Unauthorized" or "Model not found" errors with actionable feedback.

## Project Structure

### Documentation (this feature)

```text
specs/004-langchain-core-agent/
├── plan.md              # This file
├── research.md          # Dependency selection
├── data-model.md        # Config schema
├── quickstart.md        # Usage guide
├── contracts/           # Interfaces
│   └── agent-api.md     # IAgent interface
└── tasks.md             # Implementation tasks
```

### Source Code

```text
src/
├── cli/
│   └── commands/
│       └── init.ts             # NEW: Interactive setup command
├── runtime/
│   ├── agent.ts                # NEW: Core Agent implementation factory
│   └── providers/              # NEW: Provider wrappers/factories
├── config/
│   └── validation.ts           # NEW: Zod schemas for validation
└── __tests__/
    └── agent.test.ts           # NEW: Unit tests
```

**Structure Decision**: Option 1: Single project. Extending the existing `src/` structure with a new `runtimes/agent.ts` and `cli/commands/init.ts`.

## Complexity Tracking

*N/A - No violations.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
