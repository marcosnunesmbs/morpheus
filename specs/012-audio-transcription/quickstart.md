# Quickstart: Telegram Audio Transcription

This feature allows you to send voice messages to Morpheus via Telegram. The bot will transcribe the audio and reply to the content.

## Prerequisites

1.  **Morpheus v0.2.0+**
2.  **Google Gemini** configured as your LLM provider.
3.  **Telegram Bot** connected.

## Configuration

You can enable audio transcription in two ways:

1.  **Using Gemini as main provider**:
    ```yaml
    llm:
      provider: "gemini"
      api_key: "YOUR_GEMINI_API_KEY"
    
    audio:
      enabled: true
    ```

2.  **Using specific key for audio (mixed provider)**:
    ```yaml
    llm:
      provider: "openai" # Main chat uses OpenAI
      api_key: "YOUR_OPENAI_KEY"

    audio:
      enabled: true
      apiKey: "YOUR_GEMINI_API_KEY" # Audio uses Gemini
    ```

## Usage

1.  Open your Telegram chat with the bot.
2.  Hold the **Microphone** icon to record a message.
3.  Release to send.
4.  Wait a moment for the bot to state "Processing audio..." (if enabled) or simply reply with the answer.

## Troubleshooting

-   **"Audio transcription requires a Gemini API key..."**:
    -   Cause: Your `llm.provider` is NOT `gemini` AND you haven't set `audio.apiKey`.
    -   Fix: Add `apiKey` to the `audio` section in `~/.morpheus/config.yaml`.

-   **"Failed to transcribe audio"**:
    -   Cause: Gemini API error or audio format issue.
    -   Fix: Check logs (`npm start -- logs`) for details.
