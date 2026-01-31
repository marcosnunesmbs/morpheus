# morpheus Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-29

## Active Technologies
- Node.js >= 18, TypeScript + `commander`, `ora`, `chalk`, `open`, `js-yaml` (001-cli-structure)
- File System (`~/.morpheus`) (001-cli-structure)
- [if applicable, e.g., PostgreSQL, CoreData, files or N/A] (002-telegram-adapter)
- Node.js >= 18, TypeScript + `ora`, `chalk` (003-terminal-ui-manager)
- TypeScript 5.3 (Node.js 18+) + `telegraf` (Telegram API), `@inquirer/prompts` (CLI UI), `fs-extra` (Config IO) (006-agent-interaction-flow)
- JSON file (`morpheus.json`) for configuration. (006-agent-interaction-flow)
- TypeScript (Node.js >= 18) + `winston`, `winston-daily-rotate-file`, `zod` (for config validation) (007-logging-system)
- Local filesystem (`~/.morpheus/logs/`) (007-logging-system)
- TypeScript 5.x / Node.js >= 18 + `better-sqlite3`, `@langchain/core` (008-sqlite-memory-persistence)
- SQLite (`better-sqlite3`) (008-sqlite-memory-persistence)
- TypeScript 5.9 (shared), Node.js (backend), React 19 (frontend) (010-settings-form-ui)
- `config.yaml` (via existing `ConfigManager`) (010-settings-form-ui)
- Node.js 18+ (ESM) + Commander, Express, React (UI) (011-npm-publish-setup)
- TypeScript 5.x / Node.js >= 18 + `@google/genai` (Google's official SDK for Gemini) (012-audio-transcription)
- Temporary memory buffers for audio handling; no persistent local storage of audio files. (012-audio-transcription)

- [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION] (001-cli-structure)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

cd src; pytest; ruff check .

## Code Style

[e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]: Follow standard conventions

## Recent Changes
- 013-improve-init-flow: Added [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION] + [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]
- 012-audio-transcription: Added TypeScript 5.x / Node.js >= 18 + `@google/genai` (Google's official SDK for Gemini)
- 011-npm-publish-setup: Added Node.js 18+ (ESM) + Commander, Express, React (UI)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
