# Audio Transcription Feature Specification

## Overview

This specification describes the implementation of audio transcription functionality for the Telegram channel, enabling users to send voice messages that are automatically transcribed and processed by Morpheus.

## Feature Summary

**Feature Name:** Audio Transcription  
**Component:** Telegram Channel + Audio Agent  
**Dependencies:** Google Gemini API (`@google/genai`)  
**Target Version:** 0.2.0

## User Story

As a Morpheus user communicating via Telegram, I want to send voice messages that are automatically transcribed and processed, so that I can interact with the agent hands-free without typing.

## Technical Requirements

### 1. Telegram Channel Updates

#### 1.1 Voice Message Handler
- **Trigger:** `bot.on(message('voice'))`
- **Input:** Voice message from Telegram user
- **Output:** Transcribed text sent to main conversation agent

#### 1.2 Audio URL Retrieval
- Use Telegram Bot API to get audio file URL
- API Call: `ctx.telegram.getFileLink(ctx.message.voice.file_id)`
- Returns a temporary URL to download the audio file

#### 1.3 Validation Flow
```
1. Receive voice message
2. Validate user (existing user validation)
3. Check if user's LLM provider is Gemini
   - If NOT Gemini: Return error message to user
   - If Gemini: Proceed to transcription
4. Get audio file URL
5. Send to AudioAgent for transcription
6. Receive transcribed text
7. Pass text to main Agent as user message
8. Return Agent response to user
```

### 2. Audio Agent Implementation

#### 2.1 New Component: `AudioAgent`
**Location:** `src/runtime/audio-agent.ts`

**Interface:**
```typescript
export interface IAudioAgent {
  /**
   * Transcribes audio file to text using Gemini
   * @param audioUrl - URL or file path to audio
   * @param mimeType - Audio MIME type (e.g., 'audio/ogg', 'audio/mp3')
   * @param apiKey - Gemini API key
   * @returns Transcribed text
   */
  transcribe(audioUrl: string, mimeType: string, apiKey: string): Promise<string>;
}
```

#### 2.2 Implementation Details

**Library:** `@google/genai`

**Key Functions:**
- `GoogleGenAI` - Main client
- `createUserContent` - Create user message content
- `createPartFromUri` - Attach audio file to request

**Model:** `gemini-3-flash-preview` (or latest supported model)

**Process:**
1. Initialize Google GenAI client with API key
2. Upload audio file to Gemini
3. Generate content with audio URI and transcription prompt
4. Extract and return transcribed text

#### 2.3 Example Implementation
```typescript
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

export class AudioAgent implements IAudioAgent {
  async transcribe(audioUrl: string, mimeType: string, apiKey: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey });
    
    // Upload audio file
    const audioFile = await ai.files.upload({
      file: audioUrl,
      config: { mimeType },
    });
    
    // Request transcription
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: createUserContent([
        createPartFromUri(audioFile.uri, audioFile.mimeType),
        "Transcribe this audio message accurately. Return only the transcribed text without any additional commentary.",
      ]),
    });
    
    return response.text;
  }
}
```

### 3. Error Handling

#### 3.1 Provider Not Supported
- **Condition:** User's LLM provider is not Gemini
- **Response:** "❌ Voice messages are only supported with Gemini provider. Please update your configuration to use Gemini."

#### 3.2 Audio Download Failed
- **Condition:** Cannot retrieve audio file from Telegram
- **Response:** "❌ Failed to download audio file. Please try again."

#### 3.3 Transcription Failed
- **Condition:** Gemini API error or transcription failure
- **Response:** "❌ Failed to transcribe audio. Please try again or send a text message."

#### 3.4 Audio Too Long
- **Condition:** Audio exceeds API limits (check Gemini limits)
- **Response:** "❌ Audio message is too long. Please send a shorter message."

### 4. Configuration

#### 4.1 Config Schema Updates
Add to `src/config/schemas.ts`:

```typescript
export const AudioConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxDurationSeconds: z.number().default(300), // 5 minutes
  supportedMimeTypes: z.array(z.string()).default([
    'audio/ogg',
    'audio/mp3',
    'audio/mpeg',
    'audio/wav',
  ]),
});
```

#### 4.2 User Preferences
No additional user configuration needed beyond existing LLM provider settings.

### 5. Data Flow

