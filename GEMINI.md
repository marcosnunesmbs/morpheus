# Morpheus

## Project Overview

Morpheus is a local-first AI operator that bridges developers and machines. It's a local AI agent for developers, running as a CLI daemon that connects to LLMs, local tools, and MCPs, enabling interaction via Terminal, Telegram, and Discord.

The project is built with **Node.js** and **TypeScript**, using **LangChain** as the orchestration engine. It runs as a background daemon process, managing connections to LLM providers (OpenAI, Anthropic, Ollama) and external channels (Telegram, Discord).

### Core Components

- **Runtime (`src/runtime/`)**: The heart of the application. Manages the Oracle (agent) lifecycle, provider instantiation, and command execution. The core logic is in `src/runtime/oracle.ts`.
- **CLI (`src/cli/`)**: Built with `commander`, handles user interaction, configuration, and daemon control (`start`, `stop`, `status`). The main entry point is `src/cli/index.ts`.
- **Configuration (`src/config/`)**: Singleton-based configuration manager using `zod` for validation and `js-yaml` for persistence (`~/.morpheus/zaion.yaml`).
- **Channels (`src/channels/`)**: Adapters for external communication. Currently supports Telegram (`telegraf`) with strict user whitelisting.
- **Web UI (`src/ui/`)**: A React-based web dashboard to manage recordings, chat history, and system status.

## Building and Running

### Prerequisites

- **Node.js**: >= 18.x
- **npm**: >= 9.x
- **TypeScript**: >= 5.x

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/marcosnunesmbs/morpheus.git
    cd morpheus
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Running the Application

-   **Build the project:**
    ```bash
    npm run build
    ```
-   **Run the CLI:**
    ```bash
    npm start -- <command>
    ```
    Replace `<command>` with one of the available commands (e.g., `init`, `start`, `status`).

### Running in Development

-   **Run the CLI in watch mode:**
    ```bash
    npm run dev:cli
    ```
-   **Run the UI in development mode:**
    ```bash
    npm run dev:ui
    ```

### Testing

-   **Run tests:**
    ```bash
    npm test
    ```

## Development Conventions

-   **Testing:** The project uses **Vitest** for testing.
-   **Linting and Formatting:** (TODO: Infer from configuration files or suggest a standard like ESLint/Prettier).
-   **Contribution Guidelines:** See `CONTRIBUTING.md`.
