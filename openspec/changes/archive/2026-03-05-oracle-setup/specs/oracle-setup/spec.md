## ADDED Requirements

### Requirement: Setup state persistence
The system SHALL maintain a `setup_state` table in `short-memory.db` to persist collected fields and completion status.

#### Scenario: Table initialized on first run
- **WHEN** `SetupRepository.initialize()` is called
- **THEN** the `setup_state` table is created if it does not exist, with columns `id`, `field`, `value`, `created_at`

#### Scenario: Completion flag stored
- **WHEN** all configured fields have been saved
- **THEN** a record with `field = '__completed__'` is inserted into `setup_state`

#### Scenario: isCompleted returns true after flag
- **WHEN** `SetupRepository.isCompleted()` is called and `__completed__` record exists
- **THEN** it returns `true`

#### Scenario: isCompleted returns false before flag
- **WHEN** `SetupRepository.isCompleted()` is called and no `__completed__` record exists
- **THEN** it returns `false`

---

### Requirement: Setup disabled via config
The system SHALL skip the setup flow entirely when `setup.enabled` is `false` in config.

#### Scenario: isCompleted shortcircuits on disabled
- **WHEN** `setup.enabled = false` in config
- **THEN** `SetupRepository.isCompleted()` returns `true` regardless of DB state

---

### Requirement: Oracle setup tool
The system SHALL provide a `setup_save` tool available to Oracle during the setup phase.

#### Scenario: Tool saves fields to DB and Sati
- **WHEN** Oracle calls `setup_save` with a map of field/value pairs
- **THEN** each field is persisted in `setup_state` AND saved to Sati as a memory with prefix `[SETUP] <field>: <value>`

#### Scenario: Tool marks completion
- **WHEN** Oracle calls `setup_save` and all required fields are present
- **THEN** the `__completed__` flag is written to `setup_state`

#### Scenario: Tool returns confirmation
- **WHEN** `setup_save` executes successfully
- **THEN** it returns a success message listing saved fields

---

### Requirement: Partial setup recovery
The system SHALL track which fields have already been collected so the Oracle does not re-ask them after a restart.

#### Scenario: Missing fields identified on resume
- **WHEN** `SetupRepository.getMissingFields()` is called
- **THEN** it returns the list of configured fields that have no record in `setup_state`

#### Scenario: Empty list when all collected
- **WHEN** all configured fields have records in `setup_state`
- **THEN** `getMissingFields()` returns an empty array
