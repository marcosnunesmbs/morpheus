## ADDED Requirements

### Requirement: Channel session persistence survives daemon restart

The system SHALL persist the mapping between a channel user and their active session to the SQLite database, so that when Morpheus restarts, users automatically continue their previous session without manual intervention.

#### Scenario: Discord user message after restart
- **GIVEN** a Discord user has an active session before restart
- **WHEN** Morpheus restarts and the user sends a message via DM
- **THEN** the system SHALL load the persisted session for that user
- **AND** the conversation SHALL continue in the same session

#### Scenario: Telegram user message after restart
- **GIVEN** a Telegram user has an active session before restart
- **WHEN** Morpheus restarts and the user sends a message
- **THEN** the system SHALL load the persisted session for that user
- **AND** the conversation SHALL continue in the same session

#### Scenario: First message from new user
- **GIVEN** a user has no persisted session
- **WHEN** they send their first message via Discord or Telegram
- **THEN** the system SHALL create a new session for them
- **AND** persist the mapping for future restarts

### Requirement: Session switch persists across restarts

When a user explicitly switches to a different session via command, the system SHALL persist the new session association so it survives restart.

#### Scenario: Discord user switches session
- **GIVEN** a Discord user is in session A
- **WHEN** user executes `/session_switch` to session B
- **THEN** the system SHALL update the persisted mapping to session B
- **AND** after restart, load session B

#### Scenario: Discord user creates new session
- **GIVEN** a Discord user is in session A
- **WHEN** user executes `/newsession` to create session C
- **THEN** the system SHALL switch to session C
- **AND** persist the mapping to session C
- **AND** after restart, load session C

#### Scenario: Session deleted but mapping exists
- **GIVEN** a user has a persisted session mapping to session X
- **AND** session X no longer exists in the sessions table
- **WHEN** the user sends a message
- **THEN** the system SHALL treat this as a new user (create new session)
- **AND** overwrite the stale mapping

### Requirement: Session persistence for Telegram commands

Telegram session management commands (`/sessions`, `/new_session`) SHALL trigger persistence of the session mapping.

#### Scenario: Telegram user lists and switches sessions
- **GIVEN** a Telegram user sends `/sessions`
- **WHEN** they select a different session via inline keyboard
- **THEN** the system SHALL update the persisted mapping
- **AND** after restart, load the selected session