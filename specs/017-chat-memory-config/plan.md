# Implementation Plan: Chat History Configuration

**Branch**: `017-chat-memory-config` | **Date**: 2026-02-01 | **Spec**: [specs/017-chat-memory-config/spec.md](spec.md)
**Input**: Feature specification from `/specs/017-chat-memory-config/spec.md`

## Summary

This feature exposes the existing `memory.limit` configuration to the UI. This setting controls the number of past messages loaded from the SQLite database into the context window for each interaction.

## Technical Context

**Language/Version**: Node.js >= 18, TypeScript (Strict)
**Primary Dependencies**: React 19 (Vite)
**Storage**: `config.yaml` (via ConfigManager)
**Testing**: Manual UI verification
**Target Platform**: Web UI (Localhost)
**Project Type**: UI Feature Extension

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Local-First**: ✅ Config remains local.
- **Developer Experience**: ✅ Makes critical config accessible without file editing.

## Project Structure

### Documentation (this feature)

```text
specs/017-chat-memory-config/
├── plan.md              # This file
├── research.md          # N/A (Standard pattern)
├── data-model.md        # N/A (Existing schema)
├── quickstart.md        # Testing guide
├── contracts/           # N/A (Existing API)
└── tasks.md             # Task breakdown
```

### Source Code

```text
src/ui/src/pages/
└── Settings.tsx         # Update LLM or create Chat/Memory tab
```

**Structure Decision**: Add "Memory" section to the existing "LLM" tab in `Settings.tsx` to keep semantic grouping (Memory affects LLM performance). Alternatively, create a "Chat" tab if we expect more chat-specific settings later (like system prompts). 
*Decision*: Add to "LLM" tab for now to avoid clutter, using a "Context & Memory" subsection.

## Complexity Tracking

No new dependencies or complex logic. Pure UI mapping to existing config.
