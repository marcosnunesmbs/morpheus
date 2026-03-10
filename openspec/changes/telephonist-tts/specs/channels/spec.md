## MODIFIED Requirements

### Requirement: Telegram — command routing
The system SHALL process Telegram commands and route them to the appropriate handler:

| Command | Action |
|---|---|
| `/start` | Welcome message |
| `/help` | Help text |
| `/trinity` | List registered databases |
| `/chronos <...>` | Schedule a new Chronos job |
| `/chronos_list` | List Chronos jobs |
| `/chronos_view <id>` | View job details |
| `/chronos_enable <id>` / `/chronos_disable <id>` | Toggle job |
| `/chronos_delete <id>` | Delete job |
| Any other text | Forwarded to Oracle as a chat message |

#### Scenario: Unknown command forwarded to Oracle
- GIVEN a user sends `/foo bar` in Telegram
- WHEN the adapter receives the message
- THEN it is forwarded to Oracle as a regular chat message

## ADDED Requirements

### Requirement: Telegram — voice response when TTS enabled
The Telegram adapter SHALL respond with a voice message instead of text when the user sent an audio message and `audio.tts.enabled` is `true`.

#### Scenario: Audio input with TTS enabled
- **WHEN** a user sends a voice message on Telegram
- **AND** `audio.tts.enabled` is `true`
- **THEN** the adapter transcribes the audio via Telephonist STT
- **AND** sends the transcription as a text reply
- **AND** forwards the transcription to Oracle
- **AND** synthesizes Oracle's response via Telephonist TTS
- **AND** sends the synthesized audio as a Telegram voice message

#### Scenario: Audio input with TTS disabled
- **WHEN** a user sends a voice message on Telegram
- **AND** `audio.tts.enabled` is `false` or not configured
- **THEN** the existing text response flow is used (no change)

#### Scenario: TTS synthesis fails — fallback to text
- **WHEN** TTS synthesis fails for any reason
- **THEN** the adapter logs the error
- **AND** sends Oracle's response as a text message (graceful degradation)

### Requirement: Discord — voice response when TTS enabled
The Discord adapter SHALL respond with a voice message attachment instead of text when the user sent an audio attachment and `audio.tts.enabled` is `true`.

#### Scenario: Audio input with TTS enabled on Discord
- **WHEN** a user sends an audio attachment on Discord
- **AND** `audio.tts.enabled` is `true`
- **THEN** the adapter transcribes the audio via Telephonist STT
- **AND** sends the transcription as a text reply
- **AND** forwards the transcription to Oracle
- **AND** synthesizes Oracle's response via Telephonist TTS
- **AND** sends the synthesized audio as a Discord voice message attachment

#### Scenario: TTS synthesis fails on Discord — fallback to text
- **WHEN** TTS synthesis fails on Discord
- **THEN** the adapter sends Oracle's response as text (graceful degradation)
