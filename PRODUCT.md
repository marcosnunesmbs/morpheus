# Morpheus Product Documentation

## 1. Product Overview
Morpheus is a **Local-First AI Operator** designed to be the ultimate companion for software developers. Unlike standard AI chatbots that live in a browser tab and forget you when the session ends, Morpheus runs as a persistent background service on your machine.

It bridges the gap between **Intelligence** (LLMs like GPT-4, Claude), **Communication** (Telegram, Voice), and **Action** (running code, managing files, using tools).

**Core Philosophy:**
*   **Ownership:** Your data and memories live on your disk.
*   **Omnipresence:** Available via Terminal, Web UI, or Mobile Chat.
*   **Agency:** Capable of executing tasks, not just outputting text.

## 2. Target Users
*   **Software Engineers:** Who want an AI assistant that understands their local environment and projects.
*   **Privacy Advocates:** Users who prefer running local models (Ollama) or keeping their conversation history entirely self-hosted.
*   **Power Users:** Individuals managing complex digital workflows who need an automated orchestrator.

## 3. Core Features
*   **Persistent Memory System:**
    *   **Short-Term:** Remembers the full context of the current session.
    *   **Long-Term (Sati):** Learns facts about you, your projects, and preferences over time, automatically retrieving them when relevant.
*   **Multi-Provider LLM Support:** Switch between OpenAI, Anthropic, Google Gemini, or local Ollama models on the fly.
*   **Channel Integration:**
    *   **Telegram:** Full interaction via text and **Voice**. Send a voice note, and Morpheus listens, transcribes, and acts.
    *   **Web Dashboard:** A "Matrix-themed" local control center.
    *   **CLI:** Pipe terminal output directly to the agent.
*   **Tooling (MCP):** Native support for the **Model Context Protocol**, allowing Morpheus to connect to databases, git repositories, and file systems safely.

## 4. User Workflows

### The "On-the-Go" Workflow
1.  User is away from keyboard but has an idea.
2.  User sends a **Voice Note** to Morpheus on Telegram: *"Remind me to refactor the auth integration when I get back, and add a task to the project plan."*
3.  Morpheus transcribes the audio.
4.  Morpheus adds the item to the TODO list (via tool) and acknowledges.

### The "Deep Work" Workflow
1.  User is coding and hits an error.
2.  User pipes the error log to Morpheus via CLI.
3.  User asks: *"What's wrong here?"* via the Web UI or Terminal.
4.  Morpheus analyzes the error using context from the project files (via File System MCP) and suggests a fix.

## 5. Use Cases
*   **Context-Aware Coding Companion:** ask questions about your codebase, dependencies, and architecture.
*   **Personal Knowledge Base:** Morpheus remembers your server IPs, preferred tech stack, and project history.
*   **System Automation:** use Morpheus to check server status or run build scripts via secure tool definitions.
*   **Meeting Assistant:** Record meetings and have Morpheus generate summaries and action items.

## 6. Non-Functional Requirements
*   **Privacy:** All vector embeddings and chat logs are stored locally in SQLite.
*   **Security:** API is protected by a strong password/token mechanism. External channels allow only whitelisted user IDs.
*   **Performance:** The daemon is lightweight (Node.js) and optimized for long-running stability.
*   **Reliability:** Auto-restarts on failure; maintains a PID file to prevent conflicts.

## 7. Product Vision
Morpheus aims to evolve from a "Chatbot" into a **Digital Twin**. Eventually, it will be able to proactively assist with tasks, monitor your digital environment for anomalies, and act as a seamless extension of your cognitive workflow—always running, always remembering, always helpful.
