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
*   **Oracle Engine (`oracle.ts`):** Implements the main conversation loop using LangChain. It handles prompt construction, context window management, and tool execution.
*   **Memory Systems:**
    *   **Short-Term:** SQLite-based chat history for active session context.
    *   **Long-Term (Sati):** A dedicated sub-agent and database (`sati-memory.db`) for storing semantic facts, user preferences, and project context.
    *   **Embeddings:** Background workers allowing semantic search over past conversations.
*   **Provider Factory:** Abstracts LLM providers (OpenAI, Anthropic, Gemini, Ollama) allowing seamless model switching.
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
├── http/           # Express API server & static asset serving
├── runtime/        # Core business logic (Agent, Memory, Tools)
│   ├── memory/     # SQLite & Vector storage implementations
│   ├── providers/  # LLM API wrappers
│   └── tools/      # MCP and local tool integration
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
    *   The LLM may decide to call **Tools** (e.g., "Search Web", "Read File").
    *   The Oracle executes tools and feeds results back to the LLM (ReAct loop).
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

## 9. Future Considerations
*   **Multi-Agent Swarms:** Expanding the runtime to support multiple specialized agents collaborating.
*   **Plugin System:** Dynamic loading of channels and tools without rebuilding the core.
