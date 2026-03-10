# Implementation Plan: Audio Transcription

**Branch**: `012-audio-transcription` | **Date**: 2026-01-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/012-audio-transcription/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable Morpheus to accept voice messages from Telegram, transcribe them using Google's Gemini API, and process the resulting text as a standard user prompt.

**Key Components:**
1.  **AudioAgent**: A new runtime service utilizing `@google/genai` to handle file uploads and transcription requests to Gemini.
2.  **Telegram Adapter Update**: Enhancement to `src/channels/telegram.ts` to listen for `voice` events, validate credentials (checking explicit audio key or generic Gemini provider), and orchestrate the transcription flow.
3.  **Configuration**: New schema entries for audio settings (enabled status, max duration, optional API key).

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js >= 18
**Primary Dependencies**: `@google/genai` (Google's official SDK for Gemini)
**Storage**: Temporary memory buffers for audio handling; no persistent local storage of audio files.
**Testing**: Vitest for unit tests of `AudioAgent`; manual integration testing for Telegram flow.
**Target Platform**: Local Runtime (CLI/Daemon)
**Project Type**: Backend / Agent Runtime
**Performance Goals**: Transcription + Response < 10s.
**Constraints**:
-   Requires valid Gemini API credentials (specific or global).
-   Relies on Telegram's `getFileLink` API.
-   Subject to Gemini API limits (file size/rate limits).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

-   [x] **Local-First & Privacy**: Audio is processed locally (downloaded to memory/temp) then sent *only* to the user's chosen LLM provider (Gemini). No third-party data collection. Compliant with Principle I exception for LLM providers.
-   [x] **Extensibility**: Implemented as a modular agent (`AudioAgent`) that can be swapped or extended for other providers later.
-   [x] **DX**: flexible configuration allows using Gemini for audio even if main chat uses another provider.
-   [x] **Reliability**: Explicit validation of credentials before accepting voice messages prevents phantom errors.

## Project Structure

### Documentation (this feature)

```text
specs/012-audio-transcription/
├── plan.md              # This file
├── research.md          # Implementation details & library selection
├── data-model.md        # Configuration schema extensions
├── quickstart.md        # Usage guide
├── contracts/           # Interface definitions
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
src/
├── config/
│   └── schemas.ts       # Added AudioConfigSchema
├── runtime/
│   └── audio-agent.ts   # New: AudioAgent class & IAudioAgent interface
└── channels/
    └── telegram.ts      # Modified: added voice message handler
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A       |            |                                     |

