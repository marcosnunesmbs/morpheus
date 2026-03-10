# Research: Audio Transcription Implementation

**Feature**: Audio Transcription (012)
**Date**: 2026-01-30

## 1. Library Selection: `@google/genai`

### Decision
Use Google's official SDK `@google/genai` for interacting with Gemini API.

### Rationale
-   **Official Support**: Maintained by Google, ensures compatibility with latest Gemini features (like audio upload).
-   **Simplicity**: Provides high-level abstractions for `File API` (uploads) and `Content Generation`.
-   **Performance**: Optimized for Gemini's multimodal capabilities.
-   **Precedent**: The user explicitly requested this library and provided working sample code.

### Alternatives Considered
-   **Rest API (axios)**: More verbose, requires manual handling of multipart uploads and authentication headers. Rejected in favor of SDK.
-   **`langchain` Google integration**: While Morpheus uses LangChain, the specific "audio file upload -> transcribe" flow is often cleaner with the direct SDK for specialized tasks, or we might need to check if LangChain's Google provider supports audio inputs natively yet. Given the user's snippet, direct SDK is the path of least resistance and highest control for this specific agent.

## 2. Audio Flow Architecture

### Workflow
1.  **Telegram Webhook/Polling**: Receives `message` with `voice` property.
2.  **Validation**:
    -   Check if `config.audio.apiKey` is present OR `config.llm.provider === 'gemini'`.
    -   If neither is true, reply with "Audio transcription requires a Gemini API key. Please configure `audio.apiKey` or set LLM provider to Gemini."
3.  **Download**:
    -   Use `ctx.telegram.getFileLink(file_id)` to get a URL.
    -   *Note*: The URL is public (obfuscated) and valid for 1 hour. We can pass this URL directly to Gemini or download it to a buffer.
    -   *Refinement*: The user's snippet uses `ai.files.upload({ file: "path/to/sample.mp3" })`. This implies a local file path.
    -   **Critical Decision**: Does `@google/genai` support uploading from a URL or Buffer?
    -   *Investigation*: The SDK usually takes a file path or a specialized request object. If it requires a file path, we need to download to a temp file (`os.tmpdir()`) first.
    -   *Resolution*: We will implement a `downloadToTemp(url)` utility to ensure compatibility with `ai.files.upload`.

### Transcription Prompt
The prompt "Describe this audio clip" in the user example is generic. For transcription, we should use:
*"Transcribe this audio message accurately. Return only the transcribed text without any additional commentary."*

## 3. Integration Point

### `src/channels/telegram.ts`
Existing code likely handles text messages. We need to add a specific handler:
```typescript
bot.on(message('voice'), async (ctx) => {
  // implementation
});
```
This requires `telegraf` filters.

## 4. Risks & Mitigations

-   **File Size**: Telegram bots have a download limit (20MB). Voice messages are usually small OGG files, so this should remain within limits.
-   **Format**: Telegram sends OGG (Opus). Gemini supports `audio/ogg`. Direct compatibility is expected.
-   **Cost**: Uses Gemini token quota. Storage of files in Gemini is temporary (files API usually involves 48h TTL unless deleted). We should explicity delete the file after transcription if possible to be clean, or rely on TTL.

## 5. Security

-   **Privacy**: Audio is user content. It goes to Google. This is acceptable per Constitution "User's chosen LLM provider".
-   **API Key**:
    -   Priority 1: `config.audio.apiKey` (if set) - allows using Gemini just for audio while using another provider for chat (e.g. OpenAI).
    -   Priority 2: `config.llm.api_key` (if provider is gemini) - reuses main key.
    -   If neither exists, capability is blocked.

## 6. Implementation Strategy

1.  **AudioAgent**: Encapsulate all `@google/genai` logic here.
2.  **Temp File Handling**: Since SDK wants a file path (usually), robust temp file creation/cleanup is needed.

```typescript
// Pseudocode for AudioAgent
import fs from 'fs/promises';
import { GoogleGenAI } from '@google/genai';

class AudioAgent {
    async transcribe(path: string, mime: string, apiKey: string) {
        // ... SDK calls ...
    }
}
```
