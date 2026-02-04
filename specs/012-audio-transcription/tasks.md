# Tasks: Audio Transcription

**Branch**: `012-audio-transcription`
**Spec**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)
**Status**: In Progress

## Phase 1: Setup & Configuration
*Goal: Initialize dependencies and configuration structures.*

- [x] T001 Install `@google/genai` dependency using `npm install @google/genai`
- [x] T002 Update `ConfigSchema` in `src/config/schemas.ts` to include `AudioConfigSchema`

## Phase 2: Foundational Components
*Goal: Build the core AudioAgent capable of communicating with Gemini.*

- [x] T003 [P] Create `IAudioAgent` interface and `AudioAgent` class with `transcribe` method in `src/runtime/audio-agent.ts`

## Phase 3: User Story 1 - Voice Message Interaction
*Goal: Enable Telegram users to send voice messages and get responses.*

- [x] T004 [US1] Implement credential validation helper (audio.apiKey vs llm.provider) in `src/channels/telegram.ts`
- [x] T005 [US1] Add `bot.on(message('voice'))` handler in `src/channels/telegram.ts` to capture voice messages
- [x] T006 [US1] Implement audio file download to temporary path in `src/channels/telegram.ts`
- [x] T007 [US1] Integrate `AudioAgent` to transcribe downloaded file and pass text to main agent in `src/channels/telegram.ts`
- [x] T010 [US1] Implement structured logging via `DisplayManager` using source `'Telephonist'` for all audio events (received, downloading, transcribing, success) in `src/channels/telegram.ts`

## Phase 4: User Story 2 - Unsupported Provider Handling
*Goal: Gracefully handle cases where Gemini is not available.*

- [x] T008 [US2] Return user-friendly error in `src/channels/telegram.ts` when credential validation fails

## Phase 5: Polish & Cross-Cutting
*Goal: Ensure robustness and resource management.*

- [x] T009 Add file cleanup logic (delete temp audio files) in `src/channels/telegram.ts`

## Dependencies
- US1 (Voice) requires T003 (AudioAgent) and T002 (Config).
- US2 (Validation) requires the handler structure from US1 (T005).

## Implementation Strategy
1.  Setup dependencies and config.
2.  Build the isolated `AudioAgent`.
3.  Modify `TelegramAdapter` to use the new agent.
4.  Test happy path (US1) and error path (US2).
