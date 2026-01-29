# Research: Integrate LangChain Agent with CLI Start

**Feature**: `integrated-langchain-agent`
**Status**: Completed

## Unknowns & Clarifications

| ID | Question | Decision | Rationale |
|----|----------|----------|-----------|
| 1 | Does `start` require a CLI REPL? | **No** | The `start` command is designed as a daemon/server mode to host the agent for external channels (Telegram, API, etc.). A CLI interaction mode would typically be a separate command like `chat` or a specific flag. For this feature, we focus on successful initialization and channel binding. If no channels are active, we will log a warning. |
| 2 | How to handle provider errors? | **Catch & Exit** | Errors during `initialize()` (like Invalid API Key) should catch `ProviderError`, log a helpful suggestion, and exit with code 1. This prevents a zombie process. |

## Approaches Considered

### CLI Interaction
- **Option A: Built-in REPL**: Add `readline` loop to `start`.
  - *Pros*: Immediate feedback.
  - *Cons*: Complicates `start` (daemon vs interactive). Conflicts with spinner/logs from other channels.
- **Option B: Channels Only**: Rely on Telegram/adapters.
  - *Pros*: Cleaner separation. `start` just runs the "server".
  - *Decision*: **Option B**. This keeps `start` focused on lifecycle management. A future `morpheus console` or `morpheus chat` can handle direct CLI interaction.

## Implementation Details

- **Validation**: Ensure `config.llm` has required fields before calling `Agent.initialize`.
- **Feedback**: Use `ora` spinner (via `DisplayManager`) to show "Initializing Agent...".
- **Lifecycle**: Ensure `SIGINT` disconnects any active adapters (Telegram) and clears PID.

## Best Practices (LangChain)

- **Initialization**: LangChain models (ChatOpenAI, etc.) are lazy. They don't network until `invoke` is called. However, we want to fail fast if creds are bad.
- **Verification**: To ensure "Agent is ready", we might want to do a "dry run" or simple "hello" ping to the provider during init, OR just assume config is correct to save tokens.
- **Decision**: For now, we trust the config to save startup time and tokens. User will see errors on first message if key is invalid (unless we explicitly add a `verify()` method).
