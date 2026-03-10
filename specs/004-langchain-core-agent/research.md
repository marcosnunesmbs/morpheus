# Research: LangChain Core Agent

**Created**: 2026-01-29
**Status**: Finalized

## Unknowns & Clarifications

### 1. Minimal LangChain Dependencies
**Question**: Which specific npm packages are needed to support OpenAI, Anthropic, Ollama, and Gemini without bloating the project with the monolithic `langchain` package?
**Resolution**: Use the specialized `@langchain/*` scope.
*   **Core**: `@langchain/core` (Sufficient for `BaseChatModel` and `Runnable`).
*   **OpenAI**: `@langchain/openai`
*   **Anthropic**: `@langchain/anthropic`
*   **Ollama**: `@langchain/ollama` (Prefer over community for stability).
*   **Gemini**: `@langchain/google-genai` (For AI Studio API key access, simpler than VertexAI).

### 2. Interactive CLI setup
**Question**: How to best implement the `init` command?
**Resolution**: Use `inquirer` (v9+ or pure ESM version) for the interactive prompts.
*   **Flow**:
    1.  Check if config exists. If yes, confirm overwrite.
    2.  Select Provider (List).
    3.  Input API Key (Password type for security).
    4.  Input Model Name (Input type, with default based on provider selection).
    5.  Save to `~/.morpheus/config.yaml`.

### 3. Error Handling strategy
**Question**: How to validate configuration at startup?
**Resolution**:
*   **Static Check**: Verify `config.yaml` exists and has non-empty fields for the selected provider.
*   **Runtime Check**: Attempt a simple "Hello" or `invoke` call with a low max_tokens param during `status` or verify method.
*   **Feedback**: On failure, catch the specific LangChain error (e.g., 401 Unauthorized), print a friendly message using `chalk.red`, and suggest `morpheus config`.

## Decisions

- **Architecture**: Polymorphic `BaseChatModel` factory pattern. The "Agent" will verify the config, instantiate the correct class, and expose a simple `chat(message)` method.
- **Persistence**: Conversation history will be in-memory for this MVP (Session scope mentioned in requirements: "single session"). Future specs can add vector/disk memory.
- **Config**: Use `zod` schema (already in project) to strictly validate the configuration file loaded by `js-yaml`.

## Alternatives Considered

- **Using `langchain` monolithic package**: Rejected to minimize install size and startup time.
- **Using `AgentExecutor`**: Rejected. Spec asks for simple "receive message, return response". A direct LLM chain is faster and easier to debug for this stage.
