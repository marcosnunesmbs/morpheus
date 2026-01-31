# Feature Specification: Improved Init Flow

**Feature Branch**: `013-improve-init-flow`
**Created**: 2026-01-30
**Status**: Draft
**Input**: User description: ""

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Smart Config Pre-filling (Priority: P1)

When running `morpheus init`, existing configuration should be detected and suggested as default, preventing accidental overwrites and making reconfiguration faster.

**Why this priority**: Improves DX by making "re-init" non-destructive and faster.

**Independent Test**: Run `morpheus init` twice. Second time should show first run's values as defaults.

**Acceptance Scenarios**:

1. **Given** no existing configuration, **When** user runs `init`, **Then** prompts show standard defaults.
2. **Given** existing configuration at `~/.morpheus/config.yaml`, **When** user runs `init`, **Then** prompts show values from the file as defaults.

---

### User Story 2 - Conditional Audio Configuration (Priority: P1)

Users should be guided through audio setup intelligently, asking for keys only when necessary.

**Why this priority**: Enhances the setup flow for the new Audio feature without cluttering it for non-Gemini users.

**Independent Test**: Run `morpheus init` with different provider choices (OpenAI vs Gemini) and verify Audio Key prompt appearance.

**Acceptance Scenarios**:

1. **Given** user selects `gemini` as LLM provider, **When** enabling audio, **Then** system should NOT ask for a separate Audio API Key (reuse main).
2. **Given** user selects `openai` (or non-gemini), **When** enabling audio, **Then** system MUST ask for "Gemini API Key for Audio".
3. **Given** user selects `openai` and enables audio but leaves Audio Key blank, **Then** system automatically disables audio (sets enabled=false) and warns user.
4. **Given** init flow, **When** prompts appear, **Then** Audio setup occurs BEFORE Channel setup (Telegram/Discord).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST attempt to load existing configuration from `~/.morpheus/config.yaml` at the start of `init` command.
- **FR-002**: If existing config is found, all `inquirer` prompts MUST use the existing values as `default`.
- FR-003: The `init` flow sequence MUST be: Agent -> LLM -> **Audio** -> Channels.
- **FR-004**: System MUST ask "Enable Audio Transcription?" (default: true).
- **FR-005**: If Audio is enabled AND main LLM provider is NOT `gemini`, system MUST prompt for "Gemini API Key for Audio".
- **FR-006**: If the separate Audio API Key prompt is left empty, system MUST set `audio.enabled` to `false` and log a warning ("Audio disabled due to missing key").
- **FR-007**: If Audio is enabled AND main LLM provider IS `gemini`, system MUST set `audio.apiKey` to undefined (or empty), allowing runtime fallback to main key.

### Key Entities *(include if feature involves data)*

- **AudioConfig**: New config section for audio settings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Re-running `init` takes < 10 seconds if just pressing "Enter" (defaults work).
- **SC-002**: Audio is correctly configured in `config.yaml` for both Gemini and Non-Gemini users.
- **SC-003**: No crashes if config file is malformed (should fallback to defaults).

