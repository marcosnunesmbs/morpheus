# Quickstart: CLI Initialization

The `morpheus init` command is the entry point for setting up your agent. It is designed to be idempotent—safe to run multiple times to update settings without losing everything.

## Basic Usage

```bash
morpheus init
```

## Setup Flow

1.  **Agent Identity**: Name and personality.
2.  **LLM Provider**: Choose your brain (OpenAI, Gemini, etc.).
3.  **Audio Setup**:
    - Optional feature to transcribe voice messages.
    - Requires a Google Gemini API key.
    - *Smart Fallback*: If your main provider is Gemini, you don't need a second key!
4.  **Channels**: Connect Telegram, Discord, etc.

## Re-configuring

To change a setting (e.g., switch models), just run `init` again.
- Press **Enter** to keep existing values (displayed in parenthesis).
- Type a new value to overwrite.
- For API keys, leave blank to keep the existing one.

## Troubleshooting

- **"Audio disabled due to missing key"**:
    - You selected a non-Gemini provider (like OpenAI) but didn't provide a Gemini key for audio. Audio is strictly optional but requires valid credentials if enabled.
