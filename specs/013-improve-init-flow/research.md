# Research: Improved Init Flow

**Feature**: Improved Init Flow (013)
**Date**: 2026-01-30

## 1. Config Loading Strategy

### Decision
Load the existing configuration via `ConfigManager.load()` at the very beginning of the `init` command execution.

### Rationale
- `ConfigManager` already handles file existence checks and YAML parsing.
- It returns the robust `DEFAULT_CONFIG` if no file exists, which maps perfectly to the "defaults" we want to show for a first-time user.
- This creates a unified code path: `default: config.agent.name` works whether it came from a file or the hardcoded default.

## 2. Audio Configuration Flow

### Hierarchy
Audio settings are distinct from "Channels" because they are a capability of the Agent, often tied to the LLM provider, whereas Channels are external interfaces (Telegram, Discord).

### Flow Logic
1. **Agent Setup** (Name, Personality)
2. **LLM Setup** (Provider, Model, Main Key)
3. **Audio Setup**
   - "Enable Audio?" (Default: `config.audio.enabled`)
   - IF enabled: we check `config.llm.provider`.
     - IF `gemini`: No Key prompt.
     - IF `!gemini`: Prompt "Audio API Key" (Default: `config.audio.apiKey`).
4. **Channels Setup** (Telegram, etc.)

### Handling Missing Keys
If the user selects a non-Gemini provider (e.g., OpenAI) for chat, enables Audio, but leaves the separate Gemini Audio Key blank:
- **Action**: We must disable audio.
- **Why**: The runtime will fail otherwise. Better to disable it explicitly during config.

## 3. Library Capabilities (`@inquirer/prompts`)

### `default` Parameter
All prompts (`input`, `confirm`, `password`, `select`) support a `default` property.
- We will bind this to `currentConfig.path.to.value`.

### `when` Logic
`@inquirer/prompts` functions are promises. We control the flow with standard JS `if/else` or `switch` statements rather than a declarative `when` callback (unlike the older `inquirer` library).
- This makes our conditional logic (checking provider + audio enabled status) straightforward procedural code.

## 4. Security

- **API Keys**: We currently use `password` prompt which masks input.
- **Pre-filling**:
    - For `apiKey`, we should **NOT** reveal the actual key as a default in cleartext if editing.
    - However, `password` prompt doesn't really show the default.
    - **Strategy**: Show `(Preserve existing)` if a key exists, or leave blank to overwrite. Or simply ask "Enter new key (leave empty to keep existing *******)".
    - *Refinement*: The `password` prompt doesn't support "leave empty to keep" natively without custom logic.
    - *Simpler Approach for MVP*: Just show standard prompt. If user hits enter on empty, we might need to handle "if empty, keep old".
    - *Revised Strategy*:
        - Prompt: "Enter API Key (leave empty to keep existing ending in ...X123, or if using env vars):"
        - If input is empty AND existing key exists -> keep existing.
        - If input is empty AND no existing -> undefined (env var).

## 5. Artifacts Created

- No new libraries needed.
- No new data models (using existing `AudioConfig`).
- No new contracts.