```
┌─────────────┐
│   Telegram  │
│    User     │
└──────┬──────┘
       │ (voice message)
       ▼
┌─────────────────┐
│  Telegram Bot   │
│  message('voice'│
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Validate User  │
└──────┬──────────┘
       │
       ▼
┌─────────────────────┐
│ Check Provider ==   │
│     Gemini?         │
└──────┬──────────────┘
       │ YES
       ▼
┌─────────────────────┐
│ Get Audio File URL  │
│ (getFileLink)       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   AudioAgent        │
│ .transcribe()       │
└──────┬──────────────┘
       │ (transcribed text)
       ▼
┌─────────────────────┐
│   Main Agent        │
│ .processMessage()   │
└──────┬──────────────┘
       │ (response)
       ▼
┌─────────────────────┐
│  Telegram Reply     │
└─────────────────────┘
```

## Implementation Checklist

### Phase 1: Audio Agent Core
- [ ] Install `@google/genai` dependency
- [ ] Create `src/runtime/audio-agent.ts`
- [ ] Implement `IAudioAgent` interface
- [ ] Implement `AudioAgent.transcribe()` method
- [ ] Add unit tests for AudioAgent
- [ ] Add error handling for API failures

### Phase 2: Telegram Integration
- [ ] Add voice message handler `bot.on(message('voice'))`
- [ ] Implement provider validation (Gemini only)
- [ ] Implement audio URL retrieval
- [ ] Integrate AudioAgent into Telegram flow
- [ ] Add error messages for unsupported providers
- [ ] Test with various audio formats

### Phase 3: Configuration & Polish
- [ ] Add audio configuration schema
- [ ] Add audio duration limits
- [ ] Add MIME type validation
- [ ] Add user feedback during transcription ("🎤 Transcribing...")
- [ ] Update documentation
- [ ] Add integration tests

## Testing Strategy

### Unit Tests
- `AudioAgent.transcribe()` with valid audio
- `AudioAgent.transcribe()` with invalid API key
- `AudioAgent.transcribe()` with network errors
- Provider validation logic

### Integration Tests
- End-to-end flow: Voice → Transcription → Response
- Error handling with non-Gemini providers
- Audio file download failures
- Various audio formats and durations

### Manual Testing
- Send voice message via Telegram
- Verify transcription accuracy
- Test error messages
- Test with different audio lengths
- Test with background noise

## Security Considerations

1. **Audio File Access**
   - Telegram file URLs are temporary and expire
   - No persistent storage of audio files
   - Audio is sent directly to Gemini API

2. **API Key Protection**
   - Use user's configured Gemini API key
   - Never log or expose API keys
   - Validate API key before use

3. **Rate Limiting**
   - Respect Gemini API rate limits
   - Consider implementing cooldown between audio requests
   - Handle rate limit errors gracefully

## Performance Considerations

1. **Processing Time**
   - Audio download: 1-3 seconds (depends on size)
   - Gemini transcription: 2-5 seconds (depends on audio length)
   - Total latency: 3-8 seconds
   - Show "processing" indicator to user

2. **Resource Usage**
   - Audio files not stored locally
   - Minimal memory footprint
   - Network bandwidth depends on audio size

## Future Enhancements

1. **Multi-Provider Support**
   - OpenAI Whisper integration
   - Azure Speech Services
   - Local transcription (whisper.cpp)

2. **Advanced Features**
   - Language detection
   - Speaker diarization
   - Emotion/tone analysis
   - Audio quality enhancement

3. **User Experience**
   - Real-time transcription progress
   - Transcription caching
   - Edit transcription before sending
   - Audio playback in Web UI

## Dependencies

### New Package Dependencies
```json
{
  "@google/genai": "^0.3.0"
}
```

### API Requirements
- Google Gemini API access
- Gemini API key with file upload permissions
- Telegram Bot API access (existing)

## Documentation Updates

### User Documentation
- Add voice message instructions to Telegram guide
- Document Gemini requirement for audio
- Add troubleshooting section for audio issues

### Developer Documentation
- Document AudioAgent API
- Add examples for extending to other providers
- Document audio format support matrix

## Acceptance Criteria

✅ User can send voice message in Telegram  
✅ System validates user has Gemini provider  
✅ Audio is successfully transcribed  
✅ Transcribed text is processed by main agent  
✅ Response is returned to user  
✅ Clear error messages for unsupported providers  
✅ Graceful error handling for all failure cases  
✅ Audio processing completes within 10 seconds for typical voice messages  
✅ Unit tests achieve >80% code coverage  
✅ Integration tests pass for happy path and error cases  

## References

- [Google GenAI SDK Documentation](https://github.com/google/generative-ai-js)
- [Telegram Bot API - Voice Messages](https://core.telegram.org/bots/api#voice)
- [Gemini API Audio Support](https://ai.google.dev/gemini-api/docs/audio)

---

**Document Version:** 1.0  
**Last Updated:** January 30, 2026  
**Author:** Morpheus Development Team  
**Status:** Draft
