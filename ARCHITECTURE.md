# Morpheus Architecture Reference

## 1. High-Level System Overview
Morpheus is a **local-first AI Operator** designed as a persistent background service (Daemon). It functions as an orchestration layer that bridges Large Language Models (LLMs) with the user's local environment, external communication channels (like Telegram), and developer tools.

Unlike a simple chatbot, Morpheus is architected to be a long-running "OS for AI" that maintains state, identity, and memory across different interaction sessions and modalities (text, voice, terminal).

## 2. Architectural Style
The system follows a **Modular Monolith** architecture with a clear separation of concerns, orchestrated by a central event loop:
*   **Daemon Process:** A single Node.js process manages the lifecycle of all components.
*   **Event-Driven Channels:** External interfaces (Telegram, HTTP) act as event producers for the central agent.
*   **Agentic Core:** The "Oracle" acts as the central brain, executing a retrieve-think-act loop.

## 3. Main Components & Responsibilities

### Core Runtime (`src/runtime/`)
The "Central Nervous System" of Morpheus.
*   **Oracle Engine (`oracle.ts`):** Implements the main conversation loop using LangChain ReactAgent. Handles prompt construction, context window management, tool execution, and delegation to subagents via the `apoc_delegate` tool.
*   **Apoc Subagent (`apoc.ts`):** Specialized DevTools subagent called by Oracle. Executes filesystem, shell, git, network, package, process, and system operations using **DevKit** tool factories (`src/devkit/`). Uses `ProviderFactory.createBare()` for a clean isolated agent context.
*   **Memory Systems:**
    *   **Short-Term:** SQLite-based chat history for active session context.
    *   **Long-Term (Sati):** A dedicated sub-agent and database (`sati-memory.db`) for storing semantic facts, user preferences, and project context.
    *   **Embeddings:** Background workers allowing semantic search over past conversations.
*   **Provider Factory (`providers/factory.ts`):** Abstracts LLM providers (OpenAI, Anthropic, Gemini, Ollama). Two creation modes:
    *   `create()` — Full Oracle agent (internal tools + MCP tools + `apoc_delegate`).
    *   `createBare()` — Clean subagent context (DevKit tools only, used by Apoc).
*   **Tool Manager:** Loads and executes Model Context Protocol (MCP) servers and local function calls.

### Interfaces & Channels (`src/channels/`, `src/http/`)
The methods by which users interact with Morpheus.
*   **Channel Adapters:** Protocol translators (e.g., `TelegramAdapter`) that convert external platform events into normalized Oracle messages.
*   **HTTP Server:** Express.js server providing a REST API for the UI and external integrations.
*   **Web UI (`src/ui/`):** A React/Vite SPA for system monitoring, configuration, and direct chat.

### Infrastructure (`src/cli/`, `src/config/`)
*   **CLI:** Commander.js based tool for process management (`start`, `stop`, `status`).
*   **Config Manager:** Zod-validated configuration loader handling `~/.morpheus/config.yaml`.

## 4. Folder Structure
```
bin/                # Executable entry point
src/
├── channels/       # Adapters for external platforms (Telegram, etc.)
├── cli/            # CLI Command definitions and lifecycle management
├── config/         # Configuration logic and Zod schemas
├── devkit/         # DevKit tool factories (filesystem, shell, git, network, packages, processes, system)
├── http/           # Express API server & static asset serving
├── runtime/        # Core business logic (Agent, Memory, Tools)
│   ├── apoc.ts     # Apoc DevTools subagent (singleton, uses DevKit)
│   ├── oracle.ts   # Oracle main agent (ReactAgent + apoc_delegate tool)
│   ├── memory/     # SQLite & Vector storage implementations
│   ├── providers/  # LLM API wrappers (create / createBare)
│   └── tools/      # Internal tools + apoc-tool.ts (apoc_delegate)
├── types/          # Shared TypeScript interfaces
└── ui/             # React Frontend application
```

## 5. Data Flow

1.  **Ingestion:** User sends a message via **Telegram**.
2.  **Normalization:** `TelegramAdapter` receives the webhook, verifies the user, and converts the payload to a standard internal message format.
3.  **Context Assembly (Pre-Agent):**
    *   **Sati Middleware** queries the Vector DB for relevant past memories.
    *   Recent chat history is loaded from SQLite.
4.  **Cognition (The Oracle):**
    *   The **LLM** receives the prompt (System prompt + Context + User query).
    *   The LLM may decide to call **Tools** (e.g., MCP servers, internal config/diagnostic tools).
    *   For dev operations (files, shell, git, etc.), Oracle calls the **`apoc_delegate`** tool.
    *   **Apoc** receives the delegated task, executes it with DevKit tools, and returns the result.
    *   Oracle integrates the result and continues the ReAct loop until complete.
5.  **Response:** The LLM generates a final text response.
6.  **Consolidation (Post-Agent):**
    *   **Sati Middleware** analyzes the interaction to extract new facts/preferences and stores them in the Long-Term Memory DB.
7.  **Delivery:** `TelegramAdapter` formats the response and sends it back to the user.

## 6. External Integrations
*   **LLM Providers:** OpenAI, Anthropic, Google Gemini, Ollama (Local).
*   **Messaging Platforms:** Telegram Bot API.
*   **MCP Servers:** Connects to any standard Model Context Protocol server (Filesystem, GitHub, Databases).

## 7. Authentication & Security
*   **Daemon Security:** The HTTP API is protected by `THE_ARCHITECT_PASS`, validated via the `x-architect-pass` header.
*   **Channel Security:** Messaging adapters enforce strict **Allowlists**. Only User IDs defined in `config.yaml` can trigger the agent. Unauthorized messages are silently ignored or logged.
*   **Local-First:** All data acts locally. Use of external LLMs is optional (via Ollama).

## 8. Scalability & Deployment
*   **Single-User Focus:** Currently designed as a personal single-user daemon.
*   **Deployment:** Runs on local dev machines, home servers, or VPS.
*   **Resource Management:** Uses `better-sqlite3` for efficient local storage and manages child processes for MCP servers.

## 9. Multi-Agent Architecture

Morpheus implements a **two-tier multi-agent pattern**:

| Agent | Role | Tools |
|---|---|---|
| **Oracle** | Orchestrator — handles all user-facing conversation, reasoning, and delegation | MCP servers, internal tools, `apoc_delegate` |
| **Sati** | Background evaluator — consolidates long-term memories after each conversation | LLM only (no tools) |
| **Apoc** | DevTools executor — runs file/shell/git/network ops on Oracle's behalf | DevKit (filesystem, shell, git, network, packages, processes, system) |

Each agent can independently use a different LLM provider/model, configured under `llm`, `sati`, and `apoc` sections in `zaion.yaml`.

## 10. Future Considerations
*   **Plugin System:** Dynamic loading of channels and tools without rebuilding the core.
*   **Discord Adapter:** Support for Discord interactions.
