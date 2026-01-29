<!-- Sync Impact Report
Version: 1.0.0 -> 1.0.1
Modified Principles: None
Modified Standards:
- Core Stack: Removed "LangChain.js" (Not currently installed/used)
- Core Stack: Specified "Telegraf" for Telegram
Templates requiring updates:
- .specify/templates/plan-template.md: ✅
- .specify/templates/spec-template.md: ✅
- .specify/templates/tasks-template.md: ✅
- .specify/templates/commands/*.md: ⚠ (Folder missing)
Follow-up TODOs:
- Create .specify/templates/commands/ folder and docs.
- Define AI/Orchestration stack in future phases.
-->
# Morpheus Constitution

## Core Principles

### I. Local-First & Privacy
**User data and keys remain on the local machine.**
Morpheus is designed to be a local operator. We do not send data to cloud servers (other than the user's chosen LLM providers). Configuration, history, and keys are stored locally.
*Rationale*: Trust is paramount for an AI agent with access to dev tools. Users must know exactly where their data goes.

### II. Extensibility by Design
**Functionality is extended via Markdown and MCPs, not core recompilation.**
The core Morpheus CLI should remain lean. New capabilities are added by identifying "commands" in Markdown files or connecting Model Context Protocol (MCP) servers. The system must support hot-reloading of these extensions where possible.
*Rationale*: Enables rapid iteration and personalization without bloating the core or requiring complex build steps for users.

### III. Orchestration & Context
**Bridge the gap between intention and execution.**
Morpheus helps the user understand the system before acting. It is an orchestrator that pulls context from various sources (files, tools, MCPs) to inform the LLM. It does not blindly execute; it provides "system awareness".
*Rationale*: An AI agent without context is dangerous or useless. Context is the "consciousness" of the system.

### IV. Developer Experience (DX)
**Simple to install, configure, and use.**
- Installation MUST be via standard package managers (npm).
- Configuration MUST be declarative (file-based) with UI overrides.
- Errors MUST be human-readable.
*Rationale*: Tools that are hard to set up don't get used. Morpheus should feel like a natural extension of the terminal.

### V. Reliability & Transparency
**No magic boxes. Observability is mandatory.**
Users must be able to see what Morpheus is doing. Operations, especially those modifying state (files, git), must be logged and visible.
- Structured logging is required.
- "Dry-run" modes should be available for destructive actions.
*Rationale*: As an agent, Morpheus performs actions on behalf of the user. Transparency builds trust.

## Technology Standards

### Core Stack
- **Runtime**: Node.js >= 18
- **Language**: TypeScript (Strict Mode)
- **AI/Orchestration**: Native / Custom (TBD)
- **UI**: React + TailwindCSS (Vite)
- **Communication**: WebSocket (Real-time updates), Telegram (Telegraf) / Discord

## Development Workflow

### Quality Gates
1.  **Tests**: Core logic (orchestration, command parsing) MUST have unit tests.
2.  **Linting**: Code must pass strict linting rules.
3.  **Semantic Versioning**: All releases must follow SemVer.
4.  **Documentation**: New features must include user-facing docs (Command usage or MCP config).

## Governance

**This Constitution supersedes all other process documents.**
- **Amendments**: Changes to this document require a Pull Request with a clear motivation and "RFC" tag.
- **Compliance**: All PRs must be reviewed against these principles. If a feature violates "Local-First", it will be rejected unless heavily justified and opt-in.
- **Versioning**: Principles are versioned. Breaking changes to principles require a Major version bump of the Constitution.

**Version**: 1.0.1 | **Ratified**: 2026-01-29 | **Last Amended**: 2026-01-29
