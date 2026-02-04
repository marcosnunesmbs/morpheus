# Architecture Reference

## 🧠 Project Overview
Morpheus is a local-first AI operator/agent for developers. It functions as a persistent background daemon that bridges Large Language Models (LLMs) with:
1.  **External Communication Channels** (e.g., Telegram)
2.  **Local System Tools** (File system, specialized agents)
3.  **User Interfaces** (CLI, Web Dashboard)

## 🏗 High-Level Architecture

The application runs as a cohesive Node.js process managed by a CLI entry point.

### 1. The Runtime Core (`src/runtime/`)
The Runtime is the central nervous system of Morpheus.
-   **Oracle Engine (`oracle.ts`)**: Implements the `IOracle` interface. It manages the conversation loop using LangChain, handling prompt construction, tool execution, and context management.
-   **Middleware System (`middleware/`)**: A layer that intercepts the agent's execution cycle.
    -   **Sati (Long-Term Memory)**: A specialized sub-agent that allows Morpheus to "remember" facts, preferences, and context across sessions. It retrieves relevant memories *before* the main agent thinks, and consolidates new information *after* the conversation.
-   **Memory System (`memory/`)**: 
    -   **Short-Term**: Conversation history persisted locally using `SQLiteChatMessageHistory` (via `better-sqlite3`).
    -   **Long-Term (Sati)**: A dedicated `santi-memory.db` stores semantic memories and preferences, separated from the chat logs.
-   **LLM Providers (`providers/`)**: A factory pattern (`ProvidersFactory`) abstracts specific LLM implementations (OpenAI, Ollama, etc.), allowing the user to switch models via configuration.

### 2. Channel Adapters (`src/channels/`)
Channels serve as the sensory input and output for the Oracle.
-   **Adapter Pattern**: Each channel (e.g., `TelegramAdapter`) implements a common interface to:
    -   Receive external events (messages, voice notes).
    -   Normalize them into internal standard objects.
    -   Pass them to the Oracle.
    -   Route the Oracle's response back to the external platform.
-   **Security**: Channels enforce strict authorization (allow-lists) to prevents unauthorized access to the local agent.

### 3. Interfaces (CLI & HTTP)
-   **CLI (`src/cli/`)**: Built with `commander`. It handles process lifecycle (start/stop daemon), configuration initialization, and status checks.
-   **HTTP Server (`src/http/`)**: An Express.js server that runs alongside the Agent.
    -   **API**: Exposes endpoints for the UI to fetch status, logs, and update config.
    -   **Static Assets**: Serves the compiled Web UI.

### 4. Web Dashboard (`src/ui/`)
A React-based Single Page Application (SPA) built with Vite and TailwindCSS.
-   Communicates with the Daemon via the local HTTP API.
-   Provides "Matrix-themed" visualization of agent activity, tool usage, and system health.

## 🔄 Data Flow

1.  **Input**: User sends a message via Telegram.
2.  **Ingest**: `TelegramAdapter` receives the webhook/poll update.
3.  **Authorize**: Adapter verifies the User ID against `zaion.yaml`.
4.  **Dispatch**: Valid message is sent to `Oracle.chat()`.
5.  **Middleware (Pre)**: Sati retrieves relevant long-term memories and injects them into the context.
6.  **Think**:
    -   Oracle retrieves context from `SQLite` (Short-term).
    -   Oracle queries LLM (via `LangChain`).
    -   Oracle may execute **Tools** (e.g., search docs, save file).
7.  **Respond**: Oracle generates a final text response.
8.  **Middleware (Post)**: Sati analyzes the interaction in the background to extract and store new long-term memories.
9.  **Output**: `TelegramAdapter` sends the text back to the user's chat.

## 📂 Directory Structure Map

```
bin/                # Executable entry point
src/
├── channels/       # External communication adapters
├── cli/            # CLI Command definitions
├── config/         # Configuration loading & Zod schemas
├── http/           # REST API & Static Server
├── runtime/        # Core Agent logic, Memory, & Providers
├── types/          # Shared TypeScript interfaces
└── ui/             # React Web Dashboard source
```

## 🛠 Tech Stack

-   **Runtime**: Node.js (ES Modules)
-   **Language**: TypeScript
-   **AI Framework**: LangChain
-   **Storage**: SQLite (`better-sqlite3`)
-   **Frontend**: React, Vite, TailwindCSS
-   **Validation**: Zod (for Config & API)
