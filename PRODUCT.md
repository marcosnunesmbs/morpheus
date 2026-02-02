# Morpheus Product Documentation

> **"Morpheus is a local-first AI operator that bridges developers and machines."**

Morpheus is a sophisticated, background-running AI agent designed for developers who demand control, privacy, and extensibility. It acts as an intelligent orchestrator, connecting Large Language Models (LLMs) like OpenAI, Anthropic, and Ollama with your local environment, external communication channels, and developer tools.

## 🏗 Core Philosophy

*   **Local-First:** Your data, configuration, and conversation history reside on your machine.
*   **Developer-Centric:** Managed via CLI, configured via YAML/Typescript, and extended via protocols like MCP.
*   **Omni-Channel:** Interact with your agent wherever you are—terminal, web dashboard, or mobile chat apps.

---

## 🚀 Key Features

### 1. The Intelligent Agent Core
At the heart of Morpheus is a **LangChain-powered orchestrator** that manages context, tools, and execution flow.
*   **Multi-Provider Support:** Seamlessly switch between OpenAI, Anthropic, or local Ollama models.
*   **Persistent Memory:** All interactions are stored in a local SQLite database, allowing the agent to remember context across sessions and channels.
*   **Audio Intelligence:** Native support for transcribing voice messages, enabling true voice-to-text-to-action workflows.

### 2. Multi-Channel Presence
Morpheus doesn't just live in a browser tab. It connects to the platforms you use daily:
*   **Telegram & Discord:** Chat with your agent from your phone. Send voice notes, images, or text commands.
*   **Web Dashboard:** A "Matrix-themed" local web interface (React/Vite) for monitoring agent status, viewing chat history, and managing settings.
*   **CLI:** Direct terminal and standard input integration for piping system data directly to the agent.

### 3. Extensibility & Tooling
Morpheus is designed to *do* things, not just talk.
*   **Model Context Protocol (MCP):** Full support for the MCP standard, allowing Morpheus to connect to databases, file systems, and external APIs using standard server definitions.
*   **Local Tool Execution:** Securely execute defined local scripts and tools.

### 4. Management & Security
*   **Background Daemon:** Runs efficiently in the background using a robust lifecycle manager.
*   **Secure Access:** The Web UI is protected by "The Architect Pass", ensuring only you can control your agent.
*   **Configuration:** Declarative configuration management via `~/.morpheus/config.yaml` or through the interactive Settings UI.

---

## 🛠 Usage Scenarios

| Use Case | Description |
| :--- | :--- |
| **Coding Assistant** | Ask questions about your code, generate snippets, or debug issues directly from your terminal or chat app without context switching. |
| **Voice Memos** | Record a voice note on Telegram while walking; Morpheus transcribes it, summarizes it, and stores it in your notes. |
| **DevOps Automator** | Hook Morpheus up to local deployment scripts or monitoring logs to get natural language alerts and control. |
| **Personal Knowledge Base** | Use the persistent memory to build a long-term context of your projects and preferences. |

## 📦 Architecture

Morpheus is built on a modern TypeScript stack:
*   **Runtime:** Node.js
*   **UI:** React 19 + Vite + TailwindCSS
*   **Storage:** SQLite (`better-sqlite3`)
*   **Orchestration:** LangChain.js

## 🏁 Getting Started

Morpheus is distributed as a global NPM package.

```bash
# Install globally
npm install -g morpheus-cli

# Initialize configuration
morpheus init

# Wake up Morpheus
morpheus start
```

Once running, Morpheus becomes your always-on digital operator, ready to execute tasks and answer queries across any connected channel.
