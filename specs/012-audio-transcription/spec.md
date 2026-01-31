# Feature Specification: Audio Transcription

**Feature Branch**: `012-audio-transcription`
**Created**: 2026-01-30
**Status**: Draft
**Input**: Enable Telegram channel to receive voice messages, transcribe them using Google Gemini Audio Agent, and process the text response.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Voice Message Interaction (Priority: P1)

As a Telegram user, I want to send a voice message to the bot so that I can interact hands-free and receive a text response.

**Why this priority**: Core functionality of the feature.

**Independent Test**: Can be tested by sending a voice message from a Telegram client and verifying a coherent response is received.

**Acceptance Scenarios**:

1. **Given** A user with `audio.apiKey` configured OR `llm.provider` set to Gemini, **When** they send a voice message to the bot, **Then** the bot processes the audio, transcribes it, and replies with a relevant text answer.
2. **Given** A user sending a voice message, **When** the transcription completes, **Then** the transcribed text is processed as a standard user prompt.

---

### User Story 2 - Unsupported Provider Handling (Priority: P2)

As a user configured with a non-Gemini provider AND no separate Gemini API key for audio, I want to be informed that voice messages are not supported for my configuration.

**Why this priority**: Prevents user confusion and reduces support noise.

**Independent Test**: Configure bot with OpenAI/Anthropic and NO `audio.apiKey`, send voice message, check for specific error message.

**Acceptance Scenarios**:

1. **Given** A user configured with a provider other than Gemini (e.g., OpenAI) AND `audio.apiKey` is missing, **When** they send a voice message, **Then** the bot replies with a clear error message stating voice requires a Gemini API key.

### Edge Cases

- **Audio Download Failure**: If Telegram fails to provide the file link, the user receives a "download failed" error.
- **Transcription Failure**: If Gemini fails to transcribe, user receives a "transcription failed" error.
- **Long Audio**: If audio exceeds duration limits (e.g. 5 minutes), system rejects or handles gracefully (Gemini limits apply).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect when a Telegram message contains a voice note.
- **FR-002**: The system MUST validate if the user has a Gemini credential available (either `audio.apiKey` or `llm.provider` = 'gemini').
- **FR-003**: The system MUST retrieve the audio file from Telegram's servers upon receipt.
- **FR-004**: The system MUST send the audio file to the audio agent for transcription using the available Gemini credential.
- **FR-005**: The system MUST return an error message if the user has no Gemini credentials configured.
- **FR-006**: The system MUST pass the transcribed text to the main conversational agent for processing.
- **FR-007**: The system MUST return the conversational agent's text response to the user via Telegram.
- **FR-008**: The system MUST handle audio file download errors and transcription API errors gracefully with user-friendly messages.
- **FR-009**: The system MUST use `DisplayManager` to log key lifecycle events with source set to `"AgentAudio"`: "Audio Received", "Processing started", "Transcription completed", and "Response sent".

### Key Entities

- **AudioAgent**: Component responsible for interfacing with the transcription service.
- **VoiceMessage**: Represents the incoming Telegram audio data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users receive a text response to a valid voice message within 15 seconds (assuming standard network conditions).
- **SC-002**: 100% of voice messages from non-Gemini users trigger the correct unsupported provider error message.
- **SC-003**: The system successfully processes standard Telegram voice formats (e.g. OGG/Opus).
